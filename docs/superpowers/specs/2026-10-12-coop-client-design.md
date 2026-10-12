# Co-op client foundation — design

Status: approved 2026-10-12 · Branch: `feat/coop-client`
Source: `nakama-shmup-integration.md` (Part 2 — co-op, model C: deterministic world + authoritative events)

## Goal
Prepare the client for 2-player co-op without changing how single-player plays. One simulation core
serves both modes. Scope: deterministic gameplay foundation + co-op client module + an in-browser
loopback server for testing. Out of scope: lobby/matchmaking UI, a real Nakama server.

## A. Deterministic core (shared by single and co-op)
1. **Fixed timestep, 60 steps/s** (`src/game/sim/clock.ts`). Gameplay systems register `step(dt)` in a
   fixed order; `GameScene` accumulates real time and runs whole steps. Visual-only work stays in `useFrame`.
2. **Seeded RNG** (`src/game/sim/rng.ts`): mulberry32 with independent named streams (`spawn`, `drops`,
   `boss`, `coins`). A run has a `runSeed` — random for single-player (same feel), server-given in co-op.
   Purely cosmetic randomness (screen shake, sparks) keeps `Math.random`.
3. **Exact stage time**: the wave timer keeps its remainder, so wave *k* starts at exactly `k × waveInterval`;
   spawn times derive from stage time only.
4. **Stable enemy ids** `w{wave}.g{group}.u{unit}`, identical on every client.
5. **Canonical world frame**: spawn/exit edges and the "entered/left the screen" test use fixed
   coordinates instead of the local viewport (tall phones vs 9:16 desktop would otherwise put the same
   enemy at different positions). The fire zone already equals the fixed playfield.
6. **Shared stage script** (`src/game/sim/stageScript.ts`): flattens a stage config into
   `{ id, type, path, params, spawnT, despawnT, hp, score, coins }[]` for the server to know which enemies
   exist and their HP (any backend: Nakama or NestJS).

## B. Co-op client module (`src/net/coop/`)
- `protocol.ts` — opcodes 1–7 (client→server) and 100–108 (server→client) as in the source doc, typed, JSON.
- `transport.ts` — backend-neutral interface: connect, createRoom, joinRoom, matchmake, send, onMessage,
  onDisconnect, leave.
- `nakamaTransport.ts` — adapter for `@heroiclabs/nakama-js`.
- `clockSync.ts` — ping/RTT estimation → `serverNow()`.
- `interpolation.ts` — teammate buffer, render at `serverNow − 100 ms`, extrapolate ≤ 150 ms.
- `coopSession.ts` — lobby → countdown → playing → result; sends POS (20 Hz), HITS (batched 100 ms),
  GOT_HIT, PICKUP, READY, RESYNC; applies server events through a `WorldAdapter`.
- `loopbackServer.ts` — in-browser authoritative stand-in with simulated latency and a bot teammate
  (`?coop=loopback`).

## C. Game integration (only when `mode === 'coop'`)
Hits flash and subtract estimated HP locally; enemies explode only on `ENEMY_DEAD`. Drops come from the
server, aimed shots from `AIMED`, teammate drawn from interpolation, gold stars per player. Single-player
code paths never enter these branches.

## Implementation notes
- Gameplay systems run in `useSimStep(ORDER.x, …)`; rendering stays in `useFrame`. Pure, shareable
  logic: `game/spawns.ts` (wave expansion, `enemyPos`), `game/dropRules.ts`, `game/sim/stageScript.ts`.
- `game/sim/net.ts` is the only seam gameplay sees (`net()` is null in single-player): `hit`, `pickup`,
  `gotHit`, `bossTarget`, `spawnAllowed` (settled ids are not re-spawned by a client catching up).
- Kill/pickup effects live in `components/game/effects.ts`, shared by the single-player path and the
  co-op adapter (`net/coop/storeWorld.ts`).
- Co-op frame driver: steps toward `floor(stageTime / STEP)`, ≤3 steps/frame normally, ≤240 when >30
  behind. Teammate cannon = ghost bolts (no damage, stop on contact).
- Opcodes PING=8 / PONG=109 added for clock sync. Nakama side expected: RPC `create_coop_match`,
  matchmaker hook with `+properties.stage:<id>`, match handler speaking `protocol.ts`.
- Not yet: lobby/matchmaking UI, revive/spectate when one player is down, co-op flag on run reports.

## D. Testing
Vitest unit tests: RNG reproducibility, stage-script determinism, clock sync, interpolation, protocol,
loopback server flow. Single-player regression via the existing bot (≈126 s to boss on stage 1, drop caps)
and screenshots; co-op via `?coop=loopback`.
