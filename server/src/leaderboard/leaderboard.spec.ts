import { rankRows } from './leaderboard'

describe('rankRows', () => {
  it('gives ties the same rank and skips after them', () => {
    const rows = rankRows([
      { playerId: 1, name: 'a', value: 900 },
      { playerId: 2, name: 'b', value: 700 },
      { playerId: 3, name: 'c', value: 700 },
      { playerId: 4, name: 'd', value: 100 },
    ])
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 2, 4])
  })
})
