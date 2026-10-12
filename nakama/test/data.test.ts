import { describe, expect, it } from 'vitest'
import { buildCoopData } from '../../src/net/coop/coopData'
import { LuaMatch } from './luaMatch'

describe('generated Lua data', () => {
  it('loads in Lua and matches the TS build', () => {
    const data = buildCoopData()
    const m = new LuaMatch()
    const s = m.dataSummary()
    expect(s.version).toBe(data.version)
    expect(s.stages).toBe(data.stages.length)
    expect(s.enemies).toBe(data.stages.reduce((n, st) => n + st.enemies.length, 0))
    expect(s.maxDps).toBeCloseTo(data.maxDps, 3)
  })
})
