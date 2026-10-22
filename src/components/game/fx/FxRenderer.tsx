import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { BossDef } from '../../../game/bosses'
import { bossDeathBursts, explosionBurst, hitSparks, missilePuff, novaRing, wreckAlive } from '../../../game/fx/emitters'
import { POOLS, type PoolName } from '../../../game/fx/layers'
import { createParticles, type Particles, type RGB } from '../../../game/fx/particles'
import { BossWreck, type Wreck } from './BossWreck'
import { glowMaterial, ringMaterial, smokeMaterial, sparkMaterial } from './materials'
import { ParticleLayer } from './ParticleLayer'
import { ShieldBubble, type Ripple } from './ShieldBubble'

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
/** Which stage is in play and the game state, for a boss wreck to know when it is no longer wanted. */
export interface FxStage { id: number; state: string }

const FxContext = createContext<Fx | null>(null)

export function useFx(): Fx {
  const fx = useContext(FxContext)
  if (!fx) throw new Error('useFx outside <FxRenderer>')
  return fx
}

/** Longest step: a stalled tab must not fast-forward every effect at once. */
const MAX_DT = 0.1
const POOL_NAMES = Object.keys(POOLS) as PoolName[]
/** Hit sparks glow a little past their bullet's colour, so the bloom picks them up. */
const SPARK_GAIN = 1.8
const ALWAYS: FxStage = { id: 0, state: 'playing' }
/** Where the boss laser crosses the player: hot magenta-white sparks. */
const LASER_SPARK: RGB = [2.4, 1.3, 2.2]
const SHIELD_SPARK = '#9be7ff'
/** Ripples kept for the shield to pick its newest from. */
const KEEP_RIPPLES = 8

const sparkTints = new Map<string, RGB>()
function sparkTint(hex: string): RGB {
  // Linear RGB, brightened
  let c = sparkTints.get(hex)
  if (!c) {
    const l = new THREE.Color(hex)
    c = [l.r * SPARK_GAIN, l.g * SPARK_GAIN, l.b * SPARK_GAIN]
    sparkTints.set(hex, c)
  }
  return c
}

/**
 * Owns the particle pools and the boss wrecks, and steps them in real seconds at priority −2 (before the
 * layers sync), while `paused()` is false: a paused game freezes its smoke mid-air. Its clock only runs
 * while it steps, so a boss death sequence waits through a pause too.
 */
export function FxRenderer(props: { paused: () => boolean; stage?: () => FxStage; shield?: () => ShieldTarget | null; children?: ReactNode }) {
  const { paused, shield, children } = props
  const stage = props.stage ?? (() => ALWAYS)
  const stageRef = useRef(stage)
  stageRef.current = stage
  const pools = useMemo(() => {
    const out = {} as Record<PoolName, Particles>
    for (const k of POOL_NAMES) out[k] = createParticles(POOLS[k].capacity, { drag: POOLS[k].drag })
    return out
  }, [])
  const materials = useMemo(() => {
    const m = {
      smoke: smokeMaterial(),
      debris: smokeMaterial({ hard: true }),
      rings: ringMaterial(),
      fire: glowMaterial({ noise: 0.45 }),
      sparks: sparkMaterial(),
    }
    // Fire, sparks and shockwaves show over the craft they burst from (a boss wreck is taller than they
    // fly); smoke and debris stay depth-tested, so they pass under the pickups and stars
    m.fire.depthTest = m.sparks.depthTest = m.rings.depthTest = false
    return m
  }, [])
  useEffect(() => () => { for (const k of POOL_NAMES) materials[k].dispose() }, [materials])
  const clock = useRef(0)
  const wrecks = useRef<Wreck[]>([])
  const [shownWrecks, setShownWrecks] = useState<Wreck[]>([])
  const nextWreck = useRef(0)
  const ripples = useRef<Ripple[]>([])

  const fx = useMemo<Fx>(() => {
    const spawnAll = (pool: Particles, list: Parameters<Particles['spawn']>[0][]) => { for (const p of list) pool.spawn(p) }
    const explosion = (x: number, z: number, scale: number) => {
      const b = explosionBurst(x, z, scale, Math.random)
      spawnAll(pools.smoke, b.smoke)
      spawnAll(pools.debris, b.debris)
      spawnAll(pools.fire, b.fire)
      spawnAll(pools.sparks, b.sparks)
      pools.rings.spawn(b.ring)
    }
    return {
      explosion,
      hit(x, z, color) {
        const out = hitSparks(x, z, sparkTint(color), Math.random)
        // The last one is the flash
        for (let i = 0; i < out.length - 1; i++) pools.sparks.spawn(out[i])
        pools.fire.spawn(out[out.length - 1])
      },
      puff(x, z, vx, vz) { pools.smoke.spawn(missilePuff(x, z, vx, vz, Math.random)) },
      nova(x, z, color) {
        const c = sparkTint(color)
        pools.rings.spawn(novaRing(x, z, c))
        pools.fire.spawn({ x, y: 0, z, vx: 0, vy: 0, vz: 0, life: 0.22, size0: 2.2, size1: 3.6, color: c, alpha: 0.9 })
      },
      bossDeath(x, z, boss) {
        const w: Wreck = {
          id: nextWreck.current++, x, z, boss, t0: clock.current, stageId: stageRef.current().id,
          bursts: bossDeathBursts(x, z, boss.size * 0.4, Math.random), fired: 0,
        }
        wrecks.current = [...wrecks.current, w]
        setShownWrecks(wrecks.current)
      },
      laserHit(x, z) {
        const out = hitSparks(x, z, LASER_SPARK, Math.random)
        for (let i = 0; i < out.length - 1; i++) pools.sparks.spawn(out[i])
        pools.fire.spawn(out[out.length - 1])
      },
      shieldHit(x, z) {
        ripples.current.push({ x, z, t0: clock.current })
        if (ripples.current.length > KEEP_RIPPLES) ripples.current.splice(0, ripples.current.length - KEEP_RIPPLES)
        const out = hitSparks(x, z, sparkTint(SHIELD_SPARK), Math.random)
        for (let i = 0; i < out.length - 1; i++) pools.sparks.spawn(out[i])
      },
      clear() {
        for (const k of POOL_NAMES) pools[k].clear()
        ripples.current = []
        if (wrecks.current.length) { wrecks.current = []; setShownWrecks([]) }
      },
    }
  }, [pools])

  useFrame((_, delta) => {
    if (!paused()) {
      const dt = Math.min(delta, MAX_DT)
      clock.current += dt
      for (const k of POOL_NAMES) {
        pools[k].step(dt)
        materials[k].uniforms.uTime.value = clock.current
      }
    }
    if (!wrecks.current.length) return
    const now = clock.current, st = stageRef.current()
    for (const w of wrecks.current) {
      while (w.fired < w.bursts.length && now - w.t0 >= w.bursts[w.fired].at) {
        const b = w.bursts[w.fired++]
        fx.explosion(b.x, b.z, b.scale)
      }
    }
    const alive = wrecks.current.filter((w) => wreckAlive(w, now, st.id, st.state))
    if (alive.length !== wrecks.current.length) { wrecks.current = alive; setShownWrecks(alive) }
  }, -2)

  return (
    <FxContext.Provider value={fx}>
      {children}
      {shownWrecks.map((w) => <BossWreck key={w.id} wreck={w} now={() => clock.current} />)}
      {shield && <ShieldBubble target={shield} ripples={() => ripples.current} now={() => clock.current} />}
      {POOL_NAMES.map((k) => (
        <ParticleLayer key={k} particles={pools[k]} material={materials[k]} y={POOLS[k].y} renderOrder={POOLS[k].renderOrder} />
      ))}
    </FxContext.Provider>
  )
}
