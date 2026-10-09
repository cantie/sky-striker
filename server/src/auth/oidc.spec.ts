import { BadRequestException, UnauthorizedException } from '@nestjs/common'
import { assertRedirectUri, readOidcIdentity, tokenRedirectUri } from './oidc'

describe('readOidcIdentity', () => {
  it('prefers token claims and falls back to userinfo', () => {
    expect(readOidcIdentity({ sub: 'abc', name: 'Ace Pilot' }, { preferred_username: 'ace', email: 'a@x.io', name: 'ignored' }))
      .toEqual({ sub: 'abc', username: 'ace', email: 'a@x.io', displayName: 'Ace Pilot' })
  })

  it('requires a subject', () => {
    expect(() => readOidcIdentity({ name: 'x' }, null)).toThrow(UnauthorizedException)
  })
})

describe('redirect URIs', () => {
  it('strips query and hash before comparing', () => {
    expect(tokenRedirectUri('https://game.io/?code=1&state=2#x')).toBe('https://game.io/')
  })

  it('accepts listed URIs regardless of trailing slash', () => {
    expect(() => assertRedirectUri('https://game.io/?code=1', 'https://other.io, https://game.io')).not.toThrow()
  })

  it('rejects anything else', () => {
    expect(() => assertRedirectUri('https://evil.io', 'https://game.io')).toThrow(BadRequestException)
    expect(() => assertRedirectUri('https://game.io', undefined)).toThrow(BadRequestException)
  })
})
