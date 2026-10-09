import { applyRun, emptyProgress, leaderboardValues, mergeProgress, sanitizeProgress, type SagaProgress } from './progress.logic'

const withStage = (p: SagaProgress, id: number, s: Partial<SagaProgress['stages'][number]>) => ({
  ...p,
  stages: { ...p.stages, [id]: { ...p.stages[id], ...s } },
})

describe('sanitizeProgress', () => {
  it('fills missing stages, drops unknown planes and objectives, clamps numbers', () => {
    const p = sanitizeProgress({
      stages: { 1: { highScore: -5, stars: ['finish', 'bogus'], cleared: true }, 99: { highScore: 9 } },
      wallet: 12.7,
      owned: ['viper', 'ufo'],
      plane: 'ufo',
    })
    expect(Object.keys(p.stages)).toHaveLength(10)
    expect(p.stages[1]).toEqual({ highScore: 0, stars: ['finish'], cleared: true })
    expect(p.stages[99 as number]).toBeUndefined()
    expect(p.wallet).toBe(12)
    expect(p.owned).toEqual(['hawk', 'viper'])
    expect(p.plane).toBe('hawk')
  })

  it('treats garbage as an empty save', () => {
    expect(sanitizeProgress('nope')).toEqual(emptyProgress())
  })
})

describe('mergeProgress', () => {
  it('keeps the better of every field', () => {
    let a = withStage(emptyProgress(), 1, { highScore: 500, stars: ['finish'], cleared: true })
    a = { ...a, wallet: 100, owned: ['hawk', 'viper'], plane: 'viper' }
    let b = withStage(emptyProgress(), 1, { highScore: 900, stars: ['untouched'] })
    b = withStage(b, 2, { highScore: 50, cleared: true })
    b = { ...b, wallet: 40, owned: ['hawk', 'nova'], plane: 'nova' }

    const m = mergeProgress(a, b)
    expect(m.stages[1]).toEqual({ highScore: 900, stars: ['finish', 'untouched'], cleared: true })
    expect(m.stages[2].cleared).toBe(true)
    expect(m.wallet).toBe(100)
    expect(m.owned.sort()).toEqual(['hawk', 'nova', 'viper'])
    // The account's current plane wins
    expect(m.plane).toBe('viper')
  })

  it("takes the guest's plane when the account is still on the starter", () => {
    const fresh = emptyProgress()
    const guest = { ...emptyProgress(), owned: ['hawk', 'viper'], plane: 'viper' }
    expect(mergeProgress(fresh, guest).plane).toBe('viper')
  })
})

describe('applyRun', () => {
  it('banks gold stars, raises the high score and records objectives', () => {
    const start = { ...emptyProgress(), wallet: 10 }
    const next = applyRun(start, { stageId: 1, score: 1234, won: true, goldStars: 55, earned: ['finish', 'defeatBoss'] })
    expect(next.wallet).toBe(65)
    expect(next.stages[1]).toEqual({ highScore: 1234, stars: ['finish', 'defeatBoss'], cleared: true })
  })

  it('never lowers the best score or un-clears a stage', () => {
    const start = withStage(emptyProgress(), 1, { highScore: 5000, cleared: true })
    const next = applyRun(start, { stageId: 1, score: 10, won: false, goldStars: 0, earned: [] })
    expect(next.stages[1]).toEqual({ highScore: 5000, stars: [], cleared: true })
  })
})

describe('leaderboardValues', () => {
  it('sums best scores and objective stars', () => {
    let p = withStage(emptyProgress(), 1, { highScore: 100, stars: ['finish', 'untouched'] })
    p = withStage(p, 3, { highScore: 250, stars: ['finish'] })
    expect(leaderboardValues(p)).toEqual({ totalScore: 350, sagaStars: 3 })
  })
})
