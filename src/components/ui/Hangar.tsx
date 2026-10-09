import type { CSSProperties } from 'react'
import { useGameStore } from '../../store/gameStore'
import { PLANES, getPlane, type PlaneDef } from '../../game/planes'
import { sounds } from '../../hooks/useAudio'

/** Stat bars normalised against the best plane in each category. */
const MAX_HP = Math.max(...PLANES.map((p) => p.hp))
const statsOf = (p: PlaneDef) => [
  { label: `HULL · ${p.hp} HITS`, value: p.hp / MAX_HP, color: '#4caf50' },
  { label: 'FIREPOWER', value: p.damage / 1.25, color: '#ff9800' },
  { label: 'FIRE RATE', value: (1 / p.fireRate) / 1.4, color: '#ffd23f' },
]

/** Sky Force–style hangar: the plane turns on a pad in the 3D scene behind this overlay. */
export function Hangar() {
  const progress = useGameStore((s) => s.progress)
  const viewId = useGameStore((s) => s.hangarPlane)
  const view = useGameStore((s) => s.viewHangarPlane)
  const buy = useGameStore((s) => s.buyPlane)
  const choose = useGameStore((s) => s.choosePlane)
  const close = useGameStore((s) => s.closeHangar)

  const plane = getPlane(viewId)
  const index = PLANES.findIndex((p) => p.id === plane.id)
  const owned = progress.owned.includes(plane.id)
  const selected = progress.plane === plane.id
  const affordable = progress.wallet >= plane.price

  const step = (d: number) => {
    sounds.uiClick()
    view(PLANES[(index + d + PLANES.length) % PLANES.length].id)
  }
  const action = () => {
    if (selected) return
    if (owned) { sounds.uiSelect(); choose(plane.id); return }
    if (affordable && buy(plane.id)) sounds.powerup()
  }

  return (
    <div style={overlay}>
      <div style={topBar}>
        <button type="button" style={iconBtn} onClick={() => { sounds.uiClick(); close() }} aria-label="Back">←</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={title}>HANGAR</div>
          <div style={{ color: '#8eb8d4', fontSize: 11 }}>{index + 1} / {PLANES.length}</div>
        </div>
        <div style={wallet}>★ {progress.wallet.toLocaleString()}</div>
      </div>

      {/* Middle stays clear so the 3D plane shows; arrows sit either side of it */}
      <div style={stage}>
        <button type="button" style={arrow} onClick={() => step(-1)} aria-label="Previous plane">◀</button>
        <div style={{ flex: 1 }} />
        <button type="button" style={arrow} onClick={() => step(1)} aria-label="Next plane">▶</button>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ ...planeName, color: plane.flame }}>{plane.name}</div>
          <div style={{ color: '#8eb8d4', fontSize: 12, flex: 1 }}>{plane.tagline}</div>
          {selected && <span style={chip('#2e7d32')}>FLYING</span>}
          {!owned && <span style={chip('#455')}>🔒 LOCKED</span>}
        </div>

        <div style={skillBox}>
          <div style={{ color: plane.flame, fontWeight: 900, fontSize: 12, letterSpacing: 1 }}>⚡ {plane.skillName}</div>
          <div style={{ color: '#d8ecf8', fontSize: 12, marginTop: 2 }}>{plane.skillText}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {statsOf(plane).map((st) => (
            <div key={st.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={statLabel}>{st.label}</span>
              <div style={statTrack}>
                <div style={{ width: `${Math.min(100, st.value * 100)}%`, height: '100%', background: st.color, borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>

        <div style={thumbs}>
          {PLANES.map((p) => {
            const own = progress.owned.includes(p.id)
            const active = p.id === plane.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => { sounds.uiClick(); view(p.id) }}
                style={{
                  ...thumb,
                  borderColor: active ? '#ffd54a' : own ? p.flame : 'rgba(255,255,255,0.15)',
                  boxShadow: active ? '0 0 10px rgba(255,213,74,0.6)' : 'none',
                  opacity: own ? 1 : 0.6,
                }}
                aria-label={p.name}
              >
                <span style={{ color: p.flame, fontWeight: 900, fontSize: 11 }}>{p.name.slice(0, 3)}</span>
                <span style={{ fontSize: 9, color: own ? '#9fe870' : '#ffd54a' }}>
                  {progress.plane === p.id ? '✓' : own ? 'OWNED' : `★${p.price}`}
                </span>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={action}
          disabled={selected || (!owned && !affordable)}
          style={{
            ...mainBtn,
            ...(selected
              ? { background: '#2e7d32', boxShadow: '0 5px 0 #1b4d1e', color: '#fff' }
              : !owned && !affordable
                ? { background: '#3a4250', boxShadow: 'none', color: '#99a', cursor: 'default' }
                : {}),
          }}
        >
          {selected ? 'SELECTED ✓' : owned ? 'FLY THIS PLANE' : affordable ? `UNLOCK — ★ ${plane.price}` : `NEED ★ ${plane.price - progress.wallet} MORE`}
        </button>
      </div>
    </div>
  )
}

function chip(bg: string): CSSProperties {
  return { background: bg, color: '#fff', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 800 }
}

const overlay: CSSProperties = {
  position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none',
  display: 'flex', flexDirection: 'column',
  padding: 'max(0.6rem, env(safe-area-inset-top)) max(0.6rem, env(safe-area-inset-right)) max(0.6rem, env(safe-area-inset-bottom)) max(0.6rem, env(safe-area-inset-left))',
  background: 'radial-gradient(ellipse at 50% 32%, rgba(4,14,28,0) 0%, rgba(4,14,28,0.35) 45%, rgba(4,14,28,0.88) 85%)',
}
const topBar: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto' }
const title: CSSProperties = { color: '#fff', fontWeight: 900, fontSize: 'clamp(1.2rem, 5vw, 1.6rem)', letterSpacing: 3, textShadow: '0 0 16px rgba(78,196,255,0.6)' }
const wallet: CSSProperties = {
  color: '#ffd54a', fontWeight: 900, fontSize: 15, padding: '6px 10px', borderRadius: 10,
  background: 'rgba(10,22,40,0.85)', border: '1px solid rgba(255,213,74,0.4)', minWidth: 70, textAlign: 'center',
}
const iconBtn: CSSProperties = {
  width: 40, height: 40, borderRadius: 12, border: '1px solid rgba(78,196,255,0.35)',
  background: 'rgba(20,40,70,0.85)', color: '#fff', fontSize: 18, cursor: 'pointer',
}
const stage: CSSProperties = { flex: 1, display: 'flex', alignItems: 'center', pointerEvents: 'none', minHeight: 160 }
const arrow: CSSProperties = {
  pointerEvents: 'auto', width: 44, height: 64, borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(10,22,40,0.6)', color: '#fff', fontSize: 20, cursor: 'pointer',
}
const card: CSSProperties = {
  pointerEvents: 'auto', width: '100%', maxWidth: 440, margin: '0 auto',
  background: 'rgba(10,22,40,0.94)', border: '1px solid rgba(78,196,255,0.28)', borderRadius: 16,
  padding: 12, display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
}
const planeName: CSSProperties = { fontWeight: 900, fontSize: '1.5rem', letterSpacing: 2, textShadow: '0 0 12px currentColor' }
const skillBox: CSSProperties = { background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '8px 10px' }
const statLabel: CSSProperties = { width: 92, color: '#cfe8f7', fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }
const statTrack: CSSProperties = { flex: 1, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }
const thumbs: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 4 }
const thumb: CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 0',
  borderRadius: 8, border: '2px solid', background: 'rgba(255,255,255,0.04)', cursor: 'pointer', minWidth: 0,
}
const mainBtn: CSSProperties = {
  width: '100%', padding: '0.85rem', border: 'none', borderRadius: 12,
  background: 'linear-gradient(180deg, #ffd54a, #ff9800)', color: '#1a1200',
  fontWeight: 900, fontSize: '1.05rem', letterSpacing: 1, cursor: 'pointer', boxShadow: '0 5px 0 #c77700',
}
