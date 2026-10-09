import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore, type Enemy } from '../../store/gameStore'
import { getStage, type StageConfig } from '../../game/stages'
import { ROLE_STATS, isGround, type AirRole } from '../../game/roster'
import { GROUND_PATHS, pathPos, type PathParams } from '../../game/paths'
import { GROUND_Y, WORLD_SCROLL, edges, inFireZone, onScreen } from '../../game/world'
import { ShipModel } from './Model'
import { Vehicle } from './Vehicles'
import { sounds } from '../../hooks/useAudio'
import { gameDt } from '../../game/speed'

/** Enemy bullets: small and quick (game units / game-second before stage scaling). */
export const ENEMY_BULLET = { speed: 9, radius: 0.13 }
/** Drop units that never made it on screen (e.g. after a resize) instead of leaking them. */
const NEVER_ENTERED_TIMEOUT = 16

type Queued = { at: number; spec: Omit<Enemy, 'id'> }

function params(e: Pick<Enemy, 'px' | 'py' | 'm' | 'amp' | 'spd'>): PathParams {
  return { x: e.px, y: e.py, m: e.m, a: e.amp, s: e.spd }
}

/** Expand a scripted wave into timed spawns (trains, mirrored twins, multiple lanes). */
function expandWave(stage: StageConfig, index: number, now: number, easy: boolean): Queued[] {
  const wave = stage.waves[index]
  if (!wave) return []
  const hpMult = stage.enemyHpMult * (easy ? 0.75 : 1)
  const out: Queued[] = []
  for (const g of wave) {
    const lanes = Array.isArray(g.x) ? g.x : [g.x ?? 0]
    const sides: (1 | -1)[] = g.m === 'both' ? [1, -1] : [g.m ?? 1]
    const hp = Math.max(8, Math.floor(ROLE_STATS[g.type].hp * hpMult))
    for (const m of sides) {
      for (const lane of lanes) {
        for (let i = 0; i < (g.count ?? 1); i++) {
          out.push({
            at: now + (g.delay ?? 0) + i * (g.gap ?? 0.45),
            spec: {
              x: 0, y: 99, z: 0, type: g.type, hp, maxHp: hp, lastShot: 0, age: 0,
              path: g.path, px: g.m === 'both' && m === -1 ? -lane : lane, py: g.y ?? 0,
              m, amp: g.amp ?? 2, spd: g.speed ?? 1,
              groundDist: 0, entered: false, heading: Math.PI, aim: Math.PI,
            },
          })
        }
      }
    }
  }
  return out
}

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

export function Enemies() {
  const lastWave = useRef(-1)
  const queue = useRef<Queued[]>([])
  const clock = useRef(0)
  const lastScroll = useRef(0)
  const enemies = useGameStore((s) => s.enemies)
  const stageId = useGameStore((s) => s.currentStageId)
  const stage = getStage(stageId)

  useEffect(() => {
    const unsub = useGameStore.subscribe((s) => {
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

        // Survivors stranded on the terrain every other wave (they scroll in from the top edge)
        if (s.waveIndex % 2 === 1) {
          s.addPickup({ x: (Math.random() - 0.5) * 9, y: 0, z: edges().top + 1, type: 'rescue', progress: 0 })
        }
        // Occasional floating star pod
        if (s.waveIndex > 0 && s.waveIndex % 4 === 0) {
          s.addPickup({ x: (Math.random() - 0.5) * 5, y: 0.3, z: 12 + Math.random() * 2, type: 'star' })
        }
      }
      if (s.gameState === 'menu' || s.gameState === 'stageSelect' || s.gameState === 'briefing' || s.gameState === 'results') {
        lastWave.current = -1
        queue.current = []
        lastScroll.current = 0
      }
    })
    return unsub
  }, [])

  useFrame((_, rawDt) => {
    const dt = gameDt(rawDt)
    const s = useGameStore.getState()
    if (s.gameState !== 'playing') return
    const st = getStage(s.currentStageId)
    clock.current += dt

    let scrollDelta = s.scrollOffset - lastScroll.current
    lastScroll.current = s.scrollOffset
    if (scrollDelta < 0 || scrollDelta > 0.2) scrollDelta = 0
    const groundMove = scrollDelta * WORLD_SCROLL

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
      if (ground) e.groundDist += groundMove

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

      if (!e.entered && onScreen(nx, ny, -0.6)) {
        e.entered = true
        // First shot comes a beat after showing up, not instantly
        e.lastShot = e.age - Math.random() * 0.5
      }
      if ((e.entered && !onScreen(nx, ny, 2.5)) || (!e.entered && e.age > NEVER_ENTERED_TIMEOUT)) {
        s.removeEnemy(e.id)
        continue
      }

      // Only shoot while actually on screen and inside the playfield
      const fireMs = e.type === 'basic' ? st.basicFire : role.fire
      const interval = fireMs / st.fireRateMult / 1000
      if (fireMs > 0 && role.shot !== 'none' && e.entered && inFireZone(nx, ny) && e.age - e.lastShot > interval) {
        e.lastShot = e.age
        const shoot = (ang: number, ox = 0) => s.addBullet({
          x: nx + Math.cos(ang) * ox, y: 0.4, z: ny - Math.sin(ang) * ox,
          vx: Math.sin(ang) * bulletSpeed, vy: 0, vz: Math.cos(ang) * bulletSpeed,
          isEnemy: true, damage: 1, radius: ENEMY_BULLET.radius,
        })
        if (role.shot === 'aimed') shoot(e.aim)
        else if (role.shot === 'spread3') [-0.28, 0, 0.28].forEach((d) => shoot(e.aim + d))
        else if (role.shot === 'burst2') { shoot(e.aim, -0.16); shoot(e.aim, 0.16) }
        else if (role.shot === 'down') shoot(Math.PI)
      }

      e.x = nx; e.y = ny
    }
    useGameStore.setState({ enemies: useGameStore.getState().enemies.map((e) => ({ ...e })) })

    // Only aircraft can ram the player; ground units pass underneath
    for (const e of useGameStore.getState().enemies) {
      if (isGround(e.type)) continue
      if (Math.hypot(e.x - s.playerX, e.y - s.playerY) < 0.9) {
        s.damagePlayer(1)
        s.addExplosion(e.x, 0.2, e.y, 1.2)
        s.removeEnemy(e.id)
        sounds.enemyHit()
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
  const base = useRef<{ emissive: THREE.Color; intensity: number }[] | null>(null)
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
    if (!base.current) base.current = mats.current.map((m) => ({ emissive: m.emissive.clone(), intensity: m.emissiveIntensity }))
    const flashing = Date.now() < flashUntil.current
    mats.current.forEach((m, i) => {
      if (flashing) { m.emissive.set('#ffffff'); m.emissiveIntensity = 1.6 }
      else { m.emissive.copy(base.current![i].emissive); m.emissiveIntensity = base.current![i].intensity }
    })
  })

  return (
    <group position={[enemy.x, 0.25, enemy.y]} rotation={[0, enemy.heading, 0]}>
      <group ref={bankGroup}>
        <ShipModel path={skin.model} size={skin.size} palette={skin.palette} materialsRef={mats} flame={skin.flame} flames={skin.flames} />
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
