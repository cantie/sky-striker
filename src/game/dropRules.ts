import type { PickupType } from '../store/gameStore'

/** Chance that a destroyed enemy leaves an item behind. */
export const DROP_CHANCE = 0.12
/** Relative odds among the drops that are currently allowed. */
export const DROP_WEIGHTS = { health: 0.3, powerup: 0.45, shield: 0.25 }
/** Per-stage caps. */
export const MAX_POWERUPS = 3
export const MAX_SHIELDS = 2
/** Single-player only for now: the co-op servers (Nakama, loopback) don't count health and keep it uncapped. */
export const MAX_HEALTH = 3

export interface DropState {
  powerupsDropped: number
  shieldsDropped: number
  /** Health drops so far. Left out, health is uncapped (the co-op servers' rule until Nakama is redeployed). */
  healthDropped?: number
  /** How far through the stage's waves we are, 0..1. */
  progress: number
}

/**
 * Decide what (if anything) a kill drops. Weapon power-ups are capped at 3 per stage and
 * unlock one per third of the stage, shields at 2 (one per half), so they're spread out
 * instead of all landing in the first waves. Counted health is capped and spread the same
 * way as power-ups; once nothing is allowed, a kill drops nothing.
 * Pure: the caller supplies the random source and the counts (a co-op server uses its own).
 */
export function pickDrop(random: () => number, st: DropState): PickupType | null {
  if (random() >= DROP_CHANCE) return null
  const { powerupsDropped, shieldsDropped, healthDropped, progress } = st
  const canPowerup = powerupsDropped < MAX_POWERUPS && progress >= powerupsDropped / MAX_POWERUPS
  const canShield = shieldsDropped < MAX_SHIELDS && progress >= shieldsDropped / MAX_SHIELDS
  const canHealth = healthDropped === undefined || (healthDropped < MAX_HEALTH && progress >= healthDropped / MAX_HEALTH)

  const options: [PickupType, number][] = []
  if (canHealth) options.push(['health', DROP_WEIGHTS.health])
  if (canPowerup) options.push(['powerup', DROP_WEIGHTS.powerup])
  if (canShield) options.push(['shield', DROP_WEIGHTS.shield])
  if (!options.length) return null
  let roll = random() * options.reduce((n, [, w]) => n + w, 0)
  return options.find(([, w]) => (roll -= w) < 0)?.[0] ?? options[0][0]
}
