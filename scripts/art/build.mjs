// Step build: a raw Hunyuan3D GLB → public/models/ai/<id>.glb, within the asset's budget.
import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { Logger } from '@gltf-transform/core'
import { meshopt, prune, dedup, simplify, textureCompress, weld } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'
import * as THREE from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { artIO, countTris } from './checks.mjs'
import { hexToHsv, rgbToHsv } from './manifest.mjs'

const CREASE_DEG = 35

export function realMime(bytes) {
  const b = bytes
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'image/webp'
  return null
}

const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d) }

/** Lights are only painted: bright pixels close to the glow hue become the emissive map, the rest black. */
export function extractEmissive(rgba, glow) {
  const want = hexToHsv(glow).h
  const out = new Uint8Array(rgba.length)
  let lit = 0
  for (let i = 0; i < rgba.length; i += 4) {
    const { h, s, v } = rgbToHsv(rgba[i], rgba[i + 1], rgba[i + 2])
    if (v >= 0.75 && s >= 0.45 && hueGap(h, want) <= 20) {
      out[i] = rgba[i]; out[i + 1] = rgba[i + 1]; out[i + 2] = rgba[i + 2]
      lit++
    }
    out[i + 3] = 255
  }
  return { rgba: out, lit }
}

/** Hunyuan3D gives no normals: bake creased ones (and apply `turn`) through three.js, then re-index. */
function bakeNormals(doc, turn) {
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(prim.getAttribute('POSITION').getArray().slice(), 3))
      const uv = prim.getAttribute('TEXCOORD_0')
      if (uv) g.setAttribute('uv', new THREE.BufferAttribute(uv.getArray().slice(), 2))
      const idx = prim.getIndices()
      if (idx) g.setIndex(Array.from(idx.getArray()))
      if (turn === 180) g.rotateY(Math.PI)
      const c = toCreasedNormals(g, (CREASE_DEG * Math.PI) / 180)
      const buffer = doc.getRoot().listBuffers()[0]
      const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer)
      for (const name of prim.listSemantics()) if (name !== 'POSITION' && name !== 'TEXCOORD_0') prim.setAttribute(name, null)
      prim.setIndices(null)
      prim.setAttribute('POSITION', acc('VEC3', new Float32Array(c.getAttribute('position').array)))
      prim.setAttribute('NORMAL', acc('VEC3', new Float32Array(c.getAttribute('normal').array)))
      if (uv) prim.setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array(c.getAttribute('uv').array)))
    }
  }
}

async function addEmissive(doc, glow) {
  for (const mat of doc.getRoot().listMaterials()) {
    const base = mat.getBaseColorTexture()
    if (!base) continue
    const { data, info } = await sharp(Buffer.from(base.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const { rgba, lit } = extractEmissive(data, glow)
    if (!lit) continue
    const png = await sharp(Buffer.from(rgba), { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()
    const tex = doc.createTexture(`${base.getName() || 'base'}-glow`).setImage(new Uint8Array(png)).setMimeType('image/png')
    mat.setEmissiveTexture(tex).setEmissiveFactor([1, 1, 1])
  }
}

export async function buildAsset(rawPath, outPath, asset, budget) {
  const io = await artIO()
  await MeshoptSimplifier.ready
  const doc = await io.read(rawPath)
  doc.setLogger(new Logger(Logger.Verbosity.WARN))
  // Hunyuan labels its JPEG base color image/png; resizing then fails ("width 0")
  for (const t of doc.getRoot().listTextures()) {
    const real = realMime(t.getImage())
    if (real && real !== t.getMimeType()) t.setMimeType(real)
  }
  await doc.transform(weld())
  const tris = countTris(doc)
  if (tris > budget.tris) {
    for (const error of [0.01, 0.05]) {
      await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, budget.tris / countTris(doc)), error }))
      if (countTris(doc) <= budget.tris) break
    }
  }
  bakeNormals(doc, asset.turn ?? 0)
  await doc.transform(weld())
  if (asset.glow) await addEmissive(doc, asset.glow)
  await doc.transform(
    dedup(), prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [budget.px, budget.px] }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  )
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, await io.writeBinary(doc))
  return { tris: countTris(doc), bytes: statSync(outPath).size }
}
