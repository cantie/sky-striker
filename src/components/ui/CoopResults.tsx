import { useEffect, useState, type CSSProperties } from 'react'
import { useGameStore } from '../../store/gameStore'
import { forgetRoom, stopCoop } from '../../net/coop/active'
import { coopLeaderboard, type CoopBoard } from '../../net/coop/coopApi'
import { sounds } from '../../hooks/useAudio'
import { useCoopStatus } from './useCoop'

const fmtTime = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`
const BOARDS: { id: CoopBoard; label: string }[] = [{ id: 'stage', label: 'Furthest stage' }, { id: 'kills', label: 'Team kills' }, { id: 'score', label: 'Team score' }]

/** End of a co-op run: what the pair achieved and where it ranks. */
export function CoopResults() {
  const setGameState = useGameStore((s) => s.setGameState)
  const openLeaderboard = useGameStore((s) => s.openLeaderboard)
  const { summary, status } = useCoopStatus()
  const [ranks, setRanks] = useState<Partial<Record<CoopBoard, number | null>>>({})

  useEffect(() => {
    if (!summary) return
    forgetRoom()
    // The match writes the records as the run ends; give it a moment
    const t = setTimeout(() => {
      for (const b of BOARDS) coopLeaderboard(b.id).then((r) => setRanks((x) => ({ ...x, [b.id]: r.me?.rank ?? null }))).catch(() => {})
    }, 800)
    return () => clearTimeout(t)
  }, [summary])

  const won = summary?.result === 'complete'
  const stages = status?.stages ?? 10
  const leave = async (to: 'menu' | 'coopLobby' | 'leaderboard') => {
    sounds.uiClick()
    await stopCoop()
    if (to === 'leaderboard') openLeaderboard('coop')
    else setGameState(to)
  }

  return (
    <div style={overlay}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ textAlign: 'center', fontSize: 'clamp(1.6rem, 7cqw, 2.4rem)', fontWeight: 900, color: won ? '#ffd23f' : '#ff8a80' }}>
          {won ? 'CAMPAIGN COMPLETE' : 'SQUAD DOWN'}
        </div>
        <div style={{ textAlign: 'center', color: '#9fd6ff', fontWeight: 700 }}>{summary?.names.join(' & ')}</div>
        <div style={card}>
          <Stat label="Stages cleared" value={`${summary?.stagesCleared ?? 0}/${stages}`} />
          <Stat label="Team kills" value={(summary?.kills ?? 0).toLocaleString()} />
          <Stat label="Team score" value={(summary?.score ?? 0).toLocaleString()} />
          <Stat label="Time" value={fmtTime(summary?.timeMs ?? 0)} />
        </div>
        <div style={card}>
          {BOARDS.map((b) => <Stat key={b.id} label={`🏆 ${b.label}`} value={ranks[b.id] ? `#${ranks[b.id]}` : '…'} />)}
        </div>
        <button type="button" style={btnPrimary} onClick={() => leave('coopLobby')}>FLY AGAIN</button>
        <button type="button" style={btnGhost} onClick={() => leave('leaderboard')}>CO-OP LEADERBOARD</button>
        <button type="button" style={btnGhost} onClick={() => leave('menu')}>MENU</button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e8f4ff', fontWeight: 700 }}>
      <span style={{ color: '#8eb8d4' }}>{label}</span><span style={{ fontWeight: 900 }}>{value}</span>
    </div>
  )
}

const overlay: CSSProperties = {
  position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center',
  background: 'linear-gradient(180deg, rgba(6,18,36,0.94) 0%, rgba(8,28,48,0.9) 100%)', padding: '1rem',
}
const card: CSSProperties = { background: 'rgba(10,24,44,0.92)', border: '1px solid rgba(78,196,255,0.28)', borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }
const btnPrimary: CSSProperties = {
  width: '100%', padding: '0.85rem 1rem', border: 'none', borderRadius: 14, background: 'linear-gradient(180deg, #5dffa0, #1fae5b)',
  color: '#062312', fontWeight: 900, fontSize: '1.05rem', cursor: 'pointer', boxShadow: '0 6px 0 #11733a',
}
const btnGhost: CSSProperties = { ...btnPrimary, background: 'rgba(255,255,255,0.12)', color: '#fff', boxShadow: 'none', fontSize: '0.9rem' }
