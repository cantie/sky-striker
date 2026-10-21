import { describe, expect, it } from 'vitest'
import { aiModel, isAiModel } from '../models'
import { createModelCache } from './modelCache'

/** A loader whose loads finish (or fail) when the test says so. */
function fakeLoader() {
  const calls: string[] = []
  const pending = new Map<string, { resolve: (v: string) => void; reject: (e: Error) => void }>()
  const load = (path: string) => {
    calls.push(path)
    return new Promise<string>((resolve, reject) => pending.set(path, { resolve, reject }))
  }
  const disposed: string[] = []
  return { calls, pending, load, disposed, dispose: (v: string) => { disposed.push(v) } }
}

describe('model cache', () => {
  it('loads a path once', async () => {
    const f = fakeLoader()
    const cache = createModelCache(f.load, f.dispose)
    const a = cache.get('a'), b = cache.get('a')
    expect(a).toBe(b)
    expect(f.calls).toEqual(['a'])
    f.pending.get('a')!.resolve('A')
    expect(await a).toBe('A')
    expect(cache.peek('a')).toBe('A')
  })

  it('a failed load stays failed until forgetFailures, then the next get retries', async () => {
    const f = fakeLoader()
    const cache = createModelCache(f.load, f.dispose)
    const first = cache.get('a')
    f.pending.get('a')!.reject(new Error('404'))
    await expect(first).rejects.toThrow('404')
    // A render after the failure must see it (React's `use` throws it), not start another request:
    // every frame would ask the network again
    expect(cache.get('a')).toBe(first)
    expect(f.calls).toEqual(['a'])
    cache.forgetFailures()
    const second = cache.get('a')
    expect(f.calls).toEqual(['a', 'a'])
    f.pending.get('a')!.resolve('A')
    expect(await second).toBe('A')
  })

  it('keepOnly releases only releasable paths that are not kept, and disposes them', async () => {
    const f = fakeLoader()
    const cache = createModelCache(f.load, f.dispose)
    const paths = [aiModel('a'), aiModel('b'), '/models/kenney-space/x.glb']
    const loads = paths.map((p) => cache.get(p))
    paths.forEach((p) => f.pending.get(p)!.resolve(p))
    await Promise.all(loads)
    expect(cache.keepOnly([aiModel('a')], isAiModel)).toEqual([aiModel('b')])
    expect(f.disposed).toEqual([aiModel('b')])
    expect(cache.peek('/models/kenney-space/x.glb')).toBeDefined()
    expect(cache.peek(aiModel('a'))).toBeDefined()
    expect(cache.peek(aiModel('b'))).toBeUndefined()
  })

  it('release of a path still loading drops it without disposing', async () => {
    const f = fakeLoader()
    const cache = createModelCache(f.load, f.dispose)
    const p = cache.get('a')
    cache.release('a')
    f.pending.get('a')!.resolve('A')
    await p
    expect(f.disposed).toEqual([])
    expect(cache.peek('a')).toBeUndefined()
  })

  it('aiModel and isAiModel agree', () => {
    expect(aiModel('hawk')).toBe('/models/ai/hawk.glb')
    expect(isAiModel(aiModel('hawk'))).toBe(true)
    expect(isAiModel('/models/kenney-space/craft_speederD.glb')).toBe(false)
  })
})
