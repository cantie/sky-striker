import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Additive exhaust plume pointing down local −Z (the tail of a +Z-facing ship).
 * Bright core + coloured sheath + hot nozzle glow; flickers so bloom reads it as fire.
 */
export function EngineFlame({
  position, color = '#4de8ff', core = '#ffffff', length = 0.7, width = 0.13, intensity = 1,
}: {
  position: [number, number, number]; color?: string; core?: string
  length?: number; width?: number; intensity?: number
}) {
  const plume = useRef<THREE.Group>(null)
  const seed = useRef(Math.random() * 100)

  useFrame(({ clock }) => {
    if (!plume.current) return
    const t = clock.elapsedTime * 38 + seed.current
    const f = 0.82 + Math.sin(t) * 0.1 + Math.sin(t * 2.7) * 0.08
    plume.current.scale.set(1, 1, f * intensity)
  })

  return (
    <group position={position}>
      <group ref={plume}>
        {/* cone tip at +Y → rotated to −Z, then shifted so its base sits on the nozzle */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -length / 2]}>
          <coneGeometry args={[width, length, 10, 1, true]} />
          <meshBasicMaterial color={color} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -length * 0.3]}>
          <coneGeometry args={[width * 0.5, length * 0.6, 8, 1, true]} />
          <meshBasicMaterial color={core} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      <mesh>
        <sphereGeometry args={[width * 1.1, 10, 10]} />
        <meshBasicMaterial color={core} transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}
