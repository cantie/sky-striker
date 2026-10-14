import { describe, expect, it } from 'vitest'
import { guestCoopAllowed, resolveCoopIdentity } from './identity'

const guest = { guest: true, user: null, token: null, guestId: 'guest:abc' }

describe('guest co-op identity', () => {
  it('lets a guest play unless the flag is explicitly false', () => {
    expect(guestCoopAllowed(undefined)).toBe(true)
    expect(guestCoopAllowed(true)).toBe(true)
    expect(guestCoopAllowed(false)).toBe(false)
    expect(resolveCoopIdentity({ ...guest, guestCoop: true })).toEqual({
      ok: true, userId: 'guest:abc', name: 'Guest', guest: true,
    })
    expect(resolveCoopIdentity({ ...guest, guestCoop: undefined })).toMatchObject({ ok: true, userId: 'guest:abc' })
    expect(resolveCoopIdentity({ ...guest, guestCoop: false })).toEqual({ ok: false, reason: 'Log in to play co-op' })
  })

  it('always lets a signed-in pilot through, even when guests are off', () => {
    const id = resolveCoopIdentity({
      guest: false, user: { id: 7, name: ' Ace ' }, guestCoop: false, token: 'jwt', guestId: 'guest:abc',
    })
    expect(id).toEqual({ ok: true, userId: 'skystriker-7', name: 'Ace', token: 'jwt', guest: false })
  })

  it('prefixes a bare guest id', () => {
    expect(resolveCoopIdentity({ ...guest, guestId: 'abc', guestCoop: true })).toMatchObject({ userId: 'guest:abc' })
  })
})
