import { useGameStore } from '../../store/gameStore'
import { ROLE_STATS } from '../../game/roster'
import { getStage } from '../../game/stages'
import { getPlane } from '../../game/planes'
import { ENEMY_BULLET, enemyVolley } from '../../components/game/Enemies'
import { applyPickup, bossKilled, enemyKilled } from '../../components/game/effects'
import type { WorldAdapter } from './coopSession'

/** WorldAdapter over the zustand game store: how server events show up in the running game. */
export function storeWorld(): WorldAdapter {
  const get = useGameStore.getState
  return {
    startRun: (stageId, seed) => get().startGame({ stageId, seed, mode: 'coop' }),

    self: () => {
      const s = get()
      return {
        x: s.playerX, y: s.playerY,
        fire: s.gameState === 'playing' && !s.flyout && s.playerHp > 0,
        power: s.weaponPower, plane: s.progress.plane, hp: s.playerHp,
      }
    },

    enemyHp: (id, hp) => get().setEnemyHp(id, hp),
    bossHp: (hp) => get().setBossHp(hp),

    enemyDead: (id, mine) => {
      const s = get()
      if (id === 'boss') {
        if (s.boss) { bossKilled(s.boss.x, s.boss.y, { mine }); s.defeatBoss() }
        return
      }
      const e = s.enemies.find((x) => x.id === id)
      // Not spawned here yet (we're catching up): spawnAllowed() keeps it from appearing
      if (!e) return
      enemyKilled(e, { mine, rollDrops: false })
      s.removeEnemy(id)
    },

    drop: (id, type, x, z) => get().addPickup({ id, type, x, y: 0.3, z }),

    picked: (id, mine, type) => {
      get().removePickup(id)
      if (mine) applyPickup(type)
    },

    aimed: (id, ang) => {
      const s = get()
      const e = s.enemies.find((x) => x.id === id)
      if (!e || !e.entered || s.gameState !== 'playing') return
      const speed = ENEMY_BULLET.speed * getStage(s.currentStageId).bulletSpeedMult
      enemyVolley(e.x, e.y, ROLE_STATS[e.type].shot, ang, speed)
    },

    phase: (phase, info) => {
      const s = get()
      if (phase === 'bossWarning') useGameStore.setState({ gameState: 'bossWarning' })
      else if (phase === 'boss') {
        if (!s.boss) s.spawnBoss()
        if (info.bossHp) get().setBossHp(info.bossHp)
      } else if (phase === 'victory') {
        // Stages without a boss end when the server says the last wave is over
        if (!getStage(s.currentStageId).hasBoss && s.gameState === 'playing') s.finishStageWin()
      } else if (phase === 'failed') {
        if (s.gameState === 'playing' || s.gameState === 'bossWarning') s.finalizeResults(false)
      }
    },
  }
}

/** Our plane's hull, for READY. */
export const selfHp = () => getPlane(useGameStore.getState().progress.plane).hp
