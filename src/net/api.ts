import type { SagaProgress } from '../game/progress'

/** Same-origin API (the server also hosts the game); Vite proxies /api in dev. */
const BASE = '/api'
const TOKEN_KEY = 'sky-striker-token'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export const readToken = () => localStorage.getItem(TOKEN_KEY)
export const writeToken = (t: string) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  const token = readToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, 'Network unavailable')
  }
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new ApiError(res.status, (data && (Array.isArray(data.message) ? data.message[0] : data.message)) || res.statusText)
  return data as T
}

export interface PublicConfig {
  keycloak: { issuer: string; clientId: string } | null
  localLogin: boolean
}
export interface AccountUser { id: number; name: string }
export interface Session { access_token: string; user: AccountUser }
export type LeaderboardMetric = 'score' | 'sagaStars' | 'goldStars'
export interface LeaderboardRow { rank: number; playerId: number; name: string; value: number }
export interface LeaderboardResult { by: LeaderboardMetric; rows: LeaderboardRow[]; me: { playerId: number; rank: number | null; value: number } }

export interface RunReport {
  stageId: number; score: number; won: boolean; goldStars: number
  earned: string[]; planeId: string; kills: number; spawned: number
}

export const api = {
  config: () => request<PublicConfig>('GET', '/config'),
  loginOidc: (body: { code: string; redirect_uri: string; code_verifier: string }) => request<Session>('POST', '/auth/oidc', body),
  loginLocal: (username: string) => request<Session>('POST', '/auth/local', { username }),
  me: () => request<{ user: AccountUser; progress: SagaProgress }>('GET', '/me'),
  merge: (progress: SagaProgress) => request<{ progress: SagaProgress }>('POST', '/me/merge', { progress }),
  submitRun: (run: RunReport) => request<{ progress: SagaProgress }>('POST', '/runs', run),
  buyPlane: (id: string) => request<{ progress: SagaProgress }>('POST', `/me/planes/${encodeURIComponent(id)}/buy`),
  selectPlane: (planeId: string) => request<{ progress: SagaProgress }>('PUT', '/me/plane', { planeId }),
  leaderboard: (by: LeaderboardMetric) => request<LeaderboardResult>('GET', `/leaderboard?by=${by}&limit=50`),
}
