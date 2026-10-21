export const MODEL_PATHS = {
  // Kenney space kit (nose points −Z natively): parked cargo craft and turrets, scenery only
  cargoA: '/models/kenney-space/craft_cargoA.glb',
  cargoB: '/models/kenney-space/craft_cargoB.glb',
  turret: '/models/kenney-space/turret_double.glb',
  turretSingle: '/models/kenney-space/turret_single.glb',
  // Scenery
  shipWreck: '/models/kenney-pirate/ship-wreck.glb',
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
} as const

export type ModelKey = keyof typeof MODEL_PATHS

/** A model built by the art pipeline (art/manifest.mjs → public/models/ai/<id>.glb). */
export const aiModel = (id: string) => `/models/ai/${id}.glb`
export const isAiModel = (path: string) => path.startsWith('/models/ai/')

/** Kenney space craft are modelled nose −Z; everything else faces +Z. */
export const noseIsNegZ = (path: string) => path.includes('/kenney-space/')

/** Per-material-name overrides: base color and/or emissive glow. */
export type MaterialPalette = Record<string, { color?: string; emissive?: string; emissiveIntensity?: number; metalness?: number; roughness?: number }>

