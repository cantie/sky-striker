import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../store/gameStore'

export function Explosions() {
  const explosions = useGameStore((s) => s.explosions)
  const mats = useMemo(() => ({
    core: new THREE.MeshBasicMaterial({ color: '#fff2a8', transparent: true, toneMapped: false }),
    mid: new THREE.MeshBasicMaterial({ color: '#ff6a00', transparent: true, toneMapped: false }),
    outer: new THREE.MeshBasicMaterial({ color: '#ff2244', transparent: true, toneMapped: false }),
  }), [])

  return (
    <>
      {explosions.map((e) => (
        <ExplosionBurst key={e.id} x={e.x} y={e.y} z={e.z} start={e.startTime} scale={e.scale} mats={mats} />
      ))}
    </>
  )
}

function ExplosionBurst({ x, y, z, start, scale, mats }: { x: number; y: number; z: number; start: number; scale: number; mats: any }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!g.current) return
    const t = (Date.now() - start) / 500
    const s = (0.4 + t * 1.8) * scale
    g.current.scale.setScalar(s)
    const a = Math.max(0, 1 - t)
    mats.core.opacity = a
    mats.mid.opacity = a * 0.8
    mats.outer.opacity = a * 0.5
  })
  return (
    <group ref={g} position={[x, y, z]}>
      <mesh material={mats.core}><sphereGeometry args={[0.25, 10, 10]} /></mesh>
      <mesh material={mats.mid}><sphereGeometry args={[0.45, 10, 10]} /></mesh>
      <mesh material={mats.outer}><sphereGeometry args={[0.7, 10, 10]} /></mesh>
      <pointLight color="#ff8800" intensity={4} distance={5} />
    </group>
  )
}
