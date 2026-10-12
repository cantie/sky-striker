/**
 * What gameplay reports to (and asks of) the co-op session. CoopSession installs these for a co-op
 * run; in single-player they're null, so every call site reads `net()?.…` / `if (net())` and
 * single-player never enters a co-op branch.
 */
export interface NetHooks {
  /** Our bullet hit an enemy (by id) or the boss (`'boss'`). The server owns HP and deaths. */
  hit(target: string, damage: number): void
  /** We touched a pickup; the server decides who gets it (first come, first served). */
  pickup(id: string): void
  /** We lost hull (after shields / i-frames); `hp` is what's left. */
  gotHit(hits: number, hp: number): void
  /** The player the boss is aiming at (server-picked); null → aim at us. */
  bossTarget(): { x: number; y: number } | null
  /**
   * False for enemies / pickups the server already settled (killed / taken) — a client that is
   * catching up on the stage clock must not spawn them again.
   */
  spawnAllowed(id: string): boolean
}

let hooks: NetHooks | null = null

export function setNetHooks(h: NetHooks | null): void {
  hooks = h
}

/** Co-op hooks, or null in single-player. */
export const net = () => hooks
