import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../store/gameStore'
import { getStage, type StageConfig } from '../../game/stages'
import { BOSSES, type BossAttack, type BossDef } from '../../game/bosses'
import { GROUND_Y, view } from '../../game/world'
import { ShipModel } from './Model'
import { Vehicle } from './Vehicles'
import { gameDt } from '../../game/speed'

/** Boss bullets before stage scaling (game units / game-second). */
const BOSS_BULLET = { speed: 8, radius: 0.15, damage: 13 }

type Volley = { at: number; fire: () => void }
const tri = (t: number) => 2 * Math.abs(2 * (t - Math.floor(t + 0.5))) - 1

/** Where the boss wants to be `t` game-seconds into its fight. */
function movePos(def: BossDef, t: number, hy: number, amp: number) {
  switch (def.move) {
    case 'sway': return { x: amp * Math.sin(0.7 * t), y: hy + 0.5 * Math.sin(1.1 * t) }
    case 'figure8': return { x: amp * Math.sin(0.6 * t), y: hy + 1.6 * Math.sin(1.2 * t) }
    case 'orbit': return { x: amp * 0.85 * Math.cos(0.55 * t), y: hy - 1.2 + 2 * Math.sin(0.55 * t) }
    case 'strafe': return { x: amp * tri(t * 0.11), y: hy + 0.3 * Math.sin(2 * t) }
    case 'drift': return { x: amp * 0.6 * Math.sin(0.35 * t), y: hy + 0.7 * Math.sin(0.5 * t) }
    case 'charge': {
      // Sways, then every 8 s lunges down toward the player and climbs back
      const c = t % 8
      const lunge = c > 5.5 ? Math.sin((Math.PI * (c - 5.5)) / 2.5) : 0
      return { x: amp * 0.8 * Math.sin(0.6 * t), y: hy - 7 * lunge }
    }
  }
}

/** Builds the timed volleys for one attack. Angles: 0 = +Z (up screen), π = toward the player side. */
function planAttack(
  kind: BossAttack, at: number, phase: number, stage: StageConfig, def: BossDef,
  shoot: (ang: number, speedMul?: number, ox?: number, oz?: number) => void,
  aimAt: () => number, bossX: () => number,
): Volley[] {
  const v: Volley[] = []
  const add = (dt: number, fire: () => void) => v.push({ at: at + dt, fire })
  switch (kind) {
    case 'fan': {
      const n = 5 + phase * 2
      add(0, () => { for (let i = 0; i < n; i++) shoot(Math.PI + (i / (n - 1) - 0.5) * 1.3, 1) })
      break
    }
    case 'ring': {
      const n = 14 + phase * 4
      const off = Math.random() * Math.PI
      add(0, () => { for (let i = 0; i < n; i++) shoot(off + (i / n) * Math.PI * 2, 0.75) })
      break
    }
    case 'aimed':
      for (let k = 0; k < 2 + phase; k++) add(k * 0.14, () => { const a = aimAt(); [-0.08, 0, 0.08].forEach((d) => shoot(a + d, 1.15)) })
      break
    case 'spiral': {
      const arms = 2 + phase
      for (let k = 0; k < 12; k++) add(k * 0.09, () => { for (let i = 0; i < arms; i++) shoot(k * 0.32 + (i / arms) * Math.PI * 2, 0.8) })
      break
    }
    case 'twinSpiral':
      for (let k = 0; k < 12; k++) add(k * 0.09, () => {
        for (let i = 0; i < 2; i++) {
          shoot(k * 0.3 + i * Math.PI, 0.8)
          shoot(-k * 0.3 + i * Math.PI + Math.PI / 2, 0.8)
        }
      })
      break
    case 'wall': {
      // A row across the screen with a gap near the player — dodge through it
      for (let row = 0; row < (phase >= 2 ? 2 : 1); row++) {
        add(row * 0.45, () => {
          const gapX = useGameStore.getState().playerX + (Math.random() - 0.5) * 2
          const hw = Math.min(view.halfW, 8.5)
          for (let x = -hw; x <= hw; x += 0.85) {
            if (Math.abs(x - gapX) < 1.3) continue
            shoot(Math.PI, 0.7, x - bossX(), -1)
          }
        })
      }
      break
    }
    case 'stream':
      for (let k = 0; k < 6 + phase * 2; k++) add(k * 0.07, () => shoot(aimAt(), 1.3))
      break
    case 'cross':
      for (let k = 0; k < 3; k++) add(k * 0.18, () => { for (let i = 0; i < 8; i++) shoot(k * 0.2 + (i / 8) * Math.PI * 2, 0.85) })
      break
    case 'scatter': {
      const n = 14 + phase * 4
      add(0, () => { for (let i = 0; i < n; i++) shoot(Math.PI + (Math.random() - 0.5) * 2.4, 0.6 + Math.random() * 0.5) })
      break
    }
    case 'burst':
      for (let k = 0; k < 3; k++) add(k * 0.15, () => { for (let i = 0; i < 10; i++) shoot(k * 0.31 + (i / 10) * Math.PI * 2, 0.9) })
      break
    case 'broadside':
      // Cannons down both flanks of the hull, then one aimed shot from the bow
      for (let k = 0; k < 2 + phase; k++) add(k * 0.12, () => {
        for (const side of [-1, 1]) for (let z = -1.6; z <= 1.6; z += 1.1) shoot(Math.PI + side * 1.15, 0.75, side * 0.6, z)
      })
      add(0.5, () => shoot(aimAt(), 1.25, 0, -2.4))
      break
  }
  return v
}

export function Boss() {
  const group = useRef<THREE.Group>(null)
  const bankGroup = useRef<THREE.Group>(null)
  const boss = useGameStore((s) => s.boss)
  const stageId = useGameStore((s) => s.currentStageId)
  const stage = getStage(stageId)
  const def = BOSSES[stage.boss]
  const mats = useRef<THREE.MeshStandardMaterial[]>([])
  const baseEmissive = useRef<{ c: THREE.Color; i: number }[] | null>(null)
  const prevHp = useRef(boss?.hp ?? 0)
  const flashUntil = useRef(0)
  const clock = useRef(0)
  const fightT = useRef(0)
  const nextAttack = useRef(0)
  const cycle = useRef(0)
  const volleys = useRef<Volley[]>([])

  if (boss && boss.hp < prevHp.current) flashUntil.current = Date.now() + 90
  prevHp.current = boss?.hp ?? 0

  useFrame((_, rawDt) => {
    const dt = gameDt(rawDt)
    const s = useGameStore.getState()
    const b = s.boss
    if (!b || s.gameState !== 'playing' || !group.current) return
    if (b.intro >= 1) {
      // First frame of a fresh fight: drop timers/volleys left over from a previous run
      clock.current = 0; fightT.current = 0; nextAttack.current = 0.6; cycle.current = 0; volleys.current = []
    }
    clock.current += dt

    const hy = Math.min(view.top - 5.5, 12)
    const amp = Math.max(1.5, Math.min(5, view.halfW - def.radius - 0.8))
    let tx = 0, ty = hy
    if (b.intro > 0) {
      b.intro = Math.max(0, b.intro - dt * 0.45)
    } else {
      fightT.current += dt * (1 + 0.2 * (b.phase - 1))
      const p = movePos(def, fightT.current, hy, amp)
      tx = p.x; ty = p.y
    }
    const prevX = b.x
    const k = 1 - Math.pow(b.intro > 0 ? 0.03 : 0.02, dt)
    b.x = THREE.MathUtils.lerp(b.x, tx, k)
    b.y = THREE.MathUtils.lerp(b.y, ty, k)
    group.current.position.set(b.x, def.ground ? GROUND_Y + 0.1 : 0.4, b.y)
    if (bankGroup.current && dt > 0) {
      const vx = (b.x - prevX) / dt
      // Facing the player (rotated π), so world +X drift is the craft's right
      const target = def.ground ? 0 : THREE.MathUtils.clamp(vx * 0.12, -0.45, 0.45)
      bankGroup.current.rotation.z = THREE.MathUtils.lerp(bankGroup.current.rotation.z, target, 1 - Math.pow(0.01, dt))
    }

    // Attacks — only once it has arrived on screen
    if (b.intro <= 0 && clock.current >= nextAttack.current) {
      const intervalMs = (def.interval * (1 - 0.12 * (b.phase - 1))) / stage.fireRateMult
      nextAttack.current = clock.current + intervalMs / 1000
      const allowed = Math.min(def.attacks.length, b.phase + 1)
      const kind = def.attacks[cycle.current % allowed]
      cycle.current++
      const speed = BOSS_BULLET.speed * stage.bulletSpeedMult
      const dmg = BOSS_BULLET.damage * stage.damageMult
      const shoot = (ang: number, mul = 1, ox = 0, oz = 0) => {
        const st = useGameStore.getState()
        const bb = st.boss
        if (!bb) return
        st.addBullet({
          x: bb.x + ox, y: 0.4, z: bb.y - def.radius * 0.5 + oz,
          vx: Math.sin(ang) * speed * mul, vy: 0, vz: Math.cos(ang) * speed * mul,
          isEnemy: true, damage: dmg, radius: BOSS_BULLET.radius,
        })
      }
      const aimAt = () => {
        const st = useGameStore.getState()
        return st.boss ? Math.atan2(st.playerX - st.boss.x, st.playerY - (st.boss.y - def.radius * 0.5)) : Math.PI
      }
      const bossX = () => useGameStore.getState().boss?.x ?? 0
      volleys.current.push(...planAttack(kind, clock.current, b.phase, stage, def, shoot, aimAt, bossX))
    }
    if (volleys.current.length) {
      const due = volleys.current.filter((v) => v.at <= clock.current)
      if (due.length) {
        volleys.current = volleys.current.filter((v) => v.at > clock.current)
        due.forEach((v) => v.fire())
      }
    }

    // Hit flash
    if (mats.current.length) {
      if (!baseEmissive.current) baseEmissive.current = mats.current.map((m) => ({ c: m.emissive.clone(), i: m.emissiveIntensity }))
      const flashing = Date.now() < flashUntil.current
      mats.current.forEach((m, i) => {
        if (flashing) { m.emissive.set('#ffffff'); m.emissiveIntensity = 1.2 }
        else { m.emissive.copy(baseEmissive.current![i].c); m.emissiveIntensity = baseEmissive.current![i].i }
      })
    }
    if (useGameStore.getState().boss === b) useGameStore.setState({ boss: { ...b } })
  })

  if (!boss) return null
  const aim = Math.atan2(useGameStore.getState().playerX - boss.x, useGameStore.getState().playerY - boss.y)
  const hit = Date.now() < flashUntil.current
  return (
    <group ref={group} position={[boss.x, def.ground ? GROUND_Y + 0.1 : 0.4, boss.y]}>
      {/* Every model is nose +Z after ShipModel; turn it to face the player */}
      <group rotation={[0, Math.PI, 0]}>
        <group ref={bankGroup}>
          {def.model ? (
            <ShipModel path={def.model} size={def.size} palette={def.palette} emissive={def.emissive}
              materialsRef={mats} flame={def.flames ? def.flameColor : undefined} flames={def.flames} flameScale={1.3} grounded={def.ground} />
          ) : def.vehicle ? (
            <Vehicle skin={def.vehicle} heading={0} aim={aim - Math.PI} scale={hit ? def.size * 1.04 : def.size} />
          ) : null}
        </group>
      </group>
      <pointLight color={def.flameColor} intensity={4} distance={8} position={[0, 1.2, 0]} />
    </group>
  )
}
