import { useGameStore } from '../../store/gameStore'
import { MainMenu } from './MainMenu'
import { StageSelect } from './StageSelect'
import { StageBriefing } from './StageBriefing'
import { HUD } from './HUD'
import { PauseMenu } from './PauseMenu'
import { ResultsScreen } from './ResultsScreen'

export function UI() {
  const gameState = useGameStore((s) => s.gameState)
  return (
    <>
      {gameState === 'menu' && <MainMenu />}
      {gameState === 'stageSelect' && <StageSelect />}
      {gameState === 'briefing' && <StageBriefing />}
      {(gameState === 'playing' || gameState === 'paused' || gameState === 'bossWarning') && <HUD />}
      {gameState === 'paused' && <PauseMenu />}
      {gameState === 'results' && <ResultsScreen />}
    </>
  )
}
