import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BOLT_LAYER } from '../../../game/fx/layers'
import { fxQuad, spriteMaterial } from './materials'
import { useWarmUp } from './warm'

/** Shows while the store's muzzleFlash (1 at a volley, decaying) is above this: about 0.1 s a volley. */
const SHOW_ABOVE = 0.75
const MAX_GUNS = 8
const SIZE = 0.75

const m4 = new THREE.Matrix4(), quat = new THREE.Quaternion(), at = new THREE.Vector3(), scl = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

/**
 * A star-shaped flash at each gun, 0.9 ahead of the plane: mount it inside the plane's group. `guns` are
 * the streams' x offsets. Read every frame, so it shows on every volley.
 */
export function MuzzleFlash({ guns, flash }: { guns: () => readonly number[]; flash: () => number }) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(fxQuad(), spriteMaterial({ color: '#ffe9a8', intensity: 1.6, hot: 0.9, star: true }), MAX_GUNS)
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    m.frustumCulled = false
    m.count = 0
    m.visible = false
    return m
  }, [])
  useEffect(() => () => { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose() }, [mesh])
  useWarmUp(mesh)

  useFrame(() => {
    const on = flash() > SHOW_ABOVE
    mesh.visible = on
    if (!on) return
    const xs = guns()
    const n = Math.min(xs.length, MAX_GUNS)
    for (let i = 0; i < n; i++) {
      // A fresh size and twist every frame: the flash flickers instead of sitting still
      const s = SIZE * (0.75 + Math.random() * 0.5)
      quat.setFromAxisAngle(UP, Math.random() * Math.PI)
      mesh.setMatrixAt(i, m4.compose(at.set(xs[i], 0, 0), quat, scl.set(s, 1, s)))
    }
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
  })
  return <primitive object={mesh} position={[0, 0.1, 0.9]} renderOrder={BOLT_LAYER.renderOrder} />
}
