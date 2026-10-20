import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../store/gameStore'
import { ORDER } from '../../game/sim/clock'
import { useSimStep } from '../../game/sim/useSimStep'
import { REVIVE_RADIUS, REVIVE_SECONDS } from '../../net/coop/coopData'
import { activeSession } from '../../net/coop/active'
import type { Downed } from '../../net/coop/coopSession'

const ARC_STEPS = 48
const RING_IN = 0.9, RING_OUT = 1.1

type Beacon = Downed & { progress: number }
const keyOf = (list: Beacon[]) => list.map((b) => `${b.id}:${b.progress}:${b.x.toFixed(1)}`).join()

/**
 * Co-op SOS beacons where pilots went down. Hovering over a teammate's beacon for a few seconds
 * fills its ring and asks the server to revive them (REVIVE); the server's PLAYER says it worked.
 */
export function ReviveBeacon() {
  const [beacons, setBeacons] = useState<Beacon[]>([])
  const shown = useRef('')
  const progress = useRef(new Map<string, number>())
  const sent = useRef(new Set<string>())

  useSimStep(ORDER.pickups, ({ realDt }) => {
    const session = activeSession()
    const s = useGameStore.getState()
    if (!session || s.gameState !== 'playing') return
    const list = session.downedPlayers()
    const live = new Set(list.map((b) => b.id))
    for (const id of [...progress.current.keys()]) if (!live.has(id)) { progress.current.delete(id); sent.current.delete(id) }
    for (const b of list) {
      if (b.self) continue
      const near = !s.down && Math.hypot(b.x - s.playerX, b.y - s.playerY) < REVIVE_RADIUS
      const p = progress.current.get(b.id) ?? 0
      const next = near ? Math.min(1, p + realDt / REVIVE_SECONDS) : Math.max(0, p - realDt / (REVIVE_SECONDS * 2))
      progress.current.set(b.id, next)
      if (next >= 1 && !sent.current.has(b.id)) { session.revive(b.id); sent.current.add(b.id) }
    }
    const view = list.map((b) => ({ ...b, progress: Math.round((progress.current.get(b.id) ?? 0) * ARC_STEPS) / ARC_STEPS }))
    const key = keyOf(view)
    if (key !== shown.current) { shown.current = key; setBeacons(view) }
  })

  return <>{beacons.map((b) => <BeaconMark key={b.id} beacon={b} />)}</>
}

function BeaconMark({ beacon }: { beacon: Beacon }) {
  const pulse = useRef<THREE.Mesh>(null)
  const steps = Math.round(beacon.progress * ARC_STEPS)
  const arc = useMemo(() => {
    if (steps <= 0) return null
    const len = (steps / ARC_STEPS) * Math.PI * 2
    return new THREE.RingGeometry(RING_IN, RING_OUT, ARC_STEPS, 1, Math.PI / 2 - len, len)
  }, [steps])
  useEffect(() => () => arc?.dispose(), [arc])
  useFrame(({ clock }) => {
    if (!pulse.current) return
    const k = (clock.elapsedTime * 1.2) % 1
    pulse.current.scale.setScalar(1 + k * 0.8)
    ;(pulse.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k)
  })
  const color = beacon.self ? '#ff8a80' : '#ff1744'
  return (
    <group position={[beacon.x, 0.4, beacon.y]} rotation={[-Math.PI / 2, 0, Math.PI]}>
      <mesh><ringGeometry args={[RING_IN, RING_OUT, 48]} /><meshBasicMaterial color="#000000" transparent opacity={0.45} depthWrite={false} /></mesh>
      {arc && <mesh geometry={arc} position={[0, 0, 0.01]}><meshBasicMaterial color="#3dff8a" toneMapped={false} /></mesh>}
      <mesh ref={pulse}><ringGeometry args={[0.55, 0.65, 32]} /><meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} /></mesh>
      {/* SOS cross */}
      <mesh position={[0, 0, 0.02]}><planeGeometry args={[0.18, 0.7]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
      <mesh position={[0, 0, 0.02]}><planeGeometry args={[0.7, 0.18]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
    </group>
  )
}
