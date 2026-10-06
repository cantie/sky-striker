import type { CSSProperties, ReactNode } from 'react'
import { useGameStore } from '../../store/gameStore'

export function PauseMenu() {
  const resumeGame = useGameStore((s) => s.resumeGame)
  const setGameState = useGameStore((s) => s.setGameState)
  const toggleMute = useGameStore((s) => s.toggleMute)
  const isMuted = useGameStore((s) => s.isMuted)
  return (
    <div style={box}>
      <div style={{ color: '#fff', fontSize: '2rem', fontWeight: 900, marginBottom: 16 }}>PAUSED</div>
      <Btn onClick={resumeGame}>Resume</Btn>
      <Btn onClick={toggleMute}>{isMuted ? 'Unmute' : 'Mute'}</Btn>
      <Btn onClick={() => setGameState('menu')}>Main Menu</Btn>
    </div>
  )
}
const box: CSSProperties = { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,30,60,0.65)', zIndex: 20, gap: 10, pointerEvents: 'auto' }
function Btn({ children, onClick }: any) {
  return <button onClick={onClick} style={{ width: 220, padding: '0.85rem', borderRadius: 12, border: 'none', background: '#1a8fd0', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>{children}</button>
}
