import { useMemo, useLayoutEffect, type MutableRefObject } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { MODEL_PATHS, noseIsNegZ, type MaterialPalette } from '../../game/models'
import { EngineFlame } from './EngineFlame'

export { MODEL_PATHS, type ModelKey, type MaterialPalette } from '../../game/models'

export function fitObject(obj: THREE.Object3D, targetSize = 1, axis: 'max' | 'y' = 'max', grounded = false) {
  const box = new THREE.Box3().setFromObject(obj)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const dim = axis === 'y' ? size.y : Math.max(size.x, size.y, size.z)
  const s = dim > 0 ? targetSize / dim : 1
  obj.scale.setScalar(s)
  obj.position.sub(center.multiplyScalar(s))
  if (grounded) {
    const fitted = new THREE.Box3().setFromObject(obj)
    obj.position.y -= fitted.min.y
  }
  return obj
}

export function GlbModel({
  path, size = 1, sizeAxis = 'max', grounded = false, rotation, color, emissive, palette, materialsRef,
  castShadow = true, receiveShadow = true,
}: {
  path: string; size?: number; sizeAxis?: 'max' | 'y'; grounded?: boolean
  rotation?: [number, number, number]; color?: string; emissive?: string
  /** Recolor by GLB material name (e.g. Kenney `metalRed`, `leafsGreen`). */
  palette?: MaterialPalette
  /** Receives this instance's own (cloned) materials, e.g. for hit flashes. */
  materialsRef?: MutableRefObject<THREE.MeshStandardMaterial[]>
  castShadow?: boolean; receiveShadow?: boolean
}) {
  const { scene } = useGLTF(path)
  const paletteKey = palette ? JSON.stringify(palette) : ''
  const obj = useMemo(() => {
    const clone = scene.clone(true)
    // scene.clone shares materials across instances — clone them before mutating
    const custom = !!(color || emissive || palette || materialsRef)
    const owned: THREE.MeshStandardMaterial[] = []
    clone.traverse((c) => {
      const m = c as THREE.Mesh
      if (!m.isMesh) return
      m.castShadow = castShadow
      m.receiveShadow = receiveShadow
      const src = Array.isArray(m.material) ? m.material : [m.material]
      const mats = custom ? src.map((mat) => mat.clone()) : src
      if (custom) m.material = Array.isArray(m.material) ? mats : mats[0]
      mats.forEach((mat) => {
        const std = mat as THREE.MeshStandardMaterial
        if (std && 'color' in std) {
          std.side = THREE.DoubleSide
          if (color) std.color = new THREE.Color(color)
          if (emissive) { std.emissive = new THREE.Color(emissive); std.emissiveIntensity = 0.35 }
          const p = palette?.[std.name]
          if (p) {
            if (p.color) std.color = new THREE.Color(p.color)
            if (p.emissive) { std.emissive = new THREE.Color(p.emissive); std.emissiveIntensity = p.emissiveIntensity ?? 1 }
            if (p.metalness !== undefined) std.metalness = p.metalness
            if (p.roughness !== undefined) std.roughness = p.roughness
          }
          std.needsUpdate = true
          if (custom) owned.push(std)
        }
      })
    })
    if (materialsRef) materialsRef.current = owned
    fitObject(clone, size, sizeAxis, grounded)
    return clone
    // paletteKey stands in for palette so inline objects don't rebuild every render
  }, [scene, size, sizeAxis, grounded, color, emissive, paletteKey, materialsRef, castShadow, receiveShadow])

  useLayoutEffect(() => {
    if (rotation) obj.rotation.set(...rotation)
  }, [obj, rotation])

  return <primitive object={obj} />
}

/** Model footprint normalised so its largest dimension is 1 (cached per path). */
const dimsCache = new Map<string, THREE.Vector3>()
export function useModelDims(path: string): THREE.Vector3 {
  const { scene } = useGLTF(path)
  let d = dimsCache.get(path)
  if (!d) {
    const size = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3())
    d = size.divideScalar(Math.max(size.x, size.y, size.z) || 1)
    dimsCache.set(path, d)
  }
  return d
}

/**
 * A flying craft with its nose on local +Z (whatever the source kit's convention)
 * and exhaust plumes placed on its tail from the model's real footprint.
 */
export function ShipModel({
  path, size, palette, emissive, materialsRef, flame, flames = 1, flameScale = 1, core = '#fff2d0', grounded = false,
}: {
  path: string; size: number; palette?: MaterialPalette; emissive?: string
  /** Sit the model's bottom on y=0 (ships on water) instead of centring it. */
  grounded?: boolean
  materialsRef?: MutableRefObject<THREE.MeshStandardMaterial[]>
  flame?: string; flames?: 0 | 1 | 2; flameScale?: number; core?: string
}) {
  const dims = useModelDims(path)
  const tail = -(dims.z * size) / 2 * 0.94
  const spread = dims.x * size * 0.16
  const len = (0.3 + size * 0.22) * flameScale
  const width = (0.05 + size * 0.045) * flameScale
  const xs = flames === 2 ? [-spread, spread] : flames === 1 ? [0] : []
  return (
    <group>
      <group rotation={[0, noseIsNegZ(path) ? Math.PI : 0, 0]}>
        <GlbModel path={path} size={size} palette={palette} emissive={emissive} materialsRef={materialsRef} grounded={grounded} />
      </group>
      {flame && xs.map((x) => (
        <EngineFlame key={x} position={[x, 0.02, tail]} color={flame} core={core} length={len} width={width} />
      ))}
    </group>
  )
}

Object.values(MODEL_PATHS).forEach((p) => useGLTF.preload(p))
