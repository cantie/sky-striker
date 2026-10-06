import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, AdaptiveEvents } from '@react-three/drei'
import * as THREE from 'three'
import { GameScene } from './components/game/GameScene'
import { UI } from './components/ui/UI'

/** Playfield center Z (playerY maps to world Z). Matches gameStore BOUNDS. */
const PLAYFIELD_MID_Z = (-8.8 + 16.5) / 2

export default function App() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <Canvas
        orthographic
        shadows
        dpr={[1, 1.75]}
        camera={{
          position: [0, 50, PLAYFIELD_MID_Z],
          zoom: 28,
          near: 0.1,
          far: 200,
          up: [0, 0, 1],
        }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
        }}
        style={{ touchAction: 'none' }}
        onCreated={({ gl, camera }) => {
          gl.shadowMap.enabled = true
          gl.shadowMap.type = THREE.PCFSoftShadowMap
          // True top-down: +Z is screen-up (forward), +X is screen-right
          camera.up.set(0, 0, 1)
          camera.lookAt(0, 0, PLAYFIELD_MID_Z)
        }}
      >
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        <GameScene />
      </Canvas>
      <UI />
    </div>
  )
}
