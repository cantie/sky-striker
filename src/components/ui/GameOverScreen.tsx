import type { CSSProperties, ReactNode } from 'react'
import { useGameStore } from '../../store/gameStore'

export function GameOverScreen() {
  const score = useGameStore((s) => s.score)
  const stars = useGameStore((s) => s.stars)
  const startGame = useGameStore((s) => s.startGame)
  const setGameState = useGameStore((s) => s.setGameState)
  return (
    <div style={box}>
      <div style={{ color: '#ff5252', fontSize: 'clamp(2rem, 8vw, 3rem)', fontWeight: 900 }}>GAME OVER</div>
      <div style={{ color: '#fff', margin: '12px 0', fontSize: '1.2rem' }}>Score {score.toLocaleString()} · ★ {stars}</div>
      <button onClick={() => startGame()} style={btn}>Retry</button>
      <button onClick={() => setGameState('menu')} style={{ ...btn, background: '#455a64' }}>Menu</button>
    </div>
  )
}
const box: CSSProperties = { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(40,0,0,0.55)', zIndex: 20, gap: 10, pointerEvents: 'auto' }
const btn: CSSProperties = { width: 220, padding: '0.9rem', borderRadius: 12, border: 'none', background: '#ff5722', color: '#fff', fontWeight: 800, fontSize: '1.05rem', cursor: 'pointer' }
