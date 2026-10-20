import { use } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

/**
 * GLB scenes by path, as promises that can be awaited (the stage briefing waits for its models) and
 * released (a finished stage frees its AI models). A failed load is forgotten, so asking again retries.
 */
export interface ModelCache<T> {
  get(path: string): Promise<T>
  peek(path: string): T | undefined
  release(path: string): void
  /** Releases every loaded path that is releasable and not in `keep`; returns those paths. */
  keepOnly(keep: Iterable<string>, releasable: (path: string) => boolean): string[]
}

export function createModelCache<T>(load: (path: string) => Promise<T>, dispose: (value: T) => void): ModelCache<T> {
  interface Entry { promise: Promise<T>; value?: T; done: boolean }
  const entries = new Map<string, Entry>()
  const release = (path: string) => {
    const e = entries.get(path)
    if (!e) return
    entries.delete(path)
    if (e.done && e.value !== undefined) dispose(e.value)
  }
  return {
    get(path) {
      const old = entries.get(path)
      if (old) return old.promise
      const entry: Entry = { done: false, promise: undefined as unknown as Promise<T> }
      entry.promise = load(path).then(
        (v) => { if (entries.get(path) === entry) { entry.value = v; entry.done = true } return v },
        (err) => { if (entries.get(path) === entry) entries.delete(path); throw err },
      )
      entries.set(path, entry)
      return entry.promise
    },
    peek: (path) => entries.get(path)?.value,
    release,
    keepOnly(keep, releasable) {
      const kept = new Set(keep)
      const gone = [...entries.keys()].filter((p) => releasable(p) && !kept.has(p))
      gone.forEach(release)
      return gone
    },
  }
}

function disposeScene(scene: THREE.Group) {
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose()
      m.dispose()
    }
  })
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)

export const models = createModelCache<THREE.Group>((path) => loader.loadAsync(path).then((g) => g.scene), disposeScene)

/** The cached scene of a GLB; suspends while it loads (React 19 `use`). Clone it before changing it. */
export function useModelScene(path: string): THREE.Group {
  return use(models.get(path))
}
