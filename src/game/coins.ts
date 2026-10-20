import { view } from './world'
import { getPlane } from './planes'

/** A gold star burst out of a destroyed enemy (drawn by components/game/Coins.tsx). */
export type Coin = { x: number; z: number; vx: number; vz: number; spin: number; rot: number; age: number
  /** Caught by this pilot's magnet: homes straight in on them from then on. */
  by: string | null }

/**
 * A pilot who scoops up stars: us (SELF) and, in co-op, each wingmate where we draw them. Stars are
 * local to each screen (nothing is scored for them on the server), so a wingmate's catch just
 * makes the star vanish here, the way it does on their screen.
 */
export interface Catcher { id: string; x: number; z: number; magnet: number }
export const SELF = 'self'

/** Within this range stars are pulled toward the plane. */
export const MAGNET = 3.2
const PICKUP = 0.8
/** Homing speed of a magnetised star (game units / game-second): starts quick, keeps accelerating. */
const HOME_SPEED = 16
const HOME_ACCEL = 40

/** MAGNETAR's skill: far longer reach. */
export const magnetReach = (plane: string) => MAGNET * (getPlane(plane).skill === 'magnet' ? 3 : 1)

/** One sim step for every star; returns how many WE collected. */
export function stepCoins(coins: Coin[], dt: number, groundMove: number, catchers: Catcher[]): number {
  let picked = 0
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i]
    c.age += dt
    let to = c.by === null ? undefined : catchers.find((k) => k.id === c.by)
    // Its pilot went down or left: loose again
    if (!to) c.by = null
    if (!to && c.age > 0.25) {
      // The nearest pilot whose magnet reaches it catches it
      let best = Infinity
      for (const k of catchers) {
        const d = Math.hypot(k.x - c.x, k.z - c.z)
        if (d < k.magnet && d < best) { best = d; to = k }
      }
      if (to) c.by = to.id
    }
    if (to) {
      // Fly straight at the plane with no inertia, so a star can never overshoot, orbit or
      // get flung away — it just keeps closing in until it is collected.
      const dx = to.x - c.x, dz = to.z - c.z
      const d = Math.hypot(dx, dz)
      const move = (HOME_SPEED + HOME_ACCEL * c.age) * dt
      if (move >= d) { c.x = to.x; c.z = to.z }
      else { c.x += (dx / d) * move; c.z += (dz / d) * move }
    } else {
      // Burst slows down; the star then sits on the map and scrolls with it
      const damp = Math.pow(0.04, dt)
      c.vx *= damp
      c.vz *= damp
      c.x += c.vx * dt
      c.z += c.vz * dt - groundMove
    }
    c.rot += c.spin * dt
    const got = catchers.find((k) => Math.hypot(k.x - c.x, k.z - c.z) < PICKUP)
    if (got) {
      coins.splice(i, 1)
      if (got.id === SELF) picked++
      continue
    }
    if (c.z < view.bottom - 1 || Math.abs(c.x) > view.halfW + 3) coins.splice(i, 1)
  }
  return picked
}
