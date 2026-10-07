/**
 * Procedural, seamlessly tiling ground textures — one painter per biome.
 * Everything that crosses a tile edge is redrawn on the opposite side (see `wrapped`),
 * and long features use whole-cycle sine sums so they wrap too.
 */
import type { Biome } from '../../../game/biomes'

export const TEX = 2048

/** Draws `draw` at every wrapped copy of (x, y) that overlaps the tile, so features cross edges seamlessly. */
export function wrapped(x: number, y: number, r: number, draw: (x: number, y: number) => void) {
  for (const dx of [-TEX, 0, TEX]) {
    for (const dy of [-TEX, 0, TEX]) {
      const px = x + dx, py = y + dy
      if (px + r < 0 || px - r > TEX || py + r < 0 || py - r > TEX) continue
      draw(px, py)
    }
  }
}

/** Soft radial blob, optionally squashed/rotated, wrapped across tile edges. */
export function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, inner: string, outer: string, squash = 1, rot = 0) {
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
export type Wave = [amp: number, cycles: number, phase: number]
const waveAt = (t: number, waves: Wave[]) => waves.reduce((s, [a, k, p]) => s + a * Math.sin((t / TEX) * Math.PI * 2 * k + p), 0)

/** Strokes a periodic curve running along the tile's Y (vertical) or X (horizontal) axis, wrapped across the other axis. */
export function periodicStroke(ctx: CanvasRenderingContext2D, axis: 'x' | 'y', base: number, waves: Wave[], style: string, width: number, dash?: number[]) {
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

export function grain(ctx: CanvasRenderingContext2D, count: number, light: string, dark: string) {
  for (let i = 0; i < count; i++) {
    const a = (0.06 + Math.random() * 0.16).toFixed(2)
    ctx.fillStyle = (Math.random() > 0.5 ? light : dark).replace('A', a)
    ctx.fillRect(Math.random() * TEX, Math.random() * TEX, 1 + Math.random() * 3, 1 + Math.random() * 3)
  }
}

export const rand = (a: number, b: number) => a + Math.random() * (b - a)

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


const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]

/** Clusters of round tree crowns with a cast shadow and a sunlit top-left highlight. */
function canopy(ctx: CanvasRenderingContext2D, clusters: number, crowns: string[], shadow: string, light: string, size: [number, number] = [12, 28]) {
  for (let c = 0; c < clusters; c++) {
    const cx = rand(0, TEX), cy = rand(0, TEX), spread = rand(90, 220)
    const n = Math.floor(rand(40, 90))
    for (let i = 0; i < n; i++) {
      const ang = rand(0, Math.PI * 2), d = Math.sqrt(Math.random()) * spread
      const r = rand(size[0], size[1])
      const col = pick(crowns)
      wrapped(cx + Math.cos(ang) * d, cy + Math.sin(ang) * d, r * 1.4, (px, py) => {
        ctx.fillStyle = shadow
        ctx.beginPath(); ctx.arc(px + r * 0.35, py + r * 0.35, r, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = col
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = light
        ctx.beginPath(); ctx.arc(px - r * 0.3, py - r * 0.3, r * 0.5, 0, Math.PI * 2); ctx.fill()
      })
    }
  }
}

function patches(ctx: CanvasRenderingContext2D, n: number, light: string, dark: string, r: [number, number] = [140, 420]) {
  for (let i = 0; i < n; i++) {
    blob(ctx, rand(0, TEX), rand(0, TEX), rand(r[0], r[1]), i % 2 === 0 ? light : dark, 'rgba(0,0,0,0)', rand(0.45, 1), rand(0, Math.PI))
  }
}

function rocks(ctx: CanvasRenderingContext2D, n: number, shadow: string, body: string, light: string, size: [number, number] = [5, 18]) {
  for (let i = 0; i < n; i++) {
    const r = rand(size[0], size[1])
    wrapped(rand(0, TEX), rand(0, TEX), r * 2, (px, py) => {
      ctx.fillStyle = shadow
      ctx.beginPath(); ctx.ellipse(px + r * 0.5, py + r * 0.4, r * 1.1, r * 0.8, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = body
      ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = light
      ctx.beginPath(); ctx.ellipse(px - r * 0.3, py - r * 0.25, r * 0.45, r * 0.3, 0, 0, Math.PI * 2); ctx.fill()
    })
  }
}

/** Layered strokes along one periodic curve (banks → bed → highlight …). */
function channel(ctx: CanvasRenderingContext2D, axis: 'x' | 'y', base: number, waves: Wave[], layers: [string, number][]) {
  for (const [style, width] of layers) periodicStroke(ctx, axis, base, waves, style, width)
}

function farmPlots(ctx: CanvasRenderingContext2D, n: number, crops: [string, string][], border: string) {
  for (let i = 0; i < n; i++) {
    const w = rand(220, 380), h = rand(160, 280), rot = rand(-0.5, 0.5)
    const [c1, c2] = crops[i % crops.length]
    wrapped(rand(0, TEX), rand(0, TEX), Math.hypot(w, h) / 2, (px, py) => {
      ctx.save()
      ctx.translate(px, py)
      ctx.rotate(rot)
      ctx.fillStyle = border
      ctx.fillRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16)
      for (let s = 0; s < h; s += 18) {
        ctx.fillStyle = (s / 18) % 2 === 0 ? c1 : c2
        ctx.fillRect(-w / 2, -h / 2 + s, w, Math.min(18, h - s))
      }
      ctx.restore()
    })
  }
}

function paintOcean(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#17699a'
  ctx.fillRect(0, 0, TEX, TEX)
  patches(ctx, 50, 'rgba(60,160,200,0.35)', 'rgba(10,50,90,0.4)', [200, 520])

  // Islands: shallow lagoon halo → foam → beach → jungle
  for (let i = 0; i < 6; i++) {
    const x = rand(0, TEX), y = rand(0, TEX), r = rand(70, 150)
    blob(ctx, x, y, r * 2.1, 'rgba(70,190,195,0.6)', 'rgba(70,190,195,0)')
    for (let k = 0; k < 4; k++) blob(ctx, x + rand(-30, 30), y + rand(-30, 30), r * rand(0.25, 0.45), 'rgba(255,140,120,0.55)', 'rgba(255,140,120,0)')
    const trees = Array.from({ length: 14 }, () => ({ a: rand(0, Math.PI * 2), d: rand(0, r * 0.6), rr: rand(9, 18) }))
    wrapped(x, y, r * 1.4, (px, py) => {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'
      ctx.lineWidth = 6
      ctx.beginPath(); ctx.ellipse(px, py, r * 1.22, r * 1.05, 0.3, 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle = '#cdb67e'
      ctx.beginPath(); ctx.ellipse(px, py, r * 1.12, r * 0.95, 0.3, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#4b9a3a'
      ctx.beginPath(); ctx.ellipse(px + 6, py - 4, r * 0.82, r * 0.68, 0.3, 0, Math.PI * 2); ctx.fill()
      trees.forEach((t, k) => {
        ctx.fillStyle = k % 2 ? '#2e7a2c' : '#3f8f34'
        ctx.beginPath(); ctx.arc(px + Math.cos(t.a) * t.d, py + Math.sin(t.a) * t.d * 0.8, t.rr, 0, Math.PI * 2); ctx.fill()
      })
    })
  }

  // Swell: short dashed crests
  for (let i = 0; i < 46; i++) {
    const waves: Wave[] = [[rand(10, 30), 1 + (i % 3), rand(0, 6)], [rand(4, 10), 5, rand(0, 6)]]
    periodicStroke(ctx, 'x', (i / 46) * TEX + rand(-10, 10), waves, 'rgba(255,255,255,0.16)', rand(2, 4), [rand(20, 60), rand(60, 160)])
  }
  grain(ctx, 20000, 'rgba(180,230,255,A)', 'rgba(10,40,80,A)')
}

function paintAutumn(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#7a6a34'
  ctx.fillRect(0, 0, TEX, TEX)
  patches(ctx, 70, 'rgba(200,150,60,0.4)', 'rgba(70,50,20,0.45)')
  farmPlots(ctx, 5, [['#c9a03a', '#b48a2c'], ['#8a5a2a', '#7a4e24'], ['#a8a040', '#968e36']], 'rgba(60,40,20,0.6)')
  for (const base of [TEX * 0.3, TEX * 0.78]) {
    const waves: Wave[] = [[60, 1, rand(0, 6)], [24, 3, rand(0, 6)]]
    periodicStroke(ctx, 'x', base, waves, 'rgba(80,55,30,0.7)', 26)
    periodicStroke(ctx, 'x', base, waves, '#b49a6a', 16)
  }
  canopy(ctx, 24, ['#c8501e', '#e08a1e', '#b8321a', '#d8b02a', '#9a3a16', '#e0a030'], 'rgba(40,20,8,0.55)', 'rgba(255,220,140,0.4)')
  const river: Wave[] = [[210, 1, 2.4], [80, 2, 0.6], [30, 4, 1.1]]
  channel(ctx, 'y', TEX * 0.55, river, [['rgba(150,120,70,0.9)', 140], ['#3a4a3a', 110], ['#3a6a80', 92], ['#4a86a0', 54]])
  periodicStroke(ctx, 'y', TEX * 0.55 - 12, river, 'rgba(255,220,180,0.3)', 3, [26, 80])
  grain(ctx, 36000, 'rgba(240,190,90,A)', 'rgba(60,40,15,A)')
}

function paintArctic(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#e6eef5'
  ctx.fillRect(0, 0, TEX, TEX)
  patches(ctx, 70, 'rgba(255,255,255,0.6)', 'rgba(150,180,210,0.38)', [160, 460])

  // Frozen lakes with crack lines
  for (let i = 0; i < 4; i++) {
    const x = rand(0, TEX), y = rand(0, TEX), r = rand(140, 260)
    const cracks = Array.from({ length: 9 }, () => {
      let cx = rand(-r * 0.6, r * 0.6), cy = rand(-r * 0.4, r * 0.4)
      const pts: [number, number][] = [[cx, cy]]
      for (let j = 0; j < 5; j++) { cx += rand(-40, 40); cy += rand(-30, 30); pts.push([cx, cy]) }
      return pts
    })
    wrapped(x, y, r * 1.3, (px, py) => {
      ctx.fillStyle = 'rgba(120,170,200,0.55)'
      ctx.beginPath(); ctx.ellipse(px, py, r * 1.12, r * 0.85, 0.4, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#a8d6ea'
      ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.75, 0.4, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'
      ctx.lineWidth = 2
      for (const pts of cracks) {
        ctx.beginPath()
        pts.forEach(([cx, cy], k) => (k ? ctx.lineTo(px + cx, py + cy) : ctx.moveTo(px + cx, py + cy)))
        ctx.stroke()
      }
    })
  }
  // Ice road
  const road: Wave[] = [[90, 1, 0.3], [30, 2, 1.9]]
  channel(ctx, 'y', TEX * 0.24, road, [['rgba(120,140,160,0.45)', 54], ['rgba(200,215,228,0.9)', 40]])
  periodicStroke(ctx, 'y', TEX * 0.24 - 8, road, 'rgba(110,130,150,0.5)', 3)
  periodicStroke(ctx, 'y', TEX * 0.24 + 8, road, 'rgba(110,130,150,0.5)', 3)
  rocks(ctx, 90, 'rgba(90,110,130,0.4)', '#5a6672', 'rgba(255,255,255,0.85)', [6, 20])
  // Snowy pine stands
  canopy(ctx, 18, ['#2e5646', '#36604c', '#284c3e'], 'rgba(60,90,120,0.35)', 'rgba(230,240,248,0.45)', [9, 20])
  grain(ctx, 30000, 'rgba(255,255,255,A)', 'rgba(120,150,180,A)')
}

function paintCanyon(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#b4582e'
  ctx.fillRect(0, 0, TEX, TEX)
  patches(ctx, 60, 'rgba(230,140,80,0.35)', 'rgba(110,40,20,0.4)', [180, 480])
  // Rock strata: contour terraces
  const strata = ['rgba(210,120,70,0.35)', 'rgba(140,60,30,0.35)', 'rgba(230,160,100,0.25)']
  for (let i = 0; i < 40; i++) {
    const waves: Wave[] = [[rand(30, 90), 1 + (i % 2), rand(0, 6)], [rand(10, 30), 3, rand(0, 6)]]
    periodicStroke(ctx, 'x', (i / 40) * TEX, waves, strata[i % 3], rand(10, 26))
  }
  // Mesa tops
  for (let i = 0; i < 8; i++) {
    const r = rand(90, 180)
    wrapped(rand(0, TEX), rand(0, TEX), r * 1.3, (px, py) => {
      ctx.fillStyle = 'rgba(80,28,12,0.5)'
      ctx.beginPath(); ctx.ellipse(px + 22, py + 18, r, r * 0.7, 0.2, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#d4824a'
      ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.7, 0.2, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = 'rgba(120,50,20,0.6)'
      ctx.lineWidth = 4
      ctx.beginPath(); ctx.ellipse(px, py, r * 0.75, r * 0.5, 0.2, 0, Math.PI * 2); ctx.stroke()
    })
  }
  // Deep gorge with a river at the bottom
  const gorge: Wave[] = [[240, 1, 1.2], [90, 2, 2.6], [30, 5, 0.3]]
  channel(ctx, 'y', TEX * 0.5, gorge, [['rgba(70,24,10,0.85)', 220], ['#6a2a14', 170], ['#4a1c0e', 120], ['#2f6a78', 60], ['#4a8a96', 28]])
  rocks(ctx, 120, 'rgba(70,25,10,0.45)', '#8a3e20', 'rgba(255,190,140,0.45)')
  grain(ctx, 36000, 'rgba(255,180,120,A)', 'rgba(80,25,10,A)')
}

function paintSwamp(ctx: CanvasRenderingContext2D, glow: CanvasRenderingContext2D) {
  ctx.fillStyle = '#3a4a2a'
  ctx.fillRect(0, 0, TEX, TEX)
  patches(ctx, 60, 'rgba(90,110,50,0.4)', 'rgba(30,30,15,0.45)')
  // Murky pools with lily pads
  for (let i = 0; i < 26; i++) {
    const r = rand(50, 170), rot = rand(0, 3)
    const pads = Array.from({ length: Math.floor(r / 12) }, () => ({ a: rand(0, Math.PI * 2), d: rand(0, r * 0.7), rr: rand(5, 11) }))
    wrapped(rand(0, TEX), rand(0, TEX), r * 1.3, (px, py) => {
      ctx.fillStyle = 'rgba(40,40,20,0.6)'
      ctx.beginPath(); ctx.ellipse(px, py, r * 1.12, r * 0.86, rot, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#2c4640'
      ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.76, rot, 0, Math.PI * 2); ctx.fill()
      pads.forEach((p, k) => {
        ctx.fillStyle = k % 3 ? '#5a8a3a' : '#7aa848'
        ctx.beginPath(); ctx.arc(px + Math.cos(p.a) * p.d, py + Math.sin(p.a) * p.d * 0.7, p.rr, 0.3, Math.PI * 2); ctx.fill()
      })
    })
  }
  const creek: Wave[] = [[260, 1, 0.8], [110, 2, 2.2], [40, 5, 1.4]]
  channel(ctx, 'y', TEX * 0.48, creek, [['rgba(50,45,25,0.8)', 110], ['#2a4440', 80], ['#36564e', 40]])
  canopy(ctx, 20, ['#24361e', '#2c4222', '#1c2c18'], 'rgba(8,12,6,0.6)', 'rgba(140,170,80,0.3)', [14, 30])
  grain(ctx, 30000, 'rgba(120,150,70,A)', 'rgba(15,20,10,A)')
  // Bioluminescent spores — glow only (emissive map)
  for (let i = 0; i < 900; i++) {
    const r = rand(1.5, 4)
    glow.fillStyle = pick(['#9bff5a', '#5affc8', '#e2ff7a'])
    glow.globalAlpha = rand(0.4, 1)
    wrapped(rand(0, TEX), rand(0, TEX), r, (px, py) => { glow.beginPath(); glow.arc(px, py, r, 0, Math.PI * 2); glow.fill() })
  }
  glow.globalAlpha = 1
}

/** City: 8×8 blocks per tile (block = 4 world units), roofs, parks, lane markings, street lights. */
function paintCity(ctx: CanvasRenderingContext2D, glow: CanvasRenderingContext2D) {
  const B = TEX / 8, ROAD = 44
  ctx.fillStyle = '#3e4249'
  ctx.fillRect(0, 0, TEX, TEX)
  const roofs = ['#6a7080', '#8a6a5a', '#5a6a7a', '#a0a4aa', '#4a5060', '#7a6e60', '#56606e']
  for (let bx = 0; bx < 8; bx++) {
    for (let by = 0; by < 8; by++) {
      const x0 = bx * B + ROAD / 2, y0 = by * B + ROAD / 2, w = B - ROAD
      ctx.fillStyle = '#8c8e92'
      ctx.fillRect(x0, y0, w, w)
      const kind = Math.random()
      if (kind < 0.14) {
        // Park
        ctx.fillStyle = '#4a8a3c'
        ctx.fillRect(x0 + 8, y0 + 8, w - 16, w - 16)
        ctx.strokeStyle = '#c8b88a'; ctx.lineWidth = 6
        ctx.beginPath(); ctx.moveTo(x0 + 8, y0 + w / 2); ctx.lineTo(x0 + w - 8, y0 + w / 2); ctx.stroke()
        for (let t = 0; t < 16; t++) {
          const tx = x0 + rand(20, w - 20), ty = y0 + rand(20, w - 20), r = rand(8, 15)
          ctx.fillStyle = 'rgba(10,30,10,0.5)'; ctx.beginPath(); ctx.arc(tx + 4, ty + 4, r, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = t % 2 ? '#2e6a2a' : '#3a7a30'; ctx.beginPath(); ctx.arc(tx, ty, r, 0, Math.PI * 2); ctx.fill()
        }
      } else {
        // 1 or 4 buildings per block with roof furniture
        const split = kind < 0.5 ? 1 : 2
        const cw = (w - 12) / split
        for (let i = 0; i < split; i++) {
          for (let j = 0; j < split; j++) {
            const rx = x0 + 6 + i * cw + 4, ry = y0 + 6 + j * cw + 4, rw = cw - 8
            ctx.fillStyle = 'rgba(0,0,0,0.35)'
            ctx.fillRect(rx + 8, ry + 8, rw, rw)
            ctx.fillStyle = pick(roofs)
            ctx.fillRect(rx, ry, rw, rw)
            ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 4
            ctx.strokeRect(rx + 6, ry + 6, rw - 12, rw - 12)
            for (let k = 0; k < 3; k++) {
              ctx.fillStyle = k % 2 ? '#c8ccd2' : '#5a5e66'
              ctx.fillRect(rx + rand(12, rw - 30), ry + rand(12, rw - 30), 14, 14)
            }
            if (Math.random() < 0.3) {
              // Neon sign on the roof edge
              const col = pick(['#ff2ab8', '#2af0ff', '#ffd21a', '#7a5aff'])
              for (const g of [ctx, glow]) { g.fillStyle = col; g.fillRect(rx + 10, ry + rw - 14, rw - 20, 6) }
            }
          }
        }
      }
    }
  }
  // Lane markings + street lights along every road line (grid divides the tile → seamless)
  ctx.setLineDash([22, 18])
  ctx.strokeStyle = 'rgba(240,230,200,0.75)'
  ctx.lineWidth = 3
  for (let i = 0; i < 8; i++) {
    const c = i * B
    ctx.beginPath(); ctx.moveTo(c, 0); ctx.lineTo(c, TEX); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, c); ctx.lineTo(TEX, c); ctx.stroke()
  }
  ctx.setLineDash([])
  glow.fillStyle = 'rgba(255,214,140,0.9)'
  for (let i = 0; i < 8; i++) {
    for (let k = 0; k < TEX; k += 64) {
      for (const [x, y] of [[i * B + ROAD / 2 - 4, k], [k, i * B + ROAD / 2 - 4]]) {
        glow.beginPath(); glow.arc(x, y, 4, 0, Math.PI * 2); glow.fill()
      }
    }
  }
  grain(ctx, 26000, 'rgba(255,255,255,A)', 'rgba(0,0,0,A)')
}

function paintVolcano(ctx: CanvasRenderingContext2D, glow: CanvasRenderingContext2D) {
  ctx.fillStyle = '#2a2422'
  ctx.fillRect(0, 0, TEX, TEX)
  patches(ctx, 70, 'rgba(80,70,64,0.4)', 'rgba(8,6,6,0.5)')
  rocks(ctx, 150, 'rgba(0,0,0,0.55)', '#3e3632', 'rgba(140,120,110,0.35)', [6, 22])
  const lava = (axis: 'x' | 'y', base: number, waves: Wave[], width: number) => {
    channel(ctx, axis, base, waves, [['rgba(20,10,6,0.9)', width * 1.7], ['#c8380a', width], ['#ff8a1a', width * 0.6], ['#ffd23f', width * 0.25]])
    channel(glow, axis, base, waves, [['rgba(255,80,10,0.55)', width * 1.2], ['#ff9a2a', width * 0.6], ['#fff0a0', width * 0.22]])
  }
  lava('y', TEX * 0.42, [[220, 1, 0.5], [90, 2, 2.1], [35, 5, 1]], 46)
  lava('x', TEX * 0.7, [[120, 1, 1.8], [40, 3, 0.2]], 22)
  lava('y', TEX * 0.86, [[80, 1, 2.9], [30, 4, 1.6]], 16)
  // Craters with glowing rims
  for (let i = 0; i < 7; i++) {
    const r = rand(40, 100)
    wrapped(rand(0, TEX), rand(0, TEX), r * 1.4, (px, py) => {
      ctx.fillStyle = '#120e0c'
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill()
      for (const c of [ctx, glow]) {
        c.strokeStyle = '#ff6a1a'; c.lineWidth = 5
        c.beginPath(); c.arc(px, py, r * 0.9, 0, Math.PI * 2); c.stroke()
      }
    })
  }
  // Hairline fissures
  for (let i = 0; i < 18; i++) {
    let x = rand(0, TEX), y = rand(0, TEX)
    const pts: [number, number][] = [[x, y]]
    for (let j = 0; j < 6; j++) { x += rand(-60, 60); y += rand(-60, 60); pts.push([x, y]) }
    for (const c of [ctx, glow]) {
      c.strokeStyle = 'rgba(255,110,20,0.8)'; c.lineWidth = 2
      wrapped(pts[0][0], pts[0][1], 400, (px, py) => {
        const dx = px - pts[0][0], dy = py - pts[0][1]
        c.beginPath(); pts.forEach(([qx, qy], k) => (k ? c.lineTo(qx + dx, qy + dy) : c.moveTo(qx + dx, qy + dy))); c.stroke()
      })
    }
  }
  grain(ctx, 30000, 'rgba(160,140,130,A)', 'rgba(0,0,0,A)')
}

/** Fortress deck: riveted plates, hazard stripes, landing pads and glowing conduits. */
function paintFortress(ctx: CanvasRenderingContext2D, glow: CanvasRenderingContext2D) {
  const P = 128
  ctx.fillStyle = '#4a505a'
  ctx.fillRect(0, 0, TEX, TEX)
  for (let x = 0; x < TEX; x += P) {
    for (let y = 0; y < TEX; y += P) {
      const shade = Math.floor(rand(-14, 14))
      ctx.fillStyle = `rgb(${74 + shade},${80 + shade},${90 + shade})`
      ctx.fillRect(x + 2, y + 2, P - 4, P - 4)
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      for (const [rx, ry] of [[8, 8], [P - 12, 8], [8, P - 12], [P - 12, P - 12]]) ctx.fillRect(x + rx, y + ry, 4, 4)
      if (Math.random() < 0.08) {
        // Vent grille
        ctx.fillStyle = '#1e2228'
        ctx.fillRect(x + 24, y + 24, P - 48, P - 48)
        ctx.fillStyle = '#3a4048'
        for (let k = 30; k < P - 30; k += 10) ctx.fillRect(x + 28, y + k, P - 56, 4)
      }
    }
  }
  // Plate seams
  ctx.strokeStyle = 'rgba(10,12,16,0.7)'; ctx.lineWidth = 3
  for (let c = 0; c <= TEX; c += P) {
    ctx.beginPath(); ctx.moveTo(c, 0); ctx.lineTo(c, TEX); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, c); ctx.lineTo(TEX, c); ctx.stroke()
  }
  // Hazard stripe bands
  for (const by of [P * 3, P * 11]) {
    ctx.save()
    ctx.beginPath(); ctx.rect(0, by, TEX, 34); ctx.clip()
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, by, TEX, 34)
    ctx.fillStyle = '#e8b81a'
    for (let x = -64; x < TEX + 64; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, by + 34); ctx.lineTo(x + 24, by + 34); ctx.lineTo(x + 58, by); ctx.lineTo(x + 34, by); ctx.fill()
    }
    ctx.restore()
  }
  // Landing pads
  for (let i = 0; i < 3; i++) {
    const cx = (Math.floor(rand(0, 16)) + 0.5) * P, cy = (Math.floor(rand(0, 16)) + 0.5) * P, r = P * 0.9
    wrapped(cx, cy, r, (px, py) => {
      ctx.fillStyle = '#2a2e36'; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#e8b81a'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(px, py, r * 0.85, 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle = '#d8dce2'
      ctx.fillRect(px - 34, py - 40, 14, 80); ctx.fillRect(px + 20, py - 40, 14, 80); ctx.fillRect(px - 20, py - 7, 40, 14)
      glow.fillStyle = '#4af0ff'
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2
        glow.beginPath(); glow.arc(px + Math.cos(a) * r * 0.85, py + Math.sin(a) * r * 0.85, 5, 0, Math.PI * 2); glow.fill()
      }
    })
  }
  // Power conduits along seams
  for (let i = 0; i < 5; i++) {
    const c = Math.floor(rand(0, 16)) * P
    const col = i % 2 ? '#ff1a3a' : '#4af0ff'
    for (const g of [ctx, glow]) {
      g.strokeStyle = col; g.lineWidth = 4
      g.beginPath()
      if (i % 2 === 0) { g.moveTo(c, 0); g.lineTo(c, TEX) } else { g.moveTo(0, c); g.lineTo(TEX, c) }
      g.stroke()
    }
  }
  grain(ctx, 24000, 'rgba(255,255,255,A)', 'rgba(0,0,0,A)')
}

export interface GroundPaint {
  albedo: HTMLCanvasElement
  /** Emissive mask (lava, neon, spores…) or null if the biome has no glow. */
  glow: HTMLCanvasElement | null
}

export function paintGround(biome: Biome): GroundPaint {
  const make = () => {
    const c = document.createElement('canvas')
    c.width = c.height = TEX
    return c
  }
  const albedo = make()
  const ctx = albedo.getContext('2d')!
  const glowCanvas = make()
  const glow = glowCanvas.getContext('2d')!
  glow.fillStyle = '#000000'
  glow.fillRect(0, 0, TEX, TEX)
  let glows = true
  switch (biome) {
    case 'jungle': paintJungle(ctx); glows = false; break
    case 'desert': paintDesert(ctx); glows = false; break
    case 'ocean': paintOcean(ctx); glows = false; break
    case 'autumn': paintAutumn(ctx); glows = false; break
    case 'arctic': paintArctic(ctx); glows = false; break
    case 'canyon': paintCanyon(ctx); glows = false; break
    case 'swamp': paintSwamp(ctx, glow); break
    case 'city': paintCity(ctx, glow); break
    case 'volcano': paintVolcano(ctx, glow); break
    case 'fortress': paintFortress(ctx, glow); break
  }
  return { albedo, glow: glows ? glowCanvas : null }
}
