import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../store/gameStore'
import { ShipModel, useModelDims } from './Model'
import { gameDt, gameInterval } from '../../game/speed'
import { PLAYER_BULLET_SPEED, weaponStats } from '../../game/weapon'
import { getPlane } from '../../game/planes'
import { ORDER } from '../../game/sim/clock'
import { useSimStep } from '../../game/sim/useSimStep'

/** Skill tuning (game-seconds unless noted). */
const MISSILE_EVERY = 1.4
const NOVA_EVERY = 5
const NOVA_BOLTS = 18
/** AEGIS: a shield of AUTO_SHIELD_MS (real) switches on every AUTO_SHIELD_EVERY game-seconds (~18 s real). */
const AUTO_SHIELD_EVERY = 10
const AUTO_SHIELD_MS = 5000
/** Wingman drone slots relative to the plane. */
const WINGMEN: [number, number][] = [[-1.6, -0.7], [1.6, -0.7]]

export function Player() {
  const group = useRef<THREE.Group>(null)
  const navLights = useRef<THREE.Group>(null)
  const shieldRing = useRef<THREE.Group>(null)
  const bank = useRef(0)
  /** Real ms since the last volley / wingman volley. */
  const sinceShot = useRef(0)
  const sinceWing = useRef(0)
  const prevX = useRef(0)
  const skillClock = useRef({ missile: 0, nova: 0, shield: 0 })
  const planeId = useGameStore((s) => s.progress.plane)
  const downed = useGameStore((s) => s.mode === 'coop' && s.playerHp <= 0)
  const plane = getPlane(planeId)
  const dims = useModelDims(plane.model)
  const wingTip = (dims.x * plane.size) / 2 * 0.92

  // Cannon + skills on the simulation clock; everything visual below in useFrame
  useSimStep(ORDER.player, ({ dt, realDt, step }) => {
    const s = useGameStore.getState()
    if (step === 0) { sinceShot.current = 0; sinceWing.current = 0; skillClock.current = { missile: 0, nova: 0, shield: 0 } }
    // Victory fly-out: hands off the trigger, the plane just climbs off screen
    if (s.gameState !== 'playing' || s.flyout || (s.mode === 'coop' && s.playerHp <= 0)) return
    const { playerX, playerY, weaponPower } = s
    sinceShot.current += realDt * 1000
    sinceWing.current += realDt * 1000

    const w = weaponStats(weaponPower)
    const dmg = w.damage * plane.damage
    const pierce = plane.skill === 'pierce'
    if (sinceShot.current > gameInterval(w.interval * plane.fireRate)) {
      sinceShot.current = 0
      for (const sh of w.streams) {
        s.addBullet({ x: playerX + sh.x, y: 0.3, z: playerY + 0.6, vx: sh.vx, vy: 0, vz: PLAYER_BULLET_SPEED, isEnemy: false, damage: dmg, radius: w.radius, pierce })
      }
      s.setMuzzleFlash(1)
    }

    // ── Plane skills ──
    if (plane.skill === 'wingmen' && sinceWing.current > gameInterval(w.interval * 1.3)) {
      sinceWing.current = 0
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
    if (plane.skill === 'autoShield') {
      skillClock.current.shield += dt
      if (skillClock.current.shield >= AUTO_SHIELD_EVERY) {
        skillClock.current.shield = 0
        s.addShield(AUTO_SHIELD_MS)
      }
    }
  })

  useFrame((_, rawDt) => {
    const dt = gameDt(rawDt)
    const s = useGameStore.getState()
    if (s.gameState !== 'playing' || !group.current) return
    const { playerX, playerY, invincibleUntil } = s
    group.current.position.set(playerX, 0.2, playerY)
    const vx = playerX - prevX.current
    prevX.current = playerX
    bank.current = THREE.MathUtils.lerp(bank.current, -vx * 8, 1 - Math.pow(0.001, dt))
    group.current.rotation.z = bank.current
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, Math.min(0.25, Math.abs(vx) * 0.4), 0.1)

    const blink = !downed && Date.now() < invincibleUntil && Math.floor(Date.now() / 80) % 2 === 0
    group.current.visible = !blink

    if (navLights.current) navLights.current.visible = Date.now() % 900 < 160
    if (shieldRing.current) {
      // Temporary shield bubble; flickers during its last 1.5 s as a warning
      const left = s.shieldMs
      const ending = left > 0 && left < 1500 && Math.floor(Date.now() / 110) % 2 === 0
      shieldRing.current.visible = left > 0 && !ending
      shieldRing.current.scale.setScalar(1 + Math.sin(Date.now() * 0.004) * 0.04)
      const [bubble, rim] = shieldRing.current.children as THREE.Mesh[]
      ;(bubble.material as THREE.MeshBasicMaterial).opacity = 0.2
      ;(rim.material as THREE.MeshBasicMaterial).opacity = 0.7
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
      {downed && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
          <ringGeometry args={[1.15, 1.35, 32]} />
          <meshBasicMaterial color="#ff5252" transparent opacity={0.9} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
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
