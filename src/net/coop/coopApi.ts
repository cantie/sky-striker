import { useAccount } from '../../store/account'
import { list } from './protocol'
import { nakamaRpc } from './nakamaClient'

export type CoopBoard = 'stage' | 'kills' | 'score'
export interface CoopRow {
  rank: number; owner: string; names: string; score: number; subscore: number; mine?: boolean
  metadata?: { timeMs?: number; stages?: number; kills?: number; score?: number }
}
export interface CoopBoardResult { rows: CoopRow[]; me: CoopRow | null }

/** A co-op leaderboard (top 50 + my best pair), for the logged-in account. */
export async function coopLeaderboard(board: CoopBoard): Promise<CoopBoardResult> {
  const user = useAccount.getState().user
  if (!user) throw new Error('Log in to see the co-op leaderboards')
  const r = await nakamaRpc<{ rows?: CoopRow[]; me?: CoopRow; error?: string }>(String(user.id), 'skystriker_leaderboard', { board, limit: 50 })
  if (r.error) throw new Error(r.error)
  return { rows: list(r.rows), me: r.me ?? null }
}
