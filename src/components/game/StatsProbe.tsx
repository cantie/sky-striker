import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { createFpsMeter } from '../../game/fx/fpsMeter'

/** On with `?stats`: FPS, frame time and draw calls, for comparing builds on a phone. */
export const STATS = typeof location !== 'undefined' && new URLSearchParams(location.search).has('stats')

interface Stats { fps: number; ms: number; calls: number; tris: number }

/**
 * Counts every pass of a frame (the EffectComposer renders several): renderer info is not reset per
 * render call, so at the start of a frame it holds the whole previous frame. Shows a small readout and
 * publishes it as `window.__stats` for the bench script.
 */
export function StatsProbe() {
  const gl = useThree((s) => s.gl)
  const meter = useMemo(() => createFpsMeter(), [])
  const box = useRef<HTMLDivElement | null>(null)
  const sinceShown = useRef(0)

  useEffect(() => {
    gl.info.autoReset = false
    const el = document.createElement('div')
    Object.assign(el.style, {
      position: 'fixed', left: '4px', top: '4px', zIndex: '9999', pointerEvents: 'none',
      font: '600 11px monospace', color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '2px 5px', whiteSpace: 'pre',
    })
    document.body.appendChild(el)
    box.current = el
    return () => { el.remove(); gl.info.autoReset = true }
  }, [gl])

  useFrame((_, delta) => {
    const calls = gl.info.render.calls, tris = gl.info.render.triangles
    gl.info.reset()
    meter.frame(delta * 1000)
    sinceShown.current += delta
    if (sinceShown.current < 0.25) return
    sinceShown.current = 0
    const s: Stats = { fps: Math.round(meter.fps() * 10) / 10, ms: Math.round(meter.ms() * 10) / 10, calls, tris }
    ;(window as unknown as { __stats?: Stats }).__stats = s
    if (box.current) box.current.textContent = `${s.fps.toFixed(1)} fps  ${s.ms.toFixed(1)} ms\n${calls} calls  ${(tris / 1000).toFixed(1)}k tris`
  })
  return null
}
