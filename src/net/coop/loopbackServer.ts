import { getPlane } from '../../game/planes'
import { weaponStats } from '../../game/weapon'
import { pickDrop } from '../../game/dropRules'
import { inWorld } from '../../game/world'
import { scriptById, scriptedPos } from '../../game/sim/stageScript'
import { coopData, scriptedPickupKind, type CoopData, type CoopEnemy, type CoopStage } from './coopData'
import {
  IN_RUN, Op, TICK_RATE, decode, encode, list, parseServer,
  type ClientMessages, type ClientOp, type DropInfo, type Phase, type PhaseInfo, type PlayerState,
  type RunSummary, type ServerMessage, type ServerMessages, type ServerOp, type TeamStats,
} from './protocol'
import { Listeners, type ConnectOptions, type RoomInfo, type Transport } from './transport'

/**
 * In-browser authoritative co-op server: the reference implementation of the rules that
 * nakama/modules/skystriker_coop.lua implements for real (both pass serverConformance.ts).
 * Runs the whole campaign from the co-op data — enemy HP and deaths, drops and pickups, aimed
 * shots, downs and revives, phases and team stats — plus an optional bot wingmate (dev only).
 */
export interface LoopbackOptions {
  data?: CoopData
  /** First stage index (dev: `?stage=N` starts the run at stage N). */
  startStage?: number
  /** Add a bot wingmate that flies under enemies and shoots them; then one human can start. */
  bot?: boolean
  /** Server clock (ms). */
  now?: () => number
  random?: () => number
}

const TICK_MS = 1000 / TICK_RATE
const MAX_PLAYERS = 2
const BOT_ID = 'bot'
const FIGHTING = new Set<Phase>(['playing', 'bossWarning', 'boss'])
const AIMED_SHOTS = new Set(['aimed', 'spread3', 'burst2'])

type Member = PlayerState & {
  name: string; human: boolean; maxHp: number; ready: boolean; connected: boolean
  /** Damage this player may still deal right now (refills at maxDps × cap per game-second). */
  budget: number
  downX: number; downY: number
}

const clampHp = (hp: unknown) => Math.max(1, Math.min(9, Math.floor(Number(hp)) || 3))
const inWindow = (e: CoopEnemy, T: number) => e.enterT !== null && T >= e.enterT - 0.2 && T <= e.despawnT + 0.5
const playerState = ({ id, x, y, t, fire, power, plane, hp, alive }: Member): PlayerState => ({ id, x, y, t, fire, power, plane, hp, alive })

export class LoopbackServer {
  readonly roomId = `loopback-${Math.floor(Math.random() * 1e6)}`
  readonly data: CoopData
  phase: Phase = 'lobby'
  stageIndex = 0
  seed = 0
  stageT0 = 0
  team: TeamStats = { score: 0, kills: 0 }
  stagesCleared = 0
  summary: RunSummary | null = null
  private now: () => number
  private random: () => number
  private members = new Map<string, Member>()
  private clients = new Map<string, (m: ServerMessage) => void>()
  private byId = new Map<string, CoopEnemy>()
  private lastSpawn = 0
  private hp = new Map<string, number>()
  private dirty = new Set<string>()
  private dead = new Set<string>()
  private nextShot = new Map<string, number>()
  private pickups = new Map<string, DropInfo>()
  private taken = new Set<string>()
  private drops = { powerups: 0, shields: 0, health: 0, n: 0 }
  private bossHp: number | null = null
  private phaseAt = 0
  private bossTarget: string | null = null
  private bossSwapAt = 0
  private runStart = 0
  private lastTick = 0
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(private opts: LoopbackOptions = {}) {
    this.now = opts.now ?? (() => performance.now())
    this.random = opts.random ?? Math.random
    this.data = opts.data ?? coopData()
    if (opts.bot) this.members.set(BOT_ID, { ...this.blank(BOT_ID, 'BOT', false), hp: 99, maxHp: 99, ready: true, power: 2, x: 2.5 })
  }

  get stage(): CoopStage { return this.data.stages[this.stageIndex] }
  private get rules() { return this.data.rules }
  private get cap() { return this.data.maxDps * this.rules.dpsCapMult }

  private blank(id: string, name: string, human: boolean): Member {
    return {
      id, name, human, x: 0, y: -4, t: 0, fire: false, power: 0, plane: 'hawk', hp: 3, maxHp: 3, alive: true,
      ready: false, connected: true, budget: this.cap, downX: 0, downY: -4,
    }
  }

  /** Run the server on its own timer (tests call tick() by hand instead). */
  startTimer(): void { if (!this.timer) this.timer = setInterval(() => this.tick(), TICK_MS) }
  stopTimer(): void { if (this.timer) clearInterval(this.timer); this.timer = null }

  /** Game seconds since the current stage started. */
  stageTime(now = this.now()): number {
    return ((now - this.stageT0) / 1000) * this.rules.gameSpeed
  }

  /** A client connects. Members may come back mid-run (they get a snapshot); others only join the lobby. */
  join(id: string, deliver: (m: ServerMessage) => void): boolean {
    const m = this.members.get(id)
    const humans = [...this.members.values()].filter((p) => p.human).length
    if (!m && (this.phase !== 'lobby' || humans >= MAX_PLAYERS)) return false
    this.clients.set(id, deliver)
    if (m) m.connected = true
    else this.members.set(id, this.blank(id, id, true))
    this.roster()
    if (m && this.phase !== 'lobby') this.sendTo(id, Op.SNAPSHOT, this.snapshot())
    // Back while down: the teammate's beacon left with us, put it back so they can revive us
    if (m && !m.alive && FIGHTING.has(this.phase)) this.broadcast(Op.PLAYER, { id, hp: 0, alive: false, x: m.downX, y: m.downY })
    return true
  }

  leave(id: string): void {
    this.clients.delete(id)
    const m = this.members.get(id)
    if (!m) return
    if (this.phase === 'lobby') this.members.delete(id)
    else { m.connected = false; m.alive = false; m.hp = 0; m.downX = m.x; m.downY = m.y }
    this.broadcast(Op.PLAYER, { id, hp: 0, alive: false, left: true })
    this.checkFailed(this.now())
  }

  // ── client → server ──

  receive<K extends ClientOp>(from: string, op: K, data: ClientMessages[K]): void {
    const now = this.now()
    const m = this.members.get(from)
    if (!m) return
    switch (op) {
      case Op.PING:
        this.sendTo(from, Op.PONG, { c: (data as ClientMessages[typeof Op.PING]).c, s: now })
        break
      case Op.READY: {
        const d = data as ClientMessages[typeof Op.READY]
        m.ready = true
        m.plane = d.plane
        if (this.phase === 'lobby') {
          // (Nakama takes the name sent with the join instead)
          m.name = d.name
          m.maxHp = m.hp = clampHp(d.hp)
          this.roster()
          const humans = [...this.members.values()].filter((p) => p.human)
          if (humans.length >= (this.opts.bot ? 1 : MAX_PLAYERS) && humans.every((p) => p.ready)) this.startRun(now)
        } else {
          this.sendTo(from, Op.SNAPSHOT, this.snapshot())
          this.roster()
        }
        break
      }
      case Op.POS: {
        const d = data as ClientMessages[typeof Op.POS]
        if (!m.connected) break
        m.x = d.x; m.y = d.y; m.t = d.t; m.fire = !!d.fire; m.power = Math.floor(d.power) || 0; m.plane = d.plane
        break
      }
      case Op.HITS:
        for (const [target, dmg] of list((data as ClientMessages[typeof Op.HITS]).hits)) this.applyHit(m, target, dmg, now)
        break
      case Op.GOT_HIT:
        this.gotHit(m, (data as ClientMessages[typeof Op.GOT_HIT]).hp, now)
        break
      case Op.PICKUP:
        this.pickup(m, (data as ClientMessages[typeof Op.PICKUP]).id)
        break
      case Op.REVIVE:
        this.revive(m, (data as ClientMessages[typeof Op.REVIVE]).id)
        break
      case Op.RESYNC:
        this.sendTo(from, Op.SNAPSHOT, this.snapshot())
        break
    }
  }

  private applyHit(m: Member, target: string, dmg: number, now: number): void {
    if (!m.alive || typeof dmg !== 'number' || !(dmg > 0)) return
    dmg = Math.min(dmg, m.budget)
    if (dmg <= 0) return
    if (target === 'boss') {
      if (this.phase !== 'boss' || this.bossHp === null || this.bossHp <= 0) return
      m.budget -= dmg
      this.bossHp -= dmg
      this.dirty.add('boss')
      if (this.bossHp <= 0) {
        this.bossHp = 0
        this.dirty.delete('boss')
        this.team.kills++
        this.team.score += this.data.bossScore
        this.broadcast(Op.ENEMY_DEAD, { id: 'boss', by: m.id })
        this.stageCleared(now)
      }
      return
    }
    if (!FIGHTING.has(this.phase)) return
    const e = this.byId.get(target)
    const T = this.stageTime(now)
    if (!e || this.dead.has(target) || !inWindow(e, T)) return
    m.budget -= dmg
    const hp = (this.hp.get(target) ?? e.hp) - dmg
    this.hp.set(target, hp)
    if (hp > 0) { this.dirty.add(target); return }
    this.dead.add(target)
    this.dirty.delete(target)
    this.team.kills++
    this.team.score += e.score
    this.broadcast(Op.ENEMY_DEAD, { id: target, by: m.id })
    const type = pickDrop(this.random, {
      powerupsDropped: this.drops.powerups, shieldsDropped: this.drops.shields, healthDropped: this.drops.health,
      progress: e.wave / Math.max(1, this.stage.waves),
    }, this.rules)
    if (type) {
      if (type === 'powerup') this.drops.powerups++
      if (type === 'shield') this.drops.shields++
      if (type === 'health') this.drops.health++
      const drop: DropInfo = { id: `d${this.drops.n++}`, type, enemy: target, t: T }
      this.pickups.set(drop.id, drop)
      this.broadcast(Op.DROP, drop)
    }
  }

  private gotHit(m: Member, hp: number, now: number): void {
    if (!m.alive || !FIGHTING.has(this.phase)) return
    m.hp = Math.max(0, Math.min(m.maxHp, Math.floor(Number(hp)) || 0))
    if (m.hp > 0) { this.broadcast(Op.PLAYER, { id: m.id, hp: m.hp, alive: true }); return }
    m.alive = false
    m.downX = m.x; m.downY = m.y
    this.broadcast(Op.PLAYER, { id: m.id, hp: 0, alive: false, x: m.x, y: m.y })
    this.checkFailed(now)
  }

  private pickup(m: Member, id: string): void {
    if (!m.alive || !IN_RUN.has(this.phase) || typeof id !== 'string' || this.taken.has(id)) return
    const drop = this.pickups.get(id)
    const type = drop?.type ?? scriptedPickupKind(id, this.stage.waves)
    if (!type) return
    this.taken.add(id)
    this.pickups.delete(id)
    if (!drop) this.team.score += type === 'rescue' ? this.data.rescueScore : this.data.podScore
    this.broadcast(Op.PICKED, { id, by: m.id, type })
  }

  private revive(m: Member, id: string): void {
    const t = this.members.get(id)
    if (!m.alive || !t || t === m || t.alive || !t.connected || !FIGHTING.has(this.phase)) return
    // Must actually be near the beacon (POS lags a little, hence the slack)
    if (Math.hypot(m.x - t.downX, m.y - t.downY) > this.rules.reviveRadius * 2) return
    t.alive = true
    t.hp = Math.min(this.rules.reviveHp, t.maxHp)
    t.x = t.downX; t.y = t.downY
    this.broadcast(Op.PLAYER, { id: t.id, hp: t.hp, alive: true, revived: true, x: t.x, y: t.y })
  }

  // ── run / stage flow ──

  private startRun(now: number): void {
    this.runStart = now
    this.team = { score: 0, kills: 0 }
    this.stagesCleared = 0
    this.summary = null
    this.startStage(Math.min(this.opts.startStage ?? 0, this.data.stages.length - 1), now)
  }

  private startStage(index: number, now: number): void {
    this.stageIndex = index
    this.seed = Math.floor(this.random() * 2 ** 31)
    this.stageT0 = now + this.rules.countdownMs
    const enemies = this.stage.enemies
    this.byId = new Map(enemies.map((e) => [e.id, e]))
    this.lastSpawn = enemies.reduce((t, e) => Math.max(t, e.spawnT), 0)
    this.hp = new Map(enemies.map((e) => [e.id, e.hp]))
    this.dirty.clear(); this.dead.clear(); this.nextShot.clear(); this.pickups.clear(); this.taken.clear()
    this.drops = { powerups: 0, shields: 0, health: 0, n: 0 }
    this.bossHp = null; this.bossTarget = null; this.bossSwapAt = 0
    // Everyone still connected comes back for the new stage
    for (const p of this.members.values()) {
      if (p.connected) { p.alive = true; p.hp = p.maxHp }
      p.budget = this.cap
    }
    this.setPhase('countdown')
  }

  private stageCleared(now: number): void {
    this.stagesCleared++
    this.phaseAt = now + this.rules.stageClearMs
    this.setPhase('stageClear')
  }

  private checkFailed(now: number): void {
    if (!IN_RUN.has(this.phase)) return
    if (![...this.members.values()].some((p) => p.human && p.connected && p.alive)) this.finish('failed', now)
  }

  private finish(result: RunSummary['result'], now: number): void {
    const humans = [...this.members.values()].filter((p) => p.human)
    this.summary = {
      result, stagesCleared: this.stagesCleared, kills: this.team.kills, score: this.team.score,
      timeMs: now - this.runStart, names: humans.map((p) => p.name),
    }
    this.setPhase(result)
  }

  tick(): void {
    const now = this.now()
    const dt = this.lastTick ? Math.min(0.25, (now - this.lastTick) / 1000) : TICK_MS / 1000
    this.lastTick = now
    const cap = this.cap
    for (const p of this.members.values()) p.budget = Math.min(cap, p.budget + cap * dt * this.rules.gameSpeed)

    if (this.phase === 'countdown' && now >= this.stageT0) this.setPhase('playing')
    const T = this.stageTime(now)
    if (this.phase === 'playing') {
      this.enemyFire(T)
      const remaining = this.stage.enemies.some((e) => !this.dead.has(e.id) && T < e.despawnT)
      if (T > this.lastSpawn && !remaining) {
        this.phaseAt = now + this.rules.bossWarningMs
        this.setPhase('bossWarning')
      }
    } else if (this.phase === 'bossWarning' && now >= this.phaseAt) {
      this.bossHp = this.stage.bossHp
      this.setPhase('boss')
    } else if (this.phase === 'stageClear' && now >= this.phaseAt) {
      if (this.stageIndex + 1 < this.data.stages.length) this.startStage(this.stageIndex + 1, now)
      else this.finish('complete', now)
    }
    if (this.phase === 'boss' && now >= this.bossSwapAt) {
      // The boss switches between living players every few seconds
      const targets = [...this.members.values()].filter((p) => p.connected && p.alive).map((p) => p.id)
      const i = this.bossTarget ? targets.indexOf(this.bossTarget) : -1
      this.bossTarget = targets.length ? targets[(i + 1) % targets.length] : null
      this.bossSwapAt = now + this.rules.bossTargetSwapMs
    }

    const bot = this.members.get(BOT_ID)
    if (bot && (this.phase === 'playing' || this.phase === 'boss')) this.botStep(bot, T, dt, now)

    if (this.dirty.size) {
      this.broadcast(Op.ENEMY_HP, { hp: [...this.dirty].map((id) => [id, id === 'boss' ? this.bossHp ?? 0 : this.hp.get(id) ?? 0] as [string, number]) })
      this.dirty.clear()
    }
    if (IN_RUN.has(this.phase)) {
      this.broadcast(Op.STATES, {
        t: now,
        players: [...this.members.values()].map((p) => (p.human ? playerState(p) : { ...playerState(p), t: now })),
        bossTarget: this.phase === 'boss' ? this.bossTarget : null,
        team: { ...this.team },
      })
    }
  }

  /** Aimed volleys: each shooter on its own interval, at a random living player. */
  private enemyFire(T: number): void {
    const targets = [...this.members.values()].filter((p) => p.connected && p.alive)
    if (!targets.length) return
    for (const e of this.stage.enemies) {
      if (e.enterT === null || e.fireInterval <= 0 || !AIMED_SHOTS.has(e.shot)) continue
      if (T < e.enterT || T >= e.despawnT || this.dead.has(e.id)) continue
      let next = this.nextShot.get(e.id)
      if (next === undefined) {
        next = e.enterT + e.fireInterval * (0.5 + 0.5 * this.random())
        this.nextShot.set(e.id, next)
      }
      if (T < next) continue
      this.nextShot.set(e.id, T + e.fireInterval)
      const target = targets[Math.floor(this.random() * targets.length)]
      this.broadcast(Op.AIMED, { id: e.id, target: target.id })
    }
  }

  /** Dev bot: hugs the nearest enemy's column and pours fire into it. */
  private botStep(bot: Member, T: number, dt: number, now: number): void {
    const w = weaponStats(bot.power)
    const dps = (w.damage * w.streams.length * getPlane(bot.plane).damage * 1000) / w.interval
    const dmg = dps * dt * this.rules.gameSpeed
    let tx = 2.5
    if (this.phase === 'boss') {
      tx = 0
      if (Math.abs(bot.x) < 1.5) this.applyHit(bot, 'boss', dmg, now)
    } else {
      const script = scriptById(this.stage.id)
      let best: { id: string; x: number } | null = null
      for (const e of this.stage.enemies) {
        const s = script.get(e.id)
        if (!s || this.dead.has(e.id) || e.enterT === null || T < e.enterT || T >= e.despawnT) continue
        const p = scriptedPos(s, T)
        if (!inWorld(p.x, p.y) || p.y <= bot.y) continue
        if (!best || Math.abs(p.x - bot.x) < Math.abs(best.x - bot.x)) best = { id: e.id, x: p.x }
      }
      if (best) {
        tx = best.x
        if (Math.abs(best.x - bot.x) < 0.8) this.applyHit(bot, best.id, dmg, now)
      }
    }
    const step = 9 * dt
    bot.x = Math.max(-7, Math.min(7, bot.x + Math.max(-step, Math.min(step, tx - bot.x))))
  }

  private phaseInfo(): PhaseInfo {
    return {
      phase: this.phase, stageIndex: this.stageIndex, stages: this.data.stages.length, stageId: this.stage.id,
      seed: this.seed, stageT0: this.stageT0, bossHp: this.bossHp ?? undefined, team: { ...this.team },
      summary: this.summary ?? undefined,
    }
  }

  private setPhase(phase: Phase): void {
    if (this.phase === phase) return
    this.phase = phase
    this.broadcast(Op.PHASE, this.phaseInfo())
  }

  private roster(): void {
    for (const p of this.members.values()) {
      this.broadcast(Op.PLAYER, { id: p.id, name: p.name, plane: p.plane, ready: p.ready, hp: p.hp, alive: p.alive })
    }
  }

  snapshot(): ServerMessages[typeof Op.SNAPSHOT] {
    return {
      ...this.phaseInfo(),
      bossHp: this.bossHp,
      dead: [...this.dead],
      hp: [...this.hp].filter(([id, hp]) => !this.dead.has(id) && hp < (this.byId.get(id)?.hp ?? hp)),
      pickups: [...this.pickups.values()],
      taken: [...this.taken],
      players: [...this.members.values()].map(playerState),
      team: { ...this.team },
    }
  }

  private sendTo<K extends ServerOp>(id: string, op: K, data: ServerMessages[K]): void {
    this.clients.get(id)?.({ op, data } as ServerMessage)
  }

  private broadcast<K extends ServerOp>(op: K, data: ServerMessages[K]): void {
    for (const id of this.clients.keys()) this.sendTo(id, op, data)
  }
}

/**
 * Transport to a LoopbackServer with simulated network: each direction gets `latencyMs / 2` plus
 * up to `jitterMs`, kept in order (like a reliable socket), and payloads go through JSON.
 */
export class LoopbackTransport implements Transport {
  private userId = ''
  private messages = new Listeners<[ServerMessage]>()
  private disconnects = new Listeners<[string]>()
  private upAt = 0
  private downAt = 0

  constructor(
    private server: LoopbackServer,
    private net: { latencyMs: number; jitterMs: number } = { latencyMs: 80, jitterMs: 20 },
    private now: () => number = () => performance.now(),
  ) {}

  async connect(opts: ConnectOptions): Promise<void> {
    this.userId = opts.userId
  }

  private async enter(): Promise<RoomInfo> {
    const ok = this.server.join(this.userId, (m) => this.later('down', () => {
      const wire = parseServer(m.op, encode(m.data))
      if (wire) this.messages.emit(wire)
    }))
    if (!ok) throw new Error('Room is full or the run already started')
    return { roomId: this.server.roomId, selfId: this.userId, code: 'LOOP1' }
  }

  createRoom(): Promise<RoomInfo> { return this.enter() }
  joinRoom(): Promise<RoomInfo> { return this.enter() }
  matchmake(): Promise<RoomInfo> { return this.enter() }

  send<K extends ClientOp>(op: K, data: ClientMessages[K]): void {
    const raw = encode(data)
    this.later('up', () => this.server.receive(this.userId, op, decode<ClientMessages[K]>(raw)))
  }

  onMessage(cb: (msg: ServerMessage) => void): () => void { return this.messages.add(cb) }
  onDisconnect(cb: (reason: string) => void): () => void { return this.disconnects.add(cb) }

  async leave(): Promise<void> {
    this.server.leave(this.userId)
    this.messages.clear()
  }

  private later(dir: 'up' | 'down', fn: () => void): void {
    const { latencyMs, jitterMs } = this.net
    const now = this.now()
    let at = now + latencyMs / 2 + Math.random() * jitterMs
    // In order, like a reliable socket
    if (dir === 'up') at = this.upAt = Math.max(at, this.upAt)
    else at = this.downAt = Math.max(at, this.downAt)
    setTimeout(fn, Math.max(0, at - now))
  }
}
