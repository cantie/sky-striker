import type { Biome, EnemyType } from '../store/gameStore'

export type ObjectiveId =
  | 'finish'
  | 'destroy70'
  | 'destroy100'
  | 'untouched'
  | 'collectAll'
  | 'defeatBoss'

export interface StageObjective {
  id: ObjectiveId
  label: string
  icon: string
}

export interface WaveRow {
  type: EnemyType
  xs: number[]
  pattern: number
}

export interface StageConfig {
  id: number
  name: string
  subtitle: string
  difficulty: 'EASY' | 'NORMAL' | 'HARD'
  biome: Biome
  /** Number of wave index steps before stage end / boss. */
  maxWaves: number
  /** Wave timer interval (ms). Lower = denser. */
  waveInterval: number
  hasBoss: boolean
  bossHp: number
  /** Multiplier on enemy HP. */
  enemyHpMult: number
  /** Extra rows appended to each wave for density. */
  densityExtra: number
  objectives: StageObjective[]
  waves: WaveRow[][]
}

const OBJ = {
  finish: { id: 'finish' as const, label: 'FINISH THE STAGE', icon: '🏁' },
  destroy70: { id: 'destroy70' as const, label: 'DESTROY 70% OF ENEMY FORCES', icon: '💥' },
  destroy100: { id: 'destroy100' as const, label: 'DESTROY 100% OF ENEMY FORCES', icon: '☠️' },
  untouched: { id: 'untouched' as const, label: 'STAY UNTOUCHED', icon: '🛡️' },
  collectAll: { id: 'collectAll' as const, label: 'COLLECT ALL PICKUPS', icon: '💎' },
  defeatBoss: { id: 'defeatBoss' as const, label: 'DEFEAT THE BOSS', icon: '👹' },
}

/** Stage 1 — short coastal intro, jungle, no boss. */
const STAGE1_WAVES: WaveRow[][] = [
  [{ type: 'basic', xs: [-2, 0, 2], pattern: 0 }],
  [{ type: 'fast', xs: [-3, -1, 1, 3], pattern: 1 }],
  [{ type: 'basic', xs: [-2.5, 0, 2.5], pattern: 2 }],
  [{ type: 'shooter', xs: [-2, 2], pattern: 0 }],
  [{ type: 'basic', xs: [-3, -1, 1, 3], pattern: 0 }, { type: 'fast', xs: [0], pattern: 1 }],
  [{ type: 'heavy', xs: [0], pattern: 0 }, { type: 'basic', xs: [-2.5, 2.5], pattern: 2 }],
]

/** Stage 2 — denser desert push, mid-length, no boss. */
const STAGE2_WAVES: WaveRow[][] = [
  [{ type: 'basic', xs: [-2, 0, 2], pattern: 0 }, { type: 'fast', xs: [-3.5, 3.5], pattern: 1 }],
  [{ type: 'fast', xs: [-3, -1, 1, 3], pattern: 1 }],
  [{ type: 'shooter', xs: [-2.5, 0, 2.5], pattern: 2 }],
  [{ type: 'heavy', xs: [-1.5, 1.5], pattern: 0 }],
  [{ type: 'fast', xs: [-3.5, -1.5, 1.5, 3.5], pattern: 1 }, { type: 'shooter', xs: [-2, 2], pattern: 2 }],
  [{ type: 'basic', xs: [-3, -1, 1, 3], pattern: 0 }, { type: 'heavy', xs: [0], pattern: 0 }],
  [{ type: 'shooter', xs: [-3, 0, 3], pattern: 2 }, { type: 'fast', xs: [-1.5, 1.5], pattern: 1 }],
  [{ type: 'heavy', xs: [-2, 2], pattern: 0 }, { type: 'basic', xs: [-3.5, 0, 3.5], pattern: 0 }],
]

/** Stage 3 — tough approach then boss. */
const STAGE3_WAVES: WaveRow[][] = [
  [{ type: 'fast', xs: [-3, -1, 1, 3], pattern: 1 }, { type: 'shooter', xs: [0], pattern: 0 }],
  [{ type: 'heavy', xs: [-1.5, 1.5], pattern: 0 }, { type: 'fast', xs: [-3.5, 3.5], pattern: 1 }],
  [{ type: 'shooter', xs: [-2.5, 0, 2.5], pattern: 2 }, { type: 'basic', xs: [-3.5, 3.5], pattern: 0 }],
  [{ type: 'heavy', xs: [-2, 0, 2], pattern: 0 }],
  [{ type: 'fast', xs: [-3.5, -1.5, 1.5, 3.5], pattern: 1 }, { type: 'shooter', xs: [-2, 2], pattern: 2 }],
  [{ type: 'heavy', xs: [-2.5, 2.5], pattern: 0 }, { type: 'shooter', xs: [-1, 1], pattern: 0 }, { type: 'fast', xs: [0], pattern: 1 }],
]

export const STAGES: StageConfig[] = [
  {
    id: 1,
    name: 'STAGE 1',
    subtitle: 'Jungle Coast',
    difficulty: 'EASY',
    biome: 'jungle',
    maxWaves: 6,
    waveInterval: 3000,
    hasBoss: false,
    bossHp: 0,
    enemyHpMult: 0.85,
    densityExtra: 0,
    objectives: [OBJ.finish, OBJ.destroy70, OBJ.destroy100, OBJ.untouched, OBJ.collectAll],
    waves: STAGE1_WAVES,
  },
  {
    id: 2,
    name: 'STAGE 2',
    subtitle: 'Desert Storm',
    difficulty: 'NORMAL',
    biome: 'desert',
    maxWaves: 8,
    waveInterval: 2400,
    hasBoss: false,
    bossHp: 0,
    enemyHpMult: 1.05,
    densityExtra: 1,
    objectives: [OBJ.finish, OBJ.destroy70, OBJ.destroy100, OBJ.untouched, OBJ.collectAll],
    waves: STAGE2_WAVES,
  },
  {
    id: 3,
    name: 'STAGE 3',
    subtitle: 'Sky Fortress',
    difficulty: 'HARD',
    biome: 'desert',
    maxWaves: 6,
    waveInterval: 2200,
    hasBoss: true,
    bossHp: 1200,
    enemyHpMult: 1.2,
    densityExtra: 1,
    objectives: [OBJ.finish, OBJ.destroy70, OBJ.destroy100, OBJ.defeatBoss, OBJ.untouched, OBJ.collectAll],
    waves: STAGE3_WAVES,
  },
]

export function getStage(id: number): StageConfig {
  return STAGES.find((s) => s.id === id) ?? STAGES[0]
}

export const TOTAL_STAGES = STAGES.length
