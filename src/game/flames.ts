/**
 * Where an exhaust sits, as fractions of the model's half-extents in the nose +Z frame:
 * [-1, 0, -1] is the left rear corner at mid height. Given per model when the default rule misses.
 */
export type Nozzle = [x: number, y: number, z: number]

/**
 * Engine flame positions for a ship of footprint `dims` (largest side 1) drawn at `size`. Without nozzles:
 * one or two plumes on the tail, as the kit models have always had them.
 */
export function flamePositions(dims: { x: number; y: number; z: number }, size: number, flames: 0 | 1 | 2, nozzles?: Nozzle[]): [number, number, number][] {
  const half = { x: (dims.x * size) / 2, y: (dims.y * size) / 2, z: (dims.z * size) / 2 }
  if (nozzles) return nozzles.map(([x, y, z]) => [x * half.x, y * half.y, z * half.z])
  const tail = -half.z * 0.94
  const spread = dims.x * size * 0.16
  const xs = flames === 2 ? [-spread, spread] : flames === 1 ? [0] : []
  return xs.map((x) => [x, 0.02, tail])
}
