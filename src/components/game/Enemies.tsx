import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore, type Enemy } from '../../store/gameStore'
import { getStage, type StageConfig } from '../../game/stages'
import { ROLE_STATS, isGround, type AirRole, type ShotKind } from '../../game/roster'
import { GROUND_PATHS, pathPos } from '../../game/paths'
import { NEVER_ENTERED_TIMEOUT, expandWave, params, type Queued } from '../../game/spawns'
import { GROUND_SPEED, GROUND_Y, edges, inFireZone, inWorld } from '../../game/world'
import { ORDER } from '../../game/sim/clock'
import { net } from '../../game/sim/net'
import { rand, randFor } from '../../game/sim/rng'
import { useSimStep } from '../../game/sim/useSimStep'
import { ShipModel } from './Model'
import { applyFlash, captureLooks, type Look } from './materialLook'
import { Vehicle } from './Vehicles'
import { sounds } from '../../hooks/useAudio'
import { gameDt } from '../../game/speed'

/** Enemy bullets: small and quick (game units / game-second before stage scaling). */
export const ENEMY_BULLET = { speed: 9, radius: 0.13 }
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

/** One enemy volley from (x, y); `aim` is the angle toward the target (0 = +Z, π = down screen). */
export function enemyVolley(x: number, y: number, shot: ShotKind, aim: number, speed: number): void {
  const s = useGameStore.getState()
  const shoot = (ang: number, ox = 0) => s.addBullet({
    x: x + Math.cos(ang) * ox, y: 0.4, z: y - Math.sin(ang) * ox,
    vx: Math.sin(ang) * speed, vy: 0, vz: Math.cos(ang) * speed,
    isEnemy: true, damage: 1, radius: ENEMY_BULLET.radius,
  })
  if (shot === 'aimed') shoot(aim)
  else if (shot === 'spread3') [-0.28, 0, 0.28].forEach((d) => shoot(aim + d))
  else if (shot === 'burst2') { shoot(aim, -0.16); shoot(aim, 0.16) }
  else if (shot === 'down') shoot(Math.PI)
}

export function Enemies() {
  const lastWave = useRef(-1)
  const runKey = useRef('')
  const queue = useRef<Queued[]>([])
  const clock = useRef(0)
  const enemies = useGameStore((s) => s.enemies)
  const stageId = useGameStore((s) => s.currentStageId)
  const stage = getStage(stageId)

  useEffect(() => {
    const unsub = useGameStore.subscribe((s) => {
      // A new run (co-op's next stage can start without leaving 'playing'): forget the old queue
      const run = `${s.currentStageId}:${s.runSeed}`
      if (run !== runKey.current) {
        runKey.current = run
        lastWave.current = -1
        queue.current = []
        clock.current = 0
      }
      if (
        s.gameState === 'playing' &&
        s.waveIndex !== lastWave.current &&
        !s.bossSpawned &&
        s.waveIndex < getStage(s.currentStageId).maxWaves
      ) {
        lastWave.current = s.waveIndex
        const st = getStage(s.currentStageId)
        queue.current.push(...expandWave(st, s.waveIndex, clock.current, s.easyMode))
        useGameStore.setState({ pendingSpawns: queue.current.length })

        // Survivors stranded on the terrain every third wave (they scroll in from the top edge)
        if (s.waveIndex % 3 === 1) {
          s.addPickup({ id: `rescue:w${s.waveIndex}`, x: (rand('spawn') - 0.5) * 9, y: 0, z: edges().top + 1, type: 'rescue', progress: 0 })
        }
        // Occasional floating star pod
        if (s.waveIndex > 0 && s.waveIndex % 4 === 0) {
          s.addPickup({ id: `pod:w${s.waveIndex}`, x: (rand('spawn') - 0.5) * 5, y: 0.3, z: 12 + rand('spawn') * 2, type: 'star' })
        }
      }
      if (s.gameState === 'menu' || s.gameState === 'stageSelect' || s.gameState === 'briefing' || s.gameState === 'results') {
        lastWave.current = -1
        queue.current = []
        clock.current = 0
      }
    })
    return unsub
  }, [])

  useSimStep(ORDER.enemies, ({ dt }) => {
    const s = useGameStore.getState()
    if (s.gameState !== 'playing') return
    const st = getStage(s.currentStageId)
    const coop = net() !== null
    clock.current += dt

    // Release queued spawns whose time has come
    if (queue.current.length) {
      const due = queue.current.filter((q) => q.at <= clock.current)
      if (due.length) {
        queue.current = queue.current.filter((q) => q.at > clock.current)
        for (const q of due) {
          const p = pathPos(q.spec.path, 0, params(q.spec))
          s.addEnemy({ ...q.spec, x: p.x, y: p.y })
        }
        useGameStore.setState({ pendingSpawns: queue.current.length })
      }
    }

    const bulletSpeed = ENEMY_BULLET.speed * st.bulletSpeedMult
    for (const e of [...useGameStore.getState().enemies]) {
      const role = ROLE_STATS[e.type]
      const ground = GROUND_PATHS.has(e.path)
      e.age += dt
      // Ground units ride the terrain: scrolled distance is a pure function of age
      if (ground) e.groundDist = e.age * GROUND_SPEED

      const pr = params(e)
      const p = pathPos(e.path, e.age, pr)
      const q = pathPos(e.path, e.age + 0.05, pr)
      const nx = p.x
      const ny = p.y - e.groundDist
      const vx = (q.x - p.x) / 0.05, vy = (q.y - p.y) / 0.05

      // Face along the curve (ground units: along their own drive, ignoring terrain scroll)
      if (e.type !== 'turret') {
        const target = Math.hypot(vx, vy) > 0.35 ? Math.atan2(vx, vy) : ground ? e.heading : Math.PI
        e.heading = wrapAngle(e.heading + wrapAngle(target - e.heading) * (1 - Math.pow(0.002, dt)))
      }
      e.aim = Math.atan2(s.playerX - nx, s.playerY - ny)

      if (!e.entered && inWorld(nx, ny, -0.6)) {
        e.entered = true
        // First shot comes a beat after showing up, not instantly (same jitter on every client)
        e.lastShot = e.age - randFor(`shot:${e.id}`) * 0.5
      }
      if ((e.entered && !inWorld(nx, ny, 2.5)) || (!e.entered && e.age > NEVER_ENTERED_TIMEOUT)) {
        s.removeEnemy(e.id)
        continue
      }

      // Only shoot while actually on screen and inside the playfield
      const fireMs = e.type === 'basic' ? st.basicFire : role.fire
      const interval = fireMs / st.fireRateMult / 1000
      // Co-op: shots aimed at a player come from the server (AIMED) so both clients agree on the target
      const localShot = !coop || role.shot === 'down'
      if (localShot && fireMs > 0 && role.shot !== 'none' && e.entered && inFireZone(nx, ny) && e.age - e.lastShot > interval) {
        e.lastShot = e.age
        enemyVolley(nx, ny, role.shot, e.aim, bulletSpeed)
      }

      e.x = nx; e.y = ny
    }
    useGameStore.setState({ enemies: useGameStore.getState().enemies.map((e) => ({ ...e })) })

    // Only aircraft can ram the player; ground units pass underneath
    for (const e of useGameStore.getState().enemies) {
      if (isGround(e.type) || s.down) continue
      if (Math.hypot(e.x - s.playerX, e.y - s.playerY) < 0.9) {
        s.damagePlayer(1)
        sounds.enemyHit()
        // Co-op: the enemy's fate is the server's call, a ram only hurts us
        if (coop) continue
        s.addExplosion(e.x, 0.2, e.y, 1.2)
        s.removeEnemy(e.id)
      }
    }
  })

  return (
    <>
      {enemies.map((e) => (isGround(e.type)
        ? <GroundUnit key={e.id} enemy={e} stage={stage} />
        : <EnemyShip key={e.id} enemy={e} stage={stage} />))}
    </>
  )
}

const HIT_FLASH_MS = 90

/** Tracks hp drops between renders → timestamp until which the unit should flash. */
function useHitFlash(hp: number) {
  const prevHp = useRef(hp)
  const flashUntil = useRef(0)
  if (hp < prevHp.current) flashUntil.current = Date.now() + HIT_FLASH_MS
  prevHp.current = hp
  return flashUntil
}

function EnemyShip({ enemy, stage }: { enemy: Enemy; stage: StageConfig }) {
  const skin = stage.skins[enemy.type as AirRole]
  const bankGroup = useRef<THREE.Group>(null)
  const mats = useRef<THREE.MeshStandardMaterial[]>([])
  const base = useRef<Look[] | null>(null)
  const prevHeading = useRef(enemy.heading)
  const flashUntil = useHitFlash(enemy.hp)
  const latest = useRef(enemy)
  latest.current = enemy

  useFrame((_, rawDt) => {
    const dt = gameDt(rawDt)
    const e = latest.current
    if (bankGroup.current && dt > 0) {
      // Roll into turns: turning right (heading decreasing) dips the right wing (+rotation.z)
      const omega = wrapAngle(e.heading - prevHeading.current) / dt
      const target = THREE.MathUtils.clamp(-omega * 0.35, -0.7, 0.7)
      bankGroup.current.rotation.z = THREE.MathUtils.lerp(bankGroup.current.rotation.z, target, 1 - Math.pow(0.002, dt))
    }
    prevHeading.current = e.heading

    if (!mats.current.length) return
    if (!base.current) base.current = captureLooks(mats.current)
    applyFlash(mats.current, base.current, Date.now() < flashUntil.current, 1.6)
  })

  return (
    <group position={[enemy.x, 0.25, enemy.y]} rotation={[0, enemy.heading, 0]}>
      <group ref={bankGroup}>
        <ShipModel path={skin.model} size={skin.size} palette={skin.palette} materialsRef={mats} flame={skin.flame} flames={skin.flames} nozzles={skin.nozzles} />
      </group>
    </group>
  )
}

function GroundUnit({ enemy, stage }: { enemy: Enemy; stage: StageConfig }) {
  const flashUntil = useHitFlash(enemy.hp)
  const hit = Date.now() < flashUntil.current
  return (
    <group position={[enemy.x, GROUND_Y, enemy.y]}>
      <Vehicle
        skin={stage.ground}
        heading={enemy.type === 'turret' ? 0 : enemy.heading}
        aim={enemy.aim}
        turret={enemy.type === 'turret'}
        scale={hit ? 1.08 : 1}
      />
      {hit && (
        <mesh position={[0, 0.7, 0]}>
          <sphereGeometry args={[0.35, 10, 10]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.55} toneMapped={false} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}
