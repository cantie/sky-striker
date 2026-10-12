import { getStage, type StageConfig } from '../stages'
import { ROLE_STATS, type EnemyType, type ShotKind } from '../roster'
import type { PathId, PathParams } from '../paths'
import { inWorld } from '../world'
import { NEVER_ENTERED_TIMEOUT, enemyPos, expandWave, params, posOnPath } from '../spawns'
import { STEP_GAME } from './clock'

/**
 * A whole stage flattened into the list of enemies it will spawn — what a co-op server needs to
 * know which enemies exist, when, with how much HP, and when they'd leave on their own.
 * All times are game seconds since the stage started (the shared stage clock).
 */
export interface ScriptedEnemy {
  id: string
  wave: number
  type: EnemyType
  path: PathId
  params: PathParams
  spawnT: number
  /** First moment it is inside the canonical world frame (can shoot / be hit); null = never. */
  enterT: number | null
  /** When it leaves the world (or times out without ever entering). */
  despawnT: number
  hp: number
  score: number
  coins: number
  shot: ShotKind
  /** Seconds between shots (game time); 0 = never shoots. */
  fireInterval: number
}

/** Lifetime of a unit, stepping exactly like the Enemies system does. */
function lifetime(spec: Parameters<typeof enemyPos>[0]): { enter: number | null; leave: number } {
  let entered: number | null = null
  for (let age = STEP_GAME; ; age += STEP_GAME) {
    const p = enemyPos(spec, age)
    if (entered === null && inWorld(p.x, p.y, -0.6)) entered = age
    if ((entered !== null && !inWorld(p.x, p.y, 2.5)) || (entered === null && age > NEVER_ENTERED_TIMEOUT)) {
      return { enter: entered, leave: age }
    }
  }
}

/** Where a scripted enemy is at stage time `T`. */
export function scriptedPos(e: ScriptedEnemy, T: number): { x: number; y: number } {
  return posOnPath(e.path, e.params, T - e.spawnT)
}

export function stageScript(stage: StageConfig, easy = false): ScriptedEnemy[] {
  const out: ScriptedEnemy[] = []
  for (let w = 0; w < stage.maxWaves; w++) {
    const start = (w * stage.waveInterval) / 1000
    for (const q of expandWave(stage, w, start, easy)) {
      const e = q.spec
      const role = ROLE_STATS[e.type]
      const life = lifetime(e)
      const fireMs = e.type === 'basic' ? stage.basicFire : role.fire
      out.push({
        id: e.id, wave: w, type: e.type, path: e.path, params: params(e),
        spawnT: q.at,
        enterT: life.enter === null ? null : q.at + life.enter,
        despawnT: q.at + life.leave,
        hp: e.hp, score: role.score, coins: role.coins, shot: role.shot,
        fireInterval: role.shot === 'none' || fireMs <= 0 ? 0 : fireMs / stage.fireRateMult / 1000,
      })
    }
  }
  return out
}

const byStage = new Map<number, Map<string, ScriptedEnemy>>()

/** The stage script indexed by enemy id (memoized) — where a server-named enemy is at a given time. */
export function scriptById(stageId: number): Map<string, ScriptedEnemy> {
  let m = byStage.get(stageId)
  if (!m) {
    m = new Map(stageScript(getStage(stageId)).map((e) => [e.id, e]))
    byStage.set(stageId, m)
  }
  return m
}
