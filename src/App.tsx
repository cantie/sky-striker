import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, AdaptiveEvents } from '@react-three/drei'
import * as THREE from 'three'
import { GameScene } from './components/game/GameScene'
import { UI } from './components/ui/UI'

export default function App() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [0, 10.6, -11.2], fov: 48, near: 0.1, far: 200 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
        }}
        style={{ touchAction: 'none' }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true
          gl.shadowMap.type = THREE.PCFSoftShadowMap
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
