import { mulberry32 } from '../../game/sim/rng'
import { LoopbackServer } from './loopbackServer'
import { TICK_RATE, type ServerMessage } from './protocol'
import { conformance, type ServerDriver } from './serverConformance'

conformance('LoopbackServer', (data): ServerDriver => {
  let now = 1_000_000
  const server = new LoopbackServer({ data, now: () => now, random: mulberry32(7) })
  const inbox = new Map<string, ServerMessage[]>()
  const tickMs = 1000 / TICK_RATE
  return {
    join: (id) => {
      inbox.set(id, inbox.get(id) ?? [])
      // Through JSON, like a real wire
      const ok = server.join(id, (m) => inbox.get(id)!.push(JSON.parse(JSON.stringify(m))))
      return ok ? { ok } : { ok, reason: 'refused' }
    },
    leave: (id) => server.leave(id),
    send: (id, op, data) => server.receive(id, op, JSON.parse(JSON.stringify(data))),
    advance: (ms) => { for (let t = 0; t < ms; t += tickMs) { now += tickMs; server.tick() } },
    drain: (id) => { const m = inbox.get(id) ?? []; inbox.set(id, []); return m },
    phase: () => server.phase,
  }
})
