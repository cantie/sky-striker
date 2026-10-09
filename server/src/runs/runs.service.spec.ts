import { BadRequestException } from '@nestjs/common'
import { emptyProgress } from '../progress/progress.logic'
import { validateRun, type RunReport } from './runs.service'

const run = (o: Partial<RunReport> = {}): RunReport => ({
  stageId: 1, score: 1000, won: true, goldStars: 40, earned: ['finish'], planeId: 'hawk', kills: 30, spawned: 50, ...o,
})

describe('validateRun', () => {
  const p = emptyProgress()

  it('accepts a normal run and de-duplicates objectives', () => {
    expect(validateRun(run({ earned: ['finish', 'finish', 'defeatBoss'] }), p)).toEqual(['finish', 'defeatBoss'])
  })

  it.each<[string, Partial<RunReport>]>([
    ['unknown stage', { stageId: 11 }],
    ['locked stage', { stageId: 3 }],
    ['negative score', { score: -1 }],
    ['absurd score', { score: 50_000_000 }],
    ['fractional stars', { goldStars: 1.5 }],
    ['more kills than spawns', { kills: 60 }],
    ['plane not owned', { planeId: 'nova' }],
    ['unknown objective', { earned: ['cheat'] }],
    ['objectives on a loss', { won: false }],
  ])('rejects %s', (_, o) => {
    expect(() => validateRun(run(o), p)).toThrow(BadRequestException)
  })

  it('allows a stage once the previous one is cleared', () => {
    const unlocked = { ...p, stages: { ...p.stages, 2: { ...p.stages[2], cleared: true } } }
    expect(() => validateRun(run({ stageId: 3 }), unlocked)).not.toThrow()
  })
})
