import { describe, expect, it } from 'vitest'
import { Op, list } from '../../src/net/coop/protocol'
import { RULES } from '../../src/net/coop/coopData'
import { clearStage, playing, testData } from '../../src/net/coop/serverConformance'
import { LuaMatch, presence } from './luaMatch'
import { luaDriver } from './luaDriver'

const READY = { name: 'x', plane: 'hawk', hp: 3, dataVersion: 'test' }

describe('Lua match: joining', () => {
  const names = (d: ReturnType<typeof luaDriver>, id: string) =>
    d.drain(id).filter((m) => m.op === Op.PLAYER).map((m) => (m.data as { name?: string }).name)

  it('refuses a wrong data version and a third player', () => {
    const d = luaDriver(testData())
    expect(d.join('alice', { dataVersion: 'old' })).toMatchObject({ ok: false, reason: expect.stringMatching(/version/i) })
    expect(d.join('alice').ok).toBe(true)
    expect(d.join('bob').ok).toBe(true)
    expect(d.join('carol')).toMatchObject({ ok: false, reason: expect.stringMatching(/full/i) })
  })

  it('logs why a join was refused', () => {
    const d = luaDriver(testData())
    d.join('alice', { dataVersion: 'old' })
    expect(list(d.match.dump().logs)).toContainEqual(expect.stringMatching(/^warn: .*alice.*version/i))
  })

  it('GUEST_COOP=false refuses guests at join; unset lets them in; accounts always join', () => {
    const open = new LuaMatch({ data: testData() })
    open.init({ code: 'ABCDE' })
    open.setCustomId('g', 'guest:abc')
    expect(open.join(presence('g'), { name: 'Guest', dataVersion: 'test' }).ok).toBe(true)

    const closed = new LuaMatch({ data: testData() })
    closed.setEnv({ GUEST_COOP: ' False ' })
    closed.init({ code: 'ABCDE' })
    closed.setCustomId('g', 'guest:abc')
    closed.setCustomId('a', 'skystriker-42')
    expect(closed.join(presence('g'), { name: 'Guest', dataVersion: 'test' })).toMatchObject({ ok: false, reason: 'Log in to play co-op' })
    expect(closed.join(presence('a'), { name: 'Ace', dataVersion: 'test' }).ok).toBe(true)
  })

  it('GUEST_COOP=false blocks a new guest session before it is made', () => {
    const m = new LuaMatch({ data: testData() })
    expect(m.authenticateCustom('guest:abc').ok).toBe(true)
    m.setEnv({ GUEST_COOP: 'no' })
    expect(m.authenticateCustom('guest:abc')).toMatchObject({ ok: false, reason: expect.stringMatching(/Log in to play co-op/) })
    expect(m.authenticateCustom('skystriker-42').ok).toBe(true)
  })

  it('no login needed: a fresh Nakama account joins with the name it sends', () => {
    const m = new LuaMatch({ data: testData() })
    m.init({ code: 'ABCDE' })
    expect(m.join(presence('a'), { name: 'Maverick', dataVersion: 'test' }).ok).toBe(true)
    const roster = m.drain().filter((s) => s.op === Op.PLAYER).map((s) => (s.data as { name?: string }).name)
    expect(roster).toEqual(['Maverick'])
  })

  it('the sent name is trimmed and capped at 24 characters; a blank one becomes Pilot', () => {
    const d = luaDriver(testData())
    d.join('alice', { name: '  Ace  ' })
    d.join('bob', { name: 'x'.repeat(40) })
    expect(names(d, 'alice')).toEqual(expect.arrayContaining(['Ace', 'x'.repeat(24)]))
    const e = luaDriver(testData())
    e.join('alice', { name: '   ' })
    expect(names(e, 'alice')).toEqual(['Pilot'])
  })

  it('one Nakama account cannot take both seats', () => {
    const d = luaDriver(testData())
    expect(d.join('alice').ok).toBe(true)
    expect(d.join('alice')).toMatchObject({ ok: false, reason: expect.stringMatching(/already/i) })
  })

  it('keeps the name from the join, not the READY one', () => {
    const d = luaDriver(testData())
    d.join('alice')
    d.send('alice', Op.READY, { ...READY, name: 'Renamed' })
    d.advance(50)
    const roster = names(d, 'alice')
    expect(roster).toContain('ALICE')
    expect(roster).not.toContain('Renamed')
  })

  it('a non-member cannot join a run in progress', () => {
    const d = luaDriver(testData())
    d.join('alice'); d.join('bob')
    d.send('alice', Op.READY, READY); d.send('bob', Op.READY, READY)
    d.advance(50)
    d.leave('bob')
    expect(d.join('carol')).toMatchObject({ ok: false, reason: expect.stringMatching(/started/i) })
  })
})

describe('Lua match: rooms', () => {
  it('create → join by code → quick match', () => {
    const m = new LuaMatch({ data: testData() })
    m.setEnv({ SKYSTRIKER_API_URL: 'http://game.test' })
    const created = m.rpc<{ matchId: string; code: string }>('skystriker_create_match', 'u1', {})
    expect(created.code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/)
    m.init({ public: false, code: created.code }, created.matchId)
    expect(m.rpc('skystriker_join_code', 'u2', { code: created.code.toLowerCase() })).toEqual({ matchId: created.matchId, code: created.code })
    expect(m.rpc('skystriker_join_code', 'u2', { code: 'ZZZZZ' })).toMatchObject({ error: 'Room not found' })
    // The private room is not offered by quick match; a new public one is made
    const quick = m.rpc<{ matchId: string }>('skystriker_find_match', 'u3', {})
    expect(quick.matchId).not.toBe(created.matchId)
  })

  it('label: open while the lobby has a free slot', () => {
    const d = luaDriver(testData())
    const label = () => JSON.parse(Object.values(d.match.dump().matches)[0].label)
    expect(label()).toMatchObject({ game: 'skystriker', open: 1, public: 0, code: 'abcde' })
    d.join('alice'); d.join('bob')
    expect(label().open).toBe(0)
  })
})

describe('Lua match: leaderboards', () => {
  function failedRun() {
    const d = luaDriver(testData())
    d.join('alice'); d.join('bob')
    d.send('alice', Op.READY, READY); d.send('bob', Op.READY, READY)
    d.advance(RULES.countdownMs + 100)
    d.advance(Math.ceil((0.6 / RULES.gameSpeed) * 1000))
    d.send('alice', Op.HITS, { hits: [['w0.g0.u0', 20]] })
    d.advance(50)
    d.send('alice', Op.GOT_HIT, { hits: 3, hp: 0 })
    d.send('bob', Op.GOT_HIT, { hits: 3, hp: 0 })
    d.advance(50)
    return d
  }

  it('writes one record per pair on all three boards when the run ends', () => {
    const d = failedRun()
    const { boards, storage } = d.match.dump()
    for (const id of ['skystriker_coop_stage', 'skystriker_coop_kills', 'skystriker_coop_score']) {
      expect(boards[id]).toHaveLength(1)
      expect(boards[id][0].username).toBe('ALICE & BOB')
      expect(boards[id][0].owner_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    }
    expect(boards.skystriker_coop_kills[0].score).toBe(1)
    expect(boards.skystriker_coop_score[0].score).toBe(100)
    // stages cleared × 1e7 + (1e7 − 1 − seconds): 0 stages, a few seconds
    expect(Math.floor(boards.skystriker_coop_stage[0].score / 1e7)).toBe(0)
    expect(boards.skystriker_coop_stage[0].score).toBeGreaterThan(1e7 - 60)
    expect(boards.skystriker_coop_kills[0].subscore).toBe(0)
    expect(storage.filter((o) => o.key === 'pairs')).toHaveLength(2)
  })

  it('leaderboard RPC: top rows and my best rank', () => {
    const d = failedRun()
    const res = d.match.rpc<{ rows: { rank: number; names: string; mine?: boolean }[]; me?: { rank: number } }>('skystriker_leaderboard', 'alice', { board: 'kills' })
    expect(res.rows[0]).toMatchObject({ rank: 1, names: 'ALICE & BOB', mine: true })
    expect(res.me?.rank).toBe(1)
    // A pilot who never flew co-op (no pair list) still sees the top rows
    const stranger = d.match.rpc<{ rows: unknown[]; me?: unknown }>('skystriker_leaderboard', 'zed', { board: 'kills' })
    expect(stranger.rows).toHaveLength(1)
    expect(stranger.me).toBeUndefined()
    expect(d.match.rpc('skystriker_leaderboard', 'alice', { board: 'nope' })).toMatchObject({ error: 'Unknown board' })
  })

  it('stage board: a later, shorter run never replaces a further one (time and details stay with it)', () => {
    const data = testData()
    const m = new LuaMatch({ data })
    // Run 1: clear stage 1, then both go down in stage 2
    const d1 = luaDriver(data, m)
    playing(d1)
    clearStage(d1, data.stages[0])
    d1.advance(RULES.stageClearMs + RULES.countdownMs + 200)
    d1.send('alice', Op.GOT_HIT, { hits: 3, hp: 0 }); d1.send('bob', Op.GOT_HIT, { hits: 3, hp: 0 })
    d1.advance(50)
    expect(d1.phase()).toBe('failed')
    // Run 2, same pair: down at once (0 stages, much quicker)
    const d2 = luaDriver(data, m)
    playing(d2)
    d2.send('alice', Op.GOT_HIT, { hits: 3, hp: 0 }); d2.send('bob', Op.GOT_HIT, { hits: 3, hp: 0 })
    d2.advance(50)
    expect(d2.phase()).toBe('failed')
    type Row = { score: number; metadata?: { stages?: number; timeMs?: number } }
    const res = m.rpc<{ rows: Row[] }>('skystriker_leaderboard', 'alice', { board: 'stage' })
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0].score).toBe(1)
    expect(res.rows[0].metadata?.stages).toBe(1)
    expect(res.rows[0].metadata?.timeMs).toBeGreaterThan(RULES.stageClearMs)
  })

  it('stage board: same stages, the faster run ranks first', () => {
    const data = testData()
    const m = new LuaMatch({ data })
    const slow = luaDriver(data, m)            // alice & bob, down after 5 s
    playing(slow)
    slow.advance(5000)
    slow.send('alice', Op.GOT_HIT, { hits: 3, hp: 0 }); slow.send('bob', Op.GOT_HIT, { hits: 3, hp: 0 })
    slow.advance(50)
    const fast = luaDriver(data, m)            // a second pair (carol & dave), down at once
    fast.join('carol'); fast.join('dave')
    fast.send('carol', Op.READY, READY); fast.send('dave', Op.READY, READY)
    fast.advance(RULES.countdownMs + 100)
    fast.send('carol', Op.GOT_HIT, { hits: 3, hp: 0 }); fast.send('dave', Op.GOT_HIT, { hits: 3, hp: 0 })
    fast.advance(50)
    const res = m.rpc<{ rows: { names: string }[] }>('skystriker_leaderboard', 'carol', { board: 'stage' })
    expect(res.rows.map((r) => r.names)).toEqual(['CAROL & DAVE', 'ALICE & BOB'])
  })

  it('an abandoned match closes itself', () => {
    const d = luaDriver(testData())
    d.join('alice')
    d.leave('alice')
    d.advance(31_000)
    expect(d.match.ended()).toBe(true)
  })
})
