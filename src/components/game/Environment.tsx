import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Cloud, Sky, Environment as DreiEnv, shaderMaterial } from '@react-three/drei'
import { extend, type ThreeElement } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore, type Biome } from '../../store/gameStore'
import { GlbModel, MODEL_PATHS } from './Model'
import { gameDt } from '../../game/speed'

/** World Y where the continuous ground plane sits; props sit on top of this. */
export const GROUND_Y = -2.2

const GroundMat = shaderMaterial(
  {
    uTime: 0,
    uScroll: 0,
    uDeep: new THREE.Color('#2088c8'),
    uShallow: new THREE.Color('#5ed0f0'),
    uFoam: new THREE.Color('#e8f8ff'),
    uMode: 0, // 0 ocean leftover, 1 desert, 2 jungle
  },
  /* glsl */ `
    uniform float uTime;
    uniform float uScroll;
    uniform float uMode;
    varying vec2 vUv;
    varying float vWave;
    void main() {
      vUv = uv;
      vec3 p = position;
      // Scroll world-space ripples with the map so dunes/floor move under the ship
      float sz = p.y + uScroll * 40.0;
      float sx = p.x;
      float w = 0.0;
      if (uMode < 0.5) {
        w = sin(sx * 0.35 + uTime * 1.2) * 0.08 + cos(sz * 0.28 + uTime * 0.9) * 0.06;
      } else if (uMode < 1.5) {
        // sand dunes — low amplitude so props stay planted
        w = sin(sx * 0.22 + uTime * 0.12) * 0.12 + cos(sz * 0.18) * 0.09 + sin(sx * 0.55 + sz * 0.3) * 0.05;
      } else {
        // jungle floor undulation
        w = sin(sx * 0.4 + uTime * 0.15) * 0.04 + cos(sz * 0.35) * 0.035;
      }
      p.z += w;
      vWave = w;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  /* glsl */ `
    uniform vec3 uDeep;
    uniform vec3 uShallow;
    uniform vec3 uFoam;
    uniform float uMode;
    uniform float uScroll;
    varying vec2 vUv;
    varying float vWave;
    void main() {
      vec3 col;
      vec2 uv = vUv + vec2(0.0, uScroll * 0.85);
      if (uMode < 0.5) {
        float foam = smoothstep(0.05, 0.12, vWave);
        col = mix(uDeep, uShallow, uv.y * 0.35 + 0.4 + vWave * 2.0);
        col = mix(col, uFoam, foam * 0.55);
        float sparkle = pow(max(0.0, sin(uv.x * 40.0 + vWave * 20.0) * sin(uv.y * 30.0)), 8.0) * 0.15;
        col += sparkle;
      } else if (uMode < 1.5) {
        // warm sand / dunes with scrolling grain
        float dune = smoothstep(-0.04, 0.14, vWave);
        col = mix(uDeep, uShallow, dune);
        col = mix(col, uFoam, pow(max(0.0, vWave), 1.5) * 0.3);
        col += vec3(0.045, 0.022, 0.0) * sin(uv.x * 28.0 + uv.y * 14.0);
        // subtle stripe bands for scroll readability (parallax depth cue)
        float band = sin(uv.y * 18.0) * 0.018;
        col += vec3(band, band * 0.7, band * 0.3);
      } else {
        // jungle floor
        float moss = smoothstep(-0.02, 0.06, vWave);
        col = mix(uDeep, uShallow, moss + uv.x * 0.12);
        float litter = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
        col = mix(col, uFoam, litter * 0.14);
        float band = sin(uv.y * 22.0) * 0.015;
        col += vec3(band * 0.4, band, band * 0.35);
      }
      gl_FragColor = vec4(col, 1.0);
    }
  `,
)
extend({ GroundMat })

declare module '@react-three/fiber' {
  interface ThreeElements {
    groundMat: ThreeElement<typeof GroundMat>
  }
}

function Ground({ biome }: { biome: Biome }) {
  const ref = useRef<any>(null)
  const scroll = useGameStore((s) => s.scrollOffset)
  useFrame((_, rawDt) => {
    if (!ref.current) return
    ref.current.uTime += gameDt(rawDt)
    ref.current.uScroll = scroll
  })
  const colors =
    biome === 'desert'
      ? { deep: '#c4a06a', shallow: '#e8c888', foam: '#f5e6c0', mode: 1 }
      : { deep: '#1a4a28', shallow: '#2f6b3a', foam: '#4a8f4a', mode: 2 }

  // Huge continuous plane under the whole playfield — no gaps / floating islands
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y, 0]} receiveShadow>
      <planeGeometry args={[90, 120, 96, 96]} />
      <groundMat
        ref={ref}
        uDeep={colors.deep}
        uShallow={colors.shallow}
        uFoam={colors.foam}
        uMode={colors.mode}
        uScroll={0}
      />
    </mesh>
  )
}

type PropSpec = {
  key: string
  path: string
  x: number
  z: number
  size: number
  rot?: number
  sizeAxis?: 'max' | 'y'
}

function makeDesertChunk(seed: number, lane: number): PropSpec[] {
  const rnd = (n: number) => {
    const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453
    return x - Math.floor(x)
  }
  const baseX = (lane - 1) * 5.8 + (rnd(1) - 0.5) * 1.8
  const items: PropSpec[] = []
  const nRock = 2 + Math.floor(rnd(6) * 3)
  for (let i = 0; i < nRock; i++) {
    items.push({
      key: `rock-${seed}-${i}`,
      path: rnd(10 + i) > 0.45 ? MODEL_PATHS.rock : MODEL_PATHS.rockB,
      x: baseX + (rnd(20 + i) - 0.5) * 4,
      z: (rnd(30 + i) - 0.5) * 3,
      size: 1.0 + rnd(40 + i) * 1.8,
      rot: rnd(50 + i) * Math.PI * 2,
    })
  }
  if (rnd(60) > 0.55) {
    items.push({
      key: `cliff-${seed}`,
      path: MODEL_PATHS.cliff,
      x: baseX + (rnd(61) - 0.5) * 2,
      z: (rnd(62) - 0.5) * 2,
      size: 3.5 + rnd(63),
      sizeAxis: 'y',
      rot: rnd(64) * 6,
    })
  }
  if (rnd(70) > 0.65) {
    items.push({
      key: `drypalm-${seed}`,
      path: MODEL_PATHS.palmBend,
      x: baseX + (rnd(71) - 0.5) * 2.5,
      z: (rnd(72) - 0.5) * 2,
      size: 2.0 + rnd(73),
      sizeAxis: 'y',
      rot: rnd(74) * 6,
    })
  }
  if (rnd(80) > 0.7) {
    items.push({
      key: `ruins-${seed}`,
      path: rnd(81) > 0.5 ? MODEL_PATHS.towerWatch : MODEL_PATHS.buildingC,
      x: baseX + 1.2,
      z: 0.4,
      size: 2.8,
      sizeAxis: 'y',
    })
  }
  return items
}

function makeJungleChunk(seed: number, lane: number): PropSpec[] {
  const rnd = (n: number) => {
    const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453
    return x - Math.floor(x)
  }
  const baseX = (lane - 1) * 5.5 + (rnd(1) - 0.5) * 1.5
  const items: PropSpec[] = []
  const nTree = 3 + Math.floor(rnd(4) * 4)
  for (let i = 0; i < nTree; i++) {
    const pick = rnd(10 + i)
    const path = pick > 0.66 ? MODEL_PATHS.treeOak : pick > 0.33 ? MODEL_PATHS.tree : pick > 0.15 ? MODEL_PATHS.palm : MODEL_PATHS.treeCone
    items.push({
      key: `tree-${seed}-${i}`,
      path,
      x: baseX + (rnd(20 + i) - 0.5) * 4.2,
      z: (rnd(30 + i) - 0.5) * 3.2,
      size: 2.6 + rnd(40 + i) * 1.8,
      sizeAxis: 'y',
      rot: rnd(50 + i) * Math.PI * 2,
    })
  }
  const nBush = 2 + Math.floor(rnd(55) * 3)
  for (let i = 0; i < nBush; i++) {
    items.push({
      key: `bush-${seed}-${i}`,
      path: MODEL_PATHS.bush,
      x: baseX + (rnd(60 + i) - 0.5) * 3.5,
      z: (rnd(70 + i) - 0.5) * 2.5,
      size: 1.2 + rnd(80 + i) * 1.2,
      rot: rnd(90 + i) * 6,
    })
  }
  if (rnd(91) > 0.5) {
    items.push({
      key: `rockj-${seed}`,
      path: MODEL_PATHS.rock,
      x: baseX - 1.2,
      z: 1.0,
      size: 1.3 + rnd(92),
      rot: rnd(93) * 6,
    })
  }
  if (rnd(94) > 0.6) {
    items.push({
      key: `ruinj-${seed}`,
      path: rnd(95) > 0.5 ? MODEL_PATHS.tower : MODEL_PATHS.buildingA,
      x: baseX + 1.5,
      z: -0.5,
      size: 3.0,
      sizeAxis: 'y',
    })
  }
  return items
}

function ScrollingWorld({ biome }: { biome: Biome }) {
  const group = useRef<THREE.Group>(null)
  const scroll = useGameStore((s) => s.scrollOffset)
  const chunks = useMemo(() => {
    const out: { id: number; z: number; props: PropSpec[] }[] = []
    const maker = biome === 'desert' ? makeDesertChunk : makeJungleChunk
    for (let i = 0; i < 8; i++) {
      out.push({ id: i, z: i * 18 - 20, props: [...maker(i * 3 + 1, 0), ...maker(i * 3 + 2, 2)] })
    }
    return out
  }, [biome])

  useFrame(() => {
    if (!group.current) return
    const period = 18 * 8
    group.current.position.z = -((scroll * 40) % period)
  })

  return (
    <group ref={group}>
      {chunks.map((c) => (
        <group key={`${biome}-${c.id}`} position={[0, 0, c.z]}>
          {c.props.map((p) => (
            <group key={p.key} position={[p.x, GROUND_Y, p.z]} rotation={[0, p.rot ?? 0, 0]}>
              <GlbModel path={p.path} size={p.size} sizeAxis={p.sizeAxis} grounded />
            </group>
          ))}
        </group>
      ))}
      {chunks.map((c) => (
        <group key={`${biome}-d${c.id}`} position={[0, 0, c.z + 18 * 8]}>
          {c.props.map((p) => (
            <group key={p.key} position={[p.x, GROUND_Y, p.z]} rotation={[0, p.rot ?? 0, 0]}>
              <GlbModel path={p.path} size={p.size} sizeAxis={p.sizeAxis} grounded />
            </group>
          ))}
        </group>
      ))}
    </group>
  )
}

function Clouds({ biome }: { biome: Biome }) {
  const g1 = useRef<THREE.Group>(null)
  const g2 = useRef<THREE.Group>(null)
  const tint = biome === 'desert' ? '#ffe8c8' : '#e8fff0'
  useFrame((_, rawDt) => {
    const dt = gameDt(rawDt)
    if (g1.current) g1.current.position.z = (g1.current.position.z + dt * 0.55) % 40 - 20
    if (g2.current) g2.current.position.z = (g2.current.position.z + dt * 0.28) % 50 - 25
  })
  return (
    <>
      <group ref={g1} position={[0, 5.5, 0]}>
        <Cloud seed={1} position={[-6, 0, -8]} opacity={biome === 'desert' ? 0.28 : 0.4} speed={0.05} scale={1.4} color={tint} />
        <Cloud seed={2} position={[5, 0.5, 4]} opacity={biome === 'desert' ? 0.24 : 0.32} speed={0.04} scale={1.8} color={tint} />
        <Cloud seed={3} position={[0, -0.3, 12]} opacity={0.26} speed={0.03} scale={2} color="#ffffff" />
      </group>
      <group ref={g2} position={[0, 7.5, 0]}>
        <Cloud seed={4} position={[8, 0, -15]} opacity={biome === 'desert' ? 0.18 : 0.22} speed={0.02} scale={2.5} color={tint} />
        <Cloud seed={5} position={[-7, 0.4, 8]} opacity={0.2} speed={0.03} scale={2.2} color="#ffffff" />
      </group>
    </>
  )
}

/** Soft side shelves for depth/parallax — same height as ground, not floating strips. */
function SideBands({ biome }: { biome: Biome }) {
  const y = GROUND_Y + 0.02
  if (biome === 'desert') {
    return (
      <>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-18, y, 0]} receiveShadow>
          <planeGeometry args={[16, 120]} />
          <meshStandardMaterial color="#d2b07a" roughness={0.95} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[18, y, 0]} receiveShadow>
          <planeGeometry args={[16, 120]} />
          <meshStandardMaterial color="#c9a66e" roughness={0.95} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-12, y + 0.01, 0]} receiveShadow>
          <planeGeometry args={[5, 120]} />
          <meshStandardMaterial color="#b8955c" roughness={1} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[12, y + 0.01, 0]} receiveShadow>
          <planeGeometry args={[5, 120]} />
          <meshStandardMaterial color="#a8844e" roughness={1} />
        </mesh>
      </>
    )
  }
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-18, y, 0]} receiveShadow>
        <planeGeometry args={[16, 120]} />
        <meshStandardMaterial color="#2d5a32" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[18, y, 0]} receiveShadow>
        <planeGeometry args={[16, 120]} />
        <meshStandardMaterial color="#274f2c" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-12, y + 0.01, 0]} receiveShadow>
        <planeGeometry args={[5, 120]} />
        <meshStandardMaterial color="#3d7a40" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[12, y + 0.01, 0]} receiveShadow>
        <planeGeometry args={[5, 120]} />
        <meshStandardMaterial color="#356b38" roughness={1} />
      </mesh>
    </>
  )
}

export function Environment() {
  const biome = useGameStore((s) => s.biome)
  const desert = biome === 'desert'

  return (
    <>
      <Sky
        sunPosition={desert ? [50, 22, 10] : [30, 35, 20]}
        turbidity={desert ? 6 : 2.5}
        rayleigh={desert ? 0.7 : 1.3}
        mieCoefficient={desert ? 0.012 : 0.004}
        mieDirectionalG={0.85}
        inclination={desert ? 0.52 : 0.48}
        azimuth={0.25}
      />
      <DreiEnv preset={desert ? 'dawn' : 'forest'} environmentIntensity={desert ? 0.85 : 0.65} />
      <hemisphereLight args={desert ? ['#ffd9a0', '#8a6a3a', 0.9] : ['#a8e0ff', '#1e4a28', 0.9]} />
      <ambientLight intensity={desert ? 0.65 : 0.45} />
      <directionalLight
        castShadow
        position={desert ? [10, 16, 4] : [6, 18, 8]}
        intensity={desert ? 2.9 : 2.3}
        color={desert ? '#ffd7a0' : '#fff4d6'}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={60}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <pointLight position={[0, 5, 2]} intensity={desert ? 0.35 : 0.55} color={desert ? '#ffaa55' : '#7ad7ff'} />
      {desert && <fog attach="fog" args={['#e8c898', 34, 72]} />}
      {!desert && <fog attach="fog" args={['#6a9a72', 36, 75]} />}
      <Ground biome={biome} />
      <SideBands biome={biome} />
      <ScrollingWorld biome={biome} />
      <Clouds biome={biome} />
    </>
  )
}
