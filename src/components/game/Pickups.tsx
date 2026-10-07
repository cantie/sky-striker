import { useFrame } from '@react-three/fiber'
import { useGameStore, type PickupType } from '../../store/gameStore'
import { sounds } from '../../hooks/useAudio'
import { gameDt } from '../../game/speed'

const COLORS: Record<PickupType, string> = {
  powerup: '#ff9800',
  star: '#ffd700',
  health: '#4caf50',
  shield: '#2196f3',
  rescue: '#ff6ec7',
}

export function Pickups() {
  const pickups = useGameStore((s) => s.pickups)

  useFrame((_, rawDt) => {
    const dt = gameDt(rawDt)
    const s = useGameStore.getState()
    if (s.gameState !== 'playing') return
    const next = []
    for (const p of s.pickups) {
      const z = p.z - 1.5 * dt
      if (Math.hypot(p.x - s.playerX, z - s.playerY) < 0.85) {
        const collected = s.collectPickup(p.id)
        if (collected) {
          if (collected.type === 'powerup') { s.upgradeWeapon(); sounds.powerup() }
          else if (collected.type === 'health') { s.healPlayer(25); sounds.pickup() }
          else if (collected.type === 'shield') { s.addShield(30); sounds.pickup() }
          else if (collected.type === 'rescue') { s.addScore(150); s.addStar(); sounds.pickup() }
          else { s.addStar(); s.addScore(50); sounds.pickup() }
        }
        continue
      }
      if (z > -9) next.push({ ...p, z })
      // Escaped pickups stay in spawned count (collect-all fails) — just despawn visually
    }
    useGameStore.setState({ pickups: next })
  })

  return (
    <>
      {pickups.map((p) => (
        <group key={p.id} position={[p.x, 0.5, p.z]}>
          {p.type === 'rescue' ? (
            <mesh>
              <capsuleGeometry args={[0.18, 0.22, 4, 8]} />
              <meshStandardMaterial color={COLORS.rescue} emissive={COLORS.rescue} emissiveIntensity={0.9} toneMapped={false} />
            </mesh>
          ) : (
            <mesh>
              <octahedronGeometry args={[0.28, 0]} />
              <meshStandardMaterial color={COLORS[p.type]} emissive={COLORS[p.type]} emissiveIntensity={0.8} toneMapped={false} />
            </mesh>
          )}
        </group>
      ))}
    </>
  )
}
