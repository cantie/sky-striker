// Every AI art asset: what to draw, how big it may be, and which batch it belongs to.
// Hand-written; the tools in scripts/art read it and never rewrite it. An asset is approved when
// art/concepts/<id>.webp exists.
//
// Row: { id, kind: player|enemy|boss|hull|base|gun, batch: 1..5, budget, glow: '#rrggbb',
//   prompt (a design) | base + livery (a repaint of an approved design),
//   seed?, size? (game size), stage? (1..10), old? (the model it replaces), turn? (0 | 180),
//   colors? ({ hull, panel, dark }: recolored at build time, a repaint from its base's model),
//   tall? (true: taller than wide, checked by eye in the angled preview; skips the lies-flat check),
//   pitch?, yaw?, roll? (degrees within ±90: hand fine-tuning of a model after the preview) }

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
  // Batch 4: ground units. New designs: the boat, the hovercraft, the fixed-turret base and three guns.
  // Recolored repaints (colors, no concept): tank hulls of the other tank stages, the base of every stage.
  {
    id: 'hull-s3', kind: 'hull', batch: 4, budget: 'small', glow: '#ff3a3a', size: 1.6, stage: 3,
    prompt: 'A small fast military patrol boat seen without its gun: pointed bow, low flat deck, a round empty gun ring in the exact middle ' +
      'of the deck, a low cabin at the stern. Livery: light gray-white hull with slate blue-gray deck panels.',
    // Levelled with its deck 10° off, squared up by its flat faces
    roll: -10,
  },
  {
    id: 'hull-s7', kind: 'hull', batch: 4, budget: 'small', glow: '#9bff5a', size: 1.6, stage: 7,
    prompt: 'A compact military hovercraft seen without its gun: a rounded armored body on a thick black rubber skirt, ' +
      'two glowing exhaust fans at the back, a round empty turret ring on top. Livery: swamp olive green with dark green panels.',
    // Brightened after the preview: the swamp ground swallowed the dark olive paint
    colors: { hull: '#8a9a6a', panel: '#4a5a34', dark: '#1e2816' },
  },
  {
    id: 'base-s1', kind: 'base', batch: 4, budget: 'small', glow: '#ff5a2a', size: 1.6, stage: 1,
    prompt: 'A fixed gun emplacement seen without its gun: a low octagonal armored bunker with sloped sides, ' +
      'a round empty turret ring on top, small glowing lights around the ring. Livery: jungle olive green with darker olive panels.',
  },
  {
    id: 'gun-boat', kind: 'gun', batch: 4, budget: 'small', glow: '#ff3a3a', size: 1, stage: 3,
    prompt: 'A naval deck gun turret on its own, no boat: a rounded armored turret with one long cannon barrel pointing forward, ' +
      'a glowing muzzle tip. Livery: dark gunmetal steel.',
  },
  {
    id: 'gun-hover', kind: 'gun', batch: 4, budget: 'small', glow: '#9bff5a', size: 1, stage: 7,
    prompt: 'A compact energy cannon turret on its own, no vehicle: a low wedge-shaped turret with two short thick barrels ' +
      'pointing forward, glowing coils at the barrel tips. Livery: dark gunmetal steel.',
  },
  {
    id: 'gun-turret', kind: 'gun', batch: 4, budget: 'small', glow: '#ff5a2a', size: 1, stage: 1,
    prompt: 'A heavy twin-barrel gun turret on its own, no base: a squat armored turret with two long cannon barrels side by side ' +
      'pointing forward, glowing muzzle tips. Livery: dark gunmetal steel.',
  },
  {
    id: 'hull-s2', kind: 'hull', batch: 4, budget: 'small', glow: '#ff7a2a', size: 1.6, stage: 2,
    base: 'hull-s1', livery: 'desert sand', colors: { hull: '#b8955a', panel: '#8a6a3a', dark: '#3e2f1a' },
  },
  {
    id: 'hull-s4', kind: 'hull', batch: 4, budget: 'small', glow: '#ffb02e', size: 1.6, stage: 4,
    base: 'hull-s1', livery: 'autumn brown', colors: { hull: '#7a4a2a', panel: '#5a3218', dark: '#28160a' },
  },
  {
    id: 'hull-s5', kind: 'hull', batch: 4, budget: 'small', glow: '#45c8ff', size: 1.6, stage: 5,
    base: 'hull-s1', livery: 'arctic white', colors: { hull: '#dfe7ee', panel: '#9aa8b4', dark: '#454b51' },
  },
  {
    id: 'hull-s6', kind: 'hull', batch: 4, budget: 'small', glow: '#ffcf4a', size: 1.6, stage: 6,
    base: 'hull-s1', livery: 'canyon red-brown', colors: { hull: '#9a4a2a', panel: '#6a2e18', dark: '#2f140a' },
  },
  {
    id: 'hull-s8', kind: 'hull', batch: 4, budget: 'small', glow: '#2af0ff', size: 1.6, stage: 8,
    base: 'hull-s1', livery: 'city gunmetal', colors: { hull: '#3a3e48', panel: '#24262e', dark: '#101114' },
  },
  {
    id: 'hull-s9', kind: 'hull', batch: 4, budget: 'small', glow: '#ff5a1a', size: 1.6, stage: 9,
    base: 'hull-s1', livery: 'light volcanic ash', colors: { hull: '#8a8078', panel: '#3a2a22', dark: '#140e0c' },
  },
  {
    id: 'hull-s10', kind: 'hull', batch: 4, budget: 'small', glow: '#ff1a3a', size: 1.6, stage: 10,
    base: 'hull-s1', livery: 'fortress steel', colors: { hull: '#4a505c', panel: '#2a2e36', dark: '#121418' },
  },
  {
    id: 'base-s2', kind: 'base', batch: 4, budget: 'small', glow: '#ff7a2a', size: 1.6, stage: 2,
    base: 'base-s1', livery: 'desert sand', colors: { hull: '#b8955a', panel: '#8a6a3a', dark: '#3e2f1a' },
  },
  {
    id: 'base-s3', kind: 'base', batch: 4, budget: 'small', glow: '#ff3a3a', size: 1.6, stage: 3,
    base: 'base-s1', livery: 'navy white', colors: { hull: '#d8dde6', panel: '#4a5468', dark: '#21252e' },
  },
  {
    id: 'base-s4', kind: 'base', batch: 4, budget: 'small', glow: '#ffb02e', size: 1.6, stage: 4,
    base: 'base-s1', livery: 'autumn brown', colors: { hull: '#7a4a2a', panel: '#5a3218', dark: '#28160a' },
  },
  {
    id: 'base-s5', kind: 'base', batch: 4, budget: 'small', glow: '#45c8ff', size: 1.6, stage: 5,
    base: 'base-s1', livery: 'arctic white', colors: { hull: '#dfe7ee', panel: '#9aa8b4', dark: '#454b51' },
  },
  {
    id: 'base-s6', kind: 'base', batch: 4, budget: 'small', glow: '#ffcf4a', size: 1.6, stage: 6,
    base: 'base-s1', livery: 'canyon red-brown', colors: { hull: '#9a4a2a', panel: '#6a2e18', dark: '#2f140a' },
  },
  {
    id: 'base-s7', kind: 'base', batch: 4, budget: 'small', glow: '#9bff5a', size: 1.6, stage: 7,
    base: 'base-s1', livery: 'light swamp moss', colors: { hull: '#8a9a6a', panel: '#4a5a34', dark: '#1e2816' },
  },
  {
    id: 'base-s8', kind: 'base', batch: 4, budget: 'small', glow: '#2af0ff', size: 1.6, stage: 8,
    base: 'base-s1', livery: 'city gunmetal', colors: { hull: '#3a3e48', panel: '#24262e', dark: '#101114' },
  },
  {
    id: 'base-s9', kind: 'base', batch: 4, budget: 'small', glow: '#ff5a1a', size: 1.6, stage: 9,
    base: 'base-s1', livery: 'light volcanic ash', colors: { hull: '#8a8078', panel: '#3a2a22', dark: '#140e0c' },
  },
  {
    id: 'base-s10', kind: 'base', batch: 4, budget: 'small', glow: '#ff1a3a', size: 1.6, stage: 10,
    base: 'base-s1', livery: 'fortress steel', colors: { hull: '#4a505c', panel: '#2a2e36', dark: '#121418' },
  },
  // Batch 5: the bosses, one design each in its bosses.ts colors. Sand Crawler is a giant tank (hull + gun).
  {
    id: 'boss-vulture', kind: 'boss', batch: 5, budget: 'large', glow: '#ff7a3d', size: 5.8, stage: 1, old: `${K}craft_cargoB.glb`,
    prompt: 'A huge armored military gunship, the boss of a jungle level: a wide boxy fuselage, short thick wings with gun pods ' +
      'built into them, a heavy chin cannon, two big engines side by side at the tail. Livery: olive green with dark olive panels ' +
      'and near-black trim.',
  },
  {
    id: 'boss-crawler', kind: 'hull', batch: 5, budget: 'large', glow: '#ff7a2a', size: 8.6, stage: 2,
    prompt: 'A giant desert siege tank hull seen without its turret: a long low armored body on four huge tracks, sloped armor ' +
      'plates, a wide round empty turret ring in the exact middle on top, small glowing lights at the front. ' +
      'Livery: desert sand with brown panels.',
  },
  {
    id: 'boss-crawler-gun', kind: 'gun', batch: 5, budget: 'large', glow: '#ff7a2a', size: 5.4, stage: 2,
    prompt: 'A giant siege tank turret on its own, no hull: a wide low armored turret with two very thick long cannon barrels ' +
      'side by side pointing forward, glowing muzzle tips. Livery: dark gunmetal steel with sand-colored plates.',
  },
  {
    id: 'boss-galleon', kind: 'boss', batch: 5, budget: 'large', glow: '#ff3a3a', size: 9.6, stage: 3, old: '/models/kenney-pirate/ship-pirate-large.glb',
    prompt: 'A dreadnought battleship, the boss of a sea level: a long armored steel hull with a pointed bow, three big gun ' +
      'turrets along the deck, a tall armored bridge tower in the middle, glowing red lights. ' +
      'Livery: dark navy-gray steel with lighter gray deck and red trim.',
    // Levelling took its side for its top (the tall tower makes it about as tall as it is wide); squared up by its flat faces
    pitch: 3.5, yaw: -4, roll: -63,
    tall: true,
  },
  {
    id: 'boss-hornet', kind: 'boss', batch: 5, budget: 'large', glow: '#ff8a3d', size: 7.0, stage: 4, old: '/models/quaternius/spaceship3.glb',
    prompt: 'A huge wasp-shaped warship: a long segmented armored body with a pointed stinger tail, four broad swept wings, ' +
      'glowing orange vents, two big engines at the tail. Livery: cream hull with dark brown panels and orange accents.',
  },
  {
    id: 'boss-warden', kind: 'boss', batch: 5, budget: 'large', glow: '#7fe0ff', size: 7.4, stage: 5, old: '/models/quaternius/spaceship2.glb',
    prompt: 'A huge armored ice fortress warship: a broad heavy body with crystal-like angular armor plates, wide square wings, ' +
      'glowing ice-blue lights, two big engines at the tail. Livery: ice white hull with dark steel-blue panels and light blue accents.',
  },
  {
    id: 'boss-breaker', kind: 'boss', batch: 5, budget: 'large', glow: '#ffb02e', size: 7.4, stage: 6, old: `${K}craft_miner.glb`,
    prompt: 'A huge mining warship: a heavy armored body with two giant drill heads at the front, thick side armor, glowing ' +
      'amber lights, two big engines at the tail. Livery: copper hull with dark rust-brown panels and amber accents.',
  },
  {
    id: 'boss-wraith', kind: 'boss', batch: 5, budget: 'large', glow: '#9bff5a', size: 7.7, stage: 7, old: '/models/quaternius/spaceship4.glb',
    prompt: 'A huge eerie swamp warship: a long manta-shaped body with ragged swept wings, glowing toxic green vents along its ' +
      'back, one big engine at the tail. Livery: light moss green hull with very dark green panels and lime accents.',
    // Brightened and drawn larger after the in-game check: thin, and lost in the swamp fog
    colors: { hull: '#b4d49a', panel: '#2e4a26', dark: '#0e1a10' },
  },
  {
    id: 'boss-hive', kind: 'boss', batch: 5, budget: 'large', glow: '#ff4ad8', size: 7.0, stage: 8, old: '/models/quaternius/spaceship5.glb',
    prompt: 'A huge neon carrier warship: a round hexagonal hive-like body with honeycomb armor, wide short wings, glowing ' +
      'magenta hexagon lights, two big engines at the tail. Livery: hot pink hull with very dark purple panels and magenta accents.',
  },
  {
    id: 'boss-leviathan', kind: 'boss', batch: 5, budget: 'large', glow: '#ff5a1f', size: 7.4, stage: 9, old: '/models/quaternius/spaceship1.glb',
    prompt: 'A huge serpent-like magma warship: a long armored body with overlapping plates like scales, a fanged prow, ' +
      'glowing molten orange cracks, two big engines at the tail. Livery: bright salmon-orange hull with near-black panels and orange accents.',
    // Its outline sat a few degrees off after levelling (a tall tower / a curved body pull the mass axis)
    pitch: -1, yaw: -9, roll: -4,
  },
  {
    id: 'boss-citadel', kind: 'boss', batch: 5, budget: 'large', glow: '#ff3a5a', size: 8.6, stage: 10, old: '/models/quaternius/spaceship6.glb',
    prompt: 'A colossal flying fortress, the final boss: a massive square armored body with stepped battlements and gun ' +
      'turrets built into its deck, a glowing red core in the middle, two big engines at the tail. ' +
      'Livery: steel gray hull with black panels and crimson accents.',
    // Level (checked in the angled preview), but its fortress body is a hair taller than it is wide
    tall: true,
  },
]
