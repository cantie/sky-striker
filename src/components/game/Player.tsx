import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../store/gameStore'
import { ShipModel, MODEL_PATHS, type MaterialPalette } from './Model'
import { gameDt, gameInterval } from '../../game/speed'

/** Hero livery: white hull, cobalt panels, glowing cyan trim (enemies use warm hostile colours). */
const PLAYER_PALETTE: MaterialPalette = {
  metal: { color: '#eef4ff', metalness: 0.35, roughness: 0.35 },
  metalDark: { color: '#2f63d6', metalness: 0.45, roughness: 0.4 },
  dark: { color: '#141c33', metalness: 0.6, roughness: 0.3 },
  metalRed: { color: '#1fd0ff', emissive: '#19c6ff', emissiveIntensity: 1.4 },
}

export function Player() {
  const group = useRef<THREE.Group>(null)
  const navLights = useRef<THREE.Group>(null)
  const shieldRing = useRef<THREE.Group>(null)
  const bank = useRef(0)
  const lastShot = useRef(0)
  const prevX = useRef(0)

  useFrame((_, rawDt) => {
    const dt = gameDt(rawDt)
    const s = useGameStore.getState()
    if (s.gameState !== 'playing' || !group.current) return
    const { playerX, playerY, weaponLevel, invincibleUntil } = s
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
    const fireRate = gameInterval(Math.max(90, 180 - weaponLevel * 18))
    if (now - lastShot.current > fireRate) {
      lastShot.current = now
      const dmg = 8 + weaponLevel * 3
      const shots: { x: number; vx: number }[] = [{ x: 0, vx: 0 }]
      if (weaponLevel >= 2) { shots.push({ x: -0.35, vx: -0.5 }); shots.push({ x: 0.35, vx: 0.5 }) }
      if (weaponLevel >= 3) { shots.push({ x: -0.7, vx: -1.1 }); shots.push({ x: 0.7, vx: 1.1 }) }
      if (weaponLevel >= 4) { shots.push({ x: 0, vx: 0 }); shots[0].x = -0.12; shots.push({ x: 0.12, vx: 0 }) }
      if (weaponLevel >= 5) { shots.push({ x: -1.0, vx: -1.8 }); shots.push({ x: 1.0, vx: 1.8 }) }
      for (const sh of shots) {
        s.addBullet({ x: playerX + sh.x, y: 0.3, z: playerY + 0.6, vx: sh.vx, vy: 0, vz: 18, isEnemy: false, damage: dmg, radius: 0.12, glow: '#7cf9ff' })
      }
      s.setMuzzleFlash(1)
    }
  })

  return (
    <group ref={group}>
      <ShipModel path={MODEL_PATHS.player} size={2.0} palette={PLAYER_PALETTE} flame="#3fd4ff" core="#ffffff" flames={2} flameScale={1.1} />
      {/* wingtip nav lights, blink together */}
      <group ref={navLights} position={[0, 0.05, -0.15]}>
        <mesh position={[-0.93, 0, 0]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshBasicMaterial color="#ff5577" toneMapped={false} />
        </mesh>
        <mesh position={[0.93, 0, 0]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshBasicMaterial color="#55ffaa" toneMapped={false} />
        </mesh>
      </group>
      <pointLight position={[0, 0.1, -0.9]} color="#4de8ff" intensity={5} distance={3.5} />
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
