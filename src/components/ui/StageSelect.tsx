import type { CSSProperties } from 'react'
import { useGameStore } from '../../store/gameStore'
import { STAGES } from '../../game/stages'
import { isStageUnlocked, countStars, totalStarsPossible } from '../../game/progress'
import { sounds, syncMute } from '../../hooks/useAudio'

export function StageSelect() {
  const progress = useGameStore((s) => s.progress)
  const selectedStageId = useGameStore((s) => s.selectedStageId)
  const selectStage = useGameStore((s) => s.selectStage)
  const openBriefing = useGameStore((s) => s.openBriefing)
  const setGameState = useGameStore((s) => s.setGameState)
  const isMuted = useGameStore((s) => s.isMuted)
  const toggleMute = useGameStore((s) => s.toggleMute)

  const selected = STAGES.find((s) => s.id === selectedStageId) ?? STAGES[0]
  const unlocked = isStageUnlocked(progress, selected.id)
  const stageProg = progress.stages[selected.id]
  const earned = countStars(progress, selected.id)
  const total = totalStarsPossible(selected.id)

  return (
    <div style={overlay}>
      <div style={panel}>
        <div style={headerRow}>
          <button
            type="button"
            style={iconBtn}
            onClick={() => { sounds.uiClick(); setGameState('menu') }}
            aria-label="Back"
          >
            ←
          </button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={title}>SAGA MAP</div>
            <div style={subtitle}>Select a stage</div>
          </div>
          <button
            type="button"
            style={iconBtn}
            onClick={() => { sounds.uiClick(); toggleMute(); syncMute() }}
            aria-label="Mute"
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>

        {/* Path with nodes */}
        <div style={pathWrap}>
          <div style={pathLine} />
          <div style={nodesRow}>
            {STAGES.map((stage) => {
              const open = isStageUnlocked(progress, stage.id)
              const stars = countStars(progress, stage.id)
              const max = totalStarsPossible(stage.id)
              const active = stage.id === selectedStageId
              return (
                <button
                  key={stage.id}
                  type="button"
                  disabled={!open}
                  onClick={() => { sounds.uiClick(); selectStage(stage.id) }}
                  style={{
                    ...nodeBtn,
                    opacity: open ? 1 : 0.45,
                    borderColor: active ? '#ffd54a' : open ? '#4ec4ff' : '#445',
                    boxShadow: active
                      ? '0 0 0 2px #ffd54a, 0 0 18px rgba(255,213,74,0.45)'
                      : open
                        ? '0 0 12px rgba(78,196,255,0.35)'
                        : 'none',
                  }}
                >
                  <div style={starCluster}>
                    {Array.from({ length: max }, (_, i) => (
                      <span
                        key={i}
                        style={{
                          color: i < stars ? '#ffd54a' : 'rgba(255,255,255,0.25)',
                          fontSize: 11,
                          textShadow: i < stars ? '0 0 6px #ffd54a' : 'none',
                        }}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <div style={nodeNum}>{String(stage.id).padStart(2, '0')}</div>
                  {!open && <div style={lockBadge}>🔒</div>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Briefing preview */}
        <div style={briefCard}>
          <div style={stageTitle}>{selected.name}</div>
          <div style={stageSub}>{selected.subtitle}</div>
          <div style={metaRow}>
            <span style={badge(selected.difficulty)}>{selected.difficulty}</span>
            <span style={metaText}>
              HI {stageProg?.highScore?.toLocaleString() ?? 0}
            </span>
            <span style={metaText}>
              ★ {earned}/{total}
            </span>
          </div>
          <div style={objList}>
            {selected.objectives.map((o) => {
              const got = stageProg?.stars?.includes(o.id)
              return (
                <div key={o.id} style={objRow}>
                  <span style={{ width: 22 }}>{o.icon}</span>
                  <span style={{ flex: 1, color: got ? '#9fe870' : '#cfe8f7' }}>{o.label}</span>
                  <span style={{ color: got ? '#ffd54a' : 'rgba(255,255,255,0.25)' }}>★</span>
                </div>
              )
            })}
          </div>
        </div>

        <button
          type="button"
          disabled={!unlocked}
          style={{ ...startBtn, opacity: unlocked ? 1 : 0.4 }}
          onClick={() => {
            if (!unlocked) return
            sounds.uiSelect()
            openBriefing(selected.id)
          }}
        >
          CONTINUE
        </button>
      </div>
    </div>
  )
}

function badge(diff: string): CSSProperties {
  const bg =
    diff === 'EASY' ? '#2e7d32' : diff === 'HARD' ? '#c62828' : '#ef6c00'
  return {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 999,
    background: bg,
    color: '#fff',
    fontWeight: 800,
    fontSize: 11,
    letterSpacing: 0.5,
  }
}

const overlay: CSSProperties = {
  position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'auto',
  display: 'flex', alignItems: 'stretch', justifyContent: 'center',
  background: 'linear-gradient(180deg, rgba(6,18,36,0.92) 0%, rgba(8,28,48,0.88) 100%)',
  padding: 'max(0.75rem, env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right)) max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left))',
  overflowY: 'auto',
}
const panel: CSSProperties = {
  width: '100%', maxWidth: 420, margin: '0 auto',
  display: 'flex', flexDirection: 'column', gap: 14,
}
const headerRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 }
const title: CSSProperties = {
  color: '#fff', fontWeight: 900, fontSize: 'clamp(1.2rem, 5vw, 1.6rem)',
  letterSpacing: 2, textShadow: '0 0 18px rgba(78,196,255,0.5)',
}
const subtitle: CSSProperties = { color: '#8eb8d4', fontSize: 12, marginTop: 2 }
const iconBtn: CSSProperties = {
  width: 40, height: 40, borderRadius: 12, border: '1px solid rgba(78,196,255,0.35)',
  background: 'rgba(20,40,70,0.8)', color: '#fff', fontSize: 18, cursor: 'pointer',
}
const pathWrap: CSSProperties = { position: 'relative', padding: '18px 8px 8px' }
const pathLine: CSSProperties = {
  position: 'absolute', left: '12%', right: '12%', top: 52,
  height: 4, borderRadius: 4,
  background: 'linear-gradient(90deg, #4ec4ff, #ff9800, #ff5252)',
  opacity: 0.55,
}
const nodesRow: CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, position: 'relative',
}
const nodeBtn: CSSProperties = {
  flex: 1, background: 'rgba(12,28,52,0.95)', border: '2px solid #4ec4ff',
  borderRadius: 16, padding: '8px 4px 10px', cursor: 'pointer', color: '#fff',
  position: 'relative',
}
const starCluster: CSSProperties = {
  display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1, minHeight: 28, marginBottom: 4,
}
const nodeNum: CSSProperties = {
  fontWeight: 900, fontSize: '1.35rem', letterSpacing: 1, color: '#e8f7ff',
}
const lockBadge: CSSProperties = { position: 'absolute', top: 4, right: 6, fontSize: 12 }
const briefCard: CSSProperties = {
  background: 'rgba(10,24,44,0.92)', border: '1px solid rgba(78,196,255,0.28)',
  borderRadius: 16, padding: '14px 14px 10px',
  boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
}
const stageTitle: CSSProperties = {
  color: '#fff', fontWeight: 900, fontSize: '1.45rem', letterSpacing: 1,
}
const stageSub: CSSProperties = { color: '#7ec8ef', fontSize: 13, marginBottom: 8 }
const metaRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }
const metaText: CSSProperties = { color: '#cfe8f7', fontSize: 12, fontWeight: 700 }
const objList: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 }
const objRow: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700,
  padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.04)',
}
const startBtn: CSSProperties = {
  width: '100%', padding: '1rem', border: 'none', borderRadius: 14,
  background: 'linear-gradient(180deg, #ffd54a, #ff9800)', color: '#1a1a1a',
  fontWeight: 900, fontSize: '1.2rem', letterSpacing: 2, cursor: 'pointer',
  boxShadow: '0 6px 0 #c77700', marginTop: 4,
}
