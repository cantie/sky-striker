// Checks on a built GLB: what the game needs from every AI model (spec, Section 4).
import { statSync } from 'node:fs'
import { getBounds, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import sharp from 'sharp'
import { hexToHsv, rgbToHsv } from './manifest.mjs'

export async function artIO() {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready])
  return new NodeIO().registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })
}

export async function readGlb(path) {
  return (await artIO()).read(path)
}

export function countTris(doc) {
  let n = 0
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const p of mesh.listPrimitives()) {
      const count = p.getIndices()?.getCount() ?? p.getAttribute('POSITION')?.getCount() ?? 0
      n += Math.floor(count / 3)
    }
  }
  return n
}

const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d) }

/** Mean hue (degrees) of the visibly lit pixels of an encoded image, or null when none are lit. */
async function litHue(bytes) {
  const { data } = await sharp(Buffer.from(bytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let x = 0, y = 0, n = 0
  for (let i = 0; i < data.length; i += 4) {
    const { h, v } = rgbToHsv(data[i], data[i + 1], data[i + 2])
    if (v < 0.3) continue
    x += Math.cos((h * Math.PI) / 180)
    y += Math.sin((h * Math.PI) / 180)
    n++
  }
  if (!n) return null
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

const FLAT_KINDS = ['player', 'enemy', 'boss']

/** Problems with a built model, one line each; empty when it is ready for the game. */
export async function checkGlb(path, asset, budget) {
  const problems = []
  const doc = await readGlb(path)
  const root = doc.getRoot()
  for (const mesh of root.listMeshes()) {
    for (const p of mesh.listPrimitives()) {
      if (!p.getAttribute('NORMAL')) { problems.push(`${mesh.getName() || 'a mesh'} has no normals`); break }
    }
  }
  for (const t of root.listTextures()) {
    if (t.getMimeType() !== 'image/webp') problems.push(`texture ${t.getName() || '?'} is ${t.getMimeType()}, not webp`)
  }
  if (!root.listExtensionsUsed().some((e) => e.extensionName === 'EXT_meshopt_compression')) problems.push('not meshopt-compressed')
  const tris = countTris(doc)
  if (tris > budget.tris) problems.push(`${tris} triangles, budget ${budget.tris}`)
  const bytes = statSync(path).size
  if (bytes > budget.kb * 1024) problems.push(`${Math.round(bytes / 1024)} KB, budget ${budget.kb} KB`)
  if (FLAT_KINDS.includes(asset.kind) && !asset.tall) {
    const b = getBounds(root.listScenes()[0])
    const [x, y, z] = [0, 1, 2].map((i) => b.max[i] - b.min[i])
    if (!(y < x && y < z)) problems.push(`does not lie flat (size ${x.toFixed(2)} × ${y.toFixed(2)} × ${z.toFixed(2)})`)
  }
  if (asset.glow) {
    const want = hexToHsv(asset.glow).h
    const maps = root.listMaterials().map((m) => m.getEmissiveTexture()).filter(Boolean)
    if (!maps.length) problems.push(`no emissive map for glow ${asset.glow}`)
    else {
      const hue = await litHue(maps[0].getImage())
      if (hue === null) problems.push(`emissive map is black, expected glow ${asset.glow}`)
      else if (hueGap(hue, want) > 25) problems.push(`emissive hue ${hue.toFixed(0)}° is not the glow ${asset.glow} (${want.toFixed(0)}°)`)
    }
  }
  return problems
}
