import { describe, expect, it } from 'vitest'
import { createHy3dClient, createImageClient } from './clients.mjs'

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

describe('Hunyuan3D client', () => {
  const make = (replies) => {
    const f = fakeFetch(replies)
    let t = 0
    const sleeps = []
    const client = createHy3dClient({
      api: 'https://hy.test', key: 'k', fetch: f.fetch,
      sleep: async (ms) => { sleeps.push(ms); t += ms }, now: () => t,
    })
    return { ...f, client, sleeps, now: () => t }
  }

  it('sends the image as base64 with the seed, polls every 5 s and downloads with the Bearer header', async () => {
    const { client, calls, sleeps } = make([
      json({ uid: 'u1' }), json({ status: 'running' }), json({ status: 'running' }),
      json({ status: 'completed', result_url: 'https://hy.test/files/u1.glb' }), bytes('GLB'),
    ])
    const out = await client.generate(Buffer.from('png'), 7)
    expect(out.toString()).toBe('GLB')
    expect(calls[0].url).toBe('https://hy.test/send')
    expect(JSON.parse(calls[0].init.body)).toEqual({ image: b64('png'), seed: 7 })
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

  it('status error throws its message', async () => {
    const { client } = make([json({ uid: 'u1' }), json({ status: 'error', message: 'bad mesh' })])
    await expect(client.generate(Buffer.from('png'), 1)).rejects.toThrow(/bad mesh/)
  })

  it('gives up after 30 minutes', async () => {
    const running = () => json({ status: 'running' })
    const { client, now } = make([json({ uid: 'u1' }), ...Array.from({ length: 400 }, () => running)])
    await expect(client.generate(Buffer.from('png'), 1)).rejects.toThrow(/u1.*30 min/)
    expect(now()).toBeGreaterThanOrEqual(1_800_000)
  })
})
