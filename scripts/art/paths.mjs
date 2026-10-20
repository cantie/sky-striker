// Where the art pipeline keeps its files. art/.cache/ is git-ignored scratch; concepts and built models are committed.
import { join } from 'node:path'

export function artPaths(root = process.cwd()) {
  const cache = join(root, 'art', '.cache')
  return {
    draft: (id, k) => join(cache, 'drafts', id, `${k}.png`),
    concept: (id) => join(root, 'art', 'concepts', `${id}.webp`),
    raw: (id) => join(cache, 'raw', `${id}.glb`),
    out: (id) => join(root, 'public', 'models', 'ai', `${id}.glb`),
    review: (batch) => join(cache, 'review', `batch-${batch}.html`),
    preview: (batch) => join(cache, 'preview', `batch-${batch}.png`),
  }
}
