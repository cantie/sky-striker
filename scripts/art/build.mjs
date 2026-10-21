// Step build: a raw Hunyuan3D GLB → public/models/ai/<id>.glb, within the asset's budget.
import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { Logger } from '@gltf-transform/core'
import { cloneDocument, meshopt, prune, dedup, simplify, textureCompress, weld } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'
import * as THREE from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { artIO, countTris } from './checks.mjs'
import { hexToHsv, rgbToHsv } from './manifest.mjs'

const CREASE_DEG = 35
/**
 * Encodings tried in turn until the GLB fits its size budget (busy paint compresses poorly): each webp
 * quality first with a near-lossless glow map, then with a lossy one (large lights keep their color lossy).
 */
const ENCODINGS = [80, 70, 60, 50].flatMap((quality) => [{ quality, nearLossless: true }, { quality, nearLossless: false }])

export function realMime(bytes) {
  const b = bytes
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'image/webp'
  return null
}

const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d) }

/**
 * Which pixels are painted lights: saturated, close to the glow hue, and bright. "Bright" is 0.75, or
 * 0.15 under the brightest such pixel when the texture has none that bright (ZPS 3D paints some lights
 * dark), never under 0.5.
 */
export function lightMask(rgba, glow) {
  const want = hexToHsv(glow).h
  const n = rgba.length / 4
  const vs = new Float32Array(n)
  let vmax = 0
  for (let p = 0; p < n; p++) {
    const i = p * 4
    const { h, s, v } = rgbToHsv(rgba[i], rgba[i + 1], rgba[i + 2])
    vs[p] = s >= 0.45 && hueGap(h, want) <= 20 ? v : -1
    vmax = Math.max(vmax, vs[p])
  }
  const cut = Math.max(0.5, Math.min(0.75, vmax - 0.15))
  return Uint8Array.from(vs, (v) => (v >= cut ? 1 : 0))
}

/** Lights are only painted: the light pixels become the emissive map, the rest black. */
export function extractEmissive(rgba, glow) {
  const mask = lightMask(rgba, glow)
  const out = new Uint8Array(rgba.length)
  let lit = 0
  for (let p = 0; p < mask.length; p++) {
    const i = p * 4
    if (mask[p]) { out.set(rgba.subarray(i, i + 3), i); lit++ }
    out[i + 3] = 255
  }
  return { rgba: out, lit }
}

/** Lit pixels spread `radius` pixels into the black around them, so a light of a few pixels survives shrinking. */
export function growLights(rgba, width, height, radius) {
  let src = rgba
  for (let r = 0; r < radius; r++) {
    const out = Uint8Array.from(src)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        if (src[i] || src[i + 1] || src[i + 2]) continue
        let best = -1, sum = 0
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue
          const j = (yy * width + xx) * 4, t = src[j] + src[j + 1] + src[j + 2]
          if (t > sum) { sum = t; best = j }
        }
        if (best >= 0) out.set(src.subarray(best, best + 3), i)
      }
    }
    src = out
  }
  return src
}

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

/**
 * A repaint without a new model: the s1 design's gray paint mapped onto the livery by brightness
 * (dark → panel → hull), its painted lights (found by the base design's `baseGlow`) turned to the new
 * glow. RGBA in; out the new RGBA and `lights`, the emissive map: those lights alone (paint near the
 * glow hue must not glow).
 */
export function recolorLivery(rgba, colors, glow, baseGlow) {
  const [hull, panel, dark] = [colors.hull, colors.panel, colors.dark].map(hexRgb)
  const glowRgb = hexRgb(glow), glowV = hexToHsv(glow).v
  const n = rgba.length / 4
  const lum = new Float32Array(n), light = lightMask(rgba, baseGlow)
  const paint = []
  for (let p = 0; p < n; p++) {
    const i = p * 4
    lum[p] = (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]) / 255
    // The black of the unused atlas is not paint
    if (!light[p] && lum[p] > 0.03) paint.push(lum[p])
  }
  paint.sort((a, b) => a - b)
  const q = (f) => paint.length ? paint[Math.floor(f * (paint.length - 1))] : 0.5
  const lo = q(0.05), mid = Math.max(q(0.4), lo + 1e-3), hi = Math.max(q(0.95), mid + 1e-3)
  const mix = (a, b, t) => a.map((x, k) => x + (b[k] - x) * t)
  const out = new Uint8Array(rgba.length), lights = new Uint8Array(rgba.length)
  let lit = 0
  for (let p = 0; p < n; p++) {
    const L = lum[p], i = p * 4
    const v = rgbToHsv(rgba[i], rgba[i + 1], rgba[i + 2]).v
    const c = light[p] ? glowRgb.map((x) => x * Math.min(1, v / glowV))
      : L <= lo ? dark.map((x) => x * (L / lo))
      : L < mid ? mix(dark, panel, (L - lo) / (mid - lo))
      : L < hi ? mix(panel, hull, (L - mid) / (hi - mid))
      : hull
    for (let k = 0; k < 3; k++) out[i + k] = Math.max(0, Math.min(255, Math.round(c[k])))
    out[i + 3] = rgba[i + 3]
    if (light[p]) { lights.set(out.subarray(i, i + 3), i); lit++ }
    lights[i + 3] = 255
  }
  return { rgba: out, lights, lit }
}

/** Pixels a light spreads so it still covers about one pixel once the texture is `px` wide. */
const growFor = (width, px) => Math.max(0, Math.ceil(width / px / 2))

async function recolor(doc, colors, glow, baseGlow, px) {
  for (const mat of doc.getRoot().listMaterials()) {
    const base = mat.getBaseColorTexture()
    if (!base) continue
    const { data, info } = await sharp(Buffer.from(base.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const { rgba, lights, lit } = recolorLivery(data, colors, glow, baseGlow)
    const png = (px) => sharp(Buffer.from(px), { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()
    base.setImage(new Uint8Array(await png(rgba))).setMimeType('image/png')
    if (!lit) continue
    const grown = growLights(lights, info.width, info.height, growFor(info.width, px))
    const tex = doc.createTexture(`${base.getName() || 'base'}-glow`).setImage(new Uint8Array(await png(grown))).setMimeType('image/png')
    mat.setEmissiveTexture(tex).setEmissiveFactor([1, 1, 1])
  }
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

async function addEmissive(doc, glow, px) {
  for (const mat of doc.getRoot().listMaterials()) {
    const base = mat.getBaseColorTexture()
    if (!base) continue
    const { data, info } = await sharp(Buffer.from(base.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const { rgba, lit } = extractEmissive(data, glow)
    if (!lit) continue
    const grown = growLights(rgba, info.width, info.height, growFor(info.width, px))
    const png = await sharp(Buffer.from(grown), { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()
    const tex = doc.createTexture(`${base.getName() || 'base'}-glow`).setImage(new Uint8Array(png)).setMimeType('image/png')
    mat.setEmissiveTexture(tex).setEmissiveFactor([1, 1, 1])
  }
}

/**
 * Last resort when UV seams stop simplify short of the budget (a texture atlas cut into many small
 * islands): collapse across the seams too. Texture coordinates bend a little along the seams that go.
 */
function simplifyAcrossSeams(doc, budget) {
  const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).filter((p) => p.getIndices())
  const ratio = budget.tris / countTris(doc)
  for (const p of prims) {
    const indices = new Uint32Array(p.getIndices().getArray())
    const positions = new Float32Array(p.getAttribute('POSITION').getArray())
    const target = Math.floor((indices.length / 3) * ratio) * 3
    const [kept] = MeshoptSimplifier.simplify(indices, positions, 3, target, 1, ['Permissive', 'Prune'])
    p.getIndices().setArray(new Uint32Array(kept))
  }
}

/** The raw model simplified to `tris`, with normals, the glow map and the recolor done; textures still full size. */
async function prepare(io, rawPath, asset, tris, px, baseGlow) {
  const doc = await io.read(rawPath)
  doc.setLogger(new Logger(Logger.Verbosity.WARN))
  // Hunyuan labels its JPEG base color image/png; resizing then fails ("width 0")
  for (const t of doc.getRoot().listTextures()) {
    const real = realMime(t.getImage())
    if (real && real !== t.getMimeType()) t.setMimeType(real)
  }
  await doc.transform(weld())
  if (countTris(doc) > tris) {
    for (const error of [0.01, 0.05]) {
      await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, tris / countTris(doc)), error }))
      if (countTris(doc) <= tris) break
    }
    if (countTris(doc) > tris) {
      simplifyAcrossSeams(doc, { tris })
      await doc.transform(weld())
    }
  }
  bakeNormals(doc, asset.turn ?? 0)
  await doc.transform(weld())
  if (asset.colors) await recolor(doc, asset.colors, asset.glow, baseGlow ?? asset.glow, px)
  else if (asset.glow) await addEmissive(doc, asset.glow, px)
  await doc.transform(dedup(), prune())
  return doc
}

/**
 * Shares of the triangle budget tried in turn when even the lowest texture quality leaves the GLB over its
 * size budget (ZPS 3D meshes have many seams, so their vertices, not their textures, fill a large budget).
 */
const TRI_SHARES = [1, 0.85, 0.7, 0.55]

/** `baseGlow`: for a recolored repaint, the glow of its base design (what its lights look like in `rawPath`). */
export async function buildAsset(rawPath, outPath, asset, budget, { baseGlow } = {}) {
  const io = await artIO()
  await MeshoptSimplifier.ready
  let out, bytes
  search: for (const share of TRI_SHARES) {
    const doc = await prepare(io, rawPath, asset, Math.floor(budget.tris * share), budget.px, baseGlow)
    for (const { quality, nearLossless } of ENCODINGS) {
      out = cloneDocument(doc)
      await out.transform(
        // Metal and roughness change slowly across the surface: half size is enough and keeps small assets in budget
        textureCompress({ encoder: sharp, targetFormat: 'webp', quality, slots: /^metallicRoughness/, resize: [budget.px / 2, budget.px / 2] }),
        // Lossy webp halves the color resolution, which grays out lights of a pixel or two on black;
        // near-lossless keeps their color and stays small on a map that is nearly all black
        textureCompress({ encoder: sharp, targetFormat: 'webp', quality, nearLossless, slots: /^emissive/, resize: [budget.px, budget.px] }),
        textureCompress({ encoder: sharp, targetFormat: 'webp', quality, slots: /^(?!metallicRoughness|emissive)/, resize: [budget.px, budget.px] }),
        meshopt({ encoder: MeshoptEncoder, level: 'high' }),
      )
      bytes = await io.writeBinary(out)
      if (bytes.length <= budget.kb * 1024) break search
    }
  }
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, bytes)
  return { tris: countTris(out), bytes: statSync(outPath).size }
}
