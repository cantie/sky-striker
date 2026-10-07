import { useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ENEMY_BULLET_COLOR } from './Bullets'

/**
 * Boss laser skill: a telegraphed charge (energy converging into a growing orb, a shrinking
 * shock ring and a blinking aim line) followed by a thick beam. Boss.tsx drives the state;
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
const LENGTH = 48
const SPARKS = 14

export function BossLaser({ laser, nose }: { laser: MutableRefObject<LaserState>; nose: [number, number, number] }) {
  const root = useRef<THREE.Group>(null)
  const charge = useRef<THREE.Group>(null)
  const fire = useRef<THREE.Group>(null)
  const orb = useRef<THREE.Mesh>(null)
  const halo = useRef<THREE.Mesh>(null)
  const shock = useRef<THREE.Mesh>(null)
  const aimLine = useRef<THREE.Mesh>(null)
  const beamOuter = useRef<THREE.Mesh>(null)
  const beamCore = useRef<THREE.Mesh>(null)
  const sparks = useRef<(THREE.Mesh | null)[]>([])
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
      orb.current?.scale.setScalar((0.15 + p * 0.85) * flicker)
      halo.current?.scale.setScalar((0.3 + p * 1.4) * flicker)
      if (shock.current) {
        // Ring collapsing onto the orb, faster as the charge completes
        const k = (time * (1.2 + p * 2.5)) % 1
        shock.current.scale.setScalar(3.2 * (1 - k) + 0.4)
        ;(shock.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * k
      }
      sparks.current.forEach((m, i) => {
        if (!m) return
        const sd = sparkSeeds[i]
        const k = (time * (1.4 + p * 1.6) + sd.o) % 1
        const r = 3 * (1 - k)
        const a = sd.a + time * 1.5
        m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r)
        m.scale.setScalar(0.5 + k)
        ;(m.material as THREE.MeshBasicMaterial).opacity = k
      })
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
      beamOuter.current?.scale.set(open * pulse, 1, 1)
      beamCore.current?.scale.set(open * (1 + Math.sin(time * 70) * 0.12), 1, 1)
    }
  })

  // Planes lie along +Z (rotated +π/2 about X so their height runs down the beam)
  const along: [number, number, number] = [Math.PI / 2, 0, 0]
  return (
    <group ref={root} position={nose} visible={false}>
      <group ref={charge}>
        <mesh ref={halo}>
          <sphereGeometry args={[0.7, 16, 16]} />
          <meshBasicMaterial color={ENEMY_BULLET_COLOR} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh ref={orb}>
          <sphereGeometry args={[0.45, 16, 16]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
        <mesh ref={shock} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.85, 1, 40]} />
          <meshBasicMaterial color={ENEMY_BULLET_COLOR} transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        {sparkSeeds.map((_, i) => (
          <mesh key={i} ref={(m) => { sparks.current[i] = m }}>
            <sphereGeometry args={[0.09, 6, 6]} />
            <meshBasicMaterial color="#ffd6f6" transparent depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
        <mesh ref={aimLine} rotation={along} position={[0, -0.1, LENGTH / 2]}>
          <planeGeometry args={[0.1, LENGTH]} />
          <meshBasicMaterial color={ENEMY_BULLET_COLOR} transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      </group>

      <group ref={fire} visible={false}>
        <mesh ref={beamOuter} rotation={along} position={[0, 0, LENGTH / 2]}>
          <planeGeometry args={[LASER_HALF_WIDTH * 2.4, LENGTH]} />
          <meshBasicMaterial color={ENEMY_BULLET_COLOR} transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={beamCore} rotation={along} position={[0, 0.05, LENGTH / 2]}>
          <planeGeometry args={[LASER_HALF_WIDTH * 0.8, LENGTH]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.9, 16, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}
