import { useMemo, useLayoutEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

export const MODEL_PATHS = {
  player: '/models/kenney-space/craft_speederD.glb',
  enemyBasic: '/models/kenney-space/craft_speederA.glb',
  enemyFast: '/models/kenney-space/craft_racer.glb',
  enemyHeavy: '/models/kenney-space/craft_cargoA.glb',
  enemyShooter: '/models/kenney-space/craft_speederB.glb',
  boss: '/models/quaternius/spaceship1.glb',
  shipLarge: '/models/kenney-pirate/ship-large.glb',
  shipSmall: '/models/kenney-pirate/ship-small.glb',
  shipPirate: '/models/kenney-pirate/ship-pirate-large.glb',
  palm: '/models/kenney-nature/tree_palmTall.glb',
  palmBend: '/models/kenney-nature/tree_palmBend.glb',
  tree: '/models/kenney-nature/tree_default.glb',
  treeOak: '/models/kenney-nature/tree_oak.glb',
  treeCone: '/models/kenney-nature/tree_cone.glb',
  bush: '/models/kenney-nature/plant_bushLarge.glb',
  rock: '/models/kenney-nature/rock_largeA.glb',
  rockB: '/models/kenney-nature/rock_largeB.glb',
  cliff: '/models/kenney-nature/cliff_block_rock.glb',
  grass: '/models/kenney-pirate/patch-grass-foliage.glb',
  grassPatch: '/models/kenney-pirate/patch-grass.glb',
  sand: '/models/kenney-pirate/patch-sand.glb',
  tower: '/models/kenney-pirate/tower-complete-large.glb',
  towerWatch: '/models/kenney-pirate/tower-watch.glb',
  dock: '/models/kenney-pirate/structure-platform-dock.glb',
  buildingA: '/models/kenney-city/building-a.glb',
  buildingC: '/models/kenney-city/building-c.glb',
  skyA: '/models/kenney-city/building-skyscraper-a.glb',
  skyB: '/models/kenney-city/building-skyscraper-b.glb',
  turret: '/models/kenney-space/turret_double.glb',
} as const

export type ModelKey = keyof typeof MODEL_PATHS

export function fitObject(obj: THREE.Object3D, targetSize = 1, axis: 'max' | 'y' = 'max') {
  const box = new THREE.Box3().setFromObject(obj)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const dim = axis === 'y' ? size.y : Math.max(size.x, size.y, size.z)
  const s = dim > 0 ? targetSize / dim : 1
  obj.scale.setScalar(s)
  obj.position.sub(center.multiplyScalar(s))
  return obj
}

export function GlbModel({
  path, size = 1, sizeAxis = 'max', rotation, color, emissive, castShadow = true, receiveShadow = true,
}: {
  path: string; size?: number; sizeAxis?: 'max' | 'y'
  rotation?: [number, number, number]; color?: string; emissive?: string
  castShadow?: boolean; receiveShadow?: boolean
}) {
  const { scene } = useGLTF(path)
  const obj = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((c) => {
      const m = c as THREE.Mesh
      if (!m.isMesh) return
      m.castShadow = castShadow
      m.receiveShadow = receiveShadow
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      mats.forEach((mat) => {
        const std = mat as THREE.MeshStandardMaterial
        if (std && 'color' in std) {
          std.side = THREE.DoubleSide
          if (color) std.color = new THREE.Color(color)
          if (emissive) { std.emissive = new THREE.Color(emissive); std.emissiveIntensity = 0.35 }
          std.needsUpdate = true
        }
      })
    })
    fitObject(clone, size, sizeAxis)
    return clone
  }, [scene, size, sizeAxis, color, emissive, castShadow, receiveShadow])

  useLayoutEffect(() => {
    if (rotation) obj.rotation.set(...rotation)
  }, [obj, rotation])

  return <primitive object={obj} />
}

Object.values(MODEL_PATHS).forEach((p) => useGLTF.preload(p))
