import type { MaterialPalette } from './models'

export type AirRole = 'basic' | 'fast' | 'heavy' | 'shooter'
export type GroundRole = 'tank' | 'turret'
export type EnemyType = AirRole | GroundRole

export type ShotKind = 'none' | 'aimed' | 'spread3' | 'burst2' | 'down'

/** Base (stage-1) stats per role; stages scale HP / damage / fire rate on top. */
export const ROLE_STATS: Record<EnemyType, {
  hp: number; score: number; fire: number; shot: ShotKind; radius: number; ground: boolean; damage: number
}> = {
  basic: { hp: 30, score: 100, fire: 0, shot: 'down', radius: 0.7, ground: false, damage: 10 },
  fast: { hp: 18, score: 150, fire: 0, shot: 'none', radius: 0.62, ground: false, damage: 10 },
  heavy: { hp: 80, score: 300, fire: 1500, shot: 'spread3', radius: 0.85, ground: false, damage: 12 },
  shooter: { hp: 40, score: 200, fire: 1000, shot: 'aimed', radius: 0.7, ground: false, damage: 12 },
  tank: { hp: 60, score: 250, fire: 1700, shot: 'aimed', radius: 0.75, ground: true, damage: 14 },
  turret: { hp: 55, score: 220, fire: 1200, shot: 'burst2', radius: 0.7, ground: true, damage: 12 },
}

export const isGround = (t: EnemyType) => ROLE_STATS[t].ground

export interface AirSkin {
  model: string
  size: number
  palette?: MaterialPalette
  flame: string
  /** Number of exhaust plumes (1, 2 side by side). */
  flames: 1 | 2
}

export type Vehicle = 'tank' | 'boat' | 'hover'

export interface GroundSkin {
  vehicle: Vehicle
  hull: string
  turret: string
  accent: string
}
