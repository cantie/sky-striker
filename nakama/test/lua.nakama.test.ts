import { describe, expect, it } from 'vitest'
import { Op } from '../../src/net/coop/protocol'
import { RULES } from '../../src/net/coop/coopData'
import { testData } from '../../src/net/coop/serverConformance'
import { LuaMatch, presence } from './luaMatch'
import { luaDriver } from './luaDriver'

const READY = { name: 'x', plane: 'hawk', hp: 3, dataVersion: 'test' }

describe('Lua match: joining', () => {
  it('refuses a bad token, a wrong data version and a third player', () => {
    const d = luaDriver(testData())
    expect(d.match.join(presence('eve'), { token: 'nope', dataVersion: 'test' })).toMatchObject({ ok: false, reason: expect.stringMatching(/log/i) })
    expect(d.join('alice', { dataVersion: 'old' })).toMatchObject({ ok: false, reason: expect.stringMatching(/version/i) })
    expect(d.join('alice').ok).toBe(true)
    expect(d.join('bob').ok).toBe(true)
    expect(d.join('carol')).toMatchObject({ ok: false, reason: expect.stringMatching(/full/i) })
  })

  it('refuses to join without SKYSTRIKER_API_URL', () => {
    const m = new LuaMatch({ data: testData() })
    m.init({ code: 'ABCDE' })
    expect(m.join(presence('a'), { token: 't', dataVersion: 'test' })).toMatchObject({ ok: false, reason: expect.stringMatching(/configured/i) })
  })

  it('uses the verified account name, not the READY name', () => {
    const d = luaDriver(testData())
    d.join('alice')
    d.send('alice', Op.READY, { ...READY, name: 'Impostor' })
    d.advance(50)
    const roster = d.drain('alice').filter((m) => m.op === Op.PLAYER).map((m) => (m.data as { name?: string }).name)
    expect(roster).toContain('ALICE')
    expect(roster).not.toContain('Impostor')
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
    expect(boards.skystriker_coop_stage[0].score).toBe(0)
    expect(storage.filter((o) => o.key === 'pairs')).toHaveLength(2)
  })

  it('leaderboard RPC: top rows and my best rank', () => {
    const d = failedRun()
    const res = d.match.rpc<{ rows: { rank: number; names: string; mine?: boolean }[]; me?: { rank: number } }>('skystriker_leaderboard', 'alice', { board: 'kills' })
    expect(res.rows[0]).toMatchObject({ rank: 1, names: 'ALICE & BOB', mine: true })
    expect(res.me?.rank).toBe(1)
    const stranger = d.match.rpc<{ rows: unknown[]; me?: unknown }>('skystriker_leaderboard', 'zed', { board: 'kills' })
    expect(stranger.me).toBeUndefined()
    expect(d.match.rpc('skystriker_leaderboard', 'alice', { board: 'nope' })).toMatchObject({ error: 'Unknown board' })
  })

  it('an abandoned match closes itself', () => {
    const d = luaDriver(testData())
    d.join('alice')
    d.leave('alice')
    d.advance(31_000)
    expect(d.match.ended()).toBe(true)
  })
})
