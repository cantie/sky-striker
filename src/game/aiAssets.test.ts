/// <reference types="node" />
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ASSETS, BUDGETS } from '../../art/manifest.mjs'
import { checkGlb } from '../../scripts/art/checks.mjs'
import { BOSSES } from './bosses'
import { isAiModel } from './models'
import { PLANES } from './planes'
import type { GroundSkin } from './roster'
import { STAGES } from './stages'

const OUT = join(process.cwd(), 'public', 'models', 'ai')
const idOf = (path: string) => path.replace(/^\/models\/ai\//, '').replace(/\.glb$/, '')
const groundParts = (g?: GroundSkin) => g ? [g.hullModel, g.gunModel, g.baseModel, g.turretGunModel] : []

/** Every model path the game definitions point at. */
function definitionPaths(): string[] {
  return [
    ...PLANES.map((p) => p.model),
    ...STAGES.flatMap((s) => [...Object.values(s.skins).map((k) => k.model), ...groundParts(s.ground)]),
    ...Object.values(BOSSES).flatMap((b) => [b.model, ...groundParts(b.vehicle)]),
  ].filter((p): p is string => !!p)
}

describe('AI assets', () => {
  it('every AI model the game uses is in the manifest and on disk', () => {
    const ids = new Set(ASSETS.map((a) => a.id))
    const used = [...new Set(definitionPaths().filter(isAiModel).map(idOf))]
    expect(used.filter((id) => !ids.has(id)), 'not in art/manifest.mjs').toEqual([])
    expect(used.filter((id) => !existsSync(join(OUT, `${id}.glb`))), 'not built in public/models/ai').toEqual([])
  })

  it('every built GLB passes checkGlb', async () => {
    const files = existsSync(OUT) ? readdirSync(OUT).filter((f) => f.endsWith('.glb')) : []
    const problems: string[] = []
    for (const f of files) {
      const asset = ASSETS.find((a) => a.id === f.replace(/\.glb$/, ''))
      if (!asset) { problems.push(`${f}: not in art/manifest.mjs`); continue }
      for (const p of await checkGlb(join(OUT, f), asset, BUDGETS[asset.budget])) problems.push(`${f}: ${p}`)
    }
    expect(problems).toEqual([])
  }, 60_000)
})
