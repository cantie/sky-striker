import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../store/gameStore'
import { sounds } from '../../hooks/useAudio'
import { gameDt } from '../../game/speed'
import { view } from '../../game/world'

/**
 * Gold stars that burst out of destroyed enemies. Kept outside the store (they can number
 * in the dozens) and drawn as two instanced meshes: dark outline + gold star.
 */
type Coin = { x: number; z: number; vx: number; vz: number; spin: number; rot: number; age: number }

const MAX = 400
const coins: Coin[] = []

/** Spray `count` stars out of (x, z). */
export function spawnCoins(x: number, z: number, count: number) {
  for (let i = 0; i < count && coins.length < MAX; i++) {
    const ang = Math.random() * Math.PI * 2
    const speed = 3 + Math.random() * 5 + Math.min(count, 30) * 0.08
    coins.push({ x, z, vx: Math.sin(ang) * speed, vz: Math.cos(ang) * speed, spin: (Math.random() - 0.5) * 8, rot: Math.random() * 6, age: 0 })
  }
}

/** Within this range stars are pulled toward the plane. */
const MAGNET = 3.2
const PICKUP = 0.8
const DRIFT = 2.2

function starShape(outer: number, inner: number) {
  const s = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = Math.PI / 2 + (i / 10) * Math.PI * 2
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  return new THREE.ShapeGeometry(s)
}

export function Coins() {
  const gold = useRef<THREE.InstancedMesh>(null)
  const rim = useRef<THREE.InstancedMesh>(null)
  const core = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const geos = useMemo(() => ({ gold: starShape(0.38, 0.17), rim: starShape(0.52, 0.26), core: starShape(0.16, 0.07) }), [])
  const lastScroll = useRef(0)
  const lastSound = useRef(0)

  useFrame((_, rawDt) => {
    const s = useGameStore.getState()
    // New run (scroll restarted) or left the stage → clear leftovers
    if (s.scrollOffset < lastScroll.current || s.gameState === 'menu' || s.gameState === 'stageSelect' || s.gameState === 'briefing') coins.length = 0
    lastScroll.current = s.scrollOffset

    if (s.gameState === 'playing') {
      const dt = gameDt(rawDt)
      let picked = 0
      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i]
        c.age += dt
        const dx = s.playerX - c.x, dz = s.playerY - c.z
        const d = Math.hypot(dx, dz)
        if (d < MAGNET && c.age > 0.25) {
          // Magnet: accelerate toward the plane, harder the closer it is
          const pull = 26 * (1 - d / MAGNET) + 8
          c.vx += (dx / (d || 1)) * pull * dt
          c.vz += (dz / (d || 1)) * pull * dt
        } else {
          // Burst slows down, then the star drifts down the screen with the world
          const damp = Math.pow(0.04, dt)
          c.vx *= damp
          c.vz = c.vz * damp + (-DRIFT) * (1 - damp)
        }
        c.x += c.vx * dt
        c.z += c.vz * dt
        c.rot += c.spin * dt
        if (d < PICKUP) {
          coins.splice(i, 1)
          picked++
          continue
        }
        if (c.z < view.bottom - 1 || Math.abs(c.x) > view.halfW + 3) coins.splice(i, 1)
      }
      if (picked) {
        for (let k = 0; k < picked; k++) s.addStar()
        s.addScore(picked * 10)
        const now = performance.now()
        if (now - lastSound.current > 70) { sounds.pickup(); lastSound.current = now }
      }
    }

    for (const [mesh, y] of [[rim.current, 0.55], [gold.current, 0.6], [core.current, 0.65]] as const) {
      if (!mesh) continue
      mesh.count = coins.length
      coins.forEach((c, i) => {
        // Flat star facing the top-down camera, spinning in the ground plane
        dummy.position.set(c.x, y, c.z)
        dummy.rotation.set(-Math.PI / 2, 0, c.rot)
        dummy.scale.setScalar(1 + Math.sin(c.age * 10) * 0.08)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <>
      <instancedMesh ref={rim} args={[geos.rim, undefined, MAX]} frustumCulled={false}>
        <meshBasicMaterial color="#1e1200" />
      </instancedMesh>
      <instancedMesh ref={gold} args={[geos.gold, undefined, MAX]} frustumCulled={false}>
        <meshBasicMaterial color="#ffd23f" toneMapped={false} />
      </instancedMesh>
      {/* hot white centre so the stars sparkle against yellow/orange terrain too */}
      <instancedMesh ref={core} args={[geos.core, undefined, MAX]} frustumCulled={false}>
        <meshBasicMaterial color="#fffbe0" toneMapped={false} />
      </instancedMesh>
    </>
  )
}
