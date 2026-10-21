import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Particles } from '../../../game/fx/particles'
import { fxQuad } from './materials'

/** One draw call for a whole pool: its typed arrays are the instance attributes, no copies. */
export function buildParticleMesh(p: Particles, material: THREE.Material): THREE.InstancedMesh {
  const g = fxQuad()
  const bind = (name: string, array: Float32Array, size: number) => {
    const a = new THREE.InstancedBufferAttribute(array, size)
    a.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute(name, a)
  }
  bind('iPos', p.pos, 3)
  bind('iVel', p.vel, 3)
  bind('iCol', p.col, 4)
  bind('iMisc', p.misc, 4)
  const mesh = new THREE.InstancedMesh(g, material, p.capacity)
  // Instances are placed by the shader, not instanceMatrix: bounds from the matrices would be wrong
  mesh.frustumCulled = false
  mesh.count = 0
  mesh.visible = false
  return mesh
}

const ATTRS = ['iPos', 'iVel', 'iCol', 'iMisc'] as const

/** Draw only the live particles, and upload only their slice of each array. */
export function syncParticleMesh(mesh: THREE.InstancedMesh, p: Particles): void {
  mesh.count = p.count
  mesh.visible = p.count > 0
  if (!p.count) return
  for (const name of ATTRS) {
    const a = mesh.geometry.getAttribute(name) as THREE.InstancedBufferAttribute
    a.clearUpdateRanges()
    a.addUpdateRange(0, p.count * a.itemSize)
    a.needsUpdate = true
  }
}

/**
 * A pool drawn at height `y`. Syncs at priority −1, after the pools step (−2) and before anything
 * renders: a particle spawned later in the frame shows from the next one.
 */
export function ParticleLayer({ particles, material, y, renderOrder }: { particles: Particles; material: THREE.Material; y: number; renderOrder: number }) {
  const mesh = useMemo(() => buildParticleMesh(particles, material), [particles, material])
  useEffect(() => () => mesh.geometry.dispose(), [mesh])
  useFrame(() => syncParticleMesh(mesh, particles), -1)
  return <primitive object={mesh} position-y={y} renderOrder={renderOrder} />
}
