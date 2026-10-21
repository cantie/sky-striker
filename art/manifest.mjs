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
  // Batch 3: the s1 enemy designs repainted for stages 2–10, liveries from each stage's old palette.
  // Recolored from the s1 models (colors). Rows whose old palette vanished into the stage's ground were
  // brightened or flipped (hull ↔ panel) after the preview.
  {
    id: 'enemy-basic-s2', kind: 'enemy', batch: 3, budget: 'small', glow: '#ffa040', size: 1.45, stage: 2, old: `${K}craft_speederC.glb`,
    base: 'enemy-basic-s1', livery: 'rust-brown hull with desert sand panels and dark brown trim',
    colors: { hull: '#9a5a22', panel: '#e2c48a', dark: '#2a1a0a' },
  },
  {
    id: 'enemy-fast-s2', kind: 'enemy', batch: 3, budget: 'small', glow: '#ffcf4a', size: 1.5, stage: 2, old: `${K}craft_racer.glb`,
    base: 'enemy-fast-s1', livery: 'tan hull with brick-red panels and dark brown trim',
    colors: { hull: '#d8b070', panel: '#b03a1a', dark: '#2a120a' },
  },
  {
    id: 'enemy-heavy-s2', kind: 'enemy', batch: 3, budget: 'small', glow: '#ff8a3d', size: 1.85, stage: 2, old: `${K}craft_cargoB.glb`,
    base: 'enemy-heavy-s1', livery: 'dusty khaki hull with dark brown panels and near-black trim',
    colors: { hull: '#c8a46a', panel: '#6a4a24', dark: '#1e140a' },
  },
  {
    id: 'enemy-shooter-s2', kind: 'enemy', batch: 3, budget: 'small', glow: '#ff7a3d', size: 1.35, stage: 2, old: `${K}craft_speederA.glb`,
    base: 'enemy-shooter-s1', livery: 'earthy brown hull with sandy tan panels and dark brown trim',
    colors: { hull: '#6b4a2a', panel: '#c9a46a', dark: '#20140a' },
  },
  {
    id: 'enemy-basic-s3', kind: 'enemy', batch: 3, budget: 'small', glow: '#5ab4ff', size: 1.45, stage: 3, old: '/models/quaternius/spaceship7.glb',
    base: 'enemy-basic-s1', livery: 'pale steel-white hull with deep navy panels and bright blue accents',
    colors: { hull: '#dfe6f0', panel: '#1d2a4a', dark: '#0d1221' },
  },
  {
    id: 'enemy-fast-s3', kind: 'enemy', batch: 3, budget: 'small', glow: '#4affe0', size: 1.5, stage: 3, old: `${K}craft_speederC.glb`,
    base: 'enemy-fast-s1', livery: 'white hull with teal panels and dark teal trim',
    colors: { hull: '#e8f4f4', panel: '#14a0a0', dark: '#0a2424' },
  },
  {
    id: 'enemy-heavy-s3', kind: 'enemy', batch: 3, budget: 'small', glow: '#ff6a5a', size: 1.85, stage: 3, old: '/models/quaternius/spaceship2.glb',
    base: 'enemy-heavy-s1', livery: 'pale blue-gray hull with navy panels and red accents',
    colors: { hull: '#d8e2ee', panel: '#1a2c4a', dark: '#0b1321' },
  },
  {
    id: 'enemy-shooter-s3', kind: 'enemy', batch: 3, budget: 'small', glow: '#ff5a6a', size: 1.35, stage: 3, old: `${K}craft_speederB.glb`,
    base: 'enemy-shooter-s1', livery: 'pale blue-white hull with cobalt blue panels and dark navy trim',
    colors: { hull: '#e6ecf4', panel: '#1f3a7a', dark: '#0a1430' },
  },
  {
    id: 'enemy-basic-s4', kind: 'enemy', batch: 3, budget: 'small', glow: '#ff8a3d', size: 1.45, stage: 4, old: '/models/quaternius/spaceship3.glb',
    base: 'enemy-basic-s1', livery: 'cream-beige hull with dark maroon-brown panels and orange accents',
    colors: { hull: '#e8d6c0', panel: '#3a1a10', dark: '#1a0b07' },
  },
  {
    id: 'enemy-fast-s4', kind: 'enemy', batch: 3, budget: 'small', glow: '#ff5a2a', size: 1.5, stage: 4, old: `${K}craft_racer.glb`,
    base: 'enemy-fast-s1', livery: 'crimson hull with dark charcoal-brown panels and near-black trim',
    colors: { hull: '#c0242f', panel: '#2a1a14', dark: '#120a08' },
  },
  {
    id: 'enemy-heavy-s4', kind: 'enemy', batch: 3, budget: 'small', glow: '#ffb02e', size: 1.85, stage: 4, old: `${K}craft_miner.glb`,
    base: 'enemy-heavy-s1', livery: 'copper-orange hull with rust-brown panels and dark brown trim',
    colors: { hull: '#c08a4a', panel: '#6a3a1a', dark: '#1e100a' },
  },
  {
    id: 'enemy-shooter-s4', kind: 'enemy', batch: 3, budget: 'small', glow: '#ff9a3d', size: 1.35, stage: 4, old: `${K}craft_speederC.glb`,
    base: 'enemy-shooter-s1', livery: 'pale wheat hull with burnt orange panels and dark brown trim',
    colors: { hull: '#f0d8b0', panel: '#d0601a', dark: '#2a140a' },
  },
  {
    id: 'enemy-basic-s5', kind: 'enemy', batch: 3, budget: 'small', glow: '#7fe0ff', size: 1.45, stage: 5, old: `${K}craft_speederA.glb`,
    base: 'enemy-basic-s1', livery: 'snow-white hull with steel-blue panels and dark navy trim',
    colors: { hull: '#f2f8ff', panel: '#3a7ab8', dark: '#0e1e2e' },
  },
  {
    id: 'enemy-fast-s5', kind: 'enemy', batch: 3, budget: 'small', glow: '#45c8ff', size: 1.5, stage: 5, old: '/models/quaternius/spaceship4.glb',
    base: 'enemy-fast-s1', livery: 'icy white hull with dark slate-blue panels and light blue accents',
    colors: { hull: '#eef6ff', panel: '#1a3a5a', dark: '#0b1a28' },
  },
  {
    id: 'enemy-heavy-s5', kind: 'enemy', batch: 3, budget: 'small', glow: '#7fe0ff', size: 1.85, stage: 5, old: `${K}craft_cargoA.glb`,
    base: 'enemy-heavy-s1', livery: 'steel-blue hull with dark blue panels and navy trim',
    colors: { hull: '#5a7a9a', panel: '#2a4a6a', dark: '#0e1a26' },
  },
  {
    id: 'enemy-shooter-s5', kind: 'enemy', batch: 3, budget: 'small', glow: '#ff7a9a', size: 1.35, stage: 5, old: '/models/quaternius/spaceship7.glb',
    base: 'enemy-shooter-s1', livery: 'pure white hull with navy panels and pink-red accents',
    colors: { hull: '#ffffff', panel: '#2a4a7a', dark: '#122136' },
  },
  {
    id: 'enemy-basic-s6', kind: 'enemy', batch: 3, budget: 'small', glow: '#ffb02e', size: 1.45, stage: 6, old: `${K}craft_speederB.glb`,
    base: 'enemy-basic-s1', livery: 'dark umber hull with terracotta panels and black trim',
    colors: { hull: '#2a1a12', panel: '#d08a5a', dark: '#0a0604' },
  },
  {
    id: 'enemy-fast-s6', kind: 'enemy', batch: 3, budget: 'small', glow: '#ff4a2a', size: 1.5, stage: 6, old: `${K}craft_racer.glb`,
    base: 'enemy-fast-s1', livery: 'near-black brown hull with bright red panels and black trim',
    colors: { hull: '#24140e', panel: '#d02a1a', dark: '#0a0604' },
  },
  {
    id: 'enemy-heavy-s6', kind: 'enemy', batch: 3, budget: 'small', glow: '#ff8a3d', size: 1.85, stage: 6, old: `${K}craft_miner.glb`,
    base: 'enemy-heavy-s1', livery: 'clay-brown hull with dark brown panels and near-black trim',
    colors: { hull: '#9a5a3a', panel: '#4a2414', dark: '#160a06' },
  },
  {
    id: 'enemy-shooter-s6', kind: 'enemy', batch: 3, budget: 'small', glow: '#ff7a3d', size: 1.35, stage: 6, old: '/models/quaternius/spaceship6.glb',
    base: 'enemy-shooter-s1', livery: 'bone white hull with very dark brown panels and orange accents',
    colors: { hull: '#f0e0d0', panel: '#2a0e06', dark: '#130603' },
  },
  {
    id: 'enemy-basic-s7', kind: 'enemy', batch: 3, budget: 'small', glow: '#9bff5a', size: 1.45, stage: 7, old: '/models/quaternius/spaceship4.glb',
    base: 'enemy-basic-s1', livery: 'light moss-green hull with very dark green panels and lime accents',
    colors: { hull: '#9ab07a', panel: '#0e1a10', dark: '#060c07' },
  },
  {
    id: 'enemy-fast-s7', kind: 'enemy', batch: 3, budget: 'small', glow: '#c8ff3a', size: 1.5, stage: 7, old: `${K}craft_speederC.glb`,
    base: 'enemy-fast-s1', livery: 'light lime-olive hull with dark olive panels and black trim',
    colors: { hull: '#a0c060', panel: '#3a4a2a', dark: '#0a1006' },
  },
  {
    id: 'enemy-heavy-s7', kind: 'enemy', batch: 3, budget: 'small', glow: '#9bff5a', size: 1.85, stage: 7, old: `${K}craft_cargoB.glb`,
    base: 'enemy-heavy-s1', livery: 'light gray-green hull with dark olive panels and black trim',
    colors: { hull: '#8a9a7a', panel: '#2a3a1a', dark: '#0a1006' },
  },
  {
    id: 'enemy-shooter-s7', kind: 'enemy', batch: 3, budget: 'small', glow: '#d0ff4a', size: 1.35, stage: 7, old: '/models/quaternius/spaceship2.glb',
    base: 'enemy-shooter-s1', livery: 'pale sage hull with very dark green panels and yellow-lime accents',
    colors: { hull: '#b0c098', panel: '#141e10', dark: '#090d07' },
  },
  {
    id: 'enemy-basic-s8', kind: 'enemy', batch: 3, budget: 'small', glow: '#ff4ad8', size: 1.45, stage: 8, old: `${K}craft_speederA.glb`,
    base: 'enemy-basic-s1', livery: 'dark gunmetal-violet hull with hot magenta panels and black trim',
    colors: { hull: '#2a2a3a', panel: '#ff2ab8', dark: '#0a0a14' },
  },
  {
    id: 'enemy-fast-s8', kind: 'enemy', batch: 3, budget: 'small', glow: '#4af0ff', size: 1.5, stage: 8, old: `${K}craft_racer.glb`,
    base: 'enemy-fast-s1', livery: 'dark navy-steel hull with neon cyan panels and black trim',
    colors: { hull: '#1a2a3a', panel: '#2af0ff', dark: '#06101a' },
  },
  {
    id: 'enemy-heavy-s8', kind: 'enemy', batch: 3, budget: 'small', glow: '#ffe04a', size: 1.85, stage: 8, old: `${K}craft_cargoA.glb`,
    base: 'enemy-heavy-s1', livery: 'charcoal hull with bright yellow panels and black trim',
    colors: { hull: '#2a2a2a', panel: '#ffd21a', dark: '#0a0a0a' },
  },
  {
    id: 'enemy-shooter-s8', kind: 'enemy', batch: 3, budget: 'small', glow: '#ff4ad8', size: 1.35, stage: 8, old: '/models/quaternius/spaceship5.glb',
    base: 'enemy-shooter-s1', livery: 'bubblegum pink hull with very dark purple panels and magenta accents',
    colors: { hull: '#ff9ae0', panel: '#1a0a1a', dark: '#0b040b' },
  },
  {
    id: 'enemy-basic-s9', kind: 'enemy', batch: 3, budget: 'small', glow: '#ff6a2a', size: 1.45, stage: 9, old: '/models/quaternius/spaceship6.glb',
    base: 'enemy-basic-s1', livery: 'light ash hull with dark rust panels and hot orange accents',
    colors: { hull: '#b0a090', panel: '#5a2a1a', dark: '#1a0a06' },
  },
  {
    id: 'enemy-fast-s9', kind: 'enemy', batch: 3, budget: 'small', glow: '#ff8a3d', size: 1.5, stage: 9, old: `${K}craft_speederC.glb`,
    base: 'enemy-fast-s1', livery: 'bright orange hull with charred black panels and black trim',
    colors: { hull: '#ff7a1a', panel: '#1e1614', dark: '#080404' },
  },
  {
    id: 'enemy-heavy-s9', kind: 'enemy', batch: 3, budget: 'small', glow: '#ff5a1f', size: 1.85, stage: 9, old: `${K}craft_miner.glb`,
    base: 'enemy-heavy-s1', livery: 'light ash-gray hull with molten orange panels and dark trim',
    colors: { hull: '#9a8a80', panel: '#ff5a10', dark: '#1a1210' },
  },
  {
    id: 'enemy-shooter-s9', kind: 'enemy', batch: 3, budget: 'small', glow: '#ff5a1f', size: 1.35, stage: 9, old: '/models/quaternius/spaceship1.glb',
    base: 'enemy-shooter-s1', livery: 'bright oxide red-orange hull with near-black panels and orange accents',
    colors: { hull: '#d0603a', panel: '#3a0e06', dark: '#1a0604' },
  },
  {
    id: 'enemy-basic-s10', kind: 'enemy', batch: 3, budget: 'small', glow: '#ff3a5a', size: 1.45, stage: 10, old: '/models/quaternius/spaceship7.glb',
    base: 'enemy-basic-s1', livery: 'dark gunmetal hull with crimson panels and black trim',
    colors: { hull: '#2a2c34', panel: '#a01a2a', dark: '#0a0a0e' },
  },
  {
    id: 'enemy-fast-s10', kind: 'enemy', batch: 3, budget: 'small', glow: '#ff5a7a', size: 1.5, stage: 10, old: '/models/quaternius/spaceship4.glb',
    base: 'enemy-fast-s1', livery: 'cool gray hull with black panels and crimson accents',
    colors: { hull: '#9aa2b4', panel: '#101218', dark: '#07080a' },
  },
  {
    id: 'enemy-heavy-s10', kind: 'enemy', batch: 3, budget: 'small', glow: '#ff3a5a', size: 1.85, stage: 10, old: `${K}craft_cargoB.glb`,
    base: 'enemy-heavy-s1', livery: 'dark gunmetal hull with crimson panels and black trim',
    colors: { hull: '#3a3e48', panel: '#a01a2a', dark: '#0a0a0e' },
  },
  {
    id: 'enemy-shooter-s10', kind: 'enemy', batch: 3, budget: 'small', glow: '#ff3a5a', size: 1.35, stage: 10, old: '/models/quaternius/spaceship3.glb',
    base: 'enemy-shooter-s1', livery: 'light steel gray hull with black panels and crimson accents',
    colors: { hull: '#a7afc2', panel: '#14161c', dark: '#09090c' },
  },
]
