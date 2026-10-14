/** Explicit false/0/no disables. Empty uses `whenUnset`. Anything else enables. */
export function envEnabled(name: string, whenUnset: boolean): boolean {
  const v = process.env[name]?.trim().toLowerCase()
  if (!v) return whenUnset
  if (v === 'false' || v === '0' || v === 'no') return false
  return true
}

/** Dev username login. Off unless LOCAL_LOGIN=true. */
export const localLoginEnabled = () => envEnabled('LOCAL_LOGIN', false)

/** Guest pilots may play co-op. On unless GUEST_COOP=false. Nakama enforces the same name. */
export const guestCoopEnabled = () => envEnabled('GUEST_COOP', true)

/** Public Nakama used when NAKAMA_HOST is unset. Scheme selects SSL and the port. */
export const DEFAULT_NAKAMA_URL = 'https://nakama.zingplay.dev'

export interface NakamaEndpoint {
  host: string
  port: string
  serverKey: string
  useSSL: boolean
}

/** Host may be `nakama.zingplay.dev` or a full `https://…` URL. Port and SSL env override the URL. */
export function nakamaEndpoint(env: NodeJS.ProcessEnv = process.env): NakamaEndpoint {
  const raw = env.NAKAMA_HOST?.trim() || DEFAULT_NAKAMA_URL
  let host = raw
  let port = env.NAKAMA_PORT?.trim() || ''
  let ssl = env.NAKAMA_SSL?.trim().toLowerCase() || ''
  if (raw.includes('://')) {
    const url = new URL(raw)
    host = url.hostname
    if (!port) port = url.port || (url.protocol === 'https:' ? '443' : '7350')
    if (!ssl) ssl = url.protocol === 'https:' ? 'true' : 'false'
  }
  return {
    host,
    port: port || '7350',
    serverKey: env.NAKAMA_SERVER_KEY?.trim() || 'defaultkey',
    useSSL: ssl === 'true' || ssl === '1' || ssl === 'yes',
  }
}
