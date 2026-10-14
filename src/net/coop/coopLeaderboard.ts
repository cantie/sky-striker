import type { Client, Session } from '@heroiclabs/nakama-js'
import { DEFAULT_NAKAMA } from '../api'
import { useAccount } from '../../store/account'
import { readCoopIdentity } from './identity'

/** Same packing as Nakama `skystriker_coop.lua`: stages × scale + (scale − 1 − seconds). */
export const COOP_STAGE_SCALE = 10_000_000

export type CoopBoardId = 'stage' | 'kills' | 'score'

export interface CoopBoardRow {
  rank: number
  owner: string
  names: string
  score: number
  subscore: number
  mine?: boolean
}

export interface CoopBoardResult {
  rows: CoopBoardRow[]
  me: CoopBoardRow | null
}

/** Seconds hidden in the stage board's remainder (faster runs rank higher). */
export function coopStageSeconds(subscore: number): number {
  return Math.max(0, COOP_STAGE_SCALE - 1 - subscore)
}

let client: Client | null = null
let session: Session | null = null
let authedAs = ''

/** Nakama co-op boards (stage, kills, score). One row per pilot pair. */
export async function fetchCoopLeaderboard(board: CoopBoardId, limit = 50): Promise<CoopBoardResult> {
  const who = readCoopIdentity()
  if (!who.ok) throw new Error(who.reason)
  const nakama = useAccount.getState().config?.nakama ?? DEFAULT_NAKAMA
  if (!client || !session || authedAs !== who.userId) {
    const { Client } = await import('@heroiclabs/nakama-js')
    client = new Client(nakama.serverKey, nakama.host, nakama.port, nakama.useSSL)
    session = await client.authenticateCustom(who.userId, true, undefined, who.token ? { token: who.token } : undefined)
    authedAs = who.userId
  }
  const res = await client.rpc(session, 'skystriker_leaderboard', { board, limit })
  const payload = typeof res.payload === 'string' ? JSON.parse(res.payload) : res.payload
  const data = (payload ?? {}) as { rows?: CoopBoardRow[]; me?: CoopBoardRow | null; error?: string }
  if (data.error) throw new Error(data.error)
  return { rows: data.rows ?? [], me: data.me ?? null }
}
