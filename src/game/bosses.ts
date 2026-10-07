import { MODEL_PATHS, kenneyLivery, quatLivery, type MaterialPalette } from './models'
import type { GroundSkin } from './roster'

/** How the boss moves once it has arrived on screen. */
export type BossMove = 'sway' | 'figure8' | 'orbit' | 'charge' | 'strafe' | 'drift'

/** Volley patterns; each boss cycles through its own list (later phases fire faster). */
export type BossAttack =
  | 'fan' | 'ring' | 'aimed' | 'spiral' | 'wall' | 'stream'
  | 'cross' | 'scatter' | 'twinSpiral' | 'burst' | 'broadside'

export interface BossDef {
  name: string
  /** GLB ship model, or a giant procedural vehicle. */
  model?: string
  vehicle?: GroundSkin
  size: number
  palette?: MaterialPalette
  emissive?: string
  flames: 0 | 1 | 2
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
    model: MODEL_PATHS.cargoB, size: 3.6,
    palette: kenneyLivery('#7d8a4e', '#4d5a2c', '#1d2414', '#ff5a2a'),
    flames: 2, flameColor: '#ff7a3d', radius: 1.6, ground: false,
    move: 'sway', attacks: ['fan', 'aimed'], interval: 1000,
  },
  crawler: {
    name: 'SAND CRAWLER',
    vehicle: { vehicle: 'tank', hull: '#b8945a', turret: '#8a6a3a', accent: '#ff7a2a' }, size: 3.4,
    flames: 0, flameColor: '#ff7a2a', radius: 1.8, ground: true,
    move: 'strafe', attacks: ['aimed', 'wall', 'fan'], interval: 950,
  },
  galleon: {
    name: 'DREAD GALLEON',
    model: MODEL_PATHS.shipPirate, size: 6,
    flames: 0, flameColor: '#ffffff', radius: 1.7, ground: true,
    move: 'drift', attacks: ['broadside', 'ring', 'fan'], interval: 950,
  },
  hornet: {
    name: 'EMBER HORNET',
    model: MODEL_PATHS.ship3, size: 4.4,
    palette: quatLivery('#e9d2b4', '#3a1a10', '#ff6a1a', '#ff4a10'),
    flames: 2, flameColor: '#ff8a3d', radius: 1.7, ground: false,
    move: 'figure8', attacks: ['spiral', 'aimed', 'fan'], interval: 900,
  },
  warden: {
    name: 'FROST WARDEN',
    model: MODEL_PATHS.ship2, size: 4.6,
    palette: quatLivery('#eaf6ff', '#2a4a6a', '#7fdcff', '#45c8ff'),
    flames: 2, flameColor: '#7fe0ff', radius: 1.8, ground: false,
    move: 'orbit', attacks: ['ring', 'scatter', 'wall'], interval: 900,
  },
  breaker: {
    name: 'ROCK BREAKER',
    model: MODEL_PATHS.miner, size: 4.6,
    palette: kenneyLivery('#b9653a', '#6b2f18', '#24120a', '#ffb02e'),
    flames: 2, flameColor: '#ffb02e', radius: 1.9, ground: false,
    move: 'charge', attacks: ['burst', 'fan', 'stream'], interval: 850,
  },
  wraith: {
    name: 'BOG WRAITH',
    model: MODEL_PATHS.ship4, size: 4.8,
    palette: quatLivery('#47603f', '#0e1a10', '#9bff5a', '#6aff3a'),
    emissive: '#0c2a08',
    flames: 1, flameColor: '#9bff5a', radius: 1.5, ground: false,
    move: 'drift', attacks: ['twinSpiral', 'aimed', 'scatter'], interval: 850,
  },
  hive: {
    name: 'NEON HIVE',
    model: MODEL_PATHS.ship5, size: 4.4,
    palette: quatLivery('#ff8ad8', '#2a0a2a', undefined, '#ff2ab8'),
    flames: 2, flameColor: '#ff4ad8', radius: 1.9, ground: false,
    move: 'strafe', attacks: ['cross', 'stream', 'ring', 'wall'], interval: 800,
  },
  leviathan: {
    name: 'MAGMA LEVIATHAN',
    model: MODEL_PATHS.ship1, size: 4.6,
    palette: quatLivery('#ff9a6a', '#2a0a00', undefined, '#ff3a00'),
    emissive: '#401000',
    flames: 2, flameColor: '#ff5a1f', radius: 1.9, ground: false,
    move: 'figure8', attacks: ['spiral', 'burst', 'fan', 'wall'], interval: 780,
  },
  citadel: {
    name: 'IRON CITADEL',
    model: MODEL_PATHS.ship6, size: 5.4,
    palette: quatLivery('#a7afc2', '#14161c', undefined, '#ff1a3a'),
    emissive: '#2a0006',
    flames: 2, flameColor: '#ff3a5a', radius: 2.1, ground: false,
    move: 'charge', attacks: ['twinSpiral', 'wall', 'cross', 'stream', 'ring', 'scatter'], interval: 720,
  },
}

export type BossId = keyof typeof BOSSES
