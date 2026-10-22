import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import type * as THREE from 'three'

/**
 * Compiles an effect's shaders as soon as it mounts. Effects are hidden while empty, so otherwise the
 * first explosion or volley of a stage would stall its frame compiling them.
 */
export function useWarmUp(obj: THREE.Object3D) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  useEffect(() => { gl.compile(obj, camera, scene) }, [gl, obj, camera, scene])
}
