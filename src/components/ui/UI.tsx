import { useLayoutEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { screenHeight, uiFit } from './fit'
import { MainMenu } from './MainMenu'
import { StageSelect } from './StageSelect'
import { StageBriefing } from './StageBriefing'
import { HUD } from './HUD'
import { PauseMenu } from './PauseMenu'
import { ResultsScreen } from './ResultsScreen'
import { Hangar } from './Hangar'
import { Leaderboard } from './Leaderboard'
import { CoopBadge } from './CoopBadge'
import { CoopDebug } from './CoopDebug'
import { CoopLobby } from './CoopLobby'
import { CoopStageClear } from './CoopStageClear'
import { CoopResults } from './CoopResults'

/**
 * The screens, laid out in a box big enough for the one on show and scaled down to the game's column
 * when that is smaller (a short embed), so nothing scrolls or falls off its edges. The box lets taps
 * through to the game; each screen sets its own pointer-events (see .ui-fit in index.css).
 */
export function UI() {
  const box = useRef<HTMLDivElement>(null)
  const gameState = useGameStore((s) => s.gameState)
  const [column, setColumn] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = box.current?.parentElement
    if (!el) return
    const measure = () => setColumn({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const fit = uiFit(column.w, column.h, screenHeight(gameState))
  return (
    <div
      ref={box}
      className="ui-fit"
      style={{ width: fit.width || '100%', height: fit.height || '100%', transform: fit.scale === 1 ? undefined : `scale(${fit.scale})` }}
    >
      <Screens />
    </div>
  )
}

function Screens() {
  const gameState = useGameStore((s) => s.gameState)
  const coop = useGameStore((s) => s.mode === 'coop')
  return (
    <>
      {gameState === 'menu' && <MainMenu />}
      {gameState === 'stageSelect' && <StageSelect />}
      {gameState === 'briefing' && <StageBriefing />}
      {(gameState === 'playing' || gameState === 'paused' || gameState === 'bossWarning') && <HUD />}
      {gameState === 'paused' && <PauseMenu />}
      {gameState === 'results' && <ResultsScreen />}
      {gameState === 'hangar' && <Hangar />}
      {gameState === 'leaderboard' && <Leaderboard />}
      {gameState === 'coopLobby' && <CoopLobby />}
      {gameState === 'coopStageClear' && <CoopStageClear />}
      {gameState === 'coopResults' && <CoopResults />}
      {coop && <CoopBadge />}
      {coop && <CoopDebug />}
    </>
  )
}
