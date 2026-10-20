import { guestCoopEnabled } from './flags'

describe('GUEST_COOP (same rule as the Nakama co-op match)', () => {
  const saved = process.env.GUEST_COOP
  afterEach(() => {
    if (saved === undefined) delete process.env.GUEST_COOP
    else process.env.GUEST_COOP = saved
  })

  it('lets guests fly co-op when unset or blank', () => {
    delete process.env.GUEST_COOP
    expect(guestCoopEnabled()).toBe(true)
    process.env.GUEST_COOP = '  '
    expect(guestCoopEnabled()).toBe(true)
  })

  it('false, 0 and no turn guests off, in any case and with spaces', () => {
    for (const v of ['false', 'FALSE', ' 0 ', 'no', 'No']) {
      process.env.GUEST_COOP = v
      expect(guestCoopEnabled()).toBe(false)
    }
  })

  it('anything else keeps guests on', () => {
    for (const v of ['true', '1', 'yes', 'on']) {
      process.env.GUEST_COOP = v
      expect(guestCoopEnabled()).toBe(true)
    }
  })
})
