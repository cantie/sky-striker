import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../store/gameStore'
import { sounds } from '../../hooks/useAudio'
import { GROUND_SPEED } from '../../game/world'
import { ORDER } from '../../game/sim/clock'
import { net } from '../../game/sim/net'
import { rand } from '../../game/sim/rng'
import { useSimStep } from '../../game/sim/useSimStep'
import { SELF, magnetReach, stepCoins, type Catcher, type Coin } from '../../game/coins'

/**
 * Gold stars that burst out of destroyed enemies. Kept outside the store (they can number
 * in the dozens) and drawn as two instanced meshes: dark outline + gold star.
 */
const MAX = 400
const coins: Coin[] = []

/** Spray `count` stars out of (x, z). */
export function spawnCoins(x: number, z: number, count: number) {
  for (let i = 0; i < count && coins.length < MAX; i++) {
    const ang = rand('coins') * Math.PI * 2
    const speed = 3 + rand('coins') * 5 + Math.min(count, 30) * 0.08
    coins.push({ x, z, vx: Math.sin(ang) * speed, vz: Math.cos(ang) * speed, spin: (rand('coins') - 0.5) * 8, rot: rand('coins') * 6, age: 0, by: null })
  }
}

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
  const lastSound = useRef(0)

  useSimStep(ORDER.coins, ({ dt, step }) => {
    const s = useGameStore.getState()
    // First step of a new run: nothing left over from the last one
    if (step === 0) coins.length = 0
    if (s.gameState === 'playing') {
      const catchers: Catcher[] = []
      // Co-op: a downed pilot's (hidden) plane can't touch anything
      if (!s.down) catchers.push({ id: SELF, x: s.playerX, z: s.playerY, magnet: magnetReach(s.progress.plane) })
      // Co-op: wingmates scoop stars up on our screen too (only ours count)
      for (const m of net()?.wingmates() ?? []) catchers.push({ id: m.id, x: m.x, z: m.y, magnet: magnetReach(m.plane) })
      // Loose stars sit on the map and ride along with the terrain
      const picked = stepCoins(coins, dt, dt * GROUND_SPEED, catchers)
      if (picked) {
        for (let k = 0; k < picked; k++) s.addStar()
        s.addScore(picked * 10)
        const now = performance.now()
        if (now - lastSound.current > 70) { sounds.pickup(); lastSound.current = now }
      }
    }
  })

  useFrame(() => {
    // Left the stage → clear leftovers
    const { gameState } = useGameStore.getState()
    if (gameState === 'menu' || gameState === 'stageSelect' || gameState === 'briefing') coins.length = 0

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
