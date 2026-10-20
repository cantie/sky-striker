import { INTERP_DELAY_MS, MAX_EXTRAPOLATE_MS } from './protocol'

export interface Sample { t: number; x: number; y: number }

const KEEP_MS = 1000
/** Recent arrivals the delay is picked from (~2 s of POS). */
const WINDOW = 40
const MARGIN_MS = 10
/** Never further back than this: a wingmate that far behind would look laggy instead. */
export const MAX_DELAY_MS = 300
/** How fast the delay may change per ms: their plane runs at 0.8× while it grows, 1.05× while it shrinks. */
const GROW = 0.2
const SHRINK = 0.05
/** Speed is measured over this much of the drawn path. */
const SPEED_SPAN_MS = 50

/**
 * Snapshot buffer for one remote player. Drawn in the past, between the two samples around that
 * moment; past the newest sample it keeps going along the last velocity for at most
 * MAX_EXTRAPOLATE_MS, then holds.
 *
 * How far back adapts to the path. Each new sample shows how old the newest one had got by the time
 * it arrived (send interval + both network legs + the server tick); the delay follows ~95% of
 * those, so we nearly always draw between real samples instead of guessing and snapping back.
 */
export class InterpolationBuffer {
  private buf: Sample[] = []
  private needs: number[] = []
  private gaps: number[] = []
  private need = 0
  private goal = INTERP_DELAY_MS
  private current = INTERP_DELAY_MS
  private lastAt: number | null = null
  private guessMs = 0
  private totalMs = 0

  /** A sample; `arrived` = our server-clock time when it came in (feeds the delay). */
  push(s: Sample, arrived?: number): void {
    // Late / duplicate packets are dropped; the buffer stays sorted by time
    const last = this.buf[this.buf.length - 1]
    if (last && s.t <= last.t) return
    // A longer silence is a pause (run start, a stall), not network jitter
    if (last && arrived !== undefined && arrived - last.t < KEEP_MS) this.record(arrived - last.t, s.t - last.t)
    this.buf.push(s)
    const cutoff = s.t - KEEP_MS
    while (this.buf.length > 2 && this.buf[1].t < cutoff) this.buf.shift()
  }

  private record(need: number, gap: number): void {
    this.needs.push(need)
    this.gaps.push(gap)
    if (this.needs.length > WINDOW) { this.needs.shift(); this.gaps.shift() }
    const sorted = [...this.needs].sort((a, b) => a - b)
    this.need = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
    this.goal = Math.min(MAX_DELAY_MS, Math.max(INTERP_DELAY_MS, this.need + MARGIN_MS))
  }

  get size(): number {
    return this.buf.length
  }

  latest(): Sample | null {
    return this.buf[this.buf.length - 1] ?? null
  }

  /** The delay the buffer is heading for. */
  target(): number {
    return this.goal
  }

  /** The delay to draw with at `serverNow`: moves toward target() at a bounded rate. */
  delay(serverNow: number): number {
    this.advance(serverNow)
    return this.current
  }

  private advance(serverNow: number): number {
    const dt = this.lastAt === null ? 0 : Math.max(0, serverNow - this.lastAt)
    this.lastAt = serverNow
    if (this.goal > this.current) this.current = Math.min(this.goal, this.current + dt * GROW)
    else this.current = Math.max(this.goal, this.current - dt * SHRINK)
    return dt
  }

  /** Where to draw them at `serverNow` (adaptive delay), and their speed in units per second (for the lean). */
  at(serverNow: number): { x: number; y: number; vx: number; vy: number } | null {
    const dt = this.advance(serverNow)
    const p = this.sample(serverNow, this.current)
    if (!p) return null
    const before = this.sample(serverNow, this.current + SPEED_SPAN_MS)!
    // Diagnostics: share of the last few seconds spent past the newest sample
    const k = Math.exp(-dt / 2000)
    this.guessMs = this.guessMs * k + (serverNow - this.current > this.buf[this.buf.length - 1].t ? dt : 0)
    this.totalMs = this.totalMs * k + dt
    return { ...p, vx: ((p.x - before.x) * 1000) / SPEED_SPAN_MS, vy: ((p.y - before.y) * 1000) / SPEED_SPAN_MS }
  }

  /** Diagnostics: delay now / heading for, ~95th-percentile need, largest gap between samples, share of time guessed. */
  stats(): { delay: number; goal: number; need: number; gap: number; guess: number } {
    return {
      delay: this.current, goal: this.goal, need: this.need, gap: Math.max(0, ...this.gaps),
      guess: this.totalMs > 0 ? this.guessMs / this.totalMs : 0,
    }
  }

  /** Position to draw at server time `serverNow`, `delay` ms in the past. */
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
