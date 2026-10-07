import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment as DreiEnv, shaderMaterial } from '@react-three/drei'
import { extend, type ThreeElement } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore, type Biome } from '../../store/gameStore'
import { GlbModel, MODEL_PATHS, type MaterialPalette } from './Model'
import { gameDt } from '../../game/speed'

/** World Y where the continuous ground plane sits; props sit on top of this. */
export const GROUND_Y = -2.05

/** World units scrolled per unit of store scrollOffset — props, ground and clouds all share it. */
const WORLD_SCROLL = 40
/** Ground texture tile covers TILE×TILE world units. */
const TILE = 32
const TEX = 2048

/** Draws `draw` at every wrapped copy of (x, y) that overlaps the tile, so features cross edges seamlessly. */
function wrapped(x: number, y: number, r: number, draw: (x: number, y: number) => void) {
  for (const dx of [-TEX, 0, TEX]) {
    for (const dy of [-TEX, 0, TEX]) {
      const px = x + dx, py = y + dy
      if (px + r < 0 || px - r > TEX || py + r < 0 || py - r > TEX) continue
      draw(px, py)
    }
  }
}

/** Soft radial blob, optionally squashed/rotated, wrapped across tile edges. */
function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, inner: string, outer: string, squash = 1, rot = 0) {
  wrapped(x, y, r, (px, py) => {
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(rot)
    ctx.scale(1, squash)
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
    g.addColorStop(0, inner)
    g.addColorStop(1, outer)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  })
}

/** Sum of sines with whole-cycle frequencies → the curve is periodic over the tile. */
type Wave = [amp: number, cycles: number, phase: number]
const waveAt = (t: number, waves: Wave[]) => waves.reduce((s, [a, k, p]) => s + a * Math.sin((t / TEX) * Math.PI * 2 * k + p), 0)

/** Strokes a periodic curve running along the tile's Y (vertical) or X (horizontal) axis, wrapped across the other axis. */
function periodicStroke(ctx: CanvasRenderingContext2D, axis: 'x' | 'y', base: number, waves: Wave[], style: string, width: number, dash?: number[]) {
  ctx.strokeStyle = style
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.setLineDash(dash ?? [])
  for (const shift of [-TEX, 0, TEX]) {
    ctx.beginPath()
    for (let t = -32; t <= TEX + 32; t += 8) {
      const o = base + shift + waveAt(t, waves)
      if (axis === 'y') ctx.lineTo(o, t)
      else ctx.lineTo(t, o)
    }
    ctx.stroke()
  }
  ctx.setLineDash([])
}

function grain(ctx: CanvasRenderingContext2D, count: number, light: string, dark: string) {
  for (let i = 0; i < count; i++) {
    const a = (0.06 + Math.random() * 0.16).toFixed(2)
    ctx.fillStyle = (Math.random() > 0.5 ? light : dark).replace('A', a)
    ctx.fillRect(Math.random() * TEX, Math.random() * TEX, 1 + Math.random() * 3, 1 + Math.random() * 3)
  }
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

/** Jungle: meadows + dark forest canopy, farm plots, a winding river and dirt tracks. */
function paintJungle(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#3f7d37'
  ctx.fillRect(0, 0, TEX, TEX)

  for (let i = 0; i < 70; i++) {
    const light = i % 2 === 0
    blob(ctx, rand(0, TEX), rand(0, TEX), rand(140, 420),
      light ? 'rgba(130,185,70,0.38)' : 'rgba(22,66,28,0.42)', 'rgba(0,0,0,0)', rand(0.45, 1), rand(0, Math.PI))
  }

  // Farm plots: striped rotated rectangles
  const crops = [['#86b04c', '#739c40'], ['#bba95a', '#a8964c'], ['#5f9a3a', '#548a33']]
  for (let i = 0; i < 5; i++) {
    const w = rand(220, 380), h = rand(160, 280), rot = rand(-0.5, 0.5)
    const [c1, c2] = crops[i % crops.length]
    wrapped(rand(0, TEX), rand(0, TEX), Math.hypot(w, h) / 2, (px, py) => {
      ctx.save()
      ctx.translate(px, py)
      ctx.rotate(rot)
      ctx.fillStyle = 'rgba(70,55,30,0.55)'
      ctx.fillRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16)
      for (let s = 0; s < h; s += 18) {
        ctx.fillStyle = (s / 18) % 2 === 0 ? c1 : c2
        ctx.fillRect(-w / 2, -h / 2 + s, w, Math.min(18, h - s))
      }
      ctx.restore()
    })
  }

  // Dirt tracks (horizontal, wrapping)
  for (const base of [TEX * 0.22, TEX * 0.71]) {
    const waves: Wave[] = [[60, 1, rand(0, 6)], [24, 3, rand(0, 6)]]
    periodicStroke(ctx, 'x', base, waves, 'rgba(95,72,40,0.7)', 26)
    periodicStroke(ctx, 'x', base, waves, '#b49a64', 16)
  }

  // Forest canopy clusters: dark crowns with sunlit tops (sun from upper-left)
  for (let c = 0; c < 22; c++) {
    const cx = rand(0, TEX), cy = rand(0, TEX), spread = rand(90, 220)
    const n = Math.floor(rand(40, 90))
    for (let i = 0; i < n; i++) {
      const ang = rand(0, Math.PI * 2), d = Math.sqrt(Math.random()) * spread
      const r = rand(12, 28)
      wrapped(cx + Math.cos(ang) * d, cy + Math.sin(ang) * d, r * 1.4, (px, py) => {
        ctx.fillStyle = 'rgba(14,40,18,0.55)'
        ctx.beginPath(); ctx.arc(px + r * 0.35, py + r * 0.35, r, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = i % 3 === 0 ? '#2c6b2c' : '#255f28'
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = 'rgba(120,190,80,0.45)'
        ctx.beginPath(); ctx.arc(px - r * 0.3, py - r * 0.3, r * 0.5, 0, Math.PI * 2); ctx.fill()
      })
    }
  }

  // River (vertical, periodic): sandy banks → wet edge → water → shimmer
  const river: Wave[] = [[230, 1, 0.4], [90, 2, 1.7], [36, 4, 0.6]]
  periodicStroke(ctx, 'y', TEX * 0.5, river, 'rgba(200,184,120,0.9)', 150)
  periodicStroke(ctx, 'y', TEX * 0.5, river, '#2f5f3f', 116)
  periodicStroke(ctx, 'y', TEX * 0.5, river, '#2a77a0', 100)
  periodicStroke(ctx, 'y', TEX * 0.5, river, '#3b96c0', 60)
  periodicStroke(ctx, 'y', TEX * 0.5 - 14, river, 'rgba(220,245,255,0.35)', 4, [30, 70])
  periodicStroke(ctx, 'y', TEX * 0.5 + 18, river, 'rgba(220,245,255,0.25)', 3, [18, 90])

  grain(ctx, 36000, 'rgba(150,215,100,A)', 'rgba(30,70,30,A)')
}

/** Desert: dune ripples, a dry wadi, scattered rocks and a dashed highway. */
function paintDesert(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#c99a5e'
  ctx.fillRect(0, 0, TEX, TEX)

  for (let i = 0; i < 60; i++) {
    const light = i % 2 === 0
    blob(ctx, rand(0, TEX), rand(0, TEX), rand(160, 460),
      light ? 'rgba(232,192,128,0.4)' : 'rgba(150,96,48,0.35)', 'rgba(0,0,0,0)', rand(0.35, 0.8), rand(-0.4, 0.4))
  }

  // Dune ripples: shaded trough + faint lit crest, sparse enough to read as sand not marble
  for (let i = 0; i < 32; i++) {
    const base = ((i + rand(-0.3, 0.3)) / 32) * TEX
    const waves: Wave[] = [[rand(14, 40), 1 + (i % 3), rand(0, 6)], [rand(4, 10), 4, rand(0, 6)]]
    periodicStroke(ctx, 'x', base, waves, 'rgba(140,88,40,0.16)', rand(10, 18))
    periodicStroke(ctx, 'x', base - 9, waves, 'rgba(245,215,160,0.1)', rand(5, 9))
  }

  // Dry wadi (vertical): darker eroded bed with soft pebbly floor
  const wadi: Wave[] = [[200, 1, 2.1], [70, 3, 0.4]]
  periodicStroke(ctx, 'y', TEX * 0.62, wadi, 'rgba(128,80,40,0.35)', 170)
  periodicStroke(ctx, 'y', TEX * 0.62, wadi, 'rgba(176,128,78,0.85)', 120)
  periodicStroke(ctx, 'y', TEX * 0.62, wadi, 'rgba(196,152,100,0.6)', 60)

  // Rocks: shadow, body, highlight
  for (let i = 0; i < 160; i++) {
    const r = rand(5, 18)
    wrapped(rand(0, TEX), rand(0, TEX), r * 2, (px, py) => {
      ctx.fillStyle = 'rgba(90,55,25,0.45)'
      ctx.beginPath(); ctx.ellipse(px + r * 0.5, py + r * 0.4, r * 1.1, r * 0.8, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#a2703f'
      ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(255,220,160,0.5)'
      ctx.beginPath(); ctx.ellipse(px - r * 0.3, py - r * 0.25, r * 0.45, r * 0.3, 0, 0, Math.PI * 2); ctx.fill()
    })
  }

  // Highway (vertical): shoulder, asphalt, dashed centre line
  const road: Wave[] = [[60, 1, 0.9], [20, 2, 2.4]]
  periodicStroke(ctx, 'y', TEX * 0.18, road, 'rgba(120,90,60,0.6)', 64)
  periodicStroke(ctx, 'y', TEX * 0.18, road, '#6b6159', 48)
  periodicStroke(ctx, 'y', TEX * 0.18, road, '#e9d9a2', 4, [34, 30])

  grain(ctx, 40000, 'rgba(240,214,170,A)', 'rgba(110,70,34,A)')
}

function makeGroundCanvas(desert: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = TEX
  c.height = TEX
  const ctx = c.getContext('2d')!
  if (desert) paintDesert(ctx)
  else paintJungle(ctx)
  return c
}

const GROUND_W = 140
const GROUND_D = 100

function Ground({ biome }: { biome: Biome }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  const desert = biome === 'desert'

  const map = useMemo(() => {
    const tex = new THREE.CanvasTexture(makeGroundCanvas(desert))
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    // Square TILE-sized repeats (no stretching) across the oversized plane
    tex.repeat.set(GROUND_W / TILE, GROUND_D / TILE)
    tex.anisotropy = 8
    tex.needsUpdate = true
    return tex
  }, [desert])

  useEffect(() => () => map.dispose(), [map])

  useFrame(() => {
    if (!matRef.current?.map) return
    // Same world speed as the props so trees/rocks stay glued to the terrain
    const scroll = useGameStore.getState().scrollOffset
    matRef.current.map.offset.y = -((scroll * WORLD_SCROLL) / TILE) % 1
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
      <planeGeometry args={[GROUND_W, GROUND_D]} />
      <meshStandardMaterial
        ref={matRef}
        map={map}
        color="#ffffff"
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
  palette?: MaterialPalette
}

// Kenney nature kit ships teal leaves/grass; re-tint to natural greens with per-prop variety
const BARK = { color: '#7a4e2c' }
const TREE_PALETTES: MaterialPalette[] = ['#3f8f3a', '#2e7a33', '#5ba043', '#477f2a', '#6aa84f'].map((c) => ({ leafsGreen: { color: c }, woodBark: BARK }))
const BUSH_PALETTES: MaterialPalette[] = ['#4c9638', '#3d8530', '#5fa844'].map((c) => ({ grass: { color: c } }))
const JUNGLE_ROCK: MaterialPalette = { dirt: { color: '#8f8a7e' }, grass: { color: '#5c9a3e' } }
const DESERT_ROCK: MaterialPalette = { dirt: { color: '#a8724a' }, grass: { color: '#d2a868' } }
const DRY_PALM: MaterialPalette = { leafsGreen: { color: '#8f9a3e' }, woodBark: { color: '#8a6038' } }
const pickFrom = <T,>(list: T[], r: number) => list[Math.floor(r * list.length) % list.length]

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
      palette: DESERT_ROCK,
    })
  }
  if (rnd(60) > 0.55) {
    items.push({
      // Big boulder outcrop (the cliff block read as a flat square from top-down)
      key: `outcrop-${seed}`,
      path: MODEL_PATHS.rockB,
      x: baseX + (rnd(61) - 0.5) * 2,
      z: (rnd(62) - 0.5) * 2,
      size: 2.8 + rnd(63) * 1.2,
      rot: rnd(64) * 6,
      palette: DESERT_ROCK,
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
      palette: DRY_PALM,
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
      palette: pickFrom(TREE_PALETTES, rnd(45 + i)),
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
      palette: pickFrom(BUSH_PALETTES, rnd(85 + i)),
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
      palette: JUNGLE_ROCK,
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
    group.current.position.z = -((useGameStore.getState().scrollOffset * WORLD_SCROLL) % period)
  })

  return (
    <group ref={group}>
      {chunks.map((c) => (
        <group key={`${biome}-${c.id}`} position={[0, 0, c.z]}>
          {c.props.map((p) => (
            <group key={p.key} position={[p.x, GROUND_Y, p.z]} rotation={[0, p.rot ?? 0, 0]}>
              <GlbModel path={p.path} size={p.size} sizeAxis={p.sizeAxis} palette={p.palette} grounded />
            </group>
          ))}
        </group>
      ))}
      {chunks.map((c) => (
        <group key={`${biome}-d${c.id}`} position={[0, 0, c.z + 18 * 8]}>
          {c.props.map((p) => (
            <group key={p.key} position={[p.x, GROUND_Y, p.z]} rotation={[0, p.rot ?? 0, 0]}>
              <GlbModel path={p.path} size={p.size} sizeAxis={p.sizeAxis} palette={p.palette} grounded />
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

/** Puffy top-down cloud sprite: overlapping soft blobs, alpha fading to the rim. */
function makeCloudCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const ctx = c.getContext('2d')!
  for (let i = 0; i < 26; i++) {
    const ang = Math.random() * Math.PI * 2
    const d = Math.sqrt(Math.random()) * 150
    const x = 256 + Math.cos(ang) * d * 1.2
    const y = 256 + Math.sin(ang) * d * 0.75
    const r = 60 + Math.random() * 70 * (1 - d / 220)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(255,255,255,0.55)')
    g.addColorStop(0.6, 'rgba(255,255,255,0.25)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  return c
}

/** Height of the cloud deck: above ships (y≈0.3), well below the camera (y=50). */
const CLOUD_Y = 9
/** Clouds sit closer to the camera than the ground, so they rush past a bit faster. */
const CLOUD_PARALLAX = 1.35
/** Offset of each cloud's ground shadow, matching the sun coming from upper-right. */
const SHADOW_OFFSET: [number, number] = [-2.2, -1.6]
const CLOUD_RANGE = { minZ: -26, maxZ: 34 }

/**
 * Sparse, semi-transparent cloud deck that sweeps over the action (Sky Force signature),
 * each with a soft shadow on the ground so the scene gets real depth.
 */
function Clouds({ biome }: { biome: Biome }) {
  const desert = biome === 'desert'
  const tops = useRef<(THREE.Mesh | null)[]>([])
  const shadows = useRef<(THREE.Mesh | null)[]>([])
  const lastScroll = useRef(useGameStore.getState().scrollOffset)

  const textures = useMemo(() => [0, 1, 2].map(() => {
    const t = new THREE.CanvasTexture(makeCloudCanvas())
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }), [])
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures])

  const clouds = useMemo(() => {
    const n = desert ? 4 : 6
    return Array.from({ length: n }, (_, i) => ({
      x: (Math.random() - 0.5) * 22,
      z: CLOUD_RANGE.minZ + ((i + Math.random() * 0.6) / n) * (CLOUD_RANGE.maxZ - CLOUD_RANGE.minZ),
      scale: 9 + Math.random() * 7,
      rot: Math.random() * Math.PI * 2,
      tex: i % textures.length,
    }))
  }, [desert, textures])

  useFrame(() => {
    const scroll = useGameStore.getState().scrollOffset
    let dz = (scroll - lastScroll.current) * WORLD_SCROLL * CLOUD_PARALLAX
    lastScroll.current = scroll
    if (dz < 0 || dz > 5) dz = 0 // stage restart resets scroll
    clouds.forEach((c, i) => {
      c.z -= dz
      if (c.z < CLOUD_RANGE.minZ) {
        c.z += CLOUD_RANGE.maxZ - CLOUD_RANGE.minZ
        c.x = (Math.random() - 0.5) * 22
      }
      tops.current[i]?.position.set(c.x, CLOUD_Y, c.z)
      shadows.current[i]?.position.set(c.x + SHADOW_OFFSET[0], GROUND_Y + 0.03, c.z + SHADOW_OFFSET[1])
    })
  })

  return (
    <>
      {clouds.map((c, i) => (
        <group key={`${biome}-cloud-${i}`}>
          <mesh
            ref={(m) => { tops.current[i] = m }}
            position={[c.x, CLOUD_Y, c.z]}
            rotation={[-Math.PI / 2, 0, c.rot]}
            scale={[c.scale, c.scale * 0.8, 1]}
            renderOrder={10}
          >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              map={textures[c.tex]}
              color={desert ? '#fff4e2' : '#ffffff'}
              transparent
              opacity={desert ? 0.42 : 0.55}
              depthWrite={false}
              fog={false}
            />
          </mesh>
          <mesh
            ref={(m) => { shadows.current[i] = m }}
            position={[c.x + SHADOW_OFFSET[0], GROUND_Y + 0.03, c.z + SHADOW_OFFSET[1]]}
            rotation={[-Math.PI / 2, 0, c.rot]}
            scale={[c.scale * 0.9, c.scale * 0.72, 1]}
          >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={textures[c.tex]} color="#000000" transparent opacity={desert ? 0.22 : 0.28} depthWrite={false} fog={false} />
          </mesh>
        </group>
      ))}
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
      {/* jungle sky tint kept near-white: a saturated blue turned every top face teal */}
      <hemisphereLight args={desert ? ['#ffd9a0', '#8a6a3a', 0.85] : ['#e4f2ff', '#2a4a24', 0.8]} />
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
      {desert && <fog attach="fog" args={['#e8d0a8', 55, 120]} />}
      {!desert && <fog attach="fog" args={['#8eb8a8', 55, 120]} />}
      <Ground biome={biome} />
      <ScrollingWorld biome={biome} />
      <Clouds biome={biome} />
    </>
  )
}
