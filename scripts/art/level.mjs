// ZPS 3D returns a model as its input's camera saw it: tilted about 45° toward the viewer and turned with the
// concept's three-quarter view. Level it the way Hunyuan3D delivered models (up +Y, nose +Z) before the
// build sees it.
import { NodeIO } from '@gltf-transform/core'
import * as THREE from 'three'

/** Eigenvectors of a symmetric 3×3 matrix (Jacobi), smallest eigenvalue first. */
function eigen(C) {
  const A = C.map((r) => [...r]), V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
  for (let sweep = 0; sweep < 50; sweep++) {
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(A[p][q]) < 1e-15) continue
      const th = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]), c = Math.cos(th), s = Math.sin(th)
      for (let k = 0; k < 3; k++) { const a = A[k][p], b = A[k][q]; A[k][p] = c * a - s * b; A[k][q] = s * a + c * b }
      for (let k = 0; k < 3; k++) { const a = A[p][k], b = A[q][k]; A[p][k] = c * a - s * b; A[q][k] = s * a + c * b }
      for (let k = 0; k < 3; k++) { const a = V[k][p], b = V[k][q]; V[k][p] = c * a - s * b; V[k][q] = s * a + c * b }
    }
  }
  return [0, 1, 2].map((i) => ({ value: A[i][i], vector: new THREE.Vector3(V[0][i], V[1][i], V[2][i]) }))
    .sort((a, b) => a.value - b.value).map((e) => e.vector)
}

/**
 * The rotation that levels `positions` (x, y, z, …): the thinnest axis becomes +Y, the longest +Z. Signs
 * follow the concept camera, above and in front (+Y, +Z): the top faces it, the nose points at it.
 * A model that is already level stays level.
 */
export function levelRotation(positions) {
  const n = positions.length / 3
  const c = [0, 0, 0]
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) c[k] += positions[i * 3 + k] / n
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  for (let i = 0; i < n; i++) {
    const d = [0, 1, 2].map((k) => positions[i * 3 + k] - c[k])
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += (d[a] * d[b]) / n
  }
  const [thin, , long] = eigen(C)
  const up = thin.dot(new THREE.Vector3(0, 1, 1)) < 0 ? thin.negate() : thin
  const nose = long.clone().addScaledVector(up, -long.dot(up)).normalize()
  if (nose.z < 0) nose.negate()
  const side = new THREE.Vector3().crossVectors(up, nose)
  // Rows side, up, nose: maps those axes onto X, Y, Z
  return new THREE.Matrix4().makeBasis(side, up, nose).transpose()
}

/** The GLB with its vertices (and normals) turned level. */
export async function levelGlb(bytes) {
  const io = new NodeIO()
  const doc = await io.readBinary(new Uint8Array(bytes))
  const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())
  const all = prims.flatMap((p) => Array.from(p.getAttribute('POSITION').getArray()))
  const m = levelRotation(all)
  const turn = new THREE.Matrix3().setFromMatrix4(m)
  for (const prim of prims) {
    for (const [name, apply] of [['POSITION', (v) => v.applyMatrix4(m)], ['NORMAL', (v) => v.applyMatrix3(turn)]]) {
      const acc = prim.getAttribute(name)
      if (!acc) continue
      const v = new THREE.Vector3(), p = []
      for (let i = 0; i < acc.getCount(); i++) { acc.getElement(i, p); acc.setElement(i, apply(v.fromArray(p)).toArray()) }
    }
  }
  return io.writeBinary(doc)
}
