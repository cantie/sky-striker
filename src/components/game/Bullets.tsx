import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../store/gameStore'
import { sounds } from '../../hooks/useAudio'
import { gameDt } from '../../game/speed'
import { ROLE_STATS } from '../../game/roster'
import { BOSSES } from '../../game/bosses'
import { getStage } from '../../game/stages'
import { onScreen } from '../../game/world'

const MAX = 512

export function Bullets() {
  const playerRef = useRef<THREE.InstancedMesh>(null)
  const enemyRef = useRef<THREE.InstancedMesh>(null)
  const coreRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])

  useFrame((_, rawDt) => {
    const dt = gameDt(rawDt)
    const s = useGameStore.getState()
    if (s.gameState !== 'playing') return
    const next = []
    const bossRadius = BOSSES[getStage(s.currentStageId).boss].radius
    for (const b of s.bullets) {
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
          if (e.entered && Math.hypot(b.x - e.x, b.z - e.y) < role.radius + b.radius) {
            const dead = s.damageEnemy(e.id, b.damage)
            sounds.enemyHit()
            if (dead) {
              s.addExplosion(e.x, 0.2, e.y, e.type === 'heavy' || e.type === 'tank' ? 1.6 : 1)
              s.addScore(role.score)
              s.incrementCombo()
              s.addStar()
              s.recordEnemyKill()
              if (Math.random() < 0.35) {
                const types = ['powerup', 'star', 'health', 'shield', 'rescue'] as const
                s.addPickup({ x: e.x, y: 0.3, z: e.y, type: types[Math.floor(Math.random() * types.length)] })
              }
            }
            hit = true
            break
          }
        }
        if (!hit && s.boss && s.boss.intro <= 0.5 && Math.hypot(b.x - s.boss.x, b.z - s.boss.y) < bossRadius) {
          const dead = s.damageBoss(b.damage)
          sounds.enemyHit()
          if (dead) {
            s.addExplosion(s.boss.x, 0.4, s.boss.y, 3)
            s.addScore(5000)
          }
          hit = true
        }
      } else {
        if (Math.hypot(b.x - s.playerX, b.z - s.playerY) < 0.55 + b.radius) {
          s.damagePlayer(b.damage)
          hit = true
        }
      }
      if (!hit) next.push({ ...b })
    }
    useGameStore.setState({ bullets: next })

    const players = next.filter((b) => !b.isEnemy).slice(0, MAX)
    const enemies = next.filter((b) => b.isEnemy).slice(0, MAX)
    if (playerRef.current) {
      playerRef.current.count = players.length
      players.forEach((b, i) => {
        dummy.position.set(b.x, 0.35, b.z)
        dummy.scale.setScalar(b.radius * 2.2)
        dummy.updateMatrix()
        playerRef.current!.setMatrixAt(i, dummy.matrix)
      })
      playerRef.current.instanceMatrix.needsUpdate = true
    }
    if (enemyRef.current && coreRef.current) {
      enemyRef.current.count = enemies.length
      coreRef.current.count = enemies.length
      enemies.forEach((b, i) => {
        // Coloured halo + hot white core keeps small bullets readable on any terrain
        dummy.position.set(b.x, 0.4, b.z)
        dummy.scale.setScalar(b.radius * 2.8)
        dummy.updateMatrix()
        enemyRef.current!.setMatrixAt(i, dummy.matrix)
        color.set(b.glow || '#ff2244')
        enemyRef.current!.setColorAt(i, color)
        dummy.position.y = 0.45
        dummy.scale.setScalar(b.radius * 1.3)
        dummy.updateMatrix()
        coreRef.current!.setMatrixAt(i, dummy.matrix)
      })
      enemyRef.current.instanceMatrix.needsUpdate = true
      coreRef.current.instanceMatrix.needsUpdate = true
      if (enemyRef.current.instanceColor) enemyRef.current.instanceColor.needsUpdate = true
    }
  })

  return (
    <>
      <instancedMesh ref={playerRef} args={[undefined, undefined, MAX]}>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshBasicMaterial color="#7cf9ff" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={enemyRef} args={[undefined, undefined, MAX]} frustumCulled={false}>
        <sphereGeometry args={[0.5, 10, 10]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.85} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={coreRef} args={[undefined, undefined, MAX]} frustumCulled={false}>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
    </>
  )
}
