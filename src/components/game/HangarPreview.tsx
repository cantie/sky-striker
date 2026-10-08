import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../store/gameStore'
import { getPlane } from '../../game/planes'
import { view } from '../../game/world'
import { ShipModel } from './Model'

/** The plane being browsed in the hangar, idling on a glowing pad in the upper-middle of the screen. */
export function HangarPreview() {
  const root = useRef<THREE.Group>(null)
  const craft = useRef<THREE.Group>(null)
  const pad = useRef<THREE.Mesh>(null)
  const planeId = useGameStore((s) => s.hangarPlane)
  const plane = getPlane(planeId)
  const owned = useGameStore((s) => s.progress.owned.includes(planeId))

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (root.current) {
      // Clear band between the top bar and the info card, above the cloud deck (y=9)
      root.current.position.set(0, 13, view.top - (view.top - view.bottom) * 0.3)
      root.current.scale.setScalar(Math.min(2.4, view.halfW / 3.2))
    }
    if (craft.current) {
      craft.current.rotation.y = Math.sin(t * 0.6) * 0.45
      craft.current.rotation.z = Math.sin(t * 1.1) * 0.18
      craft.current.position.y = Math.sin(t * 1.6) * 0.08
    }
    if (pad.current) {
      const k = (t * 0.6) % 1
      pad.current.scale.setScalar(1 + k * 0.5)
      ;(pad.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - k)
    }
  })

  return (
    <group ref={root}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]}>
        <circleGeometry args={[1.9, 48]} />
        <meshBasicMaterial color="#0a1830" transparent opacity={0.6} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]}>
        <ringGeometry args={[1.8, 1.9, 64]} />
        <meshBasicMaterial color={plane.flame} toneMapped={false} />
      </mesh>
      <mesh ref={pad} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]}>
        <ringGeometry args={[1.9, 2.0, 64]} />
        <meshBasicMaterial color={plane.flame} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={craft}>
        {/* Locked planes are shown darkened, like a silhouette waiting to be bought */}
        <ShipModel
          key={plane.id}
          path={plane.model}
          size={plane.size}
          palette={owned ? plane.palette : Object.fromEntries(Object.keys(plane.palette).map((k) => [k, { color: '#2a3140' }]))}
          flame={owned ? plane.flame : undefined}
          flames={plane.flames}
          flameScale={1.2}
        />
        {plane.skill === 'wingmen' && [-1.6, 1.6].map((x) => (
          <group key={x} position={[x, 0, -0.7]}>
            <ShipModel path={plane.model} size={0.9} palette={plane.palette} flame={owned ? plane.flame : undefined} flames={1} />
          </group>
        ))}
      </group>
      <pointLight position={[0, 3, 0]} color={plane.flame} intensity={6} distance={8} />
    </group>
  )
}
