// Where each effect draws: pool size, height above the play plane and render order. Clouds draw at 10.
// Smoke and debris draw first of all the see-through things, then the floating pickups (PICKUP_LAYERS).
// Rescue survivors stand on the ground below the smoke, so they draw in the see-through pass, after it
// (Pickups.tsx).

export interface PoolLayer { capacity: number; y: number; renderOrder: number; drag: number }

export const POOLS = {
  smoke: { capacity: 256, y: 0.15, renderOrder: -2, drag: 0.8 },
  debris: { capacity: 128, y: 0.2, renderOrder: -1, drag: 2.5 },
  rings: { capacity: 32, y: 0.45, renderOrder: 3, drag: 0 },
  fire: { capacity: 256, y: 0.5, renderOrder: 3, drag: 2.5 },
  sparks: { capacity: 512, y: 0.55, renderOrder: 4, drag: 3 },
} as const satisfies Record<string, PoolLayer>

export type PoolName = keyof typeof POOLS

export const BOLT_LAYER = { y: 0.35, renderOrder: 5 } as const

/**
 * Floating pickups draw in the see-through pass with no depth test, so the tallest trees (which reach
 * above them) never hide one: shadow, then halo and glow, then the piece's parts a hundredth apart from
 * `piece`, then its gloss. Fire, sparks, bolts, clouds and enemy bullets still draw over them.
 */
export const PICKUP_LAYERS = { shadow: 0, halo: 1, piece: 2, gloss: 2.5 } as const

/** Above the clouds, so nothing hides them. */
export const ENEMY_BULLET_LAYERS = {
  rim: { y: 0.3, renderOrder: 20 },
  halo: { y: 0.4, renderOrder: 21 },
  core: { y: 0.75, renderOrder: 22 },
} as const
