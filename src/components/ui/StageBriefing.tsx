import type { CSSProperties } from 'react'
import { useGameStore } from '../../store/gameStore'
import { getStage } from '../../game/stages'
import { countStars, totalStarsPossible } from '../../game/progress'
import { onPlayGesture, sounds } from '../../hooks/useAudio'

export function StageBriefing() {
  const stageId = useGameStore((s) => s.selectedStageId)
  const progress = useGameStore((s) => s.progress)
  const startGame = useGameStore((s) => s.startGame)
  const goToStageSelect = useGameStore((s) => s.goToStageSelect)
  const stage = getStage(stageId)
  const earned = countStars(progress, stageId)
  const total = totalStarsPossible(stageId)
  const hi = progress.stages[stageId]?.highScore ?? 0

  const start = async (easy?: boolean) => {
    sounds.uiSelect()
    await onPlayGesture()
    startGame({ stageId, easy })
  }

  return (
    <div style={overlay}>
      <div style={panel}>
        <button type="button" style={backBtn} onClick={() => { sounds.uiClick(); goToStageSelect() }}>
          ← MAP
        </button>

        <div style={stageLabel}>{stage.name}</div>
        <div style={sub}>{stage.subtitle}</div>

        <div style={metaRow}>
          <span style={diffBadge(stage.difficulty)}>{stage.difficulty}</span>
          <span style={meta}>HI SCORE {hi.toLocaleString()}</span>
          <span style={meta}>★ {earned}/{total}</span>
        </div>

        <div style={sectionTitle}>OBJECTIVES</div>
        <div style={objBox}>
          {stage.objectives.map((o) => {
            const got = progress.stages[stageId]?.stars?.includes(o.id)
            return (
              <div key={o.id} style={objRow}>
                <span style={{ fontSize: 18, width: 28 }}>{o.icon}</span>
                <span style={{ flex: 1, color: got ? '#9fe870' : '#e8f4ff', fontWeight: 700, fontSize: 13 }}>
                  {o.label}
                </span>
                <span style={{ color: got ? '#ffd54a' : 'rgba(255,255,255,0.2)', fontSize: 16 }}>★</span>
              </div>
            )
          })}
        </div>

        <div style={{ color: '#8eb8d4', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
          {stage.hasBoss ? 'Boss awaits at the end' : 'Survive all waves to clear'}
          {' · '}
          {stage.biome.toUpperCase()} biome
        </div>

        <button type="button" style={startBtn} onClick={() => void start()}>
          START
        </button>
        <button type="button" style={easyBtn} onClick={() => void start(true)}>
          EASY START
        </button>

        <div style={livesRow}>
          <span style={{ fontSize: 20 }}>✈️</span>
          <span style={{ color: '#cfe8f7', fontWeight: 700, fontSize: 13 }}>× ∞ FREE FLIGHT</span>
        </div>
      </div>
    </div>
  )
}

function diffBadge(diff: string): CSSProperties {
  const bg = diff === 'EASY' ? '#2e7d32' : diff === 'HARD' ? '#c62828' : '#ef6c00'
  return {
    padding: '3px 10px', borderRadius: 999, background: bg, color: '#fff',
    fontWeight: 800, fontSize: 11, letterSpacing: 0.6,
  }
}

const overlay: CSSProperties = {
  position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'auto',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'linear-gradient(180deg, rgba(4,14,28,0.94) 0%, rgba(10,30,50,0.9) 100%)',
  padding: 'max(0.75rem, env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right)) max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left))',
  overflowY: 'auto',
}
const panel: CSSProperties = {
  width: '100%', maxWidth: 400,
  display: 'flex', flexDirection: 'column', gap: 10,
}
const backBtn: CSSProperties = {
  alignSelf: 'flex-start', background: 'transparent', border: '1px solid rgba(78,196,255,0.4)',
  color: '#9fd6ff', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', fontWeight: 700,
}
const stageLabel: CSSProperties = {
  color: '#fff', fontWeight: 900, fontSize: 'clamp(1.8rem, 7vw, 2.4rem)',
  letterSpacing: 2, textAlign: 'center', textShadow: '0 0 24px rgba(78,196,255,0.55)',
}
const sub: CSSProperties = { color: '#7ec8ef', textAlign: 'center', fontSize: 14, marginTop: -4 }
const metaRow: CSSProperties = { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, flexWrap: 'wrap' }
const meta: CSSProperties = { color: '#cfe8f7', fontWeight: 700, fontSize: 12 }
const sectionTitle: CSSProperties = {
  color: '#4ec4ff', fontWeight: 800, fontSize: 12, letterSpacing: 2, marginTop: 6,
}
const objBox: CSSProperties = {
  background: 'rgba(8,22,40,0.9)', border: '1px solid rgba(78,196,255,0.25)',
  borderRadius: 14, padding: 8, display: 'flex', flexDirection: 'column', gap: 4,
}
const objRow: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)',
}
const startBtn: CSSProperties = {
  width: '100%', padding: '1.05rem', border: 'none', borderRadius: 14, marginTop: 8,
  background: 'linear-gradient(180deg, #ffd54a, #ff9800)', color: '#1a1200',
  fontWeight: 900, fontSize: '1.35rem', letterSpacing: 3, cursor: 'pointer',
  boxShadow: '0 7px 0 #c77700',
}
const easyBtn: CSSProperties = {
  width: '100%', padding: '0.75rem', border: 'none', borderRadius: 12,
  background: 'linear-gradient(180deg, #5ec8ff, #1a8fd0)', color: '#fff',
  fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 5px 0 #0d5f90',
}
const livesRow: CSSProperties = {
  display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 4,
}
