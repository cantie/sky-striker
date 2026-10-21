// What each effect spawns: pure, seeded through `rand`. Game units on the ground plane (x, z), real seconds.
import type { ParticleSpec, RGB } from './particles'

export type Rand = () => number

export interface Burst { fire: ParticleSpec[]; sparks: ParticleSpec[]; debris: ParticleSpec[]; smoke: ParticleSpec[]; ring: ParticleSpec }

const FIRE: RGB[] = [[2.4, 1.5, 0.55], [2.2, 0.9, 0.25], [1.8, 0.55, 0.15]]
const SPARK: RGB = [2.6, 1.9, 0.9]
const DEBRIS: RGB = [0.16, 0.12, 0.1]
const SMOKE: RGB = [0.2, 0.19, 0.18]
const RING: RGB = [2, 1.4, 0.8]
const FLASH: RGB = [2.5, 2.5, 2.5]

const range = (rand: Rand, a: number, b: number) => a + (b - a) * rand()

/** A particle at a random point within `r` of (x, z), flying out from it at `speed`. */
function outward(rand: Rand, x: number, z: number, r: number, speed: number, rest: Omit<ParticleSpec, 'x' | 'y' | 'z' | 'vx' | 'vy' | 'vz'>): ParticleSpec {
  const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * r
  const c = Math.cos(a), s = Math.sin(a)
  return { x: x + c * d, y: 0, z: z + s * d, vx: c * speed, vy: 0, vz: s * speed, ...rest }
}

/** An explosion at today's scale (1 enemy, 1.2 ram, 1.6 heavy or tank, 3 boss). */
export function explosionBurst(x: number, z: number, scale: number, rand: Rand): Burst {
  const n = (per: number, cap: number) => Math.min(cap, Math.round(per * scale))
  const fire = Array.from({ length: n(6, 18) }, () => outward(rand, x, z, 0.45 * scale, range(rand, 0.8, 2.2) * scale, {
    life: range(rand, 0.35, 0.6), size0: range(rand, 0.7, 1.1) * scale, size1: range(rand, 1.6, 2.3) * scale,
    color: FIRE[Math.floor(rand() * FIRE.length)], alpha: 1,
  }))
  const sparks = Array.from({ length: n(14, 40) }, () => outward(rand, x, z, 0.2 * scale, range(rand, 7, 15) * Math.sqrt(scale), {
    life: range(rand, 0.25, 0.5), size0: 0.12, size1: 0.04, color: SPARK, alpha: 1,
  }))
  const debris = Array.from({ length: n(5, 15) }, () => outward(rand, x, z, 0.3 * scale, range(rand, 3, 7) * Math.sqrt(scale), {
    life: range(rand, 0.5, 0.9), size0: range(rand, 0.18, 0.32), size1: 0.1, color: DEBRIS, alpha: 1,
  }))
  const smoke = Array.from({ length: n(4, 12) }, () => outward(rand, x, z, 0.6 * scale, range(rand, 0.3, 0.9), {
    life: range(rand, 1.2, 2.0), size0: range(rand, 0.9, 1.3) * scale, size1: range(rand, 2.2, 3.0) * scale,
    color: SMOKE, alpha: range(rand, 0.45, 0.6),
  }))
  const ring: ParticleSpec = { x, y: 0, z, vx: 0, vy: 0, vz: 0, life: 0.35, size0: 0.3, size1: 2.2 * scale, color: RING, alpha: 0.9 }
  return { fire, sparks, debris, smoke, ring }
}

/** A bullet hit: 6 sparks in the bullet's colour and one short white flash. */
export function hitSparks(x: number, z: number, color: RGB, rand: Rand): ParticleSpec[] {
  const out = Array.from({ length: 6 }, () => outward(rand, x, z, 0, range(rand, 4, 9), {
    life: range(rand, 0.15, 0.3), size0: 0.1, size1: 0.03, color, alpha: 1,
  }))
  out.push({ x, y: 0, z, vx: 0, vy: 0, vz: 0, life: 0.08, size0: 0.6, size1: 0.3, color: FLASH, alpha: 1 })
  return out
}

/** A puff of a missile's smoke trail, left just behind its tail. */
export function missilePuff(x: number, z: number, vx: number, vz: number, rand: Rand): ParticleSpec {
  const sp = Math.hypot(vx, vz) || 1
  const bx = -vx / sp, bz = -vz / sp
  return {
    x: x + bx * 0.35 + (rand() - 0.5) * 0.08, y: 0, z: z + bz * 0.35 + (rand() - 0.5) * 0.08,
    vx: bx * 0.4, vy: 0, vz: bz * 0.4,
    life: range(rand, 0.6, 0.9), size0: 0.25, size1: 0.8, color: [0.55, 0.54, 0.52], alpha: 0.5,
  }
}

/** The shockwave of a nova burst, in the plane's bolt colour. */
export function novaRing(x: number, z: number, color: RGB): ParticleSpec {
  return { x, y: 0, z, vx: 0, vy: 0, vz: 0, life: 0.45, size0: 0.6, size1: 7, color, alpha: 0.9 }
}

/** A boss death: 6 bursts across its footprint (±`half`), then the last and biggest at its centre. */
export function bossDeathBursts(x: number, z: number, half: number, rand: Rand): { at: number; x: number; z: number; scale: number }[] {
  const out = Array.from({ length: 6 }, (_, i) => ({
    at: Math.min(1.2, i * 0.22 + rand() * 0.1),
    x: x + (rand() * 2 - 1) * half,
    z: z + (rand() * 2 - 1) * half,
    scale: range(rand, 1, 1.8),
  }))
  out.sort((a, b) => a.at - b.at)
  out.push({ at: 1.4, x, z, scale: 3 })
  return out
}

/** Particles age only while the game runs: a paused game freezes them mid-air. */
export function fxShouldStep(gameState: string): boolean {
  return gameState === 'playing'
}

/** The store explosions not seen before. Ids that left the list are forgotten, so `seen` stays small. */
export function takeNewExplosions<T extends { id: string }>(seen: Set<string>, list: readonly T[]): T[] {
  const live = new Set<string>()
  const fresh: T[] = []
  for (const e of list) {
    live.add(e.id)
    if (!seen.has(e.id)) { seen.add(e.id); fresh.push(e) }
  }
  for (const id of seen) if (!live.has(id)) seen.delete(id)
  return fresh
}
