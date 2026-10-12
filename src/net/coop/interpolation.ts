import { INTERP_DELAY_MS, MAX_EXTRAPOLATE_MS } from './protocol'

export interface Sample { t: number; x: number; y: number }

const KEEP_MS = 1000

/**
 * Snapshot buffer for one remote player. Drawn at `serverNow − INTERP_DELAY_MS`, between the two
 * samples around that moment; past the newest sample it keeps going along the last velocity for
 * at most MAX_EXTRAPOLATE_MS, then holds.
 */
export class InterpolationBuffer {
  private buf: Sample[] = []

  push(s: Sample): void {
    // Late / duplicate packets are dropped; the buffer stays sorted by time
    const last = this.buf[this.buf.length - 1]
    if (last && s.t <= last.t) return
    this.buf.push(s)
    const cutoff = s.t - KEEP_MS
    while (this.buf.length > 2 && this.buf[1].t < cutoff) this.buf.shift()
  }

  get size(): number {
    return this.buf.length
  }

  latest(): Sample | null {
    return this.buf[this.buf.length - 1] ?? null
  }

  /** Position to draw at server time `serverNow`. */
  sample(serverNow: number, delay = INTERP_DELAY_MS): { x: number; y: number } | null {
    const b = this.buf
    if (!b.length) return null
    const t = serverNow - delay
    if (b.length === 1 || t <= b[0].t) return { x: b[0].x, y: b[0].y }
    const last = b[b.length - 1]
    if (t >= last.t) {
      const prev = b[b.length - 2]
      const span = last.t - prev.t
      if (span <= 0) return { x: last.x, y: last.y }
      const ahead = Math.min(t - last.t, MAX_EXTRAPOLATE_MS)
      return {
        x: last.x + ((last.x - prev.x) / span) * ahead,
        y: last.y + ((last.y - prev.y) / span) * ahead,
      }
    }
    // Newest pair whose interval contains t
    let i = b.length - 1
    while (i > 0 && b[i - 1].t > t) i--
    const a = b[i - 1], c = b[i]
    const k = (t - a.t) / (c.t - a.t)
    return { x: a.x + (c.x - a.x) * k, y: a.y + (c.y - a.y) * k }
  }

  clear(): void {
    this.buf = []
  }
}
