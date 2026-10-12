import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClockSync } from './clockSync'
import { InterpolationBuffer } from './interpolation'
import { MAX_EXTRAPOLATE_MS, Op, decode, encode, list, parseServer } from './protocol'
import { CoopSession, type WorldAdapter } from './coopSession'
import { LoopbackServer, LoopbackTransport } from './loopbackServer'
import { testData } from './serverConformance'
import type { CoopData } from './coopData'
import { mulberry32 } from '../../game/sim/rng'
import { stepCount } from '../../game/sim/clock'
import { net } from '../../game/sim/net'

const AIMED = new Set(['aimed', 'spread3', 'burst2'])

describe('protocol', () => {
  it('round-trips JSON payloads', () => {
    const data = { hits: [['w1.g0.u0', 12.5]] }
    expect(decode(encode(data))).toEqual(data)
    const msg = parseServer(Op.ENEMY_DEAD, encode({ id: 'w1.g0.u0', by: 'a' }))
    expect(msg).toEqual({ op: Op.ENEMY_DEAD, data: { id: 'w1.g0.u0', by: 'a' }, from: undefined })
    expect(parseServer(Op.POS, encode({}))).toBeNull()
    expect(parseServer(999, encode({}))).toBeNull()
  })

  it('list() tolerates the {} that Nakama Lua sends for empty arrays', () => {
    expect(list({} as never)).toEqual([])
    expect(list(undefined)).toEqual([])
    expect(list([1, 2])).toEqual([1, 2])
  })
})

describe('clock sync', () => {
  it('estimates the offset from the lowest-RTT sample', () => {
    let now = 1000
    const c = new ClockSync(() => now)
    // Server is 5000 ms ahead; one-way 40 ms
    c.addSample(1000, 6040, 1080)
    expect(c.offset).toBeCloseTo(5000, 5)
    // A noisy sample (slow return) barely moves it
    c.addSample(2000, 7040, 2300)
    expect(c.offset).toBeCloseTo(5000, 5)
    expect(c.rtt).toBe(80)
    now = 3000
    expect(c.serverNow()).toBeCloseTo(8000, 5)
  })

  it('glides small corrections, snaps big ones', () => {
    const c = new ClockSync(() => 0)
    c.addSample(0, 100, 0)
    c.addSample(0, 140, 0) // +40: glide
    expect(c.offset).toBeGreaterThan(100)
    expect(c.offset).toBeLessThan(140)
    c.addSample(0, 2000, 0) // +1900: snap
    expect(c.offset).toBe(2000)
  })
})

describe('interpolation', () => {
  it('interpolates 100 ms in the past', () => {
    const b = new InterpolationBuffer()
    b.push({ t: 0, x: 0, y: 0 })
    b.push({ t: 50, x: 5, y: 1 })
    b.push({ t: 100, x: 10, y: 2 })
    expect(b.sample(175)).toEqual({ x: 7.5, y: 1.5 })
  })

  it('extrapolates at most 150 ms', () => {
    const b = new InterpolationBuffer()
    b.push({ t: 0, x: 0, y: 0 })
    b.push({ t: 100, x: 10, y: 0 })
    // 100 ms past the newest sample: keeps going
    expect(b.sample(300)!.x).toBeCloseTo(20)
    // far past: capped
    expect(b.sample(5000)!.x).toBeCloseTo(10 + MAX_EXTRAPOLATE_MS / 10)
  })

  it('ignores late packets and holds before the first sample', () => {
    const b = new InterpolationBuffer()
    b.push({ t: 100, x: 1, y: 1 })
    b.push({ t: 50, x: 99, y: 99 })
    expect(b.size).toBe(1)
    expect(b.sample(0)).toEqual({ x: 1, y: 1 })
  })
})

// ── loopback flow ──

function fakeWorld() {
  const calls: Record<string, unknown[][]> = {}
  const rec = (k: string) => (...a: unknown[]) => { (calls[k] ??= []).push(a) }
  const world: WorldAdapter = {
    startStage: rec('startStage'),
    self: () => ({ x: 0, y: -4, fire: true, power: 0, plane: 'hawk', hp: 3 }),
    enemyHp: rec('enemyHp'), bossHp: rec('bossHp'), enemyDead: rec('enemyDead'), drop: rec('drop'),
    picked: rec('picked'), aimed: rec('aimed'), down: rec('down'), revived: rec('revived'), phase: rec('phase'), lost: rec('lost'),
  }
  return { world, calls }
}

describe('loopback co-op session', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  async function setup(opts: { data?: CoopData; bot?: boolean } = {}) {
    const now = () => Date.now()
    const server = new LoopbackServer({ data: opts.data, bot: opts.bot, now, random: mulberry32(3) })
    server.startTimer()
    const humans = opts.bot ? 1 : 2
    const clients = []
    for (let i = 0; i < humans; i++) {
      const fw = fakeWorld()
      const session = new CoopSession(new LoopbackTransport(server, { latencyMs: 80, jitterMs: 0 }, now), fw.world, now)
      const started = session.start({ userId: `p${i}`, name: `P${i}`, plane: 'hawk', hp: 3, dataVersion: server.data.version, room: 'create' })
      await vi.advanceTimersByTimeAsync(100)
      await started
      clients.push({ session, ...fw })
    }
    for (const c of clients) c.session.ready()
    await vi.advanceTimersByTimeAsync(200)
    return { server, clients }
  }

  it('READY → countdown → playing on stage 1 with a shared seed; drives the sim; tears down on stop', async () => {
    const { server, clients: [c, d] } = await setup()
    await vi.advanceTimersByTimeAsync(3200)
    expect(c.calls.startStage).toEqual([[{ stageId: 1, seed: server.seed, stageIndex: 0 }]])
    expect(d.calls.startStage).toEqual(c.calls.startStage)
    expect(c.session.phase).toBe('playing')
    expect(c.session.clock.rtt).toBeCloseTo(80, 0)
    expect(c.session.teammates().map((t) => t.id)).toEqual(['p1'])
    expect(c.session.roster().map((r) => r.ready)).toEqual([true, true])
    expect(net()).toBe(d.session.hooks)   // last attached wins in a single process
    c.session.drive()
    expect(stepCount()).toBeGreaterThan(0)
    await c.session.stop(); await d.session.stop()
    expect(net()).toBeNull()
    server.stopTimer()
  })

  it('kills, drops placed from the script, aimed shots resolved to a position', async () => {
    const { server, clients: [c] } = await setup()
    const first = server.stage.enemies.filter((e) => e.enterT !== null && AIMED.has(e.shot)).sort((a, b) => a.enterT! - b.enterT!)[0]
    await vi.advanceTimersByTimeAsync(3000 + (first.enterT! / 0.55) * 1000 + 300)
    c.session.hooks.hit(first.id, first.hp + 1)
    await vi.advanceTimersByTimeAsync(400)
    expect(c.calls.enemyDead).toContainEqual([first.id, true])
    expect(c.session.hooks.spawnAllowed(first.id)).toBe(false)
    expect(c.session.team.kills).toBe(1)
    await vi.advanceTimersByTimeAsync(20_000)
    const [, at] = c.calls.aimed![0] as [string, { x: number; y: number }]
    expect(Number.isFinite(at.x) && Number.isFinite(at.y)).toBe(true)
    for (const [, , x, z] of (c.calls.drop ?? []) as [string, string, number, number][]) expect(Number.isFinite(x) && Number.isFinite(z)).toBe(true)
    server.stopTimer()
  })

  it('down → revive by the teammate', async () => {
    const { server, clients: [c, d] } = await setup()
    await vi.advanceTimersByTimeAsync(3500)
    c.session.hooks.gotHit(3, 0)
    await vi.advanceTimersByTimeAsync(300)
    expect(d.session.downedPlayers()).toEqual([{ id: 'p0', x: 0, y: -4, self: false }])
    d.session.revive('p0')
    await vi.advanceTimersByTimeAsync(300)
    expect(c.calls.revived).toEqual([[0, -4, 2]])
    expect(d.session.downedPlayers()).toEqual([])
    server.stopTimer()
  })

  it('stage clear → next stage → complete with a summary, then detaches', async () => {
    const data = testData()
    const { server, clients: [c, d] } = await setup({ data })
    await vi.advanceTimersByTimeAsync(3200)
    for (let s = 0; s < data.stages.length; s++) {
      await vi.advanceTimersByTimeAsync((1.6 / 0.55) * 1000)
      for (let i = 0; i < 20 && server.phase === 'playing'; i++) {
        for (const e of data.stages[s].enemies) { c.session.hooks.hit(e.id, 150); d.session.hooks.hit(e.id, 150) }
        await vi.advanceTimersByTimeAsync(500)
      }
      await vi.advanceTimersByTimeAsync(2500)
      expect(server.phase).toBe('boss')
      c.session.hooks.hit('boss', 50)
      await vi.advanceTimersByTimeAsync(7400)
    }
    expect(c.calls.startStage!.map((a) => (a[0] as { stageIndex: number }).stageIndex)).toEqual([0, 1])
    expect(c.session.phase).toBe('complete')
    expect(c.session.summary).toMatchObject({ result: 'complete', stagesCleared: 2 })
    expect(net()).toBeNull()
    server.stopTimer()
  })

  it('rejoin mid-run: snapshot marks us down and settles what is gone', async () => {
    const { server, clients: [c] } = await setup()
    await vi.advanceTimersByTimeAsync(3500)
    c.session.hooks.pickup('rescue:start1')
    await vi.advanceTimersByTimeAsync(300)
    await c.session.stop()
    const fw = fakeWorld()
    const back = new CoopSession(new LoopbackTransport(server, { latencyMs: 80, jitterMs: 0 }, Date.now), fw.world, Date.now)
    const started = back.start({ userId: 'p0', name: 'P0', plane: 'hawk', hp: 3, dataVersion: server.data.version, room: { code: 'LOOP1' } })
    await vi.advanceTimersByTimeAsync(300)
    await started
    expect(fw.calls.startStage).toHaveLength(1)
    expect(fw.calls.down).toHaveLength(1)
    expect(back.hooks.spawnAllowed('rescue:start1')).toBe(false)
    server.stopTimer()
  })

  it('a server that goes silent mid-run sends us back (lost) instead of flying on alone', async () => {
    const { server, clients: [c] } = await setup({ bot: true })
    await vi.advanceTimersByTimeAsync(3200)
    expect(c.session.phase).toBe('playing')
    // The match's node died but our socket is fine: no STATES, no PONG, no disconnect
    server.stopTimer()
    server.receive = () => {}
    await vi.advanceTimersByTimeAsync(3000)
    expect(c.calls.lost).toBeUndefined()   // a short stall is fine
    await vi.advanceTimersByTimeAsync(4000)
    expect(c.calls.lost).toHaveLength(1)
    expect(net()).toBeNull()
  })

  it('a snapshot with {} arrays (Nakama Lua) does not crash', async () => {
    const fw = fakeWorld()
    const s = new CoopSession(new LoopbackTransport(new LoopbackServer()), fw.world)
    expect(() => s.handle({ op: Op.SNAPSHOT, data: {
      phase: 'playing', stageIndex: 0, stages: 10, stageId: 1, seed: 1, stageT0: 0,
      dead: {}, hp: {}, pickups: {}, taken: {}, players: {}, team: { score: 0, kills: 0 },
    } as never })).not.toThrow()
    expect(fw.calls.startStage).toHaveLength(1)
    await s.stop()   // releases the global net hooks / frame driver
    expect(net()).toBeNull()
  })
})
