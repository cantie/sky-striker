import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ENEMY_BULLET_COLOR } from './Bullets'
import { beamMaterial, fxQuad, spriteMaterial } from './fx/materials'

/**
 * Boss laser skill: a telegraphed charge (sparks converging into a growing orb, a shrinking
 * shock ring and a blinking aim line) followed by a layered beam. Boss.tsx drives the state;
 * this component only renders it, in the boss's (unrotated) local space.
 */
export interface LaserState {
  stage: 'idle' | 'charge' | 'fire'
  /** Game-seconds into the current stage. */
  t: number
  /** Beam direction (radians about Y; 0 = +Z, π = toward the player side). */
  angle: number
}

/** Game-seconds (×1/0.55 for real time): ~2 s of warning, ~1.6 s of beam. */
export const LASER_CHARGE = 1.1
export const LASER_FIRE = 0.9
/** Aim stops tracking the player this long before the beam fires — the dodge window. */
export const LASER_LOCK = 0.35
export const LASER_HALF_WIDTH = 0.6
/** Drawn full length, past the screen edge: the hit test has no end either. */
const LENGTH = 48
const SPARKS = 14
/** The beam quad's full width; its glow fades out about where the hit zone ends. */
const BEAM_WIDTH = LASER_HALF_WIDTH * 2.6

const SPARK_COLOR = new THREE.Color('#ffd6f6')
const m4 = new THREE.Matrix4(), quat = new THREE.Quaternion(), at = new THREE.Vector3(), scl = new THREE.Vector3(), tint = new THREE.Color()

function useLaserParts() {
  const parts = useMemo(() => {
    const quad = fxQuad()
    const sparks = new THREE.InstancedMesh(quad, spriteMaterial({ intensity: 1.6, hot: 0.4 }), SPARKS)
    sparks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SPARKS * 3), 3)
    sparks.frustumCulled = false
    const beam = beamMaterial({ color: ENEMY_BULLET_COLOR })
    beam.uniforms.uLength.value = LENGTH
    const parts = {
      quad,
      beamQuad: fxQuad().translate(0, 0, 0.5),
      halo: spriteMaterial({ color: ENEMY_BULLET_COLOR, intensity: 1.3 }),
      orb: spriteMaterial({ color: '#ffd0f4', intensity: 1.4, body: 0.45, hot: 1 }),
      muzzle: spriteMaterial({ color: '#ffd0f4', intensity: 1.5, hot: 1, star: true }),
      beam,
      sparks,
    }
    // Flat glows at the nose: drawn over the boss's own hull, which stands taller than they lie
    for (const m of [parts.halo, parts.orb, parts.muzzle, parts.beam, sparks.material as THREE.Material]) m.depthTest = false
    return parts
  }, [])
  useEffect(() => () => {
    for (const m of [parts.halo, parts.orb, parts.muzzle, parts.beam, parts.sparks.material as THREE.Material]) m.dispose()
    parts.quad.dispose(); parts.beamQuad.dispose()
  }, [parts])
  return parts
}

export function BossLaser({ laser, nose }: { laser: MutableRefObject<LaserState>; nose: [number, number, number] }) {
  const root = useRef<THREE.Group>(null)
  const charge = useRef<THREE.Group>(null)
  const fire = useRef<THREE.Group>(null)
  const orb = useRef<THREE.Mesh>(null)
  const halo = useRef<THREE.Mesh>(null)
  const shock = useRef<THREE.Mesh>(null)
  const aimLine = useRef<THREE.Mesh>(null)
  const muzzle = useRef<THREE.Mesh>(null)
  const parts = useLaserParts()
  const sparkSeeds = useMemo(() => Array.from({ length: SPARKS }, (_, i) => ({ a: (i / SPARKS) * Math.PI * 2 + Math.random() * 0.3, o: Math.random() })), [])

  useFrame(({ clock }) => {
    const L = laser.current
    if (!root.current || !charge.current || !fire.current) return
    root.current.visible = L.stage !== 'idle'
    if (L.stage === 'idle') return
    root.current.rotation.y = L.angle
    const time = clock.elapsedTime
    charge.current.visible = L.stage === 'charge'
    fire.current.visible = L.stage === 'fire'

    if (L.stage === 'charge') {
      const p = Math.min(1, L.t / LASER_CHARGE)
      const flicker = 1 + Math.sin(time * 40) * 0.08
      orb.current?.scale.setScalar((0.15 + p * 0.85) * flicker * 1.1)
      halo.current?.scale.setScalar((0.3 + p * 1.4) * flicker * 1.6)
      if (shock.current) {
        // Ring collapsing onto the orb, faster as the charge completes
        const k = (time * (1.2 + p * 2.5)) % 1
        shock.current.scale.setScalar(3.2 * (1 - k) + 0.4)
        ;(shock.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * k
      }
      // Sparks spiralling in, brighter as they arrive
      const { sparks } = parts
      sparkSeeds.forEach((sd, i) => {
        const k = (time * (1.4 + p * 1.6) + sd.o) % 1
        const r = 3 * (1 - k)
        const a = sd.a + time * 1.5
        const s = 0.18 + 0.22 * k
        sparks.setMatrixAt(i, m4.compose(at.set(Math.cos(a) * r, 0, Math.sin(a) * r), quat.identity(), scl.set(s, 1, s)))
        sparks.setColorAt(i, tint.copy(SPARK_COLOR).multiplyScalar(k))
      })
      sparks.instanceMatrix.needsUpdate = true
      sparks.instanceColor!.needsUpdate = true
      if (aimLine.current) {
        // Warning line blinks faster and brighter as the shot approaches; solid once aim locks
        const locked = L.t > LASER_CHARGE - LASER_LOCK
        const blink = locked ? 1 : Math.sin(time * (10 + p * 30)) > 0 ? 1 : 0.25
        ;(aimLine.current.material as THREE.MeshBasicMaterial).opacity = (0.25 + p * 0.55) * blink
        aimLine.current.scale.x = locked ? 2.2 : 1
      }
    } else {
      const p = Math.min(1, L.t / LASER_FIRE)
      // Snap open, hold, then pinch off
      const open = Math.min(1, L.t / 0.08) * (p > 0.85 ? (1 - p) / 0.15 : 1)
      const pulse = 1 + Math.sin(time * 50) * 0.08
      parts.beam.uniforms.uOpen.value = open * pulse
      parts.beam.uniforms.uTime.value = time
      if (muzzle.current) {
        const s = (1.5 + Math.random() * 0.5) * Math.max(open, 0.3)
        muzzle.current.scale.set(s, 1, s)
        muzzle.current.rotation.y = Math.random() * Math.PI
      }
    }
  })

  // Planes lie along +Z (rotated +π/2 about X so their height runs down the beam)
  const along: [number, number, number] = [Math.PI / 2, 0, 0]
  return (
    <group ref={root} position={nose} visible={false}>
      <group ref={charge}>
        <mesh ref={halo} geometry={parts.quad} material={parts.halo} />
        <mesh ref={orb} geometry={parts.quad} material={parts.orb} position={[0, 0.02, 0]} />
        <mesh ref={shock} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.85, 1, 40]} />
          <meshBasicMaterial color={ENEMY_BULLET_COLOR} transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        <primitive object={parts.sparks} />
        <mesh ref={aimLine} rotation={along} position={[0, -0.1, LENGTH / 2]}>
          <planeGeometry args={[0.1, LENGTH]} />
          <meshBasicMaterial color={ENEMY_BULLET_COLOR} transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      </group>

      <group ref={fire} visible={false}>
        <mesh geometry={parts.beamQuad} material={parts.beam} scale={[BEAM_WIDTH, 1, LENGTH]} />
        <mesh ref={muzzle} geometry={parts.quad} material={parts.muzzle} position={[0, 0.05, 0]} />
      </group>
    </group>
  )
}
