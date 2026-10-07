import { STAGES, type ObjectiveId } from './stages'

const STORAGE_KEY = 'sky-striker-saga-v1'

export interface StageProgress {
  /** Best high score for this stage. */
  highScore: number
  /** Objective ids earned at least once (persisted stars). */
  stars: ObjectiveId[]
  /** Cleared at least once (any finish). */
  cleared: boolean
}

export interface SagaProgress {
  stages: Record<number, StageProgress>
}

function emptyStage(): StageProgress {
  return { highScore: 0, stars: [], cleared: false }
}

function defaultProgress(): SagaProgress {
  const stages: Record<number, StageProgress> = {}
  for (const s of STAGES) stages[s.id] = emptyStage()
  return { stages }
}

export function loadProgress(): SagaProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultProgress()
    const parsed = JSON.parse(raw) as SagaProgress
    const base = defaultProgress()
    for (const s of STAGES) {
      const p = parsed.stages?.[s.id]
      if (p) {
        base.stages[s.id] = {
          highScore: typeof p.highScore === 'number' ? p.highScore : 0,
          stars: Array.isArray(p.stars) ? (p.stars as ObjectiveId[]) : [],
          cleared: !!p.cleared,
        }
      }
    }
    return base
  } catch {
    return defaultProgress()
  }
}

export function saveProgress(progress: SagaProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    /* ignore quota */
  }
}

/** Stage 1 always unlocked; N unlocked if N-1 cleared. */
export function isStageUnlocked(progress: SagaProgress, stageId: number): boolean {
  if (stageId <= 1) return true
  return !!progress.stages[stageId - 1]?.cleared
}

export function mergeStageResult(
  progress: SagaProgress,
  stageId: number,
  score: number,
  earned: ObjectiveId[],
  cleared: boolean,
): SagaProgress {
  const prev = progress.stages[stageId] ?? emptyStage()
  const starSet = new Set([...prev.stars, ...earned])
  const next: SagaProgress = {
    stages: {
      ...progress.stages,
      [stageId]: {
        highScore: Math.max(prev.highScore, score),
        stars: [...starSet],
        cleared: prev.cleared || cleared,
      },
    },
  }
  saveProgress(next)
  return next
}

export function countStars(progress: SagaProgress, stageId: number): number {
  return progress.stages[stageId]?.stars.length ?? 0
}

export function totalStarsPossible(stageId: number): number {
  const s = STAGES.find((x) => x.id === stageId)
  return s?.objectives.length ?? 0
}
