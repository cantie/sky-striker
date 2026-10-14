import type { PickupType } from '../../store/gameStore'

/**
 * Co-op wire protocol (model C: deterministic world + authoritative events). Messages are JSON;
 * the opcode travels next to them (Nakama match-state op codes, or a field on other transports).
 *
 * The client decides its own position and whether it got hit. The server decides enemy HP and
 * deaths, drops and who picked them up, which way aimed shots go, and the stage phase.
 * Times are server milliseconds (`serverNow()` on the client) unless named otherwise.
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
  /** Living pilot asks to revive a downed wingmate (server checks distance). */
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

/** Our POS rate and the HITS batching window. */
export const POS_HZ = 20
export const HITS_BATCH_MS = 100
/** Teammates are drawn this far in the past, and extrapolated at most this far past their last sample. */
export const INTERP_DELAY_MS = 100
export const MAX_EXTRAPOLATE_MS = 150
/**
 * Fly this close to a downed wingmate to ask for a revive. The server accepts up to
 * `reviveRadius * 2` (1.8 × 2) so a slightly stale position still counts.
 */
export const REVIVE_NEAR = 2.4

export type Phase = 'lobby' | 'countdown' | 'playing' | 'bossWarning' | 'boss' | 'victory' | 'failed'

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
  alive: boolean
}

export interface ClientMessages {
  [Op.POS]: { x: number; y: number; t: number; fire: boolean; power: number; plane: string }
  [Op.HITS]: { hits: Hit[] }
  [Op.GOT_HIT]: { hits: number; hp: number }
  [Op.PICKUP]: { id: string }
  [Op.BOMB]: Record<string, never>
  [Op.READY]: { name: string; plane: string; hp: number }
  [Op.RESYNC]: Record<string, never>
  [Op.PING]: { c: number }
  [Op.REVIVE]: { id: string }
}

export interface ServerMessages {
  [Op.STATES]: { t: number; players: PlayerState[]; bossTarget: string | null }
  [Op.ENEMY_HP]: { hp: [id: string, hp: number][] }
  [Op.ENEMY_DEAD]: { id: string; by: string }
  /** `t` = stage game-seconds when it dropped at (x, z); it has scrolled with the map since. */
  [Op.DROP]: { id: string; type: PickupType; x: number; z: number; t: number }
  [Op.PICKED]: { id: string; by: string; type: PickupType }
  [Op.PLAYER]: { id: string; name?: string; hp: number; alive: boolean; left?: boolean; revived?: boolean; x?: number; y?: number }
  /** `stageT0` = server time at which stage time 0 happens (start of the run). */
  [Op.PHASE]: { phase: Phase; stageId: number; seed: number; stageT0: number; bossHp?: number }
  /** Enemy `id` fires toward `ang` (radians, 0 = +Z), or at player `target` when the server names them. */
  [Op.AIMED]: { id: string; ang?: number; target?: string }
  [Op.SNAPSHOT]: {
    phase: Phase; stageId: number; seed: number; stageT0: number
    dead: string[]; hp: [string, number][]; bossHp: number | null
    pickups: { id: string; type: PickupType; x: number; z: number; t: number }[]
    taken: string[]
    players: PlayerState[]
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

const SERVER_OPS = new Set<number>([Op.STATES, Op.ENEMY_HP, Op.ENEMY_DEAD, Op.DROP, Op.PICKED, Op.PLAYER, Op.PHASE, Op.AIMED, Op.SNAPSHOT, Op.PONG])

/** Type a raw (op, payload) pair from the wire; null for opcodes we don't know. */
export function parseServer(op: number, raw: Uint8Array | string, from?: string): ServerMessage | null {
  if (!SERVER_OPS.has(op)) return null
  return { op, data: decode(raw), from } as ServerMessage
}
