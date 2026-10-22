// What the pickup pieces are made of. Each shiny finish is a matcap painted on a canvas, lit from the top
// left: it looks like polished metal, glossy paint or glass with no scene light or environment map, and
// costs one texture read a pixel. Built on first use and kept for the page's life. Everything but the
// shadow skips the depth test and draws in order (PICKUP_LAYERS), so terrain never covers a piece.
import * as THREE from 'three'
import type { Finish } from './shapes'

interface Matcap {
  /** Colours from the lit side out to the edge, which rims every piece with a dark outline. */
  stops: [number, string][]
  /** The white highlight. */
  spot: { r: number; alpha: number }
  /** A thin bright rim at the very edge, as light through glass. */
  rim?: string
}

const MATCAPS: Record<Finish, Matcap> = {
  gold: {
    stops: [[0, '#fff3c4'], [0.18, '#ffd84d'], [0.45, '#f0a81f'], [0.75, '#a5650b'], [1, '#3d2403']],
    spot: { r: 0.2, alpha: 0.7 },
  },
  red: {
    stops: [[0, '#ff9c8c'], [0.25, '#ff3b30'], [0.6, '#d0101c'], [0.85, '#7a0610'], [1, '#300205']],
    spot: { r: 0.17, alpha: 0.95 },
  },
  glass: {
    stops: [[0, '#e6fdff'], [0.25, '#7fe0ff'], [0.6, '#1e8fe0'], [0.85, '#0b3f8a'], [1, '#0a2c66']],
    spot: { r: 0.18, alpha: 1 },
    rim: '#8feaff',
  },
  white: {
    stops: [[0, '#ffffff'], [0.4, '#f4f8fc'], [0.75, '#c4d0dc'], [1, '#5a6672']],
    spot: { r: 0.2, alpha: 0.6 },
  },
}
const SIZE = 128
/** Where the light comes from, in the matcap (0..1, y down: up and to the left). */
const LIGHT = { x: 0.38, y: 0.34 }

function canvasTexture(paint: (g: CanvasRenderingContext2D, size: number) => void, size: number): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = size
  paint(c.getContext('2d')!, size)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function matcapTexture(m: Matcap): THREE.Texture {
  return canvasTexture((g, n) => {
    const h = n / 2
    const body = g.createRadialGradient(LIGHT.x * n, LIGHT.y * n, 0, h, h, h)
    for (const [at, color] of m.stops) body.addColorStop(at, color)
    g.fillStyle = body
    g.fillRect(0, 0, n, n)
    if (m.rim) {
      g.strokeStyle = m.rim
      g.lineWidth = n * 0.025
      g.beginPath()
      g.arc(h, h, h - g.lineWidth, Math.PI * 0.05, Math.PI * 0.95)
      g.stroke()
    }
    const spot = g.createRadialGradient(LIGHT.x * n * 0.9, LIGHT.y * n * 0.9, 0, LIGHT.x * n * 0.9, LIGHT.y * n * 0.9, m.spot.r * n)
    spot.addColorStop(0, `rgba(255,255,255,${m.spot.alpha})`)
    spot.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = spot
    g.fillRect(0, 0, n, n)
  }, SIZE)
}

const finishes = new Map<Finish, THREE.Material>()

export function finishMaterial(f: Finish): THREE.Material {
  let m = finishes.get(f)
  if (!m) {
    // Opaque, but drawn after the terrain; untouched by tone mapping, like the stars kills spray. The
    // parts' vertex colours paint their outlines dark
    m = new THREE.MeshMatcapMaterial({ matcap: matcapTexture(MATCAPS[f]), vertexColors: true, transparent: true, depthTest: false, toneMapped: false })
    finishes.set(f, m)
  }
  return m
}

let blob: THREE.Texture | null = null
/** A soft white spot fading out to the edge, for shadows, glows and gloss. */
function blobTexture(): THREE.Texture {
  blob ??= canvasTexture((g, n) => {
    const h = n / 2
    const r = g.createRadialGradient(h, h, 0, h, h, h)
    r.addColorStop(0, 'rgba(255,255,255,1)')
    r.addColorStop(0.5, 'rgba(255,255,255,0.55)')
    r.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = r
    g.fillRect(0, 0, n, n)
  }, 64)
  return blob
}

const soft = new Map<string, THREE.MeshBasicMaterial>()

/** See-through soft spots: a shadow under a piece, a glow behind it, a gloss on it. */
export function softMaterial(kind: 'shadow' | 'gloss' | 'glow', color = '#ffffff'): THREE.MeshBasicMaterial {
  const key = `${kind}:${color}`
  let m = soft.get(key)
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false })
    if (kind === 'shadow') { m.color.set('#000000'); m.opacity = 0.42 }
    else if (kind === 'gloss') { m.color.set('#ffffff'); m.opacity = 0.8; m.depthTest = false }
    else { m.color.set(color); m.opacity = 0.55; m.blending = THREE.AdditiveBlending; m.toneMapped = false; m.depthTest = false }
    soft.set(key, m)
  }
  return m
}
