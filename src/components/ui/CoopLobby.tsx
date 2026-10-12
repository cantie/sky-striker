import { useEffect, useState, type CSSProperties } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useAccount } from '../../store/account'
import { activeSession, lastRoomCode, startNakamaCoop, stopCoop } from '../../net/coop/active'
import { takeCoopError } from '../../net/coop/coopError'
import { getPlane } from '../../game/planes'
import { sounds } from '../../hooks/useAudio'
import { LoginButtons } from './Account'
import { useCoopStatus } from './useCoop'

/** Co-op lobby: quick match / create a room / join by code, then the room with both pilots and READY. */
export function CoopLobby() {
  const setGameState = useGameStore((s) => s.setGameState)
  const status = useAccount((s) => s.status)
  const { status: room, roster } = useCoopStatus(200)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(() => takeCoopError())
  const [code, setCode] = useState('')
  const rejoin = lastRoomCode()

  useEffect(() => {
    // Back in the lobby with a finished or dead session: clean it up
    const s = activeSession()
    if (s && (s.phase === 'complete' || s.phase === 'failed')) void stopCoop()
  }, [])

  const go = async (target: 'create' | 'match' | { code: string }) => {
    sounds.uiSelect()
    setBusy(true)
    setError(null)
    try { await startNakamaCoop(target) } catch (e) { setError((e as Error).message || 'Could not connect') }
    setBusy(false)
  }
  const leave = async () => { sounds.uiClick(); await stopCoop() }
  const back = async () => { sounds.uiClick(); await stopCoop(); setGameState('menu') }

  const inRoom = room && room.phase === 'lobby'
  const me = roster.find((r) => r.id === room?.selfId)

  return (
    <div style={overlay}>
      <div style={panel}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" style={iconBtn} onClick={back} aria-label="Back">←</button>
          <div style={{ flex: 1, textAlign: 'center', ...title }}>CO-OP</div>
          <div style={{ width: 40 }} />
        </div>
        <div style={{ color: '#9fd6ff', textAlign: 'center', fontSize: 13 }}>
          Two pilots, all 10 stages back to back. Revive your wingmate by hovering over their beacon.
        </div>

        {status !== 'user' ? (
          <div style={card}>
            <div style={{ color: '#e8f4ff', textAlign: 'center', fontWeight: 800 }}>Log in to fly co-op</div>
            <LoginButtons />
          </div>
        ) : inRoom ? (
          <div style={card}>
            <div style={{ color: '#8eb8d4', fontSize: 12, textAlign: 'center' }}>ROOM CODE — share it with your wingmate</div>
            <button type="button" style={codeBox} onClick={() => { if (room.code) void navigator.clipboard?.writeText(room.code) }}>
              {room.code ?? '—'}
            </button>
            {[0, 1].map((i) => {
              const p = roster[i]
              return (
                <div key={i} style={slot}>
                  <span style={{ flex: 1, color: p ? '#e8f4ff' : '#5f7d94', fontWeight: 800 }}>
                    {p ? `${p.name}${p.id === room.selfId ? ' (you)' : ''}` : 'Waiting for a wingmate…'}
                  </span>
                  {p && <span style={{ color: '#9fd6ff', fontSize: 12 }}>{getPlane(p.plane).name}</span>}
                  {p && <span style={{ color: p.ready ? '#3dff8a' : '#ffb74d', fontWeight: 900, fontSize: 12 }}>{p.ready ? 'READY' : '…'}</span>}
                </div>
              )
            })}
            <button type="button" style={btnPrimary} disabled={room.ready || me?.ready}
              onClick={() => { sounds.uiSelect(); activeSession()?.ready() }}>
              {room.ready || me?.ready ? 'WAITING FOR WINGMATE…' : 'READY'}
            </button>
            <button type="button" style={btnGhost} onClick={leave}>LEAVE ROOM</button>
          </div>
        ) : (
          <div style={card}>
            <button type="button" style={btnPrimary} disabled={busy} onClick={() => go('match')}>⚡ QUICK MATCH</button>
            <button type="button" style={{ ...btnPrimary, background: 'linear-gradient(180deg, #5ec8ff, #1a8fd0)', color: '#fff', boxShadow: '0 6px 0 #0d5f90' }}
              disabled={busy} onClick={() => go('create')}>＋ CREATE ROOM</button>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <input value={code} maxLength={5} placeholder="CODE" onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} style={input} />
              <button type="button" style={{ ...btnSmall }} disabled={busy || code.length !== 5} onClick={() => go({ code })}>JOIN</button>
            </div>
            {rejoin && <button type="button" style={btnGhost} disabled={busy} onClick={() => go({ code: rejoin })}>↻ REJOIN {rejoin}</button>}
          </div>
        )}
        {busy && <div style={{ color: '#9fd6ff', textAlign: 'center' }}>Connecting…</div>}
        {error && <div style={{ color: '#ff8a80', textAlign: 'center', fontWeight: 700 }}>{error}</div>}
      </div>
    </div>
  )
}

const overlay: CSSProperties = {
  position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center',
  background: 'linear-gradient(180deg, rgba(6,18,36,0.94) 0%, rgba(8,28,48,0.9) 100%)',
  padding: 'max(0.75rem, env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right)) max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left))',
}
const panel: CSSProperties = { width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 10 }
const title: CSSProperties = { color: '#fff', fontWeight: 900, fontSize: 'clamp(1.2rem, 5vw, 1.6rem)', letterSpacing: 2, textShadow: '0 0 18px rgba(61,255,138,0.5)' }
const iconBtn: CSSProperties = { width: 40, height: 40, borderRadius: 12, border: '1px solid rgba(78,196,255,0.35)', background: 'rgba(20,40,70,0.8)', color: '#fff', fontSize: 18, cursor: 'pointer' }
const card: CSSProperties = { background: 'rgba(10,24,44,0.92)', border: '1px solid rgba(78,196,255,0.28)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }
const btnPrimary: CSSProperties = {
  display: 'block', width: '100%', padding: '0.85rem 1rem', border: 'none', borderRadius: 14,
  background: 'linear-gradient(180deg, #5dffa0, #1fae5b)', color: '#062312', fontWeight: 900, fontSize: '1.05rem', cursor: 'pointer', boxShadow: '0 6px 0 #11733a',
}
const btnGhost: CSSProperties = { ...btnPrimary, background: 'rgba(255,255,255,0.12)', color: '#fff', boxShadow: 'none', fontSize: '0.9rem' }
const btnSmall: CSSProperties = { ...btnPrimary, width: 'auto', padding: '0.6rem 1.1rem', fontSize: '0.95rem' }
const input: CSSProperties = {
  flex: 1, padding: '0.6rem 0.8rem', borderRadius: 12, border: '1px solid rgba(78,196,255,0.4)', background: 'rgba(5,14,28,0.9)',
  color: '#fff', fontWeight: 900, fontSize: '1.1rem', letterSpacing: 4, textAlign: 'center',
}
const codeBox: CSSProperties = {
  padding: '0.6rem', borderRadius: 12, border: '1px dashed rgba(61,255,138,0.6)', background: 'rgba(61,255,138,0.08)',
  color: '#3dff8a', fontWeight: 900, fontSize: '2rem', letterSpacing: 8, textAlign: 'center', cursor: 'copy',
}
const slot: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)' }
