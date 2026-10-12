import { describe, expect, it } from 'vitest'
import { hashSeed, mulberry32, rand, randFor, randForSeed, seedRun } from './rng'
import { advance, registerSystem, resetClock, stepCount } from './clock'
import { stageScript } from './stageScript'
import { STAGES } from '../stages'
import { expandWave } from '../spawns'
import { pickDrop, MAX_POWERUPS } from '../dropRules'

describe('rng', () => {
  it('same seed → same sequence', () => {
    const a = mulberry32(123), b = mulberry32(123)
    const xs = Array.from({ length: 50 }, a)
    expect(Array.from({ length: 50 }, b)).toEqual(xs)
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true)
    expect(Array.from({ length: 50 }, mulberry32(124))).not.toEqual(xs)
  })

  it('streams are independent of each other', () => {
    seedRun(7)
    const drops = [rand('drops'), rand('drops'), rand('drops')]
    seedRun(7)
    rand('coins'); rand('coins'); rand('boss')
    expect([rand('drops'), rand('drops'), rand('drops')]).toEqual(drops)
  })

  it('reseeding restarts every stream', () => {
    seedRun(99)
    const first = [rand('spawn'), rand('spawn')]
    seedRun(99)
    expect([rand('spawn'), rand('spawn')]).toEqual(first)
  })

  it('randFor is a stable per-key value', () => {
    seedRun(5)
    expect(randFor('shot:w1.g0.u2')).toBe(randFor('shot:w1.g0.u2'))
    expect(randFor('shot:w1.g0.u2')).toBe(randForSeed(5, 'shot:w1.g0.u2'))
    expect(randFor('shot:w1.g0.u2')).not.toBe(randFor('shot:w1.g0.u3'))
    expect(hashSeed(1, 'a')).not.toBe(hashSeed(2, 'a'))
  })
})

describe('fixed-step clock', () => {
  it('runs whole steps in order, keeping leftover time', () => {
    resetClock()
    const log: string[] = []
    const offB = registerSystem(20, () => log.push('b'))
    const offA = registerSystem(10, () => log.push('a'))
    expect(advance(1 / 120)).toBe(0)
    expect(advance(1 / 120 + 1e-9)).toBe(1)
    expect(log).toEqual(['a', 'b'])
    expect(advance(0.05)).toBe(3)
    expect(stepCount()).toBe(4)
    offA(); offB()
  })

  it('caps one huge frame', () => {
    resetClock()
    expect(advance(10)).toBe(15)
  })
})

describe('stage script', () => {
  for (const stage of STAGES) {
    it(`stage ${stage.id}: deterministic, unique ids, sane times`, () => {
      const a = stageScript(stage)
      expect(stageScript(stage)).toEqual(a)
      expect(new Set(a.map((e) => e.id)).size).toBe(a.length)
      const total = stage.waves.slice(0, stage.maxWaves).reduce((n, _, w) => n + expandWave(stage, w, 0, false).length, 0)
      expect(a.length).toBe(total)
      for (const e of a) {
        expect(e.spawnT).toBeGreaterThanOrEqual((e.wave * stage.waveInterval) / 1000)
        expect(e.despawnT).toBeGreaterThan(e.spawnT)
        if (e.enterT !== null) expect(e.enterT).toBeGreaterThanOrEqual(e.spawnT)
        expect(e.hp).toBeGreaterThan(0)
      }
      // Practically everything should actually fly onto the screen
      expect(a.filter((e) => e.enterT === null).length).toBeLessThan(a.length * 0.05 + 1)
    })
  }
})

describe('drop rules', () => {
  it('respects the power-up cap', () => {
    const r = mulberry32(1)
    let powerups = 0
    for (let i = 0; i < 5000; i++) {
      const t = pickDrop(r, { powerupsDropped: powerups, shieldsDropped: 9, progress: 1 })
      if (t === 'powerup') powerups++
    }
    expect(powerups).toBe(MAX_POWERUPS)
  })

  it('same random source → same drops', () => {
    const roll = (seed: number) => {
      const r = mulberry32(seed)
      return Array.from({ length: 200 }, () => pickDrop(r, { powerupsDropped: 0, shieldsDropped: 0, progress: 0.5 }))
    }
    expect(roll(3)).toEqual(roll(3))
  })
})
