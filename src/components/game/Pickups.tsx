import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore, type Pickup } from '../../store/gameStore'
import { GROUND_SPEED, GROUND_Y, view } from '../../game/world'
import { ORDER } from '../../game/sim/clock'
import { net } from '../../game/sim/net'
import { useSimStep } from '../../game/sim/useSimStep'
import { PICKUP_LAYERS } from '../../game/fx/layers'
import { applyPickup } from './effects'
import { FACE_UP, PickupArt, PickupShadow } from './pickups/PickupArt'
import { LOOK, type DropType } from './pickups/shapes'

function PickupItem({ pickup, type }: { pickup: Pickup; type: DropType }) {
  const g = useRef<THREE.Group>(null)
  const halo = useRef<THREE.Mesh>(null)
  const seed = useMemo(() => Math.random() * 10, [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed
    if (g.current) {
      g.current.scale.setScalar(1 + Math.sin(t * 5) * 0.04)
      // A slow rock, so the light slides across the metal and glass
      g.current.rotation.set(Math.sin(t * 1.9) * 0.22, 0, Math.sin(t * 1.3 + 1) * 0.22)
    }
    if (halo.current) {
      // Expanding ping ring draws the eye
      const k = (t * 0.9) % 1
      halo.current.scale.setScalar(1 + k * 0.7)
      ;(halo.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - k)
    }
  })
  return (
    <group position={[pickup.x, 0.6, pickup.z]}>
      <PickupShadow type={type} />
      <group ref={g}>
        <PickupArt type={type} />
      </group>
      <mesh ref={halo} rotation={[-Math.PI / 2, 0, 0]} renderOrder={PICKUP_LAYERS.halo}>
        <ringGeometry args={[0.72, 0.78, 40]} />
        <meshBasicMaterial color={LOOK[type].halo} transparent depthWrite={false} depthTest={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Hover within this distance of a survivor… */
const RESCUE_RADIUS = 2.6
/** …for this many real seconds to lift them out. */
const RESCUE_SECONDS = 2
const ARC_STEPS = 64
/** Progress ring hugging the (small) survivor; the (invisible) rescue zone is much wider. */
const RING_IN = 0.62, RING_OUT = 0.8

/**
 * One flat piece of the survivor pictogram, with a dark outline drawn behind it. Survivor parts are
 * `transparent` (fully opaque) so they draw in the see-through pass after explosion smoke, which lies
 * nearer the camera than the ground they stand on and would otherwise cover them.
 */
function FigurePart({ shape, size, at, color }: { shape: 'circle' | 'box'; size: [number, number]; at: [number, number]; color: string }) {
  const geo = (pad: number) => (shape === 'circle'
    ? <circleGeometry args={[size[0] + pad, 16]} />
    : <planeGeometry args={[size[0] + pad * 2, size[1] + pad * 2]} />)
  return (
    <group position={[at[0], at[1], 0]}>
      <mesh>{geo(0.035)}<meshBasicMaterial color="#14101c" transparent /></mesh>
      <mesh position={[0, 0, 0.01]}>{geo(0)}<meshBasicMaterial color={color} toneMapped={false} transparent /></mesh>
    </group>
  )
}

/** A stranded survivor on the terrain: waving figure and a progress ring that fills while rescuing. */
function Survivor({ pickup }: { pickup: Pickup }) {
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const beacon = useRef<THREE.Mesh>(null)
  const seed = useMemo(() => Math.random() * 10, [])
  const progress = pickup.progress ?? 0
  const steps = Math.round(progress * ARC_STEPS)
  // Fills clockwise from 12 o'clock
  const arc = useMemo(() => {
    if (steps <= 0) return null
    const len = (steps / ARC_STEPS) * Math.PI * 2
    return new THREE.RingGeometry(RING_IN, RING_OUT, ARC_STEPS, 1, Math.PI / 2 - len, len)
  }, [steps])
  useEffect(() => () => arc?.dispose(), [arc])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 7 + seed
    // Both arms wave overhead
    if (armL.current) armL.current.rotation.z = 0.5 + Math.sin(t) * 0.35
    if (armR.current) armR.current.rotation.z = -0.5 - Math.sin(t + 1.4) * 0.35
    if (beacon.current) beacon.current.visible = (clock.elapsedTime * 2.5 + seed) % 1 < 0.5
  })

  const arms: [RefObject<THREE.Group | null>, number][] = [[armL, -0.15], [armR, 0.15]]
  return (
    <group position={[pickup.x, GROUND_Y, pickup.z]}>
      <group rotation={FACE_UP} position={[0, 0.05, 0]}>
        <mesh position={[0, 0, 0.02]}>
          <ringGeometry args={[RING_IN, RING_OUT, 64]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.45} depthWrite={false} />
        </mesh>
        {arc && (
          <mesh geometry={arc} position={[0, 0, 0.03]}>
            <meshBasicMaterial color="#3dff8a" toneMapped={false} transparent />
          </mesh>
        )}
      </group>

      {/* Flat pictogram facing the top-down camera (a 3D figure only shows its head from above) */}
      <group rotation={FACE_UP} position={[0, 0.12, 0]} scale={0.85}>
        <mesh position={[0, 0, -0.01]}>
          <circleGeometry args={[0.62, 24]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.55} depthWrite={false} />
        </mesh>
        <FigurePart shape="circle" size={[0.16, 0]} at={[0, 0.4]} color="#f2c9a0" />
        <FigurePart shape="box" size={[0.28, 0.36]} at={[0, 0.08]} color="#ff7a1a" />
        <FigurePart shape="box" size={[0.1, 0.3]} at={[-0.075, -0.24]} color="#2a3550" />
        <FigurePart shape="box" size={[0.1, 0.3]} at={[0.075, -0.24]} color="#2a3550" />
        {arms.map(([ref, x]) => (
          // Shoulder pivot; the arm points up and waves side to side
          <group key={x} ref={ref} position={[x, 0.22, 0]}>
            <FigurePart shape="box" size={[0.09, 0.32]} at={[0, 0.15]} color="#ff7a1a" />
          </group>
        ))}
        <mesh ref={beacon} position={[0, 0.66, 0.02]}>
          <circleGeometry args={[0.07, 12]} />
          <meshBasicMaterial color="#3dff8a" toneMapped={false} transparent />
        </mesh>
      </group>
    </group>
  )
}

export function Pickups() {
  const pickups = useGameStore((s) => s.pickups)

  useSimStep(ORDER.pickups, ({ dt, realDt }) => {
    const s = useGameStore.getState()
    if (s.gameState !== 'playing') return
    // Everything here sits on the map and scrolls with it
    const groundMove = dt * GROUND_SPEED
    const n = net()
    // Co-op: a downed pilot's (hidden) plane can't touch anything
    const canTouch = !s.down
    // Single-player: ours right away. Co-op: claim it; the server's PICKED says who got it
    const take = (p: Pickup) => {
      if (!s.collectPickup(p.id)) return
      if (n) n.pickup(p.id)
      else applyPickup(p.type)
    }

    const next = []
    for (const p of s.pickups) {
      if (p.type === 'rescue') {
        // Survivors stand still on the terrain; hovering over them fills the rescue ring
        const z = p.z - groundMove
        const near = canTouch && Math.hypot(p.x - s.playerX, z - s.playerY) < RESCUE_RADIUS
        const progress = near
          ? (p.progress ?? 0) + realDt / RESCUE_SECONDS
          : Math.max(0, (p.progress ?? 0) - realDt / (RESCUE_SECONDS * 2))
        if (progress >= 1) {
          take(p)
          continue
        }
        if (z > view.bottom - 2) next.push({ ...p, z, progress })
        continue
      }
      // Floating drops ride the map too
      const z = p.z - groundMove
      if (canTouch && Math.hypot(p.x - s.playerX, z - s.playerY) < 0.85) {
        take(p)
        continue
      }
      if (z > view.bottom - 1) next.push({ ...p, z })
      // Escaped pickups/survivors stay in the spawned count (collect-all fails) — just despawn
    }
    useGameStore.setState({ pickups: next })
  })

  return (
    <>
      {pickups.map((p) => (p.type === 'rescue'
        ? <Survivor key={p.id} pickup={p} />
        : <PickupItem key={p.id} pickup={p} type={p.type} />))}
    </>
  )
}
