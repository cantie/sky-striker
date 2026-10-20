import { useGameStore } from '../../store/gameStore'
import { useAccount } from '../../store/account'
import { CoopSession } from './coopSession'
import { coopData } from './coopData'
import { coopIdentity, guestsMayCoop } from './identity'
import { LoopbackServer, LoopbackTransport } from './loopbackServer'
import { NakamaTransport } from './nakamaTransport'
import { selfHp, storeWorld } from './storeWorld'

/** The co-op session currently running (null in single-player). */
let active: CoopSession | null = null
let label = ''

export const activeSession = () => active
export const sessionLabel = () => label

const ROOM_KEY = 'sky-striker-coop-room'
/** Code of the last room we were in (for REJOIN after a reload or a dropped connection). */
export const lastRoomCode = () => sessionStorage.getItem(ROOM_KEY)

function track(session: CoopSession, name: string): void {
  active = session
  label = name
  session.onStop(() => {
    if (active === session) { active = null; label = '' }
  })
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__coop = session
}

/** Enter a co-op room on the Nakama cluster, as the logged-in account or as this browser's guest. */
export async function startNakamaCoop(room: 'create' | 'match' | { code: string }): Promise<CoopSession> {
  await stopCoop()
  const { status, user, config } = useAccount.getState()
  if (status !== 'user' && !guestsMayCoop(config)) throw new Error('Log in to play co-op')
  const me = coopIdentity(status === 'user' ? user : null)
  const session = new CoopSession(new NakamaTransport(), storeWorld())
  track(session, 'ONLINE')
  try {
    const info = await session.start({
      ...me, plane: useGameStore.getState().progress.plane, hp: selfHp(), dataVersion: coopData().version, room,
    })
    if (info.code) sessionStorage.setItem(ROOM_KEY, info.code)
  } catch (e) {
    await stopCoop()
    throw e
  }
  return session
}

/**
 * Dev / test entry (`?coop=loopback[&stage=N&lat=80&jitter=20]`): an in-browser authoritative
 * server with a bot wingmate, reached through a simulated network. Starts right away.
 */
export async function startLoopbackCoop(q: URLSearchParams): Promise<CoopSession> {
  await stopCoop()
  const latencyMs = Number(q.get('lat') ?? 80)
  const jitterMs = Number(q.get('jitter') ?? 20)
  const server = new LoopbackServer({ bot: true, startStage: (Number(q.get('stage')) || 1) - 1 })
  server.startTimer()
  const session = new CoopSession(new LoopbackTransport(server, { latencyMs, jitterMs }), storeWorld())
  track(session, `LOOPBACK ${latencyMs}±${jitterMs}ms`)
  session.onStop(() => server.stopTimer())
  const s = useGameStore.getState()
  await session.start({ userId: 'me', name: 'YOU', plane: s.progress.plane, hp: selfHp(), dataVersion: server.data.version, room: 'create' })
  session.ready()
  if (import.meta.env.DEV) {
    const w = window as unknown as Record<string, unknown>
    w.__coopServer = server
    w.__coopDebug = () => ({ ...session.status(), serverPhase: server.phase, serverStage: server.stageIndex, serverT: +server.stageTime().toFixed(1) })
  }
  return session
}

/** Leave the room (if any) and go back to single-player mode. */
export async function stopCoop(): Promise<void> {
  const s = active
  active = null
  label = ''
  await s?.stop()
  useGameStore.setState({ mode: 'single', down: false })
}

/** The run is over (results screen left): forget the rejoin code too. */
export function forgetRoom(): void {
  sessionStorage.removeItem(ROOM_KEY)
}
