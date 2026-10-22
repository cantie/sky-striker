import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from '../store/gameStore'
import { getStage } from './stages'
import { MAX_HEALTH } from './dropRules'
import { rollDrop } from './drops'

describe('single-player drops', () => {
  beforeEach(() => {
    const s = useGameStore.getState()
    // Last wave: every cap is unlocked
    useGameStore.setState({ waveIndex: getStage(s.currentStageId).maxWaves, runStats: { ...s.runStats, powerupsDropped: 0, shieldsDropped: 0, healthDropped: 0 } })
  })

  it('count health against its cap, so a stage drops at most MAX_HEALTH of it', () => {
    const got = Array.from({ length: 3000 }, () => rollDrop())
    expect(got.filter((t) => t === 'health')).toHaveLength(MAX_HEALTH)
    expect(useGameStore.getState().runStats.healthDropped).toBe(MAX_HEALTH)
  })
})
