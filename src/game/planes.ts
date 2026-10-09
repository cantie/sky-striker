import { MODEL_PATHS as M, kenneyLivery as kl, quatLivery as ql, type MaterialPalette } from './models'

/** Signature ability each hangar plane brings into a run. */
export type PlaneSkill =
  | 'none'
  | 'magnet'      // star magnet reaches much further
  | 'autoShield'  // a timed shield switches itself on every so often
  | 'rapid'       // faster cannon, slightly weaker bolts
  | 'missiles'    // periodic homing missiles
  | 'armor'       // extra-tough hull
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
  /** Hits the hull can take (every bullet/ram costs 1, a boss laser 2). */
  hp: number
  /** Multiplier on cannon cooldown (<1 = faster). */
  fireRate: number
  /** Multiplier on cannon damage. */
  damage: number
  skill: PlaneSkill
  skillName: string
  skillText: string
}

export const PLANES: PlaneDef[] = [
  {
    id: 'hawk', name: 'HAWK', tagline: 'Reliable all-rounder', price: 0,
    model: M.player, size: 2,
    palette: kl('#eef4ff', '#2f63d6', '#141c33', '#19c6ff', 1.4), flame: '#3fd4ff', flames: 2,
    hp: 3, fireRate: 1, damage: 1,
    skill: 'none', skillName: 'STANDARD ISSUE', skillText: 'No gimmicks — solid hull and cannon.',
  },
  {
    id: 'magnetar', name: 'MAGNETAR', tagline: 'Never misses a star', price: 150,
    model: M.speederA, size: 1.9,
    palette: kl('#f4f0ff', '#7a3ad6', '#1a1030', '#c07aff', 1.4), flame: '#c07aff', flames: 1,
    hp: 3, fireRate: 1, damage: 0.95,
    skill: 'magnet', skillName: 'STAR MAGNET', skillText: 'Pulls in gold stars from 3× further away.',
  },
  {
    id: 'aegis', name: 'AEGIS', tagline: 'Self-repairing shield', price: 300,
    model: M.cargoA, size: 2.1,
    palette: kl('#e8fff6', '#1a9a7a', '#0a2a22', '#3dffc0', 1.4), flame: '#3dffc0', flames: 2,
    hp: 3, fireRate: 1.05, damage: 1,
    skill: 'autoShield', skillName: 'AUTO SHIELD', skillText: 'Launches shielded, and a 5 s shield switches on by itself every 18 s.',
  },
  {
    id: 'viper', name: 'VIPER', tagline: 'Bullet hose', price: 500,
    model: M.racer, size: 1.8,
    palette: kl('#fff4e0', '#e0601a', '#2a1006', '#ffb02e', 1.4), flame: '#ffb02e', flames: 1,
    hp: 3, fireRate: 0.72, damage: 0.9,
    skill: 'rapid', skillName: 'RAPID FIRE', skillText: 'Cannon cycles 40% faster.',
  },
  {
    id: 'hornet', name: 'HORNET', tagline: 'Fire and forget', price: 750,
    model: M.speederB, size: 2,
    palette: kl('#fffbe0', '#d6b01a', '#2a2206', '#ffe04a', 1.4), flame: '#ffe04a', flames: 2,
    hp: 3, fireRate: 1, damage: 1,
    skill: 'missiles', skillName: 'HOMING MISSILES', skillText: 'Launches a pair of seeking missiles every 1.4 s.',
  },
  {
    id: 'titan', name: 'TITAN', tagline: 'Flying fortress', price: 1000,
    model: M.cargoB, size: 2.3,
    palette: kl('#dfe6ee', '#4a5a6e', '#141a22', '#4af0ff', 1.4), flame: '#4af0ff', flames: 2,
    hp: 5, fireRate: 1.1, damage: 1.15,
    skill: 'armor', skillName: 'HEAVY ARMOR', skillText: 'Takes 5 hits instead of 3, hits harder but fires slower.',
  },
  {
    id: 'spectre', name: 'SPECTRE', tagline: 'Through and through', price: 1400,
    model: M.speederC, size: 2,
    palette: kl('#eaf0ff', '#3a4aa8', '#0e1230', '#7a9aff', 1.4), flame: '#7a9aff', flames: 2,
    hp: 3, fireRate: 1, damage: 0.9,
    skill: 'pierce', skillName: 'PIERCING BOLTS', skillText: 'Bolts pass through every enemy in their path.',
  },
  {
    id: 'seraph', name: 'SERAPH', tagline: 'Never flies alone', price: 1900,
    model: M.ship3, size: 2.1,
    palette: ql('#ffffff', '#1a3a6a', '#4ac8ff', '#2ab0ff'), flame: '#6ad8ff', flames: 2,
    hp: 4, fireRate: 1, damage: 1,
    skill: 'wingmen', skillName: 'WINGMEN', skillText: 'Two escort drones fly in formation and shoot with you.',
  },
  {
    id: 'nova', name: 'NOVA', tagline: 'The last word', price: 2500,
    model: M.ship2, size: 2.2,
    palette: ql('#fff6f0', '#5a1a3a', '#ff4a8a', '#ff2a6a'), flame: '#ff6aa8', flames: 2,
    hp: 4, fireRate: 0.95, damage: 1.2,
    skill: 'nova', skillName: 'NOVA BURST', skillText: 'Every 5 s unleashes a ring of 18 bolts in all directions.',
  },
]

export function getPlane(id: string): PlaneDef {
  return PLANES.find((p) => p.id === id) ?? PLANES[0]
}
