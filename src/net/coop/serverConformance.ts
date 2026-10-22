import { describe, expect, it } from 'vitest'
import { Op, list, type ClientMessages, type ClientOp, type Phase, type ServerMessage, type ServerMessages, type ServerOp } from './protocol'
import { RULES, type CoopData, type CoopEnemy, type CoopStage } from './coopData'
import type { ShotKind } from '../../game/roster'

/** One authoritative co-op server under test (LoopbackServer or the Lua match). */
export interface ServerDriver {
  join(id: string, meta?: Partial<{ name: string; dataVersion: string; plane: string }>): { ok: boolean; reason?: string }
  leave(id: string): void
  send<K extends ClientOp>(id: string, op: K, data: ClientMessages[K]): void
  /** Move the server clock forward, ticking at the server rate. */
  advance(ms: number): void
  /** Messages delivered to `id` since the last drain. */
  drain(id: string): ServerMessage[]
  phase(): Phase
}

/**
 * A tiny two-stage campaign. Per stage: an aimed shooter (hp 20) entering at T=0.5, a 'down'
 * shooter (hp 1000) entering at T=1.5, and a boss with 50 hp.
 */
export function testData(): CoopData {
  const enemy = (id: string, wave: number, spawnT: number, hp: number, shot: ShotKind): CoopEnemy => ({
    id, wave, spawnT, enterT: spawnT + 0.5, despawnT: spawnT + 6, hp, score: 100, shot, fireInterval: shot === 'aimed' ? 1 : 0,
  })
  const stage = (id: number): CoopStage => ({
    id, bossHp: 50, waves: 2, enemies: [enemy('w0.g0.u0', 0, 0, 20, 'aimed'), enemy('w1.g0.u0', 1, 1, 1000, 'down')],
  })
  return { version: 'test', maxDps: 100, bossScore: 5000, rescueScore: 300, podScore: 50, rules: RULES, stages: [stage(1), stage(2)] }
}

const A = 'alice', B = 'bob'
const READY = (name: string): ClientMessages[typeof Op.READY] => ({ name, plane: 'hawk', hp: 3, dataVersion: 'test' })
/** Real ms until stage time T (game seconds) after stageT0. */
const realMs = (T: number) => Math.ceil((T / RULES.gameSpeed) * 1000)

type Of<K extends ServerOp> = ServerMessages[K]
const of = <K extends ServerOp>(msgs: ServerMessage[], op: K): Of<K>[] => msgs.filter((m) => m.op === op).map((m) => m.data as Of<K>)
const last = <K extends ServerOp>(msgs: ServerMessage[], op: K): Of<K> | undefined => of(msgs, op).at(-1)

function lobby(d: ServerDriver): void {
  expect(d.join(A).ok).toBe(true)
  expect(d.join(B).ok).toBe(true)
  d.send(A, Op.READY, READY('A'))
  d.send(B, Op.READY, READY('B'))
  d.advance(50)
}

/** Both ready, countdown over, now `playing`; inboxes drained. */
export function playing(d: ServerDriver): void {
  lobby(d)
  d.advance(RULES.countdownMs + 100)
  expect(d.phase()).toBe('playing')
  d.drain(A); d.drain(B)
}

/** Kill every enemy of the current stage (both players fire; damage budget refills over time). */
function killWave(d: ServerDriver, stage: CoopStage): void {
  d.advance(realMs(Math.max(...stage.enemies.map((e) => e.enterT!))) + 50)
  for (let i = 0; i < 40; i++) {
    for (const e of stage.enemies) {
      d.send(A, Op.HITS, { hits: [[e.id, 150]] })
      d.send(B, Op.HITS, { hits: [[e.id, 150]] })
    }
    d.advance(500)
    if (d.phase() !== 'playing') return
  }
}

export function clearStage(d: ServerDriver, stage: CoopStage): void {
  killWave(d, stage)
  expect(d.phase()).toBe('bossWarning')
  d.advance(RULES.bossWarningMs + 100)
  expect(d.phase()).toBe('boss')
  // Both fire (one of them may be down — the server ignores a downed shooter)
  d.send(A, Op.HITS, { hits: [['boss', stage.bossHp]] })
  d.send(B, Op.HITS, { hits: [['boss', stage.bossHp]] })
  d.advance(50)
  expect(d.phase()).toBe('stageClear')
}

export function conformance(name: string, make: (data: CoopData) => ServerDriver): void {
  describe(`${name}: co-op server rules`, () => {
    it('both READY → countdown of stage 1 with a seed, then playing', () => {
      const d = make(testData())
      lobby(d)
      expect(d.phase()).toBe('countdown')
      const ph = last(d.drain(A), Op.PHASE)!
      expect(ph).toMatchObject({ phase: 'countdown', stageIndex: 0, stages: 2, stageId: 1 })
      expect(Number.isFinite(ph.seed)).toBe(true)
      d.advance(RULES.countdownMs + 100)
      expect(d.phase()).toBe('playing')
    })

    it('one READY player is not enough', () => {
      const d = make(testData())
      d.join(A); d.join(B)
      d.send(A, Op.READY, READY('A'))
      d.advance(100)
      expect(d.phase()).toBe('lobby')
    })

    it('answers PING with PONG', () => {
      const d = make(testData())
      d.join(A)
      d.send(A, Op.PING, { c: 1234 })
      d.advance(50)
      expect(last(d.drain(A), Op.PONG)?.c).toBe(1234)
    })

    it('kills from hits inside the on-screen window, with team stats', () => {
      const d = make(testData())
      playing(d)
      d.send(A, Op.HITS, { hits: [['w0.g0.u0', 20]] })   // not entered yet (T≈0.05)
      d.advance(50)
      expect(of(d.drain(A), Op.ENEMY_DEAD)).toEqual([])
      d.advance(realMs(0.6))
      d.send(A, Op.HITS, { hits: [['w0.g0.u0', 20]] })
      d.advance(50)
      const msgs = d.drain(B)
      expect(of(msgs, Op.ENEMY_DEAD)).toEqual([{ id: 'w0.g0.u0', by: A }])
      expect(last(msgs, Op.STATES)?.team).toEqual({ score: 100, kills: 1 })
    })

    it('caps damage per player', () => {
      const d = make(testData())
      playing(d)
      d.advance(realMs(1.6))
      d.send(A, Op.HITS, { hits: [['w1.g0.u0', 100000]] })
      d.advance(50)
      const hp = list(last(d.drain(A), Op.ENEMY_HP)?.hp).find(([id]) => id === 'w1.g0.u0')?.[1]
      expect(hp).toBeGreaterThanOrEqual(1000 - 100 * RULES.dpsCapMult - 1)
    })

    it('aimed shots name a living player; down shooters never send AIMED', () => {
      const d = make(testData())
      playing(d)
      d.advance(realMs(2.5))
      const aimed = of(d.drain(A), Op.AIMED)
      expect(aimed.length).toBeGreaterThan(0)
      for (const a of aimed) {
        expect(a.id).toBe('w0.g0.u0')
        expect([A, B]).toContain(a.target)
      }
    })

    it('pickups: first come first served, scripted rescues score for the team', () => {
      const d = make(testData())
      playing(d)
      d.send(A, Op.PICKUP, { id: 'rescue:start0' })
      d.send(B, Op.PICKUP, { id: 'rescue:start0' })
      d.send(B, Op.PICKUP, { id: 'rescue:w9' })           // not a scripted id for 2 waves
      d.advance(50)
      const msgs = d.drain(A)
      expect(of(msgs, Op.PICKED)).toEqual([{ id: 'rescue:start0', by: A, type: 'rescue' }])
      expect(last(msgs, Op.STATES)?.team.score).toBe(300)
    })

    it('health drops stop at maxHealth a stage, spread over it like power-ups', () => {
      // Every kill drops and only health is allowed. Four kills in the first of three waves, then four
      // in the last (they are hit in that order)
      const base = testData()
      const enemies = [0, 2].flatMap((wave) => Array.from({ length: 4 }, (_, i): CoopEnemy => ({
        id: `w${wave}.g0.u${i}`, wave, spawnT: 0, enterT: 0.5, despawnT: 6, hp: 20, score: 100, shot: 'aimed', fireInterval: 0,
      })))
      const stage: CoopStage = { id: 1, bossHp: 50, waves: 3, enemies }
      const d = make({ ...base, rules: { ...RULES, dropChance: 1, maxPowerups: 0, maxShields: 0 }, stages: [stage] })
      playing(d)
      killWave(d, stage)
      const drops = of(d.drain(A), Op.DROP)
      expect(drops.map((x) => x.type)).toEqual(['health', 'health', 'health'])
      // The first wave only unlocks the first; the other two wait for two thirds of the stage
      expect(drops.map((x) => x.enemy.slice(0, 2))).toEqual(['w0', 'w2', 'w2'])
    })

    it('down and revive', () => {
      const d = make(testData())
      playing(d)
      d.send(A, Op.GOT_HIT, { hits: 3, hp: 0 })
      d.advance(50)
      expect(d.phase()).toBe('playing')
      expect(of(d.drain(B), Op.PLAYER).find((p) => p.id === A)).toMatchObject({ alive: false, hp: 0 })
      d.send(A, Op.REVIVE, { id: A })                      // can't revive yourself
      d.advance(50)
      expect(of(d.drain(B), Op.PLAYER).some((p) => p.revived)).toBe(false)
      d.send(B, Op.REVIVE, { id: A })
      d.advance(50)
      expect(of(d.drain(A), Op.PLAYER).find((p) => p.revived)).toMatchObject({ id: A, alive: true, hp: RULES.reviveHp })
    })

    it('a downed player cannot revive anyone', () => {
      const d = make(testData())
      playing(d)
      d.send(A, Op.GOT_HIT, { hits: 3, hp: 0 })
      d.advance(50)
      d.send(B, Op.GOT_HIT, { hits: 1, hp: 2 })
      d.send(A, Op.REVIVE, { id: B })
      d.advance(50)
      expect(of(d.drain(B), Op.PLAYER).some((p) => p.revived)).toBe(false)
    })

    it('both down → failed with a summary', () => {
      const d = make(testData())
      playing(d)
      d.advance(realMs(0.6))
      d.send(A, Op.HITS, { hits: [['w0.g0.u0', 20]] })
      d.advance(50)
      d.send(A, Op.GOT_HIT, { hits: 3, hp: 0 })
      d.send(B, Op.GOT_HIT, { hits: 3, hp: 0 })
      d.advance(50)
      expect(d.phase()).toBe('failed')
      const ph = last(d.drain(A), Op.PHASE)!
      expect(ph.phase).toBe('failed')
      expect(ph.summary).toMatchObject({ result: 'failed', stagesCleared: 0, kills: 1, score: 100 })
      expect(ph.summary!.names).toHaveLength(2)
    })

    it('boss kill → stageClear → next stage (fresh seed, everyone back) → complete', () => {
      const data = testData()
      const d = make(data)
      playing(d)
      d.send(A, Op.GOT_HIT, { hits: 3, hp: 0 })            // A is down when the stage ends
      d.advance(50)
      clearStage(d, data.stages[0])
      d.advance(RULES.stageClearMs + 100)
      expect(d.phase()).toBe('countdown')
      const msgs = d.drain(A)
      const next = last(msgs, Op.PHASE)!
      expect(next).toMatchObject({ phase: 'countdown', stageIndex: 1, stageId: 2 })
      expect(last(msgs, Op.STATES)!.players.find((p) => p.id === A)).toMatchObject({ alive: true, hp: 3 })
      d.advance(RULES.countdownMs + 100)
      clearStage(d, data.stages[1])
      d.advance(RULES.stageClearMs + 100)
      expect(d.phase()).toBe('complete')
      expect(last(d.drain(B), Op.PHASE)!.summary).toMatchObject({ result: 'complete', stagesCleared: 2, kills: 6, score: 4 * 100 + 2 * 5000 })
    })

    it('rejoin mid-run: snapshot, and down until revived', () => {
      const d = make(testData())
      playing(d)
      d.advance(realMs(0.6))
      d.send(B, Op.HITS, { hits: [['w0.g0.u0', 20]] })
      d.advance(50)
      d.leave(A)
      d.advance(50)
      expect(d.phase()).toBe('playing')
      expect(of(d.drain(B), Op.PLAYER).find((p) => p.id === A)).toMatchObject({ alive: false, left: true })
      expect(d.join(A).ok).toBe(true)
      d.advance(50)
      const snap = last(d.drain(A), Op.SNAPSHOT)!
      expect(snap).toMatchObject({ stageIndex: 0, phase: 'playing' })
      expect(list(snap.dead)).toContain('w0.g0.u0')
      expect(list(snap.players).find((p) => p.id === A)?.alive).toBe(false)
      // The teammate gets A's beacon back (its leave message carried no position) and can revive A
      const beacon = of(d.drain(B), Op.PLAYER).find((p) => p.id === A && !p.alive && p.x !== undefined && p.y !== undefined)
      expect(beacon).toBeDefined()
      d.send(B, Op.REVIVE, { id: A })
      d.advance(50)
      expect(of(d.drain(A), Op.PLAYER).find((p) => p.revived)).toMatchObject({ id: A, alive: true, hp: RULES.reviveHp })
    })

    it('leaving mid-run counts as down; nobody left → failed', () => {
      const d = make(testData())
      playing(d)
      d.leave(A)
      d.advance(50)
      expect(d.phase()).toBe('playing')
      d.leave(B)
      d.advance(50)
      expect(d.phase()).toBe('failed')
    })
  })
}
