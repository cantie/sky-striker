import type { ClientMessages, ClientOp, ServerMessage } from './protocol'

/**
 * Backend-neutral connection to a co-op room. Nakama (nakamaTransport), the in-browser loopback
 * server (loopbackServer) or any future backend implement this; CoopSession only sees this.
 */
export interface RoomInfo {
  roomId: string
  /** Our player id inside the room. */
  selfId: string
  /** Short code friends type to join (uppercase). */
  code?: string
}

export interface ConnectOptions {
  /** Stable id (game account id) and display name. */
  userId: string
  name: string
  /** Sent with the join so the server can refuse a mismatched build. */
  plane?: string
  dataVersion?: string
}

export interface Transport {
  connect(opts: ConnectOptions): Promise<void>
  /** A private room with a code. */
  createRoom(): Promise<RoomInfo>
  /** Join (or rejoin) the room with this code. */
  joinRoom(code: string): Promise<RoomInfo>
  /** Any open public room, or a new public one. */
  matchmake(): Promise<RoomInfo>
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
