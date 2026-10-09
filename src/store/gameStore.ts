import { create } from 'zustand'
import { getStage, type ObjectiveId, type StageConfig } from '../game/stages'
import { isBiome, type Biome } from '../game/biomes'
import type { EnemyType } from '../game/roster'
import type { PathId } from '../game/paths'
import { BOUNDS, view } from '../game/world'
import { GAME_SPEED } from '../game/speed'
import { MAX_WEAPON_POWER, WEAPON_TIERS } from '../game/weapon'
import { getPlane } from '../game/planes'
import {
  buyPlane,
  choosePlane,
  loadProgress,
  mergeStageResult,
  type SagaProgress,
} from '../game/progress'

export type GameState =
  | 'menu'
  | 'stageSelect'
  | 'briefing'
  | 'playing'
  | 'paused'
  | 'gameOver'
  | 'victory'
  | 'results'
  | 'bossWarning'
  | 'hangar'

export type { Biome } from '../game/biomes'
export type { EnemyType } from '../game/roster'

export interface Bullet {
  id: string; x: number; y: number; z: number
  vx: number; vy: number; vz: number
  isEnemy: boolean; damage: number; radius: number
  /** Player skills: pass through enemies (remembering who was hit) / steer toward targets. */
  pierce?: boolean; hits?: string[]; homing?: boolean
}
export interface Enemy {
  id: string; x: number; y: number; z: number
  type: EnemyType; hp: number; maxHp: number
  lastShot: number; age: number
  /** Scripted curve + its parameters (see game/paths). */
  path: PathId; px: number; py: number; m: 1 | -1; amp: number; spd: number
  /** Ground units ride the terrain: distance it has scrolled since spawn. */
  groundDist: number
  /** Has been fully on screen; leaving afterwards despawns it. */
  entered: boolean
  /** Facing (radians about Y; 0 = +Z) and turret aim. */
  heading: number; aim: number
}
export interface Boss {
  id: string; x: number; y: number; z: number
  hp: number; maxHp: number; phase: number
  lastShot: number; patternIndex: number; intro: number
}
export type PickupType = 'powerup' | 'star' | 'health' | 'shield' | 'rescue'
export interface Pickup {
  id: string; x: number; y: number; z: number
  type: PickupType
  /** Rescue only: 0→1 while the player hovers nearby (survivors stand on the terrain). */
  progress?: number
}
export interface Explosion {
  id: string; x: number; y: number; z: number
  startTime: number; scale: number
}

/** Per-run objective tracking. */
export interface RunStats {
  enemiesSpawned: number
  enemiesKilled: number
  pickupsSpawned: number
  pickupsCollected: number
  tookDamage: boolean
  bossDefeated: boolean
  stageFinished: boolean
}

interface GameStore {
  gameState: GameState
  score: number; combo: number; comboTimer: number; stars: number
  playerX: number; playerY: number; playerHp: number; playerMaxHp: number
  /** Real ms left on the temporary shield (0 = none); a shield absorbs every hit. */
  shieldMs: number
  invincibleUntil: number
  /** After the boss dies: real ms left to scoop up stars, then the plane flies off the top. */
  victoryMs: number
  flyout: boolean
  /** Weapon progression index (see game/weapon). */
  weaponPower: number
  /** Gun handed to the next stage via NEXT (in memory only; the saga map resets it). */
  carryWeapon: number
  /** Screen the hangar returns to. */
  hangarReturn: GameState
  /** Gold stars banked into the wallet by the last run. */
  lastGoldStars: number
  /** Plane currently shown in the hangar (may still be locked). */
  hangarPlane: string
  bullets: Bullet[]; enemies: Enemy[]; boss: Boss | null
  pickups: Pickup[]; explosions: Explosion[]
  waveIndex: number; waveTimer: number; bossSpawned: boolean
  /** Scripted units queued but not yet spawned (the boss waits for these too). */
  pendingSpawns: number
  scrollOffset: number; biome: Biome; isMuted: boolean; easyMode: boolean
  screenShake: number; muzzleFlash: number; hitFlash: number

  /** Saga */
  currentStageId: number
  selectedStageId: number
  progress: SagaProgress
  runStats: RunStats
  earnedObjectives: ObjectiveId[]
  lastResultWon: boolean

  setGameState: (s: GameState) => void
  goToStageSelect: () => void
  openHangar: () => void
  closeHangar: () => void
  buyPlane: (id: string) => boolean
  choosePlane: (id: string) => void
  viewHangarPlane: (id: string) => void
  selectStage: (id: number) => void
  openBriefing: (id?: number) => void
  startGame: (opts?: { skipToBoss?: boolean; easy?: boolean; stageId?: number }) => void
  pauseGame: () => void; resumeGame: () => void
  setPlayerPosition: (x: number, y: number) => void
  movePlayer: (dx: number, dy: number) => void
  /** Costs `hits` hull points (bullets/rams 1, boss laser 2) unless shielded or invulnerable. */
  damagePlayer: (hits?: number) => void
  healPlayer: (hits: number) => void
  /** Adds `ms` (real time) to the temporary shield. */
  addShield: (ms: number) => void
  upgradeWeapon: () => void
  addBullet: (b: Omit<Bullet, 'id'>) => void
  removeBullet: (id: string) => void
  addEnemy: (e: Omit<Enemy, 'id'>) => void
  removeEnemy: (id: string) => void
  damageEnemy: (id: string, damage: number) => boolean
  recordEnemyKill: () => void
  spawnBoss: () => void
  damageBoss: (damage: number) => boolean
  updateBossPhase: () => void
  addPickup: (p: Omit<Pickup, 'id'>) => void
  collectPickup: (id: string) => Pickup | null
  removePickup: (id: string) => void
  addExplosion: (x: number, y: number, z: number, scale?: number) => void
  addScore: (points: number) => void
  addStar: () => void
  incrementCombo: () => void
  resetCombo: () => void
  updateWave: (dt: number) => void
  updateScroll: (dt: number) => void
  finishStageWin: () => void
  finalizeResults: (won: boolean) => void
  toggleMute: () => void
  addShake: (amount: number) => void
  setMuzzleFlash: (v: number) => void
  setHitFlash: (v: number) => void
  tick: (dt: number) => void
  getStageConfig: () => StageConfig
}

const IFRAMES = 1200
/** Real ms the player gets to collect the boss's stars before flying out. */
const VICTORY_COLLECT_MS = 5000
/** Fly-off speed after the victory window (world units per real second). */
const FLYOUT_SPEED = 28
const COMBO_TIMEOUT = 2200

let bid = 0, eid = 0, pid = 0, xid = 0

const emptyRunStats = (): RunStats => ({
  enemiesSpawned: 0,
  enemiesKilled: 0,
  pickupsSpawned: 0,
  pickupsCollected: 0,
  tookDamage: false,
  bossDefeated: false,
  stageFinished: false,
})

export function evaluateObjectives(
  stage: StageConfig,
  stats: RunStats,
  won: boolean,
): ObjectiveId[] {
  const earned: ObjectiveId[] = []
  const destroyPct =
    stats.enemiesSpawned > 0
      ? stats.enemiesKilled / stats.enemiesSpawned
      : won ? 1 : 0

  for (const obj of stage.objectives) {
    switch (obj.id) {
      case 'finish':
        if (won && stats.stageFinished) earned.push('finish')
        break
      case 'destroy70':
        if (won && destroyPct >= 0.7) earned.push('destroy70')
        break
      case 'destroy100':
        if (won && destroyPct >= 1 && stats.enemiesSpawned > 0) earned.push('destroy100')
        break
      case 'untouched':
        if (won && !stats.tookDamage) earned.push('untouched')
        break
      case 'collectAll':
        if (
          won &&
          stats.pickupsSpawned > 0 &&
          stats.pickupsCollected >= stats.pickupsSpawned
        ) {
          earned.push('collectAll')
        }
        break
      case 'defeatBoss':
        if (won && stats.bossDefeated) earned.push('defeatBoss')
        break
    }
  }
  return earned
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: 'menu',
  score: 0, combo: 0, comboTimer: 0, stars: 0,
  playerX: 0, playerY: -4, playerHp: 3, playerMaxHp: 3,
  shieldMs: 0, victoryMs: 0, flyout: false, weaponPower: 0, carryWeapon: 0, hangarReturn: 'menu', lastGoldStars: 0, hangarPlane: 'hawk', invincibleUntil: 0,
  bullets: [], enemies: [], boss: null, pickups: [], explosions: [],
  waveIndex: 0, waveTimer: 0, bossSpawned: false, pendingSpawns: 0,
  scrollOffset: 0, biome: 'jungle', isMuted: false, easyMode: false,
  screenShake: 0, muzzleFlash: 0, hitFlash: 0,

  currentStageId: 1,
  selectedStageId: 1,
  progress: loadProgress(),
  runStats: emptyRunStats(),
  earnedObjectives: [],
  lastResultWon: false,

  setGameState: (s) => set({ gameState: s }),

  goToStageSelect: () => set({
    gameState: 'stageSelect',
    progress: loadProgress(),
    // Back on the saga map the carried-over gun is lost
    carryWeapon: 0,
    bullets: [], enemies: [], boss: null, pickups: [], explosions: [],
  }),

  // Swapping planes (e.g. from the briefing after NEXT) keeps the carried gun
  openHangar: () => {
    const progress = loadProgress()
    set((s) => ({ gameState: 'hangar', hangarReturn: s.gameState, progress, hangarPlane: progress.plane }))
  },
  viewHangarPlane: (id) => set({ hangarPlane: id }),
  closeHangar: () => set((s) => ({ gameState: s.hangarReturn })),
  buyPlane: (id) => {
    const next = buyPlane(get().progress, id)
    if (!next) return false
    set({ progress: next })
    return true
  },
  choosePlane: (id) => set((s) => ({ progress: choosePlane(s.progress, id) })),

  selectStage: (id) => set({ selectedStageId: id }),

  openBriefing: (id) => {
    const stageId = id ?? get().selectedStageId
    set({ selectedStageId: stageId, currentStageId: stageId, gameState: 'briefing' })
  },

  getStageConfig: () => getStage(get().currentStageId),

  startGame: (opts = {}) => {
    const easy = !!opts.easy || new URLSearchParams(location.search).has('easy')
    const skip = !!opts.skipToBoss || new URLSearchParams(location.search).has('boss')
    const q = new URLSearchParams(location.search)
    // ?stage=N (dev/testing) overrides the chosen stage
    const stageId = Number(q.get('stage')) || opts.stageId || get().selectedStageId || 1
    const stage = getStage(stageId)
    const plane = getPlane(get().progress.plane)

    const forced = q.get('biome')
    const biome: Biome = isBiome(forced) ? forced : stage.biome

    const hasBoss = stage.hasBoss || skip
    const startWave = skip ? stage.maxWaves : 0

    set({
      gameState: skip ? 'bossWarning' : 'playing',
      currentStageId: stageId,
      selectedStageId: stageId,
      score: 0, combo: 0, comboTimer: 0, stars: 0,
      playerX: 0, playerY: -4,
      // Easy mode: two extra hits and a short launch shield
      playerHp: plane.hp + (easy ? 2 : 0),
      playerMaxHp: plane.hp + (easy ? 2 : 0),
      shieldMs: plane.skill === 'autoShield' ? 5000 : easy ? 6000 : 0,
      victoryMs: 0, flyout: false,
      // Carried over from the last cleared stage; easy start guarantees at least level 2
      // Kept only when arriving via NEXT; easy start guarantees at least level 2
      weaponPower: Math.max(get().carryWeapon, easy ? WEAPON_TIERS : 0),
      invincibleUntil: Date.now() + 1500,
      bullets: [], enemies: [], boss: null, pickups: [], explosions: [],
      waveIndex: startWave, waveTimer: 0, bossSpawned: false, pendingSpawns: 0,
      scrollOffset: 0, biome, easyMode: easy,
      screenShake: 0, muzzleFlash: 0, hitFlash: 0,
      runStats: emptyRunStats(),
      earnedObjectives: [],
      lastResultWon: false,
    })

    // First survivors are already standing on the ground ahead of the player
    if (!skip) {
      const s = get()
      s.addPickup({ x: 2.5, y: 0, z: 13, type: 'rescue', progress: 0 })
      s.addPickup({ x: -3, y: 0, z: 26, type: 'rescue', progress: 0 })
    }

    if (skip && hasBoss) setTimeout(() => get().spawnBoss(), 2200)
  },

  pauseGame: () => { if (get().gameState === 'playing') set({ gameState: 'paused' }) },
  resumeGame: () => { if (get().gameState === 'paused') set({ gameState: 'playing' }) },

  setPlayerPosition: (x, y) => get().flyout ? undefined : set({
    playerX: Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, x)),
    playerY: Math.max(BOUNDS.minY, Math.min(BOUNDS.maxY, y)),
  }),
  movePlayer: (dx, dy) => {
    const { playerX, playerY } = get()
    get().setPlayerPosition(playerX + dx, playerY + dy)
  },

  damagePlayer: (hits = 1) => {
    const { invincibleUntil, shieldMs, playerHp, runStats, victoryMs, flyout } = get()
    if (Date.now() < invincibleUntil || victoryMs > 0 || flyout) return
    // An active shield simply eats the hit
    if (shieldMs > 0) {
      set({ screenShake: Math.max(get().screenShake, 0.15) })
      return
    }
    const hp = Math.max(0, playerHp - hits)
    set({
      playerHp: hp,
      invincibleUntil: Date.now() + IFRAMES,
      hitFlash: 0.35,
      screenShake: Math.max(get().screenShake, 0.35),
      runStats: { ...runStats, tookDamage: true },
    })
    if (hp <= 0) get().finalizeResults(false)
  },

  healPlayer: (n) => set((s) => ({ playerHp: Math.min(s.playerMaxHp, s.playerHp + n) })),
  addShield: (ms) => set((s) => ({ shieldMs: s.shieldMs + ms })),
  upgradeWeapon: () => set((s) => ({ weaponPower: Math.min(MAX_WEAPON_POWER, s.weaponPower + 1) })),

  addBullet: (b) => set((s) => ({ bullets: [...s.bullets, { ...b, id: `b${bid++}` }] })),
  removeBullet: (id) => set((s) => ({ bullets: s.bullets.filter((b) => b.id !== id) })),

  addEnemy: (e) => set((s) => ({
    enemies: [...s.enemies, { ...e, id: `e${eid++}` }],
    runStats: {
      ...s.runStats,
      enemiesSpawned: s.runStats.enemiesSpawned + 1,
    },
  })),
  removeEnemy: (id) => set((s) => ({ enemies: s.enemies.filter((e) => e.id !== id) })),
  damageEnemy: (id, damage) => {
    const enemy = get().enemies.find((e) => e.id === id)
    if (!enemy) return false
    const hp = enemy.hp - damage
    if (hp <= 0) {
      set((s) => ({ enemies: s.enemies.filter((e) => e.id !== id) }))
      return true
    }
    set((s) => ({ enemies: s.enemies.map((e) => (e.id === id ? { ...e, hp } : e)) }))
    return false
  },
  recordEnemyKill: () => set((s) => ({
    runStats: { ...s.runStats, enemiesKilled: s.runStats.enemiesKilled + 1 },
  })),

  spawnBoss: () => {
    const stage = get().getStageConfig()
    const baseHp = stage.bossHp || 1000
    const hp = get().easyMode ? Math.floor(baseHp * 0.7) : baseHp
    set({
      gameState: 'playing',
      boss: {
        // Starts above the screen; Boss flies it in to its hover line
        id: 'boss', x: 0, y: 26, z: 0,
        hp, maxHp: hp, phase: 1, lastShot: 0, patternIndex: 0, intro: 1,
      },
      bossSpawned: true,
    })
  },

  damageBoss: (damage) => {
    const { boss } = get()
    if (!boss) return false
    const hp = boss.hp - damage
    if (hp <= 0) {
      // Victory window: enemy fire vanishes and the player has a few seconds to scoop up the
      // boss's stars (anything left uncollected is lost); tick() then flies the plane out
      set((s) => ({
        boss: null,
        screenShake: 0.8,
        bullets: s.bullets.filter((b) => !b.isEnemy),
        enemies: [],
        runStats: { ...s.runStats, bossDefeated: true },
        victoryMs: VICTORY_COLLECT_MS,
      }))
      return true
    }
    set({ boss: { ...boss, hp } })
    get().updateBossPhase()
    return false
  },

  updateBossPhase: () => {
    const { boss } = get()
    if (!boss) return
    const p = boss.hp / boss.maxHp
    const phase = p <= 0.33 ? 3 : p <= 0.66 ? 2 : 1
    if (phase !== boss.phase) set({ boss: { ...boss, phase }, screenShake: 0.4 })
  },

  addPickup: (p) => set((s) => ({
    pickups: [...s.pickups, { ...p, id: `p${pid++}` }],
    runStats: {
      ...s.runStats,
      pickupsSpawned: s.runStats.pickupsSpawned + 1,
    },
  })),

  collectPickup: (id) => {
    const p = get().pickups.find((x) => x.id === id)
    if (!p) return null
    set((s) => ({
      pickups: s.pickups.filter((x) => x.id !== id),
      runStats: {
        ...s.runStats,
        pickupsCollected: s.runStats.pickupsCollected + 1,
      },
    }))
    return p
  },

  removePickup: (id) => set((s) => ({ pickups: s.pickups.filter((p) => p.id !== id) })),

  addExplosion: (x, y, z, scale = 1) => set((s) => ({
    explosions: [...s.explosions, { id: `x${xid++}`, x, y, z, startTime: Date.now(), scale }],
    screenShake: Math.max(s.screenShake, 0.15 * scale),
  })),
  addScore: (points) => {
    const mult = 1 + get().combo * 0.1
    set((s) => ({ score: s.score + Math.floor(points * mult) }))
  },
  addStar: () => set((s) => ({ stars: s.stars + 1 })),
  incrementCombo: () => set((s) => ({ combo: s.combo + 1, comboTimer: COMBO_TIMEOUT })),
  resetCombo: () => set({ combo: 0, comboTimer: 0 }),

  updateWave: (dt) => {
    const s = get()
    if (s.bossSpawned) return
    const stage = getStage(s.currentStageId)
    const t = s.waveTimer + dt
    if (t >= stage.waveInterval && s.waveIndex < stage.maxWaves) {
      set({ waveTimer: 0, waveIndex: s.waveIndex + 1 })
    } else {
      set({ waveTimer: t })
    }

    const st = get()
    if (st.waveIndex >= stage.maxWaves && !st.bossSpawned && st.enemies.length === 0 && st.pendingSpawns === 0 && st.gameState === 'playing') {
      if (stage.hasBoss) {
        set({ gameState: 'bossWarning' })
        setTimeout(() => get().spawnBoss(), 2200)
      } else {
        get().finishStageWin()
      }
    }
  },

  updateScroll: (dt) => set((s) => ({ scrollOffset: s.scrollOffset + dt * 0.00042 })),

  finishStageWin: () => {
    const s = get()
    if (s.gameState === 'results' || s.gameState === 'victory') return
    set({
      runStats: { ...s.runStats, stageFinished: true },
    })
    get().finalizeResults(true)
  },

  finalizeResults: (won) => {
    const s = get()
    if (s.gameState === 'results') return
    const stage = getStage(s.currentStageId)
    const stats = won
      ? { ...s.runStats, stageFinished: true }
      : s.runStats
    const earned = evaluateObjectives(stage, stats, won)
    const progress = mergeStageResult(
      s.progress,
      s.currentStageId,
      s.score,
      earned,
      won,
      s.stars,
    )
    set({
      gameState: 'results',
      // Clearing a stage hands the gun to NEXT; getting shot down resets it
      carryWeapon: won ? s.weaponPower : 0,
      lastGoldStars: s.stars,
      lastResultWon: won,
      earnedObjectives: earned,
      runStats: stats,
      progress,
      enemies: [],
      bullets: [],
      boss: null,
    })
  },

  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  addShake: (a) => set((s) => ({ screenShake: Math.max(s.screenShake, a) })),
  setMuzzleFlash: (v) => set({ muzzleFlash: v }),
  setHitFlash: (v) => set({ hitFlash: v }),

  tick: (dt) => {
    const s = get()
    if (s.gameState !== 'playing') return
    if (s.comboTimer > 0) {
      const nt = s.comboTimer - dt
      if (nt <= 0) set({ combo: 0, comboTimer: 0 })
      else set({ comboTimer: nt })
    }
    const now = Date.now()
    set((st) => ({
      explosions: st.explosions.filter((e) => now - e.startTime < 600),
      screenShake: Math.max(0, st.screenShake - dt * 0.0012),
      muzzleFlash: Math.max(0, st.muzzleFlash - dt * 0.004),
      hitFlash: Math.max(0, st.hitFlash - dt * 0.002),
    }))
    // Timers below run on real time (dt arrives as game ms)
    const realDt = dt / GAME_SPEED
    if (s.shieldMs > 0) set({ shieldMs: Math.max(0, s.shieldMs - realDt) })
    if (s.victoryMs > 0) {
      const left = s.victoryMs - realDt
      set(left > 0 ? { victoryMs: left } : { victoryMs: 0, flyout: true })
    } else if (s.flyout) {
      // Full throttle straight up and off the top of the screen, then the results
      const y = s.playerY + (FLYOUT_SPEED * realDt) / 1000
      set({ playerY: y })
      if (y > view.top + 3) get().finishStageWin()
    }
    get().updateWave(dt)
    get().updateScroll(dt)
  },
}))

// Dev-only handle for automated playtests (scripts_shot.mjs eval actions)
if (import.meta.env.DEV) (window as unknown as { __store: typeof useGameStore }).__store = useGameStore
