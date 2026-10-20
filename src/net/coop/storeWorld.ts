import { useGameStore } from '../../store/gameStore'
import { ROLE_STATS } from '../../game/roster'
import { getStage } from '../../game/stages'
import { getPlane } from '../../game/planes'
import { inFireZone } from '../../game/world'
import { ENEMY_BULLET, enemyVolley } from '../../components/game/Enemies'
import { applyPickup, bossKilled, enemyKilled } from '../../components/game/effects'
import { setCoopError } from './coopError'
import type { WorldAdapter } from './coopSession'

/** WorldAdapter over the zustand game store: how server events show up in the running game. */
export function storeWorld(): WorldAdapter {
  const get = useGameStore.getState
  return {
    startStage: ({ stageId, seed, stageIndex }) => {
      // Each pilot keeps their gun through the run; the first stage starts from scratch
      useGameStore.setState({ carryWeapon: stageIndex > 0 ? get().weaponPower : 0, coopStageIndex: stageIndex })
      get().startGame({ stageId, seed, mode: 'coop' })
    },

    self: () => {
      const s = get()
      return {
        x: s.playerX, y: s.playerY,
        fire: s.gameState === 'playing' && !s.flyout && !s.down && s.playerHp > 0,
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

    aimed: (id, at) => {
      const s = get()
      const e = s.enemies.find((x) => x.id === id)
      // Same rule as a local shot: only from inside the playfield
      if (!e || !e.entered || s.gameState !== 'playing' || !inFireZone(e.x, e.y)) return
      const speed = ENEMY_BULLET.speed * getStage(s.currentStageId).bulletSpeedMult
      enemyVolley(e.x, e.y, ROLE_STATS[e.type].shot, Math.atan2(at.x - e.x, at.y - e.y), speed)
    },

    down: (x, y) => useGameStore.setState({ down: true, playerHp: 0, playerX: x, playerY: y }),
    revived: (x, y, hp) => get().revivePlayer(x, y, hp),

    phase: (phase, info) => {
      const s = get()
      if (phase === 'bossWarning') useGameStore.setState({ gameState: 'bossWarning' })
      else if (phase === 'boss') {
        if (!s.boss) s.spawnBoss()
        if (info.bossHp) get().setBossHp(info.bossHp)
      } else if (phase === 'complete' || phase === 'failed') {
        useGameStore.setState({ gameState: 'coopResults', enemies: [], bullets: [], boss: null })
      }
    },

    lost: (reason) => {
      setCoopError(`Connection lost (${reason})`)
      useGameStore.setState({ gameState: 'coopLobby', mode: 'single', down: false, enemies: [], bullets: [], boss: null })
    },
  }
}

/** Our plane's hull, for READY. */
export const selfHp = () => getPlane(useGameStore.getState().progress.plane).hp
