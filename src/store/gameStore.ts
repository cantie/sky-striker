import { create } from 'zustand'

export type GameState = 'menu' | 'playing' | 'paused' | 'gameOver' | 'victory' | 'bossWarning'
export type Biome = 'desert' | 'jungle'

export interface Bullet {
  id: string; x: number; y: number; z: number
  vx: number; vy: number; vz: number
  isEnemy: boolean; damage: number; radius: number; glow?: string
}
export type EnemyType = 'basic' | 'fast' | 'heavy' | 'shooter'
export interface Enemy {
  id: string; x: number; y: number; z: number
  type: EnemyType; hp: number; maxHp: number
  lastShot: number; pattern: number; age: number
}
export interface Boss {
  id: string; x: number; y: number; z: number
  hp: number; maxHp: number; phase: number
  lastShot: number; patternIndex: number; intro: number
}
export interface Pickup {
  id: string; x: number; y: number; z: number
  type: 'powerup' | 'star' | 'health' | 'shield'
}
export interface Explosion {
  id: string; x: number; y: number; z: number
  startTime: number; scale: number
}

interface GameStore {
  gameState: GameState
  score: number; combo: number; comboTimer: number; stars: number
  playerX: number; playerY: number; playerHp: number; playerMaxHp: number
  playerShield: number; weaponLevel: number; invincibleUntil: number
  bullets: Bullet[]; enemies: Enemy[]; boss: Boss | null
  pickups: Pickup[]; explosions: Explosion[]
  waveIndex: number; waveTimer: number; bossSpawned: boolean
  scrollOffset: number; biome: Biome; isMuted: boolean; easyMode: boolean
  screenShake: number; muzzleFlash: number; hitFlash: number
  setGameState: (s: GameState) => void
  startGame: (opts?: { skipToBoss?: boolean; easy?: boolean }) => void
  pauseGame: () => void; resumeGame: () => void
  setPlayerPosition: (x: number, y: number) => void
  movePlayer: (dx: number, dy: number) => void
  damagePlayer: (amount: number) => void
  healPlayer: (amount: number) => void
  addShield: (amount: number) => void
  upgradeWeapon: () => void
  addBullet: (b: Omit<Bullet, 'id'>) => void
  removeBullet: (id: string) => void
  addEnemy: (e: Omit<Enemy, 'id'>) => void
  removeEnemy: (id: string) => void
  damageEnemy: (id: string, damage: number) => boolean
  spawnBoss: () => void
  damageBoss: (damage: number) => boolean
  updateBossPhase: () => void
  addPickup: (p: Omit<Pickup, 'id'>) => void
  removePickup: (id: string) => void
  addExplosion: (x: number, y: number, z: number, scale?: number) => void
  addScore: (points: number) => void
  addStar: () => void
  incrementCombo: () => void
  resetCombo: () => void
  updateWave: (dt: number) => void
  updateScroll: (dt: number) => void
  toggleMute: () => void
  addShake: (amount: number) => void
  setMuzzleFlash: (v: number) => void
  setHitFlash: (v: number) => void
  tick: (dt: number) => void
}

const BOUNDS = { minX: -7.0, maxX: 7.0, minY: -8.2, maxY: 5.8 }
const IFRAMES = 1200
const COMBO_TIMEOUT = 2200

let bid = 0, eid = 0, pid = 0, xid = 0

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: 'menu',
  score: 0, combo: 0, comboTimer: 0, stars: 0,
  playerX: 0, playerY: -4, playerHp: 100, playerMaxHp: 100,
  playerShield: 0, weaponLevel: 1, invincibleUntil: 0,
  bullets: [], enemies: [], boss: null, pickups: [], explosions: [],
  waveIndex: 0, waveTimer: 0, bossSpawned: false,
  scrollOffset: 0, biome: 'jungle', isMuted: false, easyMode: false,
  screenShake: 0, muzzleFlash: 0, hitFlash: 0,

  setGameState: (s) => set({ gameState: s }),

  startGame: (opts = {}) => {
    const easy = !!opts.easy || new URLSearchParams(location.search).has('easy')
    const skip = !!opts.skipToBoss || new URLSearchParams(location.search).has('boss')
    const q = new URLSearchParams(location.search)
    const forced = q.get('biome')
    const biome: Biome = forced === 'desert' || forced === 'jungle'
      ? forced
      : (Math.random() < 0.5 ? 'desert' : 'jungle')
    set({
      gameState: skip ? 'bossWarning' : 'playing',
      score: 0, combo: 0, comboTimer: 0, stars: 0,
      playerX: 0, playerY: -4, playerHp: easy ? 150 : 100, playerMaxHp: easy ? 150 : 100,
      playerShield: easy ? 50 : 0, weaponLevel: easy ? 3 : 1, invincibleUntil: Date.now() + 1500,
      bullets: [], enemies: [], boss: null, pickups: [], explosions: [],
      waveIndex: skip ? 10 : 0, waveTimer: 0, bossSpawned: false,
      scrollOffset: 0, biome, easyMode: easy, screenShake: 0, muzzleFlash: 0, hitFlash: 0,
    })
    if (skip) setTimeout(() => get().spawnBoss(), 2200)
  },

  pauseGame: () => { if (get().gameState === 'playing') set({ gameState: 'paused' }) },
  resumeGame: () => { if (get().gameState === 'paused') set({ gameState: 'playing' }) },

  setPlayerPosition: (x, y) => set({
    playerX: Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, x)),
    playerY: Math.max(BOUNDS.minY, Math.min(BOUNDS.maxY, y)),
  }),
  movePlayer: (dx, dy) => {
    const { playerX, playerY } = get()
    get().setPlayerPosition(playerX + dx, playerY + dy)
  },

  damagePlayer: (amount) => {
    const { invincibleUntil, playerShield, playerHp, easyMode } = get()
    if (Date.now() < invincibleUntil) return
    let rem = easyMode ? amount * 0.6 : amount
    let shield = playerShield
    if (shield > 0) {
      if (shield >= rem) { shield -= rem; rem = 0 }
      else { rem -= shield; shield = 0 }
    }
    const hp = Math.max(0, playerHp - rem)
    set({ playerShield: shield, playerHp: hp, invincibleUntil: Date.now() + IFRAMES, hitFlash: 0.35, screenShake: Math.max(get().screenShake, 0.35) })
    if (hp <= 0) set({ gameState: 'gameOver' })
  },

  healPlayer: (n) => set((s) => ({ playerHp: Math.min(s.playerMaxHp, s.playerHp + n) })),
  addShield: (n) => set((s) => ({ playerShield: Math.min(100, s.playerShield + n) })),
  upgradeWeapon: () => set((s) => ({ weaponLevel: Math.min(5, s.weaponLevel + 1) })),

  addBullet: (b) => set((s) => ({ bullets: [...s.bullets, { ...b, id: `b${bid++}` }] })),
  removeBullet: (id) => set((s) => ({ bullets: s.bullets.filter((b) => b.id !== id) })),

  addEnemy: (e) => set((s) => ({ enemies: [...s.enemies, { ...e, id: `e${eid++}` }] })),
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

  spawnBoss: () => {
    set({
      gameState: 'playing',
      boss: { id: 'boss', x: 0, y: 7, z: 0, hp: get().easyMode ? 700 : 1000, maxHp: get().easyMode ? 700 : 1000, phase: 1, lastShot: 0, patternIndex: 0, intro: 1 },
      bossSpawned: true,
    })
  },

  damageBoss: (damage) => {
    const { boss } = get()
    if (!boss) return false
    const hp = boss.hp - damage
    if (hp <= 0) {
      set({ boss: null, gameState: 'victory', screenShake: 0.8 })
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

  addPickup: (p) => set((s) => ({ pickups: [...s.pickups, { ...p, id: `p${pid++}` }] })),
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
    const t = s.waveTimer + dt
    if (t >= 2800 && s.waveIndex < 10) set({ waveTimer: 0, waveIndex: s.waveIndex + 1 })
    else set({ waveTimer: t })
    if (s.waveIndex >= 10 && !s.bossSpawned && s.enemies.length === 0) {
      set({ gameState: 'bossWarning' })
      setTimeout(() => get().spawnBoss(), 2200)
    }
  },

  updateScroll: (dt) => set((s) => ({ scrollOffset: s.scrollOffset + dt * 0.00095 })),
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
    get().updateWave(dt)
    get().updateScroll(dt)
  },
}))
