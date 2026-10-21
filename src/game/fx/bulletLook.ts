// Drawn sizes of bullets, from their gameplay radius (which is also their hit size). Visual only.

/** A player bolt: a streak `width` across, its tip `front` ahead of the hit point and its tail `back` behind. */
export function boltQuad(radius: number): { width: number; front: number; back: number } {
  return { width: radius * 3, front: radius * 1.2, back: radius * 9 }
}

/** An enemy bullet's layers as diameters: the dark rim, the magenta halo and the white core (today's sizes). */
export function enemyBulletLayers(radius: number): { rim: number; halo: number; core: number } {
  return { rim: radius * 4.2, halo: radius * 2.8, core: radius * 1.35 }
}
