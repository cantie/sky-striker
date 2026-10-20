import { useEffect, useState } from 'react'
import { activeSession } from '../../net/coop/active'

const ON = new URLSearchParams(location.search).has('coopdebug')

/** `?coopdebug=1`: the ids and positions behind the wingmates we draw, as short lines at the left edge. */
export function CoopDebug() {
  const [lines, setLines] = useState<string[]>([])
  useEffect(() => {
    if (!ON) return
    const id = setInterval(() => setLines(activeSession()?.debugLines() ?? []), 250)
    return () => clearInterval(id)
  }, [])
  if (!lines.length) return null
  return (
    <div style={{
      position: 'absolute', left: 6, top: '30%', zIndex: 30, maxWidth: 'calc(100vw - 12px)', overflow: 'hidden',
      padding: '4px 6px', borderRadius: 6, background: 'rgba(5,13,26,0.75)', color: '#9dffc4',
      font: '10px/1.35 ui-monospace, Menlo, Consolas, monospace', whiteSpace: 'pre', pointerEvents: 'none',
    }}>{lines.join('\n')}</div>
  )
}
