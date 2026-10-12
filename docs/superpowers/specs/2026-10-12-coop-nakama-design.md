# Co-op mode on Nakama — design

Status: approved in chat 2026-10-12 · Branches: `feat/coop-nakama` (sky-striker), `feat/skystriker-coop` (nakama-cluster)
Builds on: [2026-10-12-coop-client-design.md](2026-10-12-coop-client-design.md) (deterministic sim core + co-op client module)

## Goal
Two-player co-op that always runs the whole campaign: stage 1 → stage 10 back to back. A run ends when
the last stage is cleared or both players are down at once. Co-op runs rank on three leaderboards.
The authoritative server is a Lua module in the Nakama cluster (`E:\projects\others\nakama-cluster`).
Single-player is unchanged.

## 1. Pieces and where they live
| Repo | Path | Role |
|------|------|------|
| nakama-cluster | `modules/skystriker_coop.lua` | Match handler, RPCs, leaderboards |
| nakama-cluster | `modules/skystriker_data.lua` | **Generated** stage data (do not edit by hand) |
| nakama-cluster | config / helm | Runtime env `SKYSTRIKER_API_URL` |
| sky-striker | `scripts/gen-coop-data.ts` | Writes `skystriker_data.lua` from `stageScript()` (`npm run gen:coop -- --out <path>`) |
| sky-striker | `src/net/coop/*` | Protocol, Nakama transport, session (multi-stage), loopback server |
| sky-striker | `src/components/ui/Coop*.tsx`, game components | Lobby, results, revive beacon, team HUD, leaderboard tabs |

Module format follows `modules/tictactoe.lua`: a match module returning the handler table, RPC ids
prefixed `skystriker_`, JSON match label. Lua is gopher-lua (5.1: no bit ops), so the server never
reimplements the seeded RNG or path math.

## 2. Stage data (generated)
`gen-coop-data.ts` flattens each stage (normal difficulty) into:

```lua
return {
  version = "<hash>",      -- FNV-1a of the JSON payload
  maxDps = <number>,        -- strongest weapon × best plane damage, per game-second
  bossScore = 5000, rescueScore = 300,
  stages = {
    [1] = { bossHp = 1500, waves = <maxWaves>, enemies = {
      { id = "w0.g0.u0", wave = 0, spawnT = 0, enterT = 0.4675, despawnT = 7.755,
        hp = 25, score = 100, shot = "down", fireInterval = 0 }, ... } },
    ...
  },
}
```

`enterT = nil` encodes enemies that never enter. Times are stage game-seconds. The client computes the
same `version` from its own bundle and sends it when joining. The server refuses a mismatch with
"update the game" so data drift between repos cannot desync a run. Total size is about 1.7k enemies.

## 3. Run flow
Server phases: `lobby → countdown → playing → bossWarning → boss → stageClear → (next stage) countdown … → complete | failed`.

- **lobby**: up to 2 players. Each sends READY. When both are READY, stage 1 starts.
- **Per stage**: the server picks a fresh seed and sets `stageT0 = now + 3000`. PHASE carries
  `{phase, stageIndex, stageId, seed, stageT0, bossHp?}`. Each client restarts its sim through
  `startGame({ stageId, seed, mode: 'coop' })`.
- **Boss**: `bossWarning` once every enemy is dead or despawned after the last wave. The boss arrives
  2.2 s later. ENEMY_DEAD `boss` moves to `stageClear`.
- **stageClear**: lasts 6 s. Clients get the victory window (collect stars), fly out, and see an
  inter-stage summary card. Then the next stage begins, or `complete` after stage 10.
- **Carry-over**: each player keeps their own weapon power. HP and shield refill every stage. Downed
  players come back at the start of the next stage.
- **failed**: no human player is alive. A disconnected player counts as down.
- Co-op does **not** touch saga progress, gold stars or `reportRun`.

## 4. Revive
- A player at 0 HP is **down**. Their plane is hidden and an SOS beacon floats where they fell,
  clamped into the playfield, visible to both. The downed player's screen shows a spectator overlay
  ("Waiting for rescue") and their controls are disabled.
- The teammate revives them by hovering within 1.8 units of the beacon for 2.5 s of real time (a
  progress ring). The client then sends `REVIVE {id}`.
- The server accepts when the target is down, the sender is alive, and the phase is `playing` or
  `boss`. It then broadcasts `PLAYER {id, alive: true, hp: 2, revived: true, x, y}`. The revived
  client respawns at the beacon with 2 s of invulnerability.
- Revives are unlimited. Both down at the same moment → `failed`.
- **Reconnect**: rejoining the same match (same game player id) is allowed during the run. The player
  gets a SNAPSHOT and is down until revived or until the next stage.

## 5. Server authority (Lua)
Same responsibilities as today's `LoopbackServer`, with two changes so the server never needs positions:

- `AIMED {id, target}`: the server schedules volleys (fireInterval, random phase from `math.random`)
  and picks the target player, the nearest living one by reported POS. Each client computes the angle
  from its own enemy position. A client also drops the shot if that enemy is outside the fire zone.
- `DROP {id, type, enemy, t}`: rolled with the same rules as `dropRules.ts`, ported to Lua with the
  power-up and shield caps per stage. Clients place it at `scriptedPos(enemy, t)`.
- **Hit validation**: the target is alive and within `[enterT − 0.2, despawnT + 0.5]`, or is the boss
  during `boss`. Per player, damage over a rolling 1 s window is capped at `maxDps × 1.5`.
- **Team stats**: kills, team score (enemy score + boss 5000 + rescue 300) and run time. They ride on
  STATES (`team: {score, kills}`), so the co-op HUD shows the team score and it matches what gets ranked.
- **Pickups**: first come, first served, as today (PICKED).
- Tick rate 20 Hz. STATES every tick. ENEMY_HP batched per tick. PING → PONG with `nk.time()`.
- Match label: `{"game":"skystriker","open":0|1,"public":0|1,"code":"ABCDE"}`. `open` = lobby with a free slot.

## 6. Lobby, rooms and identity
**RPCs**
- `skystriker_create_match {}` → `{matchId, code}`: a private room. The code is 5 chars from
  `ABCDEFGHJKMNPQRSTUVWXYZ23456789`.
- `skystriker_join_code {code}` → `{matchId}` via `nk.match_list` with `+label.code:<code>`. Listing
  fans out across cluster nodes.
- `skystriker_find_match {}` → `{matchId}`: an open public room, or a new public one.

**Identity**: co-op requires a game login (the NestJS session). The client calls
`authenticateCustom("ss-<playerId>")`, then `joinMatch(matchId, undefined, {token, plane, dataVersion})`.
`match_join_attempt` calls `GET ${SKYSTRIKER_API_URL}/api/me` with `Authorization: Bearer <token>`
(`nk.http_request`). It accepts only a 200 whose `user.id` matches the `ss-` id. The verified
`{id, name}` is kept in match state. It rejects a bad token, a full room, a wrong data version, and a
non-member once the run has started.

**Client config**: `VITE_NAKAMA_HOST` (default `nakama.zingplay.dev`), `VITE_NAKAMA_PORT` (`443`),
`VITE_NAKAMA_SSL` (`true`), `VITE_NAKAMA_KEY` (`defaultkey`).

**UI**
- The main menu gets a CO-OP button. Logged out, it prompts to log in.
- The `coopLobby` screen has Quick match / Create room / Enter code.
- In a room: the code (tap to copy), two slots (name + plane), READY and Leave.
- The plane is the one chosen in the hangar.
- Errors (refused, node gone, version mismatch) show inline and return to the lobby menu.

## 7. Leaderboards
Created at module load (`nk.leaderboard_create`, authoritative, sort `desc`, operator `best`, no reset):

| Id | score | subscore | Meaning |
|----|-------|----------|---------|
| `skystriker_coop_stage` | stages cleared (0–10) | `10^9 − runSeconds` | Furthest stage; ties → faster |
| `skystriker_coop_kills` | team kills | stages cleared | Most kills |
| `skystriker_coop_score` | team score | stages cleared | Highest team score |

- **Owner** = the pair. A UUID is formatted from `nk.md5_hash` of the two sorted game player ids.
  Username is `"A & B"`. Metadata holds `{players:[{id,name,plane}], stages, kills, score, timeMs}`.
- **When written**: when the run ends (`complete`, `failed`, or everyone left after stage 1 started).
  A player left alone still records the pair.
- **Per-player pair list**: storage collection `skystriker`, key `pairs`, owner = the Nakama user,
  server-write only.
- **Reading**: RPC `skystriker_leaderboard {board, limit?}` returns
  `{rows:[{rank, names, score, subscore, metadata}], me:{rank, ...}|null}`. `me` is the best of my
  pairs on that board.
- **Client**: the Leaderboard screen gets a Solo / Co-op switch. Co-op has the three criteria tabs.

## 8. Protocol changes (`src/net/coop/protocol.ts`)
- New client op `REVIVE = 9` `{id}`.
- `Phase` adds `stageClear` and `complete`. `victory` is no longer used by the co-op server.
- `PHASE` gains `stageIndex`, `stages` (10) and `team?`.
- `STATES` gains `team: {score, kills}`.
- `AIMED` is `{id, target}`.
- `DROP` is `{id, type, enemy, t}`.
- `PLAYER` gains `revived?`, `x?`, `y?`.
- `READY` gains `dataVersion`.
- `SNAPSHOT` gains `stageIndex`, `team` and per-player `down`.

The loopback server and the tests move to the new shapes. `LoopbackServer` keeps acting as the
reference implementation of the Lua handler: same phases, same rules, same messages.

## 9. Client changes (co-op branches only)
- **`CoopSession`**: multi-stage. A new PHASE with `countdown` restarts the run for that stage
  (detach/attach the driver per stage). `complete` and `failed` end it. It exposes team stats and the
  run summary.
- **Store**:
  - `damagePlayer` in co-op at 0 HP → `down` (flag), not `finalizeResults`.
  - Stage end in co-op → no results screen; the session handles the transition.
  - New game states `coopLobby` and `coopResults`.
- **Components**:
  - `Enemies` aims AIMED shots at the given target's current position (self exact, teammate
    interpolated).
  - `Pickups` places DROPs from `scriptedPos`.
  - New `ReviveBeacon` (beacon + progress ring + REVIVE).
  - Spectator overlay.
  - HUD team score in co-op.
  - `CoopLobby`, `CoopResults` (stages, kills, score, time, ranks on the three boards).
- **`src/net/coop/active.ts`**: starts the Nakama session from the lobby. `?coop=loopback` still
  starts a loopback run with a bot.

## 10. Testing
- **Vitest**:
  - Protocol shapes.
  - Generator determinism and version hash.
  - Loopback multi-stage flow: stage → stageClear → next stage, revive accepted/rejected, both down
    → failed, last stage → complete, data-version mismatch refused.
  - Drop caps.
- **Nakama**:
  - Run a local single node via docker compose with `modules/` mounted.
  - `scripts/coop-smoke.mjs` (nakama-js, 2 clients) covers create → join by code → READY →
    countdown → hits kill an enemy → GOT_HIT to 0 → REVIVE → failed → leaderboard row written.
  - `SKYSTRIKER_API_URL` points at a stub that answers `/api/me`.
- **Manual**: two browser tabs against the local Nakama + dev server.

## Out of scope
More than 2 players. Chat. Co-op rewards to saga or gold stars. Restoring a room after its pod dies
(clients return to the lobby, per the cluster's recreate policy). A spectator camera beyond the overlay.

## Implementation notes
Decided while planning and kept in the build:
- **Lua source of truth:** `sky-striker/nakama/modules/*.lua`, tested next to the TS reference (one conformance
  suite drives both `LoopbackServer` and the Lua match). `npm run nakama:install` copies the files into
  `nakama-cluster/modules/`.
- **AIMED target:** a random living player. The server has no enemy positions, so "nearest" is impossible;
  each client computes the angle itself.
- **Rule constants** (countdown, stage-clear time, revive HP, DPS cap, drop odds, game speed) are written into
  the generated data as `rules`. Lua reads them from there, so TS stays the single source.
- **Rejoin:** a member re-entering a running match gets a SNAPSHOT right on join (no READY needed). The last
  room code is kept in `sessionStorage` for a REJOIN button.
