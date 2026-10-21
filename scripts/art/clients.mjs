// HTTP clients for the internal image model (OpenAI-compatible) and ZPS 3D image-to-3D.

async function failure(res, what) {
  const text = await res.text().catch(() => '')
  return new Error(`${what}: HTTP ${res.status} ${text.slice(0, 300)}`)
}

const trim = (url) => url.replace(/\/+$/, '')

export function createImageClient({ api, key, model, fetch = globalThis.fetch }) {
  const base = trim(api)
  const auth = { Authorization: `Bearer ${key}` }

  // The gateway answers with b64_json, or with a url to download
  async function image(res, what) {
    if (!res.ok) throw await failure(res, what)
    const d = (await res.json()).data?.[0] ?? {}
    if (d.b64_json) return Buffer.from(d.b64_json, 'base64')
    if (!d.url) throw new Error(`${what}: no image in the answer`)
    const img = await fetch(d.url)
    if (!img.ok) throw await failure(img, `${what} download`)
    return Buffer.from(await img.arrayBuffer())
  }

  return {
    async generate(prompt) {
      const res = await fetch(`${base}/v1/images/generations`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, size: '1024x1024', n: 1 }),
      })
      return image(res, 'image generation')
    },
    async edit(png, prompt) {
      const form = new FormData()
      form.append('model', model)
      form.append('prompt', prompt)
      form.append('size', '1024x1024')
      form.append('image', new Blob([png], { type: 'image/png' }), 'input.png')
      const res = await fetch(`${base}/v1/images/edits`, { method: 'POST', headers: auth, body: form })
      return image(res, 'image edit')
    },
  }
}

const realSleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * ZPS 3D image-to-3D: POST /send, poll GET /status/{uid} every 5 s, download the GLB right away
 * (results expire after 24 h). The input's backdrop is already transparent, so the service uses its
 * alpha; the mesh and texture are requested near game size, as the build shrinks them further anyway.
 */
export function createZps3dClient({
  api, key, fetch = globalThis.fetch, sleep = realSleep, now = Date.now, pollMs = 5000, capMs = 1_800_000,
  queueCapMs = 10_800_000, faceCount = 40_000, textureSize = 1024, onSend = () => {},
}) {
  const base = trim(api)
  const auth = { Authorization: `Bearer ${key}` }
  const download = (url) => fetch(url, { headers: auth })

  /** Poll a sent job until it is done and download its GLB. */
  async function wait(uid) {
    // The queue is shared with other users: time in line has its own, longer limit
    const sent = now()
    let started = null
    for (;;) {
      if (started === null && now() - sent >= queueCapMs) {
        throw new Error(`ZPS 3D: gave up on ${uid} after ${Math.round(queueCapMs / 60_000)} min in the queue`)
      }
      if (started !== null && now() - started >= capMs) {
        throw new Error(`ZPS 3D: gave up on ${uid} after ${Math.round(capMs / 60_000)} min`)
      }
      await sleep(pollMs)
      // A network error or a busy, restarting server: keep polling until the cap
      const r = await fetch(`${base}/status/${uid}`, { headers: auth }).catch(() => null)
      if (r?.status === 404) {
        // Unknown uid (expired, or the service restarted): the result may still be there
        const g = await download(`${base}/result/${uid}.glb`)
        if (!g.ok) throw await failure(g, `ZPS 3D job ${uid} is gone`)
        return Buffer.from(await g.arrayBuffer())
      }
      if (!r?.ok) continue
      const s = await r.json()
      if (s.status !== 'queued' && started === null) started = now()
      if (s.status === 'error') throw new Error(`ZPS 3D job ${uid}: ${s.message ?? 'error'}`)
      if (s.status === 'completed') {
        const g = await download(s.result_url)
        if (!g.ok) throw await failure(g, `ZPS 3D download ${uid}`)
        return Buffer.from(await g.arrayBuffer())
      }
    }
  }

  return {
    wait,
    async generate(png, seed) {
      const body = JSON.stringify({
        image: Buffer.from(png).toString('base64'), seed, remove_background: false, face_count: faceCount, texture_size: textureSize,
      })
      const t0 = now()
      let send
      for (;;) {
        send = await fetch(`${base}/send`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body })
        if (send.status !== 429 || now() - t0 >= capMs) break
        await sleep(60_000) // the queue is full (100 jobs)
      }
      if (!send.ok) throw await failure(send, 'ZPS 3D send')
      const { uid } = await send.json()
      onSend(uid)
      return wait(uid)
    },
  }
}
