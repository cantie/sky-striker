import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { boltQuad } from '../../../game/fx/bulletLook'
import { boltColor } from '../../../game/fx/color'
import { buildBoltsMesh, syncBolts, type BoltView } from './BulletMeshes'

const close = (a: THREE.Color, b: THREE.Color) => {
  expect(a.r).toBeCloseTo(b.r, 5)
  expect(a.g).toBeCloseTo(b.g, 5)
  expect(a.b).toBeCloseTo(b.b, 5)
}

describe('bolt mesh', () => {
  it('bolt instances take their colour and size from the bullet', () => {
    const mesh = buildBoltsMesh(8)
    const views: BoltView[] = [
      { x: 1, z: 2, vx: 0, vz: 30, radius: 0.1, color: '#3fd4ff' },
      { x: -1, z: 0, vx: 8, vz: 30, radius: 0.205, color: '#ff6aa8' },
    ]
    syncBolts(mesh, views)
    expect(mesh.count).toBe(2)
    const c = new THREE.Color(), m = new THREE.Matrix4()
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3()
    views.forEach((v, i) => {
      mesh.getColorAt(i, c)
      close(c, new THREE.Color(boltColor(v.color!)))
      mesh.getMatrixAt(i, m)
      m.decompose(p, q, s)
      const b = boltQuad(v.radius)
      expect(s.x).toBeCloseTo(b.width, 5)
      expect(s.z).toBeCloseTo(b.front + b.back, 5)
      // The drawn tip sits `front` ahead of the hit point, along the flight
      const tip = new THREE.Vector3(0, 0, 0.5).applyMatrix4(m)
      const sp = Math.hypot(v.vx, v.vz)
      expect(tip.x).toBeCloseTo(v.x + (v.vx / sp) * b.front, 5)
      expect(tip.z).toBeCloseTo(v.z + (v.vz / sp) * b.front, 5)
    })
    // NOVA's pink is pushed off the enemy magenta even if a caller forgot to
    mesh.getColorAt(1, c)
    expect(c.equals(new THREE.Color('#ff6aa8'))).toBe(false)

    syncBolts(mesh, [{ x: 0, z: 0, vx: 0, vz: 1, radius: 0.1 }])
    expect(mesh.count).toBe(1)
    mesh.getColorAt(0, c)
    close(c, new THREE.Color('#7cf9ff'))
  })
})
