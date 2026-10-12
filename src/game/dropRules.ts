import type { PickupType } from '../store/gameStore'

/** Chance that a destroyed enemy leaves an item behind. */
const DROP_CHANCE = 0.12
/** Per-stage caps. */
export const MAX_POWERUPS = 3
export const MAX_SHIELDS = 2

export interface DropState {
  powerupsDropped: number
  shieldsDropped: number
  /** How far through the stage's waves we are, 0..1. */
  progress: number
}

/**
 * Decide what (if anything) a kill drops. Weapon power-ups are capped at 3 per stage and
 * unlock one per third of the stage, shields at 2 (one per half), so they're spread out
 * instead of all landing in the first waves; health fills the remaining drops.
 * Pure: the caller supplies the random source and the counts (a co-op server uses its own).
 */
export function pickDrop(random: () => number, st: DropState): PickupType | null {
  if (random() >= DROP_CHANCE) return null
  const { powerupsDropped, shieldsDropped, progress } = st
  const canPowerup = powerupsDropped < MAX_POWERUPS && progress >= powerupsDropped / MAX_POWERUPS
  const canShield = shieldsDropped < MAX_SHIELDS && progress >= shieldsDropped / MAX_SHIELDS

  const options: [PickupType, number][] = [['health', 0.3]]
  if (canPowerup) options.push(['powerup', 0.45])
  if (canShield) options.push(['shield', 0.25])
  let roll = random() * options.reduce((n, [, w]) => n + w, 0)
  return options.find(([, w]) => (roll -= w) < 0)?.[0] ?? 'health'
}
