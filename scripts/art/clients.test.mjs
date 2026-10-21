import { describe, expect, it } from 'vitest'
import { createImageClient, createZps3dClient } from './clients.mjs'

/** A fetch that answers each call with the next reply and records what it was asked. */
function fakeFetch(replies) {
  const calls = []
  const fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init })
    const r = replies.shift()
    if (!r) throw new Error(`unexpected fetch ${url}`)
    return typeof r === 'function' ? r(url, init) : r
  }
  return { fetch, calls }
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const bytes = (s) => new Response(Buffer.from(s))
const b64 = (s) => Buffer.from(s).toString('base64')

describe('image client', () => {
  const make = (replies) => {
    const f = fakeFetch(replies)
    return { ...f, client: createImageClient({ api: 'https://img.test/', key: 'k', model: 'm', fetch: f.fetch }) }
  }

  it('generate posts the model, prompt, 1024x1024, n 1 and decodes b64_json', async () => {
    const { client, calls } = make([json({ data: [{ b64_json: b64('PNG!') }] })])
    const out = await client.generate('p')
    expect(out.toString()).toBe('PNG!')
    expect(calls[0].url).toBe('https://img.test/v1/images/generations')
    expect(calls[0].init.headers.Authorization).toBe('Bearer k')
    expect(JSON.parse(calls[0].init.body)).toEqual({ model: 'm', prompt: 'p', size: '1024x1024', n: 1 })
  })

  it('downloads data[0].url when there is no b64_json', async () => {
    const { client, calls } = make([json({ data: [{ url: 'https://cdn.test/a.png' }] }), bytes('FROM-URL')])
    expect((await client.generate('p')).toString()).toBe('FROM-URL')
    expect(calls[1].url).toBe('https://cdn.test/a.png')
  })

  it('edit sends multipart model, prompt, size and image', async () => {
    const { client, calls } = make([json({ data: [{ b64_json: b64('EDITED') }] })])
    expect((await client.edit(Buffer.from('in'), 'repaint')).toString()).toBe('EDITED')
    expect(calls[0].url).toBe('https://img.test/v1/images/edits')
    const form = calls[0].init.body
    expect(form).toBeInstanceOf(FormData)
    expect([form.get('model'), form.get('prompt'), form.get('size')]).toEqual(['m', 'repaint', '1024x1024'])
    expect(Buffer.from(await form.get('image').arrayBuffer()).toString()).toBe('in')
  })

  it('a non-2xx answer throws with the status and the start of the body', async () => {
    const { client } = make([new Response('boom', { status: 500 })])
    await expect(client.generate('p')).rejects.toThrow(/500.*boom/)
  })
})

describe('ZPS 3D client', () => {
  const make = (replies) => {
    const f = fakeFetch(replies)
    let t = 0
    const sleeps = []
    const client = createZps3dClient({
      api: 'https://hy.test', key: 'k', fetch: f.fetch,
      sleep: async (ms) => { sleeps.push(ms); t += ms }, now: () => t,
    })
    return { ...f, client, sleeps, now: () => t }
  }

  it('sends the cut-out image with the seed and game-sized output, polls every 5 s, downloads with the Bearer header', async () => {
    const { client, calls, sleeps } = make([
      json({ uid: 'u1' }), json({ status: 'running' }), json({ status: 'running' }),
      json({ status: 'completed', result_url: 'https://hy.test/files/u1.glb' }), bytes('GLB'),
    ])
    const out = await client.generate(Buffer.from('png'), 7)
    expect(out.toString()).toBe('GLB')
    expect(calls[0].url).toBe('https://hy.test/send')
    // remove_background false: the concept's backdrop is already transparent; small mesh and texture, the build shrinks them further
    expect(JSON.parse(calls[0].init.body)).toEqual({ image: b64('png'), seed: 7, remove_background: false, face_count: 40000, texture_size: 1024 })
    expect(calls[1].url).toBe('https://hy.test/status/u1')
    expect(sleeps).toEqual([5000, 5000, 5000])
    expect(calls[4].url).toBe('https://hy.test/files/u1.glb')
    expect(calls[4].init.headers.Authorization).toBe('Bearer k')
    for (const c of calls) expect(c.url).not.toMatch(/\/generate|base64=true/)
  })

  it('keeps polling through a transient HTTP error', async () => {
    const { client } = make([
      json({ uid: 'u1' }), new Response('busy', { status: 503 }),
      json({ status: 'completed', result_url: 'https://hy.test/r' }), bytes('GLB'),
    ])
    expect((await client.generate(Buffer.from('png'), 1)).toString()).toBe('GLB')
  })

  it('a full queue (429) waits 60 s and sends again', async () => {
    const { client, calls, sleeps } = make([
      new Response('full', { status: 429 }), json({ uid: 'u2' }),
      json({ status: 'completed', result_url: 'https://hy.test/r' }), bytes('GLB'),
    ])
    expect((await client.generate(Buffer.from('png'), 1)).toString()).toBe('GLB')
    expect(calls.map((c) => c.url).slice(0, 2)).toEqual(['https://hy.test/send', 'https://hy.test/send'])
    expect(sleeps[0]).toBe(60_000)
  })

  it('an unknown uid (404, e.g. the service restarted) tries the result once', async () => {
    const { client, calls } = make([json({ uid: 'u3' }), new Response('gone', { status: 404 }), bytes('GLB')])
    expect((await client.generate(Buffer.from('png'), 1)).toString()).toBe('GLB')
    expect(calls[2].url).toBe('https://hy.test/result/u3.glb')
    expect(calls[2].init.headers.Authorization).toBe('Bearer k')
  })

  it('an unknown uid with no result throws, so the batch retries with a new job', async () => {
    const { client } = make([json({ uid: 'u4' }), new Response('gone', { status: 404 }), new Response('gone', { status: 404 })])
    await expect(client.generate(Buffer.from('png'), 1)).rejects.toThrow(/u4/)
  })

  it('a network error while polling is retried like a busy server', async () => {
    const { client } = make([
      json({ uid: 'u8' }), () => { throw new TypeError('fetch failed') },
      json({ status: 'completed', result_url: 'https://hy.test/r' }), bytes('GLB'),
    ])
    expect((await client.generate(Buffer.from('png'), 1)).toString()).toBe('GLB')
  })

  it('wait(uid) picks up a job sent earlier', async () => {
    const { client, calls } = make([json({ status: 'completed', result_url: 'https://hy.test/r9' }), bytes('GLB')])
    expect((await client.wait('u9')).toString()).toBe('GLB')
    expect(calls[0].url).toBe('https://hy.test/status/u9')
  })

  it('status error throws its message', async () => {
    const { client } = make([json({ uid: 'u1' }), json({ status: 'error', message: 'bad mesh' })])
    await expect(client.generate(Buffer.from('png'), 1)).rejects.toThrow(/bad mesh/)
  })

  it('time waiting in the queue does not count toward the 30 minutes', async () => {
    const queued = () => json({ status: 'queued', position: 40 })
    const { client } = make([
      json({ uid: 'u5' }), ...Array.from({ length: 480 }, () => queued), // 40 min in line
      json({ status: 'processing' }), json({ status: 'completed', result_url: 'https://hy.test/r' }), bytes('GLB'),
    ])
    expect((await client.generate(Buffer.from('png'), 1)).toString()).toBe('GLB')
  })

  it('gives up after 3 hours in the queue', async () => {
    const queued = () => json({ status: 'queued', position: 90 })
    const { client, now } = make([json({ uid: 'u6' }), ...Array.from({ length: 2200 }, () => queued)])
    await expect(client.generate(Buffer.from('png'), 1)).rejects.toThrow(/u6.*180 min in the queue/)
    expect(now()).toBeGreaterThanOrEqual(10_800_000)
  })

  it('reports each job id as it is sent, so a result can be fetched later', async () => {
    const sent = []
    const f = fakeFetch([json({ uid: 'u7' }), json({ status: 'completed', result_url: 'https://hy.test/r' }), bytes('GLB')])
    const client = createZps3dClient({ api: 'https://hy.test', key: 'k', fetch: f.fetch, sleep: async () => {}, onSend: (uid) => sent.push(uid) })
    await client.generate(Buffer.from('png'), 1)
    expect(sent).toEqual(['u7'])
  })

  it('gives up after 30 minutes', async () => {
    const running = () => json({ status: 'running' })
    const { client, now } = make([json({ uid: 'u1' }), ...Array.from({ length: 400 }, () => running)])
    await expect(client.generate(Buffer.from('png'), 1)).rejects.toThrow(/u1.*30 min/)
    expect(now()).toBeGreaterThanOrEqual(1_800_000)
  })
})
