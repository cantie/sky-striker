import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import type { BossDef } from '../../../game/bosses'
import { missilePuff } from '../../../game/fx/emitters'
import { POOLS, type PoolName } from '../../../game/fx/layers'
import { createParticles, type Particles } from '../../../game/fx/particles'
import { glowMaterial, ringMaterial, smokeMaterial, sparkMaterial } from './materials'
import { ParticleLayer } from './ParticleLayer'

/** What gameplay glue (or the preview page) asks the effects for. Visual only. */
export interface Fx {
  explosion(x: number, z: number, scale: number): void
  hit(x: number, z: number, color: string): void
  puff(x: number, z: number, vx: number, vz: number): void
  nova(x: number, z: number, color: string): void
  bossDeath(x: number, z: number, boss: BossDef): void
  laserHit(x: number, z: number): void
  shieldHit(x: number, z: number): void
  /** Drops every live effect, e.g. on leaving a stage. */
  clear(): void
}

export interface ShieldTarget { x: number; z: number; ms: number; down: boolean }

const FxContext = createContext<Fx | null>(null)

export function useFx(): Fx {
  const fx = useContext(FxContext)
  if (!fx) throw new Error('useFx outside <FxRenderer>')
  return fx
}

/** Longest step: a stalled tab must not fast-forward every effect at once. */
const MAX_DT = 0.1
const POOL_NAMES = Object.keys(POOLS) as PoolName[]

/**
 * Owns the particle pools and steps them in real seconds, at priority −2 (before the layers sync), while
 * `paused()` is false: a paused game freezes its smoke mid-air.
 */
export function FxRenderer(props: { paused: () => boolean; shield?: () => ShieldTarget | null; children?: ReactNode }) {
  const { paused, children } = props
  const pools = useMemo(() => {
    const out = {} as Record<PoolName, Particles>
    for (const k of POOL_NAMES) out[k] = createParticles(POOLS[k].capacity, { drag: POOLS[k].drag })
    return out
  }, [])
  const materials = useMemo(() => ({
    smoke: smokeMaterial(),
    debris: smokeMaterial({ hard: true }),
    rings: ringMaterial(),
    fire: glowMaterial({ noise: 0.45 }),
    sparks: sparkMaterial(),
  }), [])
  useEffect(() => () => { for (const k of POOL_NAMES) materials[k].dispose() }, [materials])
  const clock = useRef(0)

  const fx = useMemo<Fx>(() => ({
    explosion() {},
    hit() {},
    puff(x, z, vx, vz) { pools.smoke.spawn(missilePuff(x, z, vx, vz, Math.random)) },
    nova() {},
    bossDeath() {},
    laserHit() {},
    shieldHit() {},
    clear() { for (const k of POOL_NAMES) pools[k].clear() },
  }), [pools])

  useFrame((_, delta) => {
    if (paused()) return
    const dt = Math.min(delta, MAX_DT)
    clock.current += dt
    for (const k of POOL_NAMES) {
      pools[k].step(dt)
      materials[k].uniforms.uTime.value = clock.current
    }
  }, -2)

  return (
    <FxContext.Provider value={fx}>
      {children}
      {POOL_NAMES.map((k) => (
        <ParticleLayer key={k} particles={pools[k]} material={materials[k]} y={POOLS[k].y} renderOrder={POOLS[k].renderOrder} />
      ))}
    </FxContext.Provider>
  )
}
