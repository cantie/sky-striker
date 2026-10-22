// Visual-only events from gameplay code to the effects renderer. Nothing here feeds back into the game.

export type FxEvent =
  | { kind: 'hit'; x: number; z: number; color: string }
  | { kind: 'nova'; x: number; z: number; color: string }
  | { kind: 'bossDeath'; x: number; z: number }
  | { kind: 'shieldHit'; x: number; z: number }
  | { kind: 'laserHit'; x: number; z: number }

const MAX_QUEUED = 256
let queue: FxEvent[] = []

/** Queue an event for the next frame. When nothing drains (no renderer mounted), the oldest are dropped. */
export function emitFx(e: FxEvent): void {
  queue.push(e)
  if (queue.length > MAX_QUEUED) queue.splice(0, queue.length - MAX_QUEUED)
}

/** Every queued event, oldest first; the queue is left empty. */
export function drainFx(): FxEvent[] {
  const out = queue
  queue = []
  return out
}
