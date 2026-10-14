import { envEnabled, guestCoopEnabled, localLoginEnabled, nakamaEndpoint } from './flags'

describe('env flags', () => {
  const prevGuest = process.env.GUEST_COOP
  const prevLocal = process.env.LOCAL_LOGIN
  afterEach(() => {
    process.env.GUEST_COOP = prevGuest
    process.env.LOCAL_LOGIN = prevLocal
  })

  it('treats empty as the fallback and only an explicit false as off', () => {
    delete process.env.GUEST_COOP
    expect(envEnabled('GUEST_COOP', true)).toBe(true)
    process.env.GUEST_COOP = 'false'
    expect(envEnabled('GUEST_COOP', true)).toBe(false)
    process.env.GUEST_COOP = '0'
    expect(guestCoopEnabled()).toBe(false)
    process.env.GUEST_COOP = 'no'
    expect(guestCoopEnabled()).toBe(false)
    process.env.GUEST_COOP = 'true'
    expect(guestCoopEnabled()).toBe(true)
  })

  it('defaults Nakama to https://nakama.zingplay.dev', () => {
    expect(nakamaEndpoint({})).toEqual({
      host: 'nakama.zingplay.dev', port: '443', serverKey: 'defaultkey', useSSL: true,
    })
    expect(nakamaEndpoint({ NAKAMA_HOST: '127.0.0.1' })).toMatchObject({
      host: '127.0.0.1', port: '7350', useSSL: false,
    })
    expect(nakamaEndpoint({ NAKAMA_HOST: 'https://nakama.zingplay.dev', NAKAMA_PORT: '7351' }).port).toBe('7351')
  })

  it('keeps local login opt-in', () => {
    delete process.env.LOCAL_LOGIN
    expect(localLoginEnabled()).toBe(false)
    process.env.LOCAL_LOGIN = 'true'
    expect(localLoginEnabled()).toBe(true)
  })
})
