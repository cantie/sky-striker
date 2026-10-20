// Every AI art asset: what to draw, how big it may be, and which batch it belongs to.
// Hand-written; the tools in scripts/art read it and never rewrite it. An asset is approved when
// art/concepts/<id>.webp exists.
//
// Row: { id, kind: player|enemy|boss|hull|base|gun, batch: 1..5, budget, glow: '#rrggbb',
//   prompt (a design) | base + livery (a repaint of an approved design),
//   seed?, size? (game size), stage? (1..10), old? (the model it replaces), turn? (0 | 180) }

/** Shared style block of every concept prompt (spec, Section 2). */
export const STYLE = 'Semi-realistic 3D render in the style of Sky Force Reloaded: painted PBR metal with crisp panel lines. ' +
  'Bold, readable shapes; no thin antennas, hanging missiles or pilots. ' +
  'Front three-quarter view from about 45 degrees above, the whole craft centered in the frame with margin. ' +
  'Plain flat #808080 background, soft even light.'

export const BUDGETS = {
  small: { tris: 2000, px: 256, kb: 80 },
  medium: { tris: 4000, px: 512, kb: 160 },
  large: { tris: 8000, px: 512, kb: 220 },
}

export const ASSETS = []
