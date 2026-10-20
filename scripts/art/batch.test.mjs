import { describe, expect, it } from 'vitest'
import { runBatch, withRetry } from './batch.mjs'

const items = (...ids) => ids.map((id) => ({ id }))

describe('runBatch', () => {
  it('never runs more than concurrency workers at once', async () => {
    let inFlight = 0, max = 0
    const worker = async () => {
      inFlight++
      max = Math.max(max, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight--
    }
    const res = await runBatch(items('a', 'b', 'c', 'd', 'e'), worker, { concurrency: 2 })
    expect(max).toBe(2)
    expect(res.ok).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('one failure does not stop the batch', async () => {
    const worker = async (it) => { if (it.id === 'b') throw new Error('x') }
    expect(await runBatch(items('a', 'b', 'c'), worker, { concurrency: 2 }))
      .toEqual({ ok: ['a', 'c'], failed: [{ id: 'b', error: 'x' }] })
  })
})

describe('withRetry', () => {
  it('tries the seed, then seed + 1, once', async () => {
    const seeds = []
    const out = await withRetry(async (s) => { seeds.push(s); if (s === 42) throw new Error('first'); return 'ok' }, 42)
    expect(out).toBe('ok')
    expect(seeds).toEqual([42, 43])
  })

  it('a second failure rejects with the second error, after exactly two tries', async () => {
    const seeds = []
    await expect(withRetry(async (s) => { seeds.push(s); throw new Error(`fail ${s}`) }, 42)).rejects.toThrow('fail 43')
    expect(seeds).toEqual([42, 43])
  })
})
