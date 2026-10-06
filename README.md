# Sky Striker

Mobile-friendly 3D vertical-scrolling shoot-'em-up inspired by Sky Force Reloaded.

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
- **Mobile**: relative touch-drag (ship offset above finger), auto-fire
- **Desktop**: WASD / arrows, click-drag mouse, Esc pause
- **URL**: `?boss` skip to boss, `?easy` easy mode, `?biome=desert|jungle` force biome
- **Keys on menu**: `B` boss, `E` easy

## Assets
See [CREDITS.md](./CREDITS.md). All models are CC0 (Kenney + Quaternius).
