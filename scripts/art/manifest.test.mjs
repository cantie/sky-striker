import { describe, expect, it } from 'vitest'
import { ASSETS, BUDGETS } from '../../art/manifest.mjs'
import { selectAssets, validateManifest } from './manifest.mjs'

const design = { id: 'enemy-basic-s1', kind: 'enemy', batch: 1, budget: 'small', glow: '#ff3b2f', prompt: 'A dart.' }
const repaint = { id: 'enemy-basic-s2', kind: 'enemy', batch: 3, budget: 'small', glow: '#ff8a2a', base: 'enemy-basic-s1', livery: 'desert sand' }
const check = (...rows) => validateManifest(rows, BUDGETS)
/** The errors for `row` (next to a valid design) mention its id. */
const errorsFor = (row) => check(design, row).filter((e) => e.includes(row.id))

describe('art manifest', () => {
  it('accepts a valid manifest', () => {
    expect(check(design, repaint)).toEqual([])
    expect(validateManifest(ASSETS, BUDGETS)).toEqual([])
  })

  it('rejects a duplicate id', () => {
    expect(check(design, { ...design })).toContainEqual(expect.stringContaining('enemy-basic-s1'))
  })

  it('rejects a bad id, kind or budget', () => {
    expect(errorsFor({ ...design, id: 'Bad_Id' })).not.toEqual([])
    expect(errorsFor({ ...design, id: 'x1', kind: 'tree' })).not.toEqual([])
    expect(errorsFor({ ...design, id: 'x2', budget: 'huge' })).not.toEqual([])
  })

  it('a recolored repaint needs hull, panel and dark as #rrggbb', () => {
    const colors = { hull: '#e2c48a', panel: '#9a5a22', dark: '#2a1a0a' }
    expect(errorsFor({ ...repaint, colors })).toEqual([])
    expect(errorsFor({ ...repaint, colors: { ...colors, dark: 'brown' } })).not.toEqual([])
    const { panel, ...noPanel } = colors
    expect(errorsFor({ ...repaint, colors: noPanel })).not.toEqual([])
    // A design may be recolored too: its own model, repainted after the preview
    expect(errorsFor({ ...design, id: 'x5', colors })).toEqual([])
  })

  it('pitch, yaw and roll are angles in degrees within ±90', () => {
    expect(errorsFor({ ...design, id: 'x8', pitch: 2, yaw: -5, roll: -3 })).toEqual([])
    // Levelling can pick the wrong face as the top (a ship whose tall tower makes it about as tall as it is wide)
    expect(errorsFor({ ...design, id: 'x11', roll: -63 })).toEqual([])
    expect(errorsFor({ ...design, id: 'x9', yaw: 91 })).not.toEqual([])
    expect(errorsFor({ ...design, id: 'x10', roll: 'a bit' })).not.toEqual([])
  })

  it('tall is true or absent', () => {
    expect(errorsFor({ ...design, id: 'x6', tall: true })).toEqual([])
    expect(errorsFor({ ...design, id: 'x7', tall: 'yes' })).not.toEqual([])
  })

  it('needs exactly one of prompt and base', () => {
    expect(errorsFor({ ...repaint, id: 'x3', prompt: 'both' })).not.toEqual([])
    const { prompt, ...neither } = design
    expect(errorsFor({ ...neither, id: 'x4' })).not.toEqual([])
  })

  it('a repaint needs a real design of its own kind, and a livery', () => {
    expect(errorsFor({ ...repaint, id: 'x5', base: 'ghost' })).not.toEqual([])
    expect(errorsFor({ ...repaint, id: 'x6', kind: 'hull' })).not.toEqual([])
    expect(check(design, repaint, { ...repaint, id: 'x7', base: 'enemy-basic-s2' }).filter((e) => e.includes('x7'))).not.toEqual([])
    const { livery, ...bare } = repaint
    expect(errorsFor({ ...bare, id: 'x8' })).not.toEqual([])
  })

  it('glow must be a strong #rrggbb color', () => {
    expect(errorsFor({ ...design, id: 'x9', glow: 'red' })).not.toEqual([])
    expect(errorsFor({ ...design, id: 'x10', glow: '#808080' })).not.toEqual([])
    expect(errorsFor({ ...design, id: 'x11', glow: '#202a30' })).not.toEqual([])
  })

  it('batch, stage and turn must be in range', () => {
    expect(errorsFor({ ...design, id: 'x12', batch: 6 })).not.toEqual([])
    expect(errorsFor({ ...design, id: 'x13', stage: 11 })).not.toEqual([])
    expect(errorsFor({ ...design, id: 'x14', turn: 90 })).not.toEqual([])
  })

  it('selectAssets picks a batch or ids', () => {
    const rows = [design, repaint, { ...design, id: 'c', batch: 3 }]
    expect(selectAssets(rows, '3').map((a) => a.id)).toEqual(['enemy-basic-s2', 'c'])
    expect(selectAssets(rows, 'c,enemy-basic-s1').map((a) => a.id)).toEqual(['c', 'enemy-basic-s1'])
    expect(() => selectAssets(rows, 'nope')).toThrow(/nope/)
  })
})
