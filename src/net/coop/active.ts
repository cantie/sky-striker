import { useGameStore } from '../../store/gameStore'
import { DEFAULT_NAKAMA } from '../api'
import { useAccount } from '../../store/account'
import { CoopSession } from './coopSession'
import { readCoopIdentity } from './identity'
import { LoopbackServer, LoopbackTransport } from './loopbackServer'
import { NakamaTransport } from './nakamaTransport'
import { selfHp, storeWorld } from './storeWorld'

/** The co-op session currently running (null in single-player). */
let active: CoopSession | null = null
let label = ''

export const activeSession = () => active
export const sessionLabel = () => label

/**
 * Dev / test entry (`?coop=loopback[&stage=N&lat=80&jitter=20]`): an in-browser authoritative
 * server with a bot wingmate, reached through a simulated network.
 */
export async function startLoopbackCoop(q: URLSearchParams): Promise<CoopSession> {
  const who = readCoopIdentity()
  if (!who.ok) throw new Error(who.reason)
  await active?.stop()
  const stageId = Number(q.get('stage')) || 1
  const latencyMs = Number(q.get('lat') ?? 80)
  const jitterMs = Number(q.get('jitter') ?? 20)
  const server = new LoopbackServer({ stageId, bot: true })
  server.startTimer()
  const session = new CoopSession(new LoopbackTransport(server, { latencyMs, jitterMs }), storeWorld())
  active = session
  label = `LOOPBACK ${latencyMs}±${jitterMs}ms`
  const s = useGameStore.getState()
  await session.start({
    userId: who.userId, name: who.name, token: who.token, plane: s.progress.plane, hp: selfHp(), stageId, room: 'create',
  })
  if (import.meta.env.DEV) {
    const w = window as unknown as Record<string, unknown>
    w.__coop = session
    w.__coopServer = server
    w.__coopDebug = () => ({ ...session.status(), serverPhase: server.phase, serverT: +server.stageTime().toFixed(1) })
  }
  return session
}

/** Join the Nakama co-op campaign: create a private room, quick-match, or join a 5-character code. */
export async function startNakamaCoop(room: 'create' | 'match' | { join: string }): Promise<string | undefined> {
  const who = readCoopIdentity()
  if (!who.ok) throw new Error(who.reason)
  const nakama = useAccount.getState().config?.nakama ?? DEFAULT_NAKAMA
  await active?.stop()
  const session = new CoopSession(new NakamaTransport(nakama), storeWorld())
  active = session
  const s = useGameStore.getState()
  const info = await session.start({
    userId: who.userId, name: who.name, token: who.token,
    plane: s.progress.plane, hp: selfHp(), stageId: s.selectedStageId || 1, room,
  })
  label = info.code ? `ROOM ${info.code}` : 'NAKAMA'
  return info.code
}

export async function stopCoop(): Promise<void> {
  await active?.stop()
  active = null
  label = ''
}

/** Leave the match and open the saga map. Co-op never drops the player on the main menu. */
export async function leaveCoopToSaga(): Promise<void> {
  await stopCoop()
  useGameStore.setState({ mode: 'single', wingmateDown: false })
  useGameStore.getState().goToStageSelect()
}
