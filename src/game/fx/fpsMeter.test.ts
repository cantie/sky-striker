import { describe, expect, it } from 'vitest'
import { createFpsMeter } from './fpsMeter'

describe('fps meter', () => {
  it('60 frames of 16.67 ms read 60 fps and 16.7 ms', () => {
    const m = createFpsMeter()
    for (let i = 0; i < 60; i++) m.frame(16.67)
    expect(Math.abs(m.fps() - 60)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(m.ms() - 16.7)).toBeLessThanOrEqual(0.1)
  })

  it('only the last second counts', () => {
    const m = createFpsMeter()
    for (let i = 0; i < 100; i++) m.frame(50)
    for (let i = 0; i < 60; i++) m.frame(16.67)
    expect(Math.abs(m.fps() - 60)).toBeLessThanOrEqual(0.5)
  })
})
