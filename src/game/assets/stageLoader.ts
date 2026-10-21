import { useEffect, useSyncExternalStore } from 'react'
import { models, type ModelCache } from './modelCache'

export type StageLoadStatus = 'loading' | 'ready' | 'error'

/**
 * Waits for one set of paths at a time (the stage about to start). A newer request supersedes an older
 * one: only the latest set decides the status.
 */
export function createStageLoader(cache: Pick<ModelCache<unknown>, 'get' | 'peek' | 'forgetFailures'>) {
  let key = ''
  let paths: string[] = []
  let status: StageLoadStatus = 'ready'
  let run = 0
  const subs = new Set<() => void>()
  const set = (s: StageLoadStatus) => { if (s !== status) { status = s; subs.forEach((f) => f()) } }
  const load = () => {
    const mine = ++run
    set('loading')
    // Every load it starts tries failed models again (a RETRY, or a briefing opened after a failure)
    cache.forgetFailures()
    Promise.all(paths.map((p) => cache.get(p))).then(
      () => { if (mine === run) set('ready') },
      () => { if (mine === run) set('error') },
    )
  }
  return {
    request(next: string[]) {
      const k = [...next].sort().join('\n')
      // The same set again reloads only if it failed, or a stage change freed part of it since
      if (k === key && (status === 'loading' || (status === 'ready' && paths.every((p) => cache.peek(p) !== undefined)))) return
      key = k
      paths = [...next]
      load()
    },
    status: () => status,
    retry() { if (status === 'error') load() },
    subscribe(fn: () => void) { subs.add(fn); return () => { subs.delete(fn) } },
  }
}

export const stageLoader = createStageLoader(models)

/** Loads `paths` (the stage briefing's) and reports whether they are all in. */
export function useStageModels(paths: string[]) {
  // Keyed on the paths, not the array, so a fresh array with the same paths does not re-request
  const key = paths.join('\n')
  useEffect(() => stageLoader.request(paths), [key])
  const status = useSyncExternalStore(stageLoader.subscribe, stageLoader.status)
  return { status, retry: stageLoader.retry }
}
