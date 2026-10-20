import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../store/gameStore'
import { sounds } from '../../hooks/useAudio'
import { ROLE_STATS } from '../../game/roster'
import { BOSSES } from '../../game/bosses'
import { getStage } from '../../game/stages'
import { onScreen } from '../../game/world'
import { ORDER } from '../../game/sim/clock'
import { net } from '../../game/sim/net'
import { useSimStep } from '../../game/sim/useSimStep'
import { bossKilled, enemyKilled } from './effects'

const MAX = 512
/**
 * One enemy-bullet look for every biome: dark rim (pops on snow/sand), hot magenta halo
 * (pops on lava/forest/water — a hue no terrain uses) and a white core.
 */
export const ENEMY_BULLET_COLOR = '#ff2bd6'
/** Homing missiles: cruise speed and turn rate (rad / game-second). */
const MISSILE_SPEED = 14
const MISSILE_TURN = 5

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
  const playerRef = useRef<THREE.InstancedMesh>(null)
  const enemyRef = useRef<THREE.InstancedMesh>(null)
  const coreRef = useRef<THREE.InstancedMesh>(null)
  const rimRef = useRef<THREE.InstancedMesh>(null)
  const missileRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

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

  useFrame(() => {
    const next = useGameStore.getState().bullets
    const players = next.filter((b) => !b.isEnemy && !b.homing).slice(0, MAX)
    const missiles = next.filter((b) => b.homing).slice(0, MAX)
    const enemies = next.filter((b) => b.isEnemy).slice(0, MAX)
    if (playerRef.current) {
      playerRef.current.count = players.length
      players.forEach((b, i) => {
        // Elongated bolt along its flight path; radius grows with the weapon tier
        dummy.position.set(b.x, 0.35, b.z)
        dummy.rotation.set(0, Math.atan2(b.vx, b.vz), 0)
        dummy.scale.set(b.radius * 2.2, b.radius * 2.2, b.radius * 5.5)
        dummy.updateMatrix()
        playerRef.current!.setMatrixAt(i, dummy.matrix)
      })
      playerRef.current.instanceMatrix.needsUpdate = true
    }
    if (missileRef.current) {
      missileRef.current.count = missiles.length
      missiles.forEach((b, i) => {
        dummy.position.set(b.x, 0.38, b.z)
        dummy.rotation.set(0, Math.atan2(b.vx, b.vz), 0)
        dummy.scale.set(0.32, 0.32, 0.9)
        dummy.updateMatrix()
        missileRef.current!.setMatrixAt(i, dummy.matrix)
      })
      missileRef.current.instanceMatrix.needsUpdate = true
    }
    dummy.rotation.set(0, 0, 0)
    // [mesh, height, scale × radius, lie flat] — the rim is a disc facing the top-down camera
    const layers: [THREE.InstancedMesh | null, number, number, boolean][] = [
      [rimRef.current, 0.3, 4.2, true],
      [enemyRef.current, 0.4, 2.8, false],
      [coreRef.current, 0.75, 1.35, false],
    ]
    for (const [mesh, y, k, flat] of layers) {
      if (!mesh) continue
      mesh.count = enemies.length
      dummy.rotation.set(flat ? -Math.PI / 2 : 0, 0, 0)
      enemies.forEach((b, i) => {
        dummy.position.set(b.x, y, b.z)
        dummy.scale.setScalar(b.radius * k)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    }
    dummy.rotation.set(0, 0, 0)
  })

  return (
    <>
      <instancedMesh ref={playerRef} args={[undefined, undefined, MAX]}>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshBasicMaterial color="#7cf9ff" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={missileRef} args={[undefined, undefined, MAX]} frustumCulled={false}>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshBasicMaterial color="#ffb02e" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={rimRef} args={[undefined, undefined, MAX]} frustumCulled={false}>
        <circleGeometry args={[0.5, 16]} />
        <meshBasicMaterial color="#1a0016" transparent opacity={0.75} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={enemyRef} args={[undefined, undefined, MAX]} frustumCulled={false}>
        <sphereGeometry args={[0.5, 10, 10]} />
        <meshBasicMaterial color={ENEMY_BULLET_COLOR} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={coreRef} args={[undefined, undefined, MAX]} frustumCulled={false}>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
    </>
  )
}
