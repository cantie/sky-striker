import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment as DreiEnv } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore, type Biome } from '../../store/gameStore'
import { GROUND_Y, WORLD_SCROLL } from '../../game/world'
import { GlbModel } from './Model'
import { paintGround } from './terrain/paint'
import { makeChunk } from './terrain/props'
import { THEMES, type Theme } from './terrain/themes'

export { GROUND_Y } from '../../game/world'

/** Ground texture tile covers TILE×TILE world units. */
const TILE = 32
const GROUND_W = 140
const GROUND_D = 100

function Ground({ biome, theme }: { biome: Biome; theme: Theme }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)

  const { map, glowMap } = useMemo(() => {
    const paint = paintGround(biome)
    const wrap = (canvas: HTMLCanvasElement, srgb: boolean) => {
      const tex = new THREE.CanvasTexture(canvas)
      if (srgb) tex.colorSpace = THREE.SRGBColorSpace
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      // Square TILE-sized repeats (no stretching) across the oversized plane
      tex.repeat.set(GROUND_W / TILE, GROUND_D / TILE)
      tex.anisotropy = 8
      tex.needsUpdate = true
      return tex
    }
    return { map: wrap(paint.albedo, true), glowMap: paint.glow ? wrap(paint.glow, true) : null }
  }, [biome])

  useEffect(() => () => { map.dispose(); glowMap?.dispose() }, [map, glowMap])

  useFrame(() => {
    const mat = matRef.current
    if (!mat?.map) return
    // Same world speed as the props so trees/rocks stay glued to the terrain
    const scroll = useGameStore.getState().scrollOffset
    const off = -((scroll * WORLD_SCROLL) / TILE) % 1
    mat.map.offset.y = off
    if (mat.emissiveMap) mat.emissiveMap.offset.y = off
  })

  // Continuous floor under the whole visible area (top-down camera never sees past it)
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y, 8]} receiveShadow frustumCulled={false}>
      <planeGeometry args={[GROUND_W, GROUND_D]} />
      <meshStandardMaterial
        key={biome}
        ref={matRef}
        map={map}
        color={theme.groundTint}
        emissiveMap={glowMap}
        emissive={glowMap ? '#ffffff' : '#000000'}
        emissiveIntensity={theme.glow}
        roughness={0.9}
        metalness={0}
        envMapIntensity={0.45}
      />
    </mesh>
  )
}

const CHUNK_LEN = 18
const CHUNKS = 8

function ScrollingWorld({ biome }: { biome: Biome }) {
  const group = useRef<THREE.Group>(null)
  const chunks = useMemo(() => {
    const out: { id: number; z: number; props: ReturnType<typeof makeChunk> }[] = []
    for (let i = 0; i < CHUNKS; i++) {
      out.push({ id: i, z: i * CHUNK_LEN - 20, props: [...makeChunk(biome, i * 3 + 1, 0), ...makeChunk(biome, i * 3 + 2, 2)] })
    }
    return out
  }, [biome])

  useFrame(() => {
    if (!group.current) return
    const period = CHUNK_LEN * CHUNKS
    group.current.position.z = -((useGameStore.getState().scrollOffset * WORLD_SCROLL) % period)
  })

  // Two copies back to back so the loop never shows a gap
  return (
    <group ref={group}>
      {[0, CHUNK_LEN * CHUNKS].map((shift) => chunks.map((c) => (
        <group key={`${biome}-${shift}-${c.id}`} position={[0, 0, c.z + shift]}>
          {c.props.map((p) => (
            <group key={p.key} position={[p.x, GROUND_Y, p.z]} rotation={[0, p.rot ?? 0, 0]}>
              <GlbModel path={p.path} size={p.size} sizeAxis={p.sizeAxis} palette={p.palette} grounded />
            </group>
          ))}
        </group>
      )))}
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
function Clouds({ biome, theme }: { biome: Biome; theme: Theme }) {
  const tops = useRef<(THREE.Mesh | null)[]>([])
  const shadows = useRef<(THREE.Mesh | null)[]>([])
  const lastScroll = useRef(useGameStore.getState().scrollOffset)
  const look = theme.clouds

  const textures = useMemo(() => [0, 1, 2].map(() => {
    const t = new THREE.CanvasTexture(makeCloudCanvas())
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }), [])
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures])

  const clouds = useMemo(() => {
    const n = look.count
    return Array.from({ length: n }, (_, i) => ({
      x: (Math.random() - 0.5) * 22,
      z: CLOUD_RANGE.minZ + ((i + Math.random() * 0.6) / n) * (CLOUD_RANGE.maxZ - CLOUD_RANGE.minZ),
      scale: 9 + Math.random() * 7,
      rot: Math.random() * Math.PI * 2,
      tex: i % textures.length,
    }))
  }, [look.count, textures])

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
            <meshBasicMaterial map={textures[c.tex]} color={look.color} transparent opacity={look.opacity} depthWrite={false} fog={false} />
          </mesh>
          <mesh
            ref={(m) => { shadows.current[i] = m }}
            position={[c.x + SHADOW_OFFSET[0], GROUND_Y + 0.03, c.z + SHADOW_OFFSET[1]]}
            rotation={[-Math.PI / 2, 0, c.rot]}
            scale={[c.scale * 0.9, c.scale * 0.72, 1]}
          >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={textures[c.tex]} color="#000000" transparent opacity={look.shadow} depthWrite={false} fog={false} />
          </mesh>
        </group>
      ))}
    </>
  )
}

export function Environment() {
  const biome = useGameStore((s) => s.biome)
  const theme = THEMES[biome]

  return (
    <>
      <DreiEnv preset={theme.env} environmentIntensity={theme.envIntensity} />
      <hemisphereLight args={theme.hemi} />
      <ambientLight intensity={theme.ambient} />
      <directionalLight
        castShadow
        position={theme.sun.position}
        intensity={theme.sun.intensity}
        color={theme.sun.color}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={90}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={40}
        shadow-camera-bottom={-30}
      />
      <pointLight position={[0, 5, 2]} intensity={theme.fill.intensity} color={theme.fill.color} />
      <fog attach="fog" args={[theme.fog, 55, 120]} />
      <Ground biome={biome} theme={theme} />
      <ScrollingWorld biome={biome} />
      <Clouds biome={biome} theme={theme} />
    </>
  )
}
