import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../store/gameStore'
import { ShipModel, useModelDims } from './Model'
import { gameDt, gameInterval } from '../../game/speed'
import { PLAYER_BULLET_SPEED, weaponStats } from '../../game/weapon'
import { getPlane } from '../../game/planes'

/** Skill tuning (game-seconds unless noted). */
const MISSILE_EVERY = 1.4
const NOVA_EVERY = 5
const NOVA_BOLTS = 18
const REGEN_DELAY_MS = 3000
const REGEN_PER_S = 7
const REGEN_CAP = 60
/** Wingman drone slots relative to the plane. */
const WINGMEN: [number, number][] = [[-1.6, -0.7], [1.6, -0.7]]

export function Player() {
  const group = useRef<THREE.Group>(null)
  const navLights = useRef<THREE.Group>(null)
  const shieldRing = useRef<THREE.Group>(null)
  const bank = useRef(0)
  const lastShot = useRef(0)
  const lastWing = useRef(0)
  const prevX = useRef(0)
  const skillClock = useRef({ missile: 0, nova: 0 })
  const planeId = useGameStore((s) => s.progress.plane)
  const plane = getPlane(planeId)
  const dims = useModelDims(plane.model)
  const wingTip = (dims.x * plane.size) / 2 * 0.92

  useFrame((_, rawDt) => {
    const dt = gameDt(rawDt)
    const s = useGameStore.getState()
    if (s.gameState !== 'playing' || !group.current) return
    const { playerX, playerY, weaponPower, invincibleUntil } = s
    group.current.position.set(playerX, 0.2, playerY)
    const vx = playerX - prevX.current
    prevX.current = playerX
    bank.current = THREE.MathUtils.lerp(bank.current, -vx * 8, 1 - Math.pow(0.001, dt))
    group.current.rotation.z = bank.current
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, Math.min(0.25, Math.abs(vx) * 0.4), 0.1)

    const blink = Date.now() < invincibleUntil && Math.floor(Date.now() / 80) % 2 === 0
    group.current.visible = !blink

    if (navLights.current) navLights.current.visible = Date.now() % 900 < 160
    if (shieldRing.current) {
      const sh = s.playerShield
      shieldRing.current.visible = sh > 0
      // Stronger shield → brighter bubble, with a slow breathing pulse
      const pulse = 1 + Math.sin(Date.now() * 0.004) * 0.04
      shieldRing.current.scale.setScalar(pulse)
      const strength = Math.min(1, sh / 100)
      const [bubble, rim] = shieldRing.current.children as THREE.Mesh[]
      ;(bubble.material as THREE.MeshBasicMaterial).opacity = 0.08 + strength * 0.12
      ;(rim.material as THREE.MeshBasicMaterial).opacity = 0.3 + strength * 0.4
    }

    const now = Date.now()
    const w = weaponStats(weaponPower)
    const dmg = w.damage * plane.damage
    const pierce = plane.skill === 'pierce'
    if (now - lastShot.current > gameInterval(w.interval * plane.fireRate)) {
      lastShot.current = now
      for (const sh of w.streams) {
        s.addBullet({ x: playerX + sh.x, y: 0.3, z: playerY + 0.6, vx: sh.vx, vy: 0, vz: PLAYER_BULLET_SPEED, isEnemy: false, damage: dmg, radius: w.radius, pierce })
      }
      s.setMuzzleFlash(1)
    }

    // ── Plane skills ──
    if (plane.skill === 'wingmen' && now - lastWing.current > gameInterval(w.interval * 1.3)) {
      lastWing.current = now
      for (const [ox, oz] of WINGMEN) {
        s.addBullet({ x: playerX + ox, y: 0.3, z: playerY + oz + 0.5, vx: 0, vy: 0, vz: PLAYER_BULLET_SPEED, isEnemy: false, damage: dmg * 0.55, radius: 0.1 })
      }
    }
    if (plane.skill === 'missiles') {
      skillClock.current.missile += dt
      if (skillClock.current.missile >= MISSILE_EVERY) {
        skillClock.current.missile = 0
        for (const side of [-1, 1]) {
          s.addBullet({ x: playerX + side * 0.6, y: 0.3, z: playerY, vx: side * 4, vy: 0, vz: 9, isEnemy: false, damage: 16 + w.level * 4, radius: 0.16, homing: true })
        }
      }
    }
    if (plane.skill === 'nova') {
      skillClock.current.nova += dt
      if (skillClock.current.nova >= NOVA_EVERY) {
        skillClock.current.nova = 0
        for (let i = 0; i < NOVA_BOLTS; i++) {
          const a = (i / NOVA_BOLTS) * Math.PI * 2
          s.addBullet({ x: playerX, y: 0.3, z: playerY, vx: Math.sin(a) * 16, vy: 0, vz: Math.cos(a) * 16, isEnemy: false, damage: dmg * 1.4, radius: 0.18, pierce: true })
        }
        s.addShake(0.2)
      }
    }
    if (plane.skill === 'shieldRegen') {
      // invincibleUntil is set on every hit, so "time since last hit" falls out of it
      const sinceHit = now - (invincibleUntil - 1200)
      if (sinceHit > REGEN_DELAY_MS && s.playerShield < REGEN_CAP) {
        useGameStore.setState({ playerShield: Math.min(REGEN_CAP, s.playerShield + REGEN_PER_S * dt) })
      }
    }
  })

  return (
    <group ref={group}>
      <ShipModel path={plane.model} size={plane.size} palette={plane.palette} flame={plane.flame} core="#ffffff" flames={plane.flames} flameScale={1.1} />
      {plane.skill === 'wingmen' && WINGMEN.map(([ox, oz]) => (
        <group key={ox} position={[ox, 0, oz]}>
          <ShipModel path={plane.model} size={0.9} palette={plane.palette} flame={plane.flame} flames={1} />
        </group>
      ))}
      {/* wingtip nav lights, blink together */}
      <group ref={navLights} position={[0, 0.05, -0.15]}>
        <mesh position={[-wingTip, 0, 0]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshBasicMaterial color="#ff5577" toneMapped={false} />
        </mesh>
        <mesh position={[wingTip, 0, 0]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshBasicMaterial color="#55ffaa" toneMapped={false} />
        </mesh>
      </group>
      <pointLight position={[0, 0.1, -0.9]} color={plane.flame} intensity={5} distance={3.5} />
      <group ref={shieldRing} visible={false}>
        <mesh scale={[1, 0.45, 1]}>
          <sphereGeometry args={[1.25, 32, 16]} />
          <meshBasicMaterial color="#4fc3f7" transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.18, 1.27, 48]} />
          <meshBasicMaterial color="#9be7ff" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {useGameStore.getState().muzzleFlash > 0 && (
        <mesh position={[0, 0.1, 0.9]}>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshBasicMaterial color="#fff7a0" transparent opacity={0.8} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}
