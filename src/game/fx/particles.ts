// A fixed pool of visual particles in typed arrays the renderer binds as instanced attributes. Visual only.

/** Linear colour, 0..1 (values above 1 are fine: they glow under bloom). */
export type RGB = [number, number, number]

export interface ParticleSpec {
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  /** Seconds (real time). */
  life: number
  /** Drawn size at birth and at death (a ring's start and end radius). */
  size0: number; size1: number
  color: RGB
  /** Opacity at birth; the material fades it over life. */
  alpha: number
}

export interface Particles {
  readonly capacity: number
  /** Live particles are packed in [0, count). */
  count: number
  /** 3 per particle: x, y, z. */
  pos: Float32Array
  /** 3 per particle: vx, vy, vz (a spark's streak follows it). */
  vel: Float32Array
  /** 4 per particle: r, g, b, alpha0. */
  col: Float32Array
  /** 4 per particle: age, life, size0, size1. */
  misc: Float32Array
  spawn(p: ParticleSpec): void
  step(dt: number): void
  clear(): void
}

/**
 * `drag` decays velocity by exp(−drag·dt) per step; `gravity` is added to vy. A full pool overwrites its
 * oldest particle, so a burst never goes missing, only a fading one.
 */
export function createParticles(capacity: number, opts: { drag?: number; gravity?: number } = {}): Particles {
  const drag = opts.drag ?? 0, gravity = opts.gravity ?? 0
  const pos = new Float32Array(capacity * 3), vel = new Float32Array(capacity * 3)
  const col = new Float32Array(capacity * 4), misc = new Float32Array(capacity * 4)

  const move = (from: number, to: number) => {
    pos.copyWithin(to * 3, from * 3, from * 3 + 3)
    vel.copyWithin(to * 3, from * 3, from * 3 + 3)
    col.copyWithin(to * 4, from * 4, from * 4 + 4)
    misc.copyWithin(to * 4, from * 4, from * 4 + 4)
  }

  const pool: Particles = {
    capacity, count: 0, pos, vel, col, misc,
    spawn(p) {
      let i = pool.count
      if (i < capacity) pool.count++
      else {
        i = 0
        for (let j = 1; j < capacity; j++) if (misc[j * 4] > misc[i * 4]) i = j
      }
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z
      vel[i * 3] = p.vx; vel[i * 3 + 1] = p.vy; vel[i * 3 + 2] = p.vz
      col[i * 4] = p.color[0]; col[i * 4 + 1] = p.color[1]; col[i * 4 + 2] = p.color[2]; col[i * 4 + 3] = p.alpha
      misc[i * 4] = 0; misc[i * 4 + 1] = p.life; misc[i * 4 + 2] = p.size0; misc[i * 4 + 3] = p.size1
    },
    step(dt) {
      const k = drag ? Math.exp(-drag * dt) : 1
      for (let i = 0; i < pool.count;) {
        const age = misc[i * 4] + dt
        if (age >= misc[i * 4 + 1]) {
          // Swap-remove: the last live particle takes this slot, and is stepped next
          const last = --pool.count
          if (i !== last) move(last, i)
          continue
        }
        misc[i * 4] = age
        const v = i * 3
        vel[v + 1] += gravity * dt
        vel[v] *= k; vel[v + 1] *= k; vel[v + 2] *= k
        pos[v] += vel[v] * dt; pos[v + 1] += vel[v + 1] * dt; pos[v + 2] += vel[v + 2] * dt
        i++
      }
    },
    clear() { pool.count = 0 },
  }
  return pool
}
