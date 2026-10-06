import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../store/gameStore'
import { sounds } from '../../hooks/useAudio'

const MAX = 256

export function Bullets() {
  const playerRef = useRef<THREE.InstancedMesh>(null)
  const enemyRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])

  useFrame((_, dt) => {
    const s = useGameStore.getState()
    if (s.gameState !== 'playing') return
    const next = []
    for (const b of s.bullets) {
      b.x += b.vx * dt
      b.y += b.vy * dt
      b.z += b.vz * dt
      if (Math.abs(b.x) > 8 || b.z > 12 || b.z < -10) continue

      let hit = false
      if (!b.isEnemy) {
        for (const e of s.enemies) {
          if (Math.hypot(b.x - e.x, b.z - e.y) < 0.7 + b.radius) {
            const dead = s.damageEnemy(e.id, b.damage)
            sounds.enemyHit()
            if (dead) {
              s.addExplosion(e.x, 0.2, e.y, e.type === 'heavy' ? 1.6 : 1)
              s.addScore(e.type === 'heavy' ? 300 : e.type === 'fast' ? 150 : e.type === 'shooter' ? 200 : 100)
              s.incrementCombo()
              s.addStar()
              if (Math.random() < 0.35) {
                const types = ['powerup', 'star', 'health', 'shield'] as const
                s.addPickup({ x: e.x, y: 0.3, z: e.y, type: types[Math.floor(Math.random() * types.length)] })
              }
            }
            hit = true
            break
          }
        }
        if (!hit && s.boss && Math.hypot(b.x - s.boss.x, b.z - s.boss.y) < 1.8) {
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

    const players = next.filter((b) => !b.isEnemy)
    const enemies = next.filter((b) => b.isEnemy)
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
    if (enemyRef.current) {
      enemyRef.current.count = enemies.length
      enemies.forEach((b, i) => {
        dummy.position.set(b.x, 0.4, b.z)
        dummy.scale.setScalar(b.radius * 3.2)
        dummy.updateMatrix()
        enemyRef.current!.setMatrixAt(i, dummy.matrix)
        color.set(b.glow || '#ff2244')
        enemyRef.current!.setColorAt(i, color)
      })
      enemyRef.current.instanceMatrix.needsUpdate = true
      if (enemyRef.current.instanceColor) enemyRef.current.instanceColor.needsUpdate = true
    }
  })

  return (
    <>
      <instancedMesh ref={playerRef} args={[undefined, undefined, MAX]}>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshBasicMaterial color="#7cf9ff" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={enemyRef} args={[undefined, undefined, MAX]}>
        <sphereGeometry args={[0.5, 10, 10]} />
        <meshBasicMaterial color="#ff3355" toneMapped={false} />
      </instancedMesh>
    </>
  )
}
