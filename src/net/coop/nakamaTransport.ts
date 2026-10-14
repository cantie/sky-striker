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

/** Must match `modules/skystriker_data.lua` in nakama-cluster (`version=`). */
export const COOP_DATA_VERSION = '2ecb61cf'

const CREATE_RPC = 'skystriker_create_match'
const JOIN_RPC = 'skystriker_join_code'
const FIND_RPC = 'skystriker_find_match'

export class NakamaTransport implements Transport {
  private client: Client | null = null
  private session: Session | null = null
  private socket: Socket | null = null
  private matchId: string | null = null
  private joinMeta: Record<string, string> = {}
  private messages = new Listeners<[ServerMessage]>()
  private disconnects = new Listeners<[string]>()

  constructor(private config: NakamaConfig) {}

  async connect(opts: ConnectOptions): Promise<void> {
    const { Client } = await import('@heroiclabs/nakama-js')
    const { serverKey, host, port, useSSL } = this.config
    this.client = new Client(serverKey, host, port, useSSL)
    this.joinMeta = { name: opts.name, plane: opts.plane || 'hawk', dataVersion: COOP_DATA_VERSION }
    // Custom auth keyed by our own user id (`skystriker-<id>` or `guest:…`). A guest id is
    // refused by Nakama when GUEST_COOP=false. The token lets a before-auth hook verify a login.
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
    const match = await this.need(this.socket).joinMatch(matchId, token, this.joinMeta)
    this.matchId = match.match_id
    return { roomId: match.match_id, selfId: match.self.user_id }
  }

  async createRoom(_opts: { stageId: number }): Promise<RoomInfo> {
    const res = await this.rpc(CREATE_RPC, {})
    if (!res.matchId) throw new Error('skystriker_create_match returned no matchId')
    return { ...(await this.join(res.matchId)), code: res.code }
  }

  async joinRoom(roomId: string): Promise<RoomInfo> {
    // A 5-character code is a room code; anything else is a Nakama match id.
    if (/^[A-Za-z0-9]{5}$/.test(roomId)) {
      const res = await this.rpc(JOIN_RPC, { code: roomId })
      if (res.error || !res.matchId) throw new Error(res.error || 'Room not found')
      return { ...(await this.join(res.matchId)), code: res.code || roomId.toUpperCase() }
    }
    return this.join(roomId)
  }

  async matchmake(_opts: MatchmakeOptions): Promise<RoomInfo> {
    const found = await this.rpc(FIND_RPC, {})
    if (found.error || !found.matchId) throw new Error(found.error || 'No open room')
    return { ...(await this.join(found.matchId)), code: found.code }
  }

  private async rpc(id: string, body: object): Promise<{ matchId?: string; code?: string; error?: string }> {
    const res = await this.need(this.client).rpc(this.need(this.session), id, body)
    const payload = res.payload
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload
    return (data ?? {}) as { matchId?: string; code?: string; error?: string }
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
