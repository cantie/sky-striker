import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'

type SfxName =
  | 'shoot' | 'hit' | 'explosion' | 'explosion_big' | 'pickup' | 'powerup'
  | 'player_hit' | 'game_over' | 'victory' | 'boss_appear' | 'ui_click' | 'ui_select'
  | 'shield' | 'jingle_start' | 'jingle_win'

const FILES: Record<SfxName, string> = {
  shoot: '/audio/shoot.ogg',
  hit: '/audio/hit.ogg',
  explosion: '/audio/explosion.ogg',
  explosion_big: '/audio/explosion_big.ogg',
  pickup: '/audio/pickup.ogg',
  powerup: '/audio/powerup.ogg',
  player_hit: '/audio/player_hit.ogg',
  game_over: '/audio/game_over.ogg',
  victory: '/audio/victory.ogg',
  boss_appear: '/audio/boss_appear.ogg',
  ui_click: '/audio/ui_click.ogg',
  ui_select: '/audio/ui_select.ogg',
  shield: '/audio/shield.ogg',
  jingle_start: '/audio/jingle_start.ogg',
  jingle_win: '/audio/jingle_win.ogg',
}

let ctx: AudioContext | null = null
let master: GainNode | null = null
let musicGain: GainNode | null = null
let musicSource: AudioBufferSourceNode | null = null
let unlocked = false
const buffers = new Map<string, AudioBuffer>()
const loading = new Map<string, Promise<AudioBuffer | null>>()

function getCtx() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    master = ctx.createGain()
    master.gain.value = 1
    master.connect(ctx.destination)
    musicGain = ctx.createGain()
    musicGain.gain.value = 0.22
    musicGain.connect(master)
  }
  return ctx
}

async function loadBuffer(url: string): Promise<AudioBuffer | null> {
  if (buffers.has(url)) return buffers.get(url)!
  if (loading.has(url)) return loading.get(url)!
  const ac = getCtx()
  if (!ac) return null
  const p = (async () => {
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      const arr = await res.arrayBuffer()
      const buf = await ac.decodeAudioData(arr.slice(0))
      buffers.set(url, buf)
      return buf
    } catch {
      return null
    } finally {
      loading.delete(url)
    }
  })()
  loading.set(url, p)
  return p
}

function applyMute() {
  if (!master || !ctx) return
  const muted = useGameStore.getState().isMuted
  master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02)
}

export async function unlockAudio() {
  const ac = getCtx()
  if (!ac) return
  if (ac.state === 'suspended') {
    try { await ac.resume() } catch { /* ignore */ }
  }
  unlocked = true
  applyMute()
  // warm common buffers
  await Promise.all(Object.values(FILES).map((u) => loadBuffer(u)))
  await loadBuffer('/audio/music_loop.ogg')
}

function playBuf(buf: AudioBuffer | null | undefined, opts?: { gain?: number; dest?: AudioNode }) {
  const ac = getCtx()
  if (!ac || !master || !buf || !unlocked) return
  if (useGameStore.getState().isMuted && opts?.dest !== musicGain) return
  applyMute()
  const src = ac.createBufferSource()
  src.buffer = buf
  const g = ac.createGain()
  g.gain.value = opts?.gain ?? 0.55
  src.connect(g)
  g.connect(opts?.dest ?? master)
  try { src.start() } catch { /* ignore */ }
  return src
}

export const sounds = {
  shoot: () => { void loadBuffer(FILES.shoot).then((b) => playBuf(b, { gain: 0.28 })) },
  enemyHit: () => { void loadBuffer(FILES.hit).then((b) => playBuf(b, { gain: 0.45 })) },
  explosion: () => { void loadBuffer(FILES.explosion).then((b) => playBuf(b, { gain: 0.6 })) },
  explosionBig: () => { void loadBuffer(FILES.explosion_big).then((b) => playBuf(b, { gain: 0.7 })) },
  pickup: () => { void loadBuffer(FILES.pickup).then((b) => playBuf(b, { gain: 0.5 })) },
  powerup: () => { void loadBuffer(FILES.powerup).then((b) => playBuf(b, { gain: 0.55 })) },
  playerHit: () => { void loadBuffer(FILES.player_hit).then((b) => playBuf(b, { gain: 0.55 })) },
  gameOver: () => { void loadBuffer(FILES.game_over).then((b) => playBuf(b, { gain: 0.6 })) },
  victory: () => {
    void loadBuffer(FILES.jingle_win).then((b) => playBuf(b, { gain: 0.55 }))
    void loadBuffer(FILES.victory).then((b) => playBuf(b, { gain: 0.45 }))
  },
  bossAppear: () => { void loadBuffer(FILES.boss_appear).then((b) => playBuf(b, { gain: 0.65 })) },
  uiClick: () => { void loadBuffer(FILES.ui_click).then((b) => playBuf(b, { gain: 0.4 })) },
  uiSelect: () => { void loadBuffer(FILES.ui_select).then((b) => playBuf(b, { gain: 0.4 })) },
  shield: () => { void loadBuffer(FILES.shield).then((b) => playBuf(b, { gain: 0.4 })) },
}

export async function startMusic() {
  await unlockAudio()
  const ac = getCtx()
  if (!ac || !musicGain) return
  stopMusic()
  const buf = await loadBuffer('/audio/music_loop.ogg')
  if (!buf) return
  const src = ac.createBufferSource()
  src.buffer = buf
  src.loop = true
  src.connect(musicGain)
  try { src.start() } catch { /* ignore */ }
  musicSource = src
  applyMute()
}

export function stopMusic() {
  if (musicSource) {
    try { musicSource.stop() } catch { /* ignore */ }
    try { musicSource.disconnect() } catch { /* ignore */ }
    musicSource = null
  }
}

export function syncMute() {
  applyMute()
}

/** Call from Play / first gesture — unlocks AudioContext and starts BGM. */
export async function onPlayGesture() {
  await unlockAudio()
  void loadBuffer(FILES.jingle_start).then((b) => playBuf(b, { gain: 0.4 }))
  await startMusic()
}

export function useAudio() {
  const gameState = useGameStore((s) => s.gameState)
  const bullets = useGameStore((s) => s.bullets)
  const explosions = useGameStore((s) => s.explosions)
  const playerHp = useGameStore((s) => s.playerHp)
  const boss = useGameStore((s) => s.boss)
  const isMuted = useGameStore((s) => s.isMuted)
  const lastB = useRef(0), lastX = useRef(0), lastHp = useRef(100), hadBoss = useRef(false), lastState = useRef(gameState)

  useEffect(() => { syncMute() }, [isMuted])

  useEffect(() => {
    if (gameState === 'playing' || gameState === 'bossWarning') {
      if (unlocked) void startMusic()
    }
    if (gameState === 'menu' || gameState === 'gameOver' || gameState === 'victory') {
      // keep music on menu after unlock; stop only on hard end screens optional — keep looping quietly
    }
  }, [gameState])

  useEffect(() => {
    const n = bullets.filter((b) => !b.isEnemy).length
    if (n > lastB.current) sounds.shoot()
    lastB.current = n
  }, [bullets])

  useEffect(() => {
    if (explosions.length > lastX.current) {
      const last = explosions[explosions.length - 1]
      if (last && last.scale >= 2) sounds.explosionBig()
      else sounds.explosion()
    }
    lastX.current = explosions.length
  }, [explosions])

  useEffect(() => {
    if (playerHp < lastHp.current && gameState === 'playing') sounds.playerHit()
    lastHp.current = playerHp
  }, [playerHp, gameState])

  useEffect(() => {
    if (boss && !hadBoss.current) { sounds.bossAppear(); hadBoss.current = true }
    if (!boss) hadBoss.current = false
  }, [boss])

  useEffect(() => {
    if (gameState === 'gameOver' && lastState.current === 'playing') sounds.gameOver()
    if (gameState === 'victory' && lastState.current === 'playing') sounds.victory()
    lastState.current = gameState
  }, [gameState])
}
