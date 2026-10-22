import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../store/gameStore'
import { getPlane } from '../../game/planes'
import { planeBoltColor } from '../../game/fx/color'
import { PLAYER_BULLET_SPEED, weaponStats } from '../../game/weapon'
import { gameDt, gameInterval } from '../../game/speed'
import { ORDER } from '../../game/sim/clock'
import { useSimStep } from '../../game/sim/useSimStep'
import { activeSession } from '../../net/coop/active'
import { ShipModel } from './Model'

/**
 * Co-op wingmates: drawn where the interpolation buffer says they are, with their cannon drawn
 * locally as ghost bolts (no damage — each player reports their own hits).
 */
export function Teammates() {
  const [ids, setIds] = useState<string[]>([])
  const sinceShot = useRef(new Map<string, number>())

  useSimStep(ORDER.player, ({ realDt }) => {
    const session = activeSession()
    const s = useGameStore.getState()
    if (!session || s.gameState !== 'playing') return
    const mates = session.teammates()
    const key = mates.map((m) => m.id).join()
    if (key !== ids.join()) setIds(mates.map((m) => m.id))
    for (const m of mates) {
      if (!m.alive || !m.fire) continue
      const since = (sinceShot.current.get(m.id) ?? 0) + realDt * 1000
      const plane = getPlane(m.plane)
      const w = weaponStats(m.power)
      if (since > gameInterval(w.interval * plane.fireRate)) {
        sinceShot.current.set(m.id, 0)
        for (const sh of w.streams) {
          s.addBullet({ x: m.x + sh.x, y: 0.3, z: m.y + 0.6, vx: sh.vx, vy: 0, vz: PLAYER_BULLET_SPEED, isEnemy: false, damage: 0, radius: w.radius, ghost: true, color: planeBoltColor(m.plane) })
        }
      } else sinceShot.current.set(m.id, since)
    }
  })

  return <>{ids.map((id) => <Mate key={id} id={id} />)}</>
}

function Mate({ id }: { id: string }) {
  const group = useRef<THREE.Group>(null)
  const bank = useRef(0)
  const [planeId, setPlaneId] = useState('hawk')
  const plane = getPlane(planeId)

  useFrame((_, rawDt) => {
    const m = activeSession()?.teammates().find((t) => t.id === id)
    if (!group.current) return
    group.current.visible = !!m && m.alive
    if (!m) return
    if (m.plane !== planeId) setPlaneId(m.plane)
    group.current.position.set(m.x, 0.2, m.y)
    // Lean from their speed along the drawn path (not this frame's step, which jumps with the
    // network), eased like our own plane's: Player leans -step × 8 per 60 fps frame
    bank.current = THREE.MathUtils.lerp(bank.current, -m.vx * (8 / 60), 1 - Math.pow(0.001, gameDt(rawDt)))
    group.current.rotation.z = bank.current
  })

  return (
    <group ref={group}>
      <ShipModel path={plane.model} size={plane.size * 0.95} flame={plane.flame} flames={plane.flames} nozzles={plane.nozzles} />
      {/* marker ring so the wingmate is never mistaken for an enemy */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <ringGeometry args={[0.95, 1.05, 32]} />
        <meshBasicMaterial color="#3dff8a" transparent opacity={0.55} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
