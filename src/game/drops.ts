import { useGameStore, type PickupType } from '../store/gameStore'
import { getStage } from './stages'
import { rand } from './sim/rng'
import { pickDrop } from './dropRules'

export { MAX_POWERUPS, MAX_SHIELDS, pickDrop, type DropState } from './dropRules'

/** Single-player: roll a drop for the current run and count it against the caps. */
export function rollDrop(): PickupType | null {
  const s = useGameStore.getState()
  const { powerupsDropped, shieldsDropped } = s.runStats
  const progress = s.waveIndex / Math.max(1, getStage(s.currentStageId).maxWaves)
  const type = pickDrop(() => rand('drops'), { powerupsDropped, shieldsDropped, progress })

  if (type === 'powerup') useGameStore.setState({ runStats: { ...s.runStats, powerupsDropped: powerupsDropped + 1 } })
  if (type === 'shield') useGameStore.setState({ runStats: { ...s.runStats, shieldsDropped: shieldsDropped + 1 } })
  return type
}
