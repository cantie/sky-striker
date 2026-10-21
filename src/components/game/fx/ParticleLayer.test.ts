import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createParticles, type ParticleSpec } from '../../../game/fx/particles'
import { buildParticleMesh, syncParticleMesh } from './ParticleLayer'

const spec = (x: number, life: number): ParticleSpec => ({
  x, y: 0, z: 0, vx: 1, vy: 0, vz: 0, life, size0: 1, size1: 2, color: [1, 1, 1], alpha: 1,
})

describe('particle layer', () => {
  it("a layer shares the pool's arrays and draws only live particles", () => {
    const p = createParticles(16)
    const mesh = buildParticleMesh(p, new THREE.MeshBasicMaterial())
    const g = mesh.geometry
    expect(g.getAttribute('iPos').array).toBe(p.pos)
    expect(g.getAttribute('iVel').array).toBe(p.vel)
    expect(g.getAttribute('iCol').array).toBe(p.col)
    expect(g.getAttribute('iMisc').array).toBe(p.misc)

    syncParticleMesh(mesh, p)
    expect(mesh.count).toBe(0)
    expect(mesh.visible).toBe(false)

    p.spawn(spec(1, 0.5)); p.spawn(spec(2, 5)); p.spawn(spec(3, 5))
    const before = (g.getAttribute('iPos') as THREE.BufferAttribute).version
    syncParticleMesh(mesh, p)
    expect(mesh.count).toBe(3)
    expect(mesh.visible).toBe(true)
    expect((g.getAttribute('iPos') as THREE.BufferAttribute).version).toBeGreaterThan(before)

    p.step(1)
    syncParticleMesh(mesh, p)
    expect(mesh.count).toBe(2)
  })
})
