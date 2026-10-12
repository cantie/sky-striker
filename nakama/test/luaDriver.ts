import { TICK_RATE, type Phase, type ServerMessage } from '../../src/net/coop/protocol'
import type { ServerDriver } from '../../src/net/coop/serverConformance'
import type { CoopData } from '../../src/net/coop/coopData'
import { LuaMatch, presence, type Sent } from './luaMatch'

/** The Lua match behind the ServerDriver interface; each player logs in with token `tok-<id>`. */
export function luaDriver(data: CoopData, m = new LuaMatch({ data }), firstGid = 1): ServerDriver & { match: LuaMatch } {
  let now = 1_700_000_000_000
  const tickMs = 1000 / TICK_RATE
  const inbox = new Map<string, ServerMessage[]>()
  const joined = new Set<string>()
  let queue: { from: ReturnType<typeof presence>; op: number; data: unknown }[] = []
  const users: Record<string, { id: number; name: string }> = {}
  m.setEnv({ SKYSTRIKER_API_URL: 'http://game.test' })
  m.setTime(now)
  m.init({ public: false, code: 'ABCDE' })
  const deliver = (sent: Sent[]) => {
    for (const s of sent) {
      for (const id of s.to ?? [...joined]) inbox.get(id)?.push({ op: s.op, data: s.data } as ServerMessage)
    }
  }
  return {
    match: m,
    join: (id, meta = {}) => {
      users[`tok-${id}`] ??= { id: Object.keys(users).length + firstGid, name: id.toUpperCase() }
      m.setUsers(users)
      inbox.set(id, inbox.get(id) ?? [])
      const res = m.join(presence(id), { token: `tok-${id}`, dataVersion: data.version, plane: 'hawk', ...meta })
      if (res.ok) joined.add(id)
      deliver(m.drain())
      return res
    },
    leave: (id) => { joined.delete(id); m.leave(presence(id)); deliver(m.drain()) },
    send: (id, op, payload) => { queue.push({ from: presence(id), op, data: payload }) },
    advance: (ms) => {
      for (let t = 0; t < ms; t += tickMs) {
        now += tickMs
        m.setTime(now)
        const msgs = queue
        queue = []
        deliver(m.loop(msgs))
      }
    },
    drain: (id) => { const msgs = inbox.get(id) ?? []; inbox.set(id, []); return msgs },
    // Debug-only RPC: the module registers it when the mock sets nk.debug_hooks (Nakama never does)
    phase: () => m.rpc<{ phase: Phase }>('skystriker_debug_phase', '', {}).phase,
  }
}
