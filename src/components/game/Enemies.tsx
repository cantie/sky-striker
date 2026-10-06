import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore, type EnemyType } from '../../store/gameStore'
import { GlbModel, MODEL_PATHS } from './Model'
import { sounds } from '../../hooks/useAudio'

const STATS: Record<EnemyType, { hp: number; speed: number; score: number; fire: number; model: string; size: number }> = {
  basic: { hp: 30, speed: 2.2, score: 100, fire: 0, model: MODEL_PATHS.enemyBasic, size: 0.95 },
  fast: { hp: 18, speed: 4.2, score: 150, fire: 0, model: MODEL_PATHS.enemyFast, size: 0.85 },
  heavy: { hp: 80, speed: 1.4, score: 300, fire: 1400, model: MODEL_PATHS.enemyHeavy, size: 1.35 },
  shooter: { hp: 40, speed: 1.8, score: 200, fire: 900, model: MODEL_PATHS.enemyShooter, size: 1.0 },
}

const WAVE_PATTERNS: { type: EnemyType; xs: number[]; pattern: number }[][] = [
  [{ type: 'basic', xs: [-2, 0, 2], pattern: 0 }],
  [{ type: 'fast', xs: [-3, -1, 1, 3], pattern: 1 }],
  [{ type: 'basic', xs: [-2.5, 0, 2.5], pattern: 2 }, { type: 'shooter', xs: [0], pattern: 0 }],
  [{ type: 'heavy', xs: [-1.5, 1.5], pattern: 0 }],
  [{ type: 'fast', xs: [-3.5, -1.5, 1.5, 3.5], pattern: 1 }, { type: 'shooter', xs: [-2, 2], pattern: 2 }],
  [{ type: 'basic', xs: [-3, -1, 1, 3], pattern: 0 }, { type: 'heavy', xs: [0], pattern: 0 }],
  [{ type: 'shooter', xs: [-2.5, 0, 2.5], pattern: 2 }],
  [{ type: 'fast', xs: [-3, 0, 3], pattern: 1 }, { type: 'heavy', xs: [-1.5, 1.5], pattern: 0 }],
  [{ type: 'basic', xs: [-3.5, -1.5, 1.5, 3.5], pattern: 2 }, { type: 'shooter', xs: [-2, 2], pattern: 0 }],
  [{ type: 'heavy', xs: [-2, 0, 2], pattern: 0 }, { type: 'fast', xs: [-3.5, 3.5], pattern: 1 }],
]

function spawnWave(index: number) {
  const wave = WAVE_PATTERNS[Math.min(index, WAVE_PATTERNS.length - 1)]
  const s = useGameStore.getState()
  for (const row of wave) {
    for (const x of row.xs) {
      const st = STATS[row.type]
      s.addEnemy({ x, y: 8 + Math.random() * 1.5, z: 0, type: row.type, hp: st.hp, maxHp: st.hp, lastShot: 0, pattern: row.pattern, age: 0 })
    }
  }
}

export function Enemies() {
  const lastWave = useRef(-1)
  const enemies = useGameStore((s) => s.enemies)

  useEffect(() => {
    const unsub = useGameStore.subscribe((s, p) => {
      if (s.gameState === 'playing' && s.waveIndex !== lastWave.current && !s.bossSpawned) {
        lastWave.current = s.waveIndex
        spawnWave(s.waveIndex)
      }
      if (s.gameState === 'menu') lastWave.current = -1
    })
    return unsub
  }, [])

  useFrame((_, dt) => {
    const s = useGameStore.getState()
    if (s.gameState !== 'playing') return
    const now = Date.now()
    for (const e of [...s.enemies]) {
      const st = STATS[e.type]
      e.age += dt
      let nx = e.x, ny = e.y
      if (e.pattern === 0) { ny -= st.speed * dt; nx += Math.sin(e.age * 2) * 0.4 * dt }
      else if (e.pattern === 1) { ny -= st.speed * dt; nx += Math.sin(e.age * 4) * 2.2 * dt }
      else { ny -= st.speed * 0.7 * dt; nx = Math.sin(e.age * 1.2) * 3.2 }

      if (st.fire > 0 && now - e.lastShot > st.fire) {
        e.lastShot = now
        const px = s.playerX - nx, pz = s.playerY - ny
        const len = Math.hypot(px, pz) || 1
        s.addBullet({ x: nx, y: 0.3, z: ny, vx: (px / len) * 5, vy: 0, vz: (pz / len) * 5, isEnemy: true, damage: 12, radius: 0.22, glow: '#ff3355' })
      }

      if (ny < -9) { s.removeEnemy(e.id); continue }
      // update positions in store lightly
      e.x = nx; e.y = ny
    }
    // force re-render via shallow copy occasionally not needed — we mutate and set
    useGameStore.setState({ enemies: s.enemies.map((e) => ({ ...e })) })

    // collisions player bullets handled in Bullets; here player body vs enemy
    for (const e of s.enemies) {
      if (Math.hypot(e.x - s.playerX, e.y - s.playerY) < 0.9) {
        s.damagePlayer(20)
        s.addExplosion(e.x, 0.2, e.y, 1.2)
        s.removeEnemy(e.id)
        sounds.enemyHit()
      }
    }
  })

  return (
    <>
      {enemies.map((e) => {
        const st = STATS[e.type]
        return (
          <group key={e.id} position={[e.x, 0.25, e.y]} rotation={[0, Math.PI, 0]}>
            <GlbModel path={st.model} size={st.size} />
            {/* silhouette ring so enemies pop */}
            <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.5, 0.62, 24]} />
              <meshBasicMaterial color="#ff4d4d" transparent opacity={0.5} toneMapped={false} />
            </mesh>
          </group>
        )
      })}
    </>
  )
}
