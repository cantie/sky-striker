import { Suspense, useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useGameStore } from '../../store/gameStore'
import { useAudio, onPlayGesture } from '../../hooks/useAudio'
import { Environment } from './Environment'
import { Player } from './Player'
import { Enemies } from './Enemies'
import { Boss } from './Boss'
import { Bullets } from './Bullets'
import { Pickups } from './Pickups'
import { Explosions } from './Explosions'
import { GAME_SPEED } from '../../game/speed'

export function GameScene() {
  const { camera, gl } = useThree()
  const touchStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const keys = useRef(new Set<string>())
  const gameState = useGameStore((s) => s.gameState)
  useAudio()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current.add(e.key.toLowerCase())
      if (e.key === 'Escape') {
        const st = useGameStore.getState()
        if (st.gameState === 'playing') st.pauseGame()
        else if (st.gameState === 'paused') st.resumeGame()
      }
      if (e.key.toLowerCase() === 'b' && useGameStore.getState().gameState === 'menu') {
        void onPlayGesture().then(() => useGameStore.getState().startGame({ skipToBoss: true }))
      }
      if (e.key.toLowerCase() === 'e' && useGameStore.getState().gameState === 'menu') {
        void onPlayGesture().then(() => useGameStore.getState().startGame({ easy: true }))
      }
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  useEffect(() => {
    const canvas = gl.domElement
    const onStart = (e: TouchEvent) => {
      e.preventDefault()
      if (useGameStore.getState().gameState !== 'playing') return
      const t = e.touches[0]
      const { playerX, playerY } = useGameStore.getState()
      touchStart.current = { x: t.clientX, y: t.clientY, px: playerX, py: playerY }
    }
    const onMove = (e: TouchEvent) => {
      e.preventDefault()
      if (!touchStart.current || useGameStore.getState().gameState !== 'playing') return
      const t = e.touches[0]
      const dx = -(t.clientX - touchStart.current.x) * 0.018
      const dy = -(t.clientY - touchStart.current.y) * 0.018
      useGameStore.getState().setPlayerPosition(touchStart.current.px + dx, touchStart.current.py + dy + 0.6)
    }
    const onEnd = (e: TouchEvent) => { e.preventDefault(); touchStart.current = null }
    const onMouse = (e: MouseEvent) => {
      if (useGameStore.getState().gameState !== 'playing') return
      if (!(e.buttons & 1)) return
      useGameStore.getState().movePlayer(-e.movementX * 0.018, -e.movementY * 0.018)
    }
    canvas.addEventListener('touchstart', onStart, { passive: false })
    canvas.addEventListener('touchmove', onMove, { passive: false })
    canvas.addEventListener('touchend', onEnd, { passive: false })
    canvas.addEventListener('mousemove', onMouse)
    return () => {
      canvas.removeEventListener('touchstart', onStart)
      canvas.removeEventListener('touchmove', onMove)
      canvas.removeEventListener('touchend', onEnd)
      canvas.removeEventListener('mousemove', onMouse)
    }
  }, [gl])

  useFrame((_, dt) => {
    const s = useGameStore.getState()
    if (s.gameState === 'playing') {
      // Camera lookAt along +Z flips world X vs screen; negate horizontal so left = left.
      const sp = 0.14 * GAME_SPEED
      if (keys.current.has('w') || keys.current.has('arrowup')) s.movePlayer(0, sp)
      if (keys.current.has('s') || keys.current.has('arrowdown')) s.movePlayer(0, -sp)
      if (keys.current.has('a') || keys.current.has('arrowleft')) s.movePlayer(sp, 0)
      if (keys.current.has('d') || keys.current.has('arrowright')) s.movePlayer(-sp, 0)
      s.tick(dt * 1000 * GAME_SPEED)
    }
    const shake = s.screenShake
    const ox = (Math.random() - 0.5) * shake * 0.35
    const oy = (Math.random() - 0.5) * shake * 0.25
    // Near-fixed framing: enough tilt for a sky band, playfield scaled so maxY ≈ top
    const targetZ = s.playerY * 0.04
    // lookAt Y raised so ~top 20% is sky above the far ground edge
    camera.position.set(ox, 10.6 + oy, targetZ - 11.2)
    camera.lookAt(0, 2.0, targetZ + 3.8)
    camera.rotateZ(ox * 0.015)
  })

  const showActors = gameState !== 'menu'

  return (
    <>
      <Suspense fallback={null}>
        <Environment />
        {showActors && (
          <>
            <Player />
            <Enemies />
            <Boss />
            <Bullets />
            <Pickups />
            <Explosions />
          </>
        )}
      </Suspense>
      <EffectComposer multisampling={0}>
        <Bloom intensity={0.7} luminanceThreshold={0.7} mipmapBlur levels={5} />
        <Vignette offset={0.3} darkness={0.35} />
      </EffectComposer>
      <mesh position={[0, 8, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={useGameStore.getState().hitFlash > 0}>
        <planeGeometry args={[30, 40]} />
        <meshBasicMaterial color="#ff4444" transparent opacity={0.15} depthWrite={false} />
      </mesh>
    </>
  )
}
