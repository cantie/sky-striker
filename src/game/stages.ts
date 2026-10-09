import type { Biome } from './biomes'
import type { BossId } from './bosses'
import type { PathId } from './paths'
import { MODEL_PATHS as M, kenneyLivery as kl, quatLivery as ql } from './models'
import type { AirRole, AirSkin, EnemyType, GroundSkin } from './roster'

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

/** One scripted formation: `count` units follow `path` one after another, `gap` game-seconds apart. */
export interface SpawnGroup {
  type: EnemyType
  path: PathId
  /** Lane anchor(s); an array spawns one train per lane. */
  x?: number | number[]
  y?: number
  count?: number
  gap?: number
  /** Side the path enters from (+1 / −1); 'both' spawns a mirrored twin train. */
  m?: 1 | -1 | 'both'
  amp?: number
  speed?: number
  /** Offset (game-seconds) of this group inside its wave. */
  delay?: number
}

export type Difficulty = 'EASY' | 'NORMAL' | 'HARD' | 'EXPERT' | 'INSANE'

export interface StageConfig {
  id: number
  name: string
  subtitle: string
  difficulty: Difficulty
  biome: Biome
  /** Number of wave steps before the boss. */
  maxWaves: number
  /** Wave timer interval (game ms). Lower = denser. */
  waveInterval: number
  hasBoss: boolean
  boss: BossId
  bossHp: number
  /** Multiplier on enemy & boss HP. */
  enemyHpMult: number
  bulletSpeedMult: number
  /** >1 fires more often. */
  fireRateMult: number
  /** Fire interval for basic fighters (ms); 0 = they don't shoot. */
  basicFire: number
  skins: Record<AirRole, AirSkin>
  ground: GroundSkin
  objectives: StageObjective[]
  waves: SpawnGroup[][]
}

const OBJ = {
  finish: { id: 'finish' as const, label: 'FINISH THE STAGE', icon: '🏁' },
  destroy70: { id: 'destroy70' as const, label: 'DESTROY 70% OF ENEMY FORCES', icon: '💥' },
  destroy100: { id: 'destroy100' as const, label: 'DESTROY 100% OF ENEMY FORCES', icon: '☠️' },
  untouched: { id: 'untouched' as const, label: 'STAY UNTOUCHED', icon: '🛡️' },
  collectAll: { id: 'collectAll' as const, label: 'COLLECT ALL PICKUPS', icon: '💎' },
  defeatBoss: { id: 'defeatBoss' as const, label: 'DEFEAT THE BOSS', icon: '👹' },
}
const OBJECTIVES = [OBJ.finish, OBJ.destroy70, OBJ.destroy100, OBJ.defeatBoss, OBJ.untouched, OBJ.collectAll]

const G = (type: EnemyType, path: PathId, o: Omit<SpawnGroup, 'type' | 'path'> = {}): SpawnGroup => ({ type, path, ...o })

const air = (model: string, size: number, palette: AirSkin['palette'], flame: string, flames: 1 | 2 = 1): AirSkin => ({ model, size, palette, flame, flames })

type StageDef = Omit<StageConfig, 'maxWaves' | 'hasBoss' | 'objectives'>

const DEFS: StageDef[] = [
  {
    id: 1, name: 'STAGE 1', subtitle: 'Jungle Coast', difficulty: 'EASY', biome: 'jungle',
    waveInterval: 3200, boss: 'vulture', bossHp: 1500,
    enemyHpMult: 0.85, bulletSpeedMult: 1, fireRateMult: 0.9, basicFire: 0,
    skins: {
      basic: air(M.speederA, 1.25, kl('#c9cbd2', '#c0242f', '#2a1216', '#ff3b2f'), '#ff6a3d'),
      fast: air(M.racer, 1.15, kl('#f3e7c6', '#e88a0c', '#2b1b08', '#ffd23f'), '#ffcf4a'),
      heavy: air(M.cargoA, 1.85, kl('#8e88a8', '#4b2a7a', '#1b1428', '#c04dff'), '#c46bff', 2),
      shooter: air(M.speederB, 1.35, kl('#dcd2d4', '#7c1032', '#230a13', '#ff2a6a'), '#ff3f7a', 2),
    },
    ground: { vehicle: 'tank', hull: '#5d6b3a', turret: '#46522a', accent: '#ff5a2a' },
    waves: [
      [G('basic', 'dive', { x: [-3, 0, 3] })],
      [G('fast', 'sine', { x: -1.5, count: 4, gap: 0.5, amp: 2.2 })],
      [G('tank', 'drive', { x: [-3.5, 3.5] })],
      [G('basic', 'arc', { count: 5, gap: 0.45 })],
      [G('shooter', 'hover', { x: [-3, 3] })],
      [G('basic', 'swoop', { count: 4, gap: 0.45, m: 'both' })],
      [G('heavy', 'dive', { x: 0 }), G('tank', 'driveS', { x: [-4, 4], amp: 1.5 })],
      [G('fast', 'zigzag', { x: [-3, 3], count: 3, gap: 0.55, amp: 2.5 })],
    ],
  },
  {
    id: 2, name: 'STAGE 2', subtitle: 'Desert Storm', difficulty: 'EASY', biome: 'desert',
    waveInterval: 3000, boss: 'crawler', bossHp: 2000,
    enemyHpMult: 1, bulletSpeedMult: 1.04, fireRateMult: 1, basicFire: 0,
    skins: {
      basic: air(M.speederC, 1.3, kl('#e2c48a', '#9a5a22', '#2a1a0a', '#ff8a2a'), '#ffa040', 2),
      fast: air(M.racer, 1.15, kl('#d8b070', '#b03a1a', '#2a120a', '#ffcf4a'), '#ffcf4a'),
      heavy: air(M.cargoB, 1.85, kl('#c8a46a', '#6a4a24', '#1e140a', '#ff6a2a'), '#ff8a3d', 2),
      shooter: air(M.speederA, 1.35, kl('#c9a46a', '#6b4a2a', '#20140a', '#ff4a2a'), '#ff7a3d'),
    },
    ground: { vehicle: 'tank', hull: '#b8955a', turret: '#8a6a3a', accent: '#ff7a2a' },
    waves: [
      [G('basic', 'sine', { x: [-3, 3], count: 3, gap: 0.5, amp: 1.6 })],
      [G('tank', 'crossGround', { count: 3, gap: 1.1 })],
      [G('fast', 'pincer', { count: 3, gap: 0.4, m: 'both' })],
      [G('turret', 'static', { x: [-4, 0, 4] })],
      [G('shooter', 'hover', { x: [-2.5, 2.5] }), G('tank', 'drive', { x: 0 })],
      [G('basic', 'uturn', { x: [-3, 3], count: 3, gap: 0.5 })],
      [G('heavy', 'zigzag', { x: 0, amp: 2 }), G('fast', 'dive', { x: [-5, 5] })],
      [G('tank', 'driveS', { x: [-4, 0, 4], amp: 1.2 }), G('turret', 'static', { x: [-5.5, 5.5], y: 4 })],
    ],
  },
  {
    id: 3, name: 'STAGE 3', subtitle: 'Coral Archipelago', difficulty: 'NORMAL', biome: 'ocean',
    waveInterval: 2900, boss: 'galleon', bossHp: 2600,
    enemyHpMult: 1.15, bulletSpeedMult: 1.08, fireRateMult: 1.05, basicFire: 0,
    skins: {
      basic: air(M.ship7, 1.35, ql('#dfe6f0', '#1d2a4a', '#2a8cff', '#2a8cff'), '#5ab4ff'),
      fast: air(M.speederC, 1.2, kl('#e8f4f4', '#14a0a0', '#0a2424', '#4affe0'), '#4affe0', 2),
      heavy: air(M.ship2, 1.9, ql('#d8e2ee', '#1a2c4a', '#ff4a4a', '#ff4a4a'), '#ff6a5a', 2),
      shooter: air(M.speederB, 1.35, kl('#e6ecf4', '#1f3a7a', '#0a1430', '#ff3a4a'), '#ff5a6a', 2),
    },
    ground: { vehicle: 'boat', hull: '#d8dde6', turret: '#4a5468', accent: '#ff3a3a' },
    waves: [
      [G('basic', 'snake', { x: 0, count: 5, gap: 0.4, amp: 3 })],
      [G('tank', 'driveS', { x: [-4, 4], amp: 2 })],
      [G('fast', 'cross', { count: 4, gap: 0.45 }), G('fast', 'cross', { m: -1, y: -4, count: 4, gap: 0.45, delay: 1.2 })],
      [G('shooter', 'loop', { x: [-3, 3] })],
      [G('turret', 'static', { x: [-3.5, 3.5] }), G('basic', 'dive', { x: 0, count: 3, gap: 0.5 })],
      [G('heavy', 'hover', { x: 0 }), G('tank', 'crossGround', { m: -1, count: 3, gap: 1.2 })],
      [G('basic', 'spiral', { x: [-3, 3], count: 3, gap: 0.6 })],
      [G('fast', 'swoop', { count: 5, gap: 0.35, m: 'both' })],
    ],
  },
  {
    id: 4, name: 'STAGE 4', subtitle: 'Ember Woods', difficulty: 'NORMAL', biome: 'autumn',
    waveInterval: 2800, boss: 'hornet', bossHp: 3200,
    enemyHpMult: 1.3, bulletSpeedMult: 1.12, fireRateMult: 1.1, basicFire: 0,
    skins: {
      basic: air(M.ship3, 1.35, ql('#e8d6c0', '#3a1a10', '#ff6a1a', '#ff4a10'), '#ff8a3d', 2),
      fast: air(M.racer, 1.15, kl('#2a1a14', '#c0242f', '#120a08', '#ff4a1a'), '#ff5a2a'),
      heavy: air(M.miner, 1.85, kl('#c08a4a', '#6a3a1a', '#1e100a', '#ffb02e'), '#ffb02e', 2),
      shooter: air(M.speederC, 1.35, kl('#f0d8b0', '#d0601a', '#2a140a', '#ff7a1a'), '#ff9a3d', 2),
    },
    ground: { vehicle: 'tank', hull: '#7a4a2a', turret: '#5a3218', accent: '#ffb02e' },
    waves: [
      [G('basic', 'zigzag', { x: [-3, 3], count: 3, gap: 0.5, amp: 2 })],
      [G('fast', 'arc', { count: 6, gap: 0.3 })],
      [G('tank', 'drive', { x: [-4, -1.5, 1.5, 4] })],
      [G('shooter', 'figure8', { x: 0, amp: 4 })],
      [G('basic', 'loop', { x: [-4, 0, 4] })],
      [G('heavy', 'dive', { x: [-3, 3] }), G('fast', 'pincer', { count: 3, gap: 0.4, m: 'both', delay: 1 })],
      [G('turret', 'static', { x: [-4, 4] }), G('tank', 'driveS', { x: 0, amp: 2 })],
      [G('shooter', 'hover', { x: [-4, 0, 4] })],
    ],
  },
  {
    id: 5, name: 'STAGE 5', subtitle: 'Frozen Frontier', difficulty: 'HARD', biome: 'arctic',
    waveInterval: 2700, boss: 'warden', bossHp: 3900,
    enemyHpMult: 1.5, bulletSpeedMult: 1.16, fireRateMult: 1.15, basicFire: 2800,
    skins: {
      basic: air(M.speederA, 1.25, kl('#f2f8ff', '#3a7ab8', '#0e1e2e', '#45c8ff'), '#7fe0ff'),
      fast: air(M.ship4, 1.4, ql('#eef6ff', '#1a3a5a', '#45c8ff', '#45c8ff'), '#9be8ff'),
      heavy: air(M.cargoA, 1.85, kl('#b8c8d8', '#2a4a6a', '#0e1a26', '#7fdcff'), '#7fe0ff', 2),
      shooter: air(M.ship7, 1.4, ql('#ffffff', '#2a4a7a', '#ff3a6a', '#ff3a6a'), '#ff7a9a'),
    },
    ground: { vehicle: 'tank', hull: '#dfe7ee', turret: '#9aa8b4', accent: '#45c8ff' },
    waves: [
      [G('fast', 'spiral', { x: [-3, 3], count: 3, gap: 0.5 })],
      [G('tank', 'crossGround', { count: 4, gap: 1 }), G('tank', 'crossGround', { m: -1, y: 5, count: 4, gap: 1 })],
      [G('basic', 'swoop', { count: 5, gap: 0.35, m: 'both' })],
      [G('heavy', 'hover', { x: [-3, 3] })],
      [G('shooter', 'uturn', { x: [-4, 4], count: 2, gap: 0.6 })],
      [G('turret', 'static', { x: [-4.5, -1.5, 1.5, 4.5] })],
      [G('fast', 'snake', { x: 0, count: 6, gap: 0.3, amp: 3.5 })],
      [G('basic', 'figure8', { x: [-2, 2], amp: 3 }), G('tank', 'drive', { x: [-5, 5] })],
      [G('heavy', 'zigzag', { x: 0, amp: 3 }), G('shooter', 'dive', { x: [-4, 4] })],
    ],
  },
  {
    id: 6, name: 'STAGE 6', subtitle: 'Red Canyon', difficulty: 'HARD', biome: 'canyon',
    waveInterval: 2600, boss: 'breaker', bossHp: 4600,
    enemyHpMult: 1.7, bulletSpeedMult: 1.2, fireRateMult: 1.2, basicFire: 2600,
    skins: {
      basic: air(M.speederB, 1.3, kl('#d08a5a', '#7a2a14', '#24100a', '#ffb02e'), '#ffb02e', 2),
      fast: air(M.racer, 1.15, kl('#24140e', '#d02a1a', '#0a0604', '#ff3a1a'), '#ff4a2a'),
      heavy: air(M.miner, 1.9, kl('#9a5a3a', '#4a2414', '#160a06', '#ff7a2a'), '#ff8a3d', 2),
      shooter: air(M.ship6, 1.45, ql('#e0a080', '#2a0e06', undefined, '#ff5a1a'), '#ff7a3d', 2),
    },
    ground: { vehicle: 'tank', hull: '#9a4a2a', turret: '#6a2e18', accent: '#ffcf4a' },
    waves: [
      [G('basic', 'pincer', { count: 4, gap: 0.35, m: 'both' })],
      [G('tank', 'driveS', { x: [-3, 3], amp: 2 }), G('turret', 'static', { x: 0, y: 3 })],
      [G('fast', 'loop', { x: [-4, 0, 4] })],
      [G('shooter', 'arc', { m: -1, count: 4, gap: 0.5 })],
      [G('heavy', 'figure8', { x: 0, amp: 4 }), G('basic', 'dive', { x: [-5, 5], count: 2, gap: 0.6 })],
      [G('tank', 'crossGround', { count: 3, gap: 1 }), G('tank', 'crossGround', { m: -1, y: 6, count: 3, gap: 1 })],
      [G('fast', 'zigzag', { x: [-4, 0, 4], count: 2, gap: 0.5, amp: 2 })],
      [G('shooter', 'hover', { x: [-4, 0, 4] }), G('heavy', 'dive', { x: 0, delay: 1.5 })],
      [G('basic', 'spiral', { x: [-3, 3], count: 4, gap: 0.5 })],
    ],
  },
  {
    id: 7, name: 'STAGE 7', subtitle: 'Murk Marshes', difficulty: 'EXPERT', biome: 'swamp',
    waveInterval: 2500, boss: 'wraith', bossHp: 5400,
    enemyHpMult: 1.9, bulletSpeedMult: 1.24, fireRateMult: 1.25, basicFire: 2400,
    skins: {
      basic: air(M.ship4, 1.4, ql('#5a7a4a', '#0e1a10', '#9bff5a', '#6aff3a'), '#9bff5a'),
      fast: air(M.speederC, 1.2, kl('#3a4a2a', '#8aff2a', '#0a1006', '#c8ff3a'), '#c8ff3a', 2),
      heavy: air(M.cargoB, 1.9, kl('#4a5a3a', '#2a3a1a', '#0a1006', '#6aff3a'), '#9bff5a', 2),
      shooter: air(M.ship2, 1.45, ql('#6a7a5a', '#141e10', '#d0ff4a', '#a8ff3a'), '#d0ff4a', 2),
    },
    ground: { vehicle: 'hover', hull: '#4a5a34', turret: '#2a3a1c', accent: '#9bff5a' },
    waves: [
      [G('basic', 'snake', { x: [-3, 3], count: 4, gap: 0.4, amp: 2.5 })],
      [G('tank', 'driveS', { x: [-4, 0, 4], amp: 2.2 })],
      [G('fast', 'cross', { count: 5, gap: 0.35 }), G('fast', 'cross', { m: -1, y: -5, count: 5, gap: 0.35, delay: 0.8 })],
      [G('shooter', 'loop', { x: [-4, 4] }), G('turret', 'static', { x: 0 })],
      [G('heavy', 'uturn', { x: [-3, 3] })],
      [G('basic', 'arc', { count: 6, gap: 0.3 }), G('basic', 'arc', { m: -1, y: -4, count: 6, gap: 0.3, delay: 0.9 })],
      [G('turret', 'static', { x: [-5, -2, 2, 5] }), G('shooter', 'dive', { x: 0, count: 3, gap: 0.6 })],
      [G('fast', 'swoop', { count: 6, gap: 0.3, m: 'both' })],
      [G('heavy', 'hover', { x: [-4, 4] }), G('tank', 'drive', { x: [-2, 2] })],
    ],
  },
  {
    id: 8, name: 'STAGE 8', subtitle: 'Neon Metropolis', difficulty: 'EXPERT', biome: 'city',
    waveInterval: 2400, boss: 'hive', bossHp: 6200,
    enemyHpMult: 2.15, bulletSpeedMult: 1.28, fireRateMult: 1.3, basicFire: 2200,
    skins: {
      basic: air(M.speederA, 1.25, kl('#2a2a3a', '#ff2ab8', '#0a0a14', '#ff2ab8', 1.8), '#ff4ad8'),
      fast: air(M.racer, 1.15, kl('#1a2a3a', '#2af0ff', '#06101a', '#2af0ff', 1.8), '#4af0ff'),
      heavy: air(M.cargoA, 1.85, kl('#2a2a2a', '#ffd21a', '#0a0a0a', '#ffd21a', 1.6), '#ffe04a', 2),
      shooter: air(M.ship5, 1.45, ql('#ff9ae0', '#1a0a1a', undefined, '#ff2ab8'), '#ff4ad8', 2),
    },
    ground: { vehicle: 'tank', hull: '#3a3e48', turret: '#24262e', accent: '#2af0ff' },
    waves: [
      [G('fast', 'pincer', { count: 5, gap: 0.3, m: 'both' })],
      [G('tank', 'drive', { x: [-4.5, -1.5, 1.5, 4.5] })],
      [G('shooter', 'figure8', { x: [-2, 2], amp: 3 })],
      [G('basic', 'spiral', { x: [-4, 0, 4], count: 3, gap: 0.5 })],
      [G('heavy', 'hover', { x: 0 }), G('turret', 'static', { x: [-4, 4], y: 2 })],
      [G('fast', 'snake', { x: [-3, 3], count: 5, gap: 0.3, amp: 2.5 })],
      [G('tank', 'crossGround', { count: 4, gap: 0.9 }), G('shooter', 'arc', { m: -1, count: 3, gap: 0.6 })],
      [G('basic', 'loop', { x: [-4, -1.3, 1.3, 4] })],
      [G('heavy', 'dive', { x: [-3, 3] }), G('fast', 'zigzag', { x: 0, count: 4, gap: 0.4, amp: 3 })],
      [G('shooter', 'hover', { x: [-4, 0, 4] })],
    ],
  },
  {
    id: 9, name: 'STAGE 9', subtitle: 'Magma Rift', difficulty: 'INSANE', biome: 'volcano',
    waveInterval: 2300, boss: 'leviathan', bossHp: 7100,
    enemyHpMult: 2.4, bulletSpeedMult: 1.32, fireRateMult: 1.35, basicFire: 2000,
    skins: {
      basic: air(M.ship6, 1.4, ql('#3a2a26', '#120604', undefined, '#ff4a10'), '#ff6a2a', 2),
      fast: air(M.speederC, 1.2, kl('#1e1614', '#ff5a10', '#080404', '#ff7a1a', 1.8), '#ff8a3d', 2),
      heavy: air(M.miner, 1.9, kl('#2e2622', '#1a1210', '#060404', '#ff4a10', 1.8), '#ff5a1f', 2),
      shooter: air(M.ship1, 1.5, ql('#8a3a2a', '#1a0604', undefined, '#ff3a00'), '#ff5a1f', 2),
    },
    ground: { vehicle: 'tank', hull: '#2e2a28', turret: '#1a1716', accent: '#ff5a1a' },
    waves: [
      [G('basic', 'swoop', { count: 6, gap: 0.3, m: 'both' })],
      [G('tank', 'driveS', { x: [-4, 0, 4], amp: 1.6 }), G('turret', 'static', { x: [-5.5, 5.5], y: 3 })],
      [G('fast', 'spiral', { x: [-4, 0, 4], count: 3, gap: 0.45 })],
      [G('heavy', 'figure8', { x: [-2, 2], amp: 3 })],
      [G('shooter', 'uturn', { x: [-4, 0, 4], count: 2, gap: 0.6 })],
      [G('basic', 'arc', { count: 6, gap: 0.3 }), G('basic', 'arc', { m: -1, y: -4, count: 6, gap: 0.3, delay: 0.9 })],
      [G('tank', 'crossGround', { count: 4, gap: 0.9 }), G('tank', 'crossGround', { m: -1, y: 5, count: 4, gap: 0.9 })],
      [G('fast', 'loop', { x: [-4, -1.3, 1.3, 4] })],
      [G('heavy', 'hover', { x: [-4, 0, 4] })],
      [G('shooter', 'snake', { x: 0, count: 6, gap: 0.35, amp: 3.5 })],
    ],
  },
  {
    id: 10, name: 'STAGE 10', subtitle: 'Iron Citadel', difficulty: 'INSANE', biome: 'fortress',
    waveInterval: 2200, boss: 'citadel', bossHp: 8000,
    enemyHpMult: 2.7, bulletSpeedMult: 1.36, fireRateMult: 1.4, basicFire: 1800,
    skins: {
      basic: air(M.ship7, 1.35, ql('#8a92a4', '#14161c', '#ff1a3a', '#ff1a3a'), '#ff3a5a'),
      fast: air(M.ship4, 1.4, ql('#9aa2b4', '#101218', '#ff1a3a', '#ff1a3a'), '#ff5a7a'),
      heavy: air(M.cargoB, 1.95, kl('#3a3e48', '#a01a2a', '#0a0a0e', '#ff1a3a', 1.6), '#ff3a5a', 2),
      shooter: air(M.ship3, 1.45, ql('#a7afc2', '#14161c', '#ff1a3a', '#ff1a3a'), '#ff3a5a', 2),
    },
    ground: { vehicle: 'tank', hull: '#4a505c', turret: '#2a2e36', accent: '#ff1a3a' },
    waves: [
      [G('fast', 'pincer', { count: 6, gap: 0.3, m: 'both' })],
      [G('turret', 'static', { x: [-5, -2.5, 0, 2.5, 5] })],
      [G('shooter', 'spiral', { x: [-3, 3], count: 3, gap: 0.5 })],
      [G('heavy', 'loop', { x: [-3, 3] }), G('basic', 'dive', { x: 0, count: 4, gap: 0.4 })],
      [G('tank', 'driveS', { x: [-4, -1.3, 1.3, 4], amp: 1.4 })],
      [G('basic', 'figure8', { x: [-3, 0, 3], amp: 2.5 })],
      [G('fast', 'swoop', { count: 7, gap: 0.28, m: 'both' })],
      [G('heavy', 'hover', { x: [-4, 0, 4] }), G('turret', 'static', { x: [-5.5, 5.5], y: 4 })],
      [G('shooter', 'arc', { count: 5, gap: 0.4 }), G('shooter', 'arc', { m: -1, y: -4, count: 5, gap: 0.4, delay: 1 })],
      [G('tank', 'crossGround', { count: 5, gap: 0.8 }), G('tank', 'crossGround', { m: -1, y: 5, count: 5, gap: 0.8 })],
      [G('basic', 'snake', { x: [-3.5, 3.5], count: 6, gap: 0.3, amp: 2.5 })],
    ],
  },
]

export const STAGES: StageConfig[] = DEFS.map((d) => ({
  ...d,
  maxWaves: d.waves.length,
  hasBoss: true,
  objectives: OBJECTIVES,
}))

export function getStage(id: number): StageConfig {
  return STAGES.find((s) => s.id === id) ?? STAGES[0]
}

export const TOTAL_STAGES = STAGES.length
