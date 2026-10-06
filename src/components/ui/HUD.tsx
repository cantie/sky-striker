import { useGameStore } from '../../store/gameStore'

export function HUD() {
  const score = useGameStore((s) => s.score)
  const combo = useGameStore((s) => s.combo)
  const stars = useGameStore((s) => s.stars)
  const playerHp = useGameStore((s) => s.playerHp)
  const playerMaxHp = useGameStore((s) => s.playerMaxHp)
  const playerShield = useGameStore((s) => s.playerShield)
  const weaponLevel = useGameStore((s) => s.weaponLevel)
  const boss = useGameStore((s) => s.boss)
  const isMuted = useGameStore((s) => s.isMuted)
  const toggleMute = useGameStore((s) => s.toggleMute)
  const pauseGame = useGameStore((s) => s.pauseGame)
  const gameState = useGameStore((s) => s.gameState)
  const hpPct = (playerHp / playerMaxHp) * 100

  return (
    <div style={{ position: 'absolute', inset: 0, padding: 'max(0.5rem, env(safe-area-inset-top)) max(0.5rem, env(safe-area-inset-right)) max(0.5rem, env(safe-area-inset-bottom)) max(0.5rem, env(safe-area-inset-left))', pointerEvents: 'none', zIndex: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 'clamp(1.2rem, 4vw, 1.8rem)', fontWeight: 800, color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{score.toLocaleString()}</div>
          {combo > 0 && <div style={{ color: '#ffd700', fontWeight: 800, fontSize: 'clamp(0.8rem, 2.5vw, 1rem)' }}>{combo}x COMBO</div>}
          <div style={{ color: '#ffd700', marginTop: 4 }}>★ {stars}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto' }}>
          <IconBtn onClick={toggleMute}>{isMuted ? '🔇' : '🔊'}</IconBtn>
          <IconBtn onClick={pauseGame}>⏸</IconBtn>
        </div>
      </div>

      {boss && (
        <div style={{ position: 'absolute', top: 'max(3.5rem, calc(env(safe-area-inset-top) + 2.5rem))', left: '50%', transform: 'translateX(-50%)', width: 'min(80%, 320px)', textAlign: 'center' }}>
          <div style={{ color: '#ff1744', fontWeight: 800, textShadow: '0 0 10px #ff1744' }}>BOSS — PHASE {boss.phase}</div>
          <div style={{ height: 12, background: 'rgba(0,0,0,0.45)', borderRadius: 6, border: '1px solid #ff1744', overflow: 'hidden', marginTop: 4 }}>
            <div style={{ width: `${(boss.hp / boss.maxHp) * 100}%`, height: '100%', background: 'linear-gradient(90deg,#ff1744,#ff5722)', transition: 'width 0.2s' }} />
          </div>
        </div>
      )}

      {gameState === 'bossWarning' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 'clamp(1.8rem, 7vw, 3rem)', fontWeight: 900, color: '#ff1744', textShadow: '0 0 20px #ff1744', animation: 'pulse 0.6s infinite' }}>⚠ WARNING ⚠<br />BOSS INCOMING</div>
        </div>
      )}

      <div style={{ position: 'absolute', bottom: 'max(1rem, env(safe-area-inset-bottom))', left: 'max(0.5rem, env(safe-area-inset-left))', right: 'max(0.5rem, env(safe-area-inset-right))' }}>
        <Bar label="HP" color={hpPct > 50 ? '#4caf50' : hpPct > 25 ? '#ff9800' : '#f44336'} pct={hpPct} text={`${Math.ceil(playerHp)}/${playerMaxHp}`} />
        {playerShield > 0 && <Bar label="SHD" color="#2196f3" pct={playerShield} text={`${Math.ceil(playerShield)}`} />}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 6 }}>
          <span style={{ color: '#ff9800', fontSize: 12, fontWeight: 700 }}>WPN</span>
          {[1, 2, 3, 4, 5].map((l) => (
            <div key={l} style={{ width: 18, height: 8, borderRadius: 2, background: l <= weaponLevel ? '#ff9800' : 'rgba(255,255,255,0.2)' }} />
          ))}
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }`}</style>
    </div>
  )
}

function Bar({ label, color, pct, text }: { label: string; color: string; pct: number; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <span style={{ color, width: 36, fontSize: 12, fontWeight: 700 }}>{label}</span>
      <div style={{ flex: 1, height: 10, background: 'rgba(0,0,0,0.45)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: color, transition: 'width 0.2s' }} />
      </div>
      <span style={{ color: '#fff', fontSize: 11, width: 54, textAlign: 'right' }}>{text}</span>
    </div>
  )
}

function IconBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.22)', color: '#fff', fontSize: 16, cursor: 'pointer' }}>{children}</button>
  )
}
