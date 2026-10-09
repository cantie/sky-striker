import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { EntityManager, Repository } from 'typeorm'
import { PLANE_PRICES } from '../game/rules'
import { PlayerProgress } from './progress.entity'
import { emptyProgress, leaderboardValues, mergeProgress, sanitizeProgress, type SagaProgress } from './progress.logic'

@Injectable()
export class ProgressService {
  constructor(@InjectRepository(PlayerProgress) private readonly rows: Repository<PlayerProgress>) {}

  async get(playerId: number, manager?: EntityManager): Promise<PlayerProgress> {
    const repo = manager?.getRepository(PlayerProgress) ?? this.rows
    const row = await repo.findOne({ where: { playerId }, lock: manager ? { mode: 'pessimistic_write' } : undefined })
    if (row) {
      row.data = sanitizeProgress(row.data)
      return row
    }
    return repo.create({ playerId, data: emptyProgress(), totalScore: 0, sagaStars: 0, goldStarsLifetime: 0 })
  }

  /** Persist a save, refreshing its leaderboard columns. */
  async save(row: PlayerProgress, data: SagaProgress, manager?: EntityManager): Promise<SagaProgress> {
    const repo = manager?.getRepository(PlayerProgress) ?? this.rows
    const values = leaderboardValues(data)
    row.data = data
    row.totalScore = values.totalScore
    row.sagaStars = values.sagaStars
    await repo.save(row)
    return data
  }

  /** Fold a guest save into the account (better of each field). */
  merge(playerId: number, guest: unknown): Promise<SagaProgress> {
    return this.rows.manager.transaction(async (m) => {
      const row = await this.get(playerId, m)
      const merged = mergeProgress(row.data, sanitizeProgress(guest))
      // Guests don't track lifetime stars; their wallet is the best lower bound we have
      row.goldStarsLifetime = Math.max(row.goldStarsLifetime, merged.wallet)
      return this.save(row, merged, m)
    })
  }

  buyPlane(playerId: number, planeId: string): Promise<SagaProgress> {
    const price = PLANE_PRICES[planeId]
    if (price === undefined) throw new BadRequestException('Unknown plane')
    return this.rows.manager.transaction(async (m) => {
      const row = await this.get(playerId, m)
      const p = row.data
      if (p.owned.includes(planeId)) return p
      if (p.wallet < price) throw new BadRequestException('Not enough stars')
      return this.save(row, { ...p, wallet: p.wallet - price, owned: [...p.owned, planeId], plane: planeId }, m)
    })
  }

  selectPlane(playerId: number, planeId: string): Promise<SagaProgress> {
    return this.rows.manager.transaction(async (m) => {
      const row = await this.get(playerId, m)
      if (!row.data.owned.includes(planeId)) throw new BadRequestException('Plane not owned')
      return this.save(row, { ...row.data, plane: planeId }, m)
    })
  }
}
