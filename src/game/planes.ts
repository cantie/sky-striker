import type { Nozzle } from './flames'
import { aiModel } from './models'

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
  flame: string
  flames: 1 | 2
  nozzles?: Nozzle[]
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
    model: aiModel('hawk'), size: 2,
    flame: '#3fd4ff', flames: 2,
    hp: 3, fireRate: 1, damage: 1,
    skill: 'none', skillName: 'STANDARD ISSUE', skillText: 'No gimmicks — solid hull and cannon.',
  },
  {
    id: 'magnetar', name: 'MAGNETAR', tagline: 'Never misses a star', price: 150,
    model: aiModel('magnetar'), size: 1.9,
    flame: '#c07aff', flames: 1,
    hp: 3, fireRate: 1, damage: 0.95,
    skill: 'magnet', skillName: 'STAR MAGNET', skillText: 'Pulls in gold stars from 3× further away.',
  },
  {
    id: 'aegis', name: 'AEGIS', tagline: 'Self-repairing shield', price: 300,
    model: aiModel('aegis'), size: 2.1,
    flame: '#3dffc0', flames: 2,
    hp: 3, fireRate: 1.05, damage: 1,
    skill: 'autoShield', skillName: 'AUTO SHIELD', skillText: 'Launches shielded, and a 5 s shield switches on by itself every 18 s.',
  },
  {
    id: 'viper', name: 'VIPER', tagline: 'Bullet hose', price: 500,
    model: aiModel('viper'), size: 1.8,
    flame: '#ffb02e', flames: 1,
    hp: 3, fireRate: 0.72, damage: 0.9,
    skill: 'rapid', skillName: 'RAPID FIRE', skillText: 'Cannon cycles 40% faster.',
  },
  {
    id: 'hornet', name: 'HORNET', tagline: 'Fire and forget', price: 750,
    model: aiModel('hornet'), size: 2,
    flame: '#ffe04a', flames: 2,
    hp: 3, fireRate: 1, damage: 1,
    skill: 'missiles', skillName: 'HOMING MISSILES', skillText: 'Launches a pair of seeking missiles every 1.4 s.',
  },
  {
    id: 'titan', name: 'TITAN', tagline: 'Flying fortress', price: 1000,
    model: aiModel('titan'), size: 2.3,
    flame: '#4af0ff', flames: 2,
    hp: 5, fireRate: 1.1, damage: 1.15,
    skill: 'armor', skillName: 'HEAVY ARMOR', skillText: 'Takes 5 hits instead of 3, hits harder but fires slower.',
  },
  {
    id: 'spectre', name: 'SPECTRE', tagline: 'Through and through', price: 1400,
    model: aiModel('spectre'), size: 2,
    flame: '#7a9aff', flames: 2,
    hp: 3, fireRate: 1, damage: 0.9,
    skill: 'pierce', skillName: 'PIERCING BOLTS', skillText: 'Bolts pass through every enemy in their path.',
  },
  {
    id: 'seraph', name: 'SERAPH', tagline: 'Never flies alone', price: 1900,
    model: aiModel('seraph'), size: 2.1,
    flame: '#6ad8ff', flames: 2,
    hp: 4, fireRate: 1, damage: 1,
    skill: 'wingmen', skillName: 'WINGMEN', skillText: 'Two escort drones fly in formation and shoot with you.',
  },
  {
    id: 'nova', name: 'NOVA', tagline: 'The last word', price: 2500,
    model: aiModel('nova'), size: 2.2,
    flame: '#ff6aa8', flames: 2,
    hp: 4, fireRate: 0.95, damage: 1.2,
    skill: 'nova', skillName: 'NOVA BURST', skillText: 'Every 5 s unleashes a ring of 18 bolts in all directions.',
  },
]

export function getPlane(id: string): PlaneDef {
  return PLANES.find((p) => p.id === id) ?? PLANES[0]
}
