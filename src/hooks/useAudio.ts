import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'

const Ctx = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null

function beep(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.08) {
  return () => {
    if (!Ctx || useGameStore.getState().isMuted) return
    const o = Ctx.createOscillator(), g = Ctx.createGain()
    o.type = type; o.frequency.setValueAtTime(freq, Ctx.currentTime)
    g.gain.setValueAtTime(vol, Ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.01, Ctx.currentTime + dur)
    o.connect(g); g.connect(Ctx.destination); o.start(); o.stop(Ctx.currentTime + dur)
  }
}

export const sounds = {
  shoot: beep(880, 0.04, 'square', 0.04),
  enemyHit: beep(220, 0.08, 'sawtooth', 0.07),
  explosion: () => {
    if (!Ctx || useGameStore.getState().isMuted) return
    const n = Ctx.sampleRate * 0.2
    const buf = Ctx.createBuffer(1, n, Ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2)
    const src = Ctx.createBufferSource(), g = Ctx.createGain()
    src.buffer = buf; g.gain.value = 0.18; src.connect(g); g.connect(Ctx.destination); src.start()
  },
  pickup: beep(660, 0.1, 'sine', 0.1),
  powerup: () => {
    if (!Ctx || useGameStore.getState().isMuted) return
    const o = Ctx.createOscillator(), g = Ctx.createGain()
    o.type = 'sine'; o.frequency.setValueAtTime(440, Ctx.currentTime)
    o.frequency.exponentialRampToValueAtTime(880, Ctx.currentTime + 0.15)
    g.gain.setValueAtTime(0.1, Ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.01, Ctx.currentTime + 0.2)
    o.connect(g); g.connect(Ctx.destination); o.start(); o.stop(Ctx.currentTime + 0.2)
  },
  playerHit: () => {
    if (!Ctx || useGameStore.getState().isMuted) return
    const o = Ctx.createOscillator(), g = Ctx.createGain()
    o.type = 'sawtooth'; o.frequency.setValueAtTime(200, Ctx.currentTime)
    o.frequency.exponentialRampToValueAtTime(50, Ctx.currentTime + 0.3)
    g.gain.setValueAtTime(0.12, Ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.01, Ctx.currentTime + 0.3)
    o.connect(g); g.connect(Ctx.destination); o.start(); o.stop(Ctx.currentTime + 0.3)
  },
  gameOver: () => {
    if (!Ctx || useGameStore.getState().isMuted) return
    ;[392, 349, 330, 262].forEach((f, i) => setTimeout(() => {
      const o = Ctx!.createOscillator(), g = Ctx!.createGain()
      o.type = 'triangle'; o.frequency.value = f
      g.gain.setValueAtTime(0.1, Ctx!.currentTime)
      g.gain.exponentialRampToValueAtTime(0.01, Ctx!.currentTime + 0.3)
      o.connect(g); g.connect(Ctx!.destination); o.start(); o.stop(Ctx!.currentTime + 0.3)
    }, i * 200))
  },
  victory: () => {
    if (!Ctx || useGameStore.getState().isMuted) return
    ;[523, 659, 784, 1047].forEach((f, i) => setTimeout(() => {
      const o = Ctx!.createOscillator(), g = Ctx!.createGain()
      o.type = 'sine'; o.frequency.value = f
      g.gain.setValueAtTime(0.1, Ctx!.currentTime)
      g.gain.exponentialRampToValueAtTime(0.01, Ctx!.currentTime + 0.4)
      o.connect(g); g.connect(Ctx!.destination); o.start(); o.stop(Ctx!.currentTime + 0.4)
    }, i * 150))
  },
  bossAppear: () => {
    if (!Ctx || useGameStore.getState().isMuted) return
    const o = Ctx.createOscillator(), g = Ctx.createGain()
    o.type = 'sawtooth'; o.frequency.setValueAtTime(80, Ctx.currentTime)
    o.frequency.exponentialRampToValueAtTime(200, Ctx.currentTime + 1)
    g.gain.setValueAtTime(0.15, Ctx.currentTime)
    g.gain.setValueAtTime(0.15, Ctx.currentTime + 0.8)
    g.gain.exponentialRampToValueAtTime(0.01, Ctx.currentTime + 1)
    o.connect(g); g.connect(Ctx.destination); o.start(); o.stop(Ctx.currentTime + 1)
  },
}

export function useAudio() {
  const gameState = useGameStore((s) => s.gameState)
  const bullets = useGameStore((s) => s.bullets)
  const explosions = useGameStore((s) => s.explosions)
  const playerHp = useGameStore((s) => s.playerHp)
  const boss = useGameStore((s) => s.boss)
  const lastB = useRef(0), lastX = useRef(0), lastHp = useRef(100), hadBoss = useRef(false), lastState = useRef(gameState)

  useEffect(() => {
    if (Ctx?.state === 'suspended') {
      const resume = () => { Ctx.resume(); document.removeEventListener('click', resume); document.removeEventListener('touchstart', resume) }
      document.addEventListener('click', resume); document.addEventListener('touchstart', resume)
    }
  }, [])

  useEffect(() => {
    const n = bullets.filter((b) => !b.isEnemy).length
    if (n > lastB.current) sounds.shoot()
    lastB.current = n
  }, [bullets])

  useEffect(() => {
    if (explosions.length > lastX.current) sounds.explosion()
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
