import { STAGES, type ObjectiveId } from './stages'
import { PLANES } from './planes'

const GUEST_KEY = 'sky-striker-saga-v1'
/** Guests save under GUEST_KEY; a logged-in account caches its cloud save under its own key. */
let storageKey = GUEST_KEY

export function setProgressScope(accountId: number | null): void {
  storageKey = accountId === null ? GUEST_KEY : `sky-striker-saga-account-${accountId}`
}

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
  /** Gold stars banked from every run — the hangar currency. */
  wallet: number
  /** Unlocked plane ids (the starter is always owned). */
  owned: string[]
  /** Plane flown into the next stage. */
  plane: string
}

function emptyStage(): StageProgress {
  return { highScore: 0, stars: [], cleared: false }
}

function defaultProgress(): SagaProgress {
  const stages: Record<number, StageProgress> = {}
  for (const s of STAGES) stages[s.id] = emptyStage()
  return { stages, wallet: 0, owned: [PLANES[0].id], plane: PLANES[0].id }
}

/** Coerce a stored or server-sent save into a well-formed one. */
export function normalizeProgress(input: unknown): SagaProgress {
  try {
    if (!input || typeof input !== 'object') return defaultProgress()
    const parsed = input as SagaProgress
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
    base.wallet = typeof parsed.wallet === 'number' ? Math.max(0, Math.floor(parsed.wallet)) : 0
    const known = new Set(PLANES.map((p) => p.id))
    base.owned = [...new Set([PLANES[0].id, ...(Array.isArray(parsed.owned) ? parsed.owned : [])])].filter((id) => known.has(id))
    base.plane = base.owned.includes(parsed.plane) ? parsed.plane : PLANES[0].id
    return base
  } catch {
    return defaultProgress()
  }
}

function readKey(key: string): SagaProgress {
  try {
    const raw = localStorage.getItem(key)
    return raw ? normalizeProgress(JSON.parse(raw)) : defaultProgress()
  } catch {
    return defaultProgress()
  }
}

/** Save for the current scope (guest or the logged-in account's cache). */
export function loadProgress(): SagaProgress {
  return readKey(storageKey)
}

/** The guest save on this device, whatever scope is active (merged into an account on login). */
export function loadGuestProgress(): SagaProgress {
  return readKey(GUEST_KEY)
}

export function saveProgress(progress: SagaProgress): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(progress))
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
  /** Gold stars collected during the run (banked win or lose). */
  goldStars: number,
): SagaProgress {
  const prev = progress.stages[stageId] ?? emptyStage()
  const starSet = new Set([...prev.stars, ...earned])
  const next: SagaProgress = {
    ...progress,
    wallet: progress.wallet + Math.max(0, Math.floor(goldStars)),
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

/** Spend wallet stars on a plane; returns null if unaffordable or already owned. */
export function buyPlane(progress: SagaProgress, id: string): SagaProgress | null {
  const plane = PLANES.find((p) => p.id === id)
  if (!plane || progress.owned.includes(id) || progress.wallet < plane.price) return null
  const next = { ...progress, wallet: progress.wallet - plane.price, owned: [...progress.owned, id], plane: id }
  saveProgress(next)
  return next
}

export function choosePlane(progress: SagaProgress, id: string): SagaProgress {
  if (!progress.owned.includes(id)) return progress
  const next = { ...progress, plane: id }
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
