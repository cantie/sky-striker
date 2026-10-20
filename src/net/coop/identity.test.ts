import { describe, expect, it } from 'vitest'
import { coopIdentity, guestsMayCoop } from './identity'
import { customId, nakamaErrorMessage } from './nakamaClient'

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } }
}

describe('co-op identity', () => {
  it('a logged-in player flies as their game account', () => {
    expect(coopIdentity({ id: 42, name: 'Maverick' }, memory())).toEqual({ userId: '42', name: 'Maverick' })
  })

  it('a guest gets an id and a short name kept in this browser', () => {
    const store = memory()
    const first = coopIdentity(null, store)
    expect(first.userId).toMatch(/^guest-[0-9a-f]{24}$/)
    expect(first.name).toMatch(/^Guest [0-9A-F]{4}$/)
    expect(first.name.slice(6)).toBe(first.userId.slice(6, 10).toUpperCase())
    // Same browser, same guest (a reload can still REJOIN its room)
    expect(coopIdentity(null, store)).toEqual(first)
  })

  it('guests in two browsers are two players', () => {
    expect(coopIdentity(null, memory()).userId).not.toBe(coopIdentity(null, memory()).userId)
  })
})

describe('guest co-op (GUEST_COOP)', () => {
  it('a guest reaches Nakama as guest:<hex>, the prefix the match refuses when GUEST_COOP=false', () => {
    const { userId } = coopIdentity(null, memory())
    expect(customId(userId)).toBe(`guest:${userId.slice(6)}`)
  })

  it('a game account reaches Nakama as skystriker-<id>', () => {
    expect(customId('42')).toBe('skystriker-42')
  })

  it('guests may fly unless the server says GUEST_COOP=false (no server or an old one: allowed)', () => {
    expect(guestsMayCoop(null)).toBe(true)
    expect(guestsMayCoop({})).toBe(true)
    expect(guestsMayCoop({ guestCoop: true })).toBe(true)
    expect(guestsMayCoop({ guestCoop: false })).toBe(false)
  })

  it('a refused Nakama login reads as the server message', async () => {
    const refused = new Response(JSON.stringify({ error: 'Log in to play co-op', message: 'Log in to play co-op', code: 2 }), { status: 500 })
    expect(await nakamaErrorMessage(refused, 'Could not connect')).toBe('Log in to play co-op')
    expect(await nakamaErrorMessage(new Error('socket closed'), 'Could not connect')).toBe('socket closed')
    expect(await nakamaErrorMessage(new Response('not json', { status: 502 }), 'Could not connect')).toBe('Could not connect')
  })
})
