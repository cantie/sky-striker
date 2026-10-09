# Sky Striker

Mobile-friendly 3D vertical-scrolling shoot-'em-up inspired by Sky Force Reloaded.

## Features
- **10-stage saga**, each with its own biome, enemy roster, scripted waves (~2 min) and boss
- **Objective stars** per stage, gold stars to unlock **9 hangar planes** with different skills
- Play as **Guest** (progress in `localStorage`), or **log in with Keycloak** to save online,
  record every run and join the **leaderboards** (total score, saga stars, gold stars)
- Top-down orthographic camera, finger-follow controls, unlimited auto-fire

## Stack
- Game: Vite + TypeScript + React, Three.js + React Three Fiber + drei, Zustand
- Server (`server/`): NestJS 11 + TypeORM (MySQL/MariaDB), `openid-client` for Keycloak

## Run the game only (guest mode)
```bash
npm install
npm run dev   # http://localhost:5847 — without the server, login is hidden and everything stays local
```

## Run game + server locally
```bash
# 1. Server (needs a MySQL/MariaDB database, e.g. CREATE DATABASE sky_striker)
cd server
npm install
cp .env.example .env.local   # set MYSQL_URL, JWT_SECRET; LOCAL_LOGIN=true for a username-only dev login
set -a; . ./.env.local; set +a; npm run start:dev   # http://localhost:3100/api

# 2. Game (another terminal, repo root) — Vite proxies /api to :3100
npm run dev
```
Migrations run automatically when the server boots. Server tests: `cd server && npm test`.

## Deploy (one container: game + API)
The server serves the built game on `/` and the API on `/api`, so a single image is the whole app.
```bash
cp .env.example .env          # fill in Keycloak + JWT_SECRET (+ DB password)
docker compose up -d --build  # app + MySQL → http://localhost:3100
```
Or build/run just the app image against an existing database:
```bash
docker build -t sky-striker .
docker run -p 3100:3100 -e MYSQL_URL=... -e JWT_SECRET=... -e KEYCLOAK_ISSUER=... sky-striker
```
**Config** is read from environment variables at start-up (see [`.env.example`](./.env.example)), so the same
image works everywhere; the game fetches its Keycloak settings from `GET /api/config` at runtime.
Secrets from Vault can be injected as env vars, or rendered to a dotenv file and pointed to with `ENV_FILE`.

**Keycloak client**: confidential client, *Standard flow* on, PKCE method `S256`, *Valid redirect URIs* and
*Valid post logout redirect URIs* = the game's public URL (also listed in `KEYCLOAK_REDIRECT_URIS`).

## Controls
- **Mobile**: finger-follow (ship offset above finger), auto-fire
- **Desktop**: WASD / arrows, click-drag mouse, Esc pause
- **URL**: `?stage=N` jump to a stage, `?boss` skip to its boss, `?easy` easy mode, `?biome=ocean` force a biome
- **Keys on menu**: `B` boss, `E` easy start

## Assets
See [CREDITS.md](./CREDITS.md). All models are CC0 (Kenney + Quaternius).
