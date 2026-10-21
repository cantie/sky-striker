import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { BUDGETS } from '../../art/manifest.mjs'
import { buildAsset, extractEmissive, realMime, recolorLivery } from './build.mjs'
import { artIO, checkGlb, readGlb } from './checks.mjs'
import { fixtureGlb } from './fixture.mjs'

const dir = mkdtempSync(join(tmpdir(), 'art-build-'))
const file = (name, bytes) => { const p = join(dir, name); writeFileSync(p, bytes); return p }
const asset = { id: 't', kind: 'enemy', batch: 1, budget: 'small', glow: '#3fd4ff', prompt: 'x' }
const zBounds = async (path) => {
  const { getBounds } = await import('@gltf-transform/core')
  const doc = await readGlb(path)
  const b = getBounds(doc.getRoot().listScenes()[0])
  return [b.min[2], b.max[2]]
}

describe('realMime', () => {
  it('reads the format from the magic bytes', () => {
    expect(realMime(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(realMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe('image/png')
    expect(realMime(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp')
    expect(realMime(Uint8Array.from([1, 2, 3, 4]))).toBe(null)
  })
})

describe('extractEmissive', () => {
  const pixels = (...rgb) => Uint8Array.from(rgb.flatMap(([r, g, b]) => [r, g, b, 255]))

  it('keeps bright pixels near the glow hue and blacks out the rest', () => {
    const { rgba, lit } = extractEmissive(pixels([63, 212, 255], [128, 128, 128], [20, 60, 80], [255, 140, 0]), '#3fd4ff')
    expect([...rgba]).toEqual([63, 212, 255, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255])
    expect(lit).toBe(1)
  })

  it('finds dim lights when no texel is bright (ZPS 3D paints some lights dark)', () => {
    const { lit } = extractEmissive(pixels([180, 70, 40], [90, 100, 60], [128, 128, 128]), '#ff5a2a')
    expect(lit).toBe(1)
  })

  it('with bright lights present, dimmer paint in the glow hue stays dark', () => {
    const { rgba, lit } = extractEmissive(pixels([255, 90, 42], [150, 55, 25]), '#ff5a2a')
    expect(lit).toBe(1)
    expect([...rgba.slice(4, 7)]).toEqual([0, 0, 0])
  })
})

describe('recolorLivery', () => {
  const colors = { hull: '#ffd21a', panel: '#2a2a2a', dark: '#0a0a0a' }
  const gray = (v) => [v, v, v]
  const px = (...rgb) => Uint8Array.from(rgb.flatMap(([r, g, b]) => [r, g, b, 255]))
  const at = (rgba, i) => [...rgba.slice(i * 4, i * 4 + 3)]

  it('maps the gray paint from light to dark onto hull, panel and dark', () => {
    // A ramp of grays as the s1 paint has, plus the black of the unused atlas
    const ramp = [0, 30, 60, 90, 120, 150, 180, 210, 230].map(gray)
    const { rgba: out } = recolorLivery(px(...ramp), colors, '#ff3a5a', '#3fd4ff')
    expect(at(out, 0)).toEqual([0, 0, 0])
    expect(at(out, 1)).toEqual([10, 10, 10])
    expect(at(out, 8)).toEqual([255, 210, 26])
    expect(at(out, 4)[0]).toBeGreaterThan(at(out, 2)[0])
    expect(out[3]).toBe(255)
  })

  it('painted lights keep their brightness and take the new glow hue', () => {
    const { rgba: out, lights } = recolorLivery(px([63, 212, 255], ...[40, 120, 220].map(gray)), colors, '#ff3a5a', '#3fd4ff')
    const [r, g, b] = at(out, 0)
    expect(r).toBeGreaterThan(200)
    expect(g).toBeLessThan(80)
    expect(b).toBeLessThan(100)
    expect(at(lights, 0)).toEqual([r, g, b])
    expect(at(lights, 3)).toEqual([0, 0, 0])
  })

  it("lights are found by the base design's glow, dim ones too; bright paint of another hue is paint", () => {
    // An olive base with dim orange lights, as base-s1 came back from ZPS 3D
    const { lights, lit } = recolorLivery(px([180, 70, 40], [40, 200, 60], ...[40, 120, 220].map(gray)), colors, '#ff3a5a', '#ff5a2a')
    expect(lit).toBe(1)
    expect(at(lights, 0)[0]).toBeGreaterThan(150)
    expect(at(lights, 1)).toEqual([0, 0, 0])
  })
})

describe('buildAsset', () => {
  let built
  beforeAll(async () => {
    const raw = file('raw.glb', await fixtureGlb())
    built = join(dir, 'built.glb')
    built = { path: built, stats: await buildAsset(raw, built, asset, BUDGETS.small) }
  }, 60_000)

  it('turns a raw Hunyuan-like GLB into a game asset', async () => {
    expect(await checkGlb(built.path, asset, BUDGETS.small)).toEqual([])
    expect(built.stats.tris).toBeLessThanOrEqual(2000)
    expect(built.stats.bytes).toBeLessThanOrEqual(80 * 1024)
    expect(built.stats.bytes).toBe(statSync(built.path).size)
  })

  it('reaches the triangle budget even when UV seams cut the mesh into small pieces', async () => {
    const raw = file('raw-charts.glb', await fixtureGlb({ charts: true }))
    const out = join(dir, 'charts.glb')
    const { tris } = await buildAsset(raw, out, asset, BUDGETS.small)
    expect(tris).toBeLessThanOrEqual(2000)
    expect(await checkGlb(out, asset, BUDGETS.small)).toEqual([])
  }, 60_000)

  it('the metallic-roughness map is kept at half the base color size', async () => {
    const raw = file('raw-mr.glb', await fixtureGlb({ mr: true }))
    const out = join(dir, 'mr.glb')
    await buildAsset(raw, out, asset, { ...BUDGETS.small, px: 64 })
    const mat = (await readGlb(out)).getRoot().listMaterials()[0]
    expect(mat.getBaseColorTexture().getSize()).toEqual([64, 64])
    expect(mat.getMetallicRoughnessTexture().getSize()).toEqual([32, 32])
  }, 60_000)

  it('lowers the texture quality until a busy texture fits the size budget, keeping its size', async () => {
    const raw = file('raw-busy.glb', await fixtureGlb({ tris: 500, busy: true }))
    const roomy = { ...BUDGETS.small, px: 256, kb: 10_000 }
    const full = await buildAsset(raw, join(dir, 'busy-full.glb'), asset, roomy)
    const tight = { ...roomy, kb: Math.floor((full.bytes * 0.85) / 1024) }
    const out = join(dir, 'busy-tight.glb')
    const res = await buildAsset(raw, out, asset, tight)
    expect(res.bytes).toBeLessThanOrEqual(tight.kb * 1024)
    expect(res.bytes).toBe(statSync(out).size)
    const mat = (await readGlb(out)).getRoot().listMaterials()[0]
    expect(mat.getBaseColorTexture().getSize()).toEqual([256, 256])
  }, 60_000)

  it('colors: the base color is recolored and the lights glow in the new color', async () => {
    const raw = file('raw-recolor.glb', await fixtureGlb({ busy: true, tris: 500 }))
    const red = { ...asset, glow: '#ff3a5a', colors: { hull: '#ffd21a', panel: '#2a2a2a', dark: '#0a0a0a' } }
    const out = join(dir, 'recolor.glb')
    await buildAsset(raw, out, red, BUDGETS.small, { baseGlow: '#3fd4ff' })
    expect(await checkGlb(out, red, BUDGETS.small)).toEqual([])
    const mat = (await readGlb(out)).getRoot().listMaterials()[0]
    const sharp = (await import('sharp')).default
    const { data } = await sharp(Buffer.from(mat.getBaseColorTexture().getImage())).raw().toBuffer({ resolveWithObject: true })
    // The gray noise averages out gray; mapped onto yellow and dark gray it averages out a dull yellow
    const mean = [0, 1, 2].map((k) => { let t = 0; for (let i = k; i < data.length; i += 3) t += data[i]; return t / (data.length / 3) })
    expect(mean[2]).toBeLessThan(mean[1] * 0.6)
    expect(mean[0]).toBeGreaterThan(mean[2] * 1.5)
  }, 60_000)

  it('colors: paint in the glow color does not glow, only the lights do', async () => {
    const raw = file('raw-same-hue.glb', await fixtureGlb({ busy: true, tris: 500 }))
    const yellow = { ...asset, glow: '#ffe04a', colors: { hull: '#ffd21a', panel: '#2a2a2a', dark: '#0a0a0a' } }
    const out = join(dir, 'same-hue.glb')
    await buildAsset(raw, out, yellow, BUDGETS.small, { baseGlow: '#3fd4ff' })
    const mat = (await readGlb(out)).getRoot().listMaterials()[0]
    const sharp = (await import('sharp')).default
    const { data, info } = await sharp(Buffer.from(mat.getEmissiveTexture().getImage())).raw().toBuffer({ resolveWithObject: true })
    let lit = 0
    for (let i = 0; i < data.length; i += info.channels) if (data[i] + data[i + 1] + data[i + 2] > 150) lit++
    // The fixture's glow stripe is 1/8 of the texture; the yellow hull is far more
    expect(lit / (info.width * info.height)).toBeLessThan(0.2)
    expect(lit).toBeGreaterThan(0)
  }, 60_000)

  it('a light of a few texels still glows after the texture shrinks to the budget', async () => {
    const raw = file('raw-dot.glb', await fixtureGlb({ tris: 500, dot: true }))
    const out = join(dir, 'dot.glb')
    await buildAsset(raw, out, asset, BUDGETS.small)
    expect(await checkGlb(out, asset, BUDGETS.small)).toEqual([])
  }, 60_000)

  it('the glow map is near-lossless, or lossy when a large glow area would not fit the budget', async () => {
    const raw = file('raw-noisy-glow.glb', await fixtureGlb({ tris: 500, busy: true, noisyGlow: true }))
    const glowFormat = async (path) => {
      const img = (await readGlb(path)).getRoot().listMaterials()[0].getEmissiveTexture().getImage()
      return String.fromCharCode(...img.slice(12, 16)) // 'VP8L' lossless, 'VP8 ' lossy
    }
    const roomy = { ...BUDGETS.small, px: 256, kb: 10_000 }
    const full = await buildAsset(raw, join(dir, 'glow-roomy.glb'), asset, roomy)
    expect(await glowFormat(join(dir, 'glow-roomy.glb'))).toBe('VP8L')
    const tight = { ...roomy, kb: Math.floor(full.bytes / 1024) - 1 }
    const res = await buildAsset(raw, join(dir, 'glow-tight.glb'), asset, tight)
    expect(res.bytes).toBeLessThanOrEqual(tight.kb * 1024)
    expect(await glowFormat(join(dir, 'glow-tight.glb'))).toBe('VP8 ')
  }, 60_000)

  it('when even the lowest texture quality is too big, fewer triangles make it fit', async () => {
    const raw = file('raw-heavy-mesh.glb', await fixtureGlb({ tris: 6000, charts: true }))
    const roomy = { tris: 4000, px: 64, kb: 10_000 }
    const full = await buildAsset(raw, join(dir, 'mesh-roomy.glb'), asset, roomy)
    const tight = { ...roomy, kb: Math.floor((full.bytes * 0.8) / 1024) }
    const out = join(dir, 'mesh-tight.glb')
    const res = await buildAsset(raw, out, asset, tight)
    expect(res.bytes).toBeLessThanOrEqual(tight.kb * 1024)
    expect(res.tris).toBeLessThan(full.tris)
    expect(await checkGlb(out, asset, tight)).toEqual([])
  }, 120_000)

  it('yaw and roll fine-tune a model by hand, in degrees', async () => {
    const raw = file('raw-trim.glb', await fixtureGlb())
    const yawed = join(dir, 'yawed.glb'), rolled = join(dir, 'rolled.glb')
    await buildAsset(raw, yawed, { ...asset, yaw: 30 }, BUDGETS.small)
    await buildAsset(raw, rolled, { ...asset, roll: 30 }, BUDGETS.small)
    // The 2-long nose swings off +Z; on its side the 0.5-thin craft gets taller
    expect((await zBounds(yawed))[1]).toBeCloseTo(1.8, 1)
    const { getBounds } = await import('@gltf-transform/core')
    const b = getBounds((await readGlb(rolled)).getRoot().listScenes()[0])
    expect(b.max[1] - b.min[1]).toBeGreaterThan(0.9)
  }, 60_000)

  it('turn: 180 rotates the model about Y', async () => {
    const raw = file('raw-turn.glb', await fixtureGlb())
    const out = join(dir, 'turned.glb')
    await buildAsset(raw, out, { ...asset, turn: 180 }, BUDGETS.small)
    const [min0, max0] = await zBounds(built.path)
    const [min1, max1] = await zBounds(out)
    expect(max0).toBeGreaterThan(-min0 * 1.5) // the fixture's nose is on +Z
    expect(min1).toBeCloseTo(-max0, 1)
    expect(max1).toBeCloseTo(-min0, 1)
  })

  it('checkGlb reports each problem', async () => {
    const raw = file('raw-check.glb', await fixtureGlb())
    const problems = (await checkGlb(raw, asset, BUDGETS.small)).join('\n')
    expect(problems).toMatch(/normal/i)
    expect(problems).toMatch(/webp/i)
    expect(problems).toMatch(/meshopt/i)
    expect(problems).toMatch(/2000/)
    expect((await checkGlb(built.path, { ...asset, glow: '#ff3b2f' }, BUDGETS.small)).join('\n')).toMatch(/glow/i)
  })

  it('tall: a craft checked by eye as taller than wide skips only the flat check', async () => {
    const raw = file('raw-tall.glb', await fixtureGlb({ tris: 500 }))
    const out = join(dir, 'tall.glb')
    await buildAsset(raw, out, asset, BUDGETS.small)
    const doc = await readGlb(out)
    // Stand it on its side: the 0.5 thin axis becomes its width
    doc.getRoot().listNodes().forEach((n) => n.getMesh() && n.setRotation([0, 0, Math.SQRT1_2, Math.SQRT1_2]))
    const side = join(dir, 'tall-side.glb')
    await (await artIO()).write(side, doc)
    expect(await checkGlb(side, asset, BUDGETS.small)).toContainEqual(expect.stringMatching(/does not lie flat/))
    expect((await checkGlb(side, { ...asset, tall: true }, BUDGETS.small)).filter((p) => /flat/.test(p))).toEqual([])
  }, 60_000)

  it('the raw fixture is a Hunyuan-like file: JPEG bytes labeled PNG, no normals', async () => {
    const doc = await readGlb(file('raw-look.glb', await fixtureGlb()))
    const tex = doc.getRoot().listTextures()[0]
    expect(tex.getMimeType()).toBe('image/png')
    expect(realMime(tex.getImage())).toBe('image/jpeg')
    expect(doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('NORMAL')).toBe(null)
    expect(readFileSync(join(dir, 'raw-look.glb')).length).toBeGreaterThan(0)
  })
})
