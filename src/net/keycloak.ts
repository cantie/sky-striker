/**
 * Keycloak login via Authorization Code + PKCE (same flow as zct). The browser only ever
 * holds the PKCE verifier; the server swaps the code for an identity using the client secret.
 */
const VERIFIER_KEY = 'sky-striker-oidc-verifier'
const STATE_KEY = 'sky-striker-oidc-state'

function base64Url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function randomBase64Url(size: number): string {
  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)
  return base64Url(bytes)
}

/** Where Keycloak sends the user back: the game's own URL (must be in KEYCLOAK_REDIRECT_URIS). */
export const redirectUri = () => `${window.location.origin}${window.location.pathname}`

export async function startKeycloakLogin(issuer: string, clientId: string): Promise<void> {
  const verifier = randomBase64Url(32)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const state = randomBase64Url(16)
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(STATE_KEY, state)
  const url = new URL(`${issuer}/protocol/openid-connect/auth`)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid profile email')
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', base64Url(new Uint8Array(digest)))
  url.searchParams.set('code_challenge_method', 'S256')
  window.location.href = url.toString()
}

export type Callback =
  | { status: 'none' }
  | { status: 'ok'; code: string; verifier: string }
  | { status: 'error'; message: string }

/** Read (and strip) Keycloak's ?code&state / ?error from the URL after the redirect back. */
export function consumeCallback(): Callback {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code'), state = params.get('state'), error = params.get('error')
  const errorDescription = params.get('error_description')
  if (!code && !error) return { status: 'none' }
  // Clean the address bar so a reload doesn't replay the code
  for (const k of ['code', 'state', 'error', 'error_description', 'session_state', 'iss']) params.delete(k)
  const qs = params.toString()
  window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`)

  const expected = sessionStorage.getItem(STATE_KEY)
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  sessionStorage.removeItem(STATE_KEY)
  sessionStorage.removeItem(VERIFIER_KEY)
  if (error) return { status: 'error', message: errorDescription || error }
  if (!state || !expected || state !== expected || !verifier) return { status: 'error', message: 'Login expired, please try again' }
  return { status: 'ok', code: code!, verifier }
}

/** End the Keycloak SSO session too, then come back to the game. */
export function keycloakLogoutUrl(issuer: string, clientId: string): string {
  const url = new URL(`${issuer}/protocol/openid-connect/logout`)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('post_logout_redirect_uri', redirectUri())
  return url.toString()
}
