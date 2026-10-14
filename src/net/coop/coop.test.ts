import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClockSync } from './clockSync'
import { InterpolationBuffer } from './interpolation'
import { MAX_EXTRAPOLATE_MS, Op, decode, encode, parseServer } from './protocol'
import { coopStageSeconds } from './coopLeaderboard'
import { CoopSession, type WorldAdapter } from './coopSession'
import { LoopbackServer, LoopbackTransport } from './loopbackServer'
import { STEP_GAME, stepCount } from '../../game/sim/clock'
import { net } from '../../game/sim/net'

describe('protocol', () => {
  it('round-trips JSON payloads', () => {
    const data = { hits: [['w1.g0.u0', 12.5]] }
    expect(decode(encode(data))).toEqual(data)
    const msg = parseServer(Op.ENEMY_DEAD, encode({ id: 'w1.g0.u0', by: 'a' }))
    expect(msg).toEqual({ op: Op.ENEMY_DEAD, data: { id: 'w1.g0.u0', by: 'a' }, from: undefined })
    expect(parseServer(Op.POS, encode({}))).toBeNull()
    expect(parseServer(999, encode({}))).toBeNull()
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
    startRun: rec('startRun'),
    self: () => ({ x: 0, y: -4, fire: true, power: 0, plane: 'hawk', hp: 3 }),
    enemyHp: rec('enemyHp'), bossHp: rec('bossHp'), enemyDead: rec('enemyDead'), drop: rec('drop'),
    picked: rec('picked'), aimed: rec('aimed'), phase: rec('phase'), revived: rec('revived'),
  }
  return { world, calls }
}

describe('loopback co-op', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  async function setup(humans = 1, bot = true) {
    const now = () => Date.now()
    const server = new LoopbackServer({ stageId: 1, seed: 42, bot, countdownMs: 1000, now })
    server.startTimer()
    const clients = await Promise.all(Array.from({ length: humans }, async (_, i) => {
      const fw = fakeWorld()
      const session = new CoopSession(new LoopbackTransport(server, { latencyMs: 80, jitterMs: 0 }, now), fw.world, now)
      const started = session.start({ userId: `p${i}`, name: `P${i}`, plane: 'hawk', hp: 3, stageId: 1, room: 'create' })
      await vi.advanceTimersByTimeAsync(100)
      await started
      return { session, ...fw }
    }))
    return { server, clients }
  }

  it('countdown → playing, same stage + seed, synced clock, bot teammate', async () => {
    const { server, clients: [c] } = await setup()
    await vi.advanceTimersByTimeAsync(1500)
    expect(c.calls.startRun).toEqual([[1, 42]])
    expect(c.session.phase).toBe('playing')
    expect(server.phase).toBe('playing')
    expect(c.session.clock.rtt).toBeCloseTo(80, 0)
    expect(Math.abs(c.session.clock.offset)).toBeLessThan(2)
    expect(c.session.teammates().map((t) => t.id)).toEqual(['bot'])
    // While running, the session owns the net hooks and drives the sim from the stage clock
    expect(net()).toBe(c.session.hooks)
    c.session.drive()
    expect(stepCount()).toBeGreaterThan(0)
    const target = Math.floor(c.session.stageTime() / STEP_GAME)
    for (let i = 0; i < 20; i++) c.session.drive()
    expect(stepCount()).toBe(target)
    await c.session.stop()
    expect(net()).toBeNull()
    server.stopTimer()
  })

  it('server decides kills from batched hits', async () => {
    const { server, clients: [c] } = await setup(1, false)
    const first = [...server.script].filter((e) => e.enterT !== null).sort((a, b) => a.enterT! - b.enterT!)[0]
    // Wait until it is on screen (stage time is game-seconds: real = T / 0.55)
    await vi.advanceTimersByTimeAsync(1000 + (first.enterT! / 0.55) * 1000 + 100)
    c.session.hooks.hit(first.id, first.hp / 2)
    c.session.hooks.hit(first.id, first.hp / 2 + 1)
    await vi.advanceTimersByTimeAsync(300)
    expect(c.calls.enemyDead).toEqual([[first.id, true]])
    // Settled enemies won't be spawned again by a client catching up
    expect(c.session.hooks.spawnAllowed(first.id)).toBe(false)
    server.stopTimer()
  })

  it('first come, first served pickups', async () => {
    const { server, clients: [a, b] } = await setup(2, false)
    await vi.advanceTimersByTimeAsync(1500)
    a.session.hooks.pickup('rescue:start0')
    await vi.advanceTimersByTimeAsync(10)
    b.session.hooks.pickup('rescue:start0')
    await vi.advanceTimersByTimeAsync(300)
    expect(a.calls.picked).toEqual([['rescue:start0', true, 'rescue']])
    expect(b.calls.picked).toEqual([['rescue:start0', false, 'rescue']])
    // Each sees the other as a teammate
    expect(a.session.teammates().map((t) => t.id)).toEqual(['p1'])
    server.stopTimer()
  })

  it('aimed shots come from the server', async () => {
    const { server, clients: [c] } = await setup(1, false)
    await vi.advanceTimersByTimeAsync(1000 + 40_000)
    expect((c.calls.aimed ?? []).length).toBeGreaterThan(0)
    const [id, ang] = c.calls.aimed![0] as [string, number]
    expect(server.script.some((e) => e.id === id && e.shot !== 'down' && e.shot !== 'none')).toBe(true)
    expect(Number.isFinite(ang)).toBe(true)
    server.stopTimer()
  })

  it('one pilot down keeps the run going; the wingmate can revive them', async () => {
    const { server, clients: [a, b] } = await setup(2, false)
    await vi.advanceTimersByTimeAsync(1500)
    a.session.hooks.gotHit(3, 0)
    await vi.advanceTimersByTimeAsync(300)
    expect(server.phase).toBe('playing')
    expect(a.calls.phase!.map((p) => p[0])).not.toContain('failed')
    const wreck = b.session.teammates().find((t) => t.id === 'p0')
    expect(wreck?.alive).toBe(false)
    b.session.revive('p0')
    await vi.advanceTimersByTimeAsync(300)
    expect(a.calls.revived).toEqual([[2, 0, -4]])
    expect(b.session.teammates().find((t) => t.id === 'p0')?.alive).toBe(true)
    server.stopTimer()
  })

  it('a bot wingmate keeps the run alive after the human is down', async () => {
    const { server, clients: [c] } = await setup(1, true)
    await vi.advanceTimersByTimeAsync(1500)
    c.session.hooks.gotHit(3, 0)
    await vi.advanceTimersByTimeAsync(300)
    expect(server.phase).toBe('playing')
    expect(c.session.teammates().some((t) => t.alive)).toBe(true)
    server.stopTimer()
  })

  it('unpacks the stage-board time', () => {
    expect(coopStageSeconds(10_000_000 - 1 - 125)).toBe(125)
  })

  it('all players down → failed', async () => {
    const { server, clients: [c] } = await setup(1, false)
    await vi.advanceTimersByTimeAsync(1500)
    c.session.hooks.gotHit(3, 0)
    await vi.advanceTimersByTimeAsync(300)
    expect(server.phase).toBe('failed')
    expect(c.calls.phase!.map((p) => p[0])).toContain('failed')
    server.stopTimer()
  })

  it('late joiner gets a snapshot', async () => {
    const { server, clients: [a] } = await setup(1, false)
    await vi.advanceTimersByTimeAsync(1500)
    a.session.hooks.pickup('rescue:start1')
    await vi.advanceTimersByTimeAsync(300)
    const fw = fakeWorld()
    const late = new CoopSession(new LoopbackTransport(server, { latencyMs: 80, jitterMs: 0 }, Date.now), fw.world, Date.now)
    const started = late.start({ userId: 'late', name: 'L', plane: 'hawk', hp: 3, stageId: 1, room: { join: server.roomId } })
    await vi.advanceTimersByTimeAsync(300)
    await started
    expect(fw.calls.startRun).toEqual([[1, 42]])
    expect(late.hooks.spawnAllowed('rescue:start1')).toBe(false)
    server.stopTimer()
  })
})
