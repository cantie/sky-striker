// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { drainFx } from '../../game/fx/events'
import { bossKilled } from './effects'

describe('boss death', () => {
  it('killing the boss raises one bossDeath event at its spot', () => {
    drainFx()
    bossKilled(3, 9, { mine: false })
    const deaths = drainFx().filter((e) => e.kind === 'bossDeath')
    expect(deaths).toEqual([{ kind: 'bossDeath', x: 3, z: 9 }])
  })
})
