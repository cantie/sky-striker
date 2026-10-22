import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore, type GameState } from '../../../store/gameStore'
import { BOSSES } from '../../../game/bosses'
import { takeNewExplosions } from '../../../game/fx/emitters'
import { drainFx } from '../../../game/fx/events'
import { getStage } from '../../../game/stages'
import { useFx } from './FxRenderer'

/** States in which a stage is on screen (GameScene shows its actors): effects live on through these. */
const IN_STAGE = new Set<GameState>(['playing', 'paused', 'bossWarning', 'results'])
/** A homing missile leaves a puff of smoke about this often (real seconds). */
const PUFF_EVERY = 0.04
/** A store explosion this big is a boss's: its death sequence comes from the bossDeath event instead. */
const BOSS_SCALE = 3

/**
 * The game's side of the effects: reads the store and the visual event queue every frame and asks the
 * renderer for effects. Leaving a stage, switching stage or restarting one (its scroll starts over)
 * clears them all.
 */
export function FxGame() {
  const fx = useFx()
  const last = useRef({ stage: -1, inStage: false, scroll: 0 })
  const seen = useRef(new Set<string>())

  useFrame((_, delta) => {
    const s = useGameStore.getState()
    const inStage = IN_STAGE.has(s.gameState)
    const was = last.current
    if (s.currentStageId !== was.stage || (was.inStage && !inStage) || s.scrollOffset < was.scroll) fx.clear()
    was.stage = s.currentStageId
    was.inStage = inStage
    was.scroll = s.scrollOffset

    // Taken every frame, so an explosion is never started twice and the dropped ones are forgotten
    const fresh = takeNewExplosions(seen.current, s.explosions)
    const events = drainFx()
    if (!inStage) return
    for (const e of fresh) if (e.scale < BOSS_SCALE) fx.explosion(e.x, e.z, e.scale)
    for (const e of events) {
      if (e.kind === 'hit') fx.hit(e.x, e.z, e.color)
      else if (e.kind === 'bossDeath') fx.bossDeath(e.x, e.z, BOSSES[getStage(s.currentStageId).boss])
      else if (e.kind === 'nova') fx.nova(e.x, e.z, e.color)
      else if (e.kind === 'shieldHit') fx.shieldHit(e.x, e.z)
      else fx.laserHit(e.x, e.z)
    }

    if (s.gameState !== 'playing') return
    const dt = Math.min(delta, 0.1)
    for (const b of s.bullets) if (b.homing && Math.random() < dt / PUFF_EVERY) fx.puff(b.x, b.z, b.vx, b.vz)
  })
  return null
}
