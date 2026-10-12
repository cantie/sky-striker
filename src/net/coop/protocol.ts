import type { PickupType } from '../../store/gameStore'

/**
 * Co-op wire protocol (model C: deterministic world + authoritative events). Messages are JSON;
 * the opcode travels next to them (Nakama match-state op codes, or a field on other transports).
 *
 * A run is the whole campaign: stage 1 → last stage, back to back. The client decides its own
 * position and whether it got hit. The server decides enemy HP and deaths, drops and who picked
 * them up, who aimed shots go at, downs and revives, the phase and the team's score.
 * Times are server milliseconds (`serverNow()` on the client) unless named otherwise.
 *
 * Nakama's Lua runtime encodes an empty array as {} — read server arrays through list().
 */
export const Op = {
  // client → server
  POS: 1,
  HITS: 2,
  GOT_HIT: 3,
  PICKUP: 4,
  BOMB: 5,
  READY: 6,
  RESYNC: 7,
  /** Clock sync request (extension of the source protocol). */
  PING: 8,
  /** We finished hovering over a downed teammate's beacon. */
  REVIVE: 9,
  // server → client
  STATES: 100,
  ENEMY_HP: 101,
  ENEMY_DEAD: 102,
  DROP: 103,
  PICKED: 104,
  PLAYER: 105,
  PHASE: 106,
  AIMED: 107,
  SNAPSHOT: 108,
  PONG: 109,
} as const

/** Server tick rate (Hz). */
export const TICK_RATE = 20
/** Our POS rate and the HITS batching window. */
export const POS_HZ = 20
export const HITS_BATCH_MS = 100
/** Teammates are drawn this far in the past, and extrapolated at most this far past their last sample. */
export const INTERP_DELAY_MS = 100
export const MAX_EXTRAPOLATE_MS = 150

export type Phase = 'lobby' | 'countdown' | 'playing' | 'bossWarning' | 'boss' | 'stageClear' | 'complete' | 'failed'
/** Phases of a run in progress (a stage is loaded). */
export const IN_RUN: ReadonlySet<Phase> = new Set<Phase>(['countdown', 'playing', 'bossWarning', 'boss', 'stageClear'])

/** A hit on an enemy id, or `'boss'`. */
export type Hit = [target: string, damage: number]

export interface PlayerState {
  id: string
  x: number
  y: number
  /** Server time of this sample. */
  t: number
  /** Trigger held (their cannon is drawn locally from `power`). */
  fire: boolean
  power: number
  plane: string
  hp: number
  /** False while down (waiting for a revive) or disconnected. */
  alive: boolean
}

export interface TeamStats { score: number; kills: number }

export interface RunSummary {
  result: 'complete' | 'failed'
  stagesCleared: number
  kills: number
  score: number
  /** Real ms from the first countdown to the end. */
  timeMs: number
  names: string[]
}

/** Where the run is. `stageT0` = server time at which this stage's time 0 happens. */
export interface PhaseInfo {
  phase: Phase
  /** 0-based position in the campaign; `stages` = how many there are. */
  stageIndex: number
  stages: number
  stageId: number
  seed: number
  stageT0: number
  bossHp?: number
  team?: TeamStats
  /** Set on complete / failed. */
  summary?: RunSummary
}

/** A server drop: it fell where enemy `enemy` was at stage time `t`, and has scrolled with the map since. */
export interface DropInfo { id: string; type: PickupType; enemy: string; t: number }

export interface ClientMessages {
  [Op.POS]: { x: number; y: number; t: number; fire: boolean; power: number; plane: string }
  [Op.HITS]: { hits: Hit[] }
  [Op.GOT_HIT]: { hits: number; hp: number }
  [Op.PICKUP]: { id: string }
  [Op.BOMB]: Record<string, never>
  [Op.READY]: { name: string; plane: string; hp: number; dataVersion: string }
  [Op.RESYNC]: Record<string, never>
  [Op.PING]: { c: number }
  [Op.REVIVE]: { id: string }
}

export interface ServerMessages {
  [Op.STATES]: { t: number; players: PlayerState[]; bossTarget?: string | null; team: TeamStats }
  [Op.ENEMY_HP]: { hp: [id: string, hp: number][] }
  [Op.ENEMY_DEAD]: { id: string; by: string }
  [Op.DROP]: DropInfo
  [Op.PICKED]: { id: string; by: string; type: PickupType }
  /** Roster (name/plane/ready) and life changes; `x, y` = where they went down / came back. */
  [Op.PLAYER]: { id: string; name?: string; plane?: string; ready?: boolean; hp: number; alive: boolean; left?: boolean; revived?: boolean; x?: number; y?: number }
  [Op.PHASE]: PhaseInfo
  /** Enemy `id` fires its volley at player `target`. */
  [Op.AIMED]: { id: string; target: string }
  [Op.SNAPSHOT]: Omit<PhaseInfo, 'bossHp'> & {
    bossHp?: number | null
    dead: string[]; hp: [string, number][]
    pickups: DropInfo[]
    taken: string[]
    players: PlayerState[]
    team: TeamStats
  }
  [Op.PONG]: { c: number; s: number }
}

export type ClientOp = keyof ClientMessages
export type ServerOp = keyof ServerMessages

export type ServerMessage = { [K in ServerOp]: { op: K; data: ServerMessages[K]; from?: string } }[ServerOp]
export type ClientMessage = { [K in ClientOp]: { op: K; data: ClientMessages[K] } }[ClientOp]

const text = new TextEncoder()
const untext = new TextDecoder()

export const encode = (data: unknown): Uint8Array => text.encode(JSON.stringify(data))

export function decode<T = unknown>(raw: Uint8Array | string): T {
  return JSON.parse(typeof raw === 'string' ? raw : untext.decode(raw)) as T
}

/** An array from the server ({} / missing → []). */
export const list = <T>(v: T[] | Record<string, never> | null | undefined): T[] => (Array.isArray(v) ? v : [])

const SERVER_OPS = new Set<number>([Op.STATES, Op.ENEMY_HP, Op.ENEMY_DEAD, Op.DROP, Op.PICKED, Op.PLAYER, Op.PHASE, Op.AIMED, Op.SNAPSHOT, Op.PONG])

/** Type a raw (op, payload) pair from the wire; null for opcodes we don't know. */
export function parseServer(op: number, raw: Uint8Array | string, from?: string): ServerMessage | null {
  if (!SERVER_OPS.has(op)) return null
  return { op, data: decode(raw), from } as ServerMessage
}
