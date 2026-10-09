import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { MAX_RUN_GOLD_STARS, MAX_RUN_SCORE, MAX_RUN_UNITS, OBJECTIVE_IDS, PLANE_PRICES, STAGE_COUNT, type ObjectiveId } from '../game/rules'
import { ProgressService } from '../progress/progress.service'
import { applyRun, isStageUnlocked, type SagaProgress } from '../progress/progress.logic'
import { Run } from './run.entity'

export interface RunReport {
  stageId: number
  score: number
  won: boolean
  goldStars: number
  earned: string[]
  planeId: string
  kills: number
  spawned: number
}

/** Reject reports that can't come from a real run. Throws BadRequestException. */
export function validateRun(r: RunReport, progress: SagaProgress): ObjectiveId[] {
  const int = (v: number, max: number) => Number.isInteger(v) && v >= 0 && v <= max
  if (!Number.isInteger(r.stageId) || r.stageId < 1 || r.stageId > STAGE_COUNT) throw new BadRequestException('Unknown stage')
  if (!isStageUnlocked(progress, r.stageId)) throw new BadRequestException('Stage is locked')
  if (!int(r.score, MAX_RUN_SCORE)) throw new BadRequestException('Invalid score')
  if (!int(r.goldStars, MAX_RUN_GOLD_STARS)) throw new BadRequestException('Invalid gold stars')
  if (!int(r.kills, MAX_RUN_UNITS) || !int(r.spawned, MAX_RUN_UNITS) || r.kills > r.spawned) throw new BadRequestException('Invalid kill count')
  if (!(r.planeId in PLANE_PRICES) || !progress.owned.includes(r.planeId)) throw new BadRequestException('Invalid plane')
  const valid = new Set<string>(OBJECTIVE_IDS)
  if (r.earned.some((id) => !valid.has(id))) throw new BadRequestException('Invalid objectives')
  // Objective stars are only awarded on a win
  if (!r.won && r.earned.length > 0) throw new BadRequestException('Objectives need a win')
  return [...new Set(r.earned)] as ObjectiveId[]
}

@Injectable()
export class RunsService {
  constructor(
    @InjectRepository(Run) private readonly runs: Repository<Run>,
    private readonly progress: ProgressService,
  ) {}

  /** Record a run and fold it into the cloud save atomically. */
  submit(playerId: number, report: RunReport): Promise<SagaProgress> {
    return this.runs.manager.transaction(async (m) => {
      const row = await this.progress.get(playerId, m)
      const earned = validateRun(report, row.data)
      await m.getRepository(Run).save(m.getRepository(Run).create({
        playerId, stageId: report.stageId, score: report.score, won: report.won, goldStars: report.goldStars,
        objectives: earned, planeId: report.planeId, kills: report.kills, spawned: report.spawned,
      }))
      row.goldStarsLifetime += report.goldStars
      const next = applyRun(row.data, { stageId: report.stageId, score: report.score, won: report.won, goldStars: report.goldStars, earned })
      return this.progress.save(row, next, m)
    })
  }
}
