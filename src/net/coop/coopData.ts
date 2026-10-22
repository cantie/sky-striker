import { STAGES, type StageConfig } from '../../game/stages'
import { PLANES } from '../../game/planes'
import { MAX_WEAPON_POWER, weaponStats } from '../../game/weapon'
import { GAME_SPEED } from '../../game/speed'
import { DROP_CHANCE, DROP_WEIGHTS, MAX_HEALTH, MAX_POWERUPS, MAX_SHIELDS } from '../../game/dropRules'
import { BOSS_SCORE, POD_SCORE, RESCUE_SCORE } from '../../game/scoring'
import { hashSeed } from '../../game/sim/rng'
import { stageScript, type ScriptedEnemy } from '../../game/sim/stageScript'
import type { ShotKind } from '../../game/roster'
import type { PickupType } from '../../store/gameStore'

/**
 * What the co-op server needs to know about the campaign, flattened from the stage configs:
 * which enemies exist, when they are on screen, their HP and score, how they shoot — plus the
 * rule constants. Generated into nakama/modules/skystriker_data.lua (`npm run gen:coop`); the
 * client sends `version` when joining so a stale server refuses instead of desyncing.
 */
export interface CoopEnemy {
  id: string
  wave: number
  spawnT: number
  /** null = never enters the world (can't be hit). */
  enterT: number | null
  despawnT: number
  hp: number
  score: number
  shot: ShotKind
  fireInterval: number
}
export interface CoopStage { id: number; bossHp: number; waves: number; enemies: CoopEnemy[] }
export interface CoopRules {
  gameSpeed: number
  countdownMs: number
  bossWarningMs: number
  stageClearMs: number
  bossTargetSwapMs: number
  reviveHp: number
  reviveRadius: number
  dpsCapMult: number
  dropChance: number
  dropWeights: { health: number; powerup: number; shield: number }
  maxPowerups: number
  maxShields: number
  maxHealth: number
}
export interface CoopData {
  version: string
  /** Strongest cannon on the best plane, damage per game-second. */
  maxDps: number
  bossScore: number
  rescueScore: number
  podScore: number
  rules: CoopRules
  stages: CoopStage[]
}

export const COUNTDOWN_MS = 3000
export const BOSS_WARNING_MS = 2200
/** Victory window (5 s) + fly-out + the stage-clear card. */
export const STAGE_CLEAR_MS = 7000
export const BOSS_TARGET_SWAP_MS = 6000
export const REVIVE_HP = 2
export const REVIVE_RADIUS = 1.8
export const REVIVE_SECONDS = 2.5
/** Allowed damage per player = maxDps × this (skills, pierce and wingmen stay well inside). */
export const DPS_CAP_MULT = 3

export const RULES: CoopRules = {
  gameSpeed: GAME_SPEED,
  countdownMs: COUNTDOWN_MS,
  bossWarningMs: BOSS_WARNING_MS,
  stageClearMs: STAGE_CLEAR_MS,
  bossTargetSwapMs: BOSS_TARGET_SWAP_MS,
  reviveHp: REVIVE_HP,
  reviveRadius: REVIVE_RADIUS,
  dpsCapMult: DPS_CAP_MULT,
  dropChance: DROP_CHANCE,
  dropWeights: DROP_WEIGHTS,
  maxPowerups: MAX_POWERUPS,
  maxShields: MAX_SHIELDS,
  maxHealth: MAX_HEALTH,
}

const r4 = (n: number) => Math.round(n * 1e4) / 1e4

export function maxDps(): number {
  const w = weaponStats(MAX_WEAPON_POWER)
  const best = Math.max(...PLANES.map((p) => p.damage / p.fireRate))
  return (w.damage * w.streams.length * best * 1000) / w.interval
}

const toCoopEnemy = (e: ScriptedEnemy): CoopEnemy => ({
  id: e.id, wave: e.wave, spawnT: r4(e.spawnT), enterT: e.enterT === null ? null : r4(e.enterT),
  despawnT: r4(e.despawnT), hp: e.hp, score: e.score, shot: e.shot, fireInterval: r4(e.fireInterval),
})

export function buildCoopData(stages: StageConfig[] = STAGES): CoopData {
  const body = {
    maxDps: r4(maxDps()),
    bossScore: BOSS_SCORE,
    rescueScore: RESCUE_SCORE,
    podScore: POD_SCORE,
    rules: RULES,
    stages: stages.map((s) => ({ id: s.id, bossHp: s.bossHp || 1000, waves: s.maxWaves, enemies: stageScript(s).map(toCoopEnemy) })),
  }
  return { version: hashSeed(0, JSON.stringify(body)).toString(16).padStart(8, '0'), ...body }
}

let cached: CoopData | null = null
/** The campaign's co-op data (built once, ~1.7k enemies). */
export const coopData = (): CoopData => (cached ??= buildCoopData())

/** Survivors / star pods the Enemies system spawns on its own, by id (see Enemies.tsx). */
export function scriptedPickupKind(id: string, waves: number): PickupType | null {
  if (id === 'rescue:start0' || id === 'rescue:start1') return 'rescue'
  let m = /^rescue:w(\d+)$/.exec(id)
  if (m) { const k = Number(m[1]); return k < waves && k % 3 === 1 ? 'rescue' : null }
  m = /^pod:w(\d+)$/.exec(id)
  if (m) { const k = Number(m[1]); return k < waves && k > 0 && k % 4 === 0 ? 'star' : null }
  return null
}

function luaValue(v: unknown): string {
  if (v === null || v === undefined) return 'nil'
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (typeof v === 'string') return JSON.stringify(v)
  if (Array.isArray(v)) return `{${v.map(luaValue).join(',')}}`
  return `{${fields(v as Record<string, unknown>)}}`
}
const fields = (o: Record<string, unknown>) =>
  Object.entries(o).filter(([, x]) => x !== null && x !== undefined).map(([k, x]) => `${k}=${luaValue(x)}`).join(',')

/** The data as a Lua module (`return {...}`), one enemy per line. */
export function toLua(data: CoopData): string {
  const { stages, ...top } = data
  const stageLua = stages.map(({ enemies, ...s }) =>
    `  {${fields(s)},enemies={\n${enemies.map((e) => `    ${luaValue(e)}`).join(',\n')}\n  }}`)
  return [
    '-- GENERATED by sky-striker `npm run gen:coop` from the game\'s stage configs. Do not edit.',
    `-- Data version ${data.version}: clients built from other stage data are refused.`,
    `return {${fields(top)},stages={`,
    stageLua.join(',\n'),
    '}}',
    '',
  ].join('\n')
}
