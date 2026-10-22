import { describe, expect, it } from 'vitest'
import { UI_DESIGN, screenHeight, uiFit } from './fit'

describe('UI fit', () => {
  it('keeps the UI 1:1 wherever the screen already fits (phones, desktop)', () => {
    expect(uiFit(412, 915, 760)).toEqual({ scale: 1, width: 412, height: 915 })
    expect(uiFit(608, 1080, 760)).toEqual({ scale: 1, width: 608, height: 1080 })
    // A 360-wide phone keeps the menus 1:1
    expect(uiFit(360, 640, UI_DESIGN.height).scale).toBe(1)
  })

  it('shrinks it evenly when the screen is taller than the column, so all of it shows', () => {
    // An embed 1135×660 gives a 371×660 column; the briefing needs 760
    const f = uiFit(371, 660, 760)
    expect(f.scale).toBeCloseTo(660 / 760, 5)
    expect(f.height).toBeCloseTo(760, 5)
    expect(f.width * f.scale).toBeCloseTo(371, 5)
    expect(f.width).toBeGreaterThanOrEqual(UI_DESIGN.width)
  })

  it('shrinks it in a column narrower than the design too', () => {
    const f = uiFit(300, 900, UI_DESIGN.height)
    expect(f.scale).toBeCloseTo(300 / UI_DESIGN.width, 5)
    expect(f.width).toBeCloseTo(UI_DESIGN.width, 5)
    expect(f.height * f.scale).toBeCloseTo(900, 5)
  })

  it('a column not laid out yet (0×0) is left alone', () => {
    expect(uiFit(0, 0, 760)).toEqual({ scale: 1, width: 0, height: 0 })
  })

  it('the tall screens ask for more height than the rest (measured by scripts/ui-fit-check.mjs)', () => {
    expect(screenHeight('briefing')).toBe(760)
    expect(screenHeight('results')).toBe(710)
    for (const s of ['menu', 'stageSelect', 'playing', 'paused', 'coopLobby'] as const) expect(screenHeight(s)).toBe(UI_DESIGN.height)
  })
})
