import { useEffect, useState, type CSSProperties } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useAccount } from '../../store/account'
import { api, type LeaderboardMetric, type LeaderboardResult } from '../../net/api'
import { coopStageSeconds, fetchCoopLeaderboard, type CoopBoardId, type CoopBoardResult } from '../../net/coop/coopLeaderboard'
import { sounds } from '../../hooks/useAudio'
import { LoginButtons } from './Account'

const TABS: { id: LeaderboardMetric; label: string; unit: string }[] = [
  { id: 'score', label: 'TOTAL SCORE', unit: 'pts' },
  { id: 'sagaStars', label: 'SAGA STARS', unit: '★' },
  { id: 'goldStars', label: 'GOLD STARS', unit: '★' },
]

const COOP_TABS: { id: CoopBoardId; label: string }[] = [
  { id: 'stage', label: 'STAGES' },
  { id: 'kills', label: 'KILLS' },
  { id: 'score', label: 'SCORE' },
]

const MEDALS = ['🥇', '🥈', '🥉']

function coopValue(board: CoopBoardId, score: number, subscore: number): string {
  if (board === 'kills') return score.toLocaleString()
  if (board === 'score') return score.toLocaleString()
  const secs = coopStageSeconds(subscore)
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${score} · ${m}:${String(s).padStart(2, '0')}`
}

/** Rankings by total best score, objective stars and lifetime gold stars (logged-in only). */
export function Leaderboard() {
  const close = useGameStore((s) => s.closeHangar)
  const status = useAccount((s) => s.status)
  const [section, setSection] = useState<'solo' | 'coop'>('solo')
  const [tab, setTab] = useState<LeaderboardMetric>('score')
  const [coopTab, setCoopTab] = useState<CoopBoardId>('stage')
  const [data, setData] = useState<LeaderboardResult | null>(null)
  const [coopData, setCoopData] = useState<CoopBoardResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (section !== 'solo' || status !== 'user') return
    let live = true
    setData(null)
    setError(null)
    api.leaderboard(tab).then((d) => live && setData(d)).catch((e) => live && setError(e.message || 'Could not load the leaderboard'))
    return () => { live = false }
  }, [tab, status, section])

  useEffect(() => {
    if (section !== 'coop') return
    let live = true
    setCoopData(null)
    setError(null)
    fetchCoopLeaderboard(coopTab).then((d) => live && setCoopData(d)).catch((e) => live && setError(e.message || 'Could not load the co-op leaderboard'))
    return () => { live = false }
  }, [coopTab, section])

  const unit = TABS.find((t) => t.id === tab)!.unit
  const inTop = data?.rows.some((r) => r.playerId === data.me.playerId)

  return (
    <div style={overlay}>
      <div style={panel}>
        <div style={header}>
          <button type="button" style={iconBtn} onClick={() => { sounds.uiClick(); close() }} aria-label="Back">←</button>
          <div style={{ flex: 1, textAlign: 'center', ...title }}>LEADERBOARD</div>
          <div style={{ width: 40 }} />
        </div>

        <div style={sections}>
          <button type="button" onClick={() => { sounds.uiClick(); setSection('solo') }} style={{ ...tabBtn, ...(section === 'solo' ? tabActive : {}) }}>SOLO</button>
          <button type="button" onClick={() => { sounds.uiClick(); setSection('coop') }} style={{ ...tabBtn, ...(section === 'coop' ? tabActive : {}) }}>CO-OP</button>
        </div>

        {section === 'coop' ? (
          <CoopList tab={coopTab} onTab={setCoopTab} data={coopData} error={error} />
        ) : status !== 'user' ? (
          <div style={card}>
            <div style={{ fontSize: 40, textAlign: 'center' }}>🏆</div>
            <div style={{ color: '#e8f4ff', textAlign: 'center', fontWeight: 800 }}>Log in to see the leaderboards</div>
            <div style={{ color: '#8eb8d4', textAlign: 'center', fontSize: 12, marginBottom: 6 }}>
              Your runs are recorded and ranked once you're signed in. Guest progress on this device is merged in.
            </div>
            <LoginButtons />
          </div>
        ) : (
          <>
            <div style={tabs}>
              {TABS.map((t) => (
                <button key={t.id} type="button" onClick={() => { sounds.uiClick(); setTab(t.id) }}
                  style={{ ...tabBtn, ...(t.id === tab ? tabActive : {}) }}>{t.label}</button>
              ))}
            </div>
            <div style={list}>
              {error && <div style={{ color: '#ff8a80', textAlign: 'center', padding: 20 }}>{error}</div>}
              {!error && !data && <div style={{ color: '#8eb8d4', textAlign: 'center', padding: 20 }}>Loading…</div>}
              {data && data.rows.length === 0 && <div style={{ color: '#8eb8d4', textAlign: 'center', padding: 20 }}>No pilots ranked yet — be the first!</div>}
              {data?.rows.map((r) => {
                const mine = r.playerId === data.me.playerId
                return (
                  <div key={r.playerId} style={{ ...row, ...(mine ? rowMine : {}) }}>
                    <span style={rankCell}>{r.rank <= 3 ? MEDALS[r.rank - 1] : r.rank}</span>
                    <span style={{ flex: 1, color: mine ? '#ffd54a' : '#e8f4ff', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name}{mine ? ' (you)' : ''}
                    </span>
                    <span style={{ color: '#ffd54a', fontWeight: 900 }}>{r.value.toLocaleString()} <span style={{ fontSize: 10, color: '#8eb8d4' }}>{unit}</span></span>
                  </div>
                )
              })}
            </div>
            {data && !inTop && (
              <div style={{ ...row, ...rowMine }}>
                <span style={rankCell}>{data.me.rank ?? '—'}</span>
                <span style={{ flex: 1, color: '#ffd54a', fontWeight: 800 }}>You</span>
                <span style={{ color: '#ffd54a', fontWeight: 900 }}>{data.me.value.toLocaleString()} <span style={{ fontSize: 10, color: '#8eb8d4' }}>{unit}</span></span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function CoopList({ tab, onTab, data, error }: {
  tab: CoopBoardId
  onTab: (id: CoopBoardId) => void
  data: CoopBoardResult | null
  error: string | null
}) {
  const unit = tab === 'kills' ? 'kills' : tab === 'score' ? 'pts' : ''
  const inTop = !!data?.me && data.rows.some((r) => r.owner === data.me!.owner)
  return (
    <>
      <div style={tabs}>
        {COOP_TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => { sounds.uiClick(); onTab(t.id) }}
            style={{ ...tabBtn, ...(t.id === tab ? tabActive : {}) }}>{t.label}</button>
        ))}
      </div>
      <div style={{ color: '#8eb8d4', fontSize: 11, textAlign: 'center' }}>
        {tab === 'stage' ? 'Stages cleared, then fastest time' : 'Best run by each pilot pair'}
      </div>
      <div style={list}>
        {error && <div style={{ color: '#ff8a80', textAlign: 'center', padding: 20 }}>{error}</div>}
        {!error && !data && <div style={{ color: '#8eb8d4', textAlign: 'center', padding: 20 }}>Loading…</div>}
        {data && data.rows.length === 0 && <div style={{ color: '#8eb8d4', textAlign: 'center', padding: 20 }}>No co-op pairs ranked yet.</div>}
        {data?.rows.map((r) => {
          const mine = !!r.mine || r.owner === data.me?.owner
          return (
            <div key={r.owner} style={{ ...row, ...(mine ? rowMine : {}) }}>
              <span style={rankCell}>{r.rank <= 3 ? MEDALS[r.rank - 1] : r.rank}</span>
              <span style={{ flex: 1, color: mine ? '#ffd54a' : '#e8f4ff', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.names}{mine ? ' (you)' : ''}
              </span>
              <span style={{ color: '#ffd54a', fontWeight: 900 }}>{coopValue(tab, r.score, r.subscore)}{unit && <span style={{ fontSize: 10, color: '#8eb8d4' }}> {unit}</span>}</span>
            </div>
          )
        })}
      </div>
      {data?.me && !inTop && (
        <div style={{ ...row, ...rowMine }}>
          <span style={rankCell}>{data.me.rank ?? '—'}</span>
          <span style={{ flex: 1, color: '#ffd54a', fontWeight: 800 }}>{data.me.names}</span>
          <span style={{ color: '#ffd54a', fontWeight: 900 }}>{coopValue(tab, data.me.score, data.me.subscore)}</span>
        </div>
      )}
    </>
  )
}

const overlay: CSSProperties = {
  position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'auto', display: 'flex', justifyContent: 'center',
  background: 'linear-gradient(180deg, rgba(6,18,36,0.94) 0%, rgba(8,28,48,0.9) 100%)',
  padding: 'max(0.75rem, env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right)) max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left))',
}
const panel: CSSProperties = { width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }
const header: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 }
const title: CSSProperties = { color: '#fff', fontWeight: 900, fontSize: 'clamp(1.2rem, 5vw, 1.6rem)', letterSpacing: 2, textShadow: '0 0 18px rgba(78,196,255,0.5)' }
const iconBtn: CSSProperties = {
  width: 40, height: 40, borderRadius: 12, border: '1px solid rgba(78,196,255,0.35)',
  background: 'rgba(20,40,70,0.8)', color: '#fff', fontSize: 18, cursor: 'pointer',
}
const card: CSSProperties = {
  background: 'rgba(10,24,44,0.92)', border: '1px solid rgba(78,196,255,0.28)', borderRadius: 16, padding: 16,
  display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20,
}
const sections: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }
const tabs: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }
const tabBtn: CSSProperties = {
  padding: '8px 4px', borderRadius: 10, border: '1px solid rgba(78,196,255,0.3)', background: 'rgba(12,28,52,0.9)',
  color: '#9fd6ff', fontWeight: 800, fontSize: 11, letterSpacing: 0.5, cursor: 'pointer',
}
const tabActive: CSSProperties = { background: 'linear-gradient(180deg, #ffd54a, #ff9800)', color: '#1a1200', borderColor: '#ffd54a' }
const list: CSSProperties = {
  flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4,
  background: 'rgba(10,24,44,0.92)', border: '1px solid rgba(78,196,255,0.2)', borderRadius: 14, padding: 8,
}
const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', fontSize: 13 }
const rowMine: CSSProperties = { background: 'rgba(255,213,74,0.12)', border: '1px solid rgba(255,213,74,0.45)' }
const rankCell: CSSProperties = { width: 30, textAlign: 'center', color: '#cfe8f7', fontWeight: 900 }
