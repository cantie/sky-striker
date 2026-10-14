import { useState, type CSSProperties } from 'react'
import { useAccount } from '../../store/account'
import { sounds } from '../../hooks/useAudio'
import { guestCoopAllowed } from '../../net/coop/identity'
import { startNakamaCoop, stopCoop } from '../../net/coop/active'
import { LoginButtons } from './Account'

/** Co-op lobby. Guests get in only while the server's GUEST_COOP flag is on. */
export function CoopLobby({ onClose }: { onClose: () => void }) {
  const status = useAccount((s) => s.status)
  const config = useAccount((s) => s.config)
  const [code, setCode] = useState('')
  const [room, setRoom] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [needLogin, setNeedLogin] = useState(false)

  const guest = status !== 'user'
  const blocked = guest && !guestCoopAllowed(config?.guestCoop)

  const go = async (room: 'create' | 'match' | { join: string }) => {
    setError(null)
    setBusy(true)
    sounds.uiSelect()
    try {
      const assigned = await startNakamaCoop(room)
      setRoom(assigned ?? null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not join co-op'
      if (/log in/i.test(msg)) setNeedLogin(true)
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={overlay}>
      <div style={panel}>
        <button type="button" style={back} onClick={() => { sounds.uiClick(); void stopCoop(); onClose() }}>← MENU</button>
        <div style={title}>CO-OP</div>
        <div style={sub}>Two pilots, one campaign</div>

        {status === 'init' || status === 'busy' ? (
          <div style={hint}>Signing in…</div>
        ) : blocked || needLogin ? (
          <div style={card}>
            <div style={{ color: '#e8f4ff', fontWeight: 800, textAlign: 'center' }}>Log in to play co-op</div>
            <div style={hint}>Guest co-op is turned off on this server. A signed-in pilot can still fly.</div>
            <LoginButtons />
          </div>
        ) : room ? (
          <div style={card}>
            <div style={hint}>Waiting for a wingmate</div>
            <div style={codeText}>{room}</div>
            <div style={hint}>Share this code. The run starts when you are both ready.</div>
          </div>
        ) : (
          <>
            <button type="button" style={primary} disabled={busy} onClick={() => void go('match')}>
              {busy ? 'JOINING…' : 'QUICK MATCH'}
            </button>
            <button type="button" style={secondary} disabled={busy} onClick={() => void go('create')}>
              CREATE ROOM
            </button>
            <form style={row} onSubmit={(e) => { e.preventDefault(); if (code.trim()) void go({ join: code.trim() }) }}>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ROOM CODE" maxLength={5} style={input} />
              <button type="submit" disabled={busy || code.trim().length !== 5} style={join}>JOIN</button>
            </form>
          </>
        )}
        {error && <div style={err}>{error}</div>}
        {guest && !blocked && (
          <div style={hint}>Playing as Guest. This device keeps the same guest id.</div>
        )}
      </div>
    </div>
  )
}

const overlay: CSSProperties = {
  position: 'absolute', inset: 0, zIndex: 30, pointerEvents: 'auto',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(4,14,28,0.94)',
  padding: 16,
}
const panel: CSSProperties = { width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 10 }
const back: CSSProperties = {
  alignSelf: 'flex-start', background: 'transparent', border: '1px solid rgba(78,196,255,0.4)',
  color: '#9fd6ff', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', fontWeight: 700,
}
const title: CSSProperties = { color: '#fff', fontWeight: 900, fontSize: '2rem', letterSpacing: 2, textAlign: 'center' }
const sub: CSSProperties = { color: '#7ec8ef', textAlign: 'center', marginTop: -6 }
const card: CSSProperties = {
  background: 'rgba(8,22,40,0.9)', border: '1px solid rgba(78,196,255,0.28)', borderRadius: 14, padding: 14,
  display: 'flex', flexDirection: 'column', gap: 8,
}
const hint: CSSProperties = { color: '#8eb8d4', fontSize: 12, textAlign: 'center', lineHeight: 1.45 }
const primary: CSSProperties = {
  width: '100%', padding: '1rem', border: 'none', borderRadius: 14, cursor: 'pointer',
  background: 'linear-gradient(180deg, #ffd54a, #ff9800)', color: '#1a1200', fontWeight: 900, letterSpacing: 1,
}
const secondary: CSSProperties = {
  ...primary, background: 'linear-gradient(180deg, #5ec8ff, #1a8fd0)', color: '#fff',
}
const row: CSSProperties = { display: 'flex', gap: 8 }
const input: CSSProperties = {
  flex: 1, minWidth: 0, padding: '0.75rem', borderRadius: 12, border: '1px solid rgba(78,196,255,0.4)',
  background: 'rgba(4,14,28,0.9)', color: '#fff', fontWeight: 800, letterSpacing: 2, textAlign: 'center',
}
const join: CSSProperties = { ...secondary, width: 'auto', padding: '0 16px' }
const codeText: CSSProperties = { color: '#ffd54a', fontWeight: 900, fontSize: '2rem', letterSpacing: 6, textAlign: 'center' }
const err: CSSProperties = { color: '#ff8a80', fontSize: 12, textAlign: 'center' }
