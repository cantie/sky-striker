import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { flameMaterial, fxQuad, spriteMaterial } from './fx/materials'

/** The flame quad, from the nozzle (z = 0) back to the tail (z = −1). Shared by every flame. */
const FLAME_QUAD = fxQuad().translate(0, 0, -0.5)
const GLOW_QUAD = fxQuad()

/**
 * Additive exhaust plume pointing down local −Z (the tail of a +Z-facing ship): one shader quad (a
 * flickering white-hot core cooling into the colour, thinning to nothing at the tail) and a hot glow on
 * the nozzle. Two draw calls.
 */
export function EngineFlame({
  position, color = '#4de8ff', core = '#ffffff', length = 0.7, width = 0.13, intensity = 1,
}: {
  position: [number, number, number]; color?: string; core?: string
  length?: number; width?: number; intensity?: number
}) {
  const plume = useRef<THREE.Mesh>(null)
  const seed = useRef(Math.random() * 100)
  const flame = useMemo(() => flameMaterial({ color, core }), [color, core])
  const glow = useMemo(() => spriteMaterial({ color: core, intensity: 0.9, hot: 0.35 }), [core])
  useEffect(() => () => flame.dispose(), [flame])
  useEffect(() => () => glow.dispose(), [glow])

  useFrame(({ clock }) => {
    flame.uniforms.uTime.value = clock.elapsedTime
    if (!plume.current) return
    const t = clock.elapsedTime * 38 + seed.current
    const f = 0.82 + Math.sin(t) * 0.1 + Math.sin(t * 2.7) * 0.08
    plume.current.scale.set(width * 2.2, 1, length * 1.25 * f * intensity)
  })

  return (
    <group position={position}>
      <mesh ref={plume} geometry={FLAME_QUAD} material={flame} scale={[width * 2.2, 1, length * 1.25]} />
      <mesh geometry={GLOW_QUAD} material={glow} position={[0, 0.01, 0]} scale={[width * 2.6, 1, width * 2.6]} />
    </group>
  )
}
