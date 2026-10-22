import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { BossDef } from '../../../game/bosses'
import { WRECK_LIFE } from '../../../game/fx/emitters'
import { GROUND_Y } from '../../../game/world'
import { applyFlash, captureLooks, type Look } from '../materialLook'
import { ShipModel } from '../Model'
import { Vehicle } from '../Vehicles'

/** A dead boss: where it died, its burst schedule (renderer seconds from t0) and how many have gone off. */
export interface Wreck {
  id: number; x: number; z: number; boss: BossDef
  t0: number; stageId: number
  bursts: { at: number; x: number; z: number; scale: number }[]
  fired: number
}

/** Brightness at the end of the sequence. */
const DARKEST = 0.3
/** A burst lights the hull white for this long. */
const FLASH = 0.08

/**
 * The boss's own model left at its death spot (Boss.tsx's height, turned π to face the player), shaking,
 * flashing white at each burst and charring toward DARKEST until the last blast takes it. Its materials
 * are its own copies: the model's cached ones are never touched.
 */
export function BossWreck({ wreck, now }: { wreck: Wreck; now: () => number }) {
  const { boss } = wreck
  const group = useRef<THREE.Group>(null)
  const adopted = useRef(new WeakSet<THREE.Object3D>())
  const mats = useRef<THREE.MeshStandardMaterial[]>([])
  const looks = useRef<Look[]>([])
  const colors = useRef<THREE.Color[]>([])
  const y = boss.ground ? GROUND_Y + 0.1 : 0.4

  useEffect(() => () => { for (const m of mats.current) m.dispose() }, [])

  useFrame(() => {
    const g = group.current
    if (!g) return
    // Parts appear as they mount: give each its own materials the first time it is seen
    g.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh || adopted.current.has(mesh)) return
      adopted.current.add(mesh)
      const own = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => {
        if (!(m as THREE.MeshStandardMaterial).isMeshStandardMaterial) return m
        const c = (m as THREE.MeshStandardMaterial).clone()
        mats.current.push(c)
        looks.current.push(...captureLooks([c]))
        colors.current.push(c.color.clone())
        return c
      })
      mesh.material = Array.isArray(mesh.material) ? own : own[0]
    })

    const t = Math.min(now() - wreck.t0, WRECK_LIFE)
    const flashing = t < FLASH || wreck.bursts.some((b) => t >= b.at && t - b.at < FLASH)
    const k = 1 - (1 - DARKEST) * Math.min(1, t / wreck.bursts[wreck.bursts.length - 1].at)
    applyFlash(mats.current, looks.current, flashing, 1.4)
    mats.current.forEach((m, i) => {
      m.color.copy(colors.current[i]).multiplyScalar(k)
      if (!flashing) m.emissive.multiplyScalar(k)
    })
    // Shudders harder as it goes
    const shake = 0.04 + 0.1 * (t / WRECK_LIFE)
    g.position.set(wreck.x + (Math.random() - 0.5) * shake, y, wreck.z + (Math.random() - 0.5) * shake)
  })

  return (
    <group ref={group} position={[wreck.x, y, wreck.z]}>
      <group rotation={[0, Math.PI, 0]}>
        {boss.model ? (
          <ShipModel path={boss.model} size={boss.size} flames={0} grounded={boss.ground} />
        ) : boss.vehicle ? (
          <Vehicle skin={boss.vehicle} heading={0} aim={0} scale={boss.size} />
        ) : null}
      </group>
    </group>
  )
}
