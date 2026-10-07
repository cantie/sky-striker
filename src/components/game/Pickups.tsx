import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore, type Pickup, type PickupType } from '../../store/gameStore'
import { sounds } from '../../hooks/useAudio'
import { gameDt } from '../../game/speed'
import { GROUND_Y, WORLD_SCROLL, view } from '../../game/world'

/** Floating drops (rescue survivors are 3D figures on the ground, see Survivor). */
type DropType = Exclude<PickupType, 'rescue'>

const COLORS: Record<DropType, string> = {
  powerup: '#ff9800',
  star: '#ffd23f',
  health: '#3ddc84',
  shield: '#2f9bff',
}

/** Flat icon outlines in a ~0.6-unit box, +Y = up on screen. */
function iconShapes(type: DropType): THREE.Shape[] {
  if (type === 'star') {
    const s = new THREE.Shape()
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 0.3 : 0.13
      const a = Math.PI / 2 + (i / 10) * Math.PI * 2
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    return [s]
  }
  if (type === 'health') {
    const s = new THREE.Shape()
    const a = 0.27, b = 0.085
    s.moveTo(-b, a); s.lineTo(b, a); s.lineTo(b, b); s.lineTo(a, b); s.lineTo(a, -b); s.lineTo(b, -b)
    s.lineTo(b, -a); s.lineTo(-b, -a); s.lineTo(-b, -b); s.lineTo(-a, -b); s.lineTo(-a, b); s.lineTo(-b, b)
    return [s]
  }
  if (type === 'shield') {
    const s = new THREE.Shape()
    s.moveTo(0, 0.28)
    s.quadraticCurveTo(0.14, 0.2, 0.25, 0.2)
    s.quadraticCurveTo(0.26, -0.12, 0, -0.3)
    s.quadraticCurveTo(-0.26, -0.12, -0.25, 0.2)
    s.quadraticCurveTo(-0.14, 0.2, 0, 0.28)
    return [s]
  }
  // powerup: double chevron pointing up
  const chevron = (y: number) => {
    const s = new THREE.Shape()
    s.moveTo(0, y + 0.16); s.lineTo(0.26, y - 0.06); s.lineTo(0.26, y - 0.16); s.lineTo(0, y + 0.04)
    s.lineTo(-0.26, y - 0.16); s.lineTo(-0.26, y - 0.06)
    return s
  }
  return [chevron(0.1), chevron(-0.14)]
}

/** Shapes are drawn in XY; turn them to face the top-down camera with +Y pointing screen-up. */
const FACE_UP: [number, number, number] = [-Math.PI / 2, 0, Math.PI]

function PickupBadge({ type }: { type: DropType }) {
  const color = COLORS[type]
  const icon = useMemo(() => new THREE.ShapeGeometry(iconShapes(type)), [type])
  return (
    <group rotation={FACE_UP}>
      {/* dark backing disc → contrast on bright terrain; glowing ring → contrast on dark terrain */}
      <mesh position={[0, 0, -0.02]}>
        <circleGeometry args={[0.5, 32]} />
        <meshBasicMaterial color="#0b1020" transparent opacity={0.72} depthWrite={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[0.4, 0.5, 32]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh geometry={icon} position={[0, 0, 0.01]}>
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  )
}

function PickupItem({ pickup, type }: { pickup: Pickup; type: DropType }) {
  const g = useRef<THREE.Group>(null)
  const halo = useRef<THREE.Mesh>(null)
  const seed = useMemo(() => Math.random() * 10, [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed
    if (g.current) g.current.scale.setScalar(1 + Math.sin(t * 5) * 0.06)
    if (halo.current) {
      // Expanding ping ring draws the eye
      const k = (t * 0.9) % 1
      halo.current.scale.setScalar(1 + k * 0.7)
      ;(halo.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - k)
    }
  })
  return (
    <group position={[pickup.x, 0.6, pickup.z]}>
      <group ref={g}>
        <PickupBadge type={type} />
      </group>
      <mesh ref={halo} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.56, 32]} />
        <meshBasicMaterial color={COLORS[type]} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Hover within this distance of a survivor… */
const RESCUE_RADIUS = 1.7
/** …for this many real seconds to lift them out. */
const RESCUE_SECONDS = 2
const ARC_STEPS = 64

/** One flat piece of the survivor pictogram, with a dark outline drawn behind it. */
function FigurePart({ shape, size, at, color }: { shape: 'circle' | 'box'; size: [number, number]; at: [number, number]; color: string }) {
  const geo = (pad: number) => (shape === 'circle'
    ? <circleGeometry args={[size[0] + pad, 16]} />
    : <planeGeometry args={[size[0] + pad * 2, size[1] + pad * 2]} />)
  return (
    <group position={[at[0], at[1], 0]}>
      <mesh>{geo(0.035)}<meshBasicMaterial color="#14101c" /></mesh>
      <mesh position={[0, 0, 0.01]}>{geo(0)}<meshBasicMaterial color={color} toneMapped={false} /></mesh>
    </group>
  )
}

/** A stranded survivor on the terrain: waving figure, rescue zone and a progress ring that fills up. */
function Survivor({ pickup }: { pickup: Pickup }) {
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const zone = useRef<THREE.Mesh>(null)
  const beacon = useRef<THREE.Mesh>(null)
  const seed = useMemo(() => Math.random() * 10, [])
  const progress = pickup.progress ?? 0
  const steps = Math.round(progress * ARC_STEPS)
  // Fills clockwise from 12 o'clock
  const arc = useMemo(() => {
    if (steps <= 0) return null
    const len = (steps / ARC_STEPS) * Math.PI * 2
    return new THREE.RingGeometry(0.95, 1.22, ARC_STEPS, 1, Math.PI / 2 - len, len)
  }, [steps])
  useEffect(() => () => arc?.dispose(), [arc])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 7 + seed
    // Both arms wave overhead
    if (armL.current) armL.current.rotation.z = 0.5 + Math.sin(t) * 0.35
    if (armR.current) armR.current.rotation.z = -0.5 - Math.sin(t + 1.4) * 0.35
    if (zone.current) {
      const mat = zone.current.material as THREE.MeshBasicMaterial
      mat.opacity = progress > 0 ? 0.9 : 0.45 + Math.sin(clock.elapsedTime * 4 + seed) * 0.2
    }
    if (beacon.current) beacon.current.visible = (clock.elapsedTime * 2.5 + seed) % 1 < 0.5
  })

  const arms: [RefObject<THREE.Group | null>, number][] = [[armL, -0.15], [armR, 0.15]]
  return (
    <group position={[pickup.x, GROUND_Y, pickup.z]}>
      <group rotation={FACE_UP} position={[0, 0.05, 0]}>
        <mesh>
          <circleGeometry args={[RESCUE_RADIUS, 48]} />
          <meshBasicMaterial color="#ffe14a" transparent opacity={progress > 0 ? 0.16 : 0.07} depthWrite={false} />
        </mesh>
        <mesh ref={zone} position={[0, 0, 0.01]}>
          <ringGeometry args={[RESCUE_RADIUS - 0.08, RESCUE_RADIUS, 64]} />
          <meshBasicMaterial color="#ffe14a" transparent depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <ringGeometry args={[0.95, 1.22, 64]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.45} depthWrite={false} />
        </mesh>
        {arc && (
          <mesh geometry={arc} position={[0, 0, 0.03]}>
            <meshBasicMaterial color="#3dff8a" toneMapped={false} />
          </mesh>
        )}
      </group>

      {/* Flat pictogram facing the top-down camera (a 3D figure only shows its head from above) */}
      <group rotation={FACE_UP} position={[0, 0.12, 0]} scale={1.35}>
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
          <meshBasicMaterial color="#3dff8a" toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

export function Pickups() {
  const pickups = useGameStore((s) => s.pickups)
  const lastScroll = useRef(0)

  useFrame((_, rawDt) => {
    const dt = gameDt(rawDt)
    const s = useGameStore.getState()
    if (s.gameState !== 'playing') return
    let scrollDelta = s.scrollOffset - lastScroll.current
    lastScroll.current = s.scrollOffset
    if (scrollDelta < 0 || scrollDelta > 0.2) scrollDelta = 0
    const groundMove = scrollDelta * WORLD_SCROLL

    const next = []
    for (const p of s.pickups) {
      if (p.type === 'rescue') {
        // Survivors stand still on the terrain; hovering over them fills the rescue ring
        const z = p.z - groundMove
        const near = Math.hypot(p.x - s.playerX, z - s.playerY) < RESCUE_RADIUS
        const progress = near
          ? (p.progress ?? 0) + rawDt / RESCUE_SECONDS
          : Math.max(0, (p.progress ?? 0) - rawDt / (RESCUE_SECONDS * 2))
        if (progress >= 1) {
          if (s.collectPickup(p.id)) { s.addScore(300); s.addStar(); sounds.powerup() }
          continue
        }
        if (z > view.bottom - 2) next.push({ ...p, z, progress })
        continue
      }
      const z = p.z - 1.5 * dt
      if (Math.hypot(p.x - s.playerX, z - s.playerY) < 0.85) {
        const collected = s.collectPickup(p.id)
        if (collected) {
          if (collected.type === 'powerup') { s.upgradeWeapon(); sounds.powerup() }
          else if (collected.type === 'health') { s.healPlayer(25); sounds.pickup() }
          else if (collected.type === 'shield') { s.addShield(30); sounds.pickup() }
          else { s.addStar(); s.addScore(50); sounds.pickup() }
        }
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
