import type { Enemy } from '../store/gameStore'
import type { StageConfig } from './stages'
import { ROLE_STATS } from './roster'
import { GROUND_PATHS, pathPos, type PathParams } from './paths'
import { GROUND_SPEED } from './world'

/**
 * Turning a stage's wave script into concrete enemy spawns. Pure (no React/three), so the same
 * code can run in the browser, in tests and on a game server.
 */

/** Drop units that never made it on screen instead of leaking them (game seconds). */
export const NEVER_ENTERED_TIMEOUT = 16

export type EnemySpec = Omit<Enemy, 'id'> & { id: string }
export type Queued = { at: number; spec: EnemySpec }

export function params(e: Pick<Enemy, 'px' | 'py' | 'm' | 'amp' | 'spd'>): PathParams {
  return { x: e.px, y: e.py, m: e.m, a: e.amp, s: e.spd }
}

/** Where an enemy is `age` game-seconds after spawning (ground units also ride the terrain scroll). */
export function enemyPos(e: Pick<Enemy, 'path' | 'px' | 'py' | 'm' | 'amp' | 'spd'>, age: number): { x: number; y: number } {
  return posOnPath(e.path, params(e), age)
}

export function posOnPath(path: Enemy['path'], pr: PathParams, age: number): { x: number; y: number } {
  const p = pathPos(path, age, pr)
  return { x: p.x, y: GROUND_PATHS.has(path) ? p.y - age * GROUND_SPEED : p.y }
}

/** Stable enemy id: wave, group and unit index — identical on every client. */
export const enemyId = (wave: number, group: number, unit: number) => `w${wave}.g${group}.u${unit}`

/** HP an enemy of a group gets on this stage. */
export function enemyHp(stage: StageConfig, type: Enemy['type'], easy: boolean): number {
  return Math.max(8, Math.floor(ROLE_STATS[type].hp * stage.enemyHpMult * (easy ? 0.75 : 1)))
}

/** Expand a scripted wave into timed spawns (trains, mirrored twins, multiple lanes); `now` in game s. */
export function expandWave(stage: StageConfig, index: number, now: number, easy: boolean): Queued[] {
  const wave = stage.waves[index]
  if (!wave) return []
  const out: Queued[] = []
  wave.forEach((g, gi) => {
    let unit = 0
    const lanes = Array.isArray(g.x) ? g.x : [g.x ?? 0]
    const sides: (1 | -1)[] = g.m === 'both' ? [1, -1] : [g.m ?? 1]
    const hp = enemyHp(stage, g.type, easy)
    for (const m of sides) {
      for (const lane of lanes) {
        for (let i = 0; i < (g.count ?? 1); i++) {
          out.push({
            at: now + (g.delay ?? 0) + i * (g.gap ?? 0.45),
            spec: {
              id: enemyId(index, gi, unit++),
              x: 0, y: 99, z: 0, type: g.type, hp, maxHp: hp, lastShot: 0, age: 0,
              path: g.path, px: g.m === 'both' && m === -1 ? -lane : lane, py: g.y ?? 0,
              m, amp: g.amp ?? 2, spd: g.speed ?? 1,
              groundDist: 0, entered: false, heading: Math.PI, aim: Math.PI,
            },
          })
        }
      }
    }
  })
  return out
}
