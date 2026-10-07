/** World units scrolled per unit of store scrollOffset — ground, props, clouds and ground units share it. */
export const WORLD_SCROLL = 18

/** World Y where the continuous ground plane sits; props and ground units sit on it. */
export const GROUND_Y = -2.05

/** Player movement bounds (playerY maps to world Z). */
export const BOUNDS = { minX: -7.2, maxX: 7.2, minY: -8.8, maxY: 16.5 }
export const PLAYFIELD_MID_Z = (BOUNDS.minY + BOUNDS.maxY) / 2

/**
 * Visible world rectangle, refreshed every frame by GameScene from the ortho camera
 * (width/height depend on aspect: portrait shows more Z, landscape more X).
 */
export const view = { halfW: 8.3, top: 17.9, bottom: -10.2 }

export function setView(halfW: number, halfH: number) {
  view.halfW = halfW
  view.top = PLAYFIELD_MID_Z + halfH
  view.bottom = PLAYFIELD_MID_Z - halfH
}

/** Spawn/exit lines just outside the visible area. */
export const edges = () => ({
  top: view.top + 1.8,
  bottom: view.bottom - 1.8,
  side: view.halfW + 1.8,
})

/** Enemies only shoot from inside both the screen and the player's playfield. */
export function inFireZone(x: number, y: number): boolean {
  const hw = Math.min(view.halfW, BOUNDS.maxX + 1.1) - 0.4
  return Math.abs(x) < hw && y < Math.min(view.top, BOUNDS.maxY + 1.4) - 0.6 && y > view.bottom + 0.6
}

/** Fully on screen (used to mark an enemy as having entered). */
export function onScreen(x: number, y: number, margin = 0): boolean {
  return Math.abs(x) < view.halfW + margin && y < view.top + margin && y > view.bottom - margin
}
