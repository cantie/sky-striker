import type { Client, Session, Socket } from '@heroiclabs/nakama-js'
import { encode, parseServer, type ClientMessages, type ClientOp, type ServerMessage } from './protocol'
import { Listeners, type ConnectOptions, type MatchmakeOptions, type RoomInfo, type Transport } from './transport'

/**
 * Transport over a Nakama authoritative match. Expected on the server side:
 * - RPC `CREATE_RPC` ({ stageId }) → { matchId } creating the co-op match handler;
 * - a matchmaker_matched hook that creates the same match for matchmaker tickets
 *   (query `+properties.stage:<id>`);
 * - the match handler speaking protocol.ts (it answers PING with PONG using its own clock).
 * nakama-js is loaded on demand, so single-player never downloads it.
 */
export interface NakamaConfig {
  serverKey: string
  host: string
  port: string
  useSSL: boolean
}

const CREATE_RPC = 'create_coop_match'

export class NakamaTransport implements Transport {
  private client: Client | null = null
  private session: Session | null = null
  private socket: Socket | null = null
  private matchId: string | null = null
  private messages = new Listeners<[ServerMessage]>()
  private disconnects = new Listeners<[string]>()

  constructor(private config: NakamaConfig) {}

  async connect(opts: ConnectOptions): Promise<void> {
    const { Client } = await import('@heroiclabs/nakama-js')
    const { serverKey, host, port, useSSL } = this.config
    this.client = new Client(serverKey, host, port, useSSL)
    // Custom auth keyed by our own user id (Keycloak subject or guest id); the token, when
    // present, lets a server-side before-auth hook verify it
    this.session = await this.client.authenticateCustom(opts.userId, true, undefined, opts.token ? { token: opts.token } : undefined)
    this.socket = this.client.createSocket(useSSL, false)
    this.socket.onmatchdata = (d) => {
      const msg = parseServer(d.op_code, d.data, d.presence?.user_id)
      if (msg) this.messages.emit(msg)
    }
    this.socket.ondisconnect = () => this.disconnects.emit('socket closed')
    await this.socket.connect(this.session, true)
  }

  private async join(matchId?: string, token?: string): Promise<RoomInfo> {
    const match = await this.need(this.socket).joinMatch(matchId, token)
    this.matchId = match.match_id
    return { roomId: match.match_id, selfId: match.self.user_id }
  }

  async createRoom(opts: { stageId: number }): Promise<RoomInfo> {
    const res = await this.need(this.client).rpc(this.need(this.session), CREATE_RPC, { stageId: opts.stageId })
    const matchId = (res.payload as { matchId?: string } | undefined)?.matchId
    if (!matchId) throw new Error('create_coop_match returned no matchId')
    return this.join(matchId)
  }

  joinRoom(roomId: string): Promise<RoomInfo> {
    return this.join(roomId)
  }

  async matchmake(opts: MatchmakeOptions): Promise<RoomInfo> {
    const socket = this.need(this.socket)
    const size = opts.size ?? 2
    const matched = new Promise<string>((resolve) => {
      socket.onmatchmakermatched = (m) => resolve(m.token)
    })
    await socket.addMatchmaker(`+properties.stage:${opts.stageId}`, size, size, { stage: String(opts.stageId) })
    return this.join(undefined, await matched)
  }

  send<K extends ClientOp>(op: K, data: ClientMessages[K]): void {
    if (!this.socket || !this.matchId) return
    void this.socket.sendMatchState(this.matchId, op, encode(data))
  }

  onMessage(cb: (msg: ServerMessage) => void): () => void { return this.messages.add(cb) }
  onDisconnect(cb: (reason: string) => void): () => void { return this.disconnects.add(cb) }

  async leave(): Promise<void> {
    if (this.socket && this.matchId) await this.socket.leaveMatch(this.matchId).catch(() => {})
    this.matchId = null
    this.socket?.disconnect(false)
    this.socket = null
    this.messages.clear()
  }

  private need<T>(v: T | null): T {
    if (!v) throw new Error('NakamaTransport: call connect() first')
    return v
  }
}
