import type { PathId } from './paths'
import type { AirRole, EnemyType } from './roster'
import { GAME_SPEED } from './speed'

/** Spawn group as authored in stages.ts (kept local to avoid an import cycle). */
export interface GenGroup {
  type: EnemyType
  path: PathId
  x?: number | number[]
  y?: number
  count?: number
  gap?: number
  m?: 1 | -1 | 'both'
  amp?: number
  speed?: number
  delay?: number
}

/** Real seconds of waves before the boss shows up. */
export const STAGE_SECONDS = 120

/** Deterministic PRNG so every stage keeps the same script run after run. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Paths that read well as follow-the-leader trains. */
const TRAIN_PATHS: PathId[] = ['sine', 'snake', 'zigzag', 'swoop', 'arc', 'cross', 'pincer', 'spiral', 'loop',
  'column', 'rise', 'riseStraight', 'sideDive', 'zigCross', 'boomerang', 'stairs']
/** Paths for a few units side by side in lanes. */
const LANE_PATHS: PathId[] = ['dive', 'column', 'uturn', 'loop', 'hover', 'riseStraight', 'figure8']
const TRAIN_ONLY_SIDE: ReadonlySet<PathId> = new Set(['swoop', 'arc', 'cross', 'pincer', 'sideDive', 'zigCross', 'boomerang', 'stairs'])

export interface GenSpec {
  stageId: number
  /** Game-ms between waves (sets how many waves fill STAGE_SECONDS). */
  waveInterval: number
  /** Hand-authored opening/key waves; the generator fills around them. */
  authored: GenGroup[][]
  /** This stage's signature new manoeuvres (weighted up in the mix). */
  signature: PathId[]
}

const pick = <T,>(r: () => number, list: T[]) => list[Math.floor(r() * list.length) % list.length]
const round1 = (v: number) => Math.round(v * 10) / 10

/**
 * Builds a ~2-minute wave script: the authored waves spread evenly through the stage, with
 * seeded procedural formations in between. Later stages field bigger, faster formations.
 */
export function buildWaves(spec: GenSpec): GenGroup[][] {
  const r = mulberry32(spec.stageId * 7919 + 17)
  const realInterval = spec.waveInterval / GAME_SPEED / 1000
  const total = Math.max(spec.authored.length, Math.round(STAGE_SECONDS / realInterval))
  const lvl = (spec.stageId - 1) / 9 // 0 → 1 across the saga

  const usedPaths = new Set<PathId>(spec.authored.flat().map((g) => g.path))
  const trainPool = TRAIN_PATHS.filter((p) => usedPaths.has(p))
  // Signature manoeuvres appear 3× as often as the stage's other trains
  const trains = [...trainPool, ...spec.signature, ...spec.signature, ...spec.signature]
  const lanes = LANE_PATHS.filter((p) => usedPaths.has(p) || spec.signature.includes(p))
  const airTypes: AirRole[] = ['basic', 'basic', 'fast', 'shooter']

  const train = (): GenGroup => {
    const path = pick(r, trains)
    const type: EnemyType = r() < 0.3 + lvl * 0.2 ? 'shooter' : pick(r, ['basic', 'fast'] as const)
    const side = TRAIN_ONLY_SIDE.has(path)
    return {
      type, path,
      x: side ? round1((r() - 0.5) * 6) : pick(r, [[0], [-3, 3], [-3.5], [3.5]]),
      count: 3 + Math.floor(r() * (2 + lvl * 3)),
      gap: round1(0.42 - lvl * 0.12 + r() * 0.1),
      m: r() < 0.25 + lvl * 0.2 ? 'both' : r() < 0.5 ? 1 : -1,
      amp: round1(1.6 + r() * 2),
      speed: round1(0.9 + lvl * 0.25 + r() * 0.15),
    }
  }
  const laneRow = (): GenGroup => {
    const n = 2 + Math.floor(r() * (2 + lvl * 2))
    const spread = 9 / Math.max(1, n - 1)
    return {
      type: pick(r, airTypes),
      path: pick(r, lanes.length ? lanes : ['dive']),
      x: Array.from({ length: n }, (_, i) => round1(-4.5 + i * spread)),
      amp: round1(2 + r() * 2),
      speed: round1(0.9 + lvl * 0.2),
    }
  }
  const heavy = (): GenGroup => ({
    type: 'heavy',
    path: pick(r, ['hover', 'figure8', 'dive', 'loop'] as PathId[]),
    x: r() < 0.5 ? 0 : [-3, 3],
    amp: 3,
  })
  const ground = (): GenGroup => {
    const roll = r()
    if (roll < 0.3) return { type: 'turret', path: 'static', x: r() < 0.5 ? [-4, 4] : [-5, 0, 5], y: round1(r() * 4) }
    if (roll < 0.6) return { type: 'tank', path: 'crossGround', count: 3 + Math.floor(lvl * 3), gap: 1, m: r() < 0.5 ? 1 : -1, y: round1(r() * 4) }
    return { type: 'tank', path: r() < 0.5 ? 'drive' : 'driveS', x: r() < 0.5 ? [-3.5, 3.5] : [-4.5, 0, 4.5], amp: 1.6 }
  }

  const generated = (): GenGroup[] => {
    const roll = r()
    const groups: GenGroup[] = []
    if (roll < 0.45) groups.push(train())
    else if (roll < 0.65) groups.push(laneRow())
    else if (roll < 0.8) groups.push(heavy(), { ...train(), count: 3, delay: 1.2 })
    else groups.push(ground())
    // Later stages stack a second formation on top more often
    if (r() < 0.2 + lvl * 0.45) groups.push({ ...(r() < 0.6 ? train() : laneRow()), delay: round1(0.8 + r() * 1.2) })
    return groups
  }

  // Authored waves keep their order, spaced evenly through the stage (first one opens it)
  const slots = new Map<number, GenGroup[]>()
  spec.authored.forEach((w, i) => slots.set(Math.round((i * (total - 1)) / Math.max(1, spec.authored.length)), w))
  const waves = Array.from({ length: total }, (_, i) => slots.get(i) ?? generated())

  // Guarantee every signature manoeuvre shows up at least twice: retarget generated trains
  const genIdx = waves.map((_, i) => i).filter((i) => !slots.has(i))
  for (const path of spec.signature) {
    let have = waves.flat().filter((g) => g.path === path).length
    for (const i of genIdx) {
      if (have >= 2) break
      const g = waves[i].find((x) => TRAIN_PATHS.includes(x.path) && !spec.signature.includes(x.path))
      if (g) { g.path = path; have++ }
    }
  }
  return waves
}
