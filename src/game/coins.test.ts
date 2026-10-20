import { describe, expect, it } from 'vitest'
import { MAGNET, SELF, magnetReach, stepCoins, type Catcher, type Coin } from './coins'

const coin = (x: number, z: number, more: Partial<Coin> = {}): Coin =>
  ({ x, z, vx: 0, vz: 0, spin: 0, rot: 0, age: 1, by: null, ...more })
const me = (x: number, z: number): Catcher => ({ id: SELF, x, z, magnet: MAGNET })
const mate = (x: number, z: number, id = 'bob'): Catcher => ({ id, x, z, magnet: MAGNET })
const DT = 1 / 60

describe('gold stars', () => {
  it('a star we touch is ours', () => {
    const coins = [coin(0, -4.5)]
    expect(stepCoins(coins, DT, 0, [me(0, -4)])).toBe(1)
    expect(coins).toEqual([])
  })

  it('a wingmate scoops up a star on our screen too: it vanishes, but it is not ours', () => {
    const coins = [coin(5, 2.3)]
    expect(stepCoins(coins, DT, 0, [me(-5, -4), mate(5, 2)])).toBe(0)
    expect(coins).toEqual([])
  })

  it('a wingmate\'s magnet pulls stars in toward them, not us', () => {
    const coins = [coin(5, 4)]
    stepCoins(coins, DT, 0, [me(-5, -4), mate(5, 2)])
    expect(coins[0].by).toBe('bob')
    expect(coins[0].z).toBeLessThan(4)
    expect(coins[0].x).toBeCloseTo(5)
  })

  it('the nearest pilot in reach catches a loose star', () => {
    const coins = [coin(0, 0)]
    stepCoins(coins, DT, 0, [me(0, -3), mate(0, 2)])
    expect(coins[0].by).toBe('bob')
  })

  it('a star whose wingmate went down drifts with the map again', () => {
    const coins = [coin(5, 4, { by: 'bob' })]
    stepCoins(coins, DT, 0.1, [me(-5, -4)])
    expect(coins[0].by).toBeNull()
    expect(coins[0].z).toBeCloseTo(3.9)
  })

  it('MAGNETAR reaches 3× further', () => {
    expect(magnetReach('magnetar')).toBe(MAGNET * 3)
    expect(magnetReach('hawk')).toBe(MAGNET)
  })
})
