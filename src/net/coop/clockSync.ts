/**
 * Estimates the server clock from PING/PONG round trips: offset = serverTime + RTT/2 − receiveTime.
 * Keeps the last few samples and trusts the one with the smallest RTT (least queueing noise); the
 * applied offset glides toward it so `serverNow()` never jumps backwards noticeably.
 */
export interface ClockSample { rtt: number; offset: number }

const KEEP = 8
/** How much of the gap to the best estimate is closed per new sample. */
const GLIDE = 0.35
/** Bigger corrections than this are applied at once (first sync, after a stall). */
const SNAP_MS = 250

export class ClockSync {
  private samples: ClockSample[] = []
  private applied: number | null = null

  constructor(private now: () => number = () => performance.now()) {}

  /** A PONG arrived: `c` = our send time echoed back, `s` = server time when it answered. */
  addSample(c: number, s: number, received = this.now()): ClockSample {
    const rtt = Math.max(0, received - c)
    const sample = { rtt, offset: s + rtt / 2 - received }
    this.samples.push(sample)
    if (this.samples.length > KEEP) this.samples.shift()
    const best = this.best()!
    if (this.applied === null || Math.abs(best.offset - this.applied) > SNAP_MS) this.applied = best.offset
    else this.applied += (best.offset - this.applied) * GLIDE
    return sample
  }

  /** Lowest RTT; on a tie the newest (tracks drift). */
  best(): ClockSample | null {
    return this.samples.reduce<ClockSample | null>((a, b) => (!a || b.rtt <= a.rtt ? b : a), null)
  }

  get synced(): boolean {
    return this.applied !== null
  }

  /** Smallest recent round trip (ms). */
  get rtt(): number {
    return this.best()?.rtt ?? 0
  }

  get offset(): number {
    return this.applied ?? 0
  }

  serverNow(): number {
    return this.now() + this.offset
  }

  reset(): void {
    this.samples = []
    this.applied = null
  }
}
