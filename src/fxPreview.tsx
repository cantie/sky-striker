// Dev page for the effects (fx-preview.html?fx=puff,…): each cell plays one effect on a 3 s loop, from
// the game camera at the game's phone zoom, over a game ground (`&biome=arctic` swaps it for every cell).
// `&at=1.2` freezes every cell at that time, for screenshots. Sets window.__previewReady once every cell
// has played a while (or reached `at`).
import { Suspense, useEffect, useRef, type CSSProperties } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { Environment } from './components/game/Environment'
import { FxRenderer, useFx, type Fx } from './components/game/fx/FxRenderer'
import { BIOMES, type Biome } from './game/biomes'

const LOOP = 3
/** The game's zoom on a 540-wide phone (half-width 8.3 units): effects show at their in-game size. */
const ZOOM = 540 / (2 * 8.3)
/** Screenshot-ready once each cell has played this long. */
const READY_AT = 1.2

interface Cell {
  biome: Biome
  /** Called every frame with the loop time `t` in [0, LOOP) and the frame step. */
  play(fx: Fx, t: number, dt: number): void
}

/** A missile's flight across the cell, as position and velocity at loop time t (seconds). */
function missilePath(t: number) {
  const T = 2, s = t / T
  const w = Math.sin(s * Math.PI * 2)
  return {
    x: 4 * (1 - 2 * s) + 1.5 * w, z: -4.5 + 9 * s,
    vx: (-8 + 1.5 * Math.PI * 2 * Math.cos(s * Math.PI * 2)) / T, vz: 9 / T,
    flying: t < T,
  }
}

const CELLS: Record<string, Cell> = {
  puff: {
    biome: 'jungle',
    play(fx, t, dt) {
      // The game's rate (one per 0.04 s) at any frame rate, spread back along the frame's flight
      const n = Math.floor(dt / 0.04 + Math.random())
      for (let i = 0; i < n; i++) {
        const m = missilePath(t - (dt * i) / n)
        if (m.flying) fx.puff(m.x, m.z, m.vx, m.vz)
      }
    },
  },
}

const query = new URLSearchParams(location.search)
const names = (query.get('fx') ?? 'puff').split(',').filter(Boolean)
const biomeOverride = BIOMES.find((b) => b === query.get('biome'))
const freezeAt = Number(query.get('at')) || 0
const cells = names.filter((n) => CELLS[n])

const win = window as unknown as { __previewReady?: boolean; __previewErrors?: string[] }
win.__previewErrors = names.filter((n) => !CELLS[n]).map((n) => `${n}: no such cell (have ${Object.keys(CELLS).join(', ')})`)
let ready = 0
const markReady = () => { if (++ready === cells.length) win.__previewReady = true }
if (!cells.length) win.__previewReady = true

function Player({ cell, frozen }: { cell: Cell; frozen: { current: boolean } }) {
  const fx = useFx()
  const elapsed = useRef(0)
  const readyAt = freezeAt || READY_AT
  useFrame((_, delta) => {
    if (frozen.current) return
    const dt = Math.min(delta, 0.1, freezeAt ? freezeAt - elapsed.current : Infinity)
    const before = elapsed.current
    elapsed.current += dt
    cell.play(fx, elapsed.current % LOOP, dt)
    if (freezeAt && elapsed.current >= freezeAt - 1e-6) frozen.current = true
    if (before < readyAt && elapsed.current >= readyAt - 1e-6) markReady()
  })
  return null
}

function CellView({ name }: { name: string }) {
  const cell = CELLS[name]
  const frozen = useRef(false)
  return (
    <div style={{ position: 'relative' }}>
      <Canvas
        orthographic
        style={{ width: 540, height: 300 }}
        camera={{ position: [0, 50, 0], zoom: ZOOM, near: 0.1, far: 200, up: [0, 0, 1] }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15, preserveDrawingBuffer: true }}
        onCreated={({ camera }) => { camera.up.set(0, 0, 1); camera.lookAt(0, 0, 0) }}
      >
        <Suspense fallback={null}>
          <Environment biome={biomeOverride ?? cell.biome} />
        </Suspense>
        <FxRenderer paused={() => frozen.current}>
          <Player cell={cell} frozen={frozen} />
        </FxRenderer>
        {/* As GameScene */}
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.7} luminanceThreshold={0.7} mipmapBlur levels={5} />
          <Vignette offset={0.3} darkness={0.35} />
        </EffectComposer>
      </Canvas>
      <div style={label}>{name}</div>
    </div>
  )
}

function Page() {
  useEffect(() => { document.title = `FX preview: ${cells.join(', ')}` }, [])
  return <div style={{ width: 540 }}>{cells.map((n) => <CellView key={n} name={n} />)}</div>
}

const label: CSSProperties = {
  position: 'absolute', left: 0, right: 0, bottom: 4, textAlign: 'center',
  font: '700 14px sans-serif', color: '#fff', textShadow: '0 1px 3px #000',
}

createRoot(document.getElementById('root')!).render(<Page />)
