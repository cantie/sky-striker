import { BOSSES } from './bosses'
import { getPlane } from './planes'
import type { GroundSkin } from './roster'
import { getStage } from './stages'

const groundParts = (g: GroundSkin | undefined) => g ? [g.hullModel, g.gunModel, g.baseModel, g.turretGunModel] : []

/** Every GLB a stage shows: its four fighter skins, its ground parts, its boss and the planes flying it. */
export function stageModels(stageId: number, planeIds: string[]): string[] {
  const stage = getStage(stageId)
  const boss = BOSSES[stage.boss]
  const all = [
    ...Object.values(stage.skins).map((s) => s.model),
    ...groundParts(stage.ground),
    boss?.model, ...groundParts(boss?.vehicle),
    ...planeIds.map((id) => getPlane(id).model),
  ]
  return [...new Set(all.filter((p): p is string => !!p))]
}
