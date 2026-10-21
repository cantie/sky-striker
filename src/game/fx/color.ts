import * as THREE from 'three'
import { getPlane } from '../planes'

/**
 * One enemy-bullet look for every biome: dark rim (pops on snow/sand), hot magenta halo
 * (pops on lava/forest/water — a hue no terrain uses) and a white core.
 */
export const ENEMY_BULLET_COLOR = '#ff2bd6'
/** A player bolt's hue stays at least this far from the enemy magenta, so the two never read alike. */
const MIN_HUE_GAP = 45

function hsl(hex: string) {
  const out = { h: 0, s: 0, l: 0 }
  new THREE.Color(hex).getHSL(out, THREE.SRGBColorSpace)
  return out
}

/** Signed hue difference b − a in degrees, in (−180, 180]. */
function hueDelta(a: number, b: number): number {
  const d = ((((b - a) * 360) % 360) + 540) % 360 - 180
  return d === -180 ? 180 : d
}

/** Distance between two colours' hues, 0..180 degrees. */
export function hueDistance(a: string, b: string): number {
  return Math.abs(hueDelta(hsl(a).h, hsl(b).h))
}

/** A plane's flame colour as a bolt colour: kept, unless its hue is near the enemy magenta, then pushed off it. */
export function boltColor(flame: string): string {
  const c = hsl(flame), enemy = hsl(ENEMY_BULLET_COLOR).h
  const d = hueDelta(enemy, c.h)
  if (Math.abs(d) >= MIN_HUE_GAP) return flame
  // One degree past the gap, so rounding to a hex colour cannot pull it back under
  const push = MIN_HUE_GAP + 1
  const h = (enemy * 360 + (d >= 0 ? push : -push) + 360) % 360
  return `#${new THREE.Color().setHSL(h / 360, c.s, c.l, THREE.SRGBColorSpace).getHexString(THREE.SRGBColorSpace)}`
}

/** The bolt colour of a plane: its own bolts, wingmen, nova, and a teammate's ghost bolts. */
export const planeBoltColor = (planeId: string) => boltColor(getPlane(planeId).flame)
