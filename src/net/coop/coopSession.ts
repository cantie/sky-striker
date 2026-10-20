import type { PickupType } from '../../store/gameStore'
import { STEP_GAME, runSteps, setFrameDriver, stepCount } from '../../game/sim/clock'
import { setNetHooks, type NetHooks } from '../../game/sim/net'
import { scriptById, scriptedPos } from '../../game/sim/stageScript'
import { GROUND_SPEED } from '../../game/world'
import { GAME_SPEED } from '../../game/speed'
import { ClockSync } from './clockSync'
import { InterpolationBuffer } from './interpolation'
import {
  HITS_BATCH_MS, IN_RUN, Op, POS_HZ, list,
  type DropInfo, type Hit, type Phase, type PhaseInfo, type PlayerState, type RunSummary, type ServerMessage, type TeamStats,
} from './protocol'
import { Listeners, type ConnectOptions, type RoomInfo, type Transport } from './transport'

/** How the session touches the game. The real one is storeWorld.ts; tests pass a fake. */
export interface WorldAdapter {
  /** A stage of the shared run begins (same stage + seed on every client). */
  startStage(info: { stageId: number; seed: number; stageIndex: number }): void
  /** Our plane right now. */
  self(): { x: number; y: number; fire: boolean; power: number; plane: string; hp: number }
  enemyHp(id: string, hp: number): void
  bossHp(hp: number): void
  /** Server says it's dead. `mine` = our hit finished it. */
  enemyDead(id: string, mine: boolean): void
  /** A drop at (x, z) in the current stage time. */
  drop(id: string, type: PickupType, x: number, z: number): void
  /** Somebody got pickup `id`; apply it if it's us. */
  picked(id: string, mine: boolean, type: PickupType): void
  /** Enemy `id` fires its volley at the point (x, y): its target, as seen on our screen. */
  aimed(id: string, at: { x: number; y: number }): void
  /** We are down (rejoined a run in progress while down). */
  down(x: number, y: number): void
  /** A teammate revived us at (x, y) with `hp`. */
  revived(x: number, y: number, hp: number): void
  phase(phase: Phase, info: PhaseInfo): void
  /** The connection dropped before the run ended. */
  lost(reason: string): void
}

export interface Teammate {
  id: string; name: string
  x: number; y: number
  /** Sideways speed along the drawn path (units / s), for the lean. */
  vx: number
  alive: boolean; fire: boolean; power: number; plane: string; hp: number
}

export interface RosterEntry { id: string; name: string; plane: string; ready: boolean }
/** A downed player's beacon. */
export interface Downed { id: string; x: number; y: number; self: boolean }

export interface SessionStatus {
  phase: Phase
  roomId: string | null
  code: string | null
  selfId: string | null
  rtt: number
  /** Positive: we are behind the shared stage clock by this many steps. */
  behind: number
  teammates: number
  stageIndex: number
  stages: number
  /** We've said READY. */
  ready: boolean
}

const PING_EVERY_MS = 1000
/** Nothing from the server for this long mid-run (not even a PONG): the match is gone. */
const SILENT_MS = 5000
/** Steps per frame: a little faster than real time to absorb jitter; much faster to catch up. */
const SMOOTH_STEPS = 3
const CATCHUP_STEPS = 240
const CATCHUP_AFTER = 30

type Timer = ReturnType<typeof setInterval>

/**
 * One co-op run on the client — the whole campaign: lobby → (countdown → playing → boss →
 * stageClear) per stage → complete | failed. Sends our position (POS, 20 Hz), batched hits
 * (HITS, 100 ms), GOT_HIT / PICKUP / REVIVE / READY / RESYNC; keeps the server clock, the roster
 * and teammates' interpolation buffers; applies server events through WorldAdapter. While a stage
 * runs it drives the simulation clock from the shared stage clock and installs NetHooks.
 */
export class CoopSession {
  readonly clock: ClockSync
  phase: Phase = 'lobby'
  room: RoomInfo | null = null
  stageIndex = 0
  stages = 0
  team: TeamStats = { score: 0, kills: 0 }
  summary: RunSummary | null = null
  private stageT0 = 0
  private stageId = 1
  private seed = 0
  private running = false
  private stopped = false
  private saidReady = false
  private me: { name: string; plane: string; hp: number; dataVersion: string } | null = null
  private hits: Hit[] = []
  private settled = new Set<string>()
  private mates = new Map<string, { buf: InterpolationBuffer; state: PlayerState; name: string }>()
  private names = new Map<string, string>()
  private members = new Map<string, RosterEntry>()
  private downed = new Map<string, { x: number; y: number }>()
  private bossTargetId: string | null = null
  private timers: Timer[] = []
  private unsubs: (() => void)[] = []
  private stopListeners = new Listeners<[]>()
  private lastBehind = 0
  private lastHeard = 0
  /** Diagnostics (`?coopdebug=1`): the last STATES rows, and how many STATES came from each match. */
  private lastStates: PlayerState[] = []
  private statesFrom = new Map<string, number>()

  constructor(
    private transport: Transport,
    private world: WorldAdapter,
    private now: () => number = () => performance.now(),
  ) {
    this.clock = new ClockSync(now)
  }

  get selfId(): string | null {
    return this.room?.selfId ?? null
  }

  /** Connect and enter a room: create one (with a code), join by code, or quick match. */
  async start(opts: ConnectOptions & { plane: string; hp: number; dataVersion: string; room: 'create' | 'match' | { code: string } }): Promise<RoomInfo> {
    this.me = { name: opts.name, plane: opts.plane, hp: opts.hp, dataVersion: opts.dataVersion }
    await this.transport.connect(opts)
    this.unsubs.push(
      this.transport.onMessage((m) => this.handle(m)),
      this.transport.onDisconnect((reason) => {
        if (this.stopped) return
        const ended = this.phase === 'complete' || this.phase === 'failed'
        void this.stop()
        if (!ended) this.world.lost(reason)
      }),
    )
    this.room = opts.room === 'create'
      ? await this.transport.createRoom()
      : opts.room === 'match'
        ? await this.transport.matchmake()
        : await this.transport.joinRoom(opts.room.code)
    this.names.set(this.room.selfId, opts.name)
    // A quick burst of pings so the clock is good before the countdown ends
    for (let i = 0; i < 5; i++) setTimeout(() => this.ping(), i * 120)
    this.lastHeard = this.now()
    this.timers.push(
      setInterval(() => { this.ping(); this.watchdog() }, PING_EVERY_MS),
      setInterval(() => this.sendPos(), 1000 / POS_HZ),
      setInterval(() => this.flushHits(), HITS_BATCH_MS),
    )
    return this.room
  }

  /** Lobby: we're ready to launch (the run starts when everyone is). */
  ready(): void {
    if (!this.me) return
    this.saidReady = true
    this.transport.send(Op.READY, { ...this.me })
  }

  /** We hovered over `id`'s beacon long enough. */
  revive(id: string): void {
    this.transport.send(Op.REVIVE, { id })
  }

  async stop(): Promise<void> {
    if (this.stopped) return
    this.stopped = true
    this.timers.forEach(clearInterval)
    this.timers = []
    this.unsubs.forEach((u) => u())
    this.unsubs = []
    this.detach()
    await this.transport.leave().catch(() => {})
    this.stopListeners.emit()
  }

  onStop(cb: () => void): () => void { return this.stopListeners.add(cb) }

  /** Ask for a SNAPSHOT (e.g. we fell far behind or came back from a hidden tab). */
  resync(): void {
    this.transport.send(Op.RESYNC, {})
  }

  // ── what the game calls (NetHooks) ──

  readonly hooks: NetHooks = {
    hit: (target, damage) => { this.hits.push([target, damage]) },
    pickup: (id) => { this.transport.send(Op.PICKUP, { id }) },
    gotHit: (hits, hp) => { this.transport.send(Op.GOT_HIT, { hits, hp }) },
    bossTarget: () => {
      const id = this.bossTargetId
      if (!id || id === this.selfId) return null
      const m = this.teammates().find((t) => t.id === id && t.alive)
      return m ? { x: m.x, y: m.y } : null
    },
    wingmates: () => this.teammates().filter((t) => t.alive),
    spawnAllowed: (id) => !this.settled.has(id),
  }

  /** Stage time (game seconds) at a server time. Negative during the countdown. */
  stageTime(serverNow = this.clock.serverNow()): number {
    return ((serverNow - this.stageT0) / 1000) * GAME_SPEED
  }

  /** Frame driver: run whole steps until the local sim reaches the shared stage clock. */
  readonly drive = (): number => {
    const target = Math.floor(this.stageTime() / STEP_GAME)
    const behind = target - stepCount()
    this.lastBehind = behind
    if (behind <= 0) return 0
    const n = Math.min(behind, behind > CATCHUP_AFTER ? CATCHUP_STEPS : SMOOTH_STEPS)
    runSteps(n)
    return n
  }

  teammates(serverNow = this.clock.serverNow()): Teammate[] {
    const out: Teammate[] = []
    for (const [id, m] of this.mates) {
      const p = m.buf.at(serverNow)
      if (!p) continue
      const s = m.state
      out.push({ id, name: m.name, x: p.x, y: p.y, vx: p.vx, alive: s.alive, fire: s.fire, power: s.power, plane: s.plane, hp: s.hp })
    }
    return out
  }

  /** Short lines for the `?coopdebug=1` overlay: who we are, what the server sends, what we draw. */
  debugLines(): string[] {
    const id = (s: string | null | undefined) => (s ?? '-').slice(0, 8)
    const xy = (p: { x: number; y: number }) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`
    const now = this.clock.serverNow()
    return [
      `me   ${id(this.selfId)} ${this.room?.code ?? ''}`,
      `room ${id(this.room?.roomId)} rtt ${Math.round(this.clock.rtt)}${this.clock.synced ? '' : ' nosync'}`,
      ...[...this.statesFrom].map(([match, n]) => `rx   ${id(match)} x${n}`),
      ...this.lastStates.map((p) => `srv  ${id(p.id)} ${xy(p)} ${p.t ? `${Math.round(now - p.t)}ms` : 'nopos'}${p.alive ? '' : ' down'}`),
      ...[...this.mates].flatMap(([mid, m]) => {
        const at = m.buf.sample(now, m.buf.stats().delay)
        const st = m.buf.stats()
        return [
          `mate ${id(mid)} ${at ? xy(at) : '-'} b${m.buf.size} ${m.name.slice(0, 8)}`,
          // drawing delay now→target · ~95% of samples needed · biggest gap · time spent guessing
          `  d${Math.round(st.delay)}→${Math.round(st.goal)} n${Math.round(st.need)} g${Math.round(st.gap)} ex${Math.round(st.guess * 100)}%`,
        ]
      }),
    ]
  }

  downedPlayers(): Downed[] {
    return [...this.downed].map(([id, p]) => ({ id, x: p.x, y: p.y, self: id === this.selfId }))
  }

  roster(): RosterEntry[] {
    return [...this.members.values()]
  }

  status(): SessionStatus {
    return {
      phase: this.phase, roomId: this.room?.roomId ?? null, code: this.room?.code ?? null, selfId: this.selfId,
      rtt: Math.round(this.clock.rtt), behind: this.lastBehind, teammates: this.mates.size,
      stageIndex: this.stageIndex, stages: this.stages, ready: this.saidReady,
    }
  }

  // ── server → client ──

  handle(m: ServerMessage): void {
    this.lastHeard = this.now()
    const me = this.selfId
    switch (m.op) {
      case Op.PONG:
        this.clock.addSample(m.data.c, m.data.s)
        break
      case Op.STATES:
        this.bossTargetId = m.data.bossTarget ?? null
        if (m.data.team) this.team = m.data.team
        this.lastStates = list(m.data.players)
        this.statesFrom.set(m.match ?? 'local', (this.statesFrom.get(m.match ?? 'local') ?? 0) + 1)
        for (const p of list(m.data.players)) {
          if (p.id === me) continue
          let mate = this.mates.get(p.id)
          if (!mate) {
            mate = { buf: new InterpolationBuffer(), state: p, name: this.names.get(p.id) ?? 'Wingmate' }
            this.mates.set(p.id, mate)
          }
          mate.state = p
          mate.buf.push({ t: p.t, x: p.x, y: p.y }, this.clock.serverNow())
        }
        break
      case Op.PLAYER: {
        const d = m.data
        if (d.name) this.names.set(d.id, d.name)
        if (d.left) {
          this.mates.delete(d.id)
          this.downed.delete(d.id)
          if (this.phase === 'lobby') this.members.delete(d.id)
          break
        }
        if (d.name !== undefined || d.plane !== undefined || d.ready !== undefined) {
          const prev = this.members.get(d.id)
          this.members.set(d.id, {
            id: d.id, name: d.name ?? prev?.name ?? 'Pilot', plane: d.plane ?? prev?.plane ?? 'hawk', ready: d.ready ?? prev?.ready ?? false,
          })
        }
        const mate = this.mates.get(d.id)
        if (mate) {
          mate.state = { ...mate.state, hp: d.hp, alive: d.alive }
          if (d.name) mate.name = d.name
        }
        if (!d.alive && d.x !== undefined && d.y !== undefined) this.downed.set(d.id, { x: d.x, y: d.y })
        if (d.alive) this.downed.delete(d.id)
        if (d.id === me && d.revived && d.x !== undefined && d.y !== undefined) this.world.revived(d.x, d.y, d.hp)
        break
      }
      case Op.PHASE:
        this.applyPhase(m.data)
        break
      case Op.SNAPSHOT: {
        const d = m.data
        this.settled = new Set([...list(d.dead), ...list(d.taken)])
        if (d.team) this.team = d.team
        this.applyPhase({ ...d, bossHp: d.bossHp ?? undefined }, true)
        for (const [id, hp] of list(d.hp)) this.world.enemyHp(id, hp)
        for (const id of list(d.dead)) this.world.enemyDead(id, false)
        for (const p of list(d.pickups)) this.placeDrop(p)
        this.downed.clear()
        for (const p of list(d.players)) {
          if (p.alive) continue
          this.downed.set(p.id, { x: p.x, y: p.y })
          if (p.id === me) this.world.down(p.x, p.y)
        }
        break
      }
      case Op.ENEMY_HP:
        for (const [id, hp] of list(m.data.hp)) {
          if (id === 'boss') this.world.bossHp(hp)
          else this.world.enemyHp(id, hp)
        }
        break
      case Op.ENEMY_DEAD:
        this.settled.add(m.data.id)
        this.world.enemyDead(m.data.id, m.data.by === me)
        break
      case Op.DROP:
        this.placeDrop(m.data)
        break
      case Op.PICKED:
        this.settled.add(m.data.id)
        this.world.picked(m.data.id, m.data.by === me, m.data.type)
        break
      case Op.AIMED:
        if (this.running) this.world.aimed(m.data.id, this.positionOf(m.data.target))
        break
    }
  }

  /** Where player `id` is on our screen (us: exactly; a teammate: interpolated). */
  private positionOf(id: string): { x: number; y: number } {
    if (id !== this.selfId) {
      const t = this.teammates().find((m) => m.id === id)
      if (t) return { x: t.x, y: t.y }
    }
    const s = this.world.self()
    return { x: s.x, y: s.y }
  }

  /** A server drop falls where its enemy was, and has ridden the map since. */
  private placeDrop(p: DropInfo): void {
    const e = scriptById(this.stageId).get(p.enemy)
    if (!e) return
    const at = scriptedPos(e, p.t)
    const z = at.y - Math.max(0, this.stageTime() - p.t) * GROUND_SPEED
    this.world.drop(p.id, p.type, at.x, z)
  }

  private applyPhase(d: PhaseInfo, fromSnapshot = false): void {
    const prev = this.phase
    this.phase = d.phase
    this.stageT0 = d.stageT0
    this.stages = d.stages
    if (d.team) this.team = d.team
    if (d.summary) this.summary = d.summary
    const fresh = IN_RUN.has(d.phase) && (!this.running || d.stageIndex !== this.stageIndex || d.seed !== this.seed)
    if (fresh) {
      this.stageIndex = d.stageIndex
      this.stageId = d.stageId
      this.seed = d.seed
      // A new stage starts clean; a snapshot brings its own settled set
      if (!fromSnapshot) this.settled.clear()
      this.downed.clear()
      this.world.startStage({ stageId: d.stageId, seed: d.seed, stageIndex: d.stageIndex })
      this.attach()
    }
    if (prev !== d.phase || fresh) this.world.phase(d.phase, d)
    if (d.phase === 'complete' || d.phase === 'failed') this.detach()
  }

  // ── client → server ──

  private ping(): void {
    this.transport.send(Op.PING, { c: this.now() })
  }

  /**
   * The socket can stay up while the match's node is gone (matches live on any pod): we would fly on
   * alone forever. The server answers every PING, so silence mid-run means it's over.
   */
  private watchdog(): void {
    if (this.stopped || !IN_RUN.has(this.phase) || this.now() - this.lastHeard < SILENT_MS) return
    void this.stop()
    this.world.lost('The co-op server stopped responding')
  }

  private sendPos(): void {
    if (!this.running) return
    const s = this.world.self()
    this.transport.send(Op.POS, { x: s.x, y: s.y, t: this.clock.serverNow(), fire: s.fire, power: s.power, plane: s.plane })
  }

  flushHits(): void {
    if (!this.hits.length) return
    // Merge per target: one entry per enemy per batch
    const sum = new Map<string, number>()
    for (const [id, d] of this.hits) sum.set(id, (sum.get(id) ?? 0) + d)
    this.hits = []
    this.transport.send(Op.HITS, { hits: [...sum] })
  }

  private attach(): void {
    this.running = true
    setNetHooks(this.hooks)
    setFrameDriver(this.drive)
  }

  private detach(): void {
    if (!this.running) return
    this.running = false
    setNetHooks(null)
    setFrameDriver(null)
  }
}
