import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore, type Pickup, type PickupType } from '../../store/gameStore'
import { sounds } from '../../hooks/useAudio'
import { gameDt } from '../../game/speed'
import { view } from '../../game/world'

const COLORS: Record<PickupType, string> = {
  powerup: '#ff9800',
  star: '#ffd23f',
  health: '#3ddc84',
  shield: '#2f9bff',
  rescue: '#ff3b5c',
}

/** Flat icon outlines in a ~0.6-unit box, +Y = up on screen. */
function iconShapes(type: PickupType): THREE.Shape[] {
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

function PickupBadge({ type }: { type: PickupType }) {
  const color = COLORS[type]
  const icon = useMemo(() => (type === 'rescue' ? null : new THREE.ShapeGeometry(iconShapes(type))), [type])
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
      {icon ? (
        <mesh geometry={icon} position={[0, 0, 0.01]}>
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ) : (
        // Rescue: red/white lifebuoy
        <group position={[0, 0, 0.01]}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i}>
              <ringGeometry args={[0.15, 0.3, 24, 1, (i * Math.PI) / 2, Math.PI / 2]} />
              <meshBasicMaterial color={i % 2 ? '#ffffff' : color} toneMapped={false} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  )
}

function PickupItem({ pickup }: { pickup: Pickup }) {
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
        <PickupBadge type={pickup.type} />
      </group>
      <mesh ref={halo} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.56, 32]} />
        <meshBasicMaterial color={COLORS[pickup.type]} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function Pickups() {
  const pickups = useGameStore((s) => s.pickups)

  useFrame((_, rawDt) => {
    const dt = gameDt(rawDt)
    const s = useGameStore.getState()
    if (s.gameState !== 'playing') return
    const next = []
    for (const p of s.pickups) {
      const z = p.z - 1.5 * dt
      if (Math.hypot(p.x - s.playerX, z - s.playerY) < 0.85) {
        const collected = s.collectPickup(p.id)
        if (collected) {
          if (collected.type === 'powerup') { s.upgradeWeapon(); sounds.powerup() }
          else if (collected.type === 'health') { s.healPlayer(25); sounds.pickup() }
          else if (collected.type === 'shield') { s.addShield(30); sounds.pickup() }
          else if (collected.type === 'rescue') { s.addScore(150); s.addStar(); sounds.pickup() }
          else { s.addStar(); s.addScore(50); sounds.pickup() }
        }
        continue
      }
      if (z > view.bottom - 1) next.push({ ...p, z })
      // Escaped pickups stay in spawned count (collect-all fails) — just despawn visually
    }
    useGameStore.setState({ pickups: next })
  })

  return (
    <>
      {pickups.map((p) => <PickupItem key={p.id} pickup={p} />)}
    </>
  )
}
