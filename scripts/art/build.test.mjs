import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { BUDGETS } from '../../art/manifest.mjs'
import { buildAsset, extractEmissive, realMime } from './build.mjs'
import { checkGlb, readGlb } from './checks.mjs'
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

  it('the raw fixture is a Hunyuan-like file: JPEG bytes labeled PNG, no normals', async () => {
    const doc = await readGlb(file('raw-look.glb', await fixtureGlb()))
    const tex = doc.getRoot().listTextures()[0]
    expect(tex.getMimeType()).toBe('image/png')
    expect(realMime(tex.getImage())).toBe('image/jpeg')
    expect(doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('NORMAL')).toBe(null)
    expect(readFileSync(join(dir, 'raw-look.glb')).length).toBeGreaterThan(0)
  })
})
