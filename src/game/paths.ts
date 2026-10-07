import { edges } from './world'

/**
 * Scripted movement curves. Each returns a playfield position (x, y = world Z) for
 * `t` game-seconds after spawn. Ground paths are relative to the terrain; the caller
 * subtracts how far the ground has scrolled since spawn.
 */
export type AirPath =
  | 'dive' | 'sine' | 'zigzag' | 'swoop' | 'arc' | 'loop' | 'hover'
  | 'cross' | 'spiral' | 'uturn' | 'figure8' | 'pincer' | 'snake'
export type GroundPath = 'drive' | 'driveS' | 'crossGround' | 'static'
export type PathId = AirPath | GroundPath

export interface PathParams {
  /** Anchor X (lane). */
  x: number
  /** Anchor Y offset (hover height for air, row offset for ground). */
  y: number
  /** Mirror: +1 enters from the right-hand world side (+X), −1 from the other. */
  m: 1 | -1
  /** Lateral amplitude. */
  a: number
  /** Speed multiplier. */
  s: number
}

export const GROUND_PATHS: ReadonlySet<PathId> = new Set<PathId>(['drive', 'driveS', 'crossGround', 'static'])

const tri = (t: number) => 2 * Math.abs(2 * (t - Math.floor(t + 0.5))) - 1
const bez = (a: number, b: number, c: number, u: number) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * b + u * u * c
const easeOut = (u: number) => 1 - (1 - u) * (1 - u)

export function pathPos(id: PathId, t: number, p: PathParams): { x: number; y: number } {
  const e = edges()
  const { x, m, a, s } = p
  switch (id) {
    case 'dive':
      return { x: x + Math.sin(t * 1.4) * 0.25, y: e.top - 5.2 * s * t }
    case 'sine':
      return { x: x + a * Math.sin(t * 1.9), y: e.top - 4.4 * s * t }
    case 'snake': {
      // Position-locked S: every unit of a train traces the exact same ribbon
      const y = e.top - 4.8 * s * t
      return { x: x + a * Math.sin((e.top - y) * 0.42), y }
    }
    case 'zigzag':
      return { x: x + a * tri(t * 0.55), y: e.top - 4.6 * s * t }
    case 'swoop': {
      // Enter high on side m, sweep through the middle, exit low on the far side
      const D = 5.5 / s
      const u = t / D
      if (u <= 1) return { x: bez(m * 5, -m * 7, -m * e.side, u), y: bez(e.top, 2, e.bottom + 4, u) }
      return { x: -m * e.side - m * (u - 1) * 6, y: e.bottom + 4 - (u - 1) * 10 }
    }
    case 'arc': {
      // Side-to-side pass dipping toward the middle of the screen
      const D = (2 * e.side) / (6 * s)
      const u = t / D
      return { x: m * (e.side - 2 * e.side * u), y: 15 + p.y - 8 * Math.sin(Math.PI * Math.min(1, Math.max(0, u))) }
    }
    case 'loop': {
      const v = 5 * s, yLoop = 7 + p.y
      const t1 = (e.top - yLoop) / v
      if (t < t1) return { x, y: e.top - v * t }
      const r = 2.3, P = 2.6
      if (t < t1 + P) {
        const ang = ((t - t1) / P) * Math.PI * 2
        return { x: x + m * r * (1 - Math.cos(ang)), y: yLoop - r * Math.sin(ang) }
      }
      return { x, y: yLoop - v * (t - t1 - P) }
    }
    case 'hover': {
      const hy = 11 + p.y, tIn = 2.2 / s, tHold = 6.5
      if (t < tIn) return { x, y: e.top + (hy - e.top) * easeOut(t / tIn) }
      const sway = Math.sin((t - tIn) * 0.9) * 1.6
      if (t < tIn + tHold) return { x: x + sway, y: hy }
      const k = t - tIn - tHold
      return { x: x + sway + m * 5 * k, y: hy + 2.5 * k }
    }
    case 'cross':
      return { x: m * (e.side - 5.5 * s * t), y: 12 + p.y + Math.sin(t * 2) * 0.6 }
    case 'spiral': {
      const w = 2.3 * m
      return { x: x + 2.4 * Math.sin(w * t), y: e.top - 3.4 * s * t + 1.5 * Math.cos(w * t) }
    }
    case 'uturn': {
      // Plunge toward the player, then pull up and leave over the top
      const D = 7 / s
      if (t < D) return { x: x + m * 1.2 * t, y: e.top - (e.top - 1 - p.y) * Math.sin((Math.PI * t) / D) }
      return { x: x + m * 1.2 * t, y: e.top + (t - D) * 5 }
    }
    case 'figure8': {
      const tIn = 2 / s, cy = 10 + p.y
      if (t < tIn) return { x, y: e.top + (cy - e.top) * easeOut(t / tIn) }
      const k = t - tIn
      if (k < 9) return { x: x + a * Math.sin(k * 0.8), y: cy + 1.6 * Math.sin(k * 1.6) }
      return { x: x + a * Math.sin(9 * 0.8), y: cy - (k - 9) * 6 }
    }
    case 'pincer': {
      // Straight diagonal dive from a top corner across the screen
      const v = 5.4 * s
      return { x: m * e.side - m * v * 0.62 * t, y: e.top - v * t }
    }
    // Ground — relative to terrain (caller subtracts ground scroll)
    case 'drive':
      return { x: x + Math.sin(t * 0.5) * 0.35, y: e.top + p.y + 0.9 * s * t }
    case 'driveS':
      return { x: x + a * Math.sin(t * 0.55), y: e.top + p.y + 0.7 * s * t }
    case 'crossGround':
      return { x: m * (e.side - 1.9 * s * t), y: e.top + p.y }
    case 'static':
      return { x, y: e.top + p.y }
  }
}
