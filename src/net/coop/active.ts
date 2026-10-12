import { useGameStore } from '../../store/gameStore'
import { CoopSession } from './coopSession'
import { LoopbackServer, LoopbackTransport } from './loopbackServer'
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
    userId: 'me', name: 'YOU', plane: s.progress.plane, hp: selfHp(), stageId, room: 'create',
  })
  if (import.meta.env.DEV) {
    const w = window as unknown as Record<string, unknown>
    w.__coop = session
    w.__coopServer = server
    w.__coopDebug = () => ({ ...session.status(), serverPhase: server.phase, serverT: +server.stageTime().toFixed(1) })
  }
  return session
}

export async function stopCoop(): Promise<void> {
  await active?.stop()
  active = null
  label = ''
}
