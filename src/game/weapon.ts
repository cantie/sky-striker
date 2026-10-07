/**
 * Player weapon progression: LEVELS × TIERS steps, stored as one `power` index (0 = weakest).
 * - Level adds bullet streams (spread pattern).
 * - Tier (1–4) within a level only speeds up fire, adds damage and grows the bolts.
 * Each power-up pickup advances one tier; tier 4 → next level, tier 1.
 */
export const WEAPON_LEVELS = 5
export const WEAPON_TIERS = 4
export const MAX_WEAPON_POWER = WEAPON_LEVELS * WEAPON_TIERS - 1

export interface WeaponStats {
  level: number
  tier: number
  /** Game-ms between volleys. */
  interval: number
  damage: number
  /** Bolt radius (hit size and visual size). */
  radius: number
  /** Stream offsets / sideways drift for one volley. */
  streams: { x: number; vx: number }[]
}

const STREAMS: { x: number; vx: number }[][] = [
  [{ x: 0, vx: 0 }],
  [{ x: 0, vx: 0 }, { x: -0.35, vx: -0.5 }, { x: 0.35, vx: 0.5 }],
  [{ x: 0, vx: 0 }, { x: -0.35, vx: -0.5 }, { x: 0.35, vx: 0.5 }, { x: -0.7, vx: -1.1 }, { x: 0.7, vx: 1.1 }],
  [{ x: -0.12, vx: 0 }, { x: 0.12, vx: 0 }, { x: -0.35, vx: -0.5 }, { x: 0.35, vx: 0.5 }, { x: -0.7, vx: -1.1 }, { x: 0.7, vx: 1.1 }, { x: 0, vx: 0 }],
  [{ x: -0.12, vx: 0 }, { x: 0.12, vx: 0 }, { x: -0.35, vx: -0.5 }, { x: 0.35, vx: 0.5 }, { x: -0.7, vx: -1.1 }, { x: 0.7, vx: 1.1 }, { x: 0, vx: 0 }, { x: -1, vx: -1.8 }, { x: 1, vx: 1.8 }],
]

export const clampPower = (p: number) => Math.max(0, Math.min(MAX_WEAPON_POWER, Math.floor(p) || 0))

export function weaponStats(power: number): WeaponStats {
  const p = clampPower(power)
  const level = Math.floor(p / WEAPON_TIERS) + 1
  const tier = (p % WEAPON_TIERS) + 1
  return {
    level,
    tier,
    interval: 200 - (tier - 1) * 30,
    damage: 9 + (level - 1) * 2 + (tier - 1) * 2,
    radius: 0.1 + (tier - 1) * 0.035,
    streams: STREAMS[level - 1],
  }
}
