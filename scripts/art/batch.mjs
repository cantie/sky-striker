// Run one job per asset with a cap on jobs in flight; a failed asset never stops the batch.

export async function runBatch(items, worker, { concurrency }) {
  const done = new Map()
  let next = 0
  async function lane() {
    while (next < items.length) {
      const item = items[next++]
      try {
        await worker(item)
        done.set(item.id, null)
      } catch (e) {
        done.set(item.id, e instanceof Error ? e.message : String(e))
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane))
  const ok = [], failed = []
  for (const { id } of items) {
    const error = done.get(id)
    if (error === null) ok.push(id)
    else failed.push({ id, error })
  }
  return { ok, failed }
}

/** One retry, with the next seed (a different seed often fixes a failed image-to-3D job). */
export async function withRetry(fn, seed) {
  try {
    return await fn(seed)
  } catch {
    return fn(seed + 1)
  }
}
