import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore, type Enemy, type EnemyType } from '../../store/gameStore'
import { getStage } from '../../game/stages'
import { GlbModel, MODEL_PATHS, type MaterialPalette } from './Model'
import { EngineFlame } from './EngineFlame'
import { sounds } from '../../hooks/useAudio'
import { gameDt, gameInterval } from '../../game/speed'

const STATS: Record<EnemyType, { hp: number; speed: number; score: number; fire: number; model: string; size: number }> = {
  basic: { hp: 30, speed: 2.2, score: 100, fire: 0, model: MODEL_PATHS.enemyBasic, size: 1.25 },
  fast: { hp: 18, speed: 4.2, score: 150, fire: 0, model: MODEL_PATHS.enemyFast, size: 1.15 },
  heavy: { hp: 80, speed: 1.4, score: 300, fire: 1400, model: MODEL_PATHS.enemyHeavy, size: 1.85 },
  shooter: { hp: 40, speed: 1.8, score: 200, fire: 900, model: MODEL_PATHS.enemyShooter, size: 1.35 },
}

/** Hostile liveries per type (Kenney material names) + exhaust layout in mirrored local space (tail = −Z). */
const LOOKS: Record<EnemyType, { palette: MaterialPalette; flame: string; flames: [number, number][]; flameLen: number; flameWidth: number }> = {
  basic: {
    palette: {
      metal: { color: '#c9cbd2', metalness: 0.4, roughness: 0.4 },
      metalDark: { color: '#c0242f' },
      dark: { color: '#2a1216' },
      metalRed: { color: '#ff3b2f', emissive: '#ff2a1a', emissiveIntensity: 1.2 },
    },
    flame: '#ff6a3d', flames: [[0, -0.62]], flameLen: 0.6, flameWidth: 0.11,
  },
  fast: {
    palette: {
      metal: { color: '#f3e7c6', metalness: 0.3, roughness: 0.35 },
      metalDark: { color: '#e88a0c' },
      dark: { color: '#2b1b08' },
      metalRed: { color: '#ffd23f', emissive: '#ffc21a', emissiveIntensity: 1.3 },
    },
    flame: '#ffcf4a', flames: [[0, -0.58]], flameLen: 0.9, flameWidth: 0.09,
  },
  heavy: {
    palette: {
      metal: { color: '#8e88a8', metalness: 0.55, roughness: 0.45 },
      metalDark: { color: '#4b2a7a' },
      dark: { color: '#1b1428' },
      metalRed: { color: '#c04dff', emissive: '#a52bff', emissiveIntensity: 1.3 },
    },
    flame: '#c46bff', flames: [[-0.28, -0.9], [0.28, -0.9]], flameLen: 0.7, flameWidth: 0.14,
  },
  shooter: {
    palette: {
      metal: { color: '#dcd2d4', metalness: 0.4, roughness: 0.4 },
      metalDark: { color: '#7c1032' },
      dark: { color: '#230a13' },
      metalRed: { color: '#ff2a6a', emissive: '#ff1a5e', emissiveIntensity: 1.3 },
    },
    flame: '#ff3f7a', flames: [[-0.2, -0.65], [0.2, -0.65]], flameLen: 0.6, flameWidth: 0.1,
  },
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
      {enemies.map((e) => <EnemyShip key={e.id} enemy={e} />)}
    </>
  )
}

const HIT_FLASH_MS = 90

function EnemyShip({ enemy }: { enemy: Enemy }) {
  const st = STATS[enemy.type]
  const look = LOOKS[enemy.type]
  const bankGroup = useRef<THREE.Group>(null)
  const mats = useRef<THREE.MeshStandardMaterial[]>([])
  const base = useRef<{ emissive: THREE.Color; intensity: number }[] | null>(null)
  const prevHp = useRef(enemy.hp)
  const prevX = useRef(enemy.x)
  const flashUntil = useRef(0)
  const latest = useRef(enemy)
  latest.current = enemy

  if (enemy.hp < prevHp.current) flashUntil.current = Date.now() + HIT_FLASH_MS
  prevHp.current = enemy.hp

  useFrame((_, rawDt) => {
    const dt = gameDt(rawDt)
    const e = latest.current
    if (bankGroup.current && dt > 0) {
      // Roll into lateral motion: the wing on the side it drifts toward dips (same sign as Player)
      const vx = (e.x - prevX.current) / dt
      bankGroup.current.rotation.z = THREE.MathUtils.lerp(bankGroup.current.rotation.z, THREE.MathUtils.clamp(-vx * 0.18, -0.6, 0.6), 1 - Math.pow(0.002, dt))
    }
    prevX.current = e.x

    if (!mats.current.length) return
    if (!base.current) base.current = mats.current.map((m) => ({ emissive: m.emissive.clone(), intensity: m.emissiveIntensity }))
    const flashing = Date.now() < flashUntil.current
    mats.current.forEach((m, i) => {
      if (flashing) { m.emissive.set('#ffffff'); m.emissiveIntensity = 1.6 }
      else { m.emissive.copy(base.current![i].emissive); m.emissiveIntensity = base.current![i].intensity }
    })
  })

  return (
    <group position={[enemy.x, 0.25, enemy.y]}>
      <group ref={bankGroup}>
        {/* Z-mirror: nose aims at the player (−Z); local −Z is now the tail */}
        <group scale={[1, 1, -1]}>
          <GlbModel path={st.model} size={st.size} palette={look.palette} materialsRef={mats} />
          {look.flames.map(([x, z], i) => (
            <EngineFlame key={i} position={[x, 0.02, z]} color={look.flame} core="#fff2d0" length={look.flameLen} width={look.flameWidth} />
          ))}
        </group>
      </group>
    </group>
  )
}
