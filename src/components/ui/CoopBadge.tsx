import { useEffect, useState } from 'react'
import { activeSession, sessionLabel } from '../../net/coop/active'
import { GAME_SPEED } from '../../game/speed'

/** Small co-op status strip: transport, round trip, and the countdown before the run starts. */
export function CoopBadge() {
  const [text, setText] = useState('')
  useEffect(() => {
    const id = setInterval(() => {
      const s = activeSession()
      if (!s) { setText(''); return }
      const st = s.status()
      const t = s.stageTime()
      const count = st.phase === 'countdown' && t < 0 ? ` · START IN ${Math.ceil(-t / GAME_SPEED)}` : ''
      setText(`CO-OP · ${sessionLabel()} · RTT ${st.rtt}ms · ${st.teammates} WINGMATE${st.teammates === 1 ? '' : 'S'}${count}`)
    }, 250)
    return () => clearInterval(id)
  }, [])
  if (!text) return null
  return (
    <div style={{
      position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 30,
      padding: '3px 10px', borderRadius: 10, background: 'rgba(5,13,26,0.7)',
      border: '1px solid rgba(61,255,138,0.45)', color: '#9dffc4',
      font: '600 11px/1.4 system-ui, sans-serif', letterSpacing: 0.5, pointerEvents: 'none', whiteSpace: 'nowrap',
    }}>{text}</div>
  )
}
