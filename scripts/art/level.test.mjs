import { NodeIO } from '@gltf-transform/core'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { fixtureGlb } from './fixture.mjs'
import { levelGlb } from './level.mjs'

/** The fixture with its vertices turned by `m`. */
async function turned(m) {
  const doc = await new NodeIO().readBinary(await fixtureGlb({ tris: 2000 }))
  const pos = doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION')
  const v = new THREE.Vector3(), p = []
  for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, p); pos.setElement(i, v.fromArray(p).applyMatrix4(m).toArray()) }
  return new NodeIO().writeBinary(doc)
}

async function bounds(bytes) {
  const doc = await new NodeIO().readBinary(bytes)
  const pos = doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION')
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity], p = []
  for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, p); for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]) } }
  return { min, max }
}

describe('levelGlb', () => {
  // The fixture is level: 0.5 tall (Y), 2 wide (X), its nose reaching z = 2 and its tail z = -1
  it('a model tilted as the concept camera saw it (45° from above, turned 40°) comes back level, nose on +Z', async () => {
    const camera = new THREE.Matrix4().makeRotationX(THREE.MathUtils.degToRad(45))
      .multiply(new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(-40)))
    const { min, max } = await bounds(await levelGlb(await turned(camera)))
    expect(max[1] - min[1]).toBeCloseTo(0.5, 1)
    expect(max[0] - min[0]).toBeCloseTo(2, 1)
    expect(max[2]).toBeCloseTo(2, 1)
    expect(min[2]).toBeCloseTo(-1, 1)
  })

  it('a level model stays level, nose on +Z (within a hundredth)', async () => {
    const level = await fixtureGlb({ tris: 2000 })
    const before = await bounds(level), after = await bounds(await levelGlb(level))
    for (let k = 0; k < 3; k++) {
      expect(after.min[k]).toBeCloseTo(before.min[k], 2)
      expect(after.max[k]).toBeCloseTo(before.max[k], 2)
    }
  })
})
