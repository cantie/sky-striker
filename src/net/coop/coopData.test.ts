import { describe, expect, it } from 'vitest'
import { STAGES } from '../../game/stages'
import { stageScript } from '../../game/sim/stageScript'
import { getPlane } from '../../game/planes'
import { weaponStats } from '../../game/weapon'
import { buildCoopData, maxDps, scriptedPickupKind, toLua } from './coopData'
// The committed server data, as text (vite ?raw import)
import committedLua from '../../../nakama/modules/skystriker_data.lua?raw'

describe('co-op data', () => {
  const data = buildCoopData()

  it('mirrors the stage scripts', () => {
    expect(data.stages.map((s) => s.id)).toEqual(STAGES.map((s) => s.id))
    const s1 = stageScript(STAGES[0])
    expect(data.stages[0].enemies.map((e) => e.id)).toEqual(s1.map((e) => e.id))
    expect(data.stages[0].enemies[0].hp).toBe(s1[0].hp)
    expect(data.stages[0].bossHp).toBe(STAGES[0].bossHp)
    expect(data.stages[0].waves).toBe(STAGES[0].maxWaves)
  })

  it('is deterministic and versioned by content', () => {
    expect(buildCoopData()).toEqual(data)
    expect(data.version).toMatch(/^[0-9a-f]{8}$/)
    const tweaked = buildCoopData(STAGES.map((s, i) => (i === 0 ? { ...s, bossHp: s.bossHp + 1 } : s)))
    expect(tweaked.version).not.toBe(data.version)
  })

  it('caps damage above any honest plane', () => {
    const w = weaponStats(0)
    const hawk = (w.damage * w.streams.length * getPlane('hawk').damage * 1000) / w.interval
    expect(maxDps()).toBeGreaterThan(hawk)
  })

  it('knows which scripted pickups exist', () => {
    expect(scriptedPickupKind('rescue:start0', 20)).toBe('rescue')
    expect(scriptedPickupKind('rescue:w4', 20)).toBe('rescue')
    expect(scriptedPickupKind('rescue:w5', 20)).toBeNull()
    expect(scriptedPickupKind('rescue:w22', 20)).toBeNull()
    expect(scriptedPickupKind('pod:w8', 20)).toBe('star')
    expect(scriptedPickupKind('pod:w0', 20)).toBeNull()
    expect(scriptedPickupKind('d3', 20)).toBeNull()
  })

  it('emits a Lua chunk', () => {
    const lua = toLua(data)
    expect(lua.startsWith('-- GENERATED')).toBe(true)
    expect(lua).toContain(`version="${data.version}"`)
    expect(lua).toContain('enemies={')
    expect(lua).not.toContain('enterT=nil')
  })

  it('the committed Lua data is up to date (run `npm run gen:coop` after changing stages)', () => {
    expect(committedLua).toContain(`version="${data.version}"`)
  })
})
