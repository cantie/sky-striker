// Dev page for the effects (fx-preview.html?fx=puff,…): each cell plays one effect on a 3 s loop, from
// the game camera at the game's phone zoom, over a game ground (`&biome=arctic` swaps it for every cell).
// `&at=1.2` freezes every cell at that time, for screenshots. Sets window.__previewReady once every cell
// has played a while (or reached `at`).
import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { Environment } from './components/game/Environment'
import { ShipModel } from './components/game/Model'
import { BoltsMesh, EnemyBulletsMesh, MissilesMesh, type BoltView } from './components/game/fx/BulletMeshes'
import { FxRenderer, useFx, type Fx } from './components/game/fx/FxRenderer'
import { MuzzleFlash } from './components/game/fx/MuzzleFlash'
import { BIOMES, type Biome } from './game/biomes'
import { BOSSES } from './game/bosses'
import { models } from './game/assets/modelCache'
import { planeBoltColor } from './game/fx/color'
import { getPlane, PLANES } from './game/planes'
import { GAME_SPEED } from './game/speed'
import { MAX_WEAPON_POWER, PLAYER_BULLET_SPEED, weaponStats } from './game/weapon'

const LOOP = 3
/** The game's zoom on a 540-wide phone (half-width 8.3 units): effects show at their in-game size. */
const ZOOM = 540 / (2 * 8.3)
const HALF_H = 150 / ZOOM
/** Screenshot-ready once each cell has played this long. */
const READY_AT = 1.2
/** Real-time speeds, as the game draws them. */
const BOLT_SPEED = PLAYER_BULLET_SPEED * GAME_SPEED

/** Loop time in [0, LOOP), frozen with the cell. */
interface Clock { t(): number }

interface Cell {
  biome: Biome
  /** Called every frame with the loop time and the frame step. */
  play?(fx: Fx, t: number, dt: number): void
  /** What the cell draws, fed from its clock. */
  view?: (clock: Clock) => ReactNode
  /** Column captions along the top, at world x. */
  labels?: { x: number; text: string }[]
  /** Models to have loaded before the loop starts (a wreck must not pop in late). */
  preload?: string[]
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

/** HORNET's pair: launched sideways from the plane, curving onto two targets over 1.3 s. */
function homingPair(t: number) {
  const T = 1.3, s = Math.min(t / T, 1)
  return [1, -1].map((side) => {
    const p0 = { x: side * 0.6, z: -3.6 }, p1 = { x: side * 3.2, z: -1.2 }, p2 = { x: side * 1.4, z: 4 }
    const a = (1 - s) * (1 - s), b = 2 * (1 - s) * s, c = s * s
    return {
      x: a * p0.x + b * p1.x + c * p2.x, z: a * p0.z + b * p1.z + c * p2.z,
      vx: (2 * (1 - s) * (p1.x - p0.x) + 2 * s * (p2.x - p1.x)) / T, vz: (2 * (1 - s) * (p1.z - p0.z) + 2 * s * (p2.z - p1.z)) / T,
      flying: t < T,
    }
  })
}

/** n puffs a frame at the game's rate (one per 0.04 s), spread back along the frame's flight. */
function puffAlong(fx: Fx, t: number, dt: number, path: (t: number) => { x: number; z: number; vx: number; vz: number; flying: boolean }) {
  const n = Math.floor(dt / 0.04 + Math.random())
  for (let i = 0; i < n; i++) {
    const m = path(t - (dt * i) / n)
    if (m.flying) fx.puff(m.x, m.z, m.vx, m.vz)
  }
}

const COLS = PLANES.map((p, i) => ({ id: p.id, name: p.name, x: 7 - (14 * i) / (PLANES.length - 1) }))
const TOP = weaponStats(MAX_WEAPON_POWER)
const VOLLEY = 0.16

/** Every plane's bolts, one column each (+X is screen-left), at the four weapon tiers' radii. */
function boltColumns(clock: Clock) {
  const list: BoltView[] = []
  return () => {
    const t = clock.t()
    list.length = 0
    for (const c of COLS) {
      for (let k = 0; k < 8; k++) {
        const z = -HALF_H + ((t * BOLT_SPEED + k * 2.4) % (2 * HALF_H + 1))
        list.push({ x: c.x, z, vx: 0, vz: BOLT_SPEED, radius: 0.1 + (k % 4) * 0.035, color: planeBoltColor(c.id) })
      }
    }
    return list
  }
}

/** Rings of enemy bullets (and a boss's bigger ones) bursting from the middle. */
function enemyRings(clock: Clock) {
  const list: { x: number; z: number; radius: number }[] = []
  return () => {
    const t = clock.t()
    list.length = 0
    for (let ring = 0; ring < 3; ring++) {
      const r = ((t + ring) % LOOP) * 3 + 0.5
      const boss = ring === 1
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2 + ring * 0.3
        list.push({ x: Math.sin(a) * r, z: Math.cos(a) * r * 0.6, radius: boss ? 0.15 : 0.13 })
      }
    }
    return list
  }
}

/** The plane's volleys at max weapon, fired every VOLLEY seconds from z0. */
function volleys(clock: Clock, z0: number, color: string) {
  const list: BoltView[] = []
  return () => {
    const t = clock.t()
    list.length = 0
    for (let k = Math.floor(t / VOLLEY); k >= 0; k--) {
      const z = z0 + 0.6 + (t - k * VOLLEY) * BOLT_SPEED
      if (z > HALF_H + 1) break
      for (const s of TOP.streams) list.push({ x: s.x + s.vx * (t - k * VOLLEY) * GAME_SPEED, z, vx: s.vx, vz: PLAYER_BULLET_SPEED, radius: TOP.radius, color })
    }
    return list
  }
}

/** True on the frame the loop clock passes `at`. */
const passes = (t: number, dt: number, at: number) => t - dt < at && t >= at

/** Three plane colours firing up into a boss's belly at z = HIT_Z. */
const HIT_Z = 0.6
const HIT_COLS = [{ x: 3, id: 'hawk' }, { x: 0, id: 'nova' }, { x: -3, id: 'hornet' }]
const HIT_Z0 = -4.2
/** When volley k of the hits cell reaches the boss. */
const hitTime = (k: number) => k * VOLLEY + (HIT_Z - HIT_Z0) / BOLT_SPEED

function hitBolts(clock: Clock) {
  const list: BoltView[] = []
  return () => {
    const t = clock.t()
    list.length = 0
    for (let k = Math.floor(t / VOLLEY); k >= 0 && hitTime(k) > t; k--) {
      const z = HIT_Z0 + (t - k * VOLLEY) * BOLT_SPEED
      for (const c of HIT_COLS) list.push({ x: c.x, z, vx: 0, vz: BOLT_SPEED, radius: TOP.radius, color: planeBoltColor(c.id) })
    }
    return list
  }
}

function Boss({ id, z }: { id: string; z: number }) {
  const def = BOSSES[id]
  return (
    <group position={[0, 0.4, z]} rotation={[0, Math.PI, 0]}>
      <ShipModel path={def.model!} size={def.size} flame={def.flameColor} flames={def.flames} nozzles={def.nozzles} flameScale={1.3} />
    </group>
  )
}

const EXPLOSION_COLS = [{ x: 4.5, scale: 1, text: '1 enemy' }, { x: 0, scale: 1.2, text: '1.2 ram' }, { x: -4.5, scale: 1.6, text: '1.6 heavy' }]

function Plane({ id, z }: { id: string; z: number }) {
  const p = getPlane(id)
  return (
    <group position={[0, 0.2, z]}>
      <ShipModel path={p.model} size={p.size} flame={p.flame} core="#ffffff" flames={p.flames} nozzles={p.nozzles} flameScale={1.1} />
    </group>
  )
}

const CELLS: Record<string, Cell> = {
  puff: {
    biome: 'jungle',
    play: (fx, t, dt) => puffAlong(fx, t, dt, missilePath),
  },
  bolts: {
    biome: 'autumn',
    view: (clock) => <BoltsMesh bolts={boltColumns(clock)} />,
    labels: COLS.map((c) => ({ x: c.x, text: c.name })),
  },
  enemy: {
    biome: 'arctic',
    view: (clock) => <EnemyBulletsMesh bullets={enemyRings(clock)} />,
  },
  missiles: {
    biome: 'desert',
    play: (fx, t, dt) => { for (const side of [0, 1]) puffAlong(fx, t, dt, (u) => homingPair(u)[side]) },
    view: (clock) => (
      <>
        <MissilesMesh missiles={() => homingPair(clock.t()).filter((m) => m.flying)} />
        <Suspense fallback={null}><Plane id="hornet" z={-3.6} /></Suspense>
      </>
    ),
  },
  explosion: {
    biome: 'jungle',
    play: (fx, t, dt) => { if (passes(t, dt, 0.05)) for (const c of EXPLOSION_COLS) fx.explosion(c.x, 0, c.scale) },
    labels: EXPLOSION_COLS.map((c) => ({ x: c.x, text: c.text })),
  },
  hits: {
    biome: 'city',
    play: (fx, t, dt) => {
      for (let k = 0; hitTime(k) <= t; k++) {
        if (passes(t, dt, hitTime(k))) for (const c of HIT_COLS) fx.hit(c.x, HIT_Z, planeBoltColor(c.id))
      }
    },
    view: (clock) => (
      <>
        <BoltsMesh bolts={hitBolts(clock)} />
        <Suspense fallback={null}><Boss id="hornet" z={3.6} /></Suspense>
      </>
    ),
    labels: HIT_COLS.map((c) => ({ x: c.x, text: c.id.toUpperCase() })),
  },
  bossdeath: {
    biome: 'autumn',
    play: (fx, t, dt) => { if (passes(t, dt, 0.05)) fx.bossDeath(0, 0.4, BOSSES.hornet) },
    preload: [BOSSES.hornet.model!],
  },
  muzzle: {
    biome: 'ocean',
    view: (clock) => {
      const xs = TOP.streams.map((s) => s.x)
      // The store's flash: 1 at a volley, losing 0.004 a game-ms
      const flash = () => 1 - ((clock.t() % VOLLEY) * 1000 * GAME_SPEED * 0.004)
      return (
        <>
          <BoltsMesh bolts={volleys(clock, -3, planeBoltColor('hawk'))} />
          <group position={[0, 0.2, -3]}><MuzzleFlash guns={() => xs} flash={flash} /></group>
          <Suspense fallback={null}><Plane id="hawk" z={-3} /></Suspense>
        </>
      )
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

/** Mounts once the ground has loaded: the cell's clock waits for it, so a shot never shows a bare canvas. */
function GroundIn({ ready }: { ready: { current: boolean } }) {
  useEffect(() => { ready.current = true }, [ready])
  return null
}

function Player({ cell, elapsed, frozen, ground }: { cell: Cell; elapsed: { current: number }; frozen: { current: boolean }; ground: { current: boolean } }) {
  const fx = useFx()
  const readyAt = freezeAt || READY_AT
  useFrame((_, delta) => {
    if (frozen.current || !ground.current) return
    const dt = Math.min(delta, 0.1, freezeAt ? freezeAt - elapsed.current : Infinity)
    const before = elapsed.current
    elapsed.current += dt
    cell.play?.(fx, elapsed.current % LOOP, dt)
    if (freezeAt && elapsed.current >= freezeAt - 1e-6) frozen.current = true
    if (before < readyAt && elapsed.current >= readyAt - 1e-6) markReady()
  })
  return null
}

function CellView({ name }: { name: string }) {
  const cell = CELLS[name]
  const frozen = useRef(false)
  const ground = useRef(false)
  const elapsed = useRef(0)
  const clock = useMemo<Clock>(() => ({ t: () => elapsed.current % LOOP }), [])
  const view = useMemo(() => cell.view?.(clock), [cell, clock])
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
          <GroundIn ready={ground} />
        </Suspense>
        <FxRenderer paused={() => frozen.current || !ground.current}>
          {view}
          <Player cell={cell} elapsed={elapsed} frozen={frozen} ground={ground} />
        </FxRenderer>
        {/* As GameScene */}
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.7} luminanceThreshold={0.7} mipmapBlur levels={5} />
          <Vignette offset={0.3} darkness={0.35} />
        </EffectComposer>
      </Canvas>
      {cell.labels?.map((l) => (
        <div key={l.text} style={{ ...caption, left: 270 - l.x * ZOOM - 40 }}>{l.text}</div>
      ))}
      <div style={label}>{name}</div>
    </div>
  )
}

function Page() {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    document.title = `FX preview: ${cells.join(', ')}`
    const paths = cells.flatMap((n) => CELLS[n].preload ?? [])
    void Promise.all(paths.map((p) => models.get(p).catch(() => win.__previewErrors!.push(`${p}: failed to load`)))).then(() => setLoaded(true))
  }, [])
  if (!loaded) return null
  return <div style={{ width: 540 }}>{cells.map((n) => <CellView key={n} name={n} />)}</div>
}

const label: CSSProperties = {
  position: 'absolute', left: 0, right: 0, bottom: 4, textAlign: 'center',
  font: '700 14px sans-serif', color: '#fff', textShadow: '0 1px 3px #000',
}
const caption: CSSProperties = {
  position: 'absolute', top: 3, width: 80, textAlign: 'center',
  font: '700 9px sans-serif', color: '#fff', textShadow: '0 1px 2px #000',
}

createRoot(document.getElementById('root')!).render(<Page />)
