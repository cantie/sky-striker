import { OBJECTIVE_IDS, PLANE_PRICES, STAGE_COUNT, STARTER_PLANE, type ObjectiveId } from '../game/rules'

/** Same shape the client keeps in localStorage (src/game/progress.ts). */
export interface StageProgress {
  highScore: number
  stars: ObjectiveId[]
  cleared: boolean
}

export interface SagaProgress {
  stages: Record<number, StageProgress>
  wallet: number
  owned: string[]
  plane: string
}

export interface RunInput {
  stageId: number
  score: number
  won: boolean
  goldStars: number
  earned: ObjectiveId[]
}

const OBJECTIVES = new Set<string>(OBJECTIVE_IDS)
const nonNegInt = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0)
const validStars = (v: unknown): ObjectiveId[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is ObjectiveId => typeof x === 'string' && OBJECTIVES.has(x)))] : []

export function emptyProgress(): SagaProgress {
  const stages: Record<number, StageProgress> = {}
  for (let id = 1; id <= STAGE_COUNT; id++) stages[id] = { highScore: 0, stars: [], cleared: false }
  return { stages, wallet: 0, owned: [STARTER_PLANE], plane: STARTER_PLANE }
}

/** Coerce anything a client sends into a well-formed save. */
export function sanitizeProgress(input: unknown): SagaProgress {
  const out = emptyProgress()
  if (!input || typeof input !== 'object') return out
  const raw = input as Partial<Record<keyof SagaProgress, unknown>>
  const stages = (raw.stages && typeof raw.stages === 'object' ? raw.stages : {}) as Record<string, unknown>
  for (let id = 1; id <= STAGE_COUNT; id++) {
    const s = stages[id] as Partial<Record<keyof StageProgress, unknown>> | undefined
    if (!s || typeof s !== 'object') continue
    out.stages[id] = { highScore: nonNegInt(s.highScore), stars: validStars(s.stars), cleared: s.cleared === true }
  }
  out.wallet = nonNegInt(raw.wallet)
  const owned = Array.isArray(raw.owned) ? raw.owned.filter((id): id is string => typeof id === 'string' && id in PLANE_PRICES) : []
  out.owned = [...new Set([STARTER_PLANE, ...owned])]
  out.plane = typeof raw.plane === 'string' && out.owned.includes(raw.plane) ? raw.plane : STARTER_PLANE
  return out
}

/**
 * Combine two saves keeping the better of everything (used when a guest logs in).
 * `primary` is the account's save: its selected plane wins, unless it's still on the starter
 * (e.g. a brand-new account), in which case the guest's chosen plane carries over.
 */
export function mergeProgress(primary: SagaProgress, other: SagaProgress): SagaProgress {
  const out = emptyProgress()
  for (let id = 1; id <= STAGE_COUNT; id++) {
    const a = primary.stages[id], b = other.stages[id]
    out.stages[id] = {
      highScore: Math.max(a.highScore, b.highScore),
      stars: [...new Set([...a.stars, ...b.stars])],
      cleared: a.cleared || b.cleared,
    }
  }
  out.wallet = Math.max(primary.wallet, other.wallet)
  out.owned = [...new Set([...primary.owned, ...other.owned])]
  out.plane = primary.plane !== STARTER_PLANE && out.owned.includes(primary.plane) ? primary.plane
    : out.owned.includes(other.plane) ? other.plane : STARTER_PLANE
  return out
}

/** Fold one finished run into the save (mirrors the client's mergeStageResult). */
export function applyRun(progress: SagaProgress, run: RunInput): SagaProgress {
  const prev = progress.stages[run.stageId]
  return {
    ...progress,
    wallet: progress.wallet + run.goldStars,
    stages: {
      ...progress.stages,
      [run.stageId]: {
        highScore: Math.max(prev.highScore, run.score),
        stars: [...new Set([...prev.stars, ...run.earned])],
        cleared: prev.cleared || run.won,
      },
    },
  }
}

export function isStageUnlocked(progress: SagaProgress, stageId: number): boolean {
  return stageId <= 1 || !!progress.stages[stageId - 1]?.cleared
}

/** Denormalised columns the leaderboards sort on. */
export function leaderboardValues(p: SagaProgress): { totalScore: number; sagaStars: number } {
  let totalScore = 0, sagaStars = 0
  for (let id = 1; id <= STAGE_COUNT; id++) {
    totalScore += p.stages[id].highScore
    sagaStars += p.stages[id].stars.length
  }
  return { totalScore, sagaStars }
}
