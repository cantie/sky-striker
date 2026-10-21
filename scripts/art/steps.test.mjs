import { describe, expect, it } from 'vitest'
import { STYLE } from '../../art/manifest.mjs'
import { conceptPrompt, cutBackground, planConcept, planModel, rawFor, reviewPage } from './steps.mjs'

const design = { id: 'enemy-basic-s1', kind: 'enemy', batch: 1, budget: 'small', glow: '#ff3b2f', prompt: 'A heavy gunship.' }
const repaint = { id: 'enemy-basic-s2', kind: 'enemy', batch: 3, budget: 'small', glow: '#ff7a2a', base: 'enemy-basic-s1', livery: 'desert sand with rust panels' }
/** `exists` that knows these files (matched by path ending, so the root does not matter). */
const files = (...ends) => (p) => ends.some((e) => p.replace(/\\/g, '/').endsWith(e))
const ids = (list) => list.map((a) => a.id)

describe('concept prompts', () => {
  it('a design gets its prompt, the shared style and its glow', () => {
    expect(conceptPrompt(design)).toBe(`A heavy gunship.\n\n${STYLE} Glow color #ff3b2f only on lights and exhausts.`)
  })

  it('a repaint keeps everything but the livery', () => {
    expect(conceptPrompt(repaint)).toBe('Repaint this exact aircraft. Keep its shape, angle, framing and the plain #808080 background. ' +
      'New livery: desert sand with rust panels. Glow color #ff7a2a only on lights and exhausts.')
  })
})

describe('what each step still has to do', () => {
  it('concept skips approved assets unless forced', () => {
    const exists = files('art/concepts/enemy-basic-s1.webp')
    expect(ids(planConcept([design], exists, false).todo)).toEqual([])
    expect(ids(planConcept([design], exists, true).todo)).toEqual(['enemy-basic-s1'])
  })

  it('concept blocks a repaint whose base is not approved', () => {
    const plan = planConcept([design, repaint], files(), false)
    expect(ids(plan.todo)).toEqual(['enemy-basic-s1'])
    expect(plan.blocked).toEqual([{ id: 'enemy-basic-s2', reason: 'base enemy-basic-s1 not approved' }])
  })

  it('a repaint with an approved base is todo', () => {
    const plan = planConcept([design, repaint], files('art/concepts/enemy-basic-s1.webp'), false)
    expect(ids(plan.todo)).toEqual(['enemy-basic-s2'])
    expect(plan.blocked).toEqual([])
  })

  it('model needs an approved concept and skips a raw GLB unless forced', () => {
    expect(planModel([design], files(), false)).toEqual({ todo: [], blocked: [{ id: 'enemy-basic-s1', reason: 'not approved' }] })
    const approved = files('art/concepts/enemy-basic-s1.webp')
    expect(ids(planModel([design], approved, false).todo)).toEqual(['enemy-basic-s1'])
    const built = files('art/concepts/enemy-basic-s1.webp', 'art/.cache/raw/enemy-basic-s1.glb')
    expect(planModel([design], built, false)).toEqual({ todo: [], blocked: [] })
    expect(ids(planModel([design], built, true).todo)).toEqual(['enemy-basic-s1'])
  })
})

describe('recolored repaints', () => {
  const recolored = { ...repaint, colors: { hull: '#e2c48a', panel: '#9a5a22', dark: '#2a1a0a' } }
  const end = (p) => p.replace(/\\/g, '/').split('/').slice(-3).join('/')

  it('need no concept: the preview is their review', () => {
    const base = files('art/concepts/enemy-basic-s1.webp')
    expect(planConcept([design, recolored], base, true)).toEqual({ todo: [design], blocked: [] })
  })

  it('need no model step of their own', () => {
    const approved = files('art/concepts/enemy-basic-s2.webp')
    expect(planModel([recolored], approved, true)).toEqual({ todo: [], blocked: [] })
  })

  it('build from the raw model of their base; everything else from its own', () => {
    expect(end(rawFor(recolored))).toBe('.cache/raw/enemy-basic-s1.glb')
    expect(end(rawFor(repaint))).toBe('.cache/raw/enemy-basic-s2.glb')
    expect(end(rawFor(design))).toBe('.cache/raw/enemy-basic-s1.glb')
  })
})

describe('background cutout before modelling', () => {
  // 5×5: gray backdrop, a red 3×3 craft whose middle pixel is gray paint
  const G = [128, 128, 128, 255], R = [200, 30, 30, 255]
  const grid = ['GGGGG', 'GRRRG', 'GRGRG', 'GRRRG', 'GGGGG']
  const rgba = () => new Uint8Array(grid.join('').split('').flatMap((c) => (c === 'G' ? G : R)))
  const alpha = (px) => grid.map((_, y) => [0, 1, 2, 3, 4].map((x) => (px[(y * 5 + x) * 4 + 3] ? '#' : '.')).join(''))

  it('the backdrop reached from the border goes transparent, gray paint inside the craft stays', () => {
    const px = rgba()
    cutBackground(px, 5, 5)
    expect(alpha(px)).toEqual(['.....', '.###.', '.###.', '.###.', '.....'])
  })

  it('a backdrop pixel a little off #808080 still goes', () => {
    const px = rgba()
    px.set([140, 118, 130], 0)
    cutBackground(px, 5, 5)
    expect(px[3]).toBe(0)
  })
})

describe('review page', () => {
  it('lists every id, its prompt and an <img> per draft', () => {
    const html = reviewPage(1, [
      { asset: design, drafts: ['a/1.png', 'a/2.png'] },
      { asset: { ...design, id: 'hawk', prompt: 'A <hero> plane.' }, drafts: ['b/1.png'] },
    ])
    expect(html).toContain('enemy-basic-s1')
    expect(html).toContain('hawk')
    expect(html).toContain('A &lt;hero&gt; plane.')
    expect(html.match(/<img /g)).toHaveLength(3)
    expect(html).toContain('src="a/2.png"')
  })
})
