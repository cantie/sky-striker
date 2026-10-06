import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { useGLTF, Text, Environment, Lightformer } from '@react-three/drei'
import { Suspense, useMemo } from 'react'
import * as THREE from 'three'

const list = (new URLSearchParams(location.search).get('m') || '').split(',').filter(Boolean)
const side = new URLSearchParams(location.search).has('side')

function M({ url, pos }: { url: string; pos: [number, number, number] }) {
  const { scene } = useGLTF('/models/' + url + '.glb')
  const { obj, size } = useMemo(() => {
    const o = scene.clone(true)
    const b = new THREE.Box3().setFromObject(o)
    const s = b.getSize(new THREE.Vector3())
    const c = b.getCenter(new THREE.Vector3())
    const k = 3 / Math.max(s.x, s.y, s.z)
    o.position.sub(c.multiplyScalar(k)); o.scale.setScalar(k)
    const g = new THREE.Group(); g.add(o)
    return { obj: g, size: s }
  }, [scene])
  return (
    <group position={pos}>
      <primitive object={obj} />
      <Text position={[0, side ? -2.2 : 0.1, side ? 0 : 2.2]} rotation={side ? [0, 0, 0] : [-Math.PI / 2, 0, 0]} fontSize={0.32} color="black">
        {url.split('/').pop() + ` ${size.x.toFixed(1)}x${size.y.toFixed(1)}x${size.z.toFixed(1)}`}
      </Text>
    </group>
  )
}

createRoot(document.getElementById('root')!).render(
  <Canvas camera={side ? { position: [0, 0, 30], fov: 40 } : { position: [0, 30, 0.001], fov: 40 }}>
    <ambientLight intensity={1} />
    <directionalLight position={[3, 10, 5]} intensity={2} />
    <Environment resolution={64}><Lightformer intensity={2} position={[0, 5, 0]} scale={10} /></Environment>
    <Suspense fallback={null}>
      {list.map((u, i) => <M key={u} url={u} pos={[((i % 4) - 1.5) * 5, 0, (Math.floor(i / 4) - 1) * 5]} />)}
    </Suspense>
  </Canvas>
)
