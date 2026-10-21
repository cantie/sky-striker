// Checks on art/manifest.mjs, and picking the assets a command works on.

export const KINDS = ['player', 'enemy', 'boss', 'hull', 'base', 'gun']

/** HSV of '#rrggbb' (h in degrees, s and v 0..1), or null for anything else. */
export function hexToHsv(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? '')
  if (!m) return null
  return rgbToHsv(parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16))
}

export function rgbToHsv(r, g, b) {
  const R = r / 255, G = g / 255, B = b / 255
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min
  let h = 0
  if (d > 0) {
    if (max === R) h = 60 * (((G - B) / d) % 6)
    else if (max === G) h = 60 * ((B - R) / d + 2)
    else h = 60 * ((R - G) / d + 4)
  }
  return { h: (h + 360) % 360, s: max === 0 ? 0 : d / max, v: max }
}

const isInt = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi

/** One line per problem, each naming the asset id; empty when the manifest is valid. */
export function validateManifest(assets, budgets) {
  const errors = []
  const byId = new Map()
  for (const a of assets) {
    if (byId.has(a.id)) errors.push(`${a.id}: duplicate id`)
    byId.set(a.id, a)
  }
  for (const a of assets) {
    const bad = (why) => errors.push(`${a.id}: ${why}`)
    if (typeof a.id !== 'string' || !/^[a-z0-9-]+$/.test(a.id)) bad('id must be lowercase letters, digits and dashes')
    if (!KINDS.includes(a.kind)) bad(`unknown kind ${a.kind}`)
    if (!(a.budget in budgets)) bad(`unknown budget ${a.budget}`)
    if (!isInt(a.batch, 1, 5)) bad('batch must be 1..5')
    if (a.stage !== undefined && !isInt(a.stage, 1, 10)) bad('stage must be 1..10')
    if (a.turn !== undefined && a.turn !== 0 && a.turn !== 180) bad('turn must be 0 or 180')
    if (a.seed !== undefined && !Number.isInteger(a.seed)) bad('seed must be an integer')
    if (a.tall !== undefined && a.tall !== true) bad('tall must be true or absent')
    const hsv = hexToHsv(a.glow)
    if (!hsv) bad('glow must be #rrggbb')
    else if (hsv.s < 0.4 || hsv.v < 0.5) bad(`glow ${a.glow} is too gray or dark to pick out lights`)
    const hasPrompt = typeof a.prompt === 'string' && a.prompt.trim() !== ''
    if (hasPrompt === (a.base !== undefined)) bad('needs exactly one of prompt (a design) and base (a repaint)')
    if (a.base !== undefined) {
      const b = byId.get(a.base)
      if (!b) bad(`base ${a.base} does not exist`)
      else if (b.kind !== a.kind) bad(`base ${a.base} is a ${b.kind}, not a ${a.kind}`)
      else if (b.base !== undefined) bad(`base ${a.base} is itself a repaint`)
      if (typeof a.livery !== 'string' || a.livery.trim() === '') bad('a repaint needs a livery')
    }
    if (a.colors !== undefined) {
      if (!['hull', 'panel', 'dark'].every((k) => hexToHsv(a.colors?.[k]))) bad('colors needs hull, panel and dark as #rrggbb')
    }
  }
  return errors
}

/** `selector` is a batch number ("3") or comma-separated ids, kept in the given order. */
export function selectAssets(assets, selector) {
  const s = String(selector).trim()
  if (/^\d+$/.test(s)) return assets.filter((a) => a.batch === Number(s))
  return s.split(',').map((id) => id.trim()).filter(Boolean).map((id) => {
    const a = assets.find((x) => x.id === id)
    if (!a) throw new Error(`No asset ${id} in art/manifest.mjs`)
    return a
  })
}
