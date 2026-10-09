/**
 * Game facts the server needs to validate saves and results. Mirrors the client:
 * - stages / objectives: src/game/stages.ts
 * - planes and prices:   src/game/planes.ts
 * Keep these in sync when stages or planes change.
 */
export const STAGE_COUNT = 10

export const OBJECTIVE_IDS = ['finish', 'destroy70', 'destroy100', 'defeatBoss', 'untouched', 'collectAll'] as const
export type ObjectiveId = (typeof OBJECTIVE_IDS)[number]

export const PLANE_PRICES: Record<string, number> = {
  hawk: 0,
  magnetar: 150,
  aegis: 300,
  viper: 500,
  hornet: 750,
  titan: 1000,
  spectre: 1400,
  seraph: 1900,
  nova: 2500,
}
export const STARTER_PLANE = 'hawk'

/** Sanity caps for a single run report (generous; they only stop absurd submissions). */
export const MAX_RUN_SCORE = 5_000_000
export const MAX_RUN_GOLD_STARS = 3_000
export const MAX_RUN_UNITS = 2_000
