import { useGameStore } from '../../store/gameStore'
import { getStage } from '../../game/stages'
import { useCoopStatus } from './useCoop'

/** Between co-op stages: what the squad just did, and what's next (the server starts it). */
export function CoopStageClear() {
  const stageId = useGameStore((s) => s.currentStageId)
  const { status, team } = useCoopStatus()
  const index = status?.stageIndex ?? 0
  const stages = status?.stages ?? 10
  const last = index + 1 >= stages
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(4,12,24,0.6)', pointerEvents: 'none' }}>
      <div style={{ textAlign: 'center', color: '#fff', textShadow: '0 2px 6px #000' }}>
        <div style={{ fontSize: 'clamp(1.6rem, 7cqw, 2.4rem)', fontWeight: 900, color: '#ffd23f' }}>STAGE {index + 1}/{stages} CLEAR</div>
        <div style={{ marginTop: 4, color: '#9fd6ff', fontWeight: 700 }}>{getStage(stageId).subtitle}</div>
        <div style={{ marginTop: 14, fontWeight: 800 }}>TEAM {team.score.toLocaleString()} pts · {team.kills} kills</div>
        <div style={{ marginTop: 10, color: '#3dff8a', fontWeight: 800 }}>{last ? 'Final stage cleared!' : `Next: stage ${index + 2} — get ready`}</div>
      </div>
    </div>
  )
}
