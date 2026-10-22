// Bullets as drawn: plasma bolts, enemy bullets and homing missiles. Each takes a getter for its list, so
// the game and the preview page feed them alike. Fixed draw calls whatever the counts: 1, 3 and 2.
import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { boltQuad, enemyBulletLayers } from '../../../game/fx/bulletLook'
import { boltColor, ENEMY_BULLET_COLOR } from '../../../game/fx/color'
import { BOLT_LAYER, ENEMY_BULLET_LAYERS } from '../../../game/fx/layers'
import { fxQuad, spriteMaterial, streakMaterial } from './materials'
import { useWarmUp } from './warm'

export const MAX_BULLETS = 512

export interface BoltView { x: number; z: number; vx: number; vz: number; radius: number; color?: string }

/** Bolts fired with no colour (none today, but a safe default): the old cyan. */
const UNTINTED = '#7cf9ff'
/** A missile's tip glow and tail flame. */
const MISSILE_TIP = new THREE.Color('#ff3a2a')
const MISSILE_FLAME = new THREE.Color('#ffa340')

const tints = new Map<string, THREE.Color>()
/** A bolt colour as linear RGB, pushed off the enemy magenta; cached, a fight has only a few. */
function tint(hex = UNTINTED): THREE.Color {
  let c = tints.get(hex)
  if (!c) { c = new THREE.Color(boltColor(hex)); tints.set(hex, c) }
  return c
}

const UP = new THREE.Vector3(0, 1, 0)
const m4 = new THREE.Matrix4(), quat = new THREE.Quaternion(), at = new THREE.Vector3(), scl = new THREE.Vector3()

/** Instance i: centred at (x, y, z), turned to `heading` (0 = +Z), scaled w across and l along. */
function place(mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, heading: number, w: number, l: number) {
  quat.setFromAxisAngle(UP, heading)
  at.set(x, y, z)
  scl.set(w, 1, l)
  mesh.setMatrixAt(i, m4.compose(at, quat, scl))
}

/** Upload only the live instances. */
function commit(attr: THREE.InstancedBufferAttribute | null, n: number) {
  if (!attr || !n) return
  attr.clearUpdateRanges()
  attr.addUpdateRange(0, n * attr.itemSize)
  attr.needsUpdate = true
}

function instanced(geometry: THREE.BufferGeometry, material: THREE.Material, max: number, colors = false) {
  const mesh = new THREE.InstancedMesh(geometry, material, max)
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  if (colors) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage)
  // Instances spread across the whole field: bounds from the base quad would cull them
  mesh.frustumCulled = false
  mesh.count = 0
  return mesh
}

function useMeshes<T extends Record<string, THREE.InstancedMesh>>(build: () => T): T {
  const meshes = useMemo(build, [])
  useEffect(() => () => {
    for (const m of Object.values(meshes)) { m.geometry.dispose(); (m.material as THREE.Material).dispose() }
  }, [meshes])
  return meshes
}

// ── Plasma bolts ──

export function buildBoltsMesh(max = MAX_BULLETS) {
  return instanced(fxQuad(), streakMaterial(), max, true)
}

const UNIT = boltQuad(1)

/** Bolt i: a streak `boltQuad(radius)` long, its tip `front` ahead of the hit point along the flight. */
export function syncBolts(mesh: THREE.InstancedMesh, views: readonly BoltView[]) {
  const n = Math.min(views.length, mesh.instanceMatrix.count)
  for (let i = 0; i < n; i++) {
    const v = views[i]
    const sp = Math.hypot(v.vx, v.vz) || 1
    const front = UNIT.front * v.radius, back = UNIT.back * v.radius
    const off = (front - back) / 2
    place(mesh, i, v.x + (v.vx / sp) * off, 0, v.z + (v.vz / sp) * off, Math.atan2(v.vx, v.vz), UNIT.width * v.radius, front + back)
    mesh.setColorAt(i, tint(v.color))
  }
  mesh.count = n
  mesh.visible = n > 0
  commit(mesh.instanceMatrix, n)
  commit(mesh.instanceColor, n)
}

export function BoltsMesh({ bolts }: { bolts: () => readonly BoltView[] }) {
  const { mesh } = useMeshes(() => ({ mesh: buildBoltsMesh() }))
  useWarmUp(mesh)
  useFrame(({ clock }) => {
    syncBolts(mesh, bolts())
    ;(mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = clock.elapsedTime
  })
  return <primitive object={mesh} position-y={BOLT_LAYER.y} renderOrder={BOLT_LAYER.renderOrder} />
}

// ── Enemy bullets ──

const ENEMY = enemyBulletLayers(1)

/**
 * Dark rim (pops on snow and sand), magenta body with a glow spreading over the rim (pops on dark
 * ground), and a white core. The three share one matrix buffer: each geometry carries its own size.
 */
function buildEnemyMeshes(max = MAX_BULLETS) {
  const rim = instanced(
    new THREE.CircleGeometry(ENEMY.rim / 2, 20).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#1a0016', transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
    max,
  )
  // Solid magenta out to today's 2.8r, glowing on to the rim's edge
  const halo = instanced(fxQuad().scale(ENEMY.rim, 1, ENEMY.rim), spriteMaterial({ color: ENEMY_BULLET_COLOR, intensity: 1.5, body: ENEMY.halo / ENEMY.rim }), max)
  const core = instanced(fxQuad().scale(ENEMY.core, 1, ENEMY.core), spriteMaterial({ color: '#ffffff', intensity: 1.7, body: 0.7 }), max)
  halo.instanceMatrix = rim.instanceMatrix
  core.instanceMatrix = rim.instanceMatrix
  return { rim, halo, core }
}

export function EnemyBulletsMesh({ bullets }: { bullets: () => readonly { x: number; z: number; radius: number }[] }) {
  const meshes = useMeshes(() => buildEnemyMeshes())
  const { rim, halo, core } = meshes
  useWarmUp(halo)
  useWarmUp(core)
  useWarmUp(rim)
  useFrame(() => {
    const list = bullets()
    const n = Math.min(list.length, MAX_BULLETS)
    for (let i = 0; i < n; i++) {
      const b = list[i]
      place(rim, i, b.x, 0, b.z, 0, b.radius, b.radius)
    }
    rim.count = halo.count = core.count = n
    rim.visible = halo.visible = core.visible = n > 0
    commit(rim.instanceMatrix, n)
  })
  return (
    <>
      <primitive object={rim} position-y={ENEMY_BULLET_LAYERS.rim.y} renderOrder={ENEMY_BULLET_LAYERS.rim.renderOrder} />
      <primitive object={halo} position-y={ENEMY_BULLET_LAYERS.halo.y} renderOrder={ENEMY_BULLET_LAYERS.halo.renderOrder} />
      <primitive object={core} position-y={ENEMY_BULLET_LAYERS.core.y} renderOrder={ENEMY_BULLET_LAYERS.core.renderOrder} />
    </>
  )
}

// ── Homing missiles ──

/** Body 0.32 across and 0.9 long, as today's oval. */
const MISSILE_R = 0.16, MISSILE_LEN = 0.9

function buildMissileMeshes(max = MAX_BULLETS) {
  const body = instanced(
    new THREE.CapsuleGeometry(MISSILE_R, MISSILE_LEN - 2 * MISSILE_R, 3, 8).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#40464f', metalness: 0.7, roughness: 0.35 }),
    max,
  )
  const glows = instanced(fxQuad(), spriteMaterial({ intensity: 1.6, hot: 0.5 }), max * 2, true)
  return { body, glows }
}

export function MissilesMesh({ missiles }: { missiles: () => readonly { x: number; z: number; vx: number; vz: number }[] }) {
  const { body, glows } = useMeshes(() => buildMissileMeshes())
  useWarmUp(body)
  useWarmUp(glows)
  useFrame(() => {
    const list = missiles()
    const n = Math.min(list.length, MAX_BULLETS)
    for (let i = 0; i < n; i++) {
      const m = list[i]
      const h = Math.atan2(m.vx, m.vz)
      const sp = Math.hypot(m.vx, m.vz) || 1
      const dx = m.vx / sp, dz = m.vz / sp
      place(body, i, m.x, 0, m.z, h, 1, 1)
      // Tip glow just ahead of the nose; a flickering flame off the tail
      place(glows, 2 * i, m.x + dx * 0.4, 0, m.z + dz * 0.4, h, 0.38, 0.38)
      glows.setColorAt(2 * i, MISSILE_TIP)
      const flame = 0.5 + Math.random() * 0.25
      place(glows, 2 * i + 1, m.x - dx * (MISSILE_LEN / 2 + flame / 2 - 0.08), 0, m.z - dz * (MISSILE_LEN / 2 + flame / 2 - 0.08), h, 0.3, flame)
      glows.setColorAt(2 * i + 1, MISSILE_FLAME)
    }
    body.count = n
    glows.count = 2 * n
    body.visible = glows.visible = n > 0
    commit(body.instanceMatrix, n)
    commit(glows.instanceMatrix, 2 * n)
    commit(glows.instanceColor, 2 * n)
  })
  return (
    <>
      <primitive object={body} position-y={0.38} />
      <primitive object={glows} position-y={0.5} renderOrder={BOLT_LAYER.renderOrder} />
    </>
  )
}
