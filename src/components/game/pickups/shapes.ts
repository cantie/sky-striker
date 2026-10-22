// The floating drops as small 3D pieces, in the look of the approved mockups (winged gold badge, glossy
// heart, glass orb, faceted star). Drawn in XY with +Y up the screen and +Z toward the camera (PickupArt
// turns them to face it), in world units. Each part is one finish (a matcap, see finishes.ts) and one draw;
// dark outlines are painted into a part's vertex colours, just before what they outline, so a piece costs
// at most 3 draws. Every piece is built once and shared by all the drops of its type.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { PickupType } from '../../../store/gameStore'

/** Floating drops (rescue survivors are figures on the ground, see Pickups). */
export type DropType = Exclude<PickupType, 'rescue'>
export const DROP_TYPES: readonly DropType[] = ['powerup', 'health', 'shield', 'star']

/** What a part is made of. */
export type Finish = 'gold' | 'red' | 'glass' | 'white'

/**
 * A piece's parts are listed back to front, which is the order they draw in, and so are the triangles
 * inside each (they draw without a depth test). Its `color` attribute tints the finish: white, or dark
 * for an outline.
 */
export interface Part { geometry: THREE.BufferGeometry; finish: Finish }

/** What goes around a piece. */
export interface Look {
  /** Ping ring colour. */
  halo: string
  /** Soft shadow under the piece, world width and height. */
  shadow: [number, number]
  /** Soft glow behind it, world size. */
  glow?: { size: number; color: string }
  /** Glossy highlight decal: centre, size and turn, at height z. */
  gloss?: { x: number; y: number; z: number; w: number; h: number; turn: number }
}

export const LOOK: Record<DropType, Look> = {
  powerup: { halo: '#ffc23a', shadow: [2.3, 1.1] },
  health: { halo: '#ff4d4d', shadow: [1.45, 1.35], gloss: { x: -0.27, y: 0.27, z: 0.37, w: 0.34, h: 0.17, turn: 0.52 } },
  shield: { halo: '#4cc8ff', shadow: [1.4, 1.4] },
  star: { halo: '#ffd23f', shadow: [1.45, 1.4], glow: { size: 2.1, color: '#ffc83a' } },
}

type Pt = [number, number]
type ToWorld = (x: number, y: number) => Pt

/** SVG units (y down) around (cx, cy) to world units, `k` per unit. */
const svg = (cx: number, cy: number, k: number): ToWorld => (x, y) => [(x - cx) * k, (cy - y) * k]

/** An outline from an SVG path of absolute M, L, C and Z commands. */
function svgShape(d: string, at: ToWorld): THREE.Shape {
  const s = new THREE.Shape()
  const tok = d.match(/[MLCZ]|-?\d*\.?\d+/g) ?? []
  let cmd = '', i = 0
  const pt = (): Pt => { const x = Number(tok[i++]), y = Number(tok[i++]); return at(x, y) }
  while (i < tok.length) {
    if (/[MLCZ]/.test(tok[i])) {
      cmd = tok[i++]
      if (cmd === 'Z') { s.closePath(); continue }
    }
    if (cmd === 'M') { s.moveTo(...pt()); cmd = 'L' }
    else if (cmd === 'L') s.lineTo(...pt())
    else if (cmd === 'C') { const a = pt(), b = pt(), c = pt(); s.bezierCurveTo(a[0], a[1], b[0], b[1], c[0], c[1]) }
    else i++
  }
  return s
}

function polygon(points: Pt[]): THREE.Shape {
  const s = new THREE.Shape()
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
  s.closePath()
  return s
}

interface Slab {
  /** Height of its back face. */
  z: number
  depth: number
  /** How far the rounded edge reaches out, and up. */
  bevel: number
  thick: number
  segments?: number
  curve?: number
}

/** A rounded-edged slab of the outline, its back face at `z`. */
function slab(shapes: THREE.Shape | THREE.Shape[], o: Slab): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shapes, {
    depth: o.depth, bevelEnabled: true, bevelSize: o.bevel, bevelThickness: o.thick,
    bevelSegments: o.segments ?? 3, curveSegments: o.curve ?? 12,
  })
  g.translate(0, 0, o.z + o.thick)
  return g
}

/** Tilt a part about its own middle: `rx` leans its face up (−) or down (+), `ry` left (−) or right (+). */
function tilt(g: THREE.BufferGeometry, rx: number, ry: number): THREE.BufferGeometry {
  g.computeBoundingBox()
  const c = g.boundingBox!.getCenter(new THREE.Vector3())
  g.translate(-c.x, -c.y, -c.z)
  g.rotateX(rx)
  g.rotateY(ry)
  g.translate(c.x, c.y, c.z)
  return g
}

const WHITE = new THREE.Color('#ffffff')
const OUTLINE = new THREE.Color('#2a1802')

/** Every vertex the one colour; also unindexed and without uvs (matcaps need none), so any two merge. */
function paint(g: THREE.BufferGeometry, color = WHITE): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g
  if (out !== g) g.dispose()
  out.deleteAttribute('uv')
  const n = out.getAttribute('position').count
  const c = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) c.set([color.r, color.g, color.b], i * 3)
  out.setAttribute('color', new THREE.BufferAttribute(c, 3))
  return out
}
const ink = (g: THREE.BufferGeometry) => paint(g, OUTLINE)

/** One geometry, keeping the list's order. */
function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = mergeGeometries(list)
  for (const g of list) g.dispose()
  return out
}

// Power-up: gold wings either side of a red crest with two white chevrons (badge drawn 200×110)
const BADGE = svg(100, 54, 0.0112)
const FEATHERS = [
  'M80,40 C62,22 30,12 4,14 C18,28 40,40 76,56 Z',
  'M78,54 C60,42 34,36 10,40 C26,52 46,60 76,68 Z',
  'M78,68 C64,60 44,58 22,64 C36,74 54,78 78,80 Z',
]
/** Top feathers lean up to the light, lower ones away from it, so each catches it differently. */
const FEATHER_TILT = [-0.28, -0.08, 0.16]
const WING_LEAN = 0.1
const CREST = 'M100,6 C110,12 122,14 132,15 C132,50 122,78 100,102 C78,78 68,50 68,15 C78,14 90,12 100,6 Z'
/** The red face is the crest drawn smaller inside its gold rim. */
const CREST_FACE = 0.84

/** A thick chevron pointing up, from its centre line: tip height, half width, rise, half thickness. */
function chevron(tip: number, w: number, rise: number, v: number): THREE.Shape {
  return polygon([[0, tip + v], [w, tip - rise + v], [w, tip - rise - v], [0, tip - v], [-w, tip - rise - v], [-w, tip - rise + v]])
}

/** An outline needs about this much width to show at the game's zoom (1.6 px at 1×). */
const LINE = 0.05

/** A flat dark silhouette of the outline grown by LINE, to draw just before it. */
function silhouette(shapes: THREE.Shape | THREE.Shape[], z: number): THREE.BufferGeometry {
  return slab(shapes, { z, depth: 0.001, bevel: LINE, thick: 0.001, segments: 1, curve: 14 })
}

function powerup(): Part[] {
  const gold: THREE.BufferGeometry[] = []
  // Each feather row in turn, outline then gold, so a lower feather's outline parts it from the one above
  FEATHERS.forEach((d, k) => {
    const line: THREE.BufferGeometry[] = [], metal: THREE.BufferGeometry[] = []
    for (const side of [-1, 1]) {
      // The right wing is the left one mirrored
      const at: ToWorld = side < 0 ? BADGE : (x, y) => BADGE(200 - x, y)
      const shape = svgShape(d, at)
      line.push(ink(tilt(silhouette(shape, k * 0.022 - 0.01), FEATHER_TILT[k], side * WING_LEAN)))
      metal.push(paint(tilt(slab(shape, { z: k * 0.022, depth: 0.015, bevel: 0.02, thick: 0.03, curve: 14 }), FEATHER_TILT[k], side * WING_LEAN)))
    }
    gold.push(...line, ...metal)
  })
  const crest = svgShape(CREST, BADGE)
  gold.push(ink(silhouette(crest, 0.15)), paint(slab(crest, { z: 0.16, depth: 0.02, bevel: 0.03, thick: 0.04, curve: 16 })))
  const faceAt: ToWorld = (x, y) => BADGE(100 + (x - 100) * CREST_FACE, 54 + (y - 54) * CREST_FACE)
  const face = slab(svgShape(CREST, faceAt), { z: 0.2, depth: 0.02, bevel: 0.025, thick: 0.035, curve: 16 })
  const chevrons = slab([chevron(0.09, 0.18, 0.18, 0.055), chevron(-0.112, 0.18, 0.18, 0.055)], { z: 0.26, depth: 0.01, bevel: 0.015, thick: 0.02 })
  return [
    { geometry: merge(gold), finish: 'gold' },
    { geometry: paint(face), finish: 'red' },
    { geometry: paint(chevrons), finish: 'white' },
  ]
}

// Health: a puffy glossy heart with a white cross (drawn 120×110)
const HEART = 'M60,104 C20,74 4,52 4,32 C4,15 17,4 33,4 C45,4 55,11 60,22 C65,11 75,4 87,4 C103,4 116,15 116,32 C116,52 100,74 60,104 Z'
const HEART_AT = svg(60, 54, 0.0104)

function cross(cx: number, cy: number, a: number, b: number): THREE.Shape {
  return polygon([
    [cx - b, cy + a], [cx + b, cy + a], [cx + b, cy + b], [cx + a, cy + b], [cx + a, cy - b], [cx + b, cy - b],
    [cx + b, cy - a], [cx - b, cy - a], [cx - b, cy - b], [cx - a, cy - b], [cx - a, cy + b], [cx - b, cy + b],
  ])
}

function health(): Part[] {
  const heart = slab(svgShape(HEART, HEART_AT), { z: 0, depth: 0.03, bevel: 0.12, thick: 0.15, segments: 5, curve: 18 })
  const [cx, cy] = HEART_AT(60, 53)
  const mark = slab(cross(cx, cy, 0.22, 0.083), { z: 0.3, depth: 0.02, bevel: 0.02, thick: 0.02 })
  return [{ geometry: paint(heart), finish: 'red' }, { geometry: paint(mark), finish: 'white' }]
}

// Shield: a glass orb, squashed toward the camera, with a white shield on it (emblem drawn around 100,57)
const ORB_R = 0.66
const EMBLEM = 'M100,28 C107,32 114,33 119,34 C119,57 113,73 100,86 C87,73 81,57 81,34 C86,33 93,32 100,28 Z'

function shield(): Part[] {
  const orb = new THREE.SphereGeometry(ORB_R, 32, 20)
  orb.scale(1, 1, 0.5)
  const emblem = slab(svgShape(EMBLEM, svg(100, 57, 0.0132)), { z: 0.3, depth: 0.015, bevel: 0.02, thick: 0.02 })
  return [{ geometry: paint(orb), finish: 'glass' }, { geometry: paint(emblem), finish: 'white' }]
}

// Star: five arms, each split along its ridge into two flat facets that rise to a raised middle
const STAR_R = 0.72, STAR_IN = 0.32, STAR_RISE = 0.15
const STAR_LINE = 0.07
/** Shifts the star down so it sits centred (its two lower arms reach less far than the top one). */
const STAR_DROP = (STAR_R - STAR_R * Math.cos(Math.PI / 5)) / 2

function starPoints(outer: number, inner: number): Pt[] {
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner
    const a = Math.PI / 2 + (i * Math.PI) / 5
    return [Math.cos(a) * r, Math.sin(a) * r - STAR_DROP]
  })
}

function star(): Part[] {
  const rim = starPoints(STAR_R, STAR_IN)
  const pos: number[] = []
  for (let i = 0; i < 10; i++) {
    const a = rim[i], b = rim[(i + 1) % 10]
    pos.push(0, -STAR_DROP, STAR_RISE, a[0], a[1], 0, b[0], b[1], 0)
  }
  const facets = new THREE.BufferGeometry()
  facets.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  // Unshared corners: each facet keeps its own flat normal
  facets.computeVertexNormals()
  const outline = new THREE.ShapeGeometry(polygon(starPoints(STAR_R + STAR_LINE, STAR_IN + STAR_LINE * 0.6)))
  outline.translate(0, 0, -0.01)
  return [{ geometry: merge([ink(outline), paint(facets)]), finish: 'gold' }]
}

const BUILD: Record<DropType, () => Part[]> = { powerup, health, shield, star }
const built = new Map<DropType, Part[]>()

/** The parts of a drop's piece, built on first use. */
export function pickupParts(type: DropType): Part[] {
  let parts = built.get(type)
  if (!parts) {
    parts = BUILD[type]()
    built.set(type, parts)
  }
  return parts
}
