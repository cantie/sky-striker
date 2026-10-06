import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Cloud, Sky, Environment as DreiEnv, shaderMaterial } from '@react-three/drei'
import { extend, type ThreeElement } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../store/gameStore'
import { GlbModel, MODEL_PATHS } from './Model'
import { gameDt } from '../../game/speed'

const WaterMat = shaderMaterial(
  { uTime: 0, uDeep: new THREE.Color('#2088c8'), uShallow: new THREE.Color('#5ed0f0'), uFoam: new THREE.Color('#e8f8ff') },
  /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;
    varying float vWave;
    void main() {
      vUv = uv;
      vec3 p = position;
      float w = sin(p.x * 0.35 + uTime * 1.2) * 0.08 + cos(p.y * 0.28 + uTime * 0.9) * 0.06;
      p.z += w;
      vWave = w;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  /* glsl */ `
    uniform vec3 uDeep;
    uniform vec3 uShallow;
    uniform vec3 uFoam;
    varying vec2 vUv;
    varying float vWave;
    void main() {
      float foam = smoothstep(0.05, 0.12, vWave);
      vec3 col = mix(uDeep, uShallow, vUv.y * 0.35 + 0.4 + vWave * 2.0);
      col = mix(col, uFoam, foam * 0.55);
      float sparkle = pow(max(0.0, sin(vUv.x * 40.0 + vWave * 20.0) * sin(vUv.y * 30.0)), 8.0) * 0.15;
      col += sparkle;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
)
extend({ WaterMat })

declare module '@react-three/fiber' {
  interface ThreeElements {
    waterMat: ThreeElement<typeof WaterMat>
  }
}

function Water() {
  const ref = useRef<any>(null)
  useFrame((_, dt) => { if (ref.current) ref.current.uTime += dt })
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.2, 0]} receiveShadow>
      <planeGeometry args={[60, 80, 64, 64]} />
      <waterMat ref={ref} />
    </mesh>
  )
}

type PropSpec = { key: string; path: string; x: number; z: number; y?: number; size: number; rot?: number; sizeAxis?: 'max' | 'y' }

function makeIsland(seed: number, lane: number): PropSpec[] {
  const rnd = (n: number) => {
    const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453
    return x - Math.floor(x)
  }
  const baseX = (lane - 1) * 5.5 + (rnd(1) - 0.5) * 1.5
  const items: PropSpec[] = [
    { key: `sand-${seed}`, path: MODEL_PATHS.sand, x: baseX, z: 0, y: -2.05, size: 8 + rnd(2) * 4 },
    { key: `grass-${seed}`, path: MODEL_PATHS.grass, x: baseX + 0.4, z: 0.3, y: -1.95, size: 5.5 + rnd(3) * 2.5 },
  ]
  const nPalm = 2 + Math.floor(rnd(4) * 3)
  for (let i = 0; i < nPalm; i++) {
    items.push({
      key: `palm-${seed}-${i}`,
      path: rnd(10 + i) > 0.5 ? MODEL_PATHS.palm : MODEL_PATHS.palmBend,
      x: baseX + (rnd(20 + i) - 0.5) * 3.5,
      z: (rnd(30 + i) - 0.5) * 2.5,
      y: -1.9,
      size: 2.4 + rnd(40 + i) * 1.2,
      sizeAxis: 'y',
      rot: rnd(50 + i) * Math.PI * 2,
    })
  }
  if (rnd(60) > 0.4) {
    items.push({ key: `rock-${seed}`, path: MODEL_PATHS.rock, x: baseX - 1.5, z: -1, y: -1.95, size: 1.2 + rnd(61), rot: rnd(62) * 6 })
  }
  if (rnd(70) > 0.55) {
    items.push({ key: `tower-${seed}`, path: rnd(71) > 0.5 ? MODEL_PATHS.tower : MODEL_PATHS.towerWatch, x: baseX + 1.2, z: 0.5, y: -1.9, size: 3.2, sizeAxis: 'y' })
  }
  if (rnd(80) > 0.65) {
    items.push({ key: `bld-${seed}`, path: rnd(81) > 0.5 ? MODEL_PATHS.buildingA : MODEL_PATHS.buildingC, x: baseX - 0.8, z: 1.2, y: -1.9, size: 3.5, sizeAxis: 'y' })
  }
  if (rnd(90) > 0.5) {
    items.push({ key: `ship-${seed}`, path: rnd(91) > 0.5 ? MODEL_PATHS.shipSmall : MODEL_PATHS.shipLarge, x: baseX + (rnd(92) > 0.5 ? 4 : -4), z: (rnd(93) - 0.5) * 2, y: -2.0, size: 3.5 + rnd(94), rot: Math.PI * 0.5 + (rnd(95) - 0.5) * 0.4 })
  }
  return items
}

function ScrollingWorld() {
  const group = useRef<THREE.Group>(null)
  const scroll = useGameStore((s) => s.scrollOffset)
  const chunks = useMemo(() => {
    const out: { id: number; z: number; props: PropSpec[] }[] = []
    for (let i = 0; i < 8; i++) {
      out.push({ id: i, z: i * 18 - 20, props: [...makeIsland(i * 3 + 1, 0), ...makeIsland(i * 3 + 2, 2)] })
    }
    return out
  }, [])

  useFrame(() => {
    if (!group.current) return
    const period = 18 * 8
    group.current.position.z = -((scroll * 40) % period)
  })

  return (
    <group ref={group}>
      {chunks.map((c) => (
        <group key={c.id} position={[0, 0, c.z]}>
          {c.props.map((p) => (
            <group key={p.key} position={[p.x, p.y ?? -1.9, p.z]} rotation={[0, p.rot ?? 0, 0]}>
              <GlbModel path={p.path} size={p.size} sizeAxis={p.sizeAxis} />
            </group>
          ))}
        </group>
      ))}
      {/* duplicate for seamless loop */}
      {chunks.map((c) => (
        <group key={`d${c.id}`} position={[0, 0, c.z + 18 * 8]}>
          {c.props.map((p) => (
            <group key={p.key} position={[p.x, p.y ?? -1.9, p.z]} rotation={[0, p.rot ?? 0, 0]}>
              <GlbModel path={p.path} size={p.size} sizeAxis={p.sizeAxis} />
            </group>
          ))}
        </group>
      ))}
    </group>
  )
}

function Clouds() {
  const g1 = useRef<THREE.Group>(null)
  const g2 = useRef<THREE.Group>(null)
  useFrame((_, rawDt) => {
    const dt = gameDt(rawDt)
    if (g1.current) g1.current.position.z = (g1.current.position.z + dt * 1.2) % 40 - 20
    if (g2.current) g2.current.position.z = (g2.current.position.z + dt * 0.6) % 50 - 25
  })
  return (
    <>
      <group ref={g1} position={[0, 4, 0]}>
        <Cloud seed={1} position={[-6, 0, -8]} opacity={0.55} speed={0.2} scale={1.4} color="#ffffff" />
        <Cloud seed={2} position={[5, 0.5, 4]} opacity={0.45} speed={0.15} scale={1.8} color="#f0f8ff" />
        <Cloud seed={3} position={[0, -0.3, 12]} opacity={0.4} speed={0.1} scale={2} color="#ffffff" />
      </group>
      <group ref={g2} position={[0, 6, 0]}>
        <Cloud seed={4} position={[8, 0, -15]} opacity={0.3} speed={0.08} scale={2.5} color="#e8f4ff" />
        <Cloud seed={5} position={[-7, 0.4, 8]} opacity={0.28} speed={0.1} scale={2.2} color="#ffffff" />
      </group>
    </>
  )
}

export function Environment() {
  return (
    <>
      <Sky sunPosition={[40, 30, 20]} turbidity={3} rayleigh={1.2} mieCoefficient={0.005} mieDirectionalG={0.8} inclination={0.49} azimuth={0.25} />
      <DreiEnv preset="sunset" environmentIntensity={0.7} />
      <hemisphereLight args={['#b1e1ff', '#3a7a3a', 0.85]} />
      <ambientLight intensity={0.55} />
      <directionalLight
        castShadow
        position={[8, 18, 6]}
        intensity={2.6}
        color="#fff4d6"
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={60}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
      <pointLight position={[0, 5, 2]} intensity={0.6} color="#7ad7ff" />
      <Water />
      <ScrollingWorld />
      <Clouds />
      {/* far coastline bands */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-15, -2.08, 0]} receiveShadow>
        <planeGeometry args={[7, 90]} />
        <meshStandardMaterial color="#cbb67a" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[15, -2.08, 0]} receiveShadow>
        <planeGeometry args={[7, 90]} />
        <meshStandardMaterial color="#c0a86a" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-13.5, -2.02, 0]} receiveShadow>
        <planeGeometry args={[3, 90]} />
        <meshStandardMaterial color="#4e8f4c" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[13.5, -2.02, 0]} receiveShadow>
        <planeGeometry args={[3, 90]} />
        <meshStandardMaterial color="#458a44" roughness={1} />
      </mesh>
    </>
  )
}
