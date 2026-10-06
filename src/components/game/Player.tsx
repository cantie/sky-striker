import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../store/gameStore'
import { GlbModel, MODEL_PATHS } from './Model'

export function Player() {
  const group = useRef<THREE.Group>(null)
  const glow = useRef<THREE.Mesh>(null)
  const shieldRing = useRef<THREE.Mesh>(null)
  const bank = useRef(0)
  const lastShot = useRef(0)
  const prevX = useRef(0)

  useFrame((_, dt) => {
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

    if (glow.current) {
      const mat = glow.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.55 + Math.sin(Date.now() * 0.02) * 0.25
      glow.current.scale.setScalar(0.9 + Math.sin(Date.now() * 0.025) * 0.2)
    }
    if (shieldRing.current) {
      const sh = s.playerShield
      shieldRing.current.visible = sh > 0
      const mat = shieldRing.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.25 + Math.min(0.35, sh / 200)
    }

    const now = Date.now()
    const fireRate = Math.max(90, 180 - weaponLevel * 18)
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
      <group rotation={[0, 0, 0]}>
        <GlbModel path={MODEL_PATHS.player} size={1.35} />
      </group>
      <mesh ref={glow} position={[0, -0.05, -0.7]}>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshBasicMaterial color="#4de8ff" transparent opacity={0.7} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 0.05, -0.55]} color="#4de8ff" intensity={4} distance={3} />
      <mesh ref={shieldRing} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.75, 0.95, 32]} />
        <meshBasicMaterial color="#4fc3f7" transparent opacity={0.35} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {useGameStore.getState().muzzleFlash > 0 && (
        <mesh position={[0, 0.1, 0.7]}>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshBasicMaterial color="#fff7a0" transparent opacity={0.8} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}
