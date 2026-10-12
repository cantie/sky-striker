import { useGameStore } from '../../store/gameStore'
import { MainMenu } from './MainMenu'
import { StageSelect } from './StageSelect'
import { StageBriefing } from './StageBriefing'
import { HUD } from './HUD'
import { PauseMenu } from './PauseMenu'
import { ResultsScreen } from './ResultsScreen'
import { Hangar } from './Hangar'
import { Leaderboard } from './Leaderboard'
import { CoopBadge } from './CoopBadge'
import { CoopLobby } from './CoopLobby'
import { CoopStageClear } from './CoopStageClear'
import { CoopResults } from './CoopResults'

export function UI() {
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
    </>
  )
}
