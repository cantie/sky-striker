import * as THREE from 'three'
import { PICKUP_LAYERS } from '../../../game/fx/layers'
import { finishMaterial, softMaterial } from './finishes'
import { LOOK, pickupParts, type DropType } from './shapes'

/** Pieces are drawn in XY; turn them to face the top-down camera with +Y pointing screen-up. */
export const FACE_UP: [number, number, number] = [-Math.PI / 2, 0, Math.PI]

const QUAD = new THREE.PlaneGeometry(1, 1)
/** The shadow falls down and to the right of the piece, onto the ground below it. */
const SHADOW_AT: [number, number, number] = [-0.14, -0.3, -0.16]

/** A drop's 3D piece, with its glow and gloss; it turns and pulses as one. */
export function PickupArt({ type }: { type: DropType }) {
  const look = LOOK[type]
  const { glow, gloss } = look
  return (
    <group rotation={FACE_UP}>
      {glow && (
        <mesh geometry={QUAD} material={softMaterial('glow', glow.color)} position={[0, 0, -0.05]} scale={[glow.size, glow.size, 1]} renderOrder={PICKUP_LAYERS.halo} />
      )}
      {pickupParts(type).map((p, i) => (
        <mesh key={i} geometry={p.geometry} material={finishMaterial(p.finish)} renderOrder={PICKUP_LAYERS.piece + i / 100} />
      ))}
      {gloss && (
        <mesh
          geometry={QUAD} material={softMaterial('gloss')} renderOrder={PICKUP_LAYERS.gloss}
          position={[gloss.x, gloss.y, gloss.z]} rotation={[0, 0, gloss.turn]} scale={[gloss.w, gloss.h, 1]}
        />
      )}
    </group>
  )
}

/** The soft shadow a drop casts, which stays put while the piece turns. */
export function PickupShadow({ type }: { type: DropType }) {
  const [w, h] = LOOK[type].shadow
  return (
    <mesh
      geometry={QUAD} material={softMaterial('shadow')} renderOrder={PICKUP_LAYERS.shadow}
      position={SHADOW_AT} rotation={[-Math.PI / 2, 0, 0]} scale={[w, h, 1]}
    />
  )
}
