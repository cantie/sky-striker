import { describe, expect, it } from 'vitest'
import { createModelCache } from './modelCache'
import { createStageLoader } from './stageLoader'

/** A cache whose loads finish (or fail) when the test says so; like the real one it keeps a path's promise,
 *  keeps a failure until forgetFailures and peeks a finished load. `calls` lists the loads it started. */
function fakeCache() {
  const calls: string[] = []
  const pending = new Map<string, { resolve: () => void; reject: (e: Error) => void }>()
  const promises = new Map<string, Promise<unknown>>()
  const values = new Map<string, unknown>()
  const failed = new Set<string>()
  const get = (path: string) => {
    const old = promises.get(path)
    if (old) return old
    calls.push(path)
    const p = new Promise<unknown>((resolve, reject) => pending.set(path, { resolve: () => { values.set(path, path); resolve(path) }, reject }))
    p.catch(() => failed.add(path))
    promises.set(path, p)
    return p
  }
  const forgetFailures = () => { failed.forEach((p) => promises.delete(p)); failed.clear() }
  return { calls, pending, get, peek: (path: string) => values.get(path), forgetFailures }
}

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('stage loader', () => {
  it('request goes loading then ready, and the same request does not reload', async () => {
    const c = fakeCache()
    const loader = createStageLoader(c)
    loader.request(['a', 'b'])
    expect(loader.status()).toBe('loading')
    c.pending.get('a')!.resolve()
    c.pending.get('b')!.resolve()
    await tick()
    expect(loader.status()).toBe('ready')
    loader.request(['a', 'b'])
    expect(loader.status()).toBe('ready')
    expect(c.calls).toEqual(['a', 'b'])
  })

  it('a new set after ready goes back to loading and loads the new path', async () => {
    const c = fakeCache()
    const loader = createStageLoader(c)
    loader.request(['a'])
    c.pending.get('a')!.resolve()
    await tick()
    expect(loader.status()).toBe('ready')
    loader.request(['a', 'c'])
    expect(loader.status()).toBe('loading')
    expect(c.calls).toContain('c')
    c.pending.get('c')!.resolve()
    await tick()
    expect(loader.status()).toBe('ready')
  })

  it('a failed load is an error, and retry asks again until ready', async () => {
    const c = fakeCache()
    const loader = createStageLoader(c)
    const seen: string[] = []
    const unsub = loader.subscribe(() => seen.push(loader.status()))
    loader.request(['a'])
    c.pending.get('a')!.reject(new Error('404'))
    await tick()
    expect(loader.status()).toBe('error')
    loader.retry()
    expect(loader.status()).toBe('loading')
    expect(c.calls).toEqual(['a', 'a'])
    c.pending.get('a')!.resolve()
    await tick()
    expect(loader.status()).toBe('ready')
    expect(seen).toEqual(['loading', 'error', 'loading', 'ready'])
    unsub()
  })

  it('a slow earlier set finishing does not mark a newer set ready', async () => {
    const c = fakeCache()
    const loader = createStageLoader(c)
    loader.request(['a'])
    loader.request(['b'])
    c.pending.get('a')!.resolve()
    await tick()
    expect(loader.status()).toBe('loading')
    c.pending.get('b')!.resolve()
    await tick()
    expect(loader.status()).toBe('ready')
  })

  it('the same set again reloads what a stage change freed meanwhile', async () => {
    // The real cache: BACK from stage 1's briefing, tap stage 2 (stage 1's models are freed), tap stage 1 again
    const loads: string[] = []
    const cache = createModelCache<string>(async (p) => { loads.push(p); return p }, () => {})
    const loader = createStageLoader(cache)
    loader.request(['boss-s1', 'hawk'])
    await tick()
    expect(loader.status()).toBe('ready')
    cache.keepOnly(['hawk'], () => true)
    loader.request(['boss-s1', 'hawk'])
    expect(loader.status()).toBe('loading')
    await tick()
    expect(loader.status()).toBe('ready')
    expect(cache.peek('boss-s1')).toBe('boss-s1')
    expect(loads).toEqual(['boss-s1', 'hawk', 'boss-s1'])
  })
})
