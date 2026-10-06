import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Cloud, Environment as DreiEnv, shaderMaterial } from '@react-three/drei'
import { extend, type ThreeElement } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore, type Biome } from '../../store/gameStore'
import { GlbModel, MODEL_PATHS } from './Model'
import { gameDt } from '../../game/speed'

/** World Y where the continuous ground plane sits; props sit on top of this. */
export const GROUND_Y = -2.05

/** Procedural biome ground albedo — high-contrast grain so the floor reads as terrain, not sky fill. */
function makeGroundCanvas(desert: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 1024
  const ctx = c.getContext('2d')!

  if (desert) {
    const g = ctx.createLinearGradient(0, 0, 0, 1024)
    g.addColorStop(0, '#d4a86a')
    g.addColorStop(0.45, '#e6c07a')
    g.addColorStop(1, '#c99658')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 1024, 1024)

    // dune bands
    for (let i = 0; i < 28; i++) {
      const y = (i / 28) * 1024
      const amp = 18 + (i % 5) * 6
      ctx.beginPath()
      ctx.moveTo(0, y)
      for (let x = 0; x <= 1024; x += 16) {
        ctx.lineTo(x, y + Math.sin(x * 0.012 + i * 0.7) * amp)
      }
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(170,120,60,0.28)' : 'rgba(250,220,160,0.22)'
      ctx.lineWidth = 10 + (i % 3) * 4
      ctx.stroke()
    }
    // sand grain
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * 1024
      const y = Math.random() * 1024
      const a = 0.08 + Math.random() * 0.18
      ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,230,180,${a})` : `rgba(120,80,40,${a})`
      ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2)
    }
    // darker patches / rocks shadows
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * 1024
      const y = Math.random() * 1024
      const r = 20 + Math.random() * 70
      const grd = ctx.createRadialGradient(x, y, 2, x, y, r)
      grd.addColorStop(0, 'rgba(140,95,45,0.35)')
      grd.addColorStop(1, 'rgba(140,95,45,0)')
      ctx.fillStyle = grd
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    const g = ctx.createLinearGradient(0, 0, 1024, 1024)
    g.addColorStop(0, '#3d7a42')
    g.addColorStop(0.4, '#4a8f48')
    g.addColorStop(1, '#356b3a')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 1024, 1024)

    // moss / litter patches
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * 1024
      const y = Math.random() * 1024
      const r = 25 + Math.random() * 90
      const grd = ctx.createRadialGradient(x, y, 2, x, y, r)
      const bright = Math.random() > 0.45
      grd.addColorStop(0, bright ? 'rgba(110,180,80,0.5)' : 'rgba(40,90,40,0.45)')
      grd.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = grd
      ctx.beginPath()
      ctx.ellipse(x, y, r, r * (0.55 + Math.random() * 0.5), Math.random() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
    // leaf litter noise
    for (let i = 0; i < 7000; i++) {
      const x = Math.random() * 1024
      const y = Math.random() * 1024
      const a = 0.1 + Math.random() * 0.25
      ctx.fillStyle = Math.random() > 0.5 ? `rgba(130,200,90,${a})` : `rgba(55,100,45,${a})`
      ctx.fillRect(x, y, 1 + Math.random() * 2.5, 1 + Math.random() * 2)
    }
    // soft path bands for scroll readability
    for (let i = 0; i < 18; i++) {
      const y = (i / 18) * 1024
      ctx.strokeStyle = 'rgba(80,140,70,0.25)'
      ctx.lineWidth = 14
      ctx.beginPath()
      ctx.moveTo(0, y)
      for (let x = 0; x <= 1024; x += 20) {
        ctx.lineTo(x, y + Math.sin(x * 0.01 + i) * 12)
      }
      ctx.stroke()
    }
  }
  return c
}

function Ground({ biome }: { biome: Biome }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  const scroll = useGameStore((s) => s.scrollOffset)
  const desert = biome === 'desert'

  const map = useMemo(() => {
    const tex = new THREE.CanvasTexture(makeGroundCanvas(desert))
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    // Large world plane → many repeats so grain stays readable under the ship
    tex.repeat.set(5, 6)
    tex.anisotropy = 8
    tex.needsUpdate = true
    return tex
  }, [desert])

  useEffect(() => () => map.dispose(), [map])

  useFrame(() => {
    if (!matRef.current?.map) return
    // Scroll texture with world so the floor visibly moves under the plane
    matRef.current.map.offset.y = -(scroll * 0.85) % 1
  })

  // Continuous floor under the playfield. Depth chosen so the far edge sits near the
  // horizon (sky band above); previous 72-deep plane ended at z≈36 while the top of
  // the screen looked past z≈48 — that gap read as "no ground".
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, GROUND_Y, 8]}
      receiveShadow
      frustumCulled={false}
    >
      <planeGeometry args={[140, 100]} />
      <meshStandardMaterial
        ref={matRef}
        map={map}
        color={desert ? '#e8c888' : '#4a8f48'}
        roughness={desert ? 0.92 : 0.88}
        metalness={0}
        envMapIntensity={0.45}
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



/** Procedural CC0-style sky texture (canvas) — detail packed into the upper band
 *  (scene.background maps texture-top → screen-top, which is the only visible sky strip). */
function makeSkyCanvas(desert: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 1024
  const ctx = c.getContext('2d')!

  // Vertical gradient: top = zenith (screen top), quickly into mid/haze (visible band),
  // lower half mostly covered by ground but still painted for backdrop UVs.
  const g = ctx.createLinearGradient(0, 0, 0, 1024)
  if (desert) {
    g.addColorStop(0.0, 'rgb(55, 95, 165)')
    g.addColorStop(0.12, 'rgb(120, 155, 200)')
    g.addColorStop(0.28, 'rgb(210, 185, 150)')
    g.addColorStop(0.42, 'rgb(245, 195, 120)')
    g.addColorStop(0.65, 'rgb(235, 175, 100)')
    g.addColorStop(1.0, 'rgb(200, 145, 85)')
  } else {
    g.addColorStop(0.0, 'rgb(35, 95, 175)')
    g.addColorStop(0.15, 'rgb(70, 145, 200)')
    g.addColorStop(0.32, 'rgb(120, 185, 195)')
    g.addColorStop(0.5, 'rgb(150, 205, 185)')
    g.addColorStop(1.0, 'rgb(100, 155, 120)')
  }
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 1024, 1024)

  // Soft clouds in the UPPER visible band
  const nClouds = desert ? 36 : 48
  for (let i = 0; i < nClouds; i++) {
    const x = Math.random() * 1024
    const y = Math.random() * 340 + 20
    const rx = 50 + Math.random() * 160
    const ry = 18 + Math.random() * 36
    const grd = ctx.createRadialGradient(x, y, 2, x, y, rx)
    const a = desert ? 0.22 + Math.random() * 0.22 : 0.28 + Math.random() * 0.32
    const tint = desert ? '255,245,230' : '255,255,255'
    grd.addColorStop(0, `rgba(${tint},${a})`)
    grd.addColorStop(1, `rgba(${tint},0)`)
    ctx.fillStyle = grd
    ctx.beginPath()
    ctx.ellipse(x, y, rx, ry, (Math.random() - 0.5) * 0.5, 0, Math.PI * 2)
    ctx.fill()
  }

  // Big readable sun + corona in the UPPER visible band (screen-top)
  const sx = desert ? 820 : 740
  const sy = desert ? 140 : 110
  const sunR = desert ? 95 : 62
  const haze = ctx.createRadialGradient(sx, sy, 0, sx, sy, desert ? 420 : 280)
  if (desert) {
    haze.addColorStop(0, 'rgba(255,240,170,0.95)')
    haze.addColorStop(0.18, 'rgba(255,190,90,0.45)')
    haze.addColorStop(0.45, 'rgba(255,160,70,0.18)')
    haze.addColorStop(1, 'rgba(255,180,80,0)')
  } else {
    haze.addColorStop(0, 'rgba(255,252,240,0.75)')
    haze.addColorStop(0.25, 'rgba(210,235,255,0.22)')
    haze.addColorStop(1, 'rgba(255,255,255,0)')
  }
  ctx.fillStyle = haze
  ctx.fillRect(0, 0, 1024, 1024)
  const core = ctx.createRadialGradient(sx, sy, 0, sx, sy, sunR)
  core.addColorStop(0, '#ffffff')
  core.addColorStop(0.35, desert ? '#ffe08a' : '#fff6d0')
  core.addColorStop(0.7, desert ? '#ffb040' : '#ffe8a0')
  core.addColorStop(1, 'rgba(255,180,80,0)')
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.arc(sx, sy, sunR, 0, Math.PI * 2)
  ctx.fill()

  return c
}

const SkyBackdropMat = shaderMaterial(
  {
    uTime: 0,
    uMode: 1,
    uMap: new THREE.Texture(),
  },
  /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  /* glsl */ `
    uniform float uTime;
    uniform float uMode;
    uniform sampler2D uMap;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash(i), b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }
    float fbm(vec2 p) {
      float v = 0.0; float a = 0.5;
      for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.05; a *= 0.5; }
      return v;
    }

    void main() {
      vec3 base = texture2D(uMap, vUv).rgb;
      // drifting soft cloud overlay on the painted sky
      vec2 cuv = vUv * vec2(3.5, 2.2) + vec2(uTime * 0.01, uTime * 0.004);
      float clouds = fbm(cuv);
      float amt = uMode < 1.5 ? 0.22 : 0.35;
      clouds = smoothstep(0.42, 0.75, clouds) * amt * smoothstep(0.05, 0.55, vUv.y);
      vec3 cloudCol = uMode < 1.5 ? vec3(1.0, 0.96, 0.9) : vec3(0.95, 0.98, 1.0);
      vec3 col = mix(base, cloudCol, clouds);
      // horizon warm lift
      float horiz = smoothstep(0.35, 0.0, vUv.y);
      if (uMode < 1.5) col = mix(col, vec3(1.0, 0.82, 0.55), horiz * 0.35);
      else col = mix(col, vec3(0.55, 0.8, 0.7), horiz * 0.25);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
)
extend({ SkyBackdropMat })

declare module '@react-three/fiber' {
  interface ThreeElements {
    skyBackdropMat: ThreeElement<typeof SkyBackdropMat>
  }
}

function SkyBackdrop({ biome }: { biome: Biome }) {
  const mat = useRef<any>(null)
  const { scene } = useThree()
  const desert = biome === 'desert'
  const map = useMemo(() => {
    const tex = new THREE.CanvasTexture(makeSkyCanvas(desert))
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    return tex
  }, [desert])

  // Fog-free scene background (shows in gaps / above horizon)
  useEffect(() => {
    scene.background = map
    return () => {
      if (scene.background === map) scene.background = null
    }
  }, [scene, map])

  useFrame((_, rawDt) => {
    if (mat.current) mat.current.uTime += gameDt(rawDt)
  })

  // Horizon billboard ABOVE the ground line only — depth-tested so it never paints over the floor
  return (
    <mesh
      position={[0, 22, 58]}
      rotation={[0, Math.PI, 0]}
      frustumCulled={false}
      renderOrder={-5}
    >
      <planeGeometry args={[180, 55]} />
      <skyBackdropMat
        ref={mat}
        fog={false}
        depthWrite={false}
        depthTest={true}
        toneMapped={false}
        uMode={desert ? 1 : 2}
        uMap={map}
        uTime={0}
      />
    </mesh>
  )
}


function SkySun({ biome }: { biome: Biome }) {
  const desert = biome === 'desert'
  // Sit in the visible sky strip just above the far ground edge
  return (
    <group position={desert ? [18, 22, 55] : [14, 24, 55]}>
      <mesh renderOrder={-15}>
        <sphereGeometry args={[desert ? 2.6 : 1.8, 24, 24]} />
        <meshBasicMaterial color={desert ? '#ffe566' : '#fff8e0'} toneMapped={false} fog={false} depthWrite={false} depthTest={false} />
      </mesh>
      <mesh renderOrder={-16}>
        <sphereGeometry args={[desert ? 6.0 : 4.2, 24, 24]} />
        <meshBasicMaterial
          color={desert ? '#ffb14a' : '#cfe6ff'}
          transparent
          opacity={desert ? 0.4 : 0.28}
          toneMapped={false}
          fog={false}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
      <pointLight intensity={desert ? 1.2 : 0.65} distance={70} color={desert ? '#ffc878' : '#e8f0ff'} />
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
      <group ref={g1} position={[0, 14, 8]}>
        <Cloud seed={1} position={[-6, 0, -8]} opacity={biome === 'desert' ? 0.28 : 0.4} speed={0.05} scale={1.4} color={tint} />
        <Cloud seed={2} position={[5, 0.5, 4]} opacity={biome === 'desert' ? 0.24 : 0.32} speed={0.04} scale={1.8} color={tint} />
        <Cloud seed={3} position={[0, -0.3, 12]} opacity={0.26} speed={0.03} scale={2} color="#ffffff" />
      </group>
      <group ref={g2} position={[0, 18, 12]}>
        <Cloud seed={4} position={[8, 0, -15]} opacity={biome === 'desert' ? 0.18 : 0.22} speed={0.02} scale={2.5} color={tint} />
        <Cloud seed={5} position={[-7, 0.4, 8]} opacity={0.2} speed={0.03} scale={2.2} color="#ffffff" />
      </group>
    </>
  )
}

export function Environment() {
  const biome = useGameStore((s) => s.biome)
  const desert = biome === 'desert'

  return (
    <>
      <SkyBackdrop biome={biome} />
      <SkySun biome={biome} />
      <DreiEnv preset={desert ? 'dawn' : 'forest'} environmentIntensity={desert ? 0.7 : 0.55} />
      <hemisphereLight args={desert ? ['#ffd9a0', '#8a6a3a', 0.85] : ['#a8e0ff', '#1e4a28', 0.85]} />
      <ambientLight intensity={desert ? 0.75 : 0.55} />
      <directionalLight
        castShadow
        position={desert ? [12, 18, 6] : [6, 20, 8]}
        intensity={desert ? 2.6 : 2.15}
        color={desert ? '#ffd7a0' : '#fff4d6'}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={90}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={40}
        shadow-camera-bottom={-30}
      />
      <pointLight position={[0, 5, 2]} intensity={desert ? 0.28 : 0.48} color={desert ? '#ffaa55' : '#7ad7ff'} />
      {/* Light distance haze on props/ground only — sky materials set fog={false} */}
      {desert && <fog attach="fog" args={['#e8d0a8', 90, 200]} />}
      {!desert && <fog attach="fog" args={['#8eb8a8', 95, 210]} />}
      <Ground biome={biome} />
      <ScrollingWorld biome={biome} />
      <Clouds biome={biome} />
    </>
  )
}
