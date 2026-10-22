import { useMemo } from 'react'
import * as THREE from 'three'
import { useGameStore, type Bullet } from '../../store/gameStore'
import { sounds } from '../../hooks/useAudio'
import { ROLE_STATS } from '../../game/roster'
import { BOSSES } from '../../game/bosses'
import { getStage } from '../../game/stages'
import { onScreen } from '../../game/world'
import { ORDER } from '../../game/sim/clock'
import { net } from '../../game/sim/net'
import { useSimStep } from '../../game/sim/useSimStep'
import { ENEMY_BULLET_COLOR } from '../../game/fx/color'
import { emitFx } from '../../game/fx/events'
import { bossKilled, enemyKilled } from './effects'
import { BoltsMesh, EnemyBulletsMesh, MissilesMesh } from './fx/BulletMeshes'

export { ENEMY_BULLET_COLOR }
/** Homing missiles: cruise speed and turn rate (rad / game-second). */
const MISSILE_SPEED = 14
const MISSILE_TURN = 5
/** Spark colours of a missile and of a bolt fired without a colour. */
const MISSILE_SPARK = '#ffa340'
const BOLT_SPARK = '#7cf9ff'

/** Sparks where a player bullet struck (visual only, a teammate's ghost bolts too). */
const sparkAt = (b: Bullet) => emitFx({ kind: 'hit', x: b.x, z: b.z, color: b.color ?? (b.homing ? MISSILE_SPARK : BOLT_SPARK) })

/** Nearest on-screen target (enemy or boss) for a homing missile. */
function nearestTarget(x: number, z: number): { x: number; z: number } | null {
  const s = useGameStore.getState()
  let best: { x: number; z: number } | null = null
  let bestD = Infinity
  for (const e of s.enemies) {
    if (!e.entered) continue
    const d = Math.hypot(e.x - x, e.y - z)
    if (d < bestD) { bestD = d; best = { x: e.x, z: e.y } }
  }
  if (s.boss && s.boss.intro <= 0.5) {
    const d = Math.hypot(s.boss.x - x, s.boss.y - z)
    if (d < bestD) best = { x: s.boss.x, z: s.boss.y }
  }
  return best
}

export function Bullets() {
  const split = useBulletSplit()

  useSimStep(ORDER.bullets, ({ dt }) => {
    const s = useGameStore.getState()
    if (s.gameState !== 'playing') return
    // Co-op: the server owns enemy HP — report the hit, show it, and wait for ENEMY_DEAD
    const n = net()
    const next = []
    const bossRadius = BOSSES[getStage(s.currentStageId).boss].radius
    for (const b of s.bullets) {
      if (b.homing) {
        // Steer toward the closest target, accelerating up to cruise speed
        const t = nearestTarget(b.x, b.z)
        const cur = Math.atan2(b.vx, b.vz)
        const speed = Math.min(MISSILE_SPEED, Math.hypot(b.vx, b.vz) + 20 * dt)
        let ang = cur
        if (t) {
          const want = Math.atan2(t.x - b.x, t.z - b.z)
          const diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur))
          ang = cur + THREE.MathUtils.clamp(diff, -MISSILE_TURN * dt, MISSILE_TURN * dt)
        }
        b.vx = Math.sin(ang) * speed
        b.vz = Math.cos(ang) * speed
      }
      b.x += b.vx * dt
      b.y += b.vy * dt
      b.z += b.vz * dt
      // Despawn once completely off the visible screen
      if (!onScreen(b.x, b.z, 1.5)) continue

      let hit = false
      if (!b.isEnemy) {
        for (const e of s.enemies) {
          const role = ROLE_STATS[e.type]
          // Not hittable until it has actually flown onto the screen
          if (b.hits?.includes(e.id)) continue
          if (e.entered && Math.hypot(b.x - e.x, b.z - e.y) < role.radius + b.radius) {
            sparkAt(b)
            // Teammate's bolts are only a picture of their fire: they stop on contact, the hit is theirs to report
            if (b.ghost) { hit = true; break }
            sounds.enemyHit()
            if (n) {
              n.hit(e.id, b.damage)
              s.estimateEnemyHit(e.id, b.damage)
            } else if (s.damageEnemy(e.id, b.damage)) {
              enemyKilled(e, { mine: true, rollDrops: true })
            }
            if (b.pierce) {
              // Keep flying; remember this enemy so it isn't hit again every frame
              b.hits = [...(b.hits ?? []), e.id]
              continue
            }
            hit = true
            break
          }
        }
        if (!hit && s.boss && s.boss.intro <= 0.5 && Math.hypot(b.x - s.boss.x, b.z - s.boss.y) < bossRadius) {
          const { x, y } = s.boss
          sparkAt(b)
          if (!b.ghost) {
            sounds.enemyHit()
            if (n) {
              n.hit('boss', b.damage)
              s.estimateBossHit(b.damage)
            } else if (s.damageBoss(b.damage)) {
              bossKilled(x, y, { mine: true })
            }
          }
          hit = true
        }
      } else {
        if (!s.down && Math.hypot(b.x - s.playerX, b.z - s.playerY) < 0.55 + b.radius) {
          s.damagePlayer(b.damage)
          hit = true
        }
      }
      if (!hit) next.push({ ...b })
    }
    useGameStore.setState({ bullets: next })
  })

  return (
    <>
      <BoltsMesh bolts={split.bolts} />
      <MissilesMesh missiles={split.missiles} />
      <EnemyBulletsMesh bullets={split.enemy} />
    </>
  )
}

/**
 * The store's bullets split by how they are drawn, redone only when the list changes (every sim step
 * replaces it). No arrays are made per frame.
 */
function useBulletSplit() {
  return useMemo(() => {
    let seen: readonly Bullet[] | null = null
    const bolts: Bullet[] = [], missiles: Bullet[] = [], enemy: Bullet[] = []
    const update = () => {
      const all = useGameStore.getState().bullets
      if (all === seen) return
      seen = all
      bolts.length = missiles.length = enemy.length = 0
      for (const b of all) (b.isEnemy ? enemy : b.homing ? missiles : bolts).push(b)
    }
    return {
      bolts: () => { update(); return bolts },
      missiles: () => { update(); return missiles },
      enemy: () => { update(); return enemy },
    }
  }, [])
}
