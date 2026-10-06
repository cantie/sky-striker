/** Global gameplay time scale. 1 = original pace; ~0.55 ≈ 45% slower (Sky Force–calmer). */
export const GAME_SPEED = 0.55

/** Scale a frame delta (seconds) for movement / physics. */
export function gameDt(dt: number): number {
  return dt * GAME_SPEED
}

/** Scale a real-time interval (ms) so fire rates match slowed movement. */
export function gameInterval(ms: number): number {
  return ms / GAME_SPEED
}
