// Where each effect draws: pool size, height above the play plane and render order. Clouds draw at 10.
// Smoke and debris draw first of all the see-through things (pickups' discs and halos are at 0), and the
// floating pickups and stars (y ≈ 0.6) cover them by depth. Rescue survivors stand on the ground below
// the smoke, so they draw in the see-through pass, after it (Pickups.tsx).

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

/** Above the clouds, so nothing hides them. */
export const ENEMY_BULLET_LAYERS = {
  rim: { y: 0.3, renderOrder: 20 },
  halo: { y: 0.4, renderOrder: 21 },
  core: { y: 0.75, renderOrder: 22 },
} as const
