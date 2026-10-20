// HTTP clients for the internal image model (OpenAI-compatible) and Hunyuan3D image-to-3D.

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

/** POST /send, poll GET /status/{uid}, download result_url right away (results expire after 24 h). */
export function createHy3dClient({
  api, key, fetch = globalThis.fetch, sleep = realSleep, now = Date.now, pollMs = 5000, capMs = 1_800_000,
}) {
  const base = trim(api)
  const auth = { Authorization: `Bearer ${key}` }
  return {
    async generate(png, seed) {
      const send = await fetch(`${base}/send`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: Buffer.from(png).toString('base64'), seed }),
      })
      if (!send.ok) throw await failure(send, 'Hunyuan3D send')
      const { uid } = await send.json()
      const t0 = now()
      while (now() - t0 < capMs) {
        await sleep(pollMs)
        const r = await fetch(`${base}/status/${uid}`, { headers: auth })
        if (!r.ok) continue // a busy or restarting server: keep polling until the cap
        const s = await r.json()
        if (s.status === 'error') throw new Error(`Hunyuan3D job ${uid}: ${s.message ?? 'error'}`)
        if (s.status === 'completed') {
          const g = await fetch(s.result_url, { headers: auth })
          if (!g.ok) throw await failure(g, `Hunyuan3D download ${uid}`)
          return Buffer.from(await g.arrayBuffer())
        }
      }
      throw new Error(`Hunyuan3D: gave up on ${uid} after ${Math.round(capMs / 60_000)} min`)
    },
  }
}
