import { describe, expect, it } from 'vitest'
import { createParticles, type ParticleSpec, type RGB } from './particles'
import { bossDeathBursts, explosionBurst, fxShouldStep, hitSparks, missilePuff, muzzleShown, novaRing, rippleSlots, takeNewExplosions, wreckAlive } from './emitters'
import { BOLT_LAYER, ENEMY_BULLET_LAYERS, PICKUP_LAYERS, POOLS } from './layers'
import { drainFx, emitFx, type FxEvent } from './events'

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const WHITE: RGB = [1, 1, 1]
const spec = (o: Partial<ParticleSpec> = {}): ParticleSpec => ({
  x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, size0: 1, size1: 1, color: WHITE, alpha: 1, ...o,
})
/** The x of every live particle, sorted. */
const xs = (p: ReturnType<typeof createParticles>) => Array.from({ length: p.count }, (_, i) => p.pos[i * 3]).sort((a, b) => a - b)

describe('particle pool', () => {
  it('a pool keeps live particles packed and drops them when their life ends', () => {
    const rand = mulberry32(1)
    const p = createParticles(8)
    p.spawn(spec({ x: 1, life: 0.2 + rand() * 0.01 }))
    p.spawn(spec({ x: 2, life: 1 }))
    p.spawn(spec({ x: 3, life: 0.3 }))
    expect(p.count).toBe(3)
    p.step(0.25)
    expect(p.count).toBe(2)
    expect(xs(p)).toEqual([2, 3])
    // Ages run on in place, life stays as spawned
    for (let i = 0; i < p.count; i++) expect(p.misc[i * 4]).toBeCloseTo(0.25, 6)
    p.step(0.1)
    expect(xs(p)).toEqual([2])
    p.step(1)
    expect(p.count).toBe(0)
    p.spawn(spec({ x: 4 }))
    p.clear()
    expect(p.count).toBe(0)
  })

  it('a full pool replaces the oldest particle', () => {
    const rand = mulberry32(2)
    const p = createParticles(3)
    const life = 5 + rand()
    p.spawn(spec({ x: 1, life }))
    p.step(0.1)
    p.spawn(spec({ x: 2, life }))
    p.step(0.1)
    p.spawn(spec({ x: 3, life }))
    p.spawn(spec({ x: 4, life }))
    expect(p.count).toBe(3)
    expect(xs(p)).toEqual([2, 3, 4])
  })

  it('drag slows a particle and gravity pulls it', () => {
    const rand = mulberry32(3)
    const vx = 5 + rand()
    const dragged = createParticles(4, { drag: 2 })
    dragged.spawn(spec({ vx, life: 10 }))
    const free = createParticles(4)
    free.spawn(spec({ vx, life: 10 }))
    for (let i = 0; i < 10; i++) { dragged.step(0.05); free.step(0.05) }
    expect(free.pos[0]).toBeCloseTo(vx * 0.5, 4)
    expect(dragged.pos[0]).toBeGreaterThan(0)
    expect(dragged.pos[0]).toBeLessThan(free.pos[0] * 0.8)

    const falling = createParticles(4, { gravity: -10 })
    falling.spawn(spec({ life: 10 }))
    for (let i = 0; i < 10; i++) falling.step(0.05)
    expect(falling.pos[1]).toBeLessThan(-0.5)
  })

  it('spawn writes colour, alpha, life and sizes where the renderer reads them', () => {
    const p = createParticles(2)
    p.spawn(spec({ x: 1, y: 2, z: 3, life: 0.7, size0: 0.25, size1: 0.8, color: [0.1, 0.2, 0.3], alpha: 0.5 }))
    expect(Array.from(p.pos.slice(0, 3))).toEqual([1, 2, 3])
    expect(Array.from(p.col.slice(0, 4)).map((v) => +v.toFixed(5))).toEqual([0.1, 0.2, 0.3, 0.5])
    expect(Array.from(p.misc.slice(0, 4)).map((v) => +v.toFixed(5))).toEqual([0, 0.7, 0.25, 0.8])
  })
})

describe('emitters', () => {
  const near = (s: ParticleSpec, x: number, z: number, r: number) => Math.hypot(s.x - x, s.z - z) <= r + 1e-9

  it('explosion counts scale with size and stay capped', () => {
    const rand = mulberry32(4)
    for (const scale of [1, 1.6, 3]) {
      const b = explosionBurst(10, -4, scale, rand)
      expect(b.fire.length).toBe(Math.min(18, Math.round(6 * scale)))
      expect(b.sparks.length).toBe(Math.min(40, Math.round(14 * scale)))
      expect(b.debris.length).toBe(Math.min(15, Math.round(5 * scale)))
      expect(b.smoke.length).toBe(Math.min(12, Math.round(4 * scale)))
      expect(b.fire.length).toBeLessThanOrEqual(18)
      expect(b.sparks.length).toBeLessThanOrEqual(40)
      expect(b.debris.length).toBeLessThanOrEqual(15)
      expect(b.smoke.length).toBeLessThanOrEqual(12)
      for (const s of [...b.fire, ...b.sparks, ...b.debris, ...b.smoke]) expect(near(s, 10, -4, 1.2 * scale)).toBe(true)
      for (const s of b.fire) { expect(s.life).toBeGreaterThanOrEqual(0.35); expect(s.life).toBeLessThanOrEqual(0.6) }
      for (const s of b.sparks) { expect(s.life).toBeGreaterThanOrEqual(0.25); expect(s.life).toBeLessThanOrEqual(0.5) }
      for (const s of b.debris) { expect(s.life).toBeGreaterThanOrEqual(0.5); expect(s.life).toBeLessThanOrEqual(0.9) }
      expect(b.ring.size0).toBeCloseTo(0.3, 9)
      expect(b.ring.size1).toBeCloseTo(2.2 * scale, 9)
      expect(b.ring.life).toBeCloseTo(0.35, 9)
      expect([b.ring.x, b.ring.z]).toEqual([10, -4])
    }
  })

  it('smoke outlives fire', () => {
    const rand = mulberry32(5)
    const fire: number[] = [], smoke: number[] = []
    for (let i = 0; i < 20; i++) {
      const b = explosionBurst(0, 0, 1 + rand() * 2, rand)
      fire.push(...b.fire.map((s) => s.life))
      smoke.push(...b.smoke.map((s) => s.life))
    }
    expect(Math.min(...smoke)).toBeGreaterThan(Math.max(...fire))
    for (const l of smoke) { expect(l).toBeGreaterThanOrEqual(1.2); expect(l).toBeLessThanOrEqual(2.0) }
  })

  it('hit sparks: 6 fast sparks in the hit colour and one short flash', () => {
    const rand = mulberry32(6)
    const color: RGB = [0.2, 0.9, 1]
    const out = hitSparks(3, 5, color, rand)
    expect(out.length).toBe(7)
    const flash = out.filter((s) => s.life === 0.08)
    expect(flash.length).toBe(1)
    expect(flash[0].size0).toBeCloseTo(0.6, 9)
    const sparks = out.filter((s) => s !== flash[0])
    for (const s of sparks) {
      const v = Math.hypot(s.vx, s.vz)
      expect(v).toBeGreaterThanOrEqual(4)
      expect(v).toBeLessThanOrEqual(9)
      expect(s.life).toBeGreaterThanOrEqual(0.15)
      expect(s.life).toBeLessThanOrEqual(0.3)
      expect(s.color).toEqual(color)
    }
  })

  it('a missile puff starts behind the missile and grows', () => {
    const rand = mulberry32(7)
    const puff = missilePuff(0, 0, 0, 9, rand)
    expect(puff.z).toBeLessThan(0)
    expect(puff.size0).toBeCloseTo(0.25, 9)
    expect(puff.size1).toBeCloseTo(0.8, 9)
    expect(puff.life).toBeGreaterThanOrEqual(0.6)
    expect(puff.life).toBeLessThanOrEqual(0.9)
    const sideways = missilePuff(0, 0, 4, 0, rand)
    expect(sideways.x).toBeLessThan(0)
  })

  it('a nova ring grows from the ship in its colour', () => {
    const r = novaRing(2, 3, [1, 0.5, 0])
    expect([r.x, r.z]).toEqual([2, 3])
    expect(r.size1).toBeGreaterThan(r.size0)
    expect(r.color).toEqual([1, 0.5, 0])
  })

  it('a boss dies in 7 bursts, the last and biggest at its centre at 1.4 s', () => {
    const rand = mulberry32(8)
    const bursts = bossDeathBursts(4, 20, 3, rand)
    expect(bursts.length).toBe(7)
    const times = bursts.map((b) => b.at)
    expect(times).toEqual([...times].sort((a, b) => a - b))
    for (const b of bursts) {
      expect(b.at).toBeGreaterThanOrEqual(0)
      expect(b.at).toBeLessThanOrEqual(1.4)
      expect(Math.abs(b.x - 4)).toBeLessThanOrEqual(3)
      expect(Math.abs(b.z - 20)).toBeLessThanOrEqual(3)
    }
    const last = bursts[6]
    expect(last).toEqual({ at: 1.4, x: 4, z: 20, scale: 3 })
    for (const b of bursts.slice(0, 6)) {
      expect(b.scale).toBeGreaterThanOrEqual(1)
      expect(b.scale).toBeLessThanOrEqual(1.8)
    }
  })

  it('a wreck ends after 1.5 s, on a stage change or back at the menu', () => {
    const w = { t0: 10, stageId: 4 }
    expect(wreckAlive(w, 10, 4, 'playing')).toBe(true)
    expect(wreckAlive(w, 11.49, 4, 'playing')).toBe(true)
    expect(wreckAlive(w, 11.5, 4, 'playing')).toBe(false)
    // Paused mid-sequence: the renderer clock stops, so the wreck waits
    expect(wreckAlive(w, 10.7, 4, 'paused')).toBe(true)
    expect(wreckAlive(w, 10.7, 5, 'playing')).toBe(false)
    for (const st of ['menu', 'stageSelect', 'briefing', 'results']) expect(wreckAlive(w, 10.7, 4, st)).toBe(false)
  })

  it('the shield shows the newest 4 ripples younger than 0.4 s', () => {
    // At 10: ripple 0 is 0.5 s old and gone; of the 5 young ones (0.25 … 0.05 s), the newest 4 show
    const ripples = [{ x: 0, z: 0, t0: 9.5 }, ...[1, 2, 3, 4, 5].map((i) => ({ x: i, z: -i, t0: 9.7 + i * 0.05 }))]
    const slots = rippleSlots(ripples, 10)
    expect(slots.map((r) => r.x)).toEqual([5, 4, 3, 2])
    expect(slots[0]).toEqual({ x: 5, z: -5, age: expect.closeTo(0.05, 9) })
    for (const r of slots) { expect(r.age).toBeGreaterThanOrEqual(0); expect(r.age).toBeLessThan(0.4) }
    expect(rippleSlots(ripples, 10.5)).toEqual([])
    expect(rippleSlots([], 3)).toEqual([])
  })

  it('the muzzle flash shows only while playing', () => {
    expect(muzzleShown({ gameState: 'playing', muzzleFlash: 0.9 })).toBe(0.9)
    // Frozen mid-volley (the last wave dies, the game pauses or ends): no flash hangs on the guns
    for (const gameState of ['bossWarning', 'paused', 'results', 'menu']) expect(muzzleShown({ gameState, muzzleFlash: 0.9 })).toBe(0)
  })

  it('smoke and debris draw before the pickups', () => {
    expect(POOLS.smoke.renderOrder).toBeLessThan(PICKUP_LAYERS.shadow)
    expect(POOLS.debris.renderOrder).toBeLessThan(PICKUP_LAYERS.shadow)
    for (const k of ['rings', 'fire', 'sparks'] as const) expect(POOLS[k].renderOrder).toBeGreaterThan(POOLS.debris.renderOrder)
  })

  it('a floating pickup draws shadow, halo, its parts, then gloss, all under fire, bolts and enemy bullets', () => {
    expect(PICKUP_LAYERS.halo).toBeGreaterThan(PICKUP_LAYERS.shadow)
    expect(PICKUP_LAYERS.piece).toBeGreaterThan(PICKUP_LAYERS.halo)
    // Room for a piece's parts, a hundredth apart, before the gloss
    expect(PICKUP_LAYERS.gloss).toBeGreaterThanOrEqual(PICKUP_LAYERS.piece + 0.5)
    for (const above of [POOLS.rings, POOLS.fire, POOLS.sparks, BOLT_LAYER, ENEMY_BULLET_LAYERS.rim]) expect(above.renderOrder).toBeGreaterThan(PICKUP_LAYERS.gloss)
  })

  it('effects step only while playing', () => {
    expect(fxShouldStep('playing')).toBe(true)
    for (const s of ['paused', 'menu', 'results', 'bossWarning']) expect(fxShouldStep(s)).toBe(false)
  })

  it('each store explosion starts one burst, and dropped ones are forgotten', () => {
    const seen = new Set<string>()
    const a = { id: 'x1' }, b = { id: 'x2' }
    expect(takeNewExplosions(seen, [a, b])).toEqual([a, b])
    expect(takeNewExplosions(seen, [a, b])).toEqual([])
    const c = { id: 'x3' }
    expect(takeNewExplosions(seen, [b, c])).toEqual([c])
    expect(seen.has('x1')).toBe(false)
    expect(takeNewExplosions(seen, [])).toEqual([])
    expect(seen.size).toBe(0)
  })
})

describe('visual events', () => {
  it('events drain in order and the queue keeps the latest 256', () => {
    drainFx()
    emitFx({ kind: 'hit', x: 1, z: 2, color: '#fff' })
    emitFx({ kind: 'bossDeath', x: 3, z: 4 })
    expect(drainFx()).toEqual([{ kind: 'hit', x: 1, z: 2, color: '#fff' }, { kind: 'bossDeath', x: 3, z: 4 }])
    expect(drainFx()).toEqual([])
    for (let i = 0; i < 300; i++) emitFx({ kind: 'laserHit', x: i, z: 0 })
    const out = drainFx() as Extract<FxEvent, { kind: 'laserHit' }>[]
    expect(out.length).toBe(256)
    expect(out[0].x).toBe(44)
    expect(out[255].x).toBe(299)
  })
})
