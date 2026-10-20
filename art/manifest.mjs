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

const K = '/models/kenney-space/'

export const ASSETS = [
  // Batch 1: the style batch (Hawk, the four enemy designs, one tank). Settles the look before the rest.
  {
    id: 'hawk', kind: 'player', batch: 1, budget: 'medium', glow: '#3fd4ff', size: 2, stage: 1, old: `${K}craft_speederD.glb`,
    prompt: 'A reliable all-round jet fighter for the hero pilot: balanced swept wings, twin engines side by side at the tail, ' +
      'a short bubble canopy faired into the body. Livery: clean white hull with bold royal-blue panels and dark navy trim.',
  },
  {
    id: 'enemy-basic-s1', kind: 'enemy', batch: 1, budget: 'small', glow: '#ff6a3d', size: 1.45, stage: 1, old: `${K}craft_speederA.glb`,
    prompt: 'A small mass-produced enemy fighter: blunt arrowhead body, short forward-swept wings, one engine at the tail, ' +
      'angular and aggressive. Neutral livery: plain light gunmetal gray with darker gray panels.',
  },
  {
    id: 'enemy-fast-s1', kind: 'enemy', batch: 1, budget: 'small', glow: '#ffcf4a', size: 1.5, stage: 1, old: `${K}craft_racer.glb`,
    prompt: 'A fast enemy interceptor: long narrow needle nose, thin delta wings swept far back, one big engine at the tail, ' +
      'sharp and angular. Neutral livery: plain light gunmetal gray with darker gray panels.',
  },
  {
    id: 'enemy-heavy-s1', kind: 'enemy', batch: 1, budget: 'small', glow: '#c46bff', size: 1.85, stage: 1, old: `${K}craft_cargoA.glb`,
    prompt: 'A heavy enemy gunship: wide armored box body, thick stubby wings with two gun pods, two engines side by side at the tail, ' +
      'brutal and angular. Neutral livery: plain light gunmetal gray with darker gray panels.',
  },
  {
    id: 'enemy-shooter-s1', kind: 'enemy', batch: 1, budget: 'small', glow: '#ff3f7a', size: 1.35, stage: 1, old: `${K}craft_speederB.glb`,
    prompt: 'An enemy strike fighter built around its guns: twin cannon barrels along the nose, wide angular wings, ' +
      'two engines side by side at the tail. Neutral livery: plain light gunmetal gray with darker gray panels.',
  },
  {
    id: 'hull-s1', kind: 'hull', batch: 1, budget: 'small', glow: '#ff5a2a', size: 1.3, stage: 1,
    prompt: 'A compact military tank hull seen without its turret: low sloped armor, two wide tracks, a round empty turret ring on top, ' +
      'small headlights at the front. Livery: jungle olive green with darker olive panels.',
  },
  {
    id: 'gun-tank', kind: 'gun', batch: 1, budget: 'small', glow: '#ff5a2a', size: 0.8, stage: 1,
    prompt: 'A tank gun turret on its own, no hull: a low rounded turret with one thick long cannon barrel pointing forward, ' +
      'a glowing muzzle tip. Livery: dark gunmetal steel.',
  },
]
