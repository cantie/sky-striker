// Types for manifest.mjs, for the TypeScript that reads it (the preview page, aiAssets.test.ts).

export type ArtKind = 'player' | 'enemy' | 'boss' | 'hull' | 'base' | 'gun'

export interface ArtBudget { tris: number; px: number; kb: number }

export interface ArtAsset {
  id: string
  kind: ArtKind
  batch: number
  budget: string
  glow: string
  prompt?: string
  base?: string
  livery?: string
  /** Recolored at build time (a repaint from its base's model, a design from its own): the three paint colors. */
  colors?: { hull: string; panel: string; dark: string }
  seed?: number
  size?: number
  stage?: number
  old?: string
  turn?: 0 | 180
  /** Taller than wide, checked by eye in the angled preview: skips the lies-flat check. */
  tall?: true
}

export const STYLE: string
export const BUDGETS: Record<string, ArtBudget>
export const ASSETS: ArtAsset[]
