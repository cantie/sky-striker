import type { Socket } from '@heroiclabs/nakama-js'
import { encode, parseServer, type ClientMessages, type ClientOp, type ServerMessage } from './protocol'
import { Listeners, type ConnectOptions, type RoomInfo, type Transport } from './transport'
import { nakamaConfig, nakamaRpc, nakamaSession } from './nakamaClient'

/**
 * Transport over the Sky Striker co-op match (nakama/modules/skystriker_coop.lua): rooms come from
 * the skystriker_* RPCs; the join metadata carries our display name, plane and data version.
 */
export class NakamaTransport implements Transport {
  private socket: Socket | null = null
  private matchId: string | null = null
  private playerId = ''
  private meta: Record<string, string> = {}
  private messages = new Listeners<[ServerMessage]>()
  private disconnects = new Listeners<[string]>()

  async connect(opts: ConnectOptions): Promise<void> {
    this.playerId = opts.userId
    this.meta = { name: opts.name, plane: opts.plane ?? 'hawk', dataVersion: opts.dataVersion ?? '' }
    const { client, session } = await nakamaSession(opts.userId)
    const socket = client.createSocket(nakamaConfig().useSSL, false)
    socket.onmatchdata = (d) => {
      const msg = parseServer(d.op_code, d.data, d.presence?.user_id, d.match_id)
      if (msg) this.messages.emit(msg)
    }
    socket.ondisconnect = () => this.disconnects.emit('socket closed')
    await socket.connect(session, true)
    this.socket = socket
  }

  private async join(matchId: string, code: string): Promise<RoomInfo> {
    try {
      const match = await this.need().joinMatch(matchId, undefined, this.meta)
      this.matchId = match.match_id
      return { roomId: match.match_id, selfId: match.self.user_id, code }
    } catch (e) {
      // The match's join_attempt reason, e.g. "Room is full"
      const reason = (e as { message?: string })?.message
      throw new Error(reason || 'Could not join the room')
    }
  }

  private async room(rpc: string, payload: object): Promise<RoomInfo> {
    const r = await nakamaRpc<{ matchId?: string; code?: string; error?: string }>(this.playerId, rpc, payload)
    if (!r.matchId) throw new Error(r.error || 'No room available')
    return this.join(r.matchId, r.code ?? '')
  }

  createRoom(): Promise<RoomInfo> { return this.room('skystriker_create_match', {}) }
  joinRoom(code: string): Promise<RoomInfo> { return this.room('skystriker_join_code', { code }) }
  matchmake(): Promise<RoomInfo> { return this.room('skystriker_find_match', {}) }

  send<K extends ClientOp>(op: K, data: ClientMessages[K]): void {
    if (!this.socket || !this.matchId) return
    void this.socket.sendMatchState(this.matchId, op, encode(data)).catch(() => {})
  }

  onMessage(cb: (msg: ServerMessage) => void): () => void { return this.messages.add(cb) }
  onDisconnect(cb: (reason: string) => void): () => void { return this.disconnects.add(cb) }

  async leave(): Promise<void> {
    const socket = this.socket
    this.socket = null
    if (socket && this.matchId) await socket.leaveMatch(this.matchId).catch(() => {})
    this.matchId = null
    socket?.disconnect(false)
    this.messages.clear()
  }

  private need(): Socket {
    if (!this.socket) throw new Error('NakamaTransport: call connect() first')
    return this.socket
  }
}
