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
    id: 'hull-s1', kind: 'hull', batch: 1, budget: 'small', glow: '#ff5a2a', size: 1.6, stage: 1,
    prompt: 'A compact military tank hull seen without its turret: low sloped armor, two wide tracks, a round empty turret ring on top, ' +
      'small headlights at the front. Livery: jungle olive green with darker olive panels.',
  },
  {
    id: 'gun-tank', kind: 'gun', batch: 1, budget: 'small', glow: '#ff5a2a', size: 1, stage: 1,
    prompt: 'A tank gun turret on its own, no hull: a low rounded turret with one thick long cannon barrel pointing forward, ' +
      'a glowing muzzle tip. Livery: dark gunmetal steel.',
  },
  // Batch 2: the other player planes, one design each in its planes.ts colors.
  {
    id: 'magnetar', kind: 'player', batch: 2, budget: 'medium', glow: '#c07aff', size: 1.9, stage: 1, old: `${K}craft_speederA.glb`,
    prompt: 'A nimble collector jet fighter: compact rounded body, short forward-swept wings, a glowing ring-shaped emitter faired into the nose, ' +
      'one large engine at the tail. Livery: pearl white hull with bold violet panels and deep purple trim.',
  },
  {
    id: 'aegis', kind: 'player', batch: 2, budget: 'medium', glow: '#3dffc0', size: 2.1, stage: 1, old: `${K}craft_cargoA.glb`,
    prompt: 'A sturdy defender jet fighter: broad body with thick rounded armored shoulders, wide straight wings with shield-like plates, ' +
      'twin engines side by side at the tail. Livery: mint white hull with bold teal-green panels and dark green trim.',
  },
  {
    id: 'viper', kind: 'player', batch: 2, budget: 'medium', glow: '#ffb02e', size: 1.8, stage: 1, old: `${K}craft_racer.glb`,
    prompt: 'A very fast jet fighter built for speed: a pointed nose on a solid, chunky body, big sharp delta wings spanning nearly ' +
      'the full length of the craft, one big engine at the tail. Livery: cream white hull with bold orange panels and dark brown trim.',
  },
  {
    id: 'hornet', kind: 'player', batch: 2, budget: 'medium', glow: '#ffe04a', size: 2, stage: 1, old: `${K}craft_speederB.glb`,
    prompt: 'An aggressive missile jet fighter: small canards near the nose, swept wings with missile pods built flush into the wing roots, ' +
      'twin engines side by side at the tail. Livery: warm white hull with bold yellow panels and black trim.',
  },
  {
    id: 'titan', kind: 'player', batch: 2, budget: 'medium', glow: '#4af0ff', size: 2.3, stage: 1, old: `${K}craft_cargoB.glb`,
    prompt: 'A heavy flying fortress: a wide, thick armored body, short broad wings, heavy plating, ' +
      'two big engines side by side at the tail. Livery: light steel gray hull with slate blue-gray panels and dark charcoal trim.',
  },
  {
    id: 'spectre', kind: 'player', batch: 2, budget: 'medium', glow: '#7a9aff', size: 2, stage: 1, old: `${K}craft_speederC.glb`,
    prompt: 'A stealth jet fighter: flat faceted angular body blended into wide diamond-shaped wings, ' +
      'twin engines side by side at the tail. Livery: pale blue-white hull with bold indigo panels and midnight navy trim.',
  },
  {
    id: 'seraph', kind: 'player', batch: 2, budget: 'medium', glow: '#6ad8ff', size: 2.1, stage: 1, old: '/models/quaternius/spaceship3.glb',
    prompt: 'An elegant command jet fighter: graceful long body, large gently curved swept wings like spread angel wings, ' +
      'twin engines side by side at the tail. Livery: pure white hull with deep navy panels and sky-blue trim.',
  },
  {
    id: 'nova', kind: 'player', batch: 2, budget: 'medium', glow: '#ff6aa8', size: 2.2, stage: 1, old: '/models/quaternius/spaceship2.glb',
    prompt: 'A powerful flagship jet fighter: large sleek body, wide swept wings with a star-burst row of glowing vents along their edges, ' +
      'twin engines side by side at the tail. Livery: warm white hull with deep burgundy panels and hot pink trim.',
  },
]
