// @vitest-environment jsdom
import { act, createElement, Suspense, use } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { createModelCache } from '../../game/assets/modelCache'
import { ModelBoundary } from './ModelBoundary'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('a model that fails to load mid-game', () => {
  it('draws nothing in its place, then is fetched again until it arrives', async () => {
    // The network is down until the test brings it back (React itself re-renders a few times on an error)
    let down = true
    const cache = createModelCache<string>(async (p) => { if (down) throw new Error(`404 ${p}`); return p }, () => {})
    const Craft = ({ path }: { path: string }) => createElement('i', null, use(cache.get(path)))
    const el = document.createElement('div')
    const root = createRoot(el, { onCaughtError: () => {}, onUncaughtError: () => {} })
    const tree = createElement('b', null, 'scene ',
      createElement(ModelBoundary, { retryMs: 20, retry: cache.forgetFailures }, createElement(Suspense, { fallback: null }, createElement(Craft, { path: 'hawk' }))))
    await act(async () => { root.render(tree) })
    // The rest of the scene stays up
    expect(el.textContent).toBe('scene ')
    await act(async () => { await sleep(60) })
    expect(el.textContent).toBe('scene ')
    down = false
    await act(async () => { await sleep(300) })
    expect(el.textContent).toBe('scene hawk')
    act(() => root.unmount())
  })
})
