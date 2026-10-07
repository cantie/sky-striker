import type { Biome } from '../../../game/biomes'

type EnvPreset = 'dawn' | 'forest' | 'city' | 'sunset' | 'night' | 'park' | 'warehouse' | 'apartment' | 'lobby' | 'studio'

export interface Theme {
  env: EnvPreset
  envIntensity: number
  /** Hemisphere sky/ground colours + intensity. */
  hemi: [string, string, number]
  ambient: number
  sun: { color: string; intensity: number; position: [number, number, number] }
  fill: { color: string; intensity: number }
  fog: string
  /** Multiplier on the ground texture (darken / tint for mood). */
  groundTint: string
  /** Strength of the ground emissive map (lava, neon, spores); 0 if none. */
  glow: number
  clouds: { count: number; color: string; opacity: number; shadow: number }
}

export const THEMES: Record<Biome, Theme> = {
  jungle: {
    env: 'forest', envIntensity: 0.55, hemi: ['#e4f2ff', '#2a4a24', 0.8], ambient: 0.55,
    sun: { color: '#fff4d6', intensity: 2.15, position: [6, 20, 8] }, fill: { color: '#7ad7ff', intensity: 0.48 },
    fog: '#8eb8a8', groundTint: '#ffffff', glow: 0,
    clouds: { count: 6, color: '#ffffff', opacity: 0.55, shadow: 0.28 },
  },
  desert: {
    env: 'dawn', envIntensity: 0.7, hemi: ['#ffd9a0', '#8a6a3a', 0.85], ambient: 0.75,
    sun: { color: '#ffd7a0', intensity: 2.6, position: [12, 18, 6] }, fill: { color: '#ffaa55', intensity: 0.28 },
    fog: '#e8d0a8', groundTint: '#ffffff', glow: 0,
    clouds: { count: 4, color: '#fff4e2', opacity: 0.42, shadow: 0.22 },
  },
  ocean: {
    env: 'park', envIntensity: 0.7, hemi: ['#dff4ff', '#1a4a6a', 0.85], ambient: 0.6,
    sun: { color: '#fffaf0', intensity: 2, position: [8, 20, 6] }, fill: { color: '#8ae0ff', intensity: 0.3 },
    fog: '#9ad0e8', groundTint: '#e4ecf0', glow: 0,
    clouds: { count: 5, color: '#ffffff', opacity: 0.45, shadow: 0.26 },
  },
  autumn: {
    env: 'sunset', envIntensity: 0.55, hemi: ['#ffe2b8', '#4a2e14', 0.8], ambient: 0.55,
    sun: { color: '#ffc890', intensity: 2.3, position: [10, 16, 8] }, fill: { color: '#ff9a5a', intensity: 0.35 },
    fog: '#d8a878', groundTint: '#fff2e2', glow: 0,
    clouds: { count: 5, color: '#fff0e0', opacity: 0.5, shadow: 0.26 },
  },
  arctic: {
    env: 'dawn', envIntensity: 0.35, hemi: ['#eaf4ff', '#7a90a8', 0.55], ambient: 0.3,
    sun: { color: '#eef6ff', intensity: 1.35, position: [6, 18, 10] }, fill: { color: '#9ad8ff', intensity: 0.25 },
    fog: '#d8e8f4', groundTint: '#c4d0de', glow: 0,
    clouds: { count: 7, color: '#f6faff', opacity: 0.6, shadow: 0.2 },
  },
  canyon: {
    env: 'sunset', envIntensity: 0.6, hemi: ['#ffd2a8', '#5a2410', 0.85], ambient: 0.6,
    sun: { color: '#ffc08a', intensity: 2.5, position: [12, 16, 4] }, fill: { color: '#ff7a3a', intensity: 0.3 },
    fog: '#d88a5a', groundTint: '#ffffff', glow: 0,
    clouds: { count: 3, color: '#ffe6d0', opacity: 0.38, shadow: 0.22 },
  },
  swamp: {
    env: 'forest', envIntensity: 0.4, hemi: ['#b8d0a8', '#1a2410', 0.7], ambient: 0.4,
    sun: { color: '#e0e8c0', intensity: 1.5, position: [4, 18, 10] }, fill: { color: '#7aff9a', intensity: 0.45 },
    fog: '#4a5a40', groundTint: '#d8e0d0', glow: 1.4,
    clouds: { count: 8, color: '#c8d8c0', opacity: 0.5, shadow: 0.3 },
  },
  city: {
    env: 'city', envIntensity: 0.5, hemi: ['#c8d0ff', '#20222a', 0.7], ambient: 0.45,
    sun: { color: '#ffd8b8', intensity: 1.7, position: [10, 18, 6] }, fill: { color: '#ff4ad8', intensity: 0.4 },
    fog: '#5a5e78', groundTint: '#d8dce8', glow: 1.6,
    clouds: { count: 4, color: '#e0e4ff', opacity: 0.4, shadow: 0.24 },
  },
  volcano: {
    env: 'sunset', envIntensity: 0.35, hemi: ['#ffb08a', '#200806', 0.6], ambient: 0.35,
    sun: { color: '#ff9a6a', intensity: 1.6, position: [8, 16, 6] }, fill: { color: '#ff5a1a', intensity: 0.7 },
    fog: '#3a2420', groundTint: '#ffffff', glow: 2.2,
    clouds: { count: 6, color: '#5a4a46', opacity: 0.55, shadow: 0.32 },
  },
  fortress: {
    env: 'warehouse', envIntensity: 0.55, hemi: ['#d0d8ff', '#1a1c22', 0.75], ambient: 0.45,
    sun: { color: '#e8eeff', intensity: 1.9, position: [8, 20, 6] }, fill: { color: '#9ab0ff', intensity: 0.3 },
    fog: '#3a3e48', groundTint: '#e8ecf4', glow: 1.2,
    clouds: { count: 3, color: '#9aa0b0', opacity: 0.4, shadow: 0.22 },
  },
}
