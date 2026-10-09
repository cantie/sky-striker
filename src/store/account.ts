import { create } from 'zustand'
import { api, ApiError, clearToken, readToken, writeToken, type AccountUser, type PublicConfig } from '../net/api'
import { consumeCallback, keycloakLogoutUrl, redirectUri, startKeycloakLogin } from '../net/keycloak'
import { loadGuestProgress, loadProgress, normalizeProgress, saveProgress, setProgressScope, type SagaProgress } from '../game/progress'
import { setCloudHooks, useGameStore } from './gameStore'

/**
 * Optional account layer. Without a login the game runs exactly as before (guest, local save);
 * logged in, the save lives on the server, runs are recorded and leaderboards open up.
 */
type Status = 'init' | 'guest' | 'busy' | 'user'
type Method = 'keycloak' | 'local'

interface AccountStore {
  status: Status
  user: AccountUser | null
  config: PublicConfig | null
  error: string | null
  /** Logged in but the server is unreachable (playing on the cached save). */
  offline: boolean
  init: () => Promise<void>
  loginKeycloak: () => Promise<void>
  loginLocal: (username: string) => Promise<void>
  logout: () => void
}

const USER_KEY = 'sky-striker-user'
type CachedUser = AccountUser & { method: Method }
const readCachedUser = (): CachedUser | null => {
  try { return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null') } catch { return null }
}

/** Server is the source of truth for an account's save; mirror it locally and into the game. */
function applyServerProgress(progress: SagaProgress) {
  if (useAccount.getState().status !== 'user') return
  const p = normalizeProgress(progress)
  saveProgress(p)
  useGameStore.setState({ progress: p })
}

async function resync() {
  try { applyServerProgress((await api.me()).progress) } catch { /* keep the local copy */ }
}

const message = (e: unknown) => (e instanceof ApiError ? (e.status === 0 ? 'Server unreachable' : e.message) : 'Login failed')

export const useAccount = create<AccountStore>((set, get) => {
  /** Switch the game over to an account; on a fresh login the guest save is merged in. */
  async function enter(user: AccountUser, method: Method, mergeGuest: boolean) {
    setProgressScope(user.id)
    localStorage.setItem(USER_KEY, JSON.stringify({ ...user, method } satisfies CachedUser))
    set({ status: 'user', user, error: null, offline: false })
    const { progress } = mergeGuest ? await api.merge(loadGuestProgress()) : await api.me()
    applyServerProgress(progress)
  }

  function toGuest(error: string | null = null) {
    clearToken()
    localStorage.removeItem(USER_KEY)
    setProgressScope(null)
    set({ status: 'guest', user: null, error, offline: false })
    useGameStore.setState({ progress: loadProgress() })
  }

  return {
    status: 'init',
    user: null,
    config: null,
    error: null,
    offline: false,

    init: async () => {
      let config: PublicConfig | null = null
      try { config = await api.config() } catch { /* no server: guest-only */ }
      set({ config })

      const cb = consumeCallback()
      if (cb.status === 'error') return toGuest(cb.message)
      if (cb.status === 'ok') {
        set({ status: 'busy' })
        try {
          const session = await api.loginOidc({ code: cb.code, redirect_uri: redirectUri(), code_verifier: cb.verifier })
          writeToken(session.access_token)
          await enter(session.user, 'keycloak', true)
        } catch (e) {
          toGuest(message(e))
        }
        return
      }

      if (!readToken()) return toGuest()
      const cached = readCachedUser()
      try {
        const { user } = await api.me()
        await enter(user, cached?.method ?? 'keycloak', false)
      } catch (e) {
        if (e instanceof ApiError && e.status === 0 && cached) {
          // Offline: keep flying on the cached account save
          setProgressScope(cached.id)
          set({ status: 'user', user: cached, offline: true })
          useGameStore.setState({ progress: loadProgress() })
        } else {
          toGuest(e instanceof ApiError && e.status === 401 ? 'Session expired, please log in again' : null)
        }
      }
    },

    loginKeycloak: async () => {
      const kc = get().config?.keycloak
      if (kc) await startKeycloakLogin(kc.issuer, kc.clientId)
    },

    loginLocal: async (username) => {
      set({ status: 'busy', error: null })
      try {
        const session = await api.loginLocal(username)
        writeToken(session.access_token)
        await enter(session.user, 'local', true)
      } catch (e) {
        toGuest(message(e))
      }
    },

    logout: () => {
      const kc = get().config?.keycloak
      const method = readCachedUser()?.method
      toGuest()
      // Also end the Keycloak SSO session so the next login can pick another account
      if (kc && method === 'keycloak') window.location.href = keycloakLogoutUrl(kc.issuer, kc.clientId)
    },
  }
})

// Game → server sync while logged in (fire-and-forget; the server's answer wins)
setCloudHooks({
  reportRun: (run) => {
    if (useAccount.getState().status !== 'user') return
    api.submitRun(run).then((r) => applyServerProgress(r.progress)).catch((e) => console.warn('Run not recorded:', message(e)))
  },
  buyPlane: (id) => {
    if (useAccount.getState().status !== 'user') return
    api.buyPlane(id).then((r) => applyServerProgress(r.progress)).catch(resync)
  },
  selectPlane: (id) => {
    if (useAccount.getState().status !== 'user') return
    api.selectPlane(id).then((r) => applyServerProgress(r.progress)).catch(resync)
  },
})
