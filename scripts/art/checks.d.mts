// Types for checks.mjs, for aiAssets.test.ts.
import type { ArtAsset, ArtBudget } from '../../art/manifest.mjs'

/** One line per problem with the built GLB at `path`; empty when it passes. */
export function checkGlb(path: string, asset: ArtAsset, budget: ArtBudget): Promise<string[]>
