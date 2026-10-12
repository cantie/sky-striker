import type { ClientMessages, ClientOp, ServerMessage } from './protocol'

/**
 * Backend-neutral connection to a co-op room. Nakama (nakamaTransport), the in-browser loopback
 * server (loopbackServer) or any future backend implement this; CoopSession only sees this.
 */
export interface RoomInfo {
  roomId: string
  /** Our player id inside the room. */
  selfId: string
}

export interface ConnectOptions {
  /** Stable id (e.g. Keycloak subject, or a guest id) and display name. */
  userId: string
  name: string
  /** Bearer token for backends that authenticate (Nakama custom auth, …). */
  token?: string
}

export interface MatchmakeOptions {
  stageId: number
  /** Players per room (2 for co-op). */
  size?: number
}

export interface Transport {
  connect(opts: ConnectOptions): Promise<void>
  createRoom(opts: { stageId: number }): Promise<RoomInfo>
  joinRoom(roomId: string): Promise<RoomInfo>
  matchmake(opts: MatchmakeOptions): Promise<RoomInfo>
  send<K extends ClientOp>(op: K, data: ClientMessages[K]): void
  /** Returns an unsubscribe function. */
  onMessage(cb: (msg: ServerMessage) => void): () => void
  onDisconnect(cb: (reason: string) => void): () => void
  leave(): Promise<void>
}

/** Tiny listener set shared by transports. */
export class Listeners<T extends unknown[]> {
  private set = new Set<(...args: T) => void>()
  add(cb: (...args: T) => void): () => void {
    this.set.add(cb)
    return () => this.set.delete(cb)
  }
  emit(...args: T): void {
    for (const cb of [...this.set]) cb(...args)
  }
  clear(): void {
    this.set.clear()
  }
}
