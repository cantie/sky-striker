// Steps concept, approve and model. The pure parts (prompts, what is left to do, the review page) are
// exported for tests; the run* functions do the I/O.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, relative } from 'node:path'
import sharp from 'sharp'
import { BUDGETS, STYLE } from '../../art/manifest.mjs'
import { runBatch, withRetry } from './batch.mjs'
import { buildAsset } from './build.mjs'
import { checkGlb } from './checks.mjs'
import { createHy3dClient, createImageClient } from './clients.mjs'
import { requireKeys } from './env.mjs'
import { artPaths } from './paths.mjs'

const glowLine = (a) => `Glow color ${a.glow} only on lights and exhausts.`

export function conceptPrompt(asset) {
  if (asset.base !== undefined) {
    return 'Repaint this exact aircraft. Keep its shape, angle, framing and the plain #808080 background. ' +
      `New livery: ${asset.livery}. ${glowLine(asset)}`
  }
  return `${asset.prompt}\n\n${STYLE} ${glowLine(asset)}`
}

/** Concepts still to draw; a repaint waits until its base design is approved. */
export function planConcept(assets, exists, force, paths = artPaths()) {
  const todo = [], blocked = []
  for (const a of assets) {
    if (!force && exists(paths.concept(a.id))) continue
    if (a.base !== undefined && !exists(paths.concept(a.base))) blocked.push({ id: a.id, reason: `base ${a.base} not approved` })
    else todo.push(a)
  }
  return { todo, blocked }
}

/** Approved concepts that have no raw model yet (or all approved ones with force). */
export function planModel(assets, exists, force, paths = artPaths()) {
  const todo = [], blocked = []
  for (const a of assets) {
    if (!exists(paths.concept(a.id))) blocked.push({ id: a.id, reason: 'not approved' })
    else if (force || !exists(paths.raw(a.id))) todo.push(a)
  }
  return { todo, blocked }
}

const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A grid of drafts: one row per asset with its id and prompt, one numbered image per draft. */
export function reviewPage(batch, rows) {
  const body = rows.map(({ asset, drafts }) => `
<section>
  <h2>${escape(asset.id)} <small>${escape(asset.kind)}${asset.base ? ` · repaint of ${escape(asset.base)}` : ''}</small></h2>
  <p>${escape(conceptPrompt(asset))}</p>
  <div class="row">${drafts.map((src, i) => `<figure><img src="${escape(src)}" alt=""><figcaption>#${i + 1}</figcaption></figure>`).join('')}</div>
</section>`).join('\n')
  return `<!doctype html><html><head><meta charset="utf-8"><title>Batch ${batch} concepts</title>
<style>body{font:14px sans-serif;background:#222;color:#eee;margin:16px}section{margin-bottom:28px}
p{max-width:900px;color:#bbb}.row{display:flex;gap:12px;flex-wrap:wrap}figure{margin:0;text-align:center}
img{width:320px;height:320px;object-fit:contain;background:#808080}small{color:#999;font-weight:normal}</style></head>
<body><h1>Batch ${batch}: concepts</h1>${body}
</body></html>
`
}

const write = (path, bytes) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes) }
const toPng = (path) => sharp(path).png().toBuffer()

/**
 * The concept's flat #808080 backdrop → transparent, filled in from the border so gray paint on the
 * craft stays. Without it Hunyuan3D can model the backdrop as a slab under the craft.
 */
export function cutBackground(rgba, width, height, tolerance = 14) {
  const backdrop = (p) => [0, 1, 2].every((c) => Math.abs(rgba[p * 4 + c] - 128) <= tolerance)
  const seen = new Uint8Array(width * height)
  const stack = []
  for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x)
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1)
  while (stack.length) {
    const p = stack.pop()
    if (seen[p] || !backdrop(p)) continue
    seen[p] = 1
    rgba[p * 4 + 3] = 0
    const x = p % width
    if (x > 0) stack.push(p - 1)
    if (x < width - 1) stack.push(p + 1)
    if (p >= width) stack.push(p - width)
    if (p < (height - 1) * width) stack.push(p + width)
  }
  return rgba
}

async function cutoutPng(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  cutBackground(data, info.width, info.height)
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()
}

export async function runConcept(assets, { env, force = false, n, paths = artPaths(), log = console.log }) {
  requireKeys(env, ['IMAGE_API', 'IMAGE_KEY', 'IMAGE_MODEL'])
  const image = createImageClient({ api: env.IMAGE_API, key: env.IMAGE_KEY, model: env.IMAGE_MODEL })
  const { todo, blocked } = planConcept(assets, existsSync, force, paths)
  const drafts = new Map()
  const res = await runBatch(todo, async (a) => {
    const count = n ?? (a.base === undefined ? 3 : 1)
    const prompt = conceptPrompt(a)
    const base = a.base === undefined ? null : await toPng(paths.concept(a.base))
    const list = []
    for (let k = 1; k <= count; k++) {
      const t0 = Date.now()
      write(paths.draft(a.id, k), base ? await image.edit(base, prompt) : await image.generate(prompt))
      log(`${a.id} #${k}: ${((Date.now() - t0) / 1000).toFixed(0)} s`)
      list.push(paths.draft(a.id, k))
    }
    drafts.set(a.id, list)
  }, { concurrency: 3 })
  if (todo.length) {
    const batch = todo[0].batch
    const page = paths.review(batch)
    const rows = todo.filter((a) => drafts.has(a.id))
      .map((asset) => ({ asset, drafts: drafts.get(asset.id).map((p) => relative(dirname(page), p).replace(/\\/g, '/')) }))
    write(page, reviewPage(batch, rows))
    log(`review page: ${page}`)
  }
  return { ...res, blocked }
}

/** Keep draft k as the approved concept, at 512 px (Hunyuan3D shrinks its input to 512 anyway). */
export async function runApprove(id, k, { paths = artPaths(), log = console.log } = {}) {
  const src = paths.draft(id, k)
  if (!existsSync(src)) throw new Error(`No draft ${src}`)
  mkdirSync(dirname(paths.concept(id)), { recursive: true })
  await sharp(src).resize(512, 512, { fit: 'contain', background: '#808080' }).webp({ quality: 90 }).toFile(paths.concept(id))
  log(`approved ${id} #${k} → ${paths.concept(id)}`)
}

export async function runModel(assets, { env, force = false, paths = artPaths(), log = console.log }) {
  requireKeys(env, ['HY3D_API', 'HY3D_KEY'])
  const hy3d = createHy3dClient({ api: env.HY3D_API, key: env.HY3D_KEY })
  const { todo, blocked } = planModel(assets, existsSync, force, paths)
  const res = await runBatch(todo, async (a) => {
    const t0 = Date.now()
    const png = await cutoutPng(paths.concept(a.id))
    write(paths.raw(a.id), await withRetry((seed) => hy3d.generate(png, seed), a.seed ?? 42))
    log(`${a.id}: model in ${((Date.now() - t0) / 1000).toFixed(0)} s`)
  }, { concurrency: 2 })
  return { ...res, blocked }
}

/** Raw GLBs → public/models/ai; an asset over budget or failing a check fails. */
export async function runBuild(assets, { paths = artPaths(), log = console.log } = {}) {
  const blocked = assets.filter((a) => !existsSync(paths.raw(a.id))).map((a) => ({ id: a.id, reason: 'no raw model (run model first)' }))
  const todo = assets.filter((a) => existsSync(paths.raw(a.id)))
  const res = await runBatch(todo, async (a) => {
    const budget = BUDGETS[a.budget]
    const { tris, bytes } = await buildAsset(paths.raw(a.id), paths.out(a.id), a, budget)
    log(`${a.id}: ${tris} tris, ${Math.round(bytes / 1024)} KB (budget ${budget.tris}, ${budget.kb} KB)`)
    const problems = await checkGlb(paths.out(a.id), a, budget)
    if (problems.length) throw new Error(problems.join('; '))
  }, { concurrency: 2 })
  return { ...res, blocked }
}
