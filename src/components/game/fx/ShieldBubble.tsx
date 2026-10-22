import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RIPPLE_LIFE, rippleSlots } from '../../../game/fx/emitters'
import { fxQuad, SHIELD_RIPPLES, shieldMaterial } from './materials'
import { useWarmUp } from './warm'

/** The bubble's radius (today's sphere was 1.25 with its ring at 1.18–1.27). */
const RADIUS = 1.3
/** Above the plane, so it reads as a bubble around it. */
const Y = 0.9
/** Its last moments flicker as a warning, as today. */
const WARN_MS = 1500

export interface Ripple { x: number; z: number; t0: number }

/**
 * The player's shield seen from above: an energy bubble, brighter at its rim, pulsing ±4%, and
 * rippling from each blocked hit. `target` is null when there is no shield; ripples are in world units
 * on the renderer clock `now`.
 */
export function ShieldBubble({ target, ripples, now }: {
  target: () => { x: number; z: number; ms: number; down: boolean } | null
  ripples: () => readonly Ripple[]
  now: () => number
}) {
  const mesh = useMemo(() => {
    const m = new THREE.Mesh(fxQuad(), shieldMaterial({ rippleLife: RIPPLE_LIFE }))
    m.visible = false
    m.frustumCulled = false
    return m
  }, [])
  useEffect(() => () => { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose() }, [mesh])
  useWarmUp(mesh)

  const slots = useRef((mesh.material as THREE.ShaderMaterial).uniforms.uRipples.value as THREE.Vector3[])

  useFrame(({ clock }) => {
    const t = target()
    const ending = !!t && t.ms < WARN_MS && Math.floor(Date.now() / 110) % 2 === 0
    mesh.visible = !!t && t.ms > 0 && !t.down && !ending
    if (!t || !mesh.visible) return
    const pulse = 1 + Math.sin(Date.now() * 0.004) * 0.04
    const size = RADIUS * 2 * pulse
    mesh.position.set(t.x, Y, t.z)
    mesh.scale.set(size, 1, size)
    const mat = mesh.material as THREE.ShaderMaterial
    mat.uniforms.uTime.value = clock.elapsedTime
    const live = rippleSlots(ripples(), now())
    for (let i = 0; i < SHIELD_RIPPLES; i++) {
      const r = live[i]
      // In radii from the centre, clamped onto the bubble so a hit at its edge still ripples from there
      if (r) {
        let dx = (r.x - t.x) / (RADIUS * pulse), dz = (r.z - t.z) / (RADIUS * pulse)
        const d = Math.hypot(dx, dz)
        if (d > 0.95) { dx *= 0.95 / d; dz *= 0.95 / d }
        slots.current[i].set(dx, dz, r.age)
      } else slots.current[i].set(0, 0, -1)
    }
  })
  return <primitive object={mesh} renderOrder={6} />
}
