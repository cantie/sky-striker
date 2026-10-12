import { BadGatewayException, BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common'

/** Who Keycloak says the user is. */
export interface OidcIdentity {
  sub: string
  username: string | null
  email: string | null
  displayName: string | null
}

const clip = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? [...t].slice(0, 255).join('') : null
}

/** Merge ID-token claims with userinfo (claims win), and require a subject. */
export function readOidcIdentity(claims: Record<string, unknown> | undefined, userinfo: Record<string, unknown> | null): OidcIdentity {
  const merged: Record<string, unknown> = { ...(userinfo ?? {}), ...(claims ?? {}) }
  const sub = merged.sub
  if (typeof sub !== 'string' || !sub.trim() || [...sub].length > 255) {
    throw new UnauthorizedException('OIDC authentication failed: missing subject')
  }
  return { sub, username: clip(merged.preferred_username), email: clip(merged.email), displayName: clip(merged.name) }
}

/** Keycloak compares redirect_uri exactly: drop query/hash, keep the path as the client sent it. */
export function tokenRedirectUri(redirectUri: string): string {
  return redirectUri.split('#')[0].split('?')[0]
}

/** Token-request body with redirect_uri forced to the exact authorize-request value. */
export function withExactRedirect<T>(body: T, redirectUri: string): T | URLSearchParams {
  if (!(body instanceof URLSearchParams) || !body.has('redirect_uri')) return body
  const next = new URLSearchParams(body)
  next.set('redirect_uri', redirectUri)
  return next
}

const normalize = (v: string) => v.trim().replace(/\/$/, '')

/** Only redirect URIs listed in KEYCLOAK_REDIRECT_URIS (comma separated) may be used. */
export function assertRedirectUri(redirectUri: string, allowlistRaw: string | undefined): void {
  const allowed = (allowlistRaw ?? '').split(',').map(normalize).filter(Boolean)
  if (!allowed.includes(normalize(tokenRedirectUri(redirectUri)))) throw new BadRequestException('Invalid redirect_uri')
}

@Injectable()
export class KeycloakOidc {
  private readonly logger = new Logger(KeycloakOidc.name)

  isConfigured(): boolean {
    return !!(process.env.KEYCLOAK_ISSUER?.trim() && process.env.KEYCLOAK_CLIENT_ID?.trim() && process.env.KEYCLOAK_CLIENT_SECRET?.trim())
  }

  /** Authorization-code + PKCE exchange against the confidential Keycloak client. */
  async exchangeCode(input: { code: string; redirectUri: string; codeVerifier: string }): Promise<OidcIdentity> {
    const issuer = process.env.KEYCLOAK_ISSUER?.trim()
    const clientId = process.env.KEYCLOAK_CLIENT_ID?.trim()
    const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET?.trim()
    if (!issuer || !clientId || !clientSecret) throw new BadGatewayException('Keycloak is not configured')
    if (!input.codeVerifier.trim()) throw new UnauthorizedException('PKCE code_verifier is required')

    try {
      const oidc = await import('openid-client')
      const config = await oidc.discovery(new URL(issuer), clientId, clientSecret)
      // openid-client derives redirect_uri from a URL object, which re-adds a trailing "/" to
      // origin-only URLs. Send exactly the URI used in the authorize request instead.
      const exactRedirect = tokenRedirectUri(input.redirectUri)
      config[oidc.customFetch] = (url, init) => fetch(url, { ...init, body: withExactRedirect(init.body, exactRedirect) } as RequestInit)
      const callbackUrl = new URL(tokenRedirectUri(input.redirectUri))
      callbackUrl.searchParams.set('code', input.code)
      callbackUrl.searchParams.set('iss', issuer.replace(/\/$/, ''))
      const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
        expectedState: oidc.skipStateCheck,
        pkceCodeVerifier: input.codeVerifier,
      })
      const claims = tokens.claims() as Record<string, unknown> | undefined
      let userinfo: Record<string, unknown> | null = null
      if (!claims?.preferred_username && tokens.access_token && typeof claims?.sub === 'string') {
        userinfo = { ...(await oidc.fetchUserInfo(config, tokens.access_token, claims.sub)) }
      }
      return readOidcIdentity(claims, userinfo)
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error
      // Node's fetch wraps network failures: the errno code sits on error.cause
      const err = error as NodeJS.ErrnoException & { cause?: NodeJS.ErrnoException }
      const code = err?.code ?? err?.cause?.code
      if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT' || code === 'EAI_AGAIN') {
        this.logger.warn(`Keycloak unreachable: ${code}`)
        throw new BadGatewayException('Keycloak unavailable')
      }
      this.logger.warn(`OIDC exchange failed: ${(error as Error)?.message ?? error}`)
      throw new UnauthorizedException('OIDC authentication failed')
    }
  }
}
