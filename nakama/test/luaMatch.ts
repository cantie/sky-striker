import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import fengari from 'fengari'
import { toLua, type CoopData } from '../../src/net/coop/coopData'

const { lua, lauxlib, lualib, to_luastring } = fengari
const here = dirname(fileURLToPath(import.meta.url))
const MODULES = resolve(here, '../modules').replace(/\\/g, '/')
const TEST = here.replace(/\\/g, '/')

export interface Presence { user_id: string; session_id: string; username: string; node: string }
export interface Sent { op: number; data: any; to: string[] | null }
export interface LbRecord { owner_id: string; username: string; score: number; subscore: number; metadata: any }
export interface StorageObj { collection: string; key: string; user_id: string; value: any }

export const presence = (id: string): Presence => ({ user_id: id, session_id: `s-${id}`, username: id, node: 'node1' })

/** Dispatched messages from the harness (empty lists come back as {} through Lua JSON). */
const unwire = (raw: string): Sent[] => {
  const sent = JSON.parse(raw) as { op: number; data: string; to: unknown }[] | Record<string, never>
  return (Array.isArray(sent) ? sent : [])
    .map((s) => ({ op: s.op, data: JSON.parse(s.data), to: Array.isArray(s.to) ? (s.to as string[]) : null }))
}

/** skystriker_coop.lua running in fengari against the mock nakama module (see harness.lua). */
export class LuaMatch {
  private L: any

  constructor(opts: { data?: CoopData } = {}) {
    this.L = lauxlib.luaL_newstate()
    lualib.luaL_openlibs(this.L)
    this.run(`package.path = ${JSON.stringify(`${TEST}/?.lua;${MODULES}/?.lua;`)} .. package.path`)
    this.run('require("harness")')
    if (opts.data) this.call('preload_data', toLua(opts.data))
    this.call('load')
  }

  private run(src: string): void {
    if (lauxlib.luaL_loadstring(this.L, to_luastring(src)) !== lua.LUA_OK || lua.lua_pcall(this.L, 0, 0, 0) !== lua.LUA_OK) {
      const err = lua.lua_tojsstring(this.L, -1)
      lua.lua_pop(this.L, 1)
      throw new Error(err)
    }
  }

  private call(fn: string, ...args: string[]): string {
    const L = this.L
    lua.lua_getglobal(L, to_luastring('H'))
    lua.lua_getfield(L, -1, to_luastring(fn))
    lua.lua_remove(L, -2)
    for (const a of args) lua.lua_pushstring(L, to_luastring(a))
    if (lua.lua_pcall(L, args.length, 1, 0) !== lua.LUA_OK) {
      const err = lua.lua_tojsstring(L, -1)
      lua.lua_pop(L, 1)
      throw new Error(`H.${fn}: ${err}`)
    }
    const out = lua.lua_type(L, -1) === lua.LUA_TSTRING ? lua.lua_tojsstring(L, -1) : ''
    lua.lua_pop(L, 1)
    return out
  }

  setTime(ms: number): void { this.call('set_time', String(ms)) }
  setEnv(env: Record<string, string>): void { this.call('set_env', JSON.stringify(env)) }
  /** The Nakama custom id behind a user (guests: `guest:<hex>`); unset users have none. */
  setCustomId(userId: string, customId: string): void { this.call('set_custom_id', userId, customId) }
  /** Runs the module's before-AuthenticateCustom hook for this custom id. */
  authenticateCustom(customId: string): { ok: boolean; reason?: string } {
    return JSON.parse(this.call('authenticate_custom', customId))
  }
  rpc<T = any>(id: string, userId: string, payload: unknown): T {
    return JSON.parse(this.call('rpc', id, userId, typeof payload === 'string' ? payload : JSON.stringify(payload)) || '{}')
  }
  init(params: Record<string, unknown>, matchId = ''): string { return this.call('init', JSON.stringify(params), matchId) }
  join(p: Presence, meta: Record<string, string>): { ok: boolean; reason?: string } {
    return JSON.parse(this.call('join', JSON.stringify(p), JSON.stringify(meta)))
  }
  leave(p: Presence): void { this.call('leave', JSON.stringify(p)) }
  loop(msgs: { from: Presence; op: number; data: unknown }[]): Sent[] {
    const wire = msgs.map((m) => ({ from: m.from.user_id, op: m.op, data: JSON.stringify(m.data) }))
    return unwire(this.call('loop', JSON.stringify(wire)))
  }
  /** Messages sent outside a tick (join / leave handlers). */
  drain(): Sent[] { return unwire(this.call('drain')) }
  ended(): boolean { return this.call('ended') === 'true' }
  dataSummary(): { version: string; stages: number; enemies: number; maxDps: number } { return JSON.parse(this.call('data_summary')) }
  dump(): { matches: Record<string, { label: string; size: number }>; boards: Record<string, LbRecord[]>; storage: StorageObj[]; logs: string[] } {
    return JSON.parse(this.call('dump'))
  }
}
