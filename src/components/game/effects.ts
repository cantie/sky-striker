import { useGameStore, type Enemy, type PickupType } from '../../store/gameStore'
import { BOSS_COINS, ROLE_STATS } from '../../game/roster'
import { rollDrop } from '../../game/drops'
import { BOSS_SCORE, POD_SCORE, RESCUE_SCORE } from '../../game/scoring'
import { sounds } from '../../hooks/useAudio'
import { spawnCoins } from './Coins'

/** Shield length from a shield pickup (real ms). */
export const SHIELD_MS = 8000

/**
 * An enemy went down. Single-player: our bullet killed it (score, combo, drop roll).
 * Co-op: the server said so — everyone gets the explosion and their own star burst, only the
 * killer scores, and drops arrive separately from the server.
 */
export function enemyKilled(e: Enemy, opts: { mine: boolean; rollDrops: boolean }): void {
  const s = useGameStore.getState()
  const role = ROLE_STATS[e.type]
  s.addExplosion(e.x, 0.2, e.y, e.type === 'heavy' || e.type === 'tank' ? 1.6 : 1)
  spawnCoins(e.x, e.y, role.coins)
  if (opts.mine) {
    s.addScore(role.score)
    s.incrementCombo()
    s.recordEnemyKill()
  }
  if (opts.rollDrops) {
    const drop = rollDrop()
    if (drop) s.addPickup({ x: e.x, y: 0.3, z: e.y, type: drop })
  }
}

/** The boss went down at (x, y). */
export function bossKilled(x: number, y: number, opts: { mine: boolean }): void {
  const s = useGameStore.getState()
  s.addExplosion(x, 0.4, y, 3)
  if (opts.mine) s.addScore(BOSS_SCORE)
  spawnCoins(x, y, BOSS_COINS)
}

/** What a collected pickup does for us. */
export function applyPickup(type: PickupType): void {
  const s = useGameStore.getState()
  if (type === 'rescue') { s.addScore(RESCUE_SCORE); s.addStar(); sounds.powerup() }
  else if (type === 'powerup') { s.upgradeWeapon(); sounds.powerup() }
  else if (type === 'health') { s.healPlayer(1); sounds.pickup() }
  else if (type === 'shield') { s.addShield(SHIELD_MS); sounds.pickup() }
  else { s.addStar(); s.addScore(POD_SCORE); sounds.pickup() }
}
