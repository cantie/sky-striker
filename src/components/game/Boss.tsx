import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../store/gameStore'
import { GlbModel, MODEL_PATHS } from './Model'
import { EngineFlame } from './EngineFlame'
import { gameDt, gameInterval } from '../../game/speed'

export function Boss() {
  const group = useRef<THREE.Group>(null)
  const boss = useGameStore((s) => s.boss)

  useFrame((_, rawDt) => {
    const dt = gameDt(rawDt)
    const s = useGameStore.getState()
    const b = s.boss
    if (!b || s.gameState !== 'playing' || !group.current) return

    if (b.intro > 0) {
      b.intro = Math.max(0, b.intro - dt * 0.35)
      b.y = THREE.MathUtils.lerp(b.y, 4.2, 1 - Math.pow(0.02, dt))
    } else {
      b.x = Math.sin(Date.now() * 0.0007 * b.phase) * (2.5 + b.phase * 0.4)
      b.y = 4.0 + Math.sin(Date.now() * 0.001) * 0.4
    }
    group.current.position.set(b.x, 0.4, b.y)
    group.current.rotation.z = -b.x * 0.08

    const now = Date.now()
    const interval = gameInterval(Math.max(280, 700 - b.phase * 120))
    if (b.intro <= 0 && now - b.lastShot > interval) {
      b.lastShot = now
      b.patternIndex = (b.patternIndex + 1) % 4
      const pattern = b.patternIndex
      if (pattern === 0) {
        for (let i = -3; i <= 3; i++) {
          s.addBullet({ x: b.x + i * 0.45, y: 0.4, z: b.y - 0.8, vx: i * 0.4, vy: 0, vz: -6 - b.phase, isEnemy: true, damage: 14, radius: 0.24, glow: '#ff2244' })
        }
      } else if (pattern === 1) {
        for (let a = 0; a < 12; a++) {
          const ang = (a / 12) * Math.PI * 2 + now * 0.001
          s.addBullet({ x: b.x, y: 0.4, z: b.y, vx: Math.cos(ang) * 4, vy: 0, vz: Math.sin(ang) * 4, isEnemy: true, damage: 12, radius: 0.22, glow: '#ff66aa' })
        }
      } else if (pattern === 2) {
        const px = s.playerX - b.x, pz = s.playerY - b.y
        const len = Math.hypot(px, pz) || 1
        for (let i = -1; i <= 1; i++) {
          s.addBullet({ x: b.x + i * 0.5, y: 0.4, z: b.y, vx: (px / len) * 7 + i * 0.3, vy: 0, vz: (pz / len) * 7, isEnemy: true, damage: 16, radius: 0.26, glow: '#ffaa00' })
        }
      } else {
        for (let i = 0; i < 5 + b.phase; i++) {
          const ang = -Math.PI / 2 + (i - 2) * 0.25
          s.addBullet({ x: b.x, y: 0.4, z: b.y - 0.5, vx: Math.cos(ang) * 5, vy: 0, vz: Math.sin(ang) * 5, isEnemy: true, damage: 13, radius: 0.22, glow: '#ff3355' })
        }
      }
    }
    useGameStore.setState({ boss: { ...b } })
  })

  if (!boss) return null
  return (
    <group ref={group} position={[boss.x, 0.4, boss.y]}>
      {/* Quaternius ship: Z-flip so nose aims at player */}
      <group scale={[1, 1, -1]}>
        <GlbModel path={MODEL_PATHS.boss} size={3.8} emissive="#331100" />
        <mesh position={[0, 0.15, 1.5]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.35, 0.9, 8]} />
          <meshBasicMaterial color="#ff3300" toneMapped={false} />
        </mesh>
        <EngineFlame position={[-0.5, 0.1, -1.7]} color="#ff5a1f" core="#fff0c0" length={1.3} width={0.24} />
        <EngineFlame position={[0.5, 0.1, -1.7]} color="#ff5a1f" core="#fff0c0" length={1.3} width={0.24} />
      </group>
      <pointLight color="#ff5522" intensity={4} distance={8} />
    </group>
  )
}
