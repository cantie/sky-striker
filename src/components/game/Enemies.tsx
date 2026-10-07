import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore, type EnemyType } from '../../store/gameStore'
import { getStage } from '../../game/stages'
import { GlbModel, MODEL_PATHS } from './Model'
import { sounds } from '../../hooks/useAudio'
import { gameDt, gameInterval } from '../../game/speed'

const STATS: Record<EnemyType, { hp: number; speed: number; score: number; fire: number; model: string; size: number }> = {
  basic: { hp: 30, speed: 2.2, score: 100, fire: 0, model: MODEL_PATHS.enemyBasic, size: 0.95 },
  fast: { hp: 18, speed: 4.2, score: 150, fire: 0, model: MODEL_PATHS.enemyFast, size: 0.85 },
  heavy: { hp: 80, speed: 1.4, score: 300, fire: 1400, model: MODEL_PATHS.enemyHeavy, size: 1.35 },
  shooter: { hp: 40, speed: 1.8, score: 200, fire: 900, model: MODEL_PATHS.enemyShooter, size: 1.0 },
}

function spawnWave(index: number) {
  const store = useGameStore.getState()
  const stage = getStage(store.currentStageId)
  const wave = stage.waves[Math.min(index, stage.waves.length - 1)]
  if (!wave) return
  const hpMult = stage.enemyHpMult * (store.easyMode ? 0.75 : 1)

  for (const row of wave) {
    for (const x of row.xs) {
      const st = STATS[row.type]
      const hp = Math.max(8, Math.floor(st.hp * hpMult))
      store.addEnemy({
        x, y: 8 + Math.random() * 1.5, z: 0,
        type: row.type, hp, maxHp: hp,
        lastShot: 0, pattern: row.pattern, age: 0,
      })
    }
  }

  // Density: extra basic flyers on harder stages
  if (stage.densityExtra > 0) {
    for (let i = 0; i < stage.densityExtra; i++) {
      const x = (Math.random() - 0.5) * 6
      const st = STATS.basic
      const hp = Math.max(8, Math.floor(st.hp * hpMult))
      store.addEnemy({
        x, y: 9 + Math.random(), z: 0,
        type: 'basic', hp, maxHp: hp,
        lastShot: 0, pattern: 0, age: 0,
      })
    }
  }

  // Occasional rescue / pickup pods mid-stage
  if (index > 0 && index % 2 === 0) {
    store.addPickup({
      x: (Math.random() - 0.5) * 5,
      y: 0.3,
      z: 7 + Math.random() * 2,
      type: Math.random() < 0.55 ? 'rescue' : 'star',
    })
  }
}

export function Enemies() {
  const lastWave = useRef(-1)
  const enemies = useGameStore((s) => s.enemies)

  useEffect(() => {
    const unsub = useGameStore.subscribe((s) => {
      if (
        s.gameState === 'playing' &&
        s.waveIndex !== lastWave.current &&
        !s.bossSpawned &&
        s.waveIndex < getStage(s.currentStageId).maxWaves
      ) {
        lastWave.current = s.waveIndex
        spawnWave(s.waveIndex)
      }
      if (s.gameState === 'menu' || s.gameState === 'stageSelect' || s.gameState === 'briefing') {
        lastWave.current = -1
      }
    })
    return unsub
  }, [])

  useFrame((_, rawDt) => {
    const dt = gameDt(rawDt)
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

      if (st.fire > 0 && now - e.lastShot > gameInterval(st.fire)) {
        e.lastShot = now
        const px = s.playerX - nx, pz = s.playerY - ny
        const len = Math.hypot(px, pz) || 1
        s.addBullet({ x: nx, y: 0.3, z: ny, vx: (px / len) * 5, vy: 0, vz: (pz / len) * 5, isEnemy: true, damage: 12, radius: 0.22, glow: '#ff3355' })
      }

      if (ny < -9) { s.removeEnemy(e.id); continue }
      e.x = nx; e.y = ny
    }
    useGameStore.setState({ enemies: s.enemies.map((e) => ({ ...e })) })

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
          <group key={e.id} position={[e.x, 0.25, e.y]}>
            <group scale={[1, 1, -1]}>
              <GlbModel path={st.model} size={st.size} />
              <mesh position={[0, 0.08, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.12, 0.35, 6]} />
                <meshBasicMaterial color="#ff2244" toneMapped={false} />
              </mesh>
              <mesh position={[0, 0, -0.55]}>
                <sphereGeometry args={[0.14, 10, 10]} />
                <meshBasicMaterial color="#ff6644" transparent opacity={0.85} toneMapped={false} />
              </mesh>
            </group>
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
