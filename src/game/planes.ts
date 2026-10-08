import { MODEL_PATHS as M, kenneyLivery as kl, quatLivery as ql, type MaterialPalette } from './models'

/** Signature ability each hangar plane brings into a run. */
export type PlaneSkill =
  | 'none'
  | 'magnet'      // star magnet reaches much further
  | 'shieldRegen' // shield recharges after a few seconds without damage
  | 'rapid'       // faster cannon, slightly weaker bolts
  | 'missiles'    // periodic homing missiles
  | 'armor'       // takes less damage, huge hull
  | 'pierce'      // bolts punch through every enemy in line
  | 'wingmen'     // two escort drones that fire alongside
  | 'nova'        // periodic radial burst of bolts

export interface PlaneDef {
  id: string
  name: string
  tagline: string
  /** Gold stars to unlock (0 = starter). */
  price: number
  model: string
  size: number
  palette: MaterialPalette
  flame: string
  flames: 1 | 2
  /** Hull points (before easy-mode bonus). */
  hp: number
  /** Multiplier on damage taken (<1 = tougher). */
  armor: number
  /** Multiplier on cannon cooldown (<1 = faster). */
  fireRate: number
  /** Multiplier on cannon damage. */
  damage: number
  /** Shield the plane launches with. */
  startShield: number
  skill: PlaneSkill
  skillName: string
  skillText: string
}

export const PLANES: PlaneDef[] = [
  {
    id: 'hawk', name: 'HAWK', tagline: 'Reliable all-rounder', price: 0,
    model: M.player, size: 2,
    palette: kl('#eef4ff', '#2f63d6', '#141c33', '#19c6ff', 1.4), flame: '#3fd4ff', flames: 2,
    hp: 100, armor: 1, fireRate: 1, damage: 1, startShield: 0,
    skill: 'none', skillName: 'STANDARD ISSUE', skillText: 'No gimmicks — solid hull and cannon.',
  },
  {
    id: 'magnetar', name: 'MAGNETAR', tagline: 'Never misses a star', price: 150,
    model: M.speederA, size: 1.9,
    palette: kl('#f4f0ff', '#7a3ad6', '#1a1030', '#c07aff', 1.4), flame: '#c07aff', flames: 1,
    hp: 100, armor: 1, fireRate: 1, damage: 0.95, startShield: 0,
    skill: 'magnet', skillName: 'STAR MAGNET', skillText: 'Pulls in gold stars from 3× further away.',
  },
  {
    id: 'aegis', name: 'AEGIS', tagline: 'Self-repairing shield', price: 300,
    model: M.cargoA, size: 2.1,
    palette: kl('#e8fff6', '#1a9a7a', '#0a2a22', '#3dffc0', 1.4), flame: '#3dffc0', flames: 2,
    hp: 120, armor: 1, fireRate: 1.05, damage: 1, startShield: 40,
    skill: 'shieldRegen', skillName: 'REGEN SHIELD', skillText: 'Starts shielded; shield recharges after 3 s without a hit.',
  },
  {
    id: 'viper', name: 'VIPER', tagline: 'Bullet hose', price: 500,
    model: M.racer, size: 1.8,
    palette: kl('#fff4e0', '#e0601a', '#2a1006', '#ffb02e', 1.4), flame: '#ffb02e', flames: 1,
    hp: 90, armor: 1, fireRate: 0.72, damage: 0.9, startShield: 0,
    skill: 'rapid', skillName: 'RAPID FIRE', skillText: 'Cannon cycles 40% faster.',
  },
  {
    id: 'hornet', name: 'HORNET', tagline: 'Fire and forget', price: 750,
    model: M.speederB, size: 2,
    palette: kl('#fffbe0', '#d6b01a', '#2a2206', '#ffe04a', 1.4), flame: '#ffe04a', flames: 2,
    hp: 100, armor: 1, fireRate: 1, damage: 1, startShield: 0,
    skill: 'missiles', skillName: 'HOMING MISSILES', skillText: 'Launches a pair of seeking missiles every 1.4 s.',
  },
  {
    id: 'titan', name: 'TITAN', tagline: 'Flying fortress', price: 1000,
    model: M.cargoB, size: 2.3,
    palette: kl('#dfe6ee', '#4a5a6e', '#141a22', '#4af0ff', 1.4), flame: '#4af0ff', flames: 2,
    hp: 180, armor: 0.75, fireRate: 1.1, damage: 1.15, startShield: 0,
    skill: 'armor', skillName: 'HEAVY ARMOR', skillText: '180 hull, takes 25% less damage, hits harder but fires slower.',
  },
  {
    id: 'spectre', name: 'SPECTRE', tagline: 'Through and through', price: 1400,
    model: M.speederC, size: 2,
    palette: kl('#eaf0ff', '#3a4aa8', '#0e1230', '#7a9aff', 1.4), flame: '#7a9aff', flames: 2,
    hp: 100, armor: 1, fireRate: 1, damage: 0.9, startShield: 0,
    skill: 'pierce', skillName: 'PIERCING BOLTS', skillText: 'Bolts pass through every enemy in their path.',
  },
  {
    id: 'seraph', name: 'SERAPH', tagline: 'Never flies alone', price: 1900,
    model: M.ship3, size: 2.1,
    palette: ql('#ffffff', '#1a3a6a', '#4ac8ff', '#2ab0ff'), flame: '#6ad8ff', flames: 2,
    hp: 110, armor: 1, fireRate: 1, damage: 1, startShield: 0,
    skill: 'wingmen', skillName: 'WINGMEN', skillText: 'Two escort drones fly in formation and shoot with you.',
  },
  {
    id: 'nova', name: 'NOVA', tagline: 'The last word', price: 2500,
    model: M.ship2, size: 2.2,
    palette: ql('#fff6f0', '#5a1a3a', '#ff4a8a', '#ff2a6a'), flame: '#ff6aa8', flames: 2,
    hp: 120, armor: 0.9, fireRate: 0.95, damage: 1.2, startShield: 0,
    skill: 'nova', skillName: 'NOVA BURST', skillText: 'Every 5 s unleashes a ring of 18 bolts in all directions.',
  },
]

export function getPlane(id: string): PlaneDef {
  return PLANES.find((p) => p.id === id) ?? PLANES[0]
}
