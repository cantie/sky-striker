// Dev page for the art pipeline (npm run art -- preview): each asset's old model next to its new one,
// from the game camera over the game ground of its stage. Sets window.__previewReady once all are drawn.
import { Component, Suspense, useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ASSETS, type ArtAsset } from '../art/manifest.mjs'
import { Environment } from './components/game/Environment'
import { GlbModel, ShipModel } from './components/game/Model'
import { aiModel } from './game/models'
import { getStage } from './game/stages'
import { GROUND_Y } from './game/world'

const ids = (new URLSearchParams(location.search).get('ids') ?? '').split(',').filter(Boolean)
const assets = ids.map((id) => ASSETS.find((a) => a.id === id)).filter((a): a is ArtAsset => !!a)
const ground = (a: ArtAsset) => a.kind === 'hull' || a.kind === 'base' || a.kind === 'gun'

const win = window as unknown as { __previewReady?: boolean; __previewErrors?: string[] }
win.__previewErrors = ids.filter((id) => !assets.some((a) => a.id === id)).map((id) => `${id}: not in art/manifest.mjs`)
let drawn = 0
const done = () => { if (++drawn === assets.length) win.__previewReady = true }
if (!assets.length) win.__previewReady = true

/** Counts as drawn after its first frame on screen. */
function Drawn() {
  const once = useRef(false)
  useFrame(() => { if (!once.current) { once.current = true; done() } })
  return null
}

/** A model that fails to load is listed instead of hanging the page. */
class Missing extends Component<{ id: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(e: Error) { win.__previewErrors!.push(`${this.props.id}: ${e.message}`); done() }
  render() { return this.state.failed ? null : this.props.children }
}

function Craft({ path, asset }: { path: string; asset: ArtAsset }) {
  const size = asset.size ?? 2
  if (ground(asset)) return <group position={[0, GROUND_Y + 0.1, 0]}><GlbModel path={path} size={size} grounded /></group>
  return <group position={[0, 0.4, 0]}><ShipModel path={path} size={size} /></group>
}

function Row({ asset }: { asset: ArtAsset }) {
  return (
    <div style={{ position: 'relative' }}>
      <Canvas
        orthographic
        style={{ width: 540, height: 300 }}
        camera={{ position: [0, 50, 0], zoom: 28, near: 0.1, far: 200, up: [0, 0, 1] }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15, preserveDrawingBuffer: true }}
        onCreated={({ camera }) => { camera.up.set(0, 0, 1); camera.lookAt(0, 0, 0) }}
      >
        <Missing id={asset.id}>
          <Suspense fallback={null}>
            <Environment biome={getStage(asset.stage ?? 1).biome} />
            {/* Top-down with +Z up the screen puts world +X on the left: old on the left, new on the right */}
            {asset.old && <group position={[3, 0, 0]}><Craft path={asset.old} asset={asset} /></group>}
            <group position={[asset.old ? -3 : 0, 0, 0]}><Craft path={aiModel(asset.id)} asset={asset} /></group>
            <Drawn />
          </Suspense>
        </Missing>
      </Canvas>
      {asset.old && <div style={{ ...label, left: 0, right: '50%' }}>old</div>}
      <div style={asset.old ? { ...label, left: '50%', right: 0 } : label}>{asset.id}</div>
    </div>
  )
}

function Page() {
  useEffect(() => { document.title = `Art preview: ${ids.join(', ')}` }, [])
  return <div style={{ width: 540 }}>{assets.map((a) => <Row key={a.id} asset={a} />)}</div>
}

const label: CSSProperties = {
  position: 'absolute', left: 0, right: 0, bottom: 4, textAlign: 'center',
  font: '700 14px sans-serif', color: '#fff', textShadow: '0 1px 3px #000',
}

createRoot(document.getElementById('root')!).render(<Page />)
