import { describe, expect, it } from 'vitest'
import { vehicleParts } from '../components/game/Vehicles'
import { flamePositions } from './flames'
import type { GroundSkin } from './roster'

const near = (got: number[][], want: number[][]) => {
  expect(got).toHaveLength(want.length)
  got.forEach((p, i) => p.forEach((v, k) => expect(v).toBeCloseTo(want[i][k], 6)))
}

describe('flamePositions', () => {
  const dims = { x: 1, y: 0.2, z: 0.9 }

  it("default rule matches today's", () => {
    near(flamePositions(dims, 2, 2), [[-0.32, 0.02, -0.846], [0.32, 0.02, -0.846]])
    near(flamePositions(dims, 2, 1), [[0, 0.02, -0.846]])
    expect(flamePositions(dims, 2, 0)).toEqual([])
  })

  it('nozzles override the rule and the count', () => {
    near(flamePositions(dims, 2, 2, [[0.5, 0, -1]]), [[0.5, 0, -0.9]])
  })
})

describe('vehicleParts', () => {
  const skin: GroundSkin = { vehicle: 'tank', hull: '#000', turret: '#111', accent: '#f00' }

  it('a tank with hull and gun models', () => {
    expect(vehicleParts({ ...skin, hullModel: 'hull', gunModel: 'gun' }, false)).toEqual({ body: 'hull', gun: 'gun', gunY: 0.43 })
  })

  it('a turret with base and gun models', () => {
    expect(vehicleParts({ ...skin, baseModel: 'base', turretGunModel: 'tg' }, true)).toEqual({ body: 'base', gun: 'tg', gunY: 0.45 })
  })

  it('an explicit gunY wins', () => {
    expect(vehicleParts({ ...skin, hullModel: 'hull', gunModel: 'gun', gunY: 0.5 }, false)?.gunY).toBe(0.5)
  })

  it('a missing gun or body falls back to the boxes', () => {
    expect(vehicleParts({ ...skin, hullModel: 'hull' }, false)).toBeNull()
    expect(vehicleParts({ ...skin, gunModel: 'gun' }, false)).toBeNull()
    expect(vehicleParts({ ...skin, hullModel: 'hull', gunModel: 'gun' }, true)).toBeNull()
    expect(vehicleParts(skin, false)).toBeNull()
  })
})
