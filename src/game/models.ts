export const MODEL_PATHS = {
  player: '/models/kenney-space/craft_speederD.glb',
  // Air craft (Kenney space kit — nose points −Z natively)
  speederA: '/models/kenney-space/craft_speederA.glb',
  speederB: '/models/kenney-space/craft_speederB.glb',
  speederC: '/models/kenney-space/craft_speederC.glb',
  racer: '/models/kenney-space/craft_racer.glb',
  cargoA: '/models/kenney-space/craft_cargoA.glb',
  cargoB: '/models/kenney-space/craft_cargoB.glb',
  miner: '/models/kenney-space/craft_miner.glb',
  // Air craft (Quaternius — nose points +Z natively)
  ship1: '/models/quaternius/spaceship1.glb',
  ship2: '/models/quaternius/spaceship2.glb',
  ship3: '/models/quaternius/spaceship3.glb',
  ship4: '/models/quaternius/spaceship4.glb',
  ship5: '/models/quaternius/spaceship5.glb',
  ship6: '/models/quaternius/spaceship6.glb',
  ship7: '/models/quaternius/spaceship7.glb',
  // Naval
  shipLarge: '/models/kenney-pirate/ship-large.glb',
  shipMedium: '/models/kenney-pirate/ship-medium.glb',
  shipSmall: '/models/kenney-pirate/ship-small.glb',
  shipPirate: '/models/kenney-pirate/ship-pirate-large.glb',
  shipWreck: '/models/kenney-pirate/ship-wreck.glb',
  // Scenery
  palm: '/models/kenney-nature/tree_palmTall.glb',
  palmBend: '/models/kenney-nature/tree_palmBend.glb',
  tree: '/models/kenney-nature/tree_default.glb',
  treeOak: '/models/kenney-nature/tree_oak.glb',
  treeCone: '/models/kenney-nature/tree_cone.glb',
  bush: '/models/kenney-nature/plant_bushLarge.glb',
  rock: '/models/kenney-nature/rock_largeA.glb',
  rockB: '/models/kenney-nature/rock_largeB.glb',
  cliff: '/models/kenney-nature/cliff_block_rock.glb',
  piratePalm: '/models/kenney-pirate/palm-straight.glb',
  piratePalmBend: '/models/kenney-pirate/palm-bend.glb',
  sandPatch: '/models/kenney-pirate/patch-sand.glb',
  grassPatch: '/models/kenney-pirate/patch-grass.glb',
  seaRocks: '/models/kenney-pirate/rocks-a.glb',
  seaRocksB: '/models/kenney-pirate/rocks-b.glb',
  sandRocks: '/models/kenney-pirate/rocks-sand-a.glb',
  tower: '/models/kenney-pirate/tower-complete-large.glb',
  towerWatch: '/models/kenney-pirate/tower-watch.glb',
  dock: '/models/kenney-pirate/structure-platform-dock.glb',
  buildingA: '/models/kenney-city/building-a.glb',
  buildingC: '/models/kenney-city/building-c.glb',
  buildingE: '/models/kenney-city/building-e.glb',
  buildingH: '/models/kenney-city/building-h.glb',
  skyA: '/models/kenney-city/building-skyscraper-a.glb',
  skyB: '/models/kenney-city/building-skyscraper-b.glb',
  lowA: '/models/kenney-city/low-detail-building-a.glb',
  lowD: '/models/kenney-city/low-detail-building-d.glb',
  turret: '/models/kenney-space/turret_double.glb',
  turretSingle: '/models/kenney-space/turret_single.glb',
} as const

export type ModelKey = keyof typeof MODEL_PATHS

/** Kenney space craft are modelled nose −Z; everything else used as a ship faces +Z. */
export const noseIsNegZ = (path: string) => path.includes('/kenney-space/')

/** Per-material-name overrides: base color and/or emissive glow. */
export type MaterialPalette = Record<string, { color?: string; emissive?: string; emissiveIntensity?: number; metalness?: number; roughness?: number }>

/** Kenney space kit livery (materials: metal, metalDark, dark, metalRed). */
export function kenneyLivery(hull: string, panel: string, dark: string, glow: string, glowIntensity = 1.3): MaterialPalette {
  return {
    metal: { color: hull, metalness: 0.4, roughness: 0.4 },
    metalDark: { color: panel },
    dark: { color: dark },
    metalRed: { color: glow, emissive: glow, emissiveIntensity: glowIntensity },
  }
}

/** Quaternius livery: White/Black/Orange materials, or a tint over the textured `Atlas`. */
export function quatLivery(hull: string, trim: string, accent?: string, glow?: string): MaterialPalette {
  return {
    White: { color: hull, metalness: 0.35, roughness: 0.45 },
    Black: { color: trim },
    Orange: { color: accent ?? trim, ...(glow ? { emissive: glow, emissiveIntensity: 1.1 } : {}) },
    Atlas: { color: hull, ...(glow ? { emissive: glow, emissiveIntensity: 0.25 } : {}) },
  }
}
