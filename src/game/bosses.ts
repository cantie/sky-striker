import { aiModel, type MaterialPalette } from './models'
import type { Nozzle } from './flames'
import type { GroundSkin } from './roster'

/** How the boss moves once it has arrived on screen. */
export type BossMove = 'sway' | 'figure8' | 'orbit' | 'charge' | 'strafe' | 'drift'

/** Volley patterns; each boss cycles through its own list (later phases fire faster). */
export type BossAttack =
  | 'fan' | 'ring' | 'aimed' | 'spiral' | 'wall' | 'stream'
  | 'cross' | 'scatter' | 'twinSpiral' | 'burst' | 'broadside'
  /** Telegraphed charge then a sustained beam (see BossLaser). */
  | 'laser'

export interface BossDef {
  name: string
  /** GLB ship model, or a giant procedural vehicle. */
  model?: string
  vehicle?: GroundSkin
  size: number
  palette?: MaterialPalette
  emissive?: string
  flames: 0 | 1 | 2
  nozzles?: Nozzle[]
  flameColor: string
  /** Bullet hit radius. */
  radius: number
  /** Sits on the terrain (tank/ship) rather than flying. */
  ground: boolean
  move: BossMove
  attacks: BossAttack[]
  /** Base ms between volleys. */
  interval: number
}

export const BOSSES: Record<string, BossDef> = {
  vulture: {
    name: 'VULTURE GUNSHIP',
    model: aiModel('boss-vulture'), size: 5.8,
    flames: 2, flameColor: '#ff7a3d', radius: 1.6, ground: false,
    move: 'sway', attacks: ['fan', 'laser', 'aimed'], interval: 1000,
  },
  crawler: {
    name: 'SAND CRAWLER',
    vehicle: {
      vehicle: 'tank', hull: '#b8945a', turret: '#8a6a3a', accent: '#ff7a2a',
      hullModel: aiModel('boss-crawler'), gunModel: aiModel('boss-crawler-gun'), gunY: 0.33,
    },
    size: 5.4,
    flames: 0, flameColor: '#ff7a2a', radius: 1.8, ground: true,
    move: 'strafe', attacks: ['aimed', 'laser', 'wall', 'fan'], interval: 950,
  },
  galleon: {
    name: 'DREAD GALLEON',
    model: aiModel('boss-galleon'), size: 9.6,
    flames: 0, flameColor: '#ffffff', radius: 1.7, ground: true,
    move: 'drift', attacks: ['broadside', 'laser', 'ring', 'fan'], interval: 950,
  },
  hornet: {
    name: 'EMBER HORNET',
    model: aiModel('boss-hornet'), size: 7.0,
    flames: 2, flameColor: '#ff8a3d', radius: 1.7, ground: false,
    move: 'figure8', attacks: ['spiral', 'laser', 'aimed', 'fan'], interval: 900,
  },
  warden: {
    name: 'FROST WARDEN',
    model: aiModel('boss-warden'), size: 7.4,
    flames: 2, flameColor: '#7fe0ff', radius: 1.8, ground: false,
    move: 'orbit', attacks: ['ring', 'laser', 'scatter', 'wall'], interval: 900,
  },
  breaker: {
    name: 'ROCK BREAKER',
    model: aiModel('boss-breaker'), size: 7.4,
    flames: 2, flameColor: '#ffb02e', radius: 1.9, ground: false,
    move: 'charge', attacks: ['burst', 'laser', 'fan', 'stream'], interval: 850,
  },
  wraith: {
    name: 'BOG WRAITH',
    model: aiModel('boss-wraith'), size: 7.7,
    flames: 1, flameColor: '#9bff5a', radius: 1.5, ground: false,
    move: 'drift', attacks: ['twinSpiral', 'laser', 'aimed', 'scatter'], interval: 850,
  },
  hive: {
    name: 'NEON HIVE',
    model: aiModel('boss-hive'), size: 7.0,
    flames: 2, flameColor: '#ff4ad8', radius: 1.9, ground: false,
    move: 'strafe', attacks: ['cross', 'laser', 'stream', 'ring', 'wall'], interval: 800,
  },
  leviathan: {
    name: 'MAGMA LEVIATHAN',
    model: aiModel('boss-leviathan'), size: 7.4,
    flames: 2, flameColor: '#ff5a1f', radius: 1.9, ground: false,
    move: 'figure8', attacks: ['spiral', 'laser', 'burst', 'fan', 'wall'], interval: 780,
  },
  citadel: {
    name: 'IRON CITADEL',
    model: aiModel('boss-citadel'), size: 8.6,
    flames: 2, flameColor: '#ff3a5a', radius: 2.1, ground: false,
    move: 'charge', attacks: ['twinSpiral', 'laser', 'wall', 'cross', 'stream', 'ring', 'scatter'], interval: 720,
  },
}

export type BossId = keyof typeof BOSSES
