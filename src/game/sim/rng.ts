/**
 * Seeded randomness for gameplay. Every run has one seed; gameplay draws from independent
 * named streams so e.g. coin sprays can't shift what the boss or the drops do. Two clients with
 * the same seed get the same sequence from the same stream (co-op), and single-player simply
 * uses a random seed (same feel as Math.random).
 *
 * Purely cosmetic randomness (screen shake, sparks, cloud placement) may keep using Math.random.
 */
export type Rng = () => number

/** mulberry32: tiny, fast, good enough for gameplay. Returns floats in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a over a string, mixed with a seed — derives stable sub-seeds (per stream / per enemy). */
export function hashSeed(seed: number, key: string): number {
  let h = (0x811c9dc5 ^ seed) >>> 0
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export type StreamName = 'spawn' | 'drops' | 'boss' | 'coins' | 'enemy'

let runSeed = 0
const streams = new Map<StreamName, Rng>()

/** Start a run: reseed every stream. */
export function seedRun(seed: number): void {
  runSeed = seed >>> 0
  streams.clear()
}

export const currentSeed = () => runSeed

/** A random seed for single-player runs. */
export const randomSeed = () => Math.floor(Math.random() * 2 ** 31)

/** Next float in [0, 1) from a named gameplay stream. */
export function rand(stream: StreamName): number {
  let r = streams.get(stream)
  if (!r) {
    r = mulberry32(hashSeed(runSeed, stream))
    streams.set(stream, r)
  }
  return r()
}

/** A deterministic one-off value for a keyed thing (e.g. an enemy's first-shot jitter). */
export function randFor(key: string): number {
  return randForSeed(runSeed, key)
}

/** randFor for an explicit seed (servers, tests). */
export function randForSeed(seed: number, key: string): number {
  return mulberry32(hashSeed(seed >>> 0, key))()
}
