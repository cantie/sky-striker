import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { DROP_TYPES, pickupParts, type Finish } from './shapes'

/** Box around every part of a piece, or of the parts with one finish. */
function box(type: (typeof DROP_TYPES)[number], finish?: Finish) {
  const b = new THREE.Box3()
  for (const p of pickupParts(type)) {
    if (finish && p.finish !== finish) continue
    p.geometry.computeBoundingBox()
    b.union(p.geometry.boundingBox!)
  }
  return b
}
const width = (b: THREE.Box3) => b.max.x - b.min.x

/** Today's flat badge is a disc of radius 0.5; a kill star's outline reaches 0.52. */
const OLD_BADGE = 1
const KILL_STAR = 1.04

describe('pickup pieces', () => {
  it('every drop has a 3D piece, built once and shared', () => {
    for (const t of DROP_TYPES) {
      const parts = pickupParts(t)
      expect(parts.length).toBeGreaterThanOrEqual(1)
      expect(pickupParts(t)).toBe(parts)
      for (const p of parts) expect(p.geometry.getAttribute('position').count).toBeGreaterThan(0)
    }
  })

  it("cost at most 3 draws each (as many as today's badge), outlines painted into the gold", () => {
    for (const t of DROP_TYPES) {
      const parts = pickupParts(t)
      expect(parts.length, t).toBeLessThanOrEqual(3)
      for (const p of parts) expect(p.geometry.getAttribute('color'), t).toBeDefined()
    }
    // The power-up's gold starts with its top feathers' dark outline: drawn first, under the gold
    const gold = pickupParts('powerup').find((p) => p.finish === 'gold')!
    const c = gold.geometry.getAttribute('color')
    expect(c.getX(0) + c.getY(0) + c.getZ(0)).toBeLessThan(0.2)
    expect(c.getX(c.count - 1)).toBe(1)
  })

  it('are about 1.35× today\'s badge; the power-up\'s wings spread wider', () => {
    for (const t of ['health', 'shield', 'star'] as const) {
      const w = width(box(t))
      expect(w, t).toBeGreaterThan(OLD_BADGE * 1.25)
      expect(w, t).toBeLessThan(OLD_BADGE * 1.6)
    }
    const wings = width(box('powerup'))
    expect(wings).toBeGreaterThan(2)
    expect(wings).toBeLessThan(2.6)
  })

  it('the item star is clearly bigger than the stars that kills spray', () => {
    expect(width(box('star'))).toBeGreaterThan(KILL_STAR * 1.25)
  })

  it('emblems stand on top of what they sit on, so none is buried', () => {
    expect(box('powerup', 'white').max.z).toBeGreaterThan(box('powerup', 'red').max.z)
    expect(box('powerup', 'red').max.z).toBeGreaterThan(box('powerup', 'gold').max.z)
    expect(box('health', 'white').max.z).toBeGreaterThan(box('health', 'red').max.z)
    expect(box('shield', 'white').max.z).toBeGreaterThan(box('shield', 'glass').max.z)
  })

  it('are centred, so the pulse and the wobble turn them in place', () => {
    for (const t of DROP_TYPES) {
      const c = box(t).getCenter(new THREE.Vector3())
      expect(Math.abs(c.x), t).toBeLessThan(0.05)
      expect(Math.abs(c.y), t).toBeLessThan(0.08)
    }
  })
})
