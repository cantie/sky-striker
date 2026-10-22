import { describe, expect, it } from 'vitest'
import { mulberry32 } from './sim/rng'
import { MAX_HEALTH, pickDrop } from './dropRules'

/** Rolls `n` kills, counting health against the cap the way single-player does. */
function rollCounted(seed: number, n: number, progress: number) {
  const r = mulberry32(seed)
  let health = 0
  const out = []
  for (let i = 0; i < n; i++) {
    const t = pickDrop(r, { powerupsDropped: 9, shieldsDropped: 9, healthDropped: health, progress })
    if (t === 'health') health++
    out.push(t)
  }
  return { health, out }
}

describe('health drops', () => {
  it('stop at MAX_HEALTH (3) a stage when they are counted', () => {
    expect(MAX_HEALTH).toBe(3)
    const { health, out } = rollCounted(1, 5000, 1)
    expect(health).toBe(3)
    // With power-ups and shields used up too, a kill drops nothing at all
    expect(out.slice(-1000).every((t) => t === null)).toBe(true)
  })

  it('are spread out: the 2nd waits for a third of the stage, the 3rd for two thirds', () => {
    expect(rollCounted(2, 5000, 0).health).toBe(1)
    expect(rollCounted(3, 5000, 0.34).health).toBe(2)
    expect(rollCounted(4, 5000, 0.67).health).toBe(3)
  })
})
