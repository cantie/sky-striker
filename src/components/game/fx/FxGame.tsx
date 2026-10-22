import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore, type GameState } from '../../../store/gameStore'
import { useFx } from './FxRenderer'

/** States in which a stage is on screen (GameScene shows its actors): effects live on through these. */
const IN_STAGE = new Set<GameState>(['playing', 'paused', 'bossWarning', 'results'])
/** A homing missile leaves a puff of smoke about this often (real seconds). */
const PUFF_EVERY = 0.04

/**
 * The game's side of the effects: reads the store every frame and asks the renderer for effects.
 * Leaving a stage, switching stage or restarting one (its scroll starts over) clears them all.
 */
export function FxGame() {
  const fx = useFx()
  const last = useRef({ stage: -1, inStage: false, scroll: 0 })

  useFrame((_, delta) => {
    const s = useGameStore.getState()
    const inStage = IN_STAGE.has(s.gameState)
    const was = last.current
    if (s.currentStageId !== was.stage || (was.inStage && !inStage) || s.scrollOffset < was.scroll) fx.clear()
    was.stage = s.currentStageId
    was.inStage = inStage
    was.scroll = s.scrollOffset
    if (s.gameState !== 'playing') return

    const dt = Math.min(delta, 0.1)
    for (const b of s.bullets) if (b.homing && Math.random() < dt / PUFF_EVERY) fx.puff(b.x, b.z, b.vx, b.vz)
  })
  return null
}
