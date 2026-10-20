import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { applyFlash, applySilhouette, captureLooks } from './materialLook'

const lit = () => {
  const tex = new THREE.Texture()
  const m = new THREE.MeshStandardMaterial({ emissive: '#112233', emissiveIntensity: 1, emissiveMap: tex })
  return { m, tex }
}

describe('material look', () => {
  it('flash on removes the emissive map and lights the whole material', () => {
    const { m } = lit()
    const looks = captureLooks([m])
    applyFlash([m], looks, true, 1.6)
    expect(m.emissiveMap).toBeNull()
    expect(m.emissive.getHexString()).toBe('ffffff')
    expect(m.emissiveIntensity).toBe(1.6)
  })

  it('flash off puts back the same map, color and intensity', () => {
    const { m, tex } = lit()
    const looks = captureLooks([m])
    applyFlash([m], looks, true, 1.6)
    applyFlash([m], looks, false, 1.6)
    expect(m.emissiveMap).toBe(tex)
    expect(m.emissive.getHexString()).toBe('112233')
    expect(m.emissiveIntensity).toBe(1)
  })

  it('works on a material without a map', () => {
    const m = new THREE.MeshStandardMaterial({ emissive: '#ff5a2a', emissiveIntensity: 1.3 })
    const looks = captureLooks([m])
    applyFlash([m], looks, true, 1.2)
    expect(m.emissiveMap).toBeNull()
    expect(m.emissive.getHexString()).toBe('ffffff')
    applyFlash([m], looks, false, 1.2)
    expect(m.emissive.getHexString()).toBe('ff5a2a')
    expect(m.emissiveIntensity).toBe(1.3)
  })

  it('only marks the material for a recompile when a map comes or goes', () => {
    const { m } = lit()
    const looks = captureLooks([m])
    const v0 = m.version
    applyFlash([m], looks, true, 1.6)
    const v1 = m.version
    applyFlash([m], looks, true, 1.6)
    expect(v1).toBeGreaterThan(v0)
    expect(m.version).toBe(v1)
  })

  it('silhouette drops both maps and paints one dark color', () => {
    const { m } = lit()
    m.map = new THREE.Texture()
    applySilhouette(m, '#2a3140')
    expect(m.map).toBeNull()
    expect(m.emissiveMap).toBeNull()
    expect(m.color.getHexString()).toBe('2a3140')
    expect(m.emissive.getHexString()).toBe('000000')
  })
})
