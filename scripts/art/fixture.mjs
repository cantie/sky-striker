// Test helper: a small stand-in for a raw Hunyuan3D GLB. One mesh, POSITION + TEXCOORD_0 (no normals by
// default), one material whose base color is a JPEG labeled image/png, like Hunyuan's output.
import { Document, NodeIO } from '@gltf-transform/core'
import sharp from 'sharp'

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

/**
 * A flattened UV sphere (Y is the thin axis) with a longer nose on +Z, and one glow stripe in its texture.
 * `charts`: every triangle is its own UV island, like a Hunyuan texture atlas cut into many small pieces.
 * `mr`: a 64×64 metallic-roughness texture as well, as Hunyuan's PBR output has.
 */
export async function fixtureGlb({ tris = 10_000, normals = false, mimeLie = true, stripe = '#3fd4ff', charts = false, mr = false } = {}) {
  const rings = Math.max(4, Math.round(Math.sqrt(tris / 2)))
  const segs = Math.max(8, Math.round(tris / (2 * rings)))
  const pos = [], uv = [], nor = [], idx = []
  for (let i = 0; i <= rings; i++) {
    const phi = (i / rings) * Math.PI
    for (let j = 0; j <= segs; j++) {
      const th = (j / segs) * Math.PI * 2
      const x = Math.sin(phi) * Math.cos(th), y = Math.cos(phi), z = Math.sin(phi) * Math.sin(th)
      pos.push(x, y * 0.25, z > 0 ? z * 2 : z)
      nor.push(x, y, z)
      uv.push(j / segs, i / rings)
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * (segs + 1) + j, b = a + segs + 1
      if (!charts) { idx.push(a, b, a + 1, b, b + 1, a + 1); continue }
      // Each triangle gets its own copies of its corners, UVs shifted: every edge is a UV seam
      for (const tri of [[a, b, a + 1], [b, b + 1, a + 1]]) {
        const base = pos.length / 3, shift = (idx.length % 13) * 0.01
        for (const v of tri) {
          pos.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2])
          nor.push(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2])
          uv.push(uv[v * 2] + shift, uv[v * 2 + 1])
        }
        idx.push(base, base + 1, base + 2)
      }
    }
  }

  // 64×64 gray with an 8-pixel stripe of the glow color
  const px = Buffer.alloc(64 * 64 * 3, 110)
  const [r, g, b] = hex(stripe)
  for (let y = 28; y < 36; y++) for (let x = 0; x < 64; x++) px.set([r, g, b], (y * 64 + x) * 3)
  const jpeg = await sharp(px, { raw: { width: 64, height: 64, channels: 3 } }).jpeg({ quality: 95 }).toBuffer()

  const doc = new Document()
  const buffer = doc.createBuffer()
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer)
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', acc('VEC3', new Float32Array(pos)))
    .setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array(uv)))
    .setIndices(acc('SCALAR', new Uint32Array(idx)))
  if (normals) prim.setAttribute('NORMAL', acc('VEC3', new Float32Array(nor)))
  const tex = doc.createTexture('base').setImage(new Uint8Array(jpeg)).setMimeType(mimeLie ? 'image/png' : 'image/jpeg')
  const mat = doc.createMaterial('mat').setBaseColorTexture(tex).setMetallicFactor(0.5).setRoughnessFactor(0.5)
  if (mr) {
    const noise = Buffer.alloc(64 * 64 * 3)
    for (let i = 0; i < noise.length; i++) noise[i] = (i * 37) % 256
    const png = await sharp(noise, { raw: { width: 64, height: 64, channels: 3 } }).png().toBuffer()
    mat.setMetallicRoughnessTexture(doc.createTexture('mr').setImage(new Uint8Array(png)).setMimeType('image/png'))
  }
  prim.setMaterial(mat)
  const node = doc.createNode('craft').setMesh(doc.createMesh('craft').addPrimitive(prim))
  doc.createScene().addChild(node)
  return new NodeIO().writeBinary(doc)
}
