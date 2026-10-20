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
