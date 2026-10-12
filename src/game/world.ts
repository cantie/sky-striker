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

/**
 * Canonical world frame, identical on every device. The game is always at most 9:16 wide, so the
 * visible width is fixed (8.3) and only the visible height varies (tall phones see more). Enemy
 * spawn/exit edges and "has it entered / left" checks use this frame instead of the local viewport,
 * so two co-op clients put the same enemy in the same place. Half-height 18 covers 19.5:9 phones.
 */
export const WORLD = { halfW: 8.3, top: PLAYFIELD_MID_Z + 18, bottom: PLAYFIELD_MID_Z - 18 }

/** Spawn/exit lines just outside the canonical world frame. */
const EDGES = { top: WORLD.top + 1.8, bottom: WORLD.bottom - 1.8, side: WORLD.halfW + 1.8 }
export const edges = () => EDGES

/** Enemies only shoot from inside the player's playfield (same on every device). */
export function inFireZone(x: number, y: number): boolean {
  const hw = Math.min(WORLD.halfW, BOUNDS.maxX + 1.1) - 0.4
  return Math.abs(x) < hw && y < Math.min(WORLD.top, BOUNDS.maxY + 1.4) - 0.6 && y > Math.max(WORLD.bottom, BOUNDS.minY - 1.4) + 0.6
}

/** Inside the canonical world frame (enemy entered/left checks). */
export function inWorld(x: number, y: number, margin = 0): boolean {
  return Math.abs(x) < WORLD.halfW + margin && y < WORLD.top + margin && y > WORLD.bottom - margin
}

/** Inside this device's visible area (local-only things: bullets, pickups, coins). */
export function onScreen(x: number, y: number, margin = 0): boolean {
  return Math.abs(x) < view.halfW + margin && y < view.top + margin && y > view.bottom - margin
}

/** store.scrollOffset grows by this much per game-millisecond while playing. */
export const SCROLL_PER_GAME_MS = 0.00042
/** Ground units ride the terrain: world units scrolled per game-second. */
export const GROUND_SPEED = SCROLL_PER_GAME_MS * 1000 * WORLD_SCROLL
