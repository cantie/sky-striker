import type { ReactNode } from 'react'
import * as THREE from 'three'
import type { GroundSkin } from '../../game/roster'

/**
 * Procedural ground units (no tank models in the asset packs). Built nose-forward on +Z;
 * `heading` turns the chassis, `aim` (world-space) turns the gun independently.
 */

function Part({ args, position, color, rotation, emissive }: {
  args: [number, number, number]; position: [number, number, number]; color: string
  rotation?: [number, number, number]; emissive?: string
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} roughness={0.65} metalness={0.25} emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? 1.2 : 0} />
    </mesh>
  )
}

function Cyl({ r, h, position, color, rotation, segments = 12, rTop }: {
  r: number; h: number; position: [number, number, number]; color: string
  rotation?: [number, number, number]; segments?: number; rTop?: number
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <cylinderGeometry args={[rTop ?? r, r, h, segments]} />
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
    </mesh>
  )
}

/** Rotating gun turret, twin barrels optional. */
function Gun({ skin, y, twin = false, aimLocal }: { skin: GroundSkin; y: number; twin?: boolean; aimLocal: number }) {
  const barrels = twin ? [-0.09, 0.09] : [0]
  return (
    <group position={[0, y, 0]} rotation={[0, aimLocal, 0]}>
      <Cyl r={0.3} h={0.2} rTop={0.26} position={[0, 0, -0.04]} color={skin.turret} segments={8} />
      {barrels.map((x) => (
        <group key={x}>
          <Cyl r={0.05} h={0.75} position={[x, 0.03, 0.42]} rotation={[Math.PI / 2, 0, 0]} color="#2a2a2a" segments={8} />
          <Part args={[0.1, 0.1, 0.08]} position={[x, 0.03, 0.8]} color={skin.accent} emissive={skin.accent} />
        </group>
      ))}
      <Cyl r={0.09} h={0.06} position={[-0.08, 0.12, -0.1]} color={skin.hull} segments={8} />
    </group>
  )
}

export function Vehicle({ skin, heading, aim, scale = 1, turret = false }: {
  skin: GroundSkin; heading: number; aim: number; scale?: number; turret?: boolean
}) {
  const aimLocal = aim - heading
  let body: ReactNode
  if (turret) {
    // Fixed emplacement: octagonal bunker with a twin-gun head
    body = (
      <>
        <Cyl r={0.68} h={0.3} rTop={0.6} position={[0, 0.15, 0]} color={skin.turret} segments={8} />
        <Cyl r={0.5} h={0.08} position={[0, 0.32, 0]} color={skin.hull} segments={8} />
        <mesh position={[0, 0.37, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.58, 24]} />
          <meshBasicMaterial color={skin.accent} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        <Gun skin={skin} y={0.48} twin aimLocal={aimLocal} />
      </>
    )
  } else if (skin.vehicle === 'boat') {
    body = (
      <>
        {/* wake */}
        <mesh position={[0, 0.02, -1.05]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.55, 1.4, 1]}>
          <circleGeometry args={[0.6, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.45} depthWrite={false} />
        </mesh>
        <Part args={[0.72, 0.3, 1.2]} position={[0, 0.15, -0.1]} color={skin.hull} />
        <mesh position={[0, 0.15, 0.68]} rotation={[Math.PI / 2, Math.PI / 4, 0]} scale={[1, 1, 0.42]} castShadow>
          <cylinderGeometry args={[0, 0.51, 0.55, 4]} />
          <meshStandardMaterial color={skin.hull} roughness={0.6} />
        </mesh>
        <Part args={[0.5, 0.06, 1.0]} position={[0, 0.32, -0.1]} color="#8a6a4a" />
        <Part args={[0.36, 0.3, 0.32]} position={[0, 0.48, -0.42]} color={skin.turret} />
        <Gun skin={skin} y={0.42} aimLocal={aimLocal} />
      </>
    )
  } else if (skin.vehicle === 'hover') {
    body = (
      <>
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.55, 0.12, 8, 20]} />
          <meshStandardMaterial color="#1a1a14" roughness={0.9} />
        </mesh>
        <Cyl r={0.55} h={0.24} rTop={0.48} position={[0, 0.2, 0]} color={skin.hull} segments={16} />
        {[-0.38, 0.38].map((x) => (
          <mesh key={x} position={[x, 0.34, -0.42]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.13, 12]} />
            <meshBasicMaterial color={skin.accent} toneMapped={false} />
          </mesh>
        ))}
        <Gun skin={skin} y={0.4} aimLocal={aimLocal} />
      </>
    )
  } else {
    body = (
      <>
        {[-0.45, 0.45].map((x) => (
          <group key={x}>
            <Part args={[0.3, 0.26, 1.35]} position={[x, 0.13, 0]} color="#1f1f1c" />
            {[-0.5, -0.17, 0.17, 0.5].map((z) => (
              <Part key={z} args={[0.32, 0.04, 0.08]} position={[x, 0.27, z]} color="#3a3a34" />
            ))}
          </group>
        ))}
        <Part args={[0.66, 0.26, 1.15]} position={[0, 0.24, 0]} color={skin.hull} />
        <Part args={[0.66, 0.1, 0.24]} position={[0, 0.33, 0.48]} color={skin.turret} rotation={[-0.35, 0, 0]} />
        <Part args={[0.5, 0.06, 0.18]} position={[0, 0.38, -0.48]} color={skin.turret} />
        <Gun skin={skin} y={0.47} aimLocal={aimLocal} />
      </>
    )
  }
  return (
    <group scale={scale} rotation={[0, heading, 0]}>
      {body}
    </group>
  )
}
