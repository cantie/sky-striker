import { describe, expect, it } from 'vitest'
import { coopIdentity } from './identity'

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
