import type { CSSProperties, ReactNode } from 'react'
import { useGameStore } from '../../store/gameStore'
import { syncMute, sounds } from '../../hooks/useAudio'
import { getStage } from '../../game/stages'
import { BOSSES } from '../../game/bosses'
import { WEAPON_TIERS, weaponStats } from '../../game/weapon'

/** In-flight HUD: one compact top row (score · HP/shield/weapon · buttons), boss bar under it. */
export function HUD() {
  const score = useGameStore((s) => s.score)
  const combo = useGameStore((s) => s.combo)
  const stars = useGameStore((s) => s.stars)
  const playerHp = useGameStore((s) => s.playerHp)
  const playerMaxHp = useGameStore((s) => s.playerMaxHp)
  const playerShield = useGameStore((s) => s.playerShield)
  const weapon = weaponStats(useGameStore((s) => s.weaponPower))
  const boss = useGameStore((s) => s.boss)
  const isMuted = useGameStore((s) => s.isMuted)
  const toggleMute = useGameStore((s) => s.toggleMute)
  const pauseGame = useGameStore((s) => s.pauseGame)
  const gameState = useGameStore((s) => s.gameState)
  const currentStageId = useGameStore((s) => s.currentStageId)
  const hpPct = (playerHp / playerMaxHp) * 100
  const hpColor = hpPct > 50 ? '#4caf50' : hpPct > 25 ? '#ff9800' : '#f44336'

  return (
    <div style={{ position: 'absolute', inset: 0, padding: 'max(0.5rem, env(safe-area-inset-top)) max(0.5rem, env(safe-area-inset-right)) max(0.5rem, env(safe-area-inset-bottom)) max(0.5rem, env(safe-area-inset-left))', pointerEvents: 'none', zIndex: 5 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 64 }}>
          <div style={{ fontSize: 'clamp(1.1rem, 4vw, 1.5rem)', fontWeight: 800, color: '#fff', textShadow: shadow, lineHeight: 1.1 }}>{score.toLocaleString()}</div>
          <div style={{ color: '#ffd700', fontWeight: 800, fontSize: 12, textShadow: shadow }}>
            ★ {stars}{combo > 0 && <span style={{ marginLeft: 6 }}>{combo}x</span>}
          </div>
        </div>

        <div style={statusPanel}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ ...label, color: hpColor }}>HP</span>
            <div style={track}>
              <div style={{ width: `${Math.max(0, Math.min(100, hpPct))}%`, height: '100%', background: hpColor, transition: 'width 0.2s' }} />
              {playerShield > 0 && (
                // Shield rides on top of the HP bar as a thin blue strip
                <div style={{ position: 'absolute', left: 0, top: 0, height: 3, width: `${Math.min(100, playerShield)}%`, background: '#4fc3f7', boxShadow: '0 0 4px #4fc3f7' }} />
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span style={{ ...label, color: '#ff9800' }}>LV{weapon.level}</span>
            {/* Tier pips inside the current level */}
            <div style={{ display: 'flex', gap: 3, flex: 1 }}>
              {Array.from({ length: WEAPON_TIERS }, (_, i) => (
                <div key={i} style={{ flex: 1, height: 5, borderRadius: 2, background: i < weapon.tier ? '#ff9800' : 'rgba(255,255,255,0.18)' }} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, pointerEvents: 'auto', marginLeft: 'auto' }}>
          <IconBtn onClick={() => { sounds.uiClick(); toggleMute(); syncMute() }}>{isMuted ? '🔇' : '🔊'}</IconBtn>
          <IconBtn onClick={pauseGame}>⏸</IconBtn>
        </div>
      </div>

      {boss && (
        <div style={{ position: 'absolute', top: 'max(4.2rem, calc(env(safe-area-inset-top) + 3.6rem))', left: '50%', transform: 'translateX(-50%)', width: 'min(80%, 320px)', textAlign: 'center' }}>
          <div style={{ color: '#ff1744', fontWeight: 800, fontSize: 13, textShadow: '0 0 10px #ff1744' }}>{BOSSES[getStage(currentStageId).boss].name} — PHASE {boss.phase}</div>
          <div style={{ height: 8, background: 'rgba(0,0,0,0.45)', borderRadius: 5, border: '1px solid #ff1744', overflow: 'hidden', marginTop: 3 }}>
            <div style={{ width: `${(boss.hp / boss.maxHp) * 100}%`, height: '100%', background: 'linear-gradient(90deg,#ff1744,#ff5722)', transition: 'width 0.2s' }} />
          </div>
        </div>
      )}

      {gameState === 'bossWarning' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 'clamp(1.8rem, 7vw, 3rem)', fontWeight: 900, color: '#ff1744', textShadow: '0 0 20px #ff1744', animation: 'pulse 0.6s infinite' }}>⚠ WARNING ⚠<br />BOSS INCOMING</div>
        </div>
      )}
      <style>{`@keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }`}</style>
    </div>
  )
}

const shadow = '0 1px 3px rgba(0,0,0,0.85)'
const statusPanel: CSSProperties = {
  flex: '0 1 170px', minWidth: 110, padding: '5px 8px', borderRadius: 10,
  background: 'rgba(6,14,28,0.55)', border: '1px solid rgba(255,255,255,0.12)',
}
const label: CSSProperties = { width: 26, fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textShadow: shadow }
const track: CSSProperties = {
  position: 'relative', flex: 1, height: 7, background: 'rgba(0,0,0,0.5)', borderRadius: 4, overflow: 'hidden',
}

function IconBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.22)', color: '#fff', fontSize: 15, cursor: 'pointer' }}>{children}</button>
  )
}
