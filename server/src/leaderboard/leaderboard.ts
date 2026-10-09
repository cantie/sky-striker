import { BadRequestException, Controller, Get, Injectable, Query, UseGuards } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuthGuard, PlayerId } from '../auth/auth.guard'
import { pilotName, Player } from '../players/player.entity'
import { PlayerProgress } from '../progress/progress.entity'

/** Leaderboard criteria → the denormalised column they rank on. */
export const METRICS = {
  score: 'totalScore',
  sagaStars: 'sagaStars',
  goldStars: 'goldStarsLifetime',
} as const
export type Metric = keyof typeof METRICS

export interface LeaderboardRow {
  rank: number
  playerId: number
  name: string
  value: number
}

/** Competition ranking: ties share a rank, the next rank skips (1, 2, 2, 4). */
export function rankRows(rows: { playerId: number; name: string; value: number }[]): LeaderboardRow[] {
  let rank = 0
  return rows.map((r, i) => {
    if (i === 0 || r.value !== rows[i - 1].value) rank = i + 1
    return { rank, ...r }
  })
}

@Injectable()
export class LeaderboardService {
  constructor(@InjectRepository(PlayerProgress) private readonly progress: Repository<PlayerProgress>) {}

  async top(metric: Metric, limit: number): Promise<LeaderboardRow[]> {
    const col = METRICS[metric]
    const raw = await this.progress
      .createQueryBuilder('p')
      .innerJoin(Player, 'pl', 'pl.id = p.playerId')
      .select(['p.playerId AS playerId', `p.${col} AS value`, 'pl.id AS id', 'pl.displayName AS displayName', 'pl.username AS username'])
      .where(`p.${col} > 0`)
      .orderBy(`p.${col}`, 'DESC')
      .addOrderBy('p.updatedAt', 'ASC')
      .limit(limit)
      .getRawMany<{ playerId: number; value: string | number; id: number; displayName: string | null; username: string | null }>()
    return rankRows(raw.map((r) => ({ playerId: Number(r.playerId), name: pilotName(r), value: Number(r.value) })))
  }

  /** The caller's own standing (rank = 1 + players strictly ahead). */
  async mine(metric: Metric, playerId: number): Promise<{ rank: number | null; value: number }> {
    const col = METRICS[metric]
    const row = await this.progress.findOne({ where: { playerId } })
    const value = row ? Number(row[col]) : 0
    if (value <= 0) return { rank: null, value: 0 }
    const ahead = await this.progress.createQueryBuilder('p').where(`p.${col} > :value`, { value }).getCount()
    return { rank: ahead + 1, value }
  }
}

/** Leaderboards are a logged-in feature: top list plus the caller's own standing. */
@Controller('leaderboard')
@UseGuards(AuthGuard)
export class LeaderboardController {
  constructor(private readonly board: LeaderboardService) {}

  @Get()
  async get(@PlayerId() playerId: number, @Query('by') by = 'score', @Query('limit') limitRaw = '50') {
    if (!(by in METRICS)) throw new BadRequestException('Unknown leaderboard')
    const metric = by as Metric
    const limit = Math.min(100, Math.max(1, Number.parseInt(limitRaw, 10) || 50))
    const [rows, me] = await Promise.all([this.board.top(metric, limit), this.board.mine(metric, playerId)])
    return { by: metric, rows, me: { playerId, ...me } }
  }
}
