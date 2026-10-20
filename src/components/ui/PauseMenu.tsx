import type { CSSProperties } from 'react'
import { useGameStore } from '../../store/gameStore'
import { getStage } from '../../game/stages'
import { sounds, syncMute } from '../../hooks/useAudio'

export function PauseMenu() {
  const resumeGame = useGameStore((s) => s.resumeGame)
  const goToStageSelect = useGameStore((s) => s.goToStageSelect)
  const toggleMute = useGameStore((s) => s.toggleMute)
  const isMuted = useGameStore((s) => s.isMuted)
  const stageId = useGameStore((s) => s.currentStageId)
  const runStats = useGameStore((s) => s.runStats)
  const stage = getStage(stageId)

  const destroyPct =
    runStats.enemiesSpawned > 0
      ? Math.round((runStats.enemiesKilled / runStats.enemiesSpawned) * 100)
      : 0

  return (
    <div style={box}>
      <div style={{ color: '#fff', fontSize: '2rem', fontWeight: 900, marginBottom: 4 }}>PAUSED</div>
      <div style={{ color: '#7ec8ef', fontWeight: 700, marginBottom: 12 }}>{stage.name}</div>

      <div style={objBox}>
        <div style={objTitle}>OBJECTIVES</div>
        {stage.objectives.map((o) => {
          let hint = ''
          if (o.id === 'destroy70' || o.id === 'destroy100') hint = ` (${destroyPct}%)`
          if (o.id === 'untouched') hint = runStats.tookDamage ? ' (hit)' : ' (clean)'
          if (o.id === 'collectAll') {
            hint = ` (${runStats.pickupsCollected}/${runStats.pickupsSpawned})`
          }
          if (o.id === 'defeatBoss') hint = runStats.bossDefeated ? ' ✓' : ''
          return (
            <div key={o.id} style={objRow}>
              <span>{o.icon}</span>
              <span style={{ flex: 1 }}>{o.label}{hint}</span>
            </div>
          )
        })}
      </div>

      <Btn onClick={() => { sounds.uiClick(); resumeGame() }}>Resume</Btn>
      <Btn onClick={() => { sounds.uiClick(); toggleMute(); syncMute() }}>{isMuted ? 'Unmute' : 'Mute'}</Btn>
      <Btn onClick={() => { sounds.uiClick(); goToStageSelect() }}>Saga Map</Btn>
    </div>
  )
}

const box: CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  background: 'rgba(0,20,40,0.78)', zIndex: 20, gap: 10, pointerEvents: 'auto',
  padding: 16,
}
const objBox: CSSProperties = {
  width: 'min(100%, 340px)', background: 'rgba(8,22,40,0.95)',
  border: '1px solid rgba(78,196,255,0.3)', borderRadius: 12, padding: 10, marginBottom: 8,
}
const objTitle: CSSProperties = {
  color: '#4ec4ff', fontWeight: 800, fontSize: 11, letterSpacing: 2, marginBottom: 6,
}
const objRow: CSSProperties = {
  display: 'flex', gap: 8, color: '#cfe8f7', fontSize: 12, fontWeight: 700,
  padding: '4px 0',
}
function Btn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 220, padding: '0.85rem', borderRadius: 12, border: 'none',
        background: '#1a8fd0', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}
