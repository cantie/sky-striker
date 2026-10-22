import type { GameState } from '../../store/gameStore'

/**
 * The box the screens are laid out to fit (CSS px): the narrowest common phone's width, and a height
 * every screen but the tall ones fits in. Where the game's column is smaller than the screen on show
 * needs, as in a short embed, the whole UI shrinks evenly instead of scrolling or losing its edges;
 * elsewhere it stays 1:1.
 */
export const UI_DESIGN = { width: 360, height: 640 } as const

/**
 * Screens taller than UI_DESIGN, with a little room: measured with `node scripts/ui-fit-check.mjs`
 * (re-run it after changing a screen). Only these shrink in a column shorter than they need.
 */
const TALL: Partial<Record<GameState, number>> = { briefing: 760, results: 710 }

export const screenHeight = (state: GameState): number => TALL[state] ?? UI_DESIGN.height

export interface UiFit {
  /** Applied to the UI layer: at most 1. */
  scale: number
  /** The layer's own size before scaling: the column's, divided by `scale`. */
  width: number
  height: number
}

export function uiFit(columnWidth: number, columnHeight: number, needHeight: number): UiFit {
  if (columnWidth <= 0 || columnHeight <= 0) return { scale: 1, width: columnWidth, height: columnHeight }
  const scale = Math.min(1, columnWidth / UI_DESIGN.width, columnHeight / needHeight)
  return { scale, width: columnWidth / scale, height: columnHeight / scale }
}
