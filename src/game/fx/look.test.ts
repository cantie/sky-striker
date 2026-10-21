import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { getPlane, PLANES } from '../planes'
import { boltQuad, enemyBulletLayers } from './bulletLook'
import { boltColor, ENEMY_BULLET_COLOR, hueDistance, planeBoltColor } from './color'

const hue = (hex: string) => {
  const hsl = { h: 0, s: 0, l: 0 }
  new THREE.Color(hex).getHSL(hsl, THREE.SRGBColorSpace)
  return hsl.h * 360
}

describe('bolt colours', () => {
  it("every plane's bolts stay at least 45° of hue from enemy magenta", () => {
    for (const p of PLANES) expect(hueDistance(boltColor(p.flame), ENEMY_BULLET_COLOR)).toBeGreaterThanOrEqual(45)
  })

  it('a colour already far from magenta is kept', () => {
    expect(boltColor('#3fd4ff')).toBe('#3fd4ff')
  })

  it("a teammate's bolts take their own plane's colour", () => {
    expect(planeBoltColor('nova')).toBe(boltColor(getPlane('nova').flame))
    expect(planeBoltColor('nova')).not.toBe(planeBoltColor('hawk'))
  })

  it('NOVA and MAGNETAR are pushed off magenta', () => {
    const nova = boltColor('#ff6aa8')
    expect(nova).not.toBe('#ff6aa8')
    const h = hue(nova)
    expect(h >= 350 || h <= 10).toBe(true)
    expect(hue(boltColor('#c07aff'))).toBeLessThan(270)
  })
})

describe('bullet draw sizes', () => {
  it('drawn bolts follow radius: never thinner than today, tip near the hit point', () => {
    const small = boltQuad(0.1), big = boltQuad(0.205)
    for (const [r, q] of [[0.1, small], [0.205, big]] as const) {
      expect(q.width).toBeGreaterThanOrEqual(2.2 * r)
      expect(q.front).toBeLessThanOrEqual(1.5 * r)
    }
    expect(big.width).toBeGreaterThan(small.width)
    expect(big.back).toBeGreaterThan(small.back)
  })

  it('enemy bullets are never drawn smaller than today', () => {
    const l = enemyBulletLayers(0.13)
    expect(l.rim).toBeCloseTo(0.546, 9)
    expect(l.halo).toBeCloseTo(0.364, 9)
    expect(l.core).toBeCloseTo(0.1755, 9)
  })
})
