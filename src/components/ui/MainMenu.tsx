import type { CSSProperties } from 'react'
import { useGameStore } from '../../store/gameStore'
import { onPlayGesture, sounds, syncMute } from '../../hooks/useAudio'

export function MainMenu() {
  const startGame = useGameStore((s) => s.startGame)
  const isMuted = useGameStore((s) => s.isMuted)
  const toggleMute = useGameStore((s) => s.toggleMute)

  const play = async (opts?: { skipToBoss?: boolean; easy?: boolean }) => {
    sounds.uiSelect()
    await onPlayGesture()
    startGame(opts)
  }

  return (
    <div style={overlay}>
      <div style={{ textAlign: 'center', padding: '1rem', maxWidth: 420 }}>
        <div style={{ fontSize: 'clamp(2.2rem, 8vw, 3.4rem)', fontWeight: 900, color: '#fff', textShadow: '0 4px 0 #0a4a7a, 0 0 30px #4ec4ff', letterSpacing: 2 }}>SKY STRIKER</div>
        <div style={{ color: '#d7f3ff', marginTop: 8, marginBottom: 28, fontSize: 'clamp(0.85rem, 2.5vw, 1rem)' }}>Defend the coast. Upgrade. Defeat the boss.<br />Each run: desert or jungle.</div>
        <button onClick={() => void play()} style={btnPrimary}>PLAY</button>
        <button onClick={() => void play({ easy: true })} style={btnSecondary}>EASY MODE</button>
        <button onClick={() => void play({ skipToBoss: true })} style={btnSecondary}>BOSS FIGHT</button>
        <button
          onClick={() => { sounds.uiClick(); toggleMute(); syncMute() }}
          style={btnGhost}
        >
          {isMuted ? '🔇 Unmute' : '🔊 Mute'}
        </button>
        <div style={{ marginTop: 22, color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 1.5 }}>
          Drag to move · Auto-fire · WASD / arrows on desktop<br />
          Tip: <code>?boss</code>, <code>?easy</code>, <code>?biome=desert|jungle</code>
        </div>
      </div>
    </div>
  )
}

const overlay: CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'linear-gradient(180deg, rgba(10,60,110,0.35) 0%, rgba(10,40,80,0.55) 100%)',
  pointerEvents: 'auto', zIndex: 10,
  padding: 'max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))',
}
const btnPrimary: CSSProperties = {
  display: 'block', width: '100%', margin: '0.5rem 0', padding: '0.95rem 1rem', border: 'none', borderRadius: 14,
  background: 'linear-gradient(180deg, #ffd54a, #ff9800)', color: '#1a1a1a', fontWeight: 800, fontSize: '1.15rem', cursor: 'pointer',
  boxShadow: '0 6px 0 #c77700',
}
const btnSecondary: CSSProperties = {
  ...btnPrimary, background: 'linear-gradient(180deg, #5ec8ff, #1a8fd0)', color: '#fff', boxShadow: '0 6px 0 #0d5f90', fontSize: '1rem',
}
const btnGhost: CSSProperties = {
  ...btnPrimary, background: 'rgba(255,255,255,0.15)', color: '#fff', boxShadow: 'none', fontSize: '0.95rem', marginTop: 10,
}
