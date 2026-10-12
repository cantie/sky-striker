import type { Client, Session } from '@heroiclabs/nakama-js'

/** Where the Nakama cluster is (VITE_NAKAMA_* at build time; defaults = the shared ZPS cluster). */
export interface NakamaConfig { serverKey: string; host: string; port: string; useSSL: boolean }

export function nakamaConfig(): NakamaConfig {
  const env = import.meta.env
  return {
    serverKey: env.VITE_NAKAMA_KEY || 'defaultkey',
    host: env.VITE_NAKAMA_HOST || 'nakama.zingplay.dev',
    port: env.VITE_NAKAMA_PORT || '443',
    useSSL: (env.VITE_NAKAMA_SSL || 'true') === 'true',
  }
}

/** Nakama custom id for a game account (6–128 chars). The match verifies the game login itself. */
export const customId = (playerId: string) => `skystriker-${playerId}`

let conn: { playerId: string; promise: Promise<{ client: Client; session: Session }> } | null = null

/** One Nakama session per game account, refreshed when it is about to expire. nakama-js loads on demand. */
export async function nakamaSession(playerId: string): Promise<{ client: Client; session: Session }> {
  if (conn && conn.playerId === playerId) {
    const c = await conn.promise.catch(() => null)
    if (c && !c.session.isexpired(Date.now() / 1000 + 60)) return c
  }
  const promise = (async () => {
    const { Client } = await import('@heroiclabs/nakama-js')
    const { serverKey, host, port, useSSL } = nakamaConfig()
    const client = new Client(serverKey, host, port, useSSL)
    const session = await client.authenticateCustom(customId(playerId), true)
    return { client, session }
  })()
  conn = { playerId, promise }
  return promise
}

export async function nakamaRpc<T>(playerId: string, id: string, payload: object): Promise<T> {
  const { client, session } = await nakamaSession(playerId)
  const res = await client.rpc(session, id, payload)
  const raw = res.payload as unknown
  return (typeof raw === 'string' ? JSON.parse(raw || '{}') : raw ?? {}) as T
}
