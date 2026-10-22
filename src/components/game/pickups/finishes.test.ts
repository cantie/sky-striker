// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest'
import { finishMaterial, softMaterial } from './finishes'
import type { Finish } from './shapes'

beforeAll(() => {
  // jsdom has no 2D canvas: a stand-in that takes the matcap's paint calls
  const gradient = { addColorStop() {} }
  const ctx = { createRadialGradient: () => gradient, fillRect() {}, beginPath() {}, arc() {}, stroke() {}, fillStyle: '', strokeStyle: '', lineWidth: 1 }
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
})

const FINISHES: Finish[] = ['gold', 'red', 'glass', 'white']

describe('pickup finishes', () => {
  it('draw over the terrain: no depth test, in the see-through pass (tall trees reach above the pickups)', () => {
    for (const f of FINISHES) {
      const m = finishMaterial(f)
      expect(m.depthTest, f).toBe(false)
      expect(m.transparent, f).toBe(true)
      expect(m.opacity, f).toBe(1)
      // Outlines are painted into the parts
      expect(m.vertexColors, f).toBe(true)
    }
    expect(softMaterial('glow', '#ffc83a').depthTest).toBe(false)
    expect(softMaterial('gloss').depthTest).toBe(false)
  })

  it('the shadow lies on the ground, so the terrain may cover it', () => {
    expect(softMaterial('shadow').depthTest).toBe(true)
  })

  it('are made once and shared', () => {
    expect(finishMaterial('gold')).toBe(finishMaterial('gold'))
    expect(softMaterial('glow', '#ffc83a')).toBe(softMaterial('glow', '#ffc83a'))
  })
})
