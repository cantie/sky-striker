import { useGameStore, type PickupType } from '../../store/gameStore'
import { GAME_SPEED } from '../../game/speed'
import { STEP_GAME, runSteps, setFrameDriver, stepCount } from '../../game/sim/clock'
import { setNetHooks, type NetHooks } from '../../game/sim/net'
import { GROUND_SPEED } from '../../game/world'
import { ClockSync } from './clockSync'
import { InterpolationBuffer } from './interpolation'
import { HITS_BATCH_MS, Op, POS_HZ, type Hit, type Phase, type PlayerState, type ServerMessage, type ServerMessages } from './protocol'
import type { ConnectOptions, RoomInfo, Transport } from './transport'

/** How the session touches the game. The real one is storeWorld.ts; tests pass a fake. */
export interface WorldAdapter {
  /** Begin the shared run (same stage + seed on every client). */
  startRun(stageId: number, seed: number): void
  /** Our plane right now. */
  self(): { x: number; y: number; fire: boolean; power: number; plane: string; hp: number }
  enemyHp(id: string, hp: number): void
  bossHp(hp: number): void
  /** Server says it's dead. `mine` = our hit finished it (we score). */
  enemyDead(id: string, mine: boolean): void
  /** A drop at (x, z) in the current stage time. */
  drop(id: string, type: PickupType, x: number, z: number): void
  /** Somebody got pickup `id`; apply it if it's us. */
  picked(id: string, mine: boolean, type: PickupType): void
  /** Enemy `id` fires its volley toward `ang`. */
  aimed(id: string, ang: number): void
  phase(phase: Phase, info: ServerMessages[typeof Op.PHASE]): void
  /** Server put us back in the fight at the beacon. */
  revived(hp: number, x: number, y: number): void
}

export interface Teammate {
  id: string; name: string
  x: number; y: number
  alive: boolean; fire: boolean; power: number; plane: string; hp: number
}

export interface SessionStatus {
  phase: Phase
  roomId: string | null
  selfId: string | null
  rtt: number
  /** Positive: we are behind the shared stage clock by this many steps. */
  behind: number
  teammates: number
}

const PING_EVERY_MS = 1000
/** Steps per frame: a little faster than real time to absorb jitter; much faster to catch up. */
const SMOOTH_STEPS = 3
const CATCHUP_STEPS = 240
const CATCHUP_AFTER = 30

type Timer = ReturnType<typeof setInterval>

/**
 * One co-op run on the client: lobby → countdown → playing → result. Sends our position (POS,
 * 20 Hz), batched hits (HITS, 100 ms), GOT_HIT / PICKUP / READY / RESYNC, keeps the server clock
 * and teammates' interpolation buffers, and applies server events to the game via WorldAdapter.
 * While active it drives the simulation clock from the shared stage clock and installs NetHooks.
 */
export class CoopSession {
  readonly clock: ClockSync
  phase: Phase = 'lobby'
  room: RoomInfo | null = null
  private stageT0 = 0
  private stageId = 1
  private seed = 0
  private running = false
  private hits: Hit[] = []
  private settled = new Set<string>()
  private mates = new Map<string, { buf: InterpolationBuffer; state: PlayerState; name: string; beacon: { x: number; y: number } | null }>()
  private reviveAt = new Map<string, number>()
  private names = new Map<string, string>()
  private bossTargetId: string | null = null
  private timers: Timer[] = []
  private unsubs: (() => void)[] = []
  private lastBehind = 0

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

  /** Connect, enter a room and say READY. `room`: create one, join by id, or matchmake. */
  async start(opts: ConnectOptions & { plane: string; hp: number; stageId: number; room: 'create' | 'match' | { join: string } }): Promise<RoomInfo> {
    await this.transport.connect(opts)
    this.unsubs.push(
      this.transport.onMessage((m) => this.handle(m)),
      this.transport.onDisconnect(() => this.stop()),
    )
    this.room = opts.room === 'create'
      ? await this.transport.createRoom({ stageId: opts.stageId })
      : opts.room === 'match'
        ? await this.transport.matchmake({ stageId: opts.stageId, size: 2 })
        : await this.transport.joinRoom(opts.room.join)
    this.names.set(this.room.selfId, opts.name)
    // A quick burst of pings so the clock is good before the countdown ends
    for (let i = 0; i < 5; i++) setTimeout(() => this.ping(), i * 120)
    this.timers.push(
      setInterval(() => this.ping(), PING_EVERY_MS),
      setInterval(() => this.sendPos(), 1000 / POS_HZ),
      setInterval(() => this.flushHits(), HITS_BATCH_MS),
    )
    this.transport.send(Op.READY, { name: opts.name, plane: opts.plane, hp: opts.hp })
    return this.room
  }

  async stop(): Promise<void> {
    this.timers.forEach(clearInterval)
    this.timers = []
    this.unsubs.forEach((u) => u())
    this.unsubs = []
    this.detach()
    await this.transport.leave().catch(() => {})
  }

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
    spawnAllowed: (id) => !this.settled.has(id),
  }

  /** Ask the server to revive a downed wingmate. Throttled; the server still checks range. */
  revive(id: string): void {
    const t = this.now()
    if (t - (this.reviveAt.get(id) ?? 0) < 400) return
    this.reviveAt.set(id, t)
    this.transport.send(Op.REVIVE, { id })
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
      const s = m.state
      const p = m.buf.sample(serverNow)
      // A wreck stays on its beacon so a wingmate can fly to it
      const xy = !s.alive && m.beacon ? m.beacon : p
      if (!xy) continue
      out.push({ id, name: m.name, x: xy.x, y: xy.y, alive: s.alive, fire: s.alive && s.fire, power: s.power, plane: s.plane, hp: s.hp })
    }
    return out
  }

  status(): SessionStatus {
    return {
      phase: this.phase, roomId: this.room?.roomId ?? null, selfId: this.selfId,
      rtt: Math.round(this.clock.rtt), behind: this.lastBehind, teammates: this.mates.size,
    }
  }

  // ── server → client ──

  handle(m: ServerMessage): void {
    const me = this.selfId
    switch (m.op) {
      case Op.PONG:
        this.clock.addSample(m.data.c, m.data.s)
        break
      case Op.STATES:
        this.bossTargetId = m.data.bossTarget
        for (const p of m.data.players) {
          if (p.id === me) continue
          let mate = this.mates.get(p.id)
          if (!mate) {
            mate = { buf: new InterpolationBuffer(), state: p, name: this.names.get(p.id) ?? 'Wingmate', beacon: null }
            this.mates.set(p.id, mate)
          }
          mate.state = p
          if (p.alive) {
            mate.beacon = null
            mate.buf.push({ t: p.t, x: p.x, y: p.y })
          } else if (!mate.beacon) mate.beacon = { x: p.x, y: p.y }
        }
        break
      case Op.PLAYER: {
        const d = m.data
        if (d.name) this.names.set(d.id, d.name)
        if (d.id === me) {
          if (d.revived && d.alive) this.world.revived(d.hp, d.x ?? 0, d.y ?? 0)
          break
        }
        if (d.left) { this.mates.delete(d.id); break }
        let mate = this.mates.get(d.id)
        if (!mate) {
          const x = d.x ?? 0
          const y = d.y ?? -4
          mate = {
            buf: new InterpolationBuffer(),
            state: { id: d.id, x, y, t: 0, fire: false, power: 0, plane: 'hawk', hp: d.hp, alive: d.alive },
            name: this.names.get(d.id) ?? 'Wingmate',
            beacon: null,
          }
          mate.buf.push({ t: this.clock.serverNow(), x, y })
          this.mates.set(d.id, mate)
        }
        mate.state = { ...mate.state, hp: d.hp, alive: d.alive }
        if (d.name) mate.name = d.name
        if (!d.alive && typeof d.x === 'number' && typeof d.y === 'number') mate.beacon = { x: d.x, y: d.y }
        if (d.alive) {
          mate.beacon = null
          if (d.revived && typeof d.x === 'number' && typeof d.y === 'number') {
            mate.state = { ...mate.state, x: d.x, y: d.y }
            mate.buf.push({ t: this.clock.serverNow(), x: d.x, y: d.y })
          }
        }
        break
      }
      case Op.PHASE:
        this.applyPhase(m.data)
        break
      case Op.SNAPSHOT: {
        const d = m.data
        this.settled = new Set([...d.dead, ...d.taken])
        this.applyPhase({ phase: d.phase, stageId: d.stageId, seed: d.seed, stageT0: d.stageT0, bossHp: d.bossHp ?? undefined }, true)
        for (const [id, hp] of d.hp) this.world.enemyHp(id, hp)
        for (const id of d.dead) this.world.enemyDead(id, false)
        const t = this.stageTime()
        for (const p of d.pickups) this.world.drop(p.id, p.type, p.x, p.z - (t - p.t) * GROUND_SPEED)
        break
      }
      case Op.ENEMY_HP:
        for (const [id, hp] of m.data.hp) {
          if (id === 'boss') this.world.bossHp(hp)
          else this.world.enemyHp(id, hp)
        }
        break
      case Op.ENEMY_DEAD:
        this.settled.add(m.data.id)
        this.world.enemyDead(m.data.id, m.data.by === me)
        break
      case Op.DROP: {
        const d = m.data
        if (typeof d.x !== 'number' || typeof d.z !== 'number') break
        // It has been riding the map since it dropped
        const z = d.z - Math.max(0, this.stageTime() - d.t) * GROUND_SPEED
        this.world.drop(d.id, d.type, d.x, z)
        break
      }
      case Op.PICKED:
        this.settled.add(m.data.id)
        this.world.picked(m.data.id, m.data.by === me, m.data.type)
        break
      case Op.AIMED: {
        if (!this.running) break
        const ang = typeof m.data.ang === 'number' ? m.data.ang : this.angleTo(m.data.id, m.data.target)
        if (ang != null) this.world.aimed(m.data.id, ang)
        break
      }
    }
  }

  /** Nakama aims at a player id; the loopback server sends the angle itself. */
  private angleTo(enemyId: string, targetId?: string): number | null {
    if (!targetId) return null
    const e = useGameStore.getState().enemies.find((x) => x.id === enemyId)
    if (!e) return null
    const pos = targetId === this.selfId
      ? this.world.self()
      : this.teammates().find((t) => t.id === targetId)
    if (!pos) return null
    return Math.atan2(pos.x - e.x, pos.y - e.y)
  }

  private applyPhase(d: ServerMessages[typeof Op.PHASE], fromSnapshot = false): void {
    const raw = d.phase as string
    if (raw === 'complete') d = { ...d, phase: 'victory' }
    else if (raw === 'stageClear') d = { ...d, phase: 'playing' }
    const prev = this.phase
    this.phase = d.phase
    this.stageT0 = d.stageT0
    const fresh = !this.running || d.stageId !== this.stageId || d.seed !== this.seed
    if (fresh && d.phase !== 'lobby' && d.phase !== 'victory' && d.phase !== 'failed') {
      this.stageId = d.stageId
      this.seed = d.seed
      // A new run starts clean; a snapshot brings its own settled set
      if (!fromSnapshot) this.settled.clear()
      this.world.startRun(d.stageId, d.seed)
      this.attach()
    }
    if (prev !== d.phase) this.world.phase(d.phase, d)
    if (d.phase === 'victory' || d.phase === 'failed') this.detach()
  }

  // ── client → server ──

  private ping(): void {
    this.transport.send(Op.PING, { c: this.now() })
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
