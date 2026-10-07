import type { Biome } from '../../../game/biomes'
import { MODEL_PATHS as M, type MaterialPalette } from '../../../game/models'

export type PropSpec = {
  key: string
  path: string
  x: number
  z: number
  size: number
  rot?: number
  sizeAxis?: 'max' | 'y'
  palette?: MaterialPalette
}

/** One kind of prop that may appear in a chunk. */
type PropRule = {
  paths: string[]
  /** Units per chunk: floor(min + rnd·(max − min)), so [0, 1.4] ≈ 29% chance of one. */
  count: [number, number]
  size: [number, number]
  sizeAxis?: 'max' | 'y'
  palettes?: MaterialPalette[]
  /** Scatter radius around the chunk anchor. */
  spread?: [number, number]
  /** Keep upright with a random spin (default) or a fixed rotation. */
  fixedRot?: boolean
}

// Kenney nature kit ships teal leaves/grass; re-tint per biome
const tint = (leaves: string[], bark = '#7a4e2c'): MaterialPalette[] => leaves.map((c) => ({ leafsGreen: { color: c }, woodBark: { color: bark } }))
const grass = (cs: string[]): MaterialPalette[] => cs.map((c) => ({ grass: { color: c } }))
const stone = (body: string, top: string): MaterialPalette[] => [{ dirt: { color: body }, grass: { color: top } }]

const JUNGLE_TREES = tint(['#3f8f3a', '#2e7a33', '#5ba043', '#477f2a', '#6aa84f'])
const AUTUMN_TREES = tint(['#c8501e', '#e08a1e', '#b8321a', '#d8b02a', '#9a3a16'], '#5a3a22')
const SNOW_PINES = tint(['#3a6a56', '#4a7a62', '#dfe8ef'], '#5a4030')
const SWAMP_TREES = tint(['#2c4424', '#344a26', '#3e5a2a'], '#3a2e1e')
const DEAD_TREES = tint(['#3a2e26', '#4a3a2e'], '#2a2018')

const RULES: Record<Biome, PropRule[]> = {
  jungle: [
    { paths: [M.treeOak, M.tree, M.palm, M.treeCone], count: [3, 7], size: [2.6, 4.4], sizeAxis: 'y', palettes: JUNGLE_TREES, spread: [4.2, 3.2] },
    { paths: [M.bush], count: [2, 5], size: [1.2, 2.4], palettes: grass(['#4c9638', '#3d8530', '#5fa844']), spread: [3.5, 2.5] },
    { paths: [M.rock], count: [0, 1.5], size: [1.3, 2.3], palettes: stone('#8f8a7e', '#5c9a3e') },
  ],
  desert: [
    { paths: [M.rock, M.rockB], count: [2, 5], size: [1, 2.8], palettes: stone('#a8724a', '#d2a868'), spread: [4, 3] },
    { paths: [M.rockB], count: [0, 1.45], size: [2.8, 4], palettes: stone('#a8724a', '#d2a868') },
    { paths: [M.palmBend], count: [0, 1.35], size: [2, 3], sizeAxis: 'y', palettes: tint(['#8f9a3e'], '#8a6038') },
  ],
  ocean: [
    { paths: [M.sandPatch], count: [0, 1.6], size: [3, 4.5] },
    { paths: [M.piratePalm, M.piratePalmBend], count: [0, 2.6], size: [2.2, 3.2], sizeAxis: 'y', spread: [2, 1.6] },
    { paths: [M.seaRocks, M.seaRocksB, M.sandRocks], count: [1, 3], size: [1.2, 2.4], spread: [5, 4] },
    { paths: [M.shipWreck, M.dock], count: [0, 1.25], size: [3, 4] },
  ],
  autumn: [
    { paths: [M.treeOak, M.tree, M.treeCone], count: [3, 7], size: [2.6, 4.2], sizeAxis: 'y', palettes: AUTUMN_TREES, spread: [4.2, 3.2] },
    { paths: [M.bush], count: [1, 4], size: [1.2, 2.2], palettes: grass(['#b8641e', '#9a4a1a', '#c89a2a']), spread: [3.5, 2.5] },
    { paths: [M.rock], count: [0, 1.5], size: [1.3, 2.2], palettes: stone('#8a7a6a', '#a8762a') },
  ],
  arctic: [
    { paths: [M.treeCone], count: [2, 6], size: [2.6, 4.2], sizeAxis: 'y', palettes: SNOW_PINES, spread: [4.2, 3.2] },
    { paths: [M.rock, M.rockB], count: [1, 3], size: [1.2, 2.6], palettes: stone('#6a7682', '#f2f6fa'), spread: [4, 3] },
    { paths: [M.rockB], count: [0, 1.3], size: [2.6, 3.4], palettes: stone('#7a8894', '#f4f8fb') },
  ],
  canyon: [
    { paths: [M.rockB], count: [0, 1.6], size: [2.8, 4], palettes: stone('#9a4a26', '#d4824a') },
    { paths: [M.rock, M.rockB], count: [2, 5], size: [1.2, 3], palettes: stone('#a0502a', '#c8703a'), spread: [4.5, 3.2] },
    { paths: [M.palmBend, M.tree], count: [0, 1.5], size: [2, 3], sizeAxis: 'y', palettes: DEAD_TREES },
  ],
  swamp: [
    { paths: [M.tree, M.treeOak], count: [2, 6], size: [2.4, 4], sizeAxis: 'y', palettes: SWAMP_TREES, spread: [4.4, 3.2] },
    { paths: [M.bush], count: [2, 5], size: [1.3, 2.4], palettes: grass(['#3a5a2a', '#2e4a22', '#4a6a30']), spread: [4, 3] },
    { paths: [M.shipWreck, M.dock], count: [0, 1.3], size: [2.6, 3.4] },
  ],
  city: [
    { paths: [M.skyA, M.skyB], count: [0, 1.7], size: [4.2, 6], sizeAxis: 'y', fixedRot: true, spread: [3, 2] },
    { paths: [M.buildingA, M.buildingC, M.buildingE, M.buildingH], count: [1, 3], size: [2.4, 3.4], sizeAxis: 'y', fixedRot: true, spread: [4.5, 3] },
    { paths: [M.lowA, M.lowD], count: [0, 2], size: [2, 2.6], sizeAxis: 'y', fixedRot: true, spread: [4.5, 3] },
  ],
  volcano: [
    { paths: [M.rock, M.rockB], count: [2, 5], size: [1.2, 3.2], palettes: stone('#2a2422', '#4a3a34'), spread: [4.5, 3.2] },
    { paths: [M.rockB], count: [0, 1.5], size: [2.8, 4], palettes: stone('#1e1a18', '#3a2e2a') },
    { paths: [M.tree], count: [0, 1.4], size: [2, 3], sizeAxis: 'y', palettes: DEAD_TREES },
  ],
  fortress: [
    { paths: [M.turret, M.turretSingle], count: [0, 2.4], size: [1.4, 2], spread: [5, 3] },
    { paths: [M.lowA, M.lowD, M.buildingH], count: [0, 1.8], size: [2.2, 3], sizeAxis: 'y', fixedRot: true, spread: [4.5, 3] },
    { paths: [M.cargoA, M.cargoB], count: [0, 1.35], size: [2, 2.6] },
  ],
}

/** Deterministic props for one chunk lane (lane 0 = left verge, 2 = right verge). */
export function makeChunk(biome: Biome, seed: number, lane: number): PropSpec[] {
  const rnd = (n: number) => {
    const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453
    return x - Math.floor(x)
  }
  const baseX = (lane - 1) * 5.6 + (rnd(1) - 0.5) * 1.6
  const items: PropSpec[] = []
  RULES[biome].forEach((rule, ri) => {
    const k = 100 * (ri + 1)
    const [lo, hi] = rule.count
    const n = Math.floor(lo + rnd(k) * (hi - lo))
    const [sx, sz] = rule.spread ?? [2.5, 2]
    for (let i = 0; i < n; i++) {
      const r = (j: number) => rnd(k + i * 7 + j)
      items.push({
        key: `${biome}-${seed}-${ri}-${i}`,
        path: rule.paths[Math.floor(r(1) * rule.paths.length) % rule.paths.length],
        x: baseX + (r(2) - 0.5) * sx,
        z: (r(3) - 0.5) * sz,
        size: rule.size[0] + r(4) * (rule.size[1] - rule.size[0]),
        sizeAxis: rule.sizeAxis,
        rot: rule.fixedRot ? Math.floor(r(5) * 4) * (Math.PI / 2) : r(5) * Math.PI * 2,
        palette: rule.palettes?.[Math.floor(r(6) * rule.palettes.length) % rule.palettes.length],
      })
    }
  })
  return items
}
