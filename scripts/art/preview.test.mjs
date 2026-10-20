import { describe, expect, it } from 'vitest'
import { previewUrl } from './preview.mjs'

describe('previewUrl', () => {
  it('lists the ids in manifest order', () => {
    const assets = [{ id: 'player-hawk' }, { id: 'enemy-basic-s1' }, { id: 'boss-vulture' }]
    expect(previewUrl('http://localhost:5847', assets)).toBe('http://localhost:5847/art-preview.html?ids=player-hawk,enemy-basic-s1,boss-vulture')
  })
})
