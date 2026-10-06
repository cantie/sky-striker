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

/** Must match gameStore BOUNDS — full playfield for ortho framing. */
const BOUNDS = { minX: -7.2, maxX: 7.2, minY: -8.8, maxY: 16.5 }
const PLAYFIELD_MID_Z = (BOUNDS.minY + BOUNDS.maxY) / 2
/** Half-extents with padding so the ship stays inside the visible area on mobile + desktop. */
const HALF_W = (BOUNDS.maxX - BOUNDS.minX) / 2 + 1.1
const HALF_H = (BOUNDS.maxY - BOUNDS.minY) / 2 + 1.4
const CAMERA_Y = 50

export function GameScene() {
  const { camera, gl, size } = useThree()
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
      // Top-down: +X = screen-right, +Z (playerY) = screen-up
      const dx = (t.clientX - touchStart.current.x) * 0.018
      const dy = -(t.clientY - touchStart.current.y) * 0.018
      useGameStore.getState().setPlayerPosition(touchStart.current.px + dx, touchStart.current.py + dy + 0.6)
    }
    const onEnd = (e: TouchEvent) => { e.preventDefault(); touchStart.current = null }
    const onMouse = (e: MouseEvent) => {
      if (useGameStore.getState().gameState !== 'playing') return
      if (!(e.buttons & 1)) return
      useGameStore.getState().movePlayer(e.movementX * 0.018, -e.movementY * 0.018)
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
      // Top-down ortho: +X = right, +Z = forward (screen-up)
      const sp = 0.14 * GAME_SPEED
      if (keys.current.has('w') || keys.current.has('arrowup')) s.movePlayer(0, sp)
      if (keys.current.has('s') || keys.current.has('arrowdown')) s.movePlayer(0, -sp)
      if (keys.current.has('a') || keys.current.has('arrowleft')) s.movePlayer(-sp, 0)
      if (keys.current.has('d') || keys.current.has('arrowright')) s.movePlayer(sp, 0)
      s.tick(dt * 1000 * GAME_SPEED)
    }

    // Fit full playfield on any aspect (mobile portrait + desktop landscape)
    if (camera instanceof THREE.OrthographicCamera) {
      const zoom = Math.min(size.width / (2 * HALF_W), size.height / (2 * HALF_H))
      if (Math.abs(camera.zoom - zoom) > 0.01) {
        camera.zoom = zoom
        camera.updateProjectionMatrix()
      }
    }

    const shake = s.screenShake
    const ox = (Math.random() - 0.5) * shake * 0.35
    const oz = (Math.random() - 0.5) * shake * 0.25
    // Classic Sky Force: looking straight down (+Y → origin), +Z = screen-up
    camera.up.set(0, 0, 1)
    camera.position.set(ox, CAMERA_Y, PLAYFIELD_MID_Z + oz)
    camera.lookAt(ox * 0.15, 0, PLAYFIELD_MID_Z)
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
      <mesh position={[0, 8, PLAYFIELD_MID_Z]} rotation={[-Math.PI / 2, 0, 0]} visible={useGameStore.getState().hitFlash > 0}>
        <planeGeometry args={[30, 40]} />
        <meshBasicMaterial color="#ff4444" transparent opacity={0.15} depthWrite={false} />
      </mesh>
    </>
  )
}
