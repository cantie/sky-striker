# Sky Striker

Mobile-friendly 3D vertical-scrolling shoot-'em-up inspired by Sky Force Reloaded.

## Features
- **3-stage saga** with a stage-select map (lock progression)
- **Objective stars** per stage (destroy %, untouched, collect all, finish, boss)
- Progress + high scores persisted in `localStorage`
- Top-down orthographic camera, finger-follow controls, unlimited auto-fire

## Stack
- Vite + TypeScript + React
- Three.js + React Three Fiber + drei + postprocessing
- Zustand game state, Kenney CC0 audio

## Run
```bash
npm install
npm run dev   # http://localhost:5847
npm run build
npm run preview
```

## Controls
- **Mobile**: finger-follow (ship offset above finger), auto-fire
- **Desktop**: WASD / arrows, click-drag mouse, Esc pause
- **URL**: `?boss` skip to boss (Stage 3), `?easy` easy mode, `?biome=desert|jungle`
- **Keys on menu**: `B` boss (Stage 3), `E` easy Stage 1

## Assets
See [CREDITS.md](./CREDITS.md). All models are CC0 (Kenney + Quaternius).
