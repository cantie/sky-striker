import { describe, expect, it } from 'vitest'
import { BOSSES } from './bosses'
import { getPlane } from './planes'
import { stageModels } from './stageModels'
import { getStage } from './stages'

describe('stageModels', () => {
  it('lists the stage skins, the boss and the planes, once each', () => {
    const stage = getStage(1)
    const paths = stageModels(1, ['hawk'])
    for (const role of ['basic', 'fast', 'heavy', 'shooter'] as const) expect(paths).toContain(stage.skins[role].model)
    expect(paths).toContain(BOSSES[stage.boss].model)
    expect(paths).toContain(getPlane('hawk').model)
    expect(new Set(paths).size).toBe(paths.length)
    expect(paths).not.toContain(undefined)
  })

  it('a vehicle boss adds no undefined, and a repeated plane is listed once', () => {
    expect(BOSSES[getStage(2).boss].vehicle).toBeDefined()
    const paths = stageModels(2, ['hawk', 'hawk'])
    expect(paths).not.toContain(undefined)
    expect(paths.filter((p) => p === getPlane('hawk').model)).toHaveLength(1)
  })
})
