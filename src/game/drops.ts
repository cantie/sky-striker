import { useGameStore, type PickupType } from '../store/gameStore'
import { getStage } from './stages'

/** Chance that a destroyed enemy leaves an item behind. */
const DROP_CHANCE = 0.12
/** Per-stage caps. */
export const MAX_POWERUPS = 3
export const MAX_SHIELDS = 2

/**
 * Decide what (if anything) a kill drops. Weapon power-ups are capped at 3 per stage and
 * unlock one per third of the stage, shields at 2 (one per half), so they're spread out
 * instead of all landing in the first waves; health fills the remaining drops.
 */
export function rollDrop(): PickupType | null {
  if (Math.random() >= DROP_CHANCE) return null
  const s = useGameStore.getState()
  const { powerupsDropped, shieldsDropped } = s.runStats
  const progress = s.waveIndex / Math.max(1, getStage(s.currentStageId).maxWaves)
  const canPowerup = powerupsDropped < MAX_POWERUPS && progress >= powerupsDropped / MAX_POWERUPS
  const canShield = shieldsDropped < MAX_SHIELDS && progress >= shieldsDropped / MAX_SHIELDS

  const options: [PickupType, number][] = [['health', 0.3]]
  if (canPowerup) options.push(['powerup', 0.45])
  if (canShield) options.push(['shield', 0.25])
  let roll = Math.random() * options.reduce((n, [, w]) => n + w, 0)
  const type = options.find(([, w]) => (roll -= w) < 0)?.[0] ?? 'health'

  if (type === 'powerup') useGameStore.setState({ runStats: { ...s.runStats, powerupsDropped: powerupsDropped + 1 } })
  if (type === 'shield') useGameStore.setState({ runStats: { ...s.runStats, shieldsDropped: shieldsDropped + 1 } })
  return type
}
