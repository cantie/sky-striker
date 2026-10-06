import { useFrame } from '@react-three/fiber'
import { useGameStore } from '../../store/gameStore'
import { sounds } from '../../hooks/useAudio'
import { gameDt } from '../../game/speed'

const COLORS = { powerup: '#ff9800', star: '#ffd700', health: '#4caf50', shield: '#2196f3' }

export function Pickups() {
  const pickups = useGameStore((s) => s.pickups)

  useFrame((_, rawDt) => {
    const dt = gameDt(rawDt)
    const s = useGameStore.getState()
    if (s.gameState !== 'playing') return
    const next = []
    for (const p of s.pickups) {
      p.y = p.y // keep
      const z = p.z - 1.5 * dt
      if (Math.hypot(p.x - s.playerX, z - s.playerY) < 0.85) {
        if (p.type === 'powerup') { s.upgradeWeapon(); sounds.powerup() }
        else if (p.type === 'health') { s.healPlayer(25); sounds.pickup() }
        else if (p.type === 'shield') { s.addShield(30); sounds.pickup() }
        else { s.addStar(); s.addScore(50); sounds.pickup() }
        continue
      }
      if (z > -9) next.push({ ...p, z })
    }
    useGameStore.setState({ pickups: next })
  })

  return (
    <>
      {pickups.map((p) => (
        <mesh key={p.id} position={[p.x, 0.5, p.z]}>
          <octahedronGeometry args={[0.28, 0]} />
          <meshStandardMaterial color={COLORS[p.type]} emissive={COLORS[p.type]} emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
      ))}
    </>
  )
}
