import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../store/gameStore'
import { getPlane } from '../../game/planes'
import { PLAYER_BULLET_SPEED, weaponStats } from '../../game/weapon'
import { gameInterval } from '../../game/speed'
import { ORDER } from '../../game/sim/clock'
import { useSimStep } from '../../game/sim/useSimStep'
import { activeSession } from '../../net/coop/active'
import { REVIVE_NEAR } from '../../net/coop/protocol'
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
    const anyDown = mates.some((m) => !m.alive)
    if (s.wingmateDown !== anyDown) useGameStore.setState({ wingmateDown: anyDown })
    if (s.playerHp > 0) {
      for (const m of mates) {
        if (!m.alive && Math.hypot(m.x - s.playerX, m.y - s.playerY) <= REVIVE_NEAR) session.revive(m.id)
      }
    }
    for (const m of mates) {
      if (!m.alive || !m.fire) continue
      const since = (sinceShot.current.get(m.id) ?? 0) + realDt * 1000
      const plane = getPlane(m.plane)
      const w = weaponStats(m.power)
      if (since > gameInterval(w.interval * plane.fireRate)) {
        sinceShot.current.set(m.id, 0)
        for (const sh of w.streams) {
          s.addBullet({ x: m.x + sh.x, y: 0.3, z: m.y + 0.6, vx: sh.vx, vy: 0, vz: PLAYER_BULLET_SPEED, isEnemy: false, damage: 0, radius: w.radius, ghost: true })
        }
      } else sinceShot.current.set(m.id, since)
    }
  })

  return <>{ids.map((id) => <Mate key={id} id={id} />)}</>
}

function Mate({ id }: { id: string }) {
  const group = useRef<THREE.Group>(null)
  const prevX = useRef(0)
  const [planeId, setPlaneId] = useState('hawk')
  const [alive, setAlive] = useState(true)
  const plane = getPlane(planeId)

  useFrame(() => {
    const m = activeSession()?.teammates().find((t) => t.id === id)
    if (!group.current) return
    group.current.visible = !!m
    if (!m) return
    if (m.plane !== planeId) setPlaneId(m.plane)
    if (m.alive !== alive) setAlive(m.alive)
    group.current.position.set(m.x, 0.2, m.y)
    const vx = m.x - prevX.current
    prevX.current = m.x
    group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, -vx * 8, 0.15)
  })

  return (
    <group ref={group}>
      <ShipModel path={plane.model} size={plane.size * 0.95} palette={plane.palette} flame={plane.flame} flames={plane.flames} />
      {/* marker ring so the wingmate is never mistaken for an enemy */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <ringGeometry args={[0.95, 1.05, 32]} />
        <meshBasicMaterial color={alive ? '#3dff8a' : '#ff5252'} transparent opacity={alive ? 0.55 : 0.9} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
