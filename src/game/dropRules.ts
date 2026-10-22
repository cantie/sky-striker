import type { PickupType } from '../store/gameStore'

/** Chance that a destroyed enemy leaves an item behind. */
export const DROP_CHANCE = 0.12
/** Relative odds among the drops that are currently allowed. */
export const DROP_WEIGHTS = { health: 0.3, powerup: 0.45, shield: 0.25 }
/** Per-stage caps. */
export const MAX_POWERUPS = 3
export const MAX_SHIELDS = 2
export const MAX_HEALTH = 3

/** The numbers pickDrop plays by. A co-op server passes its data's (CoopRules), as the Nakama match does. */
export interface DropRules {
  dropChance: number
  dropWeights: { health: number; powerup: number; shield: number }
  maxPowerups: number
  maxShields: number
  maxHealth: number
}
export const DROP_RULES: DropRules = {
  dropChance: DROP_CHANCE, dropWeights: DROP_WEIGHTS, maxPowerups: MAX_POWERUPS, maxShields: MAX_SHIELDS, maxHealth: MAX_HEALTH,
}

export interface DropState {
  powerupsDropped: number
  shieldsDropped: number
  healthDropped: number
  /** How far through the stage's waves we are, 0..1. */
  progress: number
}

/**
 * Decide what (if anything) a kill drops. Weapon power-ups are capped at 3 per stage and
 * unlock one per third of the stage, shields at 2 (one per half), health at 3 (one per
 * third), so they're spread out instead of all landing in the first waves; once nothing is
 * allowed, a kill drops nothing.
 * Pure: the caller supplies the random source and the counts (a co-op server uses its own).
 */
export function pickDrop(random: () => number, st: DropState, rules: DropRules = DROP_RULES): PickupType | null {
  if (random() >= rules.dropChance) return null
  const { powerupsDropped, shieldsDropped, healthDropped, progress } = st
  const { maxPowerups, maxShields, maxHealth, dropWeights: w } = rules
  const canPowerup = powerupsDropped < maxPowerups && progress >= powerupsDropped / maxPowerups
  const canShield = shieldsDropped < maxShields && progress >= shieldsDropped / maxShields
  const canHealth = healthDropped < maxHealth && progress >= healthDropped / maxHealth

  const options: [PickupType, number][] = []
  if (canHealth) options.push(['health', w.health])
  if (canPowerup) options.push(['powerup', w.powerup])
  if (canShield) options.push(['shield', w.shield])
  if (!options.length) return null
  let roll = random() * options.reduce((n, [, w]) => n + w, 0)
  return options.find(([, w]) => (roll -= w) < 0)?.[0] ?? options[0][0]
}
