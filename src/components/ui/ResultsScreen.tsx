import type { CSSProperties } from 'react'
import { useGameStore } from '../../store/gameStore'
import { getStage, TOTAL_STAGES } from '../../game/stages'
import { isStageUnlocked, totalStarsPossible } from '../../game/progress'
import { onPlayGesture, sounds } from '../../hooks/useAudio'

export function ResultsScreen() {
  const won = useGameStore((s) => s.lastResultWon)
  const score = useGameStore((s) => s.score)
  const stageId = useGameStore((s) => s.currentStageId)
  const earned = useGameStore((s) => s.earnedObjectives)
  const runStats = useGameStore((s) => s.runStats)
  const progress = useGameStore((s) => s.progress)
  const startGame = useGameStore((s) => s.startGame)
  const goToStageSelect = useGameStore((s) => s.goToStageSelect)
  const openBriefing = useGameStore((s) => s.openBriefing)

  const stage = getStage(stageId)
  const total = totalStarsPossible(stageId)
  const destroyPct =
    runStats.enemiesSpawned > 0
      ? Math.round((runStats.enemiesKilled / runStats.enemiesSpawned) * 100)
      : 0
  const nextId = stageId + 1
  const nextUnlocked = isStageUnlocked(progress, nextId)

  const retry = async () => {
    sounds.uiSelect()
    await onPlayGesture()
    startGame({ stageId })
  }

  const next = async () => {
    if (!nextUnlocked) return
    sounds.uiSelect()
    openBriefing(nextId)
  }

  return (
    <div style={overlay}>
      <div style={panel}>
        <div style={{ ...banner, color: won ? '#9fe870' : '#ff6b6b' }}>
          {won ? 'MISSION COMPLETE' : 'MISSION FAILED'}
        </div>
        <div style={stageName}>{stage.name}</div>
        <div style={scoreLine}>SCORE {score.toLocaleString()}</div>
        <div style={statLine}>
          DESTROYED {destroyPct}% · KILLS {runStats.enemiesKilled}/{runStats.enemiesSpawned}
          {' · '}PICKUPS {runStats.pickupsCollected}/{runStats.pickupsSpawned}
          {runStats.tookDamage ? '' : ' · UNTOUCHED'}
        </div>

        <div style={sectionTitle}>STARS EARNED THIS RUN</div>
        <div style={starBox}>
          {stage.objectives.map((o) => {
            const got = earned.includes(o.id)
            return (
              <div key={o.id} style={{ ...objRow, opacity: got ? 1 : 0.4 }}>
                <span style={{ width: 24 }}>{o.icon}</span>
                <span style={{ flex: 1, fontWeight: 700, fontSize: 12, color: got ? '#e8f7ff' : '#8899aa' }}>
                  {o.label}
                </span>
                <span style={{ color: got ? '#ffd54a' : 'rgba(255,255,255,0.2)', fontSize: 18 }}>
                  {got ? '★' : '☆'}
                </span>
              </div>
            )
          })}
        </div>
        <div style={{ textAlign: 'center', color: '#ffd54a', fontWeight: 800, marginTop: 4 }}>
          ★ {earned.length}/{total}
        </div>

        <button type="button" style={primary} onClick={() => void retry()}>RETRY</button>
        {won && nextId <= TOTAL_STAGES && (
          <button
            type="button"
            style={{ ...primary, background: nextUnlocked ? 'linear-gradient(180deg,#5ec8ff,#1a8fd0)' : '#445', boxShadow: nextUnlocked ? '0 6px 0 #0d5f90' : 'none' }}
            disabled={!nextUnlocked}
            onClick={() => void next()}
          >
            {nextUnlocked ? `NEXT — STAGE ${nextId}` : 'NEXT LOCKED'}
          </button>
        )}
        <button type="button" style={ghost} onClick={() => { sounds.uiClick(); goToStageSelect() }}>
          SAGA MAP
        </button>
      </div>
    </div>
  )
}

const overlay: CSSProperties = {
  position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'auto',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(4,12,24,0.82)',
  padding: 'max(0.75rem, env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right)) max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left))',
  overflowY: 'auto',
}
const panel: CSSProperties = {
  width: '100%', maxWidth: 400,
  display: 'flex', flexDirection: 'column', gap: 8,
  background: 'rgba(10,22,40,0.95)', border: '1px solid rgba(78,196,255,0.3)',
  borderRadius: 18, padding: 16,
  boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
}
const banner: CSSProperties = {
  fontWeight: 900, fontSize: 'clamp(1.4rem, 6vw, 1.9rem)', textAlign: 'center',
  letterSpacing: 1, textShadow: '0 0 16px currentColor',
}
const stageName: CSSProperties = { color: '#7ec8ef', textAlign: 'center', fontWeight: 700, fontSize: 13 }
const scoreLine: CSSProperties = { color: '#fff', textAlign: 'center', fontWeight: 800, fontSize: '1.15rem' }
const statLine: CSSProperties = { color: '#8eb8d4', textAlign: 'center', fontSize: 11, lineHeight: 1.4 }
const sectionTitle: CSSProperties = {
  color: '#4ec4ff', fontWeight: 800, fontSize: 11, letterSpacing: 2, marginTop: 6,
}
const starBox: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 }
const objRow: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '7px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.04)',
}
const primary: CSSProperties = {
  width: '100%', padding: '0.9rem', border: 'none', borderRadius: 12, marginTop: 6,
  background: 'linear-gradient(180deg, #ffd54a, #ff9800)', color: '#1a1200',
  fontWeight: 900, fontSize: '1.05rem', letterSpacing: 1, cursor: 'pointer',
  boxShadow: '0 6px 0 #c77700',
}
const ghost: CSSProperties = {
  width: '100%', padding: '0.75rem', border: '1px solid rgba(255,255,255,0.25)',
  borderRadius: 12, background: 'rgba(255,255,255,0.08)', color: '#fff',
  fontWeight: 700, cursor: 'pointer',
}
