import { GAME_SPEED } from '../speed'

/**
 * Fixed-timestep simulation clock. Gameplay systems register a `step` and run in a fixed order,
 * exactly SIM_HZ times per real second regardless of render rate (60 Hz, 144 Hz or a laggy
 * phone all simulate the same world). Rendering stays in R3F's useFrame.
 */
export const SIM_HZ = 60
/** Real seconds per step. */
export const STEP_REAL = 1 / SIM_HZ
/** Game seconds per step (the world runs at GAME_SPEED). */
export const STEP_GAME = STEP_REAL * GAME_SPEED
/** Never simulate more than this much real time in one frame (tab was hidden, debugger…). */
const MAX_FRAME_REAL = 0.25

/** Step order: earlier numbers run first in every step. */
export const ORDER = {
  scene: 0,     // store timers, waves, scroll
  player: 10,   // movement + own cannon
  enemies: 20,  // spawns, paths, enemy fire, rams
  boss: 30,
  bullets: 40,  // movement + collisions
  pickups: 50,
  coins: 60,
} as const

export interface StepInfo {
  /** Game seconds in this step (STEP_GAME). */
  dt: number
  /** Real seconds in this step (STEP_REAL) — for timers that are defined in real time. */
  realDt: number
  /** Steps run since the clock was reset (start of a run). */
  step: number
}

type System = { order: number; step: (s: StepInfo) => void }
const systems: System[] = []
let accumulator = 0
let steps = 0

/** Register a gameplay step; returns an unregister function. */
export function registerSystem(order: number, step: (s: StepInfo) => void): () => void {
  const sys = { order, step }
  systems.push(sys)
  // Stable sort keeps registration order for systems sharing an order value
  systems.sort((a, b) => a.order - b.order)
  return () => {
    const i = systems.indexOf(sys)
    if (i >= 0) systems.splice(i, 1)
  }
}

function runStep() {
  const info: StepInfo = { dt: STEP_GAME, realDt: STEP_REAL, step: steps }
  for (const s of [...systems]) s.step(info)
  steps++
}

/** Feed real elapsed time; runs as many whole steps as fit. Returns how many ran. */
export function advance(realDt: number): number {
  accumulator += Math.min(Math.max(realDt, 0), MAX_FRAME_REAL)
  let n = 0
  while (accumulator >= STEP_REAL) {
    runStep()
    accumulator -= STEP_REAL
    n++
  }
  return n
}

/**
 * What runs the steps each rendered frame. Single-player: real elapsed time (`advance`).
 * Co-op swaps in a driver that tracks the shared server stage clock instead.
 */
let driver: (realDt: number) => number = advance
export function setFrameDriver(fn: ((realDt: number) => number) | null): void {
  driver = fn ?? advance
}
export const frame = (realDt: number) => driver(realDt)

/** Run exactly `n` steps now (co-op catch-up to the shared stage clock). */
export function runSteps(n: number): void {
  for (let i = 0; i < n; i++) runStep()
}

/** Start of a run: step count and leftover time back to zero. */
export function resetClock(): void {
  accumulator = 0
  steps = 0
}

export const stepCount = () => steps
/** Game seconds simulated since the run started. */
export const simTime = () => steps * STEP_GAME

// Dev-only handle for automated playtests
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __sim: object }).__sim = { stepCount, simTime }
