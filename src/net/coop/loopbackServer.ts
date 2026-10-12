import type { PickupType } from '../../store/gameStore'
import { GAME_SPEED } from '../../game/speed'
import { getStage, type StageConfig } from '../../game/stages'
import { getPlane } from '../../game/planes'
import { weaponStats } from '../../game/weapon'
import { pickDrop } from '../../game/dropRules'
import { inFireZone, inWorld } from '../../game/world'
import { hashSeed, mulberry32, randForSeed } from '../../game/sim/rng'
import { scriptedPos, stageScript, type ScriptedEnemy } from '../../game/sim/stageScript'
import {
  Op, decode, encode, parseServer,
  type ClientMessages, type ClientOp, type Phase, type PlayerState, type ServerMessage, type ServerMessages, type ServerOp,
} from './protocol'
import { Listeners, type ConnectOptions, type RoomInfo, type Transport } from './transport'

/**
 * In-browser stand-in for the authoritative co-op server (what a Nakama match handler would do),
 * plus an optional bot teammate. Owns enemy HP and deaths, drops and pickups, aimed shots and the
 * stage phase, from the same shared stage script the clients simulate.
 */
export interface LoopbackOptions {
  stageId: number
  seed?: number
  /** Add a bot wingmate that flies under enemies and shoots them. */
  bot?: boolean
  countdownMs?: number
  /** Server clock (ms). */
  now?: () => number
}

const TICK_MS = 50
const BOSS_WARNING_MS = 2200
const BOSS_TARGET_SWAP_MS = 6000
const BOT_ID = 'bot'

type Player = PlayerState & { name: string; human: boolean }

export class LoopbackServer {
  readonly roomId = `loopback-${Math.floor(Math.random() * 1e6)}`
  readonly stage: StageConfig
  readonly script: ScriptedEnemy[]
  phase: Phase = 'lobby'
  seed: number
  stageT0 = 0
  private now: () => number
  private players = new Map<string, Player>()
  private clients = new Map<string, (m: ServerMessage) => void>()
  private ready = new Set<string>()
  private byId = new Map<string, ScriptedEnemy>()
  private hp = new Map<string, number>()
  private dirtyHp = new Set<string>()
  private dead = new Set<string>()
  private nextShot = new Map<string, number>()
  private pickups = new Map<string, { type: PickupType; x: number; z: number; t: number }>()
  private taken = new Set<string>()
  private drops = { powerupsDropped: 0, shieldsDropped: 0, n: 0 }
  private dropRng: () => number
  private bossHp: number | null = null
  private bossAt = 0
  private bossTarget: string | null = null
  private bossSwapAt = 0
  private lastWaveEnd: number
  private timer: ReturnType<typeof setInterval> | null = null
  private lastTick = 0

  constructor(private opts: LoopbackOptions) {
    this.now = opts.now ?? (() => performance.now())
    this.stage = getStage(opts.stageId)
    this.seed = (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0
    this.script = stageScript(this.stage)
    for (const e of this.script) { this.byId.set(e.id, e); this.hp.set(e.id, e.hp) }
    this.lastWaveEnd = Math.max(0, ...this.script.map((e) => e.spawnT))
    this.dropRng = mulberry32(hashSeed(this.seed, 'server-drops'))
    if (opts.bot) {
      this.players.set(BOT_ID, {
        id: BOT_ID, name: 'BOT', human: false, x: 2.5, y: -4, t: 0, fire: true, power: 2, plane: 'hawk', hp: 99, alive: true,
      })
    }
  }

  /** Run the server on its own timer (tests call tick() by hand instead). */
  startTimer(): void {
    if (!this.timer) this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  stopTimer(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /** Game seconds since the stage started. */
  stageTime(now = this.now()): number {
    return ((now - this.stageT0) / 1000) * GAME_SPEED
  }

  join(id: string, deliver: (m: ServerMessage) => void): void {
    this.clients.set(id, deliver)
  }

  leave(id: string): void {
    this.clients.delete(id)
    this.players.delete(id)
    this.ready.delete(id)
    this.broadcast(Op.PLAYER, { id, hp: 0, alive: false, left: true })
  }

  // ── client → server ──

  receive<K extends ClientOp>(from: string, op: K, data: ClientMessages[K]): void {
    const now = this.now()
    switch (op) {
      case Op.PING:
        this.sendTo(from, Op.PONG, { c: (data as ClientMessages[typeof Op.PING]).c, s: now })
        break
      case Op.READY: {
        const d = data as ClientMessages[typeof Op.READY]
        this.players.set(from, { id: from, name: d.name, human: true, x: 0, y: -4, t: now, fire: false, power: 0, plane: d.plane, hp: d.hp, alive: true })
        this.ready.add(from)
        for (const p of this.players.values()) this.broadcast(Op.PLAYER, { id: p.id, name: p.name, hp: p.hp, alive: p.alive })
        if (this.phase === 'lobby') {
          const humans = [...this.clients.keys()]
          if (humans.every((h) => this.ready.has(h))) {
            this.stageT0 = now + (this.opts.countdownMs ?? 3000)
            this.setPhase('countdown')
          }
        } else this.sendTo(from, Op.SNAPSHOT, this.snapshot())
        break
      }
      case Op.POS: {
        const p = this.players.get(from)
        if (!p) break
        Object.assign(p, data as ClientMessages[typeof Op.POS])
        break
      }
      case Op.HITS:
        for (const [target, dmg] of (data as ClientMessages[typeof Op.HITS]).hits) this.applyHit(from, target, dmg)
        break
      case Op.GOT_HIT: {
        const p = this.players.get(from)
        if (!p) break
        p.hp = (data as ClientMessages[typeof Op.GOT_HIT]).hp
        p.alive = p.hp > 0
        this.broadcast(Op.PLAYER, { id: p.id, hp: p.hp, alive: p.alive })
        if (![...this.players.values()].some((q) => q.human && q.alive)) this.setPhase('failed')
        break
      }
      case Op.PICKUP: {
        const { id } = data as ClientMessages[typeof Op.PICKUP]
        if (this.taken.has(id)) break
        const type = this.pickups.get(id)?.type ?? (id.startsWith('rescue:') ? 'rescue' : id.startsWith('pod:') ? 'star' : null)
        if (!type) break
        this.taken.add(id)
        this.pickups.delete(id)
        this.broadcast(Op.PICKED, { id, by: from, type })
        break
      }
      case Op.RESYNC:
        this.sendTo(from, Op.SNAPSHOT, this.snapshot())
        break
    }
  }

  private applyHit(from: string, target: string, dmg: number): void {
    if (!(dmg > 0)) return
    const T = this.stageTime()
    if (target === 'boss') {
      if (this.phase !== 'boss' || this.bossHp === null) return
      this.bossHp -= dmg
      this.dirtyHp.add('boss')
      if (this.bossHp <= 0) {
        this.bossHp = 0
        this.broadcast(Op.ENEMY_DEAD, { id: 'boss', by: from })
        this.setPhase('victory')
      }
      return
    }
    const e = this.byId.get(target)
    // Only alive enemies that are actually on screen can be hit
    if (!e || this.dead.has(target) || e.enterT === null || T < e.enterT - 0.2 || T > e.despawnT + 0.5) return
    const hp = (this.hp.get(target) ?? e.hp) - dmg
    this.hp.set(target, hp)
    if (hp > 0) { this.dirtyHp.add(target); return }
    this.dead.add(target)
    this.dirtyHp.delete(target)
    this.broadcast(Op.ENEMY_DEAD, { id: target, by: from })
    const progress = e.wave / Math.max(1, this.stage.maxWaves)
    const type = pickDrop(this.dropRng, { ...this.drops, progress })
    if (type) {
      if (type === 'powerup') this.drops.powerupsDropped++
      if (type === 'shield') this.drops.shieldsDropped++
      const pos = scriptedPos(e, T)
      const drop = { id: `d${this.drops.n++}`, type, x: pos.x, z: pos.y, t: T }
      this.pickups.set(drop.id, drop)
      this.broadcast(Op.DROP, drop)
    }
  }

  // ── simulation ──

  tick(): void {
    const now = this.now()
    const dtReal = this.lastTick ? Math.min(0.25, (now - this.lastTick) / 1000) : TICK_MS / 1000
    this.lastTick = now
    if (this.phase === 'countdown' && now >= this.stageT0) this.setPhase('playing')
    const T = this.stageTime(now)
    const alive = this.aliveEnemies(T)

    if (this.phase === 'playing') {
      this.enemyFire(T, alive)
      const remaining = this.script.some((e) => !this.dead.has(e.id) && T < e.despawnT)
      if (T > this.lastWaveEnd && !remaining) {
        if (this.stage.hasBoss) { this.bossAt = now + BOSS_WARNING_MS; this.setPhase('bossWarning') }
        else this.setPhase('victory')
      }
    } else if (this.phase === 'bossWarning' && now >= this.bossAt) {
      this.bossHp = this.stage.bossHp || 1000
      this.setPhase('boss')
    }
    if (this.phase === 'boss' && now >= this.bossSwapAt) {
      // The boss switches between living players every few seconds
      const targets = [...this.players.values()].filter((p) => p.alive).map((p) => p.id)
      const i = this.bossTarget ? targets.indexOf(this.bossTarget) : -1
      this.bossTarget = targets.length ? targets[(i + 1) % targets.length] : null
      this.bossSwapAt = now + BOSS_TARGET_SWAP_MS
    }

    const bot = this.players.get(BOT_ID)
    if (bot && (this.phase === 'playing' || this.phase === 'boss')) this.botStep(bot, T, alive, dtReal)

    if (this.dirtyHp.size) {
      this.broadcast(Op.ENEMY_HP, { hp: [...this.dirtyHp].map((id) => [id, id === 'boss' ? this.bossHp ?? 0 : this.hp.get(id) ?? 0] as [string, number]) })
      this.dirtyHp.clear()
    }
    if (this.phase !== 'lobby') {
      this.broadcast(Op.STATES, {
        t: now,
        players: [...this.players.values()].map(({ name: _n, human: _h, ...p }) => (p.id === BOT_ID ? { ...p, t: now } : p)),
        bossTarget: this.phase === 'boss' ? this.bossTarget : null,
      })
    }
  }

  private aliveEnemies(T: number): ScriptedEnemy[] {
    return this.script.filter((e) => e.spawnT <= T && T < e.despawnT && !this.dead.has(e.id))
  }

  /** Aimed volleys, on the same schedule the clients' Enemies system uses. */
  private enemyFire(T: number, alive: ScriptedEnemy[]): void {
    const humans = [...this.players.values()].filter((p) => p.alive)
    if (!humans.length) return
    for (const e of alive) {
      if (e.enterT === null || T < e.enterT || e.fireInterval <= 0) continue
      if (e.shot !== 'aimed' && e.shot !== 'spread3' && e.shot !== 'burst2') continue
      let next = this.nextShot.get(e.id)
      if (next === undefined) {
        next = e.enterT - randForSeed(this.seed, `shot:${e.id}`) * 0.5 + e.fireInterval
        this.nextShot.set(e.id, next)
      }
      if (T < next) continue
      const pos = scriptedPos(e, T)
      if (!inFireZone(pos.x, pos.y)) continue
      this.nextShot.set(e.id, T + e.fireInterval)
      const target = humans.reduce((a, b) => (Math.hypot(b.x - pos.x, b.y - pos.y) < Math.hypot(a.x - pos.x, a.y - pos.y) ? b : a))
      this.broadcast(Op.AIMED, { id: e.id, ang: Math.atan2(target.x - pos.x, target.y - pos.y) })
    }
  }

  /** The bot hugs the nearest enemy's column and pours fire into it. */
  private botStep(bot: Player, T: number, alive: ScriptedEnemy[], dtReal: number): void {
    const w = weaponStats(bot.power)
    const dps = (w.damage * w.streams.length * getPlane(bot.plane).damage) / (w.interval / 1000) // per game-second
    const dt = dtReal * GAME_SPEED
    let tx = 2.5
    if (this.phase === 'boss') tx = 0
    else {
      const visible = alive
        .map((e) => ({ e, p: scriptedPos(e, T) }))
        .filter(({ e, p }) => e.enterT !== null && T >= e.enterT && inWorld(p.x, p.y) && p.y > bot.y)
      if (visible.length) {
        const best = visible.reduce((a, b) => (Math.abs(b.p.x - bot.x) < Math.abs(a.p.x - bot.x) ? b : a))
        tx = best.p.x
        if (Math.abs(best.p.x - bot.x) < 0.8) this.applyHit(BOT_ID, best.e.id, dps * dt)
      }
    }
    if (this.phase === 'boss' && Math.abs(bot.x) < 1.5) this.applyHit(BOT_ID, 'boss', dps * dt)
    const step = 9 * dtReal
    bot.x += Math.max(-step, Math.min(step, tx - bot.x))
    bot.x = Math.max(-7, Math.min(7, bot.x))
  }

  private setPhase(phase: Phase): void {
    if (this.phase === phase) return
    this.phase = phase
    this.broadcast(Op.PHASE, {
      phase, stageId: this.opts.stageId, seed: this.seed, stageT0: this.stageT0,
      bossHp: this.bossHp ?? undefined,
    })
  }

  snapshot(): ServerMessages[typeof Op.SNAPSHOT] {
    return {
      phase: this.phase, stageId: this.opts.stageId, seed: this.seed, stageT0: this.stageT0,
      dead: [...this.dead],
      hp: [...this.hp].filter(([id, hp]) => !this.dead.has(id) && hp < (this.byId.get(id)?.hp ?? hp)),
      bossHp: this.bossHp,
      pickups: [...this.pickups].map(([id, p]) => ({ id, ...p })),
      taken: [...this.taken],
      players: [...this.players.values()].map(({ name: _n, human: _h, ...p }) => p),
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
    this.server.join(this.userId, (m) => this.later('down', () => {
      const wire = parseServer(m.op, encode(m.data))
      if (wire) this.messages.emit(wire)
    }))
    return { roomId: this.server.roomId, selfId: this.userId }
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
