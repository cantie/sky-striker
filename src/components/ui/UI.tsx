import { useGameStore } from '../../store/gameStore'
import { MainMenu } from './MainMenu'
import { HUD } from './HUD'
import { PauseMenu } from './PauseMenu'
import { GameOverScreen } from './GameOverScreen'
import { VictoryScreen } from './VictoryScreen'

export function UI() {
  const gameState = useGameStore((s) => s.gameState)
  return (
    <>
      {gameState === 'menu' && <MainMenu />}
      {(gameState === 'playing' || gameState === 'paused' || gameState === 'bossWarning') && <HUD />}
      {gameState === 'paused' && <PauseMenu />}
      {gameState === 'gameOver' && <GameOverScreen />}
      {gameState === 'victory' && <VictoryScreen />}
    </>
  )
}
