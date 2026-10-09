import { useState, type CSSProperties } from 'react'
import { useAccount } from '../../store/account'
import { sounds } from '../../hooks/useAudio'

/** Keycloak login (and the dev-only local login when the server allows it). */
export function LoginButtons() {
  const config = useAccount((s) => s.config)
  const status = useAccount((s) => s.status)
  const loginKeycloak = useAccount((s) => s.loginKeycloak)
  const loginLocal = useAccount((s) => s.loginLocal)
  const [name, setName] = useState('')
  const busy = status === 'busy' || status === 'init'

  if (!config?.keycloak && !config?.localLogin) {
    return <div style={{ color: '#8eb8d4', fontSize: 12, textAlign: 'center' }}>Online accounts are unavailable right now.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {config?.keycloak && (
        <button type="button" disabled={busy} style={loginBtn} onClick={() => { sounds.uiSelect(); void loginKeycloak() }}>
          {busy ? 'SIGNING IN…' : '🔐 LOG IN'}
        </button>
      )}
      {config?.localLogin && (
        <form style={{ display: 'flex', gap: 6 }} onSubmit={(e) => { e.preventDefault(); if (name.trim()) { sounds.uiSelect(); void loginLocal(name.trim()) } }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="dev pilot name" maxLength={24} style={input} />
          <button type="submit" disabled={busy || !name.trim()} style={{ ...loginBtn, width: 'auto', padding: '0 14px', fontSize: 13 }}>DEV LOGIN</button>
        </form>
      )}
    </div>
  )
}

/** Main-menu account strip: guest prompt or "signed in as". */
export function AccountPanel() {
  const status = useAccount((s) => s.status)
  const user = useAccount((s) => s.user)
  const error = useAccount((s) => s.error)
  const offline = useAccount((s) => s.offline)
  const logout = useAccount((s) => s.logout)

  return (
    <div style={box}>
      {status === 'user' && user ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>👨‍✈️</span>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ color: '#fff', fontWeight: 900 }}>{user.name}</div>
            <div style={{ color: offline ? '#ffb02e' : '#9fe870', fontSize: 11, fontWeight: 700 }}>
              {offline ? 'Offline · progress saved on this device' : 'Signed in · progress synced'}
            </div>
          </div>
          <button type="button" style={ghostBtn} onClick={() => { sounds.uiClick(); logout() }}>LOG OUT</button>
        </div>
      ) : (
        <>
          <div style={{ color: '#cfe8f7', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            Playing as <b style={{ color: '#fff' }}>Guest</b> · log in to save runs online and join the leaderboards
          </div>
          <LoginButtons />
        </>
      )}
      {error && <div style={{ color: '#ff8a80', fontSize: 12, marginTop: 8 }}>{error}</div>}
    </div>
  )
}

const box: CSSProperties = {
  marginTop: 14, padding: 12, borderRadius: 14, textAlign: 'center',
  background: 'rgba(8,22,40,0.75)', border: '1px solid rgba(78,196,255,0.28)',
}
const loginBtn: CSSProperties = {
  width: '100%', padding: '0.7rem', border: 'none', borderRadius: 12, cursor: 'pointer',
  background: 'linear-gradient(180deg, #9be7ff, #3fa9e0)', color: '#04233a', fontWeight: 900, fontSize: '0.95rem', letterSpacing: 1,
  boxShadow: '0 4px 0 #1f6f9a',
}
const ghostBtn: CSSProperties = {
  padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.08)',
  color: '#fff', fontWeight: 800, fontSize: 11, cursor: 'pointer',
}
const input: CSSProperties = {
  flex: 1, minWidth: 0, padding: '0.6rem', borderRadius: 10, border: '1px solid rgba(78,196,255,0.4)',
  background: 'rgba(4,14,28,0.9)', color: '#fff', fontWeight: 700, userSelect: 'text',
}
