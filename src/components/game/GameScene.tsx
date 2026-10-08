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
import { Coins } from './Coins'
import { HangarPreview } from './HangarPreview'
import { GAME_SPEED } from '../../game/speed'
import { BOUNDS, PLAYFIELD_MID_Z, setView } from '../../game/world'
/** Half-extents with padding so the ship stays inside the visible area on mobile + desktop. */
const HALF_W = (BOUNDS.maxX - BOUNDS.minX) / 2 + 1.1
const HALF_H = (BOUNDS.maxY - BOUNDS.minY) / 2 + 1.4
const CAMERA_Y = 50

/** World +Z offset so the plane sits slightly above the finger/cursor (screen-up). */
const POINTER_OFFSET_Z = 1.2

export function GameScene() {
  const { camera, gl, size } = useThree()
  const keys = useRef(new Set<string>())
  const sizeRef = useRef(size)
  sizeRef.current = size
  const pointerActive = useRef(false)
  const hitOverlay = useRef<THREE.Mesh>(null)
  const gameState = useGameStore((s) => s.gameState)
  useAudio()

  /** Map CSS client coords → world X / Z (playerY). Camera looks down +Y with up=+Z, so screen-right is world −X. */
  const pointerToWorld = (clientX: number, clientY: number) => {
    const { width, height } = sizeRef.current
    const rect = gl.domElement.getBoundingClientRect()
    const zoom = Math.min(width / (2 * HALF_W), height / (2 * HALF_H))
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1
    const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1)
    const halfW = width / (2 * zoom)
    const halfH = height / (2 * zoom)
    // Plane sits POINTER_OFFSET_Z above the finger on the playfield (+Z / screen-up)
    return {
      x: -ndcX * halfW,
      z: PLAYFIELD_MID_Z + ndcY * halfH + POINTER_OFFSET_Z,
    }
  }

  const setFromPointer = (clientX: number, clientY: number) => {
    const { x, z } = pointerToWorld(clientX, clientY)
    useGameStore.getState().setPlayerPosition(x, z)
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current.add(e.key.toLowerCase())
      if (e.key === 'Escape') {
        const st = useGameStore.getState()
        if (st.gameState === 'playing') st.pauseGame()
        else if (st.gameState === 'paused') st.resumeGame()
      }
      if (e.key.toLowerCase() === 'b' && useGameStore.getState().gameState === 'menu') {
        void onPlayGesture().then(() => useGameStore.getState().startGame({ skipToBoss: true, stageId: 3 }))
      }
      if (e.key.toLowerCase() === 'e' && useGameStore.getState().gameState === 'menu') {
        void onPlayGesture().then(() => useGameStore.getState().startGame({ easy: true, stageId: 1 }))
      }
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  useEffect(() => {
    const canvas = gl.domElement
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      if (useGameStore.getState().gameState !== 'playing') return
      pointerActive.current = true
      const t = e.touches[0]
      setFromPointer(t.clientX, t.clientY)
    }
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      if (!pointerActive.current || useGameStore.getState().gameState !== 'playing') return
      const t = e.touches[0]
      setFromPointer(t.clientX, t.clientY)
    }
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
      if (e.touches.length === 0) pointerActive.current = false
    }
    const onMouseDown = (e: MouseEvent) => {
      if (useGameStore.getState().gameState !== 'playing') return
      if (e.button !== 0) return
      pointerActive.current = true
      setFromPointer(e.clientX, e.clientY)
    }
    const onMouseMove = (e: MouseEvent) => {
      if (useGameStore.getState().gameState !== 'playing') return
      if (!(e.buttons & 1) || !pointerActive.current) return
      setFromPointer(e.clientX, e.clientY)
    }
    const onMouseUp = () => { pointerActive.current = false }
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd, { passive: false })
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false })
    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
      canvas.removeEventListener('touchcancel', onTouchEnd)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [gl])

  useFrame((_, dt) => {
    const s = useGameStore.getState()
    if (s.gameState === 'playing') {
      // Top-down ortho: screen-right = world −X, screen-up = +Z
      const sp = 0.14 * GAME_SPEED
      if (keys.current.has('w') || keys.current.has('arrowup')) s.movePlayer(0, sp)
      if (keys.current.has('s') || keys.current.has('arrowdown')) s.movePlayer(0, -sp)
      if (keys.current.has('a') || keys.current.has('arrowleft')) s.movePlayer(sp, 0)
      if (keys.current.has('d') || keys.current.has('arrowright')) s.movePlayer(-sp, 0)
      s.tick(dt * 1000 * GAME_SPEED)
    }

    // Fit full playfield on any aspect (mobile portrait + desktop landscape)
    if (camera instanceof THREE.OrthographicCamera) {
      const zoom = Math.min(size.width / (2 * HALF_W), size.height / (2 * HALF_H))
      if (Math.abs(camera.zoom - zoom) > 0.01) {
        camera.zoom = zoom
        camera.updateProjectionMatrix()
      }
      // Publish the visible rectangle for spawn edges / fire zone / despawn checks
      setView(size.width / (2 * zoom), size.height / (2 * zoom))
    }

    if (hitOverlay.current) hitOverlay.current.visible = s.hitFlash > 0

    const shake = s.screenShake
    const ox = (Math.random() - 0.5) * shake * 0.35
    const oz = (Math.random() - 0.5) * shake * 0.25
    // Classic Sky Force: looking straight down (+Y → origin), +Z = screen-up
    camera.up.set(0, 0, 1)
    camera.position.set(ox, CAMERA_Y, PLAYFIELD_MID_Z + oz)
    camera.lookAt(ox * 0.15, 0, PLAYFIELD_MID_Z)
    camera.rotateZ(ox * 0.015)
  })

  const showActors = gameState === 'playing' || gameState === 'paused' || gameState === 'bossWarning' || gameState === 'results'

  return (
    <>
      <Suspense fallback={null}>
        <Environment />
        {gameState === 'hangar' && <HangarPreview />}
        {showActors && (
          <>
            <Player />
            <Enemies />
            <Boss />
            <Bullets />
            <Pickups />
            <Explosions />
            <Coins />
          </>
        )}
      </Suspense>
      <EffectComposer multisampling={0}>
        <Bloom intensity={0.7} luminanceThreshold={0.7} mipmapBlur levels={5} />
        <Vignette offset={0.3} darkness={0.35} />
      </EffectComposer>
      <mesh ref={hitOverlay} position={[0, 8, PLAYFIELD_MID_Z]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <planeGeometry args={[30, 40]} />
        <meshBasicMaterial color="#ff4444" transparent opacity={0.15} depthWrite={false} />
      </mesh>
    </>
  )
}
