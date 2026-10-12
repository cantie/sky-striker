# Co-op on Nakama Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two-player co-op through the whole campaign (stage 1 → 10, ends on full clear or both down). The server is an authoritative Nakama Lua match with revives and three co-op leaderboards.

**Architecture:** The client keeps the deterministic sim from the co-op foundation. A generated Lua data module (from `stageScript()`) tells the server which enemies exist and when, so the server never needs path math. `LoopbackServer` (TS) is the reference implementation of the rules. The Lua match passes the same conformance suite, run inside vitest through fengari (Lua 5.3 in JS). Lua sources live in `sky-striker/nakama/modules/` and are installed into `nakama-cluster/modules/`.

**Tech Stack:** TypeScript, React 19, zustand, Vite 7, Vitest 5, @heroiclabs/nakama-js 2.8, Nakama 3.37 Lua runtime (gopher-lua = Lua 5.1), fengari 0.1.5 (dev only).

**Spec:** `docs/superpowers/specs/2026-10-12-coop-nakama-design.md`

## Global Constraints

- Single-player behaviour must not change. Every new store/gameplay branch is gated on `mode === 'coop'`, `net()` or `activeSession()`.
- Lua must run on **both** gopher-lua (5.1) and fengari (5.3):
  - Banned: `//`, bit ops, `goto`, `unpack` without fallback, `math.pow`, `loadstring`, `table.getn`, `string.format('%d', nonInteger)`.
  - Use `math.floor` before `%d`.
- Nakama Lua JSON encodes an empty table as `{}`, so the client must read every server array through `list()` (Task 3).
- Lua RPC ids are prefixed `skystriker_`, the match module is named `skystriker_coop`, and leaderboard ids are `skystriker_coop_stage`, `skystriker_coop_kills`, `skystriker_coop_score`.
- Nakama custom id is `skystriker-<playerId>` (Nakama requires 6–128 chars).
- Match label: `{"game":"skystriker","open":0|1,"public":0|1,"code":"<lowercase code>"}`. Codes are shown uppercase and are 5 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`.
- Client env: `VITE_NAKAMA_HOST` (default `nakama.zingplay.dev`), `VITE_NAKAMA_PORT` (`443`), `VITE_NAKAMA_SSL` (`true`), `VITE_NAKAMA_KEY` (`defaultkey`). Nakama runtime env: `SKYSTRIKER_API_URL`.
- Line endings:
  - Use the Edit/Write tools.
  - New files are LF.
  - `src/components/game/GameScene.tsx` stays CRLF.
  - Check `git diff --stat` for suspiciously large diffs before each commit.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Push only when the user asks.
- Repos and branches:
  - sky-striker: branch `feat/coop-nakama` (exists).
  - nakama-cluster: branch `feat/skystriker-coop`, created in Task 12.

## Deviations from the spec (decided while planning)

- **Lua source of truth:** `sky-striker/nakama/modules/*.lua`, so it is tested next to the TS reference. `npm run nakama:install` copies it into `nakama-cluster/modules/`.
- **AIMED target:** a random living player. The server has no enemy positions, so "nearest" is impossible.
- **Rule constants** (countdown, stage-clear time, revive HP, DPS cap, drop odds, game speed) are written into the generated data as `rules`. Lua reads them from there, so TS stays the single source.
- **Rejoin:** a member re-entering a running match gets a SNAPSHOT right on join (no READY needed). The last room code is kept in `sessionStorage` for a REJOIN button.

## Review Focus

- A teammate disconnecting mid-run: the remaining player keeps playing. The run ends as `failed` only when nobody connected is alive, and the leaderboard is still written for the pair. (Task 4 test `leaving mid-run counts as down…`)
- Empty JSON arrays from Nakama arrive as `{}`: the session must not crash on `dead`, `taken`, `pickups`, `players`, `hits` or leaderboard `rows`. (Task 3 test `list()…`, Task 6 test `snapshot with {} arrays`)
- A client still in the boss fight when the next stage's countdown arrives (lag) must start the new stage cleanly: Enemies' wave queue and clock reset per run. (Task 7 test via the `runKey` reset, plus the manual playtest in Task 13)
- The data version must match between client bundle and server. A stale server must refuse with a readable message, not desync. (Task 5 test `wrong data version is refused`, Task 1 staleness test)
- A downed player's invisible plane must not absorb bullets, collect pickups, ram enemies or move. (Task 7 store tests, plus guards in Bullets/Enemies/Pickups/Player)

---

## File map

**sky-striker (new)**
- `src/game/scoring.ts`: score constants shared by effects and co-op data.
- `src/net/coop/coopData.ts`: `CoopData` types, `buildCoopData()`, `coopData()`, `toLua()`, `scriptedPickupKind()`.
- `src/net/coop/coopData.test.ts`
- `src/net/coop/serverConformance.ts`: `ServerDriver`, `testData()`, `conformance()` suite shared by loopback and Lua.
- `src/net/coop/loopback.conformance.test.ts`
- `src/net/coop/coopError.ts`: last co-op error for the lobby.
- `src/net/coop/nakamaClient.ts`: Nakama config, custom auth, RPC helper.
- `src/net/coop/coopApi.ts`: co-op leaderboard RPC wrapper.
- `src/store/gameStore.coop.test.ts`
- `src/components/game/ReviveBeacon.tsx`
- `src/components/ui/useCoop.ts`: polling hook for session status.
- `src/components/ui/CoopLobby.tsx`, `CoopStageClear.tsx`, `CoopResults.tsx`
- `nakama/modules/skystriker_coop.lua`: match handler, RPCs, leaderboards.
- `nakama/modules/skystriker_data.lua`: GENERATED.
- `nakama/test/json.lua`, `nk_mock.lua`, `harness.lua`, `luaMatch.ts`, `fengari.d.ts`
- `nakama/test/data.test.ts`, `lua.conformance.test.ts`, `lua.nakama.test.ts`
- `scripts/gen-coop-data.mjs`, `scripts/nakama-install.mjs`

**sky-striker (modified)**
- `src/game/dropRules.ts`: export `DROP_CHANCE`, `DROP_WEIGHTS`.
- `src/game/sim/stageScript.ts`: `scriptById()`.
- `src/components/game/effects.ts`: use `scoring.ts`.
- `src/net/coop/protocol.ts`, `transport.ts`, `loopbackServer.ts`, `coopSession.ts`, `storeWorld.ts`, `nakamaTransport.ts`, `active.ts`, `coop.test.ts`
- `src/store/gameStore.ts`
- `src/components/game/Enemies.tsx`, `Player.tsx`, `Pickups.tsx`, `Bullets.tsx`, `GameScene.tsx`
- `src/components/ui/UI.tsx`, `HUD.tsx`, `MainMenu.tsx`, `Leaderboard.tsx`, `CoopBadge.tsx`
- `vitest.config.ts`, `package.json`

**nakama-cluster (modified, Task 12)**
- `modules/skystriker_coop.lua`, `modules/skystriker_data.lua` (copied)
- `config/node{1,2,3}-config.yml` (runtime env)
- `deploy/helm/nakama-cluster/templates/nakama-configmap.yaml`, `values.yaml`
- `docs/skystriker-coop.md`

---

### Task 1: Co-op data module and generator

**Files:**
- Create: `src/game/scoring.ts`, `src/net/coop/coopData.ts`, `src/net/coop/coopData.test.ts`, `scripts/gen-coop-data.mjs`, `nakama/modules/skystriker_data.lua` (generated)
- Modify: `src/game/dropRules.ts`, `src/game/sim/stageScript.ts`, `src/components/game/effects.ts`, `package.json`

**Interfaces:**
- Produces:
  - `CoopEnemy`, `CoopStage`, `CoopRules`, `CoopData` types.
  - `buildCoopData(stages?)`, `coopData()` (memoized), `toLua(data)`, `maxDps()`, `scriptedPickupKind(id, waves)`.
  - `scriptById(stageId): Map<string, ScriptedEnemy>`.
  - `BOSS_SCORE`, `RESCUE_SCORE`, `POD_SCORE`, plus `DROP_CHANCE` and `DROP_WEIGHTS` from dropRules.
  - The rule constants exported from `coopData.ts`: `COUNTDOWN_MS`, `BOSS_WARNING_MS`, `STAGE_CLEAR_MS`, `BOSS_TARGET_SWAP_MS`, `REVIVE_HP`, `REVIVE_RADIUS`, `REVIVE_SECONDS`, `DPS_CAP_MULT`.

- [ ] **Step 1: Score constants + exported drop odds**

Create `src/game/scoring.ts`:
```ts
/** Points that are not per-enemy (enemy scores live in ROLE_STATS). Shared by play and the co-op server data. */
export const BOSS_SCORE = 5000
export const RESCUE_SCORE = 300
export const POD_SCORE = 50
```
In `src/components/game/effects.ts`, import `{ BOSS_SCORE, POD_SCORE, RESCUE_SCORE } from '../../game/scoring'` and replace the literals: `s.addScore(5000)` → `s.addScore(BOSS_SCORE)`, `s.addScore(300)` → `s.addScore(RESCUE_SCORE)`, `s.addScore(50)` → `s.addScore(POD_SCORE)`.

In `src/game/dropRules.ts`, change `const DROP_CHANCE = 0.12` to `export const DROP_CHANCE = 0.12`. Add below it:
```ts
/** Relative odds among the drops that are currently allowed. */
export const DROP_WEIGHTS = { health: 0.3, powerup: 0.45, shield: 0.25 }
```
In `pickDrop` replace the literal weights with `DROP_WEIGHTS.health`, `DROP_WEIGHTS.powerup` and `DROP_WEIGHTS.shield`.

- [ ] **Step 2: `scriptById` in stageScript.ts**

Append to `src/game/sim/stageScript.ts` (also add `import { getStage } from '../stages'`):
```ts
const byStage = new Map<number, Map<string, ScriptedEnemy>>()

/** The stage script indexed by enemy id (memoized) — where a server-named enemy is at a given time. */
export function scriptById(stageId: number): Map<string, ScriptedEnemy> {
  let m = byStage.get(stageId)
  if (!m) {
    m = new Map(stageScript(getStage(stageId)).map((e) => [e.id, e]))
    byStage.set(stageId, m)
  }
  return m
}
```

- [ ] **Step 3: Write the failing test** `src/net/coop/coopData.test.ts`
```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { STAGES } from '../../game/stages'
import { stageScript } from '../../game/sim/stageScript'
import { getPlane } from '../../game/planes'
import { weaponStats } from '../../game/weapon'
import { buildCoopData, maxDps, scriptedPickupKind, toLua } from './coopData'

describe('co-op data', () => {
  const data = buildCoopData()

  it('mirrors the stage scripts', () => {
    expect(data.stages.map((s) => s.id)).toEqual(STAGES.map((s) => s.id))
    const s1 = stageScript(STAGES[0])
    expect(data.stages[0].enemies.map((e) => e.id)).toEqual(s1.map((e) => e.id))
    expect(data.stages[0].enemies[0].hp).toBe(s1[0].hp)
    expect(data.stages[0].bossHp).toBe(STAGES[0].bossHp)
    expect(data.stages[0].waves).toBe(STAGES[0].maxWaves)
  })

  it('is deterministic and versioned by content', () => {
    expect(buildCoopData()).toEqual(data)
    expect(data.version).toMatch(/^[0-9a-f]{8}$/)
    const tweaked = buildCoopData(STAGES.map((s, i) => (i === 0 ? { ...s, bossHp: s.bossHp + 1 } : s)))
    expect(tweaked.version).not.toBe(data.version)
  })

  it('caps damage above any honest plane', () => {
    const w = weaponStats(0)
    const hawk = (w.damage * w.streams.length * getPlane('hawk').damage * 1000) / w.interval
    expect(maxDps()).toBeGreaterThan(hawk)
  })

  it('knows which scripted pickups exist', () => {
    expect(scriptedPickupKind('rescue:start0', 20)).toBe('rescue')
    expect(scriptedPickupKind('rescue:w4', 20)).toBe('rescue')
    expect(scriptedPickupKind('rescue:w5', 20)).toBeNull()
    expect(scriptedPickupKind('rescue:w22', 20)).toBeNull()
    expect(scriptedPickupKind('pod:w8', 20)).toBe('star')
    expect(scriptedPickupKind('pod:w0', 20)).toBeNull()
    expect(scriptedPickupKind('d3', 20)).toBeNull()
  })

  it('emits a Lua chunk', () => {
    const lua = toLua(data)
    expect(lua.startsWith('-- GENERATED')).toBe(true)
    expect(lua).toContain(`version="${data.version}"`)
    expect(lua).toContain('enemies={')
    expect(lua).not.toContain('enterT=nil')
  })

  it('the committed Lua data is up to date (run `npm run gen:coop` after changing stages)', () => {
    const file = readFileSync('nakama/modules/skystriker_data.lua', 'utf8')
    expect(file).toContain(`version="${data.version}"`)
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/net/coop/coopData.test.ts`
Expected: FAIL. `./coopData` cannot be resolved.

- [ ] **Step 5: Implement** `src/net/coop/coopData.ts`
```ts
import { STAGES, type StageConfig } from '../../game/stages'
import { PLANES } from '../../game/planes'
import { MAX_WEAPON_POWER, weaponStats } from '../../game/weapon'
import { GAME_SPEED } from '../../game/speed'
import { DROP_CHANCE, DROP_WEIGHTS, MAX_POWERUPS, MAX_SHIELDS } from '../../game/dropRules'
import { BOSS_SCORE, POD_SCORE, RESCUE_SCORE } from '../../game/scoring'
import { hashSeed } from '../../game/sim/rng'
import { stageScript, type ScriptedEnemy } from '../../game/sim/stageScript'
import type { ShotKind } from '../../game/roster'
import type { PickupType } from '../../store/gameStore'

/**
 * What the co-op server needs to know about the campaign, flattened from the stage configs:
 * which enemies exist, when they are on screen, their HP and score, how they shoot — plus the
 * rule constants. Generated into nakama/modules/skystriker_data.lua (`npm run gen:coop`); the
 * client sends `version` when joining so a stale server refuses instead of desyncing.
 */
export interface CoopEnemy {
  id: string
  wave: number
  spawnT: number
  /** null = never enters the world (can't be hit). */
  enterT: number | null
  despawnT: number
  hp: number
  score: number
  shot: ShotKind
  fireInterval: number
}
export interface CoopStage { id: number; bossHp: number; waves: number; enemies: CoopEnemy[] }
export interface CoopRules {
  gameSpeed: number
  countdownMs: number
  bossWarningMs: number
  stageClearMs: number
  bossTargetSwapMs: number
  reviveHp: number
  reviveRadius: number
  dpsCapMult: number
  dropChance: number
  dropWeights: { health: number; powerup: number; shield: number }
  maxPowerups: number
  maxShields: number
}
export interface CoopData {
  version: string
  /** Strongest cannon on the best plane, damage per game-second. */
  maxDps: number
  bossScore: number
  rescueScore: number
  podScore: number
  rules: CoopRules
  stages: CoopStage[]
}

export const COUNTDOWN_MS = 3000
export const BOSS_WARNING_MS = 2200
/** Victory window (5 s) + fly-out + the stage-clear card. */
export const STAGE_CLEAR_MS = 7000
export const BOSS_TARGET_SWAP_MS = 6000
export const REVIVE_HP = 2
export const REVIVE_RADIUS = 1.8
export const REVIVE_SECONDS = 2.5
/** Allowed damage per player = maxDps × this (skills, pierce and wingmen stay well inside). */
export const DPS_CAP_MULT = 3

export const RULES: CoopRules = {
  gameSpeed: GAME_SPEED,
  countdownMs: COUNTDOWN_MS,
  bossWarningMs: BOSS_WARNING_MS,
  stageClearMs: STAGE_CLEAR_MS,
  bossTargetSwapMs: BOSS_TARGET_SWAP_MS,
  reviveHp: REVIVE_HP,
  reviveRadius: REVIVE_RADIUS,
  dpsCapMult: DPS_CAP_MULT,
  dropChance: DROP_CHANCE,
  dropWeights: DROP_WEIGHTS,
  maxPowerups: MAX_POWERUPS,
  maxShields: MAX_SHIELDS,
}

const r4 = (n: number) => Math.round(n * 1e4) / 1e4

export function maxDps(): number {
  const w = weaponStats(MAX_WEAPON_POWER)
  const best = Math.max(...PLANES.map((p) => p.damage / p.fireRate))
  return (w.damage * w.streams.length * best * 1000) / w.interval
}

const toCoopEnemy = (e: ScriptedEnemy): CoopEnemy => ({
  id: e.id, wave: e.wave, spawnT: r4(e.spawnT), enterT: e.enterT === null ? null : r4(e.enterT),
  despawnT: r4(e.despawnT), hp: e.hp, score: e.score, shot: e.shot, fireInterval: r4(e.fireInterval),
})

export function buildCoopData(stages: StageConfig[] = STAGES): CoopData {
  const body = {
    maxDps: r4(maxDps()),
    bossScore: BOSS_SCORE,
    rescueScore: RESCUE_SCORE,
    podScore: POD_SCORE,
    rules: RULES,
    stages: stages.map((s) => ({ id: s.id, bossHp: s.bossHp || 1000, waves: s.maxWaves, enemies: stageScript(s).map(toCoopEnemy) })),
  }
  return { version: hashSeed(0, JSON.stringify(body)).toString(16).padStart(8, '0'), ...body }
}

let cached: CoopData | null = null
/** The campaign's co-op data (built once, ~1.7k enemies). */
export const coopData = (): CoopData => (cached ??= buildCoopData())

/** Survivors / star pods the Enemies system spawns on its own, by id (see Enemies.tsx). */
export function scriptedPickupKind(id: string, waves: number): PickupType | null {
  if (id === 'rescue:start0' || id === 'rescue:start1') return 'rescue'
  let m = /^rescue:w(\d+)$/.exec(id)
  if (m) { const k = Number(m[1]); return k < waves && k % 3 === 1 ? 'rescue' : null }
  m = /^pod:w(\d+)$/.exec(id)
  if (m) { const k = Number(m[1]); return k < waves && k > 0 && k % 4 === 0 ? 'star' : null }
  return null
}

function luaValue(v: unknown): string {
  if (v === null || v === undefined) return 'nil'
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (typeof v === 'string') return JSON.stringify(v)
  if (Array.isArray(v)) return `{${v.map(luaValue).join(',')}}`
  return `{${fields(v as Record<string, unknown>)}}`
}
const fields = (o: Record<string, unknown>) =>
  Object.entries(o).filter(([, x]) => x !== null && x !== undefined).map(([k, x]) => `${k}=${luaValue(x)}`).join(',')

/** The data as a Lua module (`return {...}`), one enemy per line. */
export function toLua(data: CoopData): string {
  const { stages, ...top } = data
  const stageLua = stages.map(({ enemies, ...s }) =>
    `  {${fields(s)},enemies={\n${enemies.map((e) => `    ${luaValue(e)}`).join(',\n')}\n  }}`)
  return [
    '-- GENERATED by sky-striker `npm run gen:coop` from the game\'s stage configs. Do not edit.',
    `-- Data version ${data.version}: clients built from other stage data are refused.`,
    `return {${fields(top)},stages={`,
    stageLua.join(',\n'),
    '}}',
    '',
  ].join('\n')
}
```

- [ ] **Step 6: Generator script** `scripts/gen-coop-data.mjs`
```js
// Writes the co-op server's stage data (Lua) from the game's own stage configs.
//   npm run gen:coop [-- <out.lua>]   (default nakama/modules/skystriker_data.lua)
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createServer } from 'vite'

const out = resolve(process.argv[2] ?? 'nakama/modules/skystriker_data.lua')
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
try {
  const m = await vite.ssrLoadModule('/src/net/coop/coopData.ts')
  const data = m.buildCoopData()
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, m.toLua(data))
  const enemies = data.stages.reduce((n, s) => n + s.enemies.length, 0)
  console.log(`wrote ${out} · version ${data.version} · ${data.stages.length} stages · ${enemies} enemies`)
} finally {
  await vite.close()
}
```
In `package.json` "scripts" add:
```json
"gen:coop": "node scripts/gen-coop-data.mjs",
"nakama:install": "node scripts/nakama-install.mjs",
```

- [ ] **Step 7: Generate and run the tests**

Run: `npm run gen:coop`
Expected: `wrote …skystriker_data.lua · version xxxxxxxx · 10 stages · 1734 enemies`

Run: `npx vitest run src/net/coop/coopData.test.ts src/game/sim/sim.test.ts`
Expected: all PASS.

- [ ] **Step 8: Commit**
```bash
git add src/game/scoring.ts src/game/dropRules.ts src/game/sim/stageScript.ts src/components/game/effects.ts src/net/coop/coopData.ts src/net/coop/coopData.test.ts scripts/gen-coop-data.mjs nakama/modules/skystriker_data.lua package.json
git commit -m "Co-op server data: generated Lua stage script + rules from the game configs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Lua test harness (fengari + mock nakama)

**Files:**
- Create: `nakama/test/json.lua`, `nakama/test/nk_mock.lua`, `nakama/test/harness.lua`, `nakama/test/luaMatch.ts`, `nakama/test/fengari.d.ts`, `nakama/test/data.test.ts`
- Modify: `vitest.config.ts`, `package.json` (devDependency `fengari`)

**Interfaces:**
- Consumes: `CoopData`, `toLua`, `buildCoopData` (Task 1).
- Produces:
  ```ts
  class LuaMatch {
    constructor(opts?: { data?: CoopData })
    setTime(ms: number): void
    setUsers(users: Record<string, { id: number; name: string }>): void
    setEnv(env: Record<string, string>): void
    rpc<T = any>(id: string, userId: string, payload: unknown): T
    init(params: Record<string, unknown>, matchId?: string): void
    join(p: Presence, meta: Record<string, string>): { ok: boolean; reason?: string }
    leave(p: Presence): void
    loop(msgs: { from: Presence; op: number; data: unknown }[]): Sent[]
    dataSummary(): { version: string; stages: number; enemies: number; maxDps: number }
    dump(): { matches: Record<string, { label: string; size: number }>; boards: Record<string, LbRecord[]>; storage: StorageObj[] }
    ended(): boolean
  }
  interface Presence { user_id: string; session_id: string; username: string; node: string }
  interface Sent { op: number; data: any; to: string[] | null }
  ```
  `presence(id)` returns a Presence.

- [ ] **Step 1: Install fengari**

Run: `npm install -D fengari@0.1.5`
Expected: added to devDependencies.

- [ ] **Step 2: `nakama/test/fengari.d.ts`**
```ts
declare module 'fengari' {
  const fengari: {
    lua: any
    lauxlib: any
    lualib: any
    to_luastring(s: string): Uint8Array
    to_jsstring(s: Uint8Array): string
  }
  export default fengari
}
```

- [ ] **Step 3: `nakama/test/json.lua`**: a small JSON library that, like Nakama, encodes an empty table as `{}`
```lua
-- Minimal JSON for the test mock of the nakama module. Like Nakama's Lua runtime, an empty
-- table encodes as {} (the client must cope with that), arrays are 1..n tables, nil is null.
local json = {}

local function kind(t)
  local n = 0
  for _ in pairs(t) do n = n + 1 end
  if n == 0 then return "object" end
  for i = 1, n do if t[i] == nil then return "object" end end
  return "array"
end

local escapes = { ['"'] = '\\"', ["\\"] = "\\\\", ["\b"] = "\\b", ["\f"] = "\\f", ["\n"] = "\\n", ["\r"] = "\\r", ["\t"] = "\\t" }

local function encode(v)
  local t = type(v)
  if v == nil then return "null"
  elseif t == "boolean" then return v and "true" or "false"
  elseif t == "number" then
    if v ~= v or v == math.huge or v == -math.huge then return "null" end
    if v == math.floor(v) and math.abs(v) < 1e15 then return string.format("%d", math.floor(v)) end
    return string.format("%.14g", v)
  elseif t == "string" then
    return '"' .. v:gsub('[%c"\\]', function(c) return escapes[c] or string.format("\\u%04x", c:byte()) end) .. '"'
  elseif t == "table" then
    local parts = {}
    if kind(v) == "array" then
      for i = 1, #v do parts[i] = encode(v[i]) end
      return "[" .. table.concat(parts, ",") .. "]"
    end
    for k, x in pairs(v) do parts[#parts + 1] = encode(tostring(k)) .. ":" .. encode(x) end
    table.sort(parts)
    return "{" .. table.concat(parts, ",") .. "}"
  end
  error("cannot encode " .. t)
end
json.encode = encode

function json.decode(s)
  local pos = 1
  local function ws() pos = s:find("[^ \t\r\n]", pos) or (#s + 1) end
  local value
  local function str()
    local out, i = {}, pos + 1
    while true do
      local c = s:sub(i, i)
      if c == '"' then pos = i + 1 return table.concat(out) end
      if c == "\\" then
        local e = s:sub(i + 1, i + 1)
        local map = { b = "\b", f = "\f", n = "\n", r = "\r", t = "\t" }
        if e == "u" then out[#out + 1] = string.char(tonumber(s:sub(i + 2, i + 5), 16) % 256) i = i + 6
        else out[#out + 1] = map[e] or e i = i + 2 end
      elseif c == "" then error("unterminated string")
      else out[#out + 1] = c i = i + 1 end
    end
  end
  function value()
    ws()
    local c = s:sub(pos, pos)
    if c == "{" then
      local t = {}
      pos = pos + 1 ws()
      if s:sub(pos, pos) == "}" then pos = pos + 1 return t end
      while true do
        ws() local k = str() ws()
        pos = pos + 1 -- :
        t[k] = value() ws()
        local d = s:sub(pos, pos) pos = pos + 1
        if d == "}" then return t end
      end
    elseif c == "[" then
      local t = {}
      pos = pos + 1 ws()
      if s:sub(pos, pos) == "]" then pos = pos + 1 return t end
      while true do
        t[#t + 1] = value() ws()
        local d = s:sub(pos, pos) pos = pos + 1
        if d == "]" then return t end
      end
    elseif c == '"' then return str()
    elseif s:sub(pos, pos + 3) == "true" then pos = pos + 4 return true
    elseif s:sub(pos, pos + 4) == "false" then pos = pos + 5 return false
    elseif s:sub(pos, pos + 3) == "null" then pos = pos + 4 return nil
    else
      local num = s:match("^-?%d+%.?%d*[eE]?[-+]?%d*", pos)
      pos = pos + #num
      return tonumber(num)
    end
  end
  return value()
end

return json
```

- [ ] **Step 4: `nakama/test/nk_mock.lua`**: just enough of the `nakama` module for skystriker_coop.lua
```lua
-- Test double for Nakama's Lua `nakama` module: deterministic time, an in-memory match list,
-- leaderboards (operator "best", desc) and storage, and an HTTP stub for /api/me.
local json = require("json")
local nk = { now = 0, users = {}, rpcs = {}, matches = {}, boards = {}, storage = {}, logs = {}, next_match = 0, next_uuid = 0 }

nk.json_encode = json.encode
nk.json_decode = json.decode
function nk.time() return nk.now end
for _, lvl in ipairs({ "debug", "info", "warn", "error" }) do
  nk["logger_" .. lvl] = function(msg) nk.logs[#nk.logs + 1] = lvl .. ": " .. tostring(msg) end
end
function nk.register_rpc(fn, id) nk.rpcs[id] = fn end

function nk.match_create(module, params)
  nk.next_match = nk.next_match + 1
  local id = "m" .. nk.next_match .. ".node1"
  nk.matches[id] = { module = module, params = params, label = "", size = 0 }
  nk.last_match = id
  return id
end

-- Supports the query shapes the module uses: "+label.<field>:<value>" and "+label.<field>:>=<n>"
local function label_matches(label, query)
  local ok, l = pcall(json.decode, label)
  if not ok or type(l) ~= "table" then return false end
  for field, op, value in query:gmatch("%+label%.([%w_]+):(>?=?)([^%s]+)") do
    local v = l[field]
    if op == ">=" then
      if type(v) ~= "number" or v < tonumber(value) then return false end
    elseif tostring(v) ~= value then return false end
  end
  return true
end

function nk.match_list(limit, authoritative, label, min_size, max_size, query)
  local out = {}
  local ids = {}
  for id in pairs(nk.matches) do ids[#ids + 1] = id end
  table.sort(ids)
  for _, id in ipairs(ids) do
    local m = nk.matches[id]
    if not m.ended and m.size >= (min_size or 0) and m.size <= (max_size or 100) and (not query or label_matches(m.label, query)) then
      out[#out + 1] = { match_id = id, authoritative = true, label = m.label, size = m.size, tick_rate = 20, handler_name = m.module }
      if #out >= limit then break end
    end
  end
  return out
end

function nk.leaderboard_create(id, authoritative, sort, operator, reset, metadata, enable_ranks)
  nk.boards[id] = nk.boards[id] or { sort = sort, operator = operator, records = {} }
end

local function better(a, b) return a.score > b.score or (a.score == b.score and a.subscore > b.subscore) end

function nk.leaderboard_record_write(id, owner, username, score, subscore, metadata)
  assert(math.floor(score) == score and math.floor(subscore or 0) == (subscore or 0), "scores must be integers")
  local b = assert(nk.boards[id], "no leaderboard " .. id)
  local rec = { leaderboard_id = id, owner_id = owner, username = username, score = score, subscore = subscore or 0, metadata = metadata }
  local old = b.records[owner]
  if not old or better(rec, old) then b.records[owner] = rec end
  return b.records[owner]
end

function nk.leaderboard_records_list(id, owners, limit, cursor, expiry)
  local b = assert(nk.boards[id], "no leaderboard " .. id)
  local all = {}
  for _, r in pairs(b.records) do all[#all + 1] = r end
  table.sort(all, function(a, c) if better(a, c) then return true end if better(c, a) then return false end return a.owner_id < c.owner_id end)
  local records, owner_records, want = {}, {}, {}
  for _, o in ipairs(owners or {}) do want[o] = true end
  for i, r in ipairs(all) do
    local copy = {}
    for k, v in pairs(r) do copy[k] = v end
    copy.rank = i
    if i <= limit then records[#records + 1] = copy end
    if want[r.owner_id] then owner_records[#owner_records + 1] = copy end
  end
  return records, owner_records, nil, nil
end

local function skey(o) return o.collection .. "/" .. o.key .. "/" .. (o.user_id or "") end
function nk.storage_read(list)
  local out = {}
  for _, q in ipairs(list) do
    local o = nk.storage[skey(q)]
    if o then out[#out + 1] = o end
  end
  return out
end
function nk.storage_write(list)
  for _, o in ipairs(list) do nk.storage[skey(o)] = o end
end

function nk.http_request(url, method, headers, content, timeout)
  local token = headers and headers.Authorization and headers.Authorization:match("^Bearer (.+)$")
  local user = token and nk.users[token]
  if url:match("/api/me$") and user then
    return 200, {}, json.encode({ user = user, progress = {} })
  end
  return 401, {}, '{"message":"Unauthorized"}'
end

-- Not MD5, but stable 32 hex chars, which is all the module relies on
function nk.md5_hash(s)
  local out = {}
  for round = 1, 4 do
    local h = 2166136261 + round
    for i = 1, #s do h = (h * 16777619 + s:byte(i) * round) % 4294967296 end
    out[round] = string.format("%08x", math.floor(h))
  end
  return table.concat(out)
end

function nk.uuid_v4()
  nk.next_uuid = nk.next_uuid + 1
  return string.format("00000000-0000-4000-8000-%012d", nk.next_uuid)
end

return nk
```

- [ ] **Step 5: `nakama/test/harness.lua`**: string-in, string-out API for JS
```lua
-- Drives skystriker_coop.lua like Nakama would: one match instance, presences, ticks, RPCs.
-- Every function takes and returns strings (JSON) so the JS side stays simple.
local nk = require("nk_mock")
package.loaded["nakama"] = nk

local H = {}
_G.H = H
_G.nk = nk
local mod, state, tick, match_id
local env = {}
local present = {}
local sent = {}

local function dispatcher()
  return {
    broadcast_message = function(op, data, presences, sender, reliable)
      local to = nil
      if presences then
        to = {}
        for _, p in ipairs(presences) do to[#to + 1] = p.user_id end
      end
      sent[#sent + 1] = { op = op, data = data, to = to }
    end,
    match_label_update = function(label) nk.matches[match_id].label = label end,
    match_kick = function(presences) end,
  }
end

local function ctx(user_id) return { env = env, user_id = user_id, match_id = match_id, node = "node1" } end
local function size() local n = 0 for _ in pairs(present) do n = n + 1 end return n end

function H.preload_data(src) package.preload["skystriker_data"] = assert(load(src, "=skystriker_data")) return "" end
function H.load() mod = require("skystriker_coop") return "" end
function H.set_time(ms) nk.now = tonumber(ms) return "" end
function H.set_users(j) nk.users = nk.json_decode(j) return "" end
function H.set_env(j) env = nk.json_decode(j) return "" end
function H.rpc(id, user_id, payload) return nk.rpcs[id](ctx(user_id), payload) end

function H.init(params_json, id)
  if id == "" then id = nil end
  local params = nk.json_decode(params_json)
  match_id = id or nk.match_create("skystriker_coop", params)
  nk.matches[match_id] = nk.matches[match_id] or { module = "skystriker_coop", params = params, label = "", size = 0 }
  local label
  state, tick, label = mod.match_init(ctx(nil), params)
  nk.matches[match_id].label = label
  tick = 0
  return match_id
end

function H.join(p_json, meta_json)
  local p, meta = nk.json_decode(p_json), nk.json_decode(meta_json)
  local accept, reason
  state, accept, reason = mod.match_join_attempt(ctx(p.user_id), dispatcher(), tick, state, p, meta)
  if not accept then return nk.json_encode({ ok = false, reason = reason }) end
  present[p.user_id] = p
  state = mod.match_join(ctx(p.user_id), dispatcher(), tick, state, { p })
  nk.matches[match_id].size = size()
  return nk.json_encode({ ok = true })
end

function H.leave(p_json)
  local p = nk.json_decode(p_json)
  present[p.user_id] = nil
  state = mod.match_leave(ctx(p.user_id), dispatcher(), tick, state, { p })
  nk.matches[match_id].size = size()
  return ""
end

function H.loop(msgs_json)
  local msgs = nk.json_decode(msgs_json)
  local list = {}
  for _, m in ipairs(msgs) do
    list[#list + 1] = { sender = present[m.from] or { user_id = m.from, session_id = m.from, username = m.from, node = "node1" },
      op_code = m.op, data = m.data, reliable = true, receive_time_ms = nk.now }
  end
  tick = tick + 1
  if state ~= nil then
    state = mod.match_loop(ctx(nil), dispatcher(), tick, state, list)
    if state == nil then nk.matches[match_id].ended = true end
  end
  local out = sent
  sent = {}
  return nk.json_encode(out)
end

function H.drain() local out = sent sent = {} return nk.json_encode(out) end
function H.ended() return state == nil and "true" or "false" end

function H.data_summary()
  local d = require("skystriker_data")
  local n = 0
  for _, s in ipairs(d.stages) do n = n + #s.enemies end
  return nk.json_encode({ version = d.version, stages = #d.stages, enemies = n, maxDps = d.maxDps })
end

function H.dump()
  local boards = {}
  for id, b in pairs(nk.boards) do
    local list = {}
    for _, r in pairs(b.records) do list[#list + 1] = r end
    boards[id] = list
  end
  local storage = {}
  for _, o in pairs(nk.storage) do storage[#storage + 1] = o end
  local matches = {}
  for id, m in pairs(nk.matches) do matches[id] = { label = m.label, size = m.size } end
  return nk.json_encode({ matches = matches, boards = boards, storage = storage })
end

return H
```

- [ ] **Step 6: `nakama/test/luaMatch.ts`**
```ts
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import fengari from 'fengari'
import { toLua, type CoopData } from '../../src/net/coop/coopData'

const { lua, lauxlib, lualib, to_luastring } = fengari
const here = dirname(fileURLToPath(import.meta.url))
const MODULES = resolve(here, '../modules').replace(/\\/g, '/')
const TEST = here.replace(/\\/g, '/')

export interface Presence { user_id: string; session_id: string; username: string; node: string }
export interface Sent { op: number; data: any; to: string[] | null }
export interface LbRecord { owner_id: string; username: string; score: number; subscore: number; metadata: any }
export interface StorageObj { collection: string; key: string; user_id: string; value: any }

export const presence = (id: string): Presence => ({ user_id: id, session_id: `s-${id}`, username: id, node: 'node1' })

/** Dispatched messages from the harness (an empty `to` list comes back as {} through Lua JSON). */
const unwire = (raw: string): Sent[] =>
  (JSON.parse(raw) as { op: number; data: string; to: unknown }[])
    .map((s) => ({ op: s.op, data: JSON.parse(s.data), to: Array.isArray(s.to) ? (s.to as string[]) : null }))

/** skystriker_coop.lua running in fengari against the mock nakama module (see harness.lua). */
export class LuaMatch {
  private L: any

  constructor(opts: { data?: CoopData } = {}) {
    this.L = lauxlib.luaL_newstate()
    lualib.luaL_openlibs(this.L)
    this.run(`package.path = ${JSON.stringify(`${TEST}/?.lua;${MODULES}/?.lua;`)} .. package.path`)
    this.run('require("harness")')
    if (opts.data) this.call('preload_data', toLua(opts.data))
    this.call('load')
  }

  private run(src: string): void {
    if (lauxlib.luaL_loadstring(this.L, to_luastring(src)) !== lua.LUA_OK || lua.lua_pcall(this.L, 0, 0, 0) !== lua.LUA_OK) {
      const err = lua.lua_tojsstring(this.L, -1)
      lua.lua_pop(this.L, 1)
      throw new Error(err)
    }
  }

  private call(fn: string, ...args: string[]): string {
    const L = this.L
    lua.lua_getglobal(L, to_luastring('H'))
    lua.lua_getfield(L, -1, to_luastring(fn))
    lua.lua_remove(L, -2)
    for (const a of args) lua.lua_pushstring(L, to_luastring(a))
    if (lua.lua_pcall(L, args.length, 1, 0) !== lua.LUA_OK) {
      const err = lua.lua_tojsstring(L, -1)
      lua.lua_pop(L, 1)
      throw new Error(`H.${fn}: ${err}`)
    }
    const out = lua.lua_type(L, -1) === lua.LUA_TSTRING ? lua.lua_tojsstring(L, -1) : ''
    lua.lua_pop(L, 1)
    return out
  }

  setTime(ms: number): void { this.call('set_time', String(ms)) }
  setUsers(users: Record<string, { id: number; name: string }>): void { this.call('set_users', JSON.stringify(users)) }
  setEnv(env: Record<string, string>): void { this.call('set_env', JSON.stringify(env)) }
  rpc<T = any>(id: string, userId: string, payload: unknown): T {
    return JSON.parse(this.call('rpc', id, userId, typeof payload === 'string' ? payload : JSON.stringify(payload)) || '{}')
  }
  init(params: Record<string, unknown>, matchId = ''): string { return this.call('init', JSON.stringify(params), matchId) }
  join(p: Presence, meta: Record<string, string>): { ok: boolean; reason?: string } {
    return JSON.parse(this.call('join', JSON.stringify(p), JSON.stringify(meta)))
  }
  leave(p: Presence): void { this.call('leave', JSON.stringify(p)) }
  loop(msgs: { from: Presence; op: number; data: unknown }[]): Sent[] {
    const wire = msgs.map((m) => ({ from: m.from.user_id, op: m.op, data: JSON.stringify(m.data) }))
    return unwire(this.call('loop', JSON.stringify(wire)))
  }
  /** Messages sent outside a tick (join / leave handlers). */
  drain(): Sent[] { return unwire(this.call('drain')) }
  ended(): boolean { return this.call('ended') === 'true' }
  dataSummary(): { version: string; stages: number; enemies: number; maxDps: number } { return JSON.parse(this.call('data_summary')) }
  dump(): { matches: Record<string, { label: string; size: number }>; boards: Record<string, LbRecord[]>; storage: StorageObj[] } {
    return JSON.parse(this.call('dump'))
  }
}
```
- [ ] **Step 7: Include `nakama/` tests**: `vitest.config.ts`
```ts
import { defineConfig } from 'vitest/config'

// Client unit tests + the Lua match under fengari (server/ has its own Jest suite)
export default defineConfig({
  test: { include: ['src/**/*.test.ts', 'nakama/**/*.test.ts'] },
})
```

- [ ] **Step 8: Failing test** `nakama/test/data.test.ts` (it fails until the module exists; Task 4 creates it)
```ts
import { describe, expect, it } from 'vitest'
import { buildCoopData } from '../../src/net/coop/coopData'
import { LuaMatch } from './luaMatch'

describe('generated Lua data', () => {
  it('loads in Lua and matches the TS build', () => {
    const data = buildCoopData()
    const m = new LuaMatch()
    const s = m.dataSummary()
    expect(s.version).toBe(data.version)
    expect(s.stages).toBe(data.stages.length)
    expect(s.enemies).toBe(data.stages.reduce((n, st) => n + st.enemies.length, 0))
    expect(s.maxDps).toBeCloseTo(data.maxDps, 3)
  })
})
```
Run: `npx vitest run nakama/test/data.test.ts`
Expected: FAIL with `module 'skystriker_coop' not found`. This is expected; Task 4 adds the module. To verify the harness now, create a temporary `nakama/modules/skystriker_coop.lua` containing `return {}` and re-run. Expected: PASS. Then delete the temp file. Task 4 creates the real one.

- [ ] **Step 9: Commit**
```bash
git add nakama/test package.json package-lock.json vitest.config.ts
git commit -m "Lua match harness: fengari + mock nakama module for vitest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Protocol v2, LoopbackServer as the reference server, and the conformance suite

**Files:**
- Modify: `src/net/coop/protocol.ts`, `src/net/coop/transport.ts`, `src/net/coop/loopbackServer.ts`
- Create: `src/net/coop/serverConformance.ts`, `src/net/coop/loopback.conformance.test.ts`
- Modify (test): `src/net/coop/coop.test.ts`. Only the `protocol` describe changes here. The loopback flow tests are rewritten in Task 6, so for now `describe.skip` them with a `// rewritten in Task 6` comment.

**Interfaces:**
- Consumes: `CoopData`, `coopData()`, `scriptedPickupKind`, `RULES` (Task 1), `scriptById`.
- Produces (protocol.ts):
  ```ts
  Op.REVIVE = 9
  type Phase = 'lobby' | 'countdown' | 'playing' | 'bossWarning' | 'boss' | 'stageClear' | 'complete' | 'failed'
  const IN_RUN: ReadonlySet<Phase>  // countdown, playing, bossWarning, boss, stageClear
  const TICK_RATE = 20
  interface TeamStats { score: number; kills: number }
  interface RunSummary { result: 'complete' | 'failed'; stagesCleared: number; kills: number; score: number; timeMs: number; names: string[] }
  interface PhaseInfo { phase; stageIndex; stages; stageId; seed; stageT0; bossHp?; team?; summary? }
  interface DropInfo { id: string; type: PickupType; enemy: string; t: number }
  list<T>(v): T[]
  ```
- Produces (transport.ts): `ConnectOptions { userId; name; token?; plane?; dataVersion? }`, `RoomInfo { roomId; selfId; code? }`, `Transport.createRoom()`, `joinRoom(code)`, `matchmake()` (no stage args).
- Produces (loopbackServer.ts): `new LoopbackServer({ data?, startStage?, bot?, now?, random? })` with `join(id, deliver): boolean`, `leave(id)`, `receive(from, op, data)`, `tick()`, `stageTime()`, `snapshot()`, and public `phase`, `stageIndex`, `seed`, `team`, `stagesCleared`, `summary`, `data`, `roomId`.
- Produces (serverConformance.ts):
  ```ts
  interface ServerDriver {
    join(id: string, meta?: Partial<{ token: string; dataVersion: string; plane: string }>): { ok: boolean; reason?: string }
    leave(id: string): void
    send<K extends ClientOp>(id: string, op: K, data: ClientMessages[K]): void
    advance(ms: number): void
    drain(id: string): ServerMessage[]
    phase(): Phase
  }
  testData(): CoopData
  conformance(name: string, make: (data: CoopData) => ServerDriver): void
  ```

- [ ] **Step 1: protocol.ts**: replace the opcode table, types and helpers. The full new file:
```ts
import type { PickupType } from '../../store/gameStore'

/**
 * Co-op wire protocol (model C: deterministic world + authoritative events). Messages are JSON;
 * the opcode travels next to them (Nakama match-state op codes, or a field on other transports).
 *
 * A run is the whole campaign: stage 1 → last stage, back to back. The client decides its own
 * position and whether it got hit. The server decides enemy HP and deaths, drops and who picked
 * them up, who aimed shots go at, downs and revives, the phase and the team's score.
 * Times are server milliseconds (`serverNow()` on the client) unless named otherwise.
 *
 * Nakama's Lua runtime encodes an empty array as {} — read server arrays through list().
 */
export const Op = {
  // client → server
  POS: 1,
  HITS: 2,
  GOT_HIT: 3,
  PICKUP: 4,
  BOMB: 5,
  READY: 6,
  RESYNC: 7,
  /** Clock sync request (extension of the source protocol). */
  PING: 8,
  /** We finished hovering over a downed teammate's beacon. */
  REVIVE: 9,
  // server → client
  STATES: 100,
  ENEMY_HP: 101,
  ENEMY_DEAD: 102,
  DROP: 103,
  PICKED: 104,
  PLAYER: 105,
  PHASE: 106,
  AIMED: 107,
  SNAPSHOT: 108,
  PONG: 109,
} as const

/** Server tick rate (Hz). */
export const TICK_RATE = 20
/** Our POS rate and the HITS batching window. */
export const POS_HZ = 20
export const HITS_BATCH_MS = 100
/** Teammates are drawn this far in the past, and extrapolated at most this far past their last sample. */
export const INTERP_DELAY_MS = 100
export const MAX_EXTRAPOLATE_MS = 150

export type Phase = 'lobby' | 'countdown' | 'playing' | 'bossWarning' | 'boss' | 'stageClear' | 'complete' | 'failed'
/** Phases of a run in progress (a stage is loaded). */
export const IN_RUN: ReadonlySet<Phase> = new Set<Phase>(['countdown', 'playing', 'bossWarning', 'boss', 'stageClear'])

/** A hit on an enemy id, or `'boss'`. */
export type Hit = [target: string, damage: number]

export interface PlayerState {
  id: string
  x: number
  y: number
  /** Server time of this sample. */
  t: number
  /** Trigger held (their cannon is drawn locally from `power`). */
  fire: boolean
  power: number
  plane: string
  hp: number
  /** False while down (waiting for a revive) or disconnected. */
  alive: boolean
}

export interface TeamStats { score: number; kills: number }

export interface RunSummary {
  result: 'complete' | 'failed'
  stagesCleared: number
  kills: number
  score: number
  /** Real ms from the first countdown to the end. */
  timeMs: number
  names: string[]
}

/** Where the run is. `stageT0` = server time at which this stage's time 0 happens. */
export interface PhaseInfo {
  phase: Phase
  /** 0-based position in the campaign; `stages` = how many there are. */
  stageIndex: number
  stages: number
  stageId: number
  seed: number
  stageT0: number
  bossHp?: number
  team?: TeamStats
  /** Set on complete / failed. */
  summary?: RunSummary
}

/** A server drop: it fell where enemy `enemy` was at stage time `t`, and has scrolled with the map since. */
export interface DropInfo { id: string; type: PickupType; enemy: string; t: number }

export interface ClientMessages {
  [Op.POS]: { x: number; y: number; t: number; fire: boolean; power: number; plane: string }
  [Op.HITS]: { hits: Hit[] }
  [Op.GOT_HIT]: { hits: number; hp: number }
  [Op.PICKUP]: { id: string }
  [Op.BOMB]: Record<string, never>
  [Op.READY]: { name: string; plane: string; hp: number; dataVersion: string }
  [Op.RESYNC]: Record<string, never>
  [Op.PING]: { c: number }
  [Op.REVIVE]: { id: string }
}

export interface ServerMessages {
  [Op.STATES]: { t: number; players: PlayerState[]; bossTarget?: string | null; team: TeamStats }
  [Op.ENEMY_HP]: { hp: [id: string, hp: number][] }
  [Op.ENEMY_DEAD]: { id: string; by: string }
  [Op.DROP]: DropInfo
  [Op.PICKED]: { id: string; by: string; type: PickupType }
  /** Roster (name/plane/ready) and life changes; `x, y` = where they went down / came back. */
  [Op.PLAYER]: { id: string; name?: string; plane?: string; ready?: boolean; hp: number; alive: boolean; left?: boolean; revived?: boolean; x?: number; y?: number }
  [Op.PHASE]: PhaseInfo
  /** Enemy `id` fires its volley at player `target`. */
  [Op.AIMED]: { id: string; target: string }
  [Op.SNAPSHOT]: Omit<PhaseInfo, 'bossHp'> & {
    bossHp?: number | null
    dead: string[]; hp: [string, number][]
    pickups: DropInfo[]
    taken: string[]
    players: PlayerState[]
    team: TeamStats
  }
  [Op.PONG]: { c: number; s: number }
}

export type ClientOp = keyof ClientMessages
export type ServerOp = keyof ServerMessages

export type ServerMessage = { [K in ServerOp]: { op: K; data: ServerMessages[K]; from?: string } }[ServerOp]
export type ClientMessage = { [K in ClientOp]: { op: K; data: ClientMessages[K] } }[ClientOp]

const text = new TextEncoder()
const untext = new TextDecoder()

export const encode = (data: unknown): Uint8Array => text.encode(JSON.stringify(data))

export function decode<T = unknown>(raw: Uint8Array | string): T {
  return JSON.parse(typeof raw === 'string' ? raw : untext.decode(raw)) as T
}

/** An array from the server ({} / missing → []). */
export const list = <T>(v: T[] | Record<string, never> | null | undefined): T[] => (Array.isArray(v) ? v : [])

const SERVER_OPS = new Set<number>([Op.STATES, Op.ENEMY_HP, Op.ENEMY_DEAD, Op.DROP, Op.PICKED, Op.PLAYER, Op.PHASE, Op.AIMED, Op.SNAPSHOT, Op.PONG])

/** Type a raw (op, payload) pair from the wire; null for opcodes we don't know. */
export function parseServer(op: number, raw: Uint8Array | string, from?: string): ServerMessage | null {
  if (!SERVER_OPS.has(op)) return null
  return { op, data: decode(raw), from } as ServerMessage
}
```
In `coop.test.ts` protocol describe, add:
```ts
  it('list() tolerates the {} that Nakama Lua sends for empty arrays', () => {
    expect(list({} as never)).toEqual([])
    expect(list(undefined)).toEqual([])
    expect(list([1, 2])).toEqual([1, 2])
  })
```
Import `list` from `./protocol`.

- [ ] **Step 2: transport.ts**: update the interfaces
```ts
export interface RoomInfo {
  roomId: string
  /** Our player id inside the room. */
  selfId: string
  /** Short code friends type to join (uppercase). */
  code?: string
}

export interface ConnectOptions {
  /** Stable id (game account id) and display name. */
  userId: string
  name: string
  /** Bearer token the server verifies (game login). */
  token?: string
  /** Sent with the join so the server can refuse a mismatched build. */
  plane?: string
  dataVersion?: string
}

export interface Transport {
  connect(opts: ConnectOptions): Promise<void>
  /** A private room with a code. */
  createRoom(): Promise<RoomInfo>
  /** Join (or rejoin) the room with this code. */
  joinRoom(code: string): Promise<RoomInfo>
  /** Any open public room, or a new public one. */
  matchmake(): Promise<RoomInfo>
  send<K extends ClientOp>(op: K, data: ClientMessages[K]): void
  /** Returns an unsubscribe function. */
  onMessage(cb: (msg: ServerMessage) => void): () => void
  onDisconnect(cb: (reason: string) => void): () => void
  leave(): Promise<void>
}
```
Remove `MatchmakeOptions`. Keep `Listeners` as is.

- [ ] **Step 3: Write the conformance suite** `src/net/coop/serverConformance.ts`
```ts
import { describe, expect, it } from 'vitest'
import { Op, list, type ClientMessages, type ClientOp, type Phase, type ServerMessage, type ServerMessages, type ServerOp } from './protocol'
import { RULES, type CoopData, type CoopEnemy, type CoopStage } from './coopData'
import type { ShotKind } from '../../game/roster'

/** One authoritative co-op server under test (LoopbackServer or the Lua match). */
export interface ServerDriver {
  join(id: string, meta?: Partial<{ token: string; dataVersion: string; plane: string }>): { ok: boolean; reason?: string }
  leave(id: string): void
  send<K extends ClientOp>(id: string, op: K, data: ClientMessages[K]): void
  /** Move the server clock forward, ticking at the server rate. */
  advance(ms: number): void
  /** Messages delivered to `id` since the last drain. */
  drain(id: string): ServerMessage[]
  phase(): Phase
}

/**
 * A tiny two-stage campaign. Per stage: an aimed shooter (hp 20) entering at T=0.5, a 'down'
 * shooter (hp 1000) entering at T=1.5, and a boss with 50 hp.
 */
export function testData(): CoopData {
  const enemy = (id: string, wave: number, spawnT: number, hp: number, shot: ShotKind): CoopEnemy => ({
    id, wave, spawnT, enterT: spawnT + 0.5, despawnT: spawnT + 6, hp, score: 100, shot, fireInterval: shot === 'aimed' ? 1 : 0,
  })
  const stage = (id: number): CoopStage => ({
    id, bossHp: 50, waves: 2, enemies: [enemy('w0.g0.u0', 0, 0, 20, 'aimed'), enemy('w1.g0.u0', 1, 1, 1000, 'down')],
  })
  return { version: 'test', maxDps: 100, bossScore: 5000, rescueScore: 300, podScore: 50, rules: RULES, stages: [stage(1), stage(2)] }
}

const A = 'alice', B = 'bob'
const READY = (name: string): ClientMessages[typeof Op.READY] => ({ name, plane: 'hawk', hp: 3, dataVersion: 'test' })
/** Real ms until stage time T (game seconds) after stageT0. */
const realMs = (T: number) => Math.ceil((T / RULES.gameSpeed) * 1000)

type Of<K extends ServerOp> = ServerMessages[K]
const of = <K extends ServerOp>(msgs: ServerMessage[], op: K): Of<K>[] => msgs.filter((m) => m.op === op).map((m) => m.data as Of<K>)
const last = <K extends ServerOp>(msgs: ServerMessage[], op: K): Of<K> | undefined => of(msgs, op).at(-1)

function lobby(d: ServerDriver): void {
  expect(d.join(A).ok).toBe(true)
  expect(d.join(B).ok).toBe(true)
  d.send(A, Op.READY, READY('A'))
  d.send(B, Op.READY, READY('B'))
  d.advance(50)
}

/** Both ready, countdown over, now `playing`; inboxes drained. */
function playing(d: ServerDriver): void {
  lobby(d)
  d.advance(RULES.countdownMs + 100)
  expect(d.phase()).toBe('playing')
  d.drain(A); d.drain(B)
}

/** Kill every enemy of the current stage (both players fire; damage budget refills over time). */
function killWave(d: ServerDriver, stage: CoopStage): void {
  d.advance(realMs(Math.max(...stage.enemies.map((e) => e.enterT!))) + 50)
  for (let i = 0; i < 40; i++) {
    for (const e of stage.enemies) {
      d.send(A, Op.HITS, { hits: [[e.id, 150]] })
      d.send(B, Op.HITS, { hits: [[e.id, 150]] })
    }
    d.advance(500)
    if (d.phase() !== 'playing') return
  }
}

function clearStage(d: ServerDriver, stage: CoopStage): void {
  killWave(d, stage)
  expect(d.phase()).toBe('bossWarning')
  d.advance(RULES.bossWarningMs + 100)
  expect(d.phase()).toBe('boss')
  // Both fire (one of them may be down — the server ignores a downed shooter)
  d.send(A, Op.HITS, { hits: [['boss', stage.bossHp]] })
  d.send(B, Op.HITS, { hits: [['boss', stage.bossHp]] })
  d.advance(50)
  expect(d.phase()).toBe('stageClear')
}

export function conformance(name: string, make: (data: CoopData) => ServerDriver): void {
  describe(`${name}: co-op server rules`, () => {
    it('both READY → countdown of stage 1 with a seed, then playing', () => {
      const d = make(testData())
      lobby(d)
      expect(d.phase()).toBe('countdown')
      const ph = last(d.drain(A), Op.PHASE)!
      expect(ph).toMatchObject({ phase: 'countdown', stageIndex: 0, stages: 2, stageId: 1 })
      expect(Number.isFinite(ph.seed)).toBe(true)
      d.advance(RULES.countdownMs + 100)
      expect(d.phase()).toBe('playing')
    })

    it('one READY player is not enough', () => {
      const d = make(testData())
      d.join(A); d.join(B)
      d.send(A, Op.READY, READY('A'))
      d.advance(100)
      expect(d.phase()).toBe('lobby')
    })

    it('answers PING with PONG', () => {
      const d = make(testData())
      d.join(A)
      d.send(A, Op.PING, { c: 1234 })
      d.advance(50)
      expect(last(d.drain(A), Op.PONG)?.c).toBe(1234)
    })

    it('kills from hits inside the on-screen window, with team stats', () => {
      const d = make(testData())
      playing(d)
      d.send(A, Op.HITS, { hits: [['w0.g0.u0', 20]] })   // not entered yet (T≈0.05)
      d.advance(50)
      expect(of(d.drain(A), Op.ENEMY_DEAD)).toEqual([])
      d.advance(realMs(0.6))
      d.send(A, Op.HITS, { hits: [['w0.g0.u0', 20]] })
      d.advance(50)
      const msgs = d.drain(B)
      expect(of(msgs, Op.ENEMY_DEAD)).toEqual([{ id: 'w0.g0.u0', by: A }])
      expect(last(msgs, Op.STATES)?.team).toEqual({ score: 100, kills: 1 })
    })

    it('caps damage per player', () => {
      const d = make(testData())
      playing(d)
      d.advance(realMs(1.6))
      d.send(A, Op.HITS, { hits: [['w1.g0.u0', 100000]] })
      d.advance(50)
      const hp = list(last(d.drain(A), Op.ENEMY_HP)?.hp).find(([id]) => id === 'w1.g0.u0')?.[1]
      expect(hp).toBeGreaterThanOrEqual(1000 - 100 * RULES.dpsCapMult - 1)
    })

    it('aimed shots name a living player; down shooters never send AIMED', () => {
      const d = make(testData())
      playing(d)
      d.advance(realMs(2.5))
      const aimed = of(d.drain(A), Op.AIMED)
      expect(aimed.length).toBeGreaterThan(0)
      for (const a of aimed) {
        expect(a.id).toBe('w0.g0.u0')
        expect([A, B]).toContain(a.target)
      }
    })

    it('pickups: first come first served, scripted rescues score for the team', () => {
      const d = make(testData())
      playing(d)
      d.send(A, Op.PICKUP, { id: 'rescue:start0' })
      d.send(B, Op.PICKUP, { id: 'rescue:start0' })
      d.send(B, Op.PICKUP, { id: 'rescue:w9' })           // not a scripted id for 2 waves
      d.advance(50)
      const msgs = d.drain(A)
      expect(of(msgs, Op.PICKED)).toEqual([{ id: 'rescue:start0', by: A, type: 'rescue' }])
      expect(last(msgs, Op.STATES)?.team.score).toBe(300)
    })

    it('down and revive', () => {
      const d = make(testData())
      playing(d)
      d.send(A, Op.GOT_HIT, { hits: 3, hp: 0 })
      d.advance(50)
      expect(d.phase()).toBe('playing')
      expect(of(d.drain(B), Op.PLAYER).find((p) => p.id === A)).toMatchObject({ alive: false, hp: 0 })
      d.send(A, Op.REVIVE, { id: A })                      // can't revive yourself
      d.advance(50)
      expect(of(d.drain(B), Op.PLAYER).some((p) => p.revived)).toBe(false)
      d.send(B, Op.REVIVE, { id: A })
      d.advance(50)
      expect(of(d.drain(A), Op.PLAYER).find((p) => p.revived)).toMatchObject({ id: A, alive: true, hp: RULES.reviveHp })
    })

    it('a downed player cannot revive anyone', () => {
      const d = make(testData())
      playing(d)
      d.send(A, Op.GOT_HIT, { hits: 3, hp: 0 })
      d.advance(50)
      d.send(B, Op.GOT_HIT, { hits: 1, hp: 2 })
      d.send(A, Op.REVIVE, { id: B })
      d.advance(50)
      expect(of(d.drain(B), Op.PLAYER).some((p) => p.revived)).toBe(false)
    })

    it('both down → failed with a summary', () => {
      const d = make(testData())
      playing(d)
      d.advance(realMs(0.6))
      d.send(A, Op.HITS, { hits: [['w0.g0.u0', 20]] })
      d.advance(50)
      d.send(A, Op.GOT_HIT, { hits: 3, hp: 0 })
      d.send(B, Op.GOT_HIT, { hits: 3, hp: 0 })
      d.advance(50)
      expect(d.phase()).toBe('failed')
      const ph = last(d.drain(A), Op.PHASE)!
      expect(ph.phase).toBe('failed')
      expect(ph.summary).toMatchObject({ result: 'failed', stagesCleared: 0, kills: 1, score: 100 })
      expect(ph.summary!.names).toHaveLength(2)
    })

    it('boss kill → stageClear → next stage (fresh seed, everyone back) → complete', () => {
      const data = testData()
      const d = make(data)
      playing(d)
      d.send(A, Op.GOT_HIT, { hits: 3, hp: 0 })            // A is down when the stage ends
      d.advance(50)
      clearStage(d, data.stages[0])
      d.advance(RULES.stageClearMs + 100)
      expect(d.phase()).toBe('countdown')
      const msgs = d.drain(A)
      const next = last(msgs, Op.PHASE)!
      expect(next).toMatchObject({ phase: 'countdown', stageIndex: 1, stageId: 2 })
      expect(last(msgs, Op.STATES)!.players.find((p) => p.id === A)).toMatchObject({ alive: true, hp: 3 })
      d.advance(RULES.countdownMs + 100)
      clearStage(d, data.stages[1])
      d.advance(RULES.stageClearMs + 100)
      expect(d.phase()).toBe('complete')
      expect(last(d.drain(B), Op.PHASE)!.summary).toMatchObject({ result: 'complete', stagesCleared: 2, kills: 6, score: 4 * 100 + 2 * 5000 })
    })

    it('rejoin mid-run: snapshot, and down until revived', () => {
      const d = make(testData())
      playing(d)
      d.advance(realMs(0.6))
      d.send(B, Op.HITS, { hits: [['w0.g0.u0', 20]] })
      d.advance(50)
      d.leave(A)
      d.advance(50)
      expect(d.phase()).toBe('playing')
      expect(of(d.drain(B), Op.PLAYER).find((p) => p.id === A)).toMatchObject({ alive: false, left: true })
      expect(d.join(A).ok).toBe(true)
      d.advance(50)
      const snap = last(d.drain(A), Op.SNAPSHOT)!
      expect(snap).toMatchObject({ stageIndex: 0, phase: 'playing' })
      expect(list(snap.dead)).toContain('w0.g0.u0')
      expect(list(snap.players).find((p) => p.id === A)?.alive).toBe(false)
    })

    it('leaving mid-run counts as down; nobody left → failed', () => {
      const d = make(testData())
      playing(d)
      d.leave(A)
      d.advance(50)
      expect(d.phase()).toBe('playing')
      d.leave(B)
      d.advance(50)
      expect(d.phase()).toBe('failed')
    })
  })
}
```

- [ ] **Step 4: Loopback driver + test** `src/net/coop/loopback.conformance.test.ts`
```ts
import { mulberry32 } from '../../game/sim/rng'
import { LoopbackServer } from './loopbackServer'
import { TICK_RATE, type ServerMessage } from './protocol'
import { conformance, type ServerDriver } from './serverConformance'

conformance('LoopbackServer', (data): ServerDriver => {
  let now = 1_000_000
  const server = new LoopbackServer({ data, now: () => now, random: mulberry32(7) })
  const inbox = new Map<string, ServerMessage[]>()
  const tickMs = 1000 / TICK_RATE
  return {
    join: (id) => {
      inbox.set(id, inbox.get(id) ?? [])
      // Through JSON, like a real wire
      const ok = server.join(id, (m) => inbox.get(id)!.push(JSON.parse(JSON.stringify(m))))
      return ok ? { ok } : { ok, reason: 'refused' }
    },
    leave: (id) => server.leave(id),
    send: (id, op, data) => server.receive(id, op, JSON.parse(JSON.stringify(data))),
    advance: (ms) => { for (let t = 0; t < ms; t += tickMs) { now += tickMs; server.tick() } },
    drain: (id) => { const m = inbox.get(id) ?? []; inbox.set(id, []); return m },
    phase: () => server.phase,
  }
})
```

- [ ] **Step 5: Run to verify it fails**

Run: `npx vitest run src/net/coop/loopback.conformance.test.ts`
Expected: FAIL with type and behaviour errors (old LoopbackServer).

- [ ] **Step 6: Rewrite** `src/net/coop/loopbackServer.ts` (whole file)
```ts
import { getPlane } from '../../game/planes'
import { weaponStats } from '../../game/weapon'
import { pickDrop } from '../../game/dropRules'
import { inWorld } from '../../game/world'
import { scriptById, scriptedPos } from '../../game/sim/stageScript'
import { coopData, scriptedPickupKind, type CoopData, type CoopEnemy, type CoopStage } from './coopData'
import {
  IN_RUN, Op, TICK_RATE, decode, encode, list, parseServer,
  type ClientMessages, type ClientOp, type DropInfo, type Phase, type PhaseInfo, type PlayerState,
  type RunSummary, type ServerMessage, type ServerMessages, type ServerOp, type TeamStats,
} from './protocol'
import { Listeners, type ConnectOptions, type RoomInfo, type Transport } from './transport'

/**
 * In-browser authoritative co-op server: the reference implementation of the rules that
 * nakama/modules/skystriker_coop.lua implements for real (both pass serverConformance.ts).
 * Runs the whole campaign from the co-op data — enemy HP and deaths, drops and pickups, aimed
 * shots, downs and revives, phases and team stats — plus an optional bot wingmate (dev only).
 */
export interface LoopbackOptions {
  data?: CoopData
  /** First stage index (dev: `?stage=N` starts the run at stage N). */
  startStage?: number
  /** Add a bot wingmate that flies under enemies and shoots them; then one human can start. */
  bot?: boolean
  /** Server clock (ms). */
  now?: () => number
  random?: () => number
}

const TICK_MS = 1000 / TICK_RATE
const MAX_PLAYERS = 2
const BOT_ID = 'bot'
const FIGHTING = new Set<Phase>(['playing', 'bossWarning', 'boss'])
const AIMED_SHOTS = new Set(['aimed', 'spread3', 'burst2'])

type Member = PlayerState & {
  name: string; human: boolean; maxHp: number; ready: boolean; connected: boolean
  /** Damage this player may still deal right now (refills at maxDps × cap per game-second). */
  budget: number
  downX: number; downY: number
}

const clampHp = (hp: unknown) => Math.max(1, Math.min(9, Math.floor(Number(hp)) || 3))
const inWindow = (e: CoopEnemy, T: number) => e.enterT !== null && T >= e.enterT - 0.2 && T <= e.despawnT + 0.5
const playerState = ({ id, x, y, t, fire, power, plane, hp, alive }: Member): PlayerState => ({ id, x, y, t, fire, power, plane, hp, alive })

export class LoopbackServer {
  readonly roomId = `loopback-${Math.floor(Math.random() * 1e6)}`
  readonly data: CoopData
  phase: Phase = 'lobby'
  stageIndex = 0
  seed = 0
  stageT0 = 0
  team: TeamStats = { score: 0, kills: 0 }
  stagesCleared = 0
  summary: RunSummary | null = null
  private now: () => number
  private random: () => number
  private members = new Map<string, Member>()
  private clients = new Map<string, (m: ServerMessage) => void>()
  private byId = new Map<string, CoopEnemy>()
  private lastSpawn = 0
  private hp = new Map<string, number>()
  private dirty = new Set<string>()
  private dead = new Set<string>()
  private nextShot = new Map<string, number>()
  private pickups = new Map<string, DropInfo>()
  private taken = new Set<string>()
  private drops = { powerups: 0, shields: 0, n: 0 }
  private bossHp: number | null = null
  private phaseAt = 0
  private bossTarget: string | null = null
  private bossSwapAt = 0
  private runStart = 0
  private lastTick = 0
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(private opts: LoopbackOptions = {}) {
    this.now = opts.now ?? (() => performance.now())
    this.random = opts.random ?? Math.random
    this.data = opts.data ?? coopData()
    if (opts.bot) this.members.set(BOT_ID, { ...this.blank(BOT_ID, 'BOT', false), hp: 99, maxHp: 99, ready: true, power: 2, x: 2.5 })
  }

  get stage(): CoopStage { return this.data.stages[this.stageIndex] }
  private get rules() { return this.data.rules }
  private get cap() { return this.data.maxDps * this.rules.dpsCapMult }

  private blank(id: string, name: string, human: boolean): Member {
    return {
      id, name, human, x: 0, y: -4, t: 0, fire: false, power: 0, plane: 'hawk', hp: 3, maxHp: 3, alive: true,
      ready: false, connected: true, budget: this.cap, downX: 0, downY: -4,
    }
  }

  /** Run the server on its own timer (tests call tick() by hand instead). */
  startTimer(): void { if (!this.timer) this.timer = setInterval(() => this.tick(), TICK_MS) }
  stopTimer(): void { if (this.timer) clearInterval(this.timer); this.timer = null }

  /** Game seconds since the current stage started. */
  stageTime(now = this.now()): number {
    return ((now - this.stageT0) / 1000) * this.rules.gameSpeed
  }

  /** A client connects. Members may come back mid-run (they get a snapshot); others only join the lobby. */
  join(id: string, deliver: (m: ServerMessage) => void): boolean {
    const m = this.members.get(id)
    const humans = [...this.members.values()].filter((p) => p.human).length
    if (!m && (this.phase !== 'lobby' || humans >= MAX_PLAYERS)) return false
    this.clients.set(id, deliver)
    if (m) m.connected = true
    else this.members.set(id, this.blank(id, id, true))
    this.roster()
    if (m && this.phase !== 'lobby') this.sendTo(id, Op.SNAPSHOT, this.snapshot())
    return true
  }

  leave(id: string): void {
    this.clients.delete(id)
    const m = this.members.get(id)
    if (!m) return
    if (this.phase === 'lobby') this.members.delete(id)
    else { m.connected = false; m.alive = false; m.hp = 0; m.downX = m.x; m.downY = m.y }
    this.broadcast(Op.PLAYER, { id, hp: 0, alive: false, left: true })
    this.checkFailed(this.now())
  }

  // ── client → server ──

  receive<K extends ClientOp>(from: string, op: K, data: ClientMessages[K]): void {
    const now = this.now()
    const m = this.members.get(from)
    if (!m) return
    switch (op) {
      case Op.PING:
        this.sendTo(from, Op.PONG, { c: (data as ClientMessages[typeof Op.PING]).c, s: now })
        break
      case Op.READY: {
        const d = data as ClientMessages[typeof Op.READY]
        m.ready = true
        m.plane = d.plane
        if (this.phase === 'lobby') {
          // Nakama uses the verified account name instead
          m.name = d.name
          m.maxHp = m.hp = clampHp(d.hp)
          this.roster()
          const humans = [...this.members.values()].filter((p) => p.human)
          if (humans.length >= (this.opts.bot ? 1 : MAX_PLAYERS) && humans.every((p) => p.ready)) this.startRun(now)
        } else {
          this.sendTo(from, Op.SNAPSHOT, this.snapshot())
          this.roster()
        }
        break
      }
      case Op.POS: {
        const d = data as ClientMessages[typeof Op.POS]
        if (!m.connected) break
        m.x = d.x; m.y = d.y; m.t = d.t; m.fire = !!d.fire; m.power = Math.floor(d.power) || 0; m.plane = d.plane
        break
      }
      case Op.HITS:
        for (const [target, dmg] of list((data as ClientMessages[typeof Op.HITS]).hits)) this.applyHit(m, target, dmg, now)
        break
      case Op.GOT_HIT:
        this.gotHit(m, (data as ClientMessages[typeof Op.GOT_HIT]).hp, now)
        break
      case Op.PICKUP:
        this.pickup(m, (data as ClientMessages[typeof Op.PICKUP]).id)
        break
      case Op.REVIVE:
        this.revive(m, (data as ClientMessages[typeof Op.REVIVE]).id)
        break
      case Op.RESYNC:
        this.sendTo(from, Op.SNAPSHOT, this.snapshot())
        break
    }
  }

  private applyHit(m: Member, target: string, dmg: number, now: number): void {
    if (!m.alive || typeof dmg !== 'number' || !(dmg > 0)) return
    dmg = Math.min(dmg, m.budget)
    if (dmg <= 0) return
    if (target === 'boss') {
      if (this.phase !== 'boss' || this.bossHp === null || this.bossHp <= 0) return
      m.budget -= dmg
      this.bossHp -= dmg
      this.dirty.add('boss')
      if (this.bossHp <= 0) {
        this.bossHp = 0
        this.dirty.delete('boss')
        this.team.kills++
        this.team.score += this.data.bossScore
        this.broadcast(Op.ENEMY_DEAD, { id: 'boss', by: m.id })
        this.stageCleared(now)
      }
      return
    }
    if (!FIGHTING.has(this.phase)) return
    const e = this.byId.get(target)
    const T = this.stageTime(now)
    if (!e || this.dead.has(target) || !inWindow(e, T)) return
    m.budget -= dmg
    const hp = (this.hp.get(target) ?? e.hp) - dmg
    this.hp.set(target, hp)
    if (hp > 0) { this.dirty.add(target); return }
    this.dead.add(target)
    this.dirty.delete(target)
    this.team.kills++
    this.team.score += e.score
    this.broadcast(Op.ENEMY_DEAD, { id: target, by: m.id })
    const type = pickDrop(this.random, {
      powerupsDropped: this.drops.powerups, shieldsDropped: this.drops.shields, progress: e.wave / Math.max(1, this.stage.waves),
    })
    if (type) {
      if (type === 'powerup') this.drops.powerups++
      if (type === 'shield') this.drops.shields++
      const drop: DropInfo = { id: `d${this.drops.n++}`, type, enemy: target, t: T }
      this.pickups.set(drop.id, drop)
      this.broadcast(Op.DROP, drop)
    }
  }

  private gotHit(m: Member, hp: number, now: number): void {
    if (!m.alive || !FIGHTING.has(this.phase)) return
    m.hp = Math.max(0, Math.min(m.maxHp, Math.floor(Number(hp)) || 0))
    if (m.hp > 0) { this.broadcast(Op.PLAYER, { id: m.id, hp: m.hp, alive: true }); return }
    m.alive = false
    m.downX = m.x; m.downY = m.y
    this.broadcast(Op.PLAYER, { id: m.id, hp: 0, alive: false, x: m.x, y: m.y })
    this.checkFailed(now)
  }

  private pickup(m: Member, id: string): void {
    if (!m.alive || !IN_RUN.has(this.phase) || typeof id !== 'string' || this.taken.has(id)) return
    const drop = this.pickups.get(id)
    const type = drop?.type ?? scriptedPickupKind(id, this.stage.waves)
    if (!type) return
    this.taken.add(id)
    this.pickups.delete(id)
    if (!drop) this.team.score += type === 'rescue' ? this.data.rescueScore : this.data.podScore
    this.broadcast(Op.PICKED, { id, by: m.id, type })
  }

  private revive(m: Member, id: string): void {
    const t = this.members.get(id)
    if (!m.alive || !t || t === m || t.alive || !t.connected || !FIGHTING.has(this.phase)) return
    // Must actually be near the beacon (POS lags a little, hence the slack)
    if (Math.hypot(m.x - t.downX, m.y - t.downY) > this.rules.reviveRadius * 2) return
    t.alive = true
    t.hp = Math.min(this.rules.reviveHp, t.maxHp)
    t.x = t.downX; t.y = t.downY
    this.broadcast(Op.PLAYER, { id: t.id, hp: t.hp, alive: true, revived: true, x: t.x, y: t.y })
  }

  // ── run / stage flow ──

  private startRun(now: number): void {
    this.runStart = now
    this.team = { score: 0, kills: 0 }
    this.stagesCleared = 0
    this.summary = null
    this.startStage(Math.min(this.opts.startStage ?? 0, this.data.stages.length - 1), now)
  }

  private startStage(index: number, now: number): void {
    this.stageIndex = index
    this.seed = Math.floor(this.random() * 2 ** 31)
    this.stageT0 = now + this.rules.countdownMs
    const enemies = this.stage.enemies
    this.byId = new Map(enemies.map((e) => [e.id, e]))
    this.lastSpawn = enemies.reduce((t, e) => Math.max(t, e.spawnT), 0)
    this.hp = new Map(enemies.map((e) => [e.id, e.hp]))
    this.dirty.clear(); this.dead.clear(); this.nextShot.clear(); this.pickups.clear(); this.taken.clear()
    this.drops = { powerups: 0, shields: 0, n: 0 }
    this.bossHp = null; this.bossTarget = null; this.bossSwapAt = 0
    // Everyone still connected comes back for the new stage
    for (const p of this.members.values()) {
      if (p.connected) { p.alive = true; p.hp = p.maxHp }
      p.budget = this.cap
    }
    this.setPhase('countdown')
  }

  private stageCleared(now: number): void {
    this.stagesCleared++
    this.phaseAt = now + this.rules.stageClearMs
    this.setPhase('stageClear')
  }

  private checkFailed(now: number): void {
    if (!IN_RUN.has(this.phase)) return
    if (![...this.members.values()].some((p) => p.human && p.connected && p.alive)) this.finish('failed', now)
  }

  private finish(result: RunSummary['result'], now: number): void {
    const humans = [...this.members.values()].filter((p) => p.human)
    this.summary = {
      result, stagesCleared: this.stagesCleared, kills: this.team.kills, score: this.team.score,
      timeMs: now - this.runStart, names: humans.map((p) => p.name),
    }
    this.setPhase(result)
  }

  tick(): void {
    const now = this.now()
    const dt = this.lastTick ? Math.min(0.25, (now - this.lastTick) / 1000) : TICK_MS / 1000
    this.lastTick = now
    const cap = this.cap
    for (const p of this.members.values()) p.budget = Math.min(cap, p.budget + cap * dt * this.rules.gameSpeed)

    if (this.phase === 'countdown' && now >= this.stageT0) this.setPhase('playing')
    const T = this.stageTime(now)
    if (this.phase === 'playing') {
      this.enemyFire(T)
      const remaining = this.stage.enemies.some((e) => !this.dead.has(e.id) && T < e.despawnT)
      if (T > this.lastSpawn && !remaining) {
        this.phaseAt = now + this.rules.bossWarningMs
        this.setPhase('bossWarning')
      }
    } else if (this.phase === 'bossWarning' && now >= this.phaseAt) {
      this.bossHp = this.stage.bossHp
      this.setPhase('boss')
    } else if (this.phase === 'stageClear' && now >= this.phaseAt) {
      if (this.stageIndex + 1 < this.data.stages.length) this.startStage(this.stageIndex + 1, now)
      else this.finish('complete', now)
    }
    if (this.phase === 'boss' && now >= this.bossSwapAt) {
      // The boss switches between living players every few seconds
      const targets = [...this.members.values()].filter((p) => p.connected && p.alive).map((p) => p.id)
      const i = this.bossTarget ? targets.indexOf(this.bossTarget) : -1
      this.bossTarget = targets.length ? targets[(i + 1) % targets.length] : null
      this.bossSwapAt = now + this.rules.bossTargetSwapMs
    }

    const bot = this.members.get(BOT_ID)
    if (bot && (this.phase === 'playing' || this.phase === 'boss')) this.botStep(bot, T, dt, now)

    if (this.dirty.size) {
      this.broadcast(Op.ENEMY_HP, { hp: [...this.dirty].map((id) => [id, id === 'boss' ? this.bossHp ?? 0 : this.hp.get(id) ?? 0] as [string, number]) })
      this.dirty.clear()
    }
    if (IN_RUN.has(this.phase)) {
      this.broadcast(Op.STATES, {
        t: now,
        players: [...this.members.values()].map((p) => (p.human ? playerState(p) : { ...playerState(p), t: now })),
        bossTarget: this.phase === 'boss' ? this.bossTarget : null,
        team: { ...this.team },
      })
    }
  }

  /** Aimed volleys: each shooter on its own interval, at a random living player. */
  private enemyFire(T: number): void {
    const targets = [...this.members.values()].filter((p) => p.connected && p.alive)
    if (!targets.length) return
    for (const e of this.stage.enemies) {
      if (e.enterT === null || e.fireInterval <= 0 || !AIMED_SHOTS.has(e.shot)) continue
      if (T < e.enterT || T >= e.despawnT || this.dead.has(e.id)) continue
      let next = this.nextShot.get(e.id)
      if (next === undefined) {
        next = e.enterT + e.fireInterval * (0.5 + 0.5 * this.random())
        this.nextShot.set(e.id, next)
      }
      if (T < next) continue
      this.nextShot.set(e.id, T + e.fireInterval)
      const target = targets[Math.floor(this.random() * targets.length)]
      this.broadcast(Op.AIMED, { id: e.id, target: target.id })
    }
  }

  /** Dev bot: hugs the nearest enemy's column and pours fire into it. */
  private botStep(bot: Member, T: number, dt: number, now: number): void {
    const w = weaponStats(bot.power)
    const dps = (w.damage * w.streams.length * getPlane(bot.plane).damage * 1000) / w.interval
    const dmg = dps * dt * this.rules.gameSpeed
    let tx = 2.5
    if (this.phase === 'boss') {
      tx = 0
      if (Math.abs(bot.x) < 1.5) this.applyHit(bot, 'boss', dmg, now)
    } else {
      const script = scriptById(this.stage.id)
      let best: { id: string; x: number } | null = null
      for (const e of this.stage.enemies) {
        const s = script.get(e.id)
        if (!s || this.dead.has(e.id) || e.enterT === null || T < e.enterT || T >= e.despawnT) continue
        const p = scriptedPos(s, T)
        if (!inWorld(p.x, p.y) || p.y <= bot.y) continue
        if (!best || Math.abs(p.x - bot.x) < Math.abs(best.x - bot.x)) best = { id: e.id, x: p.x }
      }
      if (best) {
        tx = best.x
        if (Math.abs(best.x - bot.x) < 0.8) this.applyHit(bot, best.id, dmg, now)
      }
    }
    const step = 9 * dt
    bot.x = Math.max(-7, Math.min(7, bot.x + Math.max(-step, Math.min(step, tx - bot.x))))
  }

  private phaseInfo(): PhaseInfo {
    return {
      phase: this.phase, stageIndex: this.stageIndex, stages: this.data.stages.length, stageId: this.stage.id,
      seed: this.seed, stageT0: this.stageT0, bossHp: this.bossHp ?? undefined, team: { ...this.team },
      summary: this.summary ?? undefined,
    }
  }

  private setPhase(phase: Phase): void {
    if (this.phase === phase) return
    this.phase = phase
    this.broadcast(Op.PHASE, this.phaseInfo())
  }

  private roster(): void {
    for (const p of this.members.values()) {
      this.broadcast(Op.PLAYER, { id: p.id, name: p.name, plane: p.plane, ready: p.ready, hp: p.hp, alive: p.alive })
    }
  }

  snapshot(): ServerMessages[typeof Op.SNAPSHOT] {
    return {
      ...this.phaseInfo(),
      bossHp: this.bossHp,
      dead: [...this.dead],
      hp: [...this.hp].filter(([id, hp]) => !this.dead.has(id) && hp < (this.byId.get(id)?.hp ?? hp)),
      pickups: [...this.pickups.values()],
      taken: [...this.taken],
      players: [...this.members.values()].map(playerState),
      team: { ...this.team },
    }
  }

  private sendTo<K extends ServerOp>(id: string, op: K, data: ServerMessages[K]): void {
    this.clients.get(id)?.({ op, data } as ServerMessage)
  }

  private broadcast<K extends ServerOp>(op: K, data: ServerMessages[K]): void {
    for (const id of this.clients.keys()) this.sendTo(id, op, data)
  }
}

/**
 * Transport to a LoopbackServer with simulated network: each direction gets `latencyMs / 2` plus
 * up to `jitterMs`, kept in order (like a reliable socket), and payloads go through JSON.
 */
export class LoopbackTransport implements Transport {
  private userId = ''
  private messages = new Listeners<[ServerMessage]>()
  private disconnects = new Listeners<[string]>()
  private upAt = 0
  private downAt = 0

  constructor(
    private server: LoopbackServer,
    private net: { latencyMs: number; jitterMs: number } = { latencyMs: 80, jitterMs: 20 },
    private now: () => number = () => performance.now(),
  ) {}

  async connect(opts: ConnectOptions): Promise<void> {
    this.userId = opts.userId
  }

  private async enter(): Promise<RoomInfo> {
    const ok = this.server.join(this.userId, (m) => this.later('down', () => {
      const wire = parseServer(m.op, encode(m.data))
      if (wire) this.messages.emit(wire)
    }))
    if (!ok) throw new Error('Room is full or the run already started')
    return { roomId: this.server.roomId, selfId: this.userId, code: 'LOOP1' }
  }

  createRoom(): Promise<RoomInfo> { return this.enter() }
  joinRoom(): Promise<RoomInfo> { return this.enter() }
  matchmake(): Promise<RoomInfo> { return this.enter() }

  send<K extends ClientOp>(op: K, data: ClientMessages[K]): void {
    const raw = encode(data)
    this.later('up', () => this.server.receive(this.userId, op, decode<ClientMessages[K]>(raw)))
  }

  onMessage(cb: (msg: ServerMessage) => void): () => void { return this.messages.add(cb) }
  onDisconnect(cb: (reason: string) => void): () => void { return this.disconnects.add(cb) }

  async leave(): Promise<void> {
    this.server.leave(this.userId)
    this.messages.clear()
  }

  private later(dir: 'up' | 'down', fn: () => void): void {
    const { latencyMs, jitterMs } = this.net
    const now = this.now()
    let at = now + latencyMs / 2 + Math.random() * jitterMs
    // In order, like a reliable socket
    if (dir === 'up') at = this.upAt = Math.max(at, this.upAt)
    else at = this.downAt = Math.max(at, this.downAt)
    setTimeout(fn, Math.max(0, at - now))
  }
}
```

- [ ] **Step 7: Run the conformance suite + protocol tests**

Run: `npx vitest run src/net/coop/loopback.conformance.test.ts src/net/coop/coop.test.ts`
Expected: the conformance cases and the protocol/clock/interpolation tests PASS. The loopback session describe is skipped. TypeScript errors in `coopSession.ts`, `storeWorld.ts`, `active.ts` and `nakamaTransport.ts` remain until Tasks 6 and 8. vitest doesn't typecheck, so the run still works.

- [ ] **Step 8: Commit**
```bash
git add src/net/coop/protocol.ts src/net/coop/transport.ts src/net/coop/loopbackServer.ts src/net/coop/serverConformance.ts src/net/coop/loopback.conformance.test.ts src/net/coop/coop.test.ts
git commit -m "Co-op protocol v2: whole-campaign runs, revives, team stats; LoopbackServer as the reference

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Lua match handler (gameplay rules)

**Files:**
- Create: `nakama/modules/skystriker_coop.lua`, `nakama/test/luaDriver.ts`, `nakama/test/lua.conformance.test.ts`
- Modify: `nakama/test/nk_mock.lua` (add `nk.debug_hooks = true` just above `return nk`)

**Interfaces:**
- Consumes: the generated data module (Task 1), harness (Task 2), conformance suite (Task 3).
- Produces: a Nakama match module `skystriker_coop` (match_init/join_attempt/join/leave/loop/terminate/signal), RPCs (Task 5 fills in the auth/RPC/leaderboard details). This task writes the whole file, including auth in `match_join_attempt`, because the Lua driver joins with tokens.

- [ ] **Step 1: Lua driver** `nakama/test/luaDriver.ts` (its own module, so the test files can share it without re-registering suites)
```ts
import { TICK_RATE, type Phase, type ServerMessage } from '../../src/net/coop/protocol'
import type { ServerDriver } from '../../src/net/coop/serverConformance'
import type { CoopData } from '../../src/net/coop/coopData'
import { LuaMatch, presence, type Sent } from './luaMatch'

/** The Lua match behind the ServerDriver interface; each player logs in with token `tok-<id>`. */
export function luaDriver(data: CoopData, m = new LuaMatch({ data })): ServerDriver & { match: LuaMatch } {
  let now = 1_700_000_000_000
  const tickMs = 1000 / TICK_RATE
  const inbox = new Map<string, ServerMessage[]>()
  const joined = new Set<string>()
  let queue: { from: ReturnType<typeof presence>; op: number; data: unknown }[] = []
  const users: Record<string, { id: number; name: string }> = {}
  m.setEnv({ SKYSTRIKER_API_URL: 'http://game.test' })
  m.setTime(now)
  m.init({ public: false, code: 'ABCDE' })
  const deliver = (sent: Sent[]) => {
    for (const s of sent) {
      for (const id of s.to ?? [...joined]) inbox.get(id)?.push({ op: s.op, data: s.data } as ServerMessage)
    }
  }
  return {
    match: m,
    join: (id, meta = {}) => {
      users[`tok-${id}`] ??= { id: Object.keys(users).length + 1, name: id.toUpperCase() }
      m.setUsers(users)
      inbox.set(id, inbox.get(id) ?? [])
      const res = m.join(presence(id), { token: `tok-${id}`, dataVersion: data.version, plane: 'hawk', ...meta })
      if (res.ok) joined.add(id)
      deliver(m.drain())
      return res
    },
    leave: (id) => { joined.delete(id); m.leave(presence(id)); deliver(m.drain()) },
    send: (id, op, payload) => { queue.push({ from: presence(id), op, data: payload }) },
    advance: (ms) => {
      for (let t = 0; t < ms; t += tickMs) {
        now += tickMs
        m.setTime(now)
        const msgs = queue
        queue = []
        deliver(m.loop(msgs))
      }
    },
    drain: (id) => { const msgs = inbox.get(id) ?? []; inbox.set(id, []); return msgs },
    // Debug-only RPC: the module registers it when the mock sets nk.debug_hooks (Nakama never does)
    phase: () => m.rpc<{ phase: Phase }>('skystriker_debug_phase', '', {}).phase,
  }
}
```
`nakama/test/lua.conformance.test.ts`:
```ts
import { conformance } from '../../src/net/coop/serverConformance'
import { luaDriver } from './luaDriver'

conformance('Lua match (skystriker_coop.lua)', (data) => luaDriver(data))
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run nakama/test/lua.conformance.test.ts`
Expected: FAIL with `module 'skystriker_coop' not found`.

- [ ] **Step 3: Write** `nakama/modules/skystriker_coop.lua`
```lua
--[[
  Sky Striker co-op: authoritative 2-player match for the whole campaign (stage 1 → last stage).
  Every client simulates the same deterministic stage from a shared seed and stage clock; this
  match owns enemy HP and deaths, drops and pickups, aimed shots, downs and revives, the stage
  phases, the team's score and the co-op leaderboards.

  Wire protocol: sky-striker src/net/coop/protocol.ts (JSON payloads on match-state op codes).
  Reference implementation: sky-striker src/net/coop/loopbackServer.ts — both pass the same
  conformance suite (sky-striker nakama/test). Stage data + rule constants come from
  skystriker_data.lua, generated by sky-striker `npm run gen:coop`.

  Written for gopher-lua (Lua 5.1) and fengari (5.3, tests): no bit ops, no // , no goto.
  Runtime env: SKYSTRIKER_API_URL — the game's server, used to verify logins (GET /api/me).
]]

local nk = require("nakama")
local data = require("skystriker_data")

local MODULE = "skystriker_coop"
local TICK_RATE = 20
local MAX_PLAYERS = 2
local EMPTY_TICKS = TICK_RATE * 30      -- nobody connected for 30 s → close the match
local END_LINGER_TICKS = TICK_RATE * 60 -- keep a finished run around for a minute
local CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
local BOARDS = { stage = "skystriker_coop_stage", kills = "skystriker_coop_kills", score = "skystriker_coop_score" }
local R = data.rules
local floor, max, min = math.floor, math.max, math.min

local Op = {
  POS = 1, HITS = 2, GOT_HIT = 3, PICKUP = 4, BOMB = 5, READY = 6, RESYNC = 7, PING = 8, REVIVE = 9,
  STATES = 100, ENEMY_HP = 101, ENEMY_DEAD = 102, DROP = 103, PICKED = 104, PLAYER = 105, PHASE = 106,
  AIMED = 107, SNAPSHOT = 108, PONG = 109,
}

local IN_RUN = { countdown = true, playing = true, bossWarning = true, boss = true, stageClear = true }
local FIGHTING = { playing = true, bossWarning = true, boss = true }
local AIMED_SHOTS = { aimed = true, spread3 = true, burst2 = true }

-- Per stage: enemies by id and the last spawn time
local INDEX = {}
for i, st in ipairs(data.stages) do
  local byid, last = {}, 0
  for _, e in ipairs(st.enemies) do
    byid[e.id] = e
    if e.spawnT > last then last = e.spawnT end
  end
  INDEX[i] = { byid = byid, last_spawn = last }
end

local function cap() return data.maxDps * R.dpsCapMult end

local function decode(raw)
  if type(raw) ~= "string" or raw == "" then return nil end
  local ok, v = pcall(nk.json_decode, raw)
  if ok and type(v) == "table" then return v end
  return nil
end

local function count(t)
  local n = 0
  for _ in pairs(t) do n = n + 1 end
  return n
end

local function try(what, fn, ...)
  local ok, err = pcall(fn, ...)
  if not ok then nk.logger_error(MODULE .. ": " .. what .. " failed: " .. tostring(err)) end
  return ok, err
end

local function label(state)
  local open = (state.phase == "lobby" and count(state.members) < MAX_PLAYERS) and 1 or 0
  return nk.json_encode({ game = "skystriker", open = open, public = state.public and 1 or 0, code = string.lower(state.code) })
end

local function send(dispatcher, op, msg, presences)
  dispatcher.broadcast_message(op, nk.json_encode(msg), presences)
end

local function send_to(dispatcher, state, user_id, op, msg)
  local m = state.members[user_id]
  if m and m.presence then send(dispatcher, op, msg, { m.presence }) end
end

local function stage_of(state) return data.stages[state.stage_index + 1] end
local function stage_time(state, now) return (now - state.stage_t0) / 1000 * R.gameSpeed end

local function phase_msg(state)
  return {
    phase = state.phase, stageIndex = state.stage_index, stages = #data.stages, stageId = stage_of(state).id,
    seed = state.seed, stageT0 = state.stage_t0, bossHp = state.boss_hp, team = state.team, summary = state.summary,
  }
end

local function set_phase(dispatcher, state, phase)
  if state.phase == phase then return end
  state.phase = phase
  send(dispatcher, Op.PHASE, phase_msg(state))
  dispatcher.match_label_update(label(state))
end

local function player_state(m)
  return { id = m.id, x = m.x, y = m.y, t = m.t, fire = m.fire, power = m.power, plane = m.plane, hp = m.hp, alive = m.alive }
end

local function roster(dispatcher, state)
  for _, id in ipairs(state.order) do
    local m = state.members[id]
    send(dispatcher, Op.PLAYER, { id = m.id, name = m.name, plane = m.plane, ready = m.ready, hp = m.hp, alive = m.alive })
  end
end

-- ── leaderboards ──

-- One record per pair of pilots: a UUID formatted from a hash of their sorted game ids
local function pair_owner(gids)
  local h = nk.md5_hash(table.concat(gids, ":"))
  return string.format("%s-%s-%s-%s-%s", h:sub(1, 8), h:sub(9, 12), h:sub(13, 16), h:sub(17, 20), h:sub(21, 32))
end

local function read_pairs(user_id)
  local ok, objs = pcall(nk.storage_read, { { collection = "skystriker", key = "pairs", user_id = user_id } })
  if ok and objs and objs[1] and type(objs[1].value) == "table" and type(objs[1].value.pairs) == "table" then
    return objs[1].value.pairs
  end
  return {}
end

local function remember_pair(user_id, owner)
  local list = read_pairs(user_id)
  for _, o in ipairs(list) do if o == owner then return end end
  list[#list + 1] = owner
  try("storage_write", nk.storage_write, { {
    collection = "skystriker", key = "pairs", user_id = user_id, value = { pairs = list },
    permission_read = 1, permission_write = 0,
  } })
end

local function write_records(state)
  if state.run_start == 0 or state.recorded then return end
  state.recorded = true
  local gids, names, players = {}, {}, {}
  for _, id in ipairs(state.order) do
    local m = state.members[id]
    gids[#gids + 1] = m.gid
    names[#names + 1] = m.name
    players[#players + 1] = { id = m.gid, name = m.name, plane = m.plane }
  end
  table.sort(gids)
  local owner = pair_owner(gids)
  local s = state.summary
  local username = table.concat(names, " & "):sub(1, 120)
  local meta = { players = players, stages = s.stagesCleared, kills = s.kills, score = s.score, timeMs = s.timeMs, result = s.result }
  local secs = floor(s.timeMs / 1000)
  try("record stage", nk.leaderboard_record_write, BOARDS.stage, owner, username, floor(s.stagesCleared), max(0, 1000000000 - secs), meta)
  try("record kills", nk.leaderboard_record_write, BOARDS.kills, owner, username, floor(s.kills), floor(s.stagesCleared), meta)
  try("record score", nk.leaderboard_record_write, BOARDS.score, owner, username, floor(s.score), floor(s.stagesCleared), meta)
  for _, id in ipairs(state.order) do remember_pair(id, owner) end
end

-- ── run flow ──

local function finish(dispatcher, state, result, now)
  local names = {}
  for _, id in ipairs(state.order) do names[#names + 1] = state.members[id].name end
  state.summary = {
    result = result, stagesCleared = state.stages_cleared, kills = state.team.kills, score = state.team.score,
    timeMs = now - state.run_start, names = names,
  }
  write_records(state)
  set_phase(dispatcher, state, result)
end

local function any_alive(state)
  for _, id in ipairs(state.order) do
    local m = state.members[id]
    if m.connected and m.alive then return true end
  end
  return false
end

local function check_failed(dispatcher, state, now)
  if IN_RUN[state.phase] and not any_alive(state) then finish(dispatcher, state, "failed", now) end
end

local function start_stage(dispatcher, state, index, now)
  local st = data.stages[index + 1]
  state.stage_index = index
  state.seed = math.random(0, 2147483646)
  state.stage_t0 = now + R.countdownMs
  state.hp, state.dirty, state.dead, state.next_shot, state.pickups, state.taken = {}, {}, {}, {}, {}, {}
  for _, e in ipairs(st.enemies) do state.hp[e.id] = e.hp end
  state.drops = { powerups = 0, shields = 0, n = 0 }
  state.boss_hp, state.boss_target, state.boss_swap_at = nil, nil, 0
  -- Everyone still connected comes back for the new stage
  for _, id in ipairs(state.order) do
    local m = state.members[id]
    if m.connected then m.alive = true; m.hp = m.max_hp end
    m.budget = cap()
  end
  set_phase(dispatcher, state, "countdown")
end

local function start_run(dispatcher, state, now)
  state.run_start = now
  state.team = { score = 0, kills = 0 }
  state.stages_cleared = 0
  state.summary = nil
  start_stage(dispatcher, state, 0, now)
end

local function stage_cleared(dispatcher, state, now)
  state.stages_cleared = state.stages_cleared + 1
  state.phase_at = now + R.stageClearMs
  set_phase(dispatcher, state, "stageClear")
end

-- Same rules as sky-striker src/game/dropRules.ts pickDrop
local function pick_drop(state, progress)
  if math.random() >= R.dropChance then return nil end
  local d, w = state.drops, R.dropWeights
  local options = { { "health", w.health } }
  if d.powerups < R.maxPowerups and progress >= d.powerups / R.maxPowerups then options[#options + 1] = { "powerup", w.powerup } end
  if d.shields < R.maxShields and progress >= d.shields / R.maxShields then options[#options + 1] = { "shield", w.shield } end
  local total = 0
  for _, o in ipairs(options) do total = total + o[2] end
  local roll = math.random() * total
  for _, o in ipairs(options) do
    roll = roll - o[2]
    if roll < 0 then return o[1] end
  end
  return "health"
end

local function in_window(e, T)
  return e.enterT ~= nil and T >= e.enterT - 0.2 and T <= e.despawnT + 0.5
end

local function apply_hit(dispatcher, state, m, target, dmg, now)
  if not m.alive or type(dmg) ~= "number" or not (dmg > 0) or type(target) ~= "string" then return end
  dmg = min(dmg, m.budget)
  if dmg <= 0 then return end
  if target == "boss" then
    if state.phase ~= "boss" or state.boss_hp == nil or state.boss_hp <= 0 then return end
    m.budget = m.budget - dmg
    state.boss_hp = state.boss_hp - dmg
    state.dirty.boss = true
    if state.boss_hp <= 0 then
      state.boss_hp = 0
      state.dirty.boss = nil
      state.team.kills = state.team.kills + 1
      state.team.score = state.team.score + data.bossScore
      send(dispatcher, Op.ENEMY_DEAD, { id = "boss", by = m.id })
      stage_cleared(dispatcher, state, now)
    end
    return
  end
  if not FIGHTING[state.phase] then return end
  local e = INDEX[state.stage_index + 1].byid[target]
  local T = stage_time(state, now)
  if not e or state.dead[target] or not in_window(e, T) then return end
  m.budget = m.budget - dmg
  local hp = (state.hp[target] or e.hp) - dmg
  state.hp[target] = hp
  if hp > 0 then state.dirty[target] = true return end
  state.dead[target] = true
  state.dirty[target] = nil
  state.team.kills = state.team.kills + 1
  state.team.score = state.team.score + e.score
  send(dispatcher, Op.ENEMY_DEAD, { id = target, by = m.id })
  local kind = pick_drop(state, e.wave / max(1, stage_of(state).waves))
  if kind then
    if kind == "powerup" then state.drops.powerups = state.drops.powerups + 1 end
    if kind == "shield" then state.drops.shields = state.drops.shields + 1 end
    local id = "d" .. state.drops.n
    state.drops.n = state.drops.n + 1
    state.pickups[id] = { id = id, type = kind, enemy = target, t = T }
    send(dispatcher, Op.DROP, state.pickups[id])
  end
end

-- Survivors / star pods the clients spawn on their own (sky-striker coopData.ts scriptedPickupKind)
local function scripted_pickup(id, waves)
  if id == "rescue:start0" or id == "rescue:start1" then return "rescue" end
  local k = tonumber(id:match("^rescue:w(%d+)$"))
  if k then return (k < waves and k % 3 == 1) and "rescue" or nil end
  k = tonumber(id:match("^pod:w(%d+)$"))
  if k then return (k < waves and k > 0 and k % 4 == 0) and "star" or nil end
  return nil
end

local function pickup(dispatcher, state, m, id)
  if not m.alive or not IN_RUN[state.phase] or type(id) ~= "string" or state.taken[id] then return end
  local drop = state.pickups[id]
  local kind = drop and drop.type or scripted_pickup(id, stage_of(state).waves)
  if not kind then return end
  state.taken[id] = true
  state.pickups[id] = nil
  if not drop then
    state.team.score = state.team.score + (kind == "rescue" and data.rescueScore or data.podScore)
  end
  send(dispatcher, Op.PICKED, { id = id, by = m.id, type = kind })
end

local function got_hit(dispatcher, state, m, hp, now)
  if not m.alive or not FIGHTING[state.phase] then return end
  m.hp = max(0, min(m.max_hp, floor(tonumber(hp) or 0)))
  if m.hp > 0 then
    send(dispatcher, Op.PLAYER, { id = m.id, hp = m.hp, alive = true })
    return
  end
  m.alive = false
  m.down_x, m.down_y = m.x, m.y
  send(dispatcher, Op.PLAYER, { id = m.id, hp = 0, alive = false, x = m.x, y = m.y })
  check_failed(dispatcher, state, now)
end

local function revive(dispatcher, state, m, id)
  local t = state.members[id]
  if not m.alive or not t or t == m or t.alive or not t.connected or not FIGHTING[state.phase] then return end
  -- Must actually be near the beacon (POS lags a little, hence the slack)
  local dx, dy = m.x - t.down_x, m.y - t.down_y
  if math.sqrt(dx * dx + dy * dy) > R.reviveRadius * 2 then return end
  t.alive = true
  t.hp = min(R.reviveHp, t.max_hp)
  t.x, t.y = t.down_x, t.down_y
  send(dispatcher, Op.PLAYER, { id = t.id, hp = t.hp, alive = true, revived = true, x = t.x, y = t.y })
end

local function snapshot(state)
  local msg = phase_msg(state)
  local dead, hp, pickups, taken, players = {}, {}, {}, {}, {}
  local byid = INDEX[state.stage_index + 1].byid
  for id in pairs(state.dead) do dead[#dead + 1] = id end
  for id, v in pairs(state.hp) do
    local e = byid[id]
    if not state.dead[id] and e and v < e.hp then hp[#hp + 1] = { id, v } end
  end
  for _, p in pairs(state.pickups) do pickups[#pickups + 1] = p end
  for id in pairs(state.taken) do taken[#taken + 1] = id end
  for _, id in ipairs(state.order) do players[#players + 1] = player_state(state.members[id]) end
  msg.dead, msg.hp, msg.pickups, msg.taken, msg.players = dead, hp, pickups, taken, players
  return msg
end

local function clamp_hp(v) return max(1, min(9, floor(tonumber(v) or 3))) end

local function handle(dispatcher, state, msg, now)
  local m = state.members[msg.sender.user_id]
  if not m then return end
  local op, d = msg.op_code, decode(msg.data) or {}
  if op == Op.PING then
    send_to(dispatcher, state, m.id, Op.PONG, { c = d.c, s = now })
  elseif op == Op.READY then
    m.ready = true
    if type(d.plane) == "string" then m.plane = d.plane end
    if state.phase == "lobby" then
      m.max_hp = clamp_hp(d.hp)
      m.hp = m.max_hp
      roster(dispatcher, state)
      if count(state.members) == MAX_PLAYERS then
        local all = true
        for _, id in ipairs(state.order) do if not state.members[id].ready then all = false end end
        if all then start_run(dispatcher, state, now) end
      end
    else
      send_to(dispatcher, state, m.id, Op.SNAPSHOT, snapshot(state))
      roster(dispatcher, state)
    end
  elseif op == Op.POS then
    if m.connected and type(d.x) == "number" and type(d.y) == "number" then
      m.x, m.y = d.x, d.y
      m.t = tonumber(d.t) or now
      m.fire = d.fire == true
      m.power = floor(tonumber(d.power) or 0)
      if type(d.plane) == "string" then m.plane = d.plane end
    end
  elseif op == Op.HITS then
    if type(d.hits) == "table" then
      for _, h in ipairs(d.hits) do
        if type(h) == "table" then apply_hit(dispatcher, state, m, h[1], h[2], now) end
      end
    end
  elseif op == Op.GOT_HIT then
    got_hit(dispatcher, state, m, d.hp, now)
  elseif op == Op.PICKUP then
    pickup(dispatcher, state, m, d.id)
  elseif op == Op.REVIVE then
    revive(dispatcher, state, m, d.id)
  elseif op == Op.RESYNC then
    send_to(dispatcher, state, m.id, Op.SNAPSHOT, snapshot(state))
  end
end

-- Aimed volleys: each shooter on its own interval, at a random living player
local function enemy_fire(dispatcher, state, T)
  local targets = {}
  for _, id in ipairs(state.order) do
    local m = state.members[id]
    if m.connected and m.alive then targets[#targets + 1] = m end
  end
  if #targets == 0 then return end
  for _, e in ipairs(stage_of(state).enemies) do
    if e.enterT and e.fireInterval > 0 and AIMED_SHOTS[e.shot] and T >= e.enterT and T < e.despawnT and not state.dead[e.id] then
      local nxt = state.next_shot[e.id]
      if nxt == nil then
        nxt = e.enterT + e.fireInterval * (0.5 + 0.5 * math.random())
        state.next_shot[e.id] = nxt
      end
      if T >= nxt then
        state.next_shot[e.id] = T + e.fireInterval
        send(dispatcher, Op.AIMED, { id = e.id, target = targets[math.random(#targets)].id })
      end
    end
  end
end

local function remaining(state, T)
  for _, e in ipairs(stage_of(state).enemies) do
    if not state.dead[e.id] and T < e.despawnT then return true end
  end
  return false
end

-- ── login check ──

local function verify(context, metadata)
  local base = context.env and context.env.SKYSTRIKER_API_URL
  if type(base) ~= "string" or base == "" then return nil, "Co-op server is not configured" end
  local token = metadata and metadata.token
  if type(token) ~= "string" or token == "" then return nil, "Log in to play co-op" end
  local ok, code, _, body = pcall(nk.http_request, base:gsub("/+$", "") .. "/api/me", "GET",
    { Authorization = "Bearer " .. token, Accept = "application/json" }, "", 5000)
  if not ok or code ~= 200 then return nil, "Your login has expired, log in again" end
  local me = decode(body)
  local user = me and me.user
  if type(user) ~= "table" or tonumber(user.id) == nil then return nil, "Your login has expired, log in again" end
  local name = type(user.name) == "string" and user.name:sub(1, 24) or "Pilot"
  return { id = string.format("%d", floor(tonumber(user.id))), name = name }
end

-- ── match handler ──

local function match_init(context, params)
  math.randomseed(floor(nk.time() % 2147483647))
  local code = params and params.code or "AAAAA"
  local state = {
    code = string.upper(code), public = params and params.public == true, phase = "lobby",
    members = {}, order = {}, pending = {},
    stage_index = 0, seed = 0, stage_t0 = 0,
    hp = {}, dirty = {}, dead = {}, next_shot = {}, pickups = {}, taken = {},
    drops = { powerups = 0, shields = 0, n = 0 },
    boss_hp = nil, phase_at = 0, boss_target = nil, boss_swap_at = 0,
    team = { score = 0, kills = 0 }, stages_cleared = 0, run_start = 0, summary = nil, recorded = false,
    last_tick_ms = 0, empty_ticks = 0, ended_ticks = 0,
  }
  return state, TICK_RATE, label(state)
end

local function match_join_attempt(context, dispatcher, tick, state, presence, metadata)
  local identity, err = verify(context, metadata)
  if not identity then return state, false, err end
  if (metadata and metadata.dataVersion) ~= data.version then
    return state, false, "Game version mismatch, reload the page"
  end
  local m = state.members[presence.user_id]
  if m then
    if m.connected then return state, false, "You are already in this room" end
    state.pending[presence.user_id] = identity
    return state, true
  end
  if state.phase ~= "lobby" then return state, false, "This run has already started" end
  if count(state.members) + count(state.pending) >= MAX_PLAYERS then return state, false, "Room is full" end
  state.pending[presence.user_id] = identity
  return state, true
end

local function match_join(context, dispatcher, tick, state, presences)
  for _, p in ipairs(presences) do
    local identity = state.pending[p.user_id]
    state.pending[p.user_id] = nil
    local m = state.members[p.user_id]
    if m then
      m.connected = true
      m.presence = p
      if state.phase ~= "lobby" then send_to(dispatcher, state, m.id, Op.SNAPSHOT, snapshot(state)) end
    elseif identity then
      state.members[p.user_id] = {
        id = p.user_id, gid = identity.id, name = identity.name, plane = "hawk", hp = 3, max_hp = 3,
        ready = false, connected = true, alive = true, x = 0, y = -4, t = 0, fire = false, power = 0,
        budget = cap(), down_x = 0, down_y = -4, presence = p,
      }
      state.order[#state.order + 1] = p.user_id
    end
  end
  roster(dispatcher, state)
  dispatcher.match_label_update(label(state))
  return state
end

local function match_leave(context, dispatcher, tick, state, presences)
  local now = nk.time()
  for _, p in ipairs(presences) do
    local m = state.members[p.user_id]
    if m then
      if state.phase == "lobby" then
        state.members[p.user_id] = nil
        for i, id in ipairs(state.order) do
          if id == p.user_id then table.remove(state.order, i) break end
        end
      else
        m.connected, m.alive, m.hp, m.presence = false, false, 0, nil
        m.down_x, m.down_y = m.x, m.y
      end
      send(dispatcher, Op.PLAYER, { id = p.user_id, hp = 0, alive = false, left = true })
    end
  end
  check_failed(dispatcher, state, now)
  dispatcher.match_label_update(label(state))
  return state
end

local function match_loop(context, dispatcher, tick, state, messages)
  local now = nk.time()
  local dt = state.last_tick_ms > 0 and min(0.25, (now - state.last_tick_ms) / 1000) or 1 / TICK_RATE
  state.last_tick_ms = now
  for _, msg in ipairs(messages) do handle(dispatcher, state, msg, now) end

  local c = cap()
  for _, id in ipairs(state.order) do
    local m = state.members[id]
    m.budget = min(c, m.budget + c * dt * R.gameSpeed)
  end

  if state.phase == "countdown" and now >= state.stage_t0 then set_phase(dispatcher, state, "playing") end
  local T = stage_time(state, now)
  if state.phase == "playing" then
    enemy_fire(dispatcher, state, T)
    if T > INDEX[state.stage_index + 1].last_spawn and not remaining(state, T) then
      state.phase_at = now + R.bossWarningMs
      set_phase(dispatcher, state, "bossWarning")
    end
  elseif state.phase == "bossWarning" and now >= state.phase_at then
    state.boss_hp = stage_of(state).bossHp
    set_phase(dispatcher, state, "boss")
  elseif state.phase == "stageClear" and now >= state.phase_at then
    if state.stage_index + 1 < #data.stages then start_stage(dispatcher, state, state.stage_index + 1, now)
    else finish(dispatcher, state, "complete", now) end
  end
  if state.phase == "boss" and now >= state.boss_swap_at then
    -- The boss switches between living players every few seconds
    local targets, at = {}, 0
    for _, id in ipairs(state.order) do
      local m = state.members[id]
      if m.connected and m.alive then
        targets[#targets + 1] = id
        if id == state.boss_target then at = #targets end
      end
    end
    state.boss_target = #targets > 0 and targets[(at % #targets) + 1] or nil
    state.boss_swap_at = now + R.bossTargetSwapMs
  end

  local hp_list = {}
  for id in pairs(state.dirty) do
    hp_list[#hp_list + 1] = { id, id == "boss" and (state.boss_hp or 0) or (state.hp[id] or 0) }
  end
  if #hp_list > 0 then
    send(dispatcher, Op.ENEMY_HP, { hp = hp_list })
    state.dirty = {}
  end
  if IN_RUN[state.phase] then
    local players = {}
    for _, id in ipairs(state.order) do players[#players + 1] = player_state(state.members[id]) end
    send(dispatcher, Op.STATES, {
      t = now, players = players, bossTarget = state.phase == "boss" and state.boss_target or nil, team = state.team,
    })
  end

  -- Lifecycle: close abandoned matches and finished runs after a while
  local connected = 0
  for _, id in ipairs(state.order) do if state.members[id].connected then connected = connected + 1 end end
  state.empty_ticks = connected == 0 and state.empty_ticks + 1 or 0
  if state.empty_ticks > EMPTY_TICKS then return nil end
  if state.phase == "complete" or state.phase == "failed" then
    state.ended_ticks = state.ended_ticks + 1
    if state.ended_ticks > END_LINGER_TICKS then return nil end
  end
  return state
end

local function match_terminate(context, dispatcher, tick, state, grace_seconds)
  -- Node shutting down mid-run: the pair still gets its record
  if IN_RUN[state.phase] then finish(dispatcher, state, "failed", nk.time()) end
  return state
end

local function match_signal(context, dispatcher, tick, state, payload)
  return state, ""
end

-- ── RPCs ──

local function new_code()
  local out = {}
  for i = 1, 5 do
    local k = math.random(#CODE_CHARS)
    out[i] = CODE_CHARS:sub(k, k)
  end
  return table.concat(out)
end

local function list_matches(query, limit)
  local ok, found = pcall(nk.match_list, limit or 10, true, nil, 0, MAX_PLAYERS, query)
  if ok and type(found) == "table" then return found end
  return {}
end

local function code_query(code) return "+label.game:skystriker +label.code:" .. string.lower(code) end

local function create(public)
  local code = new_code()
  for _ = 1, 4 do
    if #list_matches(code_query(code), 1) == 0 then break end
    code = new_code()
  end
  local match_id = nk.match_create(MODULE, { public = public, code = code })
  return match_id, code
end

local function rpc_create_match(context, payload)
  local match_id, code = create(false)
  return nk.json_encode({ matchId = match_id, code = code })
end

local function rpc_join_code(context, payload)
  local req = decode(payload) or {}
  local code = type(req.code) == "string" and string.upper(req.code:gsub("%s", "")) or ""
  if #code ~= 5 then return nk.json_encode({ error = "Enter the 5-character room code" }) end
  local found = list_matches(code_query(code), 1)
  if #found == 0 then return nk.json_encode({ error = "Room not found" }) end
  return nk.json_encode({ matchId = found[1].match_id, code = code })
end

local function rpc_find_match(context, payload)
  local found = list_matches("+label.game:skystriker +label.open:>=1 +label.public:>=1", 10)
  if #found > 0 then
    local l = decode(found[1].label) or {}
    return nk.json_encode({ matchId = found[1].match_id, code = string.upper(l.code or "") })
  end
  local match_id, code = create(true)
  return nk.json_encode({ matchId = match_id, code = code })
end

local function row(r, mine)
  local meta = r.metadata
  if type(meta) == "string" then meta = decode(meta) end
  return { rank = r.rank, owner = r.owner_id, names = r.username, score = r.score, subscore = r.subscore, metadata = meta, mine = mine or nil }
end

local function rpc_leaderboard(context, payload)
  local req = decode(payload) or {}
  local board = BOARDS[req.board or "stage"]
  if not board then return nk.json_encode({ error = "Unknown board" }) end
  local limit = max(1, min(100, floor(tonumber(req.limit) or 50)))
  local owners = context.user_id and read_pairs(context.user_id) or {}
  local mine = {}
  for _, o in ipairs(owners) do mine[o] = true end
  local ok, records, owner_records = pcall(nk.leaderboard_records_list, board, owners, limit, nil, 0)
  if not ok then
    nk.logger_error(MODULE .. ": leaderboard list failed: " .. tostring(records))
    return nk.json_encode({ rows = {} })
  end
  local rows = {}
  for _, r in ipairs(records or {}) do rows[#rows + 1] = row(r, mine[r.owner_id]) end
  local me = nil
  for _, r in ipairs(owner_records or {}) do
    if r.rank and (not me or r.rank < me.rank) then me = row(r, true) end
  end
  return nk.json_encode({ rows = rows, me = me })
end

for _, id in pairs(BOARDS) do
  try("leaderboard_create " .. id, nk.leaderboard_create, id, true, "desc", "best", nil, { game = "skystriker" }, true)
end

nk.register_rpc(rpc_create_match, "skystriker_create_match")
nk.register_rpc(rpc_join_code, "skystriker_join_code")
nk.register_rpc(rpc_find_match, "skystriker_find_match")
nk.register_rpc(rpc_leaderboard, "skystriker_leaderboard")
nk.logger_info("Sky Striker co-op module loaded (data " .. data.version .. ")")

local handler = {
  match_init = match_init,
  match_join_attempt = match_join_attempt,
  match_join = match_join,
  match_leave = match_leave,
  match_loop = match_loop,
  match_terminate = match_terminate,
  match_signal = match_signal,
}

-- Test-only hook: the vitest mock sets nk.debug_hooks; Nakama never does
if nk.debug_hooks then
  local last
  local loop = handler.match_loop
  handler.match_loop = function(c, d, t, state, msgs)
    local s = loop(c, d, t, state, msgs)
    last = s or last
    return s
  end
  local leave = handler.match_leave
  handler.match_leave = function(c, d, t, state, p) last = leave(c, d, t, state, p) return last end
  nk.register_rpc(function() return nk.json_encode({ phase = last and last.phase or "lobby" }) end, "skystriker_debug_phase")
end

return handler
```
Note: during the lobby, `phase()` reads the state seen by the most recent `match_loop`/`match_leave`, and the driver always advances ≥50 ms before asserting, so that is enough.

- [ ] **Step 4: Run the Lua conformance + data tests**

Run: `npx vitest run nakama/test`
Expected: every conformance case PASSES for `Lua match (skystriker_coop.lua)`, and `generated Lua data` PASSES. Where a case fails, fix the Lua (the TS reference is the oracle), not the test.

- [ ] **Step 5: Commit**
```bash
git add nakama/modules/skystriker_coop.lua nakama/test/luaDriver.ts nakama/test/lua.conformance.test.ts nakama/test/nk_mock.lua
git commit -m "Nakama Lua co-op match: whole-campaign runs, revives, team stats (passes the conformance suite)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Lua-only behaviour: auth, rooms, leaderboards

**Files:**
- Create: `nakama/test/lua.nakama.test.ts`
- Modify: `nakama/modules/skystriker_coop.lua` (only if a test exposes a bug)

**Interfaces:**
- Consumes: `LuaMatch`, `presence`, `luaDriver` (Task 4), `testData()`.

- [ ] **Step 1: Write the tests** `nakama/test/lua.nakama.test.ts`
```ts
import { describe, expect, it } from 'vitest'
import { Op } from '../../src/net/coop/protocol'
import { RULES } from '../../src/net/coop/coopData'
import { testData } from '../../src/net/coop/serverConformance'
import { LuaMatch, presence } from './luaMatch'
import { luaDriver } from './luaDriver'

const READY = { name: 'x', plane: 'hawk', hp: 3, dataVersion: 'test' }

describe('Lua match: joining', () => {
  it('refuses a bad token, a wrong data version and a third player', () => {
    const d = luaDriver(testData())
    expect(d.match.join(presence('eve'), { token: 'nope', dataVersion: 'test' })).toMatchObject({ ok: false, reason: expect.stringMatching(/log/i) })
    expect(d.join('alice', { dataVersion: 'old' })).toMatchObject({ ok: false, reason: expect.stringMatching(/version/i) })
    expect(d.join('alice').ok).toBe(true)
    expect(d.join('bob').ok).toBe(true)
    expect(d.join('carol')).toMatchObject({ ok: false, reason: expect.stringMatching(/full/i) })
  })

  it('refuses to join without SKYSTRIKER_API_URL', () => {
    const m = new LuaMatch({ data: testData() })
    m.init({ code: 'ABCDE' })
    expect(m.join(presence('a'), { token: 't', dataVersion: 'test' })).toMatchObject({ ok: false, reason: expect.stringMatching(/configured/i) })
  })

  it('uses the verified account name, not the READY name', () => {
    const d = luaDriver(testData())
    d.join('alice')
    d.send('alice', Op.READY, { ...READY, name: 'Impostor' })
    d.advance(50)
    const roster = d.drain('alice').filter((m) => m.op === Op.PLAYER).map((m) => (m.data as { name?: string }).name)
    expect(roster).toContain('ALICE')
    expect(roster).not.toContain('Impostor')
  })

  it('a non-member cannot join a run in progress', () => {
    const d = luaDriver(testData())
    d.join('alice'); d.join('bob')
    d.send('alice', Op.READY, READY); d.send('bob', Op.READY, READY)
    d.advance(50)
    d.leave('bob')
    expect(d.join('carol')).toMatchObject({ ok: false, reason: expect.stringMatching(/started/i) })
  })
})

describe('Lua match: rooms', () => {
  it('create → join by code → quick match', () => {
    const m = new LuaMatch({ data: testData() })
    m.setEnv({ SKYSTRIKER_API_URL: 'http://game.test' })
    const created = m.rpc<{ matchId: string; code: string }>('skystriker_create_match', 'u1', {})
    expect(created.code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/)
    m.init({ public: false, code: created.code }, created.matchId)
    expect(m.rpc('skystriker_join_code', 'u2', { code: created.code.toLowerCase() })).toEqual({ matchId: created.matchId, code: created.code })
    expect(m.rpc('skystriker_join_code', 'u2', { code: 'ZZZZZ' })).toMatchObject({ error: 'Room not found' })
    // The private room is not offered by quick match; a new public one is made
    const quick = m.rpc<{ matchId: string }>('skystriker_find_match', 'u3', {})
    expect(quick.matchId).not.toBe(created.matchId)
  })

  it('label: open while the lobby has a free slot', () => {
    const d = luaDriver(testData())
    const label = () => JSON.parse(Object.values(d.match.dump().matches)[0].label)
    expect(label()).toMatchObject({ game: 'skystriker', open: 1, public: 0, code: 'abcde' })
    d.join('alice'); d.join('bob')
    expect(label().open).toBe(0)
  })
})

describe('Lua match: leaderboards', () => {
  function failedRun() {
    const d = luaDriver(testData())
    d.join('alice'); d.join('bob')
    d.send('alice', Op.READY, READY); d.send('bob', Op.READY, READY)
    d.advance(RULES.countdownMs + 100)
    d.advance(Math.ceil((0.6 / RULES.gameSpeed) * 1000))
    d.send('alice', Op.HITS, { hits: [['w0.g0.u0', 20]] })
    d.advance(50)
    d.send('alice', Op.GOT_HIT, { hits: 3, hp: 0 })
    d.send('bob', Op.GOT_HIT, { hits: 3, hp: 0 })
    d.advance(50)
    return d
  }

  it('writes one record per pair on all three boards when the run ends', () => {
    const d = failedRun()
    const { boards, storage } = d.match.dump()
    for (const id of ['skystriker_coop_stage', 'skystriker_coop_kills', 'skystriker_coop_score']) {
      expect(boards[id]).toHaveLength(1)
      expect(boards[id][0].username).toBe('ALICE & BOB')
      expect(boards[id][0].owner_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    }
    expect(boards.skystriker_coop_kills[0].score).toBe(1)
    expect(boards.skystriker_coop_score[0].score).toBe(100)
    expect(boards.skystriker_coop_stage[0].score).toBe(0)
    expect(storage.filter((o) => o.key === 'pairs')).toHaveLength(2)
  })

  it('leaderboard RPC: top rows and my best rank', () => {
    const d = failedRun()
    const res = d.match.rpc<{ rows: { rank: number; names: string; mine?: boolean }[]; me?: { rank: number } }>('skystriker_leaderboard', 'alice', { board: 'kills' })
    expect(res.rows[0]).toMatchObject({ rank: 1, names: 'ALICE & BOB', mine: true })
    expect(res.me?.rank).toBe(1)
    const stranger = d.match.rpc<{ rows: unknown[]; me?: unknown }>('skystriker_leaderboard', 'zed', { board: 'kills' })
    expect(stranger.me).toBeUndefined()
    expect(d.match.rpc('skystriker_leaderboard', 'alice', { board: 'nope' })).toMatchObject({ error: 'Unknown board' })
  })

  it('an abandoned match closes itself', () => {
    const d = luaDriver(testData())
    d.join('alice')
    d.leave('alice')
    d.advance(31_000)
    expect(d.match.ended()).toBe(true)
  })
})
```

- [ ] **Step 2: Run**

Run: `npx vitest run nakama/test/lua.nakama.test.ts`
Expected: PASS. If one fails, fix `skystriker_coop.lua`. Things to check:
- Account names are `ALICE`/`BOB` (the driver sets `name: id.toUpperCase()`).
- The `failedRun` record is written once (the `recorded` flag).

- [ ] **Step 3: Commit**
```bash
git add nakama/test/lua.nakama.test.ts nakama/modules/skystriker_coop.lua
git commit -m "Lua co-op: tests for login checks, room codes, quick match and pair leaderboards

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: CoopSession for whole-campaign runs

**Files:**
- Modify: `src/net/coop/coopSession.ts`, `src/net/coop/coop.test.ts` (replace the skipped loopback describe)

**Interfaces:**
- Consumes: protocol v2 (Task 3), `scriptById`/`scriptedPos`, `Transport` v2.
- Produces:
  ```ts
  interface WorldAdapter {
    startStage(info: { stageId: number; seed: number; stageIndex: number }): void
    self(): { x: number; y: number; fire: boolean; power: number; plane: string; hp: number }
    enemyHp(id: string, hp: number): void
    bossHp(hp: number): void
    enemyDead(id: string, mine: boolean): void
    drop(id: string, type: PickupType, x: number, z: number): void
    picked(id: string, mine: boolean, type: PickupType): void
    aimed(id: string, at: { x: number; y: number }): void
    down(x: number, y: number): void
    revived(x: number, y: number, hp: number): void
    phase(phase: Phase, info: PhaseInfo): void
    lost(reason: string): void
  }
  interface RosterEntry { id: string; name: string; plane: string; ready: boolean }
  interface Downed { id: string; x: number; y: number; self: boolean }
  class CoopSession {
    phase; room; stageIndex; stages; team: TeamStats; summary: RunSummary | null; clock
    start(opts: ConnectOptions & { plane: string; hp: number; dataVersion: string; room: 'create' | 'match' | { code: string } }): Promise<RoomInfo>
    ready(): void; revive(id: string): void; resync(): void; stop(): Promise<void>
    onStop(cb: () => void): () => void
    hooks: NetHooks; drive; stageTime(); teammates(); downedPlayers(): Downed[]; roster(): RosterEntry[]
    status(): SessionStatus & { stageIndex; stages; code: string | null; ready: boolean }
    handle(m); flushHits()
  }
  ```

- [ ] **Step 1: Write the failing tests**: replace the whole `describe('loopback co-op', …)` block in `coop.test.ts`, and the `fakeWorld` helper above it, with:
```ts
// ── loopback flow ──

function fakeWorld() {
  const calls: Record<string, unknown[][]> = {}
  const rec = (k: string) => (...a: unknown[]) => { (calls[k] ??= []).push(a) }
  const world: WorldAdapter = {
    startStage: rec('startStage'),
    self: () => ({ x: 0, y: -4, fire: true, power: 0, plane: 'hawk', hp: 3 }),
    enemyHp: rec('enemyHp'), bossHp: rec('bossHp'), enemyDead: rec('enemyDead'), drop: rec('drop'),
    picked: rec('picked'), aimed: rec('aimed'), down: rec('down'), revived: rec('revived'), phase: rec('phase'), lost: rec('lost'),
  }
  return { world, calls }
}

describe('loopback co-op session', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  async function setup(opts: { data?: CoopData; bot?: boolean } = {}) {
    const now = () => Date.now()
    const server = new LoopbackServer({ data: opts.data, bot: opts.bot, now, random: mulberry32(3) })
    server.startTimer()
    const humans = opts.bot ? 1 : 2
    const clients = []
    for (let i = 0; i < humans; i++) {
      const fw = fakeWorld()
      const session = new CoopSession(new LoopbackTransport(server, { latencyMs: 80, jitterMs: 0 }, now), fw.world, now)
      const started = session.start({ userId: `p${i}`, name: `P${i}`, plane: 'hawk', hp: 3, dataVersion: server.data.version, room: 'create' })
      await vi.advanceTimersByTimeAsync(100)
      await started
      clients.push({ session, ...fw })
    }
    for (const c of clients) c.session.ready()
    await vi.advanceTimersByTimeAsync(200)
    return { server, clients }
  }

  it('READY → countdown → playing on stage 1 with a shared seed; drives the sim; tears down on stop', async () => {
    const { server, clients: [c, d] } = await setup()
    await vi.advanceTimersByTimeAsync(3200)
    expect(c.calls.startStage).toEqual([[{ stageId: 1, seed: server.seed, stageIndex: 0 }]])
    expect(d.calls.startStage).toEqual(c.calls.startStage)
    expect(c.session.phase).toBe('playing')
    expect(c.session.clock.rtt).toBeCloseTo(80, 0)
    expect(c.session.teammates().map((t) => t.id)).toEqual(['p1'])
    expect(c.session.roster().map((r) => r.ready)).toEqual([true, true])
    expect(net()).toBe(d.session.hooks)   // last attached wins in a single process
    c.session.drive()
    expect(stepCount()).toBeGreaterThan(0)
    await c.session.stop(); await d.session.stop()
    expect(net()).toBeNull()
    server.stopTimer()
  })

  it('kills, drops placed from the script, aimed shots resolved to a position', async () => {
    const { server, clients: [c] } = await setup()
    const first = server.stage.enemies.filter((e) => e.enterT !== null && AIMED.has(e.shot)).sort((a, b) => a.enterT! - b.enterT!)[0]
    await vi.advanceTimersByTimeAsync(3000 + (first.enterT! / 0.55) * 1000 + 300)
    c.session.hooks.hit(first.id, first.hp + 1)
    await vi.advanceTimersByTimeAsync(400)
    expect(c.calls.enemyDead).toContainEqual([first.id, true])
    expect(c.session.hooks.spawnAllowed(first.id)).toBe(false)
    expect(c.session.team.kills).toBe(1)
    await vi.advanceTimersByTimeAsync(20_000)
    const [, at] = c.calls.aimed![0] as [string, { x: number; y: number }]
    expect(Number.isFinite(at.x) && Number.isFinite(at.y)).toBe(true)
    for (const [, , x, z] of (c.calls.drop ?? []) as [string, string, number, number][]) expect(Number.isFinite(x) && Number.isFinite(z)).toBe(true)
    server.stopTimer()
  })

  it('down → revive by the teammate', async () => {
    const { server, clients: [c, d] } = await setup()
    await vi.advanceTimersByTimeAsync(3500)
    c.session.hooks.gotHit(3, 0)
    await vi.advanceTimersByTimeAsync(300)
    expect(d.session.downedPlayers()).toEqual([{ id: 'p0', x: 0, y: -4, self: false }])
    d.session.revive('p0')
    await vi.advanceTimersByTimeAsync(300)
    expect(c.calls.revived).toEqual([[0, -4, 2]])
    expect(d.session.downedPlayers()).toEqual([])
    server.stopTimer()
  })

  it('stage clear → next stage → complete with a summary, then detaches', async () => {
    const data = testData()
    const { server, clients: [c, d] } = await setup({ data })
    await vi.advanceTimersByTimeAsync(3200)
    for (let s = 0; s < data.stages.length; s++) {
      await vi.advanceTimersByTimeAsync((1.6 / 0.55) * 1000)
      for (let i = 0; i < 20 && server.phase === 'playing'; i++) {
        for (const e of data.stages[s].enemies) { c.session.hooks.hit(e.id, 150); d.session.hooks.hit(e.id, 150) }
        await vi.advanceTimersByTimeAsync(500)
      }
      await vi.advanceTimersByTimeAsync(2500)
      expect(server.phase).toBe('boss')
      c.session.hooks.hit('boss', 50)
      await vi.advanceTimersByTimeAsync(7400)
    }
    expect(c.calls.startStage!.map((a) => (a[0] as { stageIndex: number }).stageIndex)).toEqual([0, 1])
    expect(c.session.phase).toBe('complete')
    expect(c.session.summary).toMatchObject({ result: 'complete', stagesCleared: 2 })
    expect(net()).toBeNull()
    server.stopTimer()
  })

  it('rejoin mid-run: snapshot marks us down and settles what is gone', async () => {
    const { server, clients: [c] } = await setup()
    await vi.advanceTimersByTimeAsync(3500)
    c.session.hooks.pickup('rescue:start1')
    await vi.advanceTimersByTimeAsync(300)
    await c.session.stop()
    const fw = fakeWorld()
    const back = new CoopSession(new LoopbackTransport(server, { latencyMs: 80, jitterMs: 0 }, Date.now), fw.world, Date.now)
    const started = back.start({ userId: 'p0', name: 'P0', plane: 'hawk', hp: 3, dataVersion: server.data.version, room: { code: 'LOOP1' } })
    await vi.advanceTimersByTimeAsync(300)
    await started
    expect(fw.calls.startStage).toHaveLength(1)
    expect(fw.calls.down).toHaveLength(1)
    expect(back.hooks.spawnAllowed('rescue:start1')).toBe(false)
    server.stopTimer()
  })

  it('a snapshot with {} arrays (Nakama Lua) does not crash', async () => {
    const fw = fakeWorld()
    const s = new CoopSession(new LoopbackTransport(new LoopbackServer()), fw.world)
    expect(() => s.handle({ op: Op.SNAPSHOT, data: {
      phase: 'playing', stageIndex: 0, stages: 10, stageId: 1, seed: 1, stageT0: 0,
      dead: {}, hp: {}, pickups: {}, taken: {}, players: {}, team: { score: 0, kills: 0 },
    } as never })).not.toThrow()
    expect(fw.calls.startStage).toHaveLength(1)
    await s.stop()   // releases the global net hooks / frame driver
    expect(net()).toBeNull()
  })
})
```
Imports at the top of `coop.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClockSync } from './clockSync'
import { InterpolationBuffer } from './interpolation'
import { MAX_EXTRAPOLATE_MS, Op, decode, encode, list, parseServer } from './protocol'
import { CoopSession, type WorldAdapter } from './coopSession'
import { LoopbackServer, LoopbackTransport } from './loopbackServer'
import { testData } from './serverConformance'
import type { CoopData } from './coopData'
import { mulberry32 } from '../../game/sim/rng'
import { stepCount } from '../../game/sim/clock'
import { net } from '../../game/sim/net'

const AIMED = new Set(['aimed', 'spread3', 'burst2'])
```
Also update the old protocol test: `parseServer(Op.ENEMY_DEAD, …)` is unchanged and still valid.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/net/coop/coop.test.ts`
Expected: FAIL. `startStage`/`ready`/`roster` don't exist yet.

- [ ] **Step 3: Rewrite** `src/net/coop/coopSession.ts` (whole file)
```ts
import type { PickupType } from '../../store/gameStore'
import { STEP_GAME, runSteps, setFrameDriver, stepCount } from '../../game/sim/clock'
import { setNetHooks, type NetHooks } from '../../game/sim/net'
import { scriptById, scriptedPos } from '../../game/sim/stageScript'
import { GROUND_SPEED } from '../../game/world'
import { GAME_SPEED } from '../../game/speed'
import { ClockSync } from './clockSync'
import { InterpolationBuffer } from './interpolation'
import {
  HITS_BATCH_MS, IN_RUN, Op, POS_HZ, list,
  type DropInfo, type Hit, type Phase, type PhaseInfo, type PlayerState, type RunSummary, type ServerMessage, type TeamStats,
} from './protocol'
import { Listeners, type ConnectOptions, type RoomInfo, type Transport } from './transport'

/** How the session touches the game. The real one is storeWorld.ts; tests pass a fake. */
export interface WorldAdapter {
  /** A stage of the shared run begins (same stage + seed on every client). */
  startStage(info: { stageId: number; seed: number; stageIndex: number }): void
  /** Our plane right now. */
  self(): { x: number; y: number; fire: boolean; power: number; plane: string; hp: number }
  enemyHp(id: string, hp: number): void
  bossHp(hp: number): void
  /** Server says it's dead. `mine` = our hit finished it. */
  enemyDead(id: string, mine: boolean): void
  /** A drop at (x, z) in the current stage time. */
  drop(id: string, type: PickupType, x: number, z: number): void
  /** Somebody got pickup `id`; apply it if it's us. */
  picked(id: string, mine: boolean, type: PickupType): void
  /** Enemy `id` fires its volley at the point (x, y): its target, as seen on our screen. */
  aimed(id: string, at: { x: number; y: number }): void
  /** We are down (rejoined a run in progress while down). */
  down(x: number, y: number): void
  /** A teammate revived us at (x, y) with `hp`. */
  revived(x: number, y: number, hp: number): void
  phase(phase: Phase, info: PhaseInfo): void
  /** The connection dropped before the run ended. */
  lost(reason: string): void
}

export interface Teammate {
  id: string; name: string
  x: number; y: number
  alive: boolean; fire: boolean; power: number; plane: string; hp: number
}

export interface RosterEntry { id: string; name: string; plane: string; ready: boolean }
/** A downed player's beacon. */
export interface Downed { id: string; x: number; y: number; self: boolean }

export interface SessionStatus {
  phase: Phase
  roomId: string | null
  code: string | null
  selfId: string | null
  rtt: number
  /** Positive: we are behind the shared stage clock by this many steps. */
  behind: number
  teammates: number
  stageIndex: number
  stages: number
  /** We've said READY. */
  ready: boolean
}

const PING_EVERY_MS = 1000
/** Steps per frame: a little faster than real time to absorb jitter; much faster to catch up. */
const SMOOTH_STEPS = 3
const CATCHUP_STEPS = 240
const CATCHUP_AFTER = 30

type Timer = ReturnType<typeof setInterval>

/**
 * One co-op run on the client — the whole campaign: lobby → (countdown → playing → boss →
 * stageClear) per stage → complete | failed. Sends our position (POS, 20 Hz), batched hits
 * (HITS, 100 ms), GOT_HIT / PICKUP / REVIVE / READY / RESYNC; keeps the server clock, the roster
 * and teammates' interpolation buffers; applies server events through WorldAdapter. While a stage
 * runs it drives the simulation clock from the shared stage clock and installs NetHooks.
 */
export class CoopSession {
  readonly clock: ClockSync
  phase: Phase = 'lobby'
  room: RoomInfo | null = null
  stageIndex = 0
  stages = 0
  team: TeamStats = { score: 0, kills: 0 }
  summary: RunSummary | null = null
  private stageT0 = 0
  private stageId = 1
  private seed = 0
  private running = false
  private stopped = false
  private saidReady = false
  private me: { name: string; plane: string; hp: number; dataVersion: string } | null = null
  private hits: Hit[] = []
  private settled = new Set<string>()
  private mates = new Map<string, { buf: InterpolationBuffer; state: PlayerState; name: string }>()
  private names = new Map<string, string>()
  private members = new Map<string, RosterEntry>()
  private downed = new Map<string, { x: number; y: number }>()
  private bossTargetId: string | null = null
  private timers: Timer[] = []
  private unsubs: (() => void)[] = []
  private stopListeners = new Listeners<[]>()
  private lastBehind = 0

  constructor(
    private transport: Transport,
    private world: WorldAdapter,
    private now: () => number = () => performance.now(),
  ) {
    this.clock = new ClockSync(now)
  }

  get selfId(): string | null {
    return this.room?.selfId ?? null
  }

  /** Connect and enter a room: create one (with a code), join by code, or quick match. */
  async start(opts: ConnectOptions & { plane: string; hp: number; dataVersion: string; room: 'create' | 'match' | { code: string } }): Promise<RoomInfo> {
    this.me = { name: opts.name, plane: opts.plane, hp: opts.hp, dataVersion: opts.dataVersion }
    await this.transport.connect(opts)
    this.unsubs.push(
      this.transport.onMessage((m) => this.handle(m)),
      this.transport.onDisconnect((reason) => {
        if (this.stopped) return
        const ended = this.phase === 'complete' || this.phase === 'failed'
        void this.stop()
        if (!ended) this.world.lost(reason)
      }),
    )
    this.room = opts.room === 'create'
      ? await this.transport.createRoom()
      : opts.room === 'match'
        ? await this.transport.matchmake()
        : await this.transport.joinRoom(opts.room.code)
    this.names.set(this.room.selfId, opts.name)
    // A quick burst of pings so the clock is good before the countdown ends
    for (let i = 0; i < 5; i++) setTimeout(() => this.ping(), i * 120)
    this.timers.push(
      setInterval(() => this.ping(), PING_EVERY_MS),
      setInterval(() => this.sendPos(), 1000 / POS_HZ),
      setInterval(() => this.flushHits(), HITS_BATCH_MS),
    )
    return this.room
  }

  /** Lobby: we're ready to launch (the run starts when everyone is). */
  ready(): void {
    if (!this.me) return
    this.saidReady = true
    this.transport.send(Op.READY, { ...this.me })
  }

  /** We hovered over `id`'s beacon long enough. */
  revive(id: string): void {
    this.transport.send(Op.REVIVE, { id })
  }

  async stop(): Promise<void> {
    if (this.stopped) return
    this.stopped = true
    this.timers.forEach(clearInterval)
    this.timers = []
    this.unsubs.forEach((u) => u())
    this.unsubs = []
    this.detach()
    await this.transport.leave().catch(() => {})
    this.stopListeners.emit()
  }

  onStop(cb: () => void): () => void { return this.stopListeners.add(cb) }

  /** Ask for a SNAPSHOT (e.g. we fell far behind or came back from a hidden tab). */
  resync(): void {
    this.transport.send(Op.RESYNC, {})
  }

  // ── what the game calls (NetHooks) ──

  readonly hooks: NetHooks = {
    hit: (target, damage) => { this.hits.push([target, damage]) },
    pickup: (id) => { this.transport.send(Op.PICKUP, { id }) },
    gotHit: (hits, hp) => { this.transport.send(Op.GOT_HIT, { hits, hp }) },
    bossTarget: () => {
      const id = this.bossTargetId
      if (!id || id === this.selfId) return null
      const m = this.teammates().find((t) => t.id === id && t.alive)
      return m ? { x: m.x, y: m.y } : null
    },
    spawnAllowed: (id) => !this.settled.has(id),
  }

  /** Stage time (game seconds) at a server time. Negative during the countdown. */
  stageTime(serverNow = this.clock.serverNow()): number {
    return ((serverNow - this.stageT0) / 1000) * GAME_SPEED
  }

  /** Frame driver: run whole steps until the local sim reaches the shared stage clock. */
  readonly drive = (): number => {
    const target = Math.floor(this.stageTime() / STEP_GAME)
    const behind = target - stepCount()
    this.lastBehind = behind
    if (behind <= 0) return 0
    const n = Math.min(behind, behind > CATCHUP_AFTER ? CATCHUP_STEPS : SMOOTH_STEPS)
    runSteps(n)
    return n
  }

  teammates(serverNow = this.clock.serverNow()): Teammate[] {
    const out: Teammate[] = []
    for (const [id, m] of this.mates) {
      const p = m.buf.sample(serverNow)
      if (!p) continue
      const s = m.state
      out.push({ id, name: m.name, x: p.x, y: p.y, alive: s.alive, fire: s.fire, power: s.power, plane: s.plane, hp: s.hp })
    }
    return out
  }

  downedPlayers(): Downed[] {
    return [...this.downed].map(([id, p]) => ({ id, x: p.x, y: p.y, self: id === this.selfId }))
  }

  roster(): RosterEntry[] {
    return [...this.members.values()]
  }

  status(): SessionStatus {
    return {
      phase: this.phase, roomId: this.room?.roomId ?? null, code: this.room?.code ?? null, selfId: this.selfId,
      rtt: Math.round(this.clock.rtt), behind: this.lastBehind, teammates: this.mates.size,
      stageIndex: this.stageIndex, stages: this.stages, ready: this.saidReady,
    }
  }

  // ── server → client ──

  handle(m: ServerMessage): void {
    const me = this.selfId
    switch (m.op) {
      case Op.PONG:
        this.clock.addSample(m.data.c, m.data.s)
        break
      case Op.STATES:
        this.bossTargetId = m.data.bossTarget ?? null
        if (m.data.team) this.team = m.data.team
        for (const p of list(m.data.players)) {
          if (p.id === me) continue
          let mate = this.mates.get(p.id)
          if (!mate) {
            mate = { buf: new InterpolationBuffer(), state: p, name: this.names.get(p.id) ?? 'Wingmate' }
            this.mates.set(p.id, mate)
          }
          mate.state = p
          mate.buf.push({ t: p.t, x: p.x, y: p.y })
        }
        break
      case Op.PLAYER: {
        const d = m.data
        if (d.name) this.names.set(d.id, d.name)
        if (d.left) {
          this.mates.delete(d.id)
          this.downed.delete(d.id)
          if (this.phase === 'lobby') this.members.delete(d.id)
          break
        }
        if (d.name !== undefined || d.plane !== undefined || d.ready !== undefined) {
          const prev = this.members.get(d.id)
          this.members.set(d.id, {
            id: d.id, name: d.name ?? prev?.name ?? 'Pilot', plane: d.plane ?? prev?.plane ?? 'hawk', ready: d.ready ?? prev?.ready ?? false,
          })
        }
        const mate = this.mates.get(d.id)
        if (mate) {
          mate.state = { ...mate.state, hp: d.hp, alive: d.alive }
          if (d.name) mate.name = d.name
        }
        if (!d.alive && d.x !== undefined && d.y !== undefined) this.downed.set(d.id, { x: d.x, y: d.y })
        if (d.alive) this.downed.delete(d.id)
        if (d.id === me && d.revived && d.x !== undefined && d.y !== undefined) this.world.revived(d.x, d.y, d.hp)
        break
      }
      case Op.PHASE:
        this.applyPhase(m.data)
        break
      case Op.SNAPSHOT: {
        const d = m.data
        this.settled = new Set([...list(d.dead), ...list(d.taken)])
        if (d.team) this.team = d.team
        this.applyPhase({ ...d, bossHp: d.bossHp ?? undefined }, true)
        for (const [id, hp] of list(d.hp)) this.world.enemyHp(id, hp)
        for (const id of list(d.dead)) this.world.enemyDead(id, false)
        for (const p of list(d.pickups)) this.placeDrop(p)
        this.downed.clear()
        for (const p of list(d.players)) {
          if (p.alive) continue
          this.downed.set(p.id, { x: p.x, y: p.y })
          if (p.id === me) this.world.down(p.x, p.y)
        }
        break
      }
      case Op.ENEMY_HP:
        for (const [id, hp] of list(m.data.hp)) {
          if (id === 'boss') this.world.bossHp(hp)
          else this.world.enemyHp(id, hp)
        }
        break
      case Op.ENEMY_DEAD:
        this.settled.add(m.data.id)
        this.world.enemyDead(m.data.id, m.data.by === me)
        break
      case Op.DROP:
        this.placeDrop(m.data)
        break
      case Op.PICKED:
        this.settled.add(m.data.id)
        this.world.picked(m.data.id, m.data.by === me, m.data.type)
        break
      case Op.AIMED:
        if (this.running) this.world.aimed(m.data.id, this.positionOf(m.data.target))
        break
    }
  }

  /** Where player `id` is on our screen (us: exactly; a teammate: interpolated). */
  private positionOf(id: string): { x: number; y: number } {
    if (id !== this.selfId) {
      const t = this.teammates().find((m) => m.id === id)
      if (t) return { x: t.x, y: t.y }
    }
    const s = this.world.self()
    return { x: s.x, y: s.y }
  }

  /** A server drop falls where its enemy was, and has ridden the map since. */
  private placeDrop(p: DropInfo): void {
    const e = scriptById(this.stageId).get(p.enemy)
    if (!e) return
    const at = scriptedPos(e, p.t)
    const z = at.y - Math.max(0, this.stageTime() - p.t) * GROUND_SPEED
    this.world.drop(p.id, p.type, at.x, z)
  }

  private applyPhase(d: PhaseInfo, fromSnapshot = false): void {
    const prev = this.phase
    this.phase = d.phase
    this.stageT0 = d.stageT0
    this.stages = d.stages
    if (d.team) this.team = d.team
    if (d.summary) this.summary = d.summary
    const fresh = IN_RUN.has(d.phase) && (!this.running || d.stageIndex !== this.stageIndex || d.seed !== this.seed)
    if (fresh) {
      this.stageIndex = d.stageIndex
      this.stageId = d.stageId
      this.seed = d.seed
      // A new stage starts clean; a snapshot brings its own settled set
      if (!fromSnapshot) this.settled.clear()
      this.downed.clear()
      this.world.startStage({ stageId: d.stageId, seed: d.seed, stageIndex: d.stageIndex })
      this.attach()
    }
    if (prev !== d.phase || fresh) this.world.phase(d.phase, d)
    if (d.phase === 'complete' || d.phase === 'failed') this.detach()
  }

  // ── client → server ──

  private ping(): void {
    this.transport.send(Op.PING, { c: this.now() })
  }

  private sendPos(): void {
    if (!this.running) return
    const s = this.world.self()
    this.transport.send(Op.POS, { x: s.x, y: s.y, t: this.clock.serverNow(), fire: s.fire, power: s.power, plane: s.plane })
  }

  flushHits(): void {
    if (!this.hits.length) return
    // Merge per target: one entry per enemy per batch
    const sum = new Map<string, number>()
    for (const [id, d] of this.hits) sum.set(id, (sum.get(id) ?? 0) + d)
    this.hits = []
    this.transport.send(Op.HITS, { hits: [...sum] })
  }

  private attach(): void {
    this.running = true
    setNetHooks(this.hooks)
    setFrameDriver(this.drive)
  }

  private detach(): void {
    if (!this.running) return
    this.running = false
    setNetHooks(null)
    setFrameDriver(null)
  }
}
```

- [ ] **Step 4: Run**

Run: `npx vitest run src/net/coop`
Expected: all PASS. The world-dependent files (`storeWorld.ts`, `active.ts`, `nakamaTransport.ts`) still have type errors; Tasks 7–8 fix them.

- [ ] **Step 5: Commit**
```bash
git add src/net/coop/coopSession.ts src/net/coop/coop.test.ts
git commit -m "CoopSession: whole-campaign runs, roster/READY, revives, team stats, script-placed drops

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Game store and gameplay: down/revive, stage transitions, co-op guards

**Files:**
- Modify: `src/store/gameStore.ts`, `src/net/coop/storeWorld.ts`, `src/components/game/Enemies.tsx`, `Player.tsx`, `Pickups.tsx`, `Bullets.tsx`, `GameScene.tsx` (CRLF!)
- Create: `src/net/coop/coopError.ts`, `src/components/game/ReviveBeacon.tsx`, `src/store/gameStore.coop.test.ts`

**Interfaces:**
- Consumes: `WorldAdapter` (Task 6), `REVIVE_RADIUS`, `REVIVE_SECONDS` (Task 1), `activeSession()` (existing in active.ts).
- Produces (store):
  - `GameState` adds `'coopLobby' | 'coopStageClear' | 'coopResults'`.
  - Fields `down: boolean`, `coopStageIndex: number`, `leaderboardMode: 'solo' | 'coop'`.
  - Actions `openCoopLobby()`, `revivePlayer(x, y, hp)`, `openLeaderboard(mode?)`.
- Produces: `setCoopError(msg: string | null)`, `takeCoopError(): string | null`.

- [ ] **Step 1: Failing store test** `src/store/gameStore.coop.test.ts`
```ts
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { useGameStore as Store } from './gameStore'

let useGameStore: typeof Store

beforeAll(async () => {
  const mem = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) })
  vi.stubGlobal('location', { search: '' })
  ;({ useGameStore } = await import('./gameStore'))
})

describe('co-op in the game store', () => {
  it('single-player: 0 HP → results (unchanged)', () => {
    const s = useGameStore.getState()
    s.startGame({ stageId: 1, seed: 1 })
    useGameStore.setState({ invincibleUntil: 0, shieldMs: 0, playerHp: 1 })
    useGameStore.getState().damagePlayer(1)
    expect(useGameStore.getState().gameState).toBe('results')
    expect(useGameStore.getState().down).toBe(false)
  })

  it('co-op: 0 HP → down (no results), frozen controls, no more damage; revive restores', () => {
    useGameStore.getState().startGame({ stageId: 2, seed: 9, mode: 'coop' })
    expect(useGameStore.getState().currentStageId).toBe(2)
    useGameStore.setState({ invincibleUntil: 0, shieldMs: 0, playerHp: 1 })
    useGameStore.getState().damagePlayer(1)
    let st = useGameStore.getState()
    expect(st.gameState).toBe('playing')
    expect(st.down).toBe(true)
    const { playerX, playerY } = st
    st.setPlayerPosition(playerX + 3, playerY + 3)
    expect(useGameStore.getState().playerX).toBe(playerX)
    st.revivePlayer(1, -2, 2)
    st = useGameStore.getState()
    expect(st).toMatchObject({ down: false, playerHp: 2, playerX: 1, playerY: -2 })
    expect(st.invincibleUntil).toBeGreaterThan(Date.now())
  })

  it('co-op: clearing a stage waits for the next one instead of the results screen', () => {
    useGameStore.getState().startGame({ stageId: 1, seed: 2, mode: 'coop' })
    useGameStore.getState().finishStageWin()
    expect(useGameStore.getState().gameState).toBe('coopStageClear')
  })

  it('co-op ignores ?boss / ?easy / ?stage test switches', () => {
    vi.stubGlobal('location', { search: '?boss&easy&stage=7' })
    useGameStore.getState().startGame({ stageId: 3, seed: 2, mode: 'coop' })
    const st = useGameStore.getState()
    expect(st.currentStageId).toBe(3)
    expect(st.easyMode).toBe(false)
    expect(st.gameState).toBe('playing')
    vi.stubGlobal('location', { search: '' })
  })
})
```
Run: `npx vitest run src/store/gameStore.coop.test.ts`
Expected: FAIL (no `down`/`revivePlayer`, co-op goes to results).

- [ ] **Step 2: Store changes** in `src/store/gameStore.ts`
  1. `GameState` union: append `| 'coopLobby' | 'coopStageClear' | 'coopResults'`.
  2. Interface additions, next to `mode`:
  ```ts
  /** Co-op: shot down, waiting for a wingmate's revive (plane hidden, controls off). */
  down: boolean
  /** Co-op: position of the current stage in the campaign run (0-based). */
  coopStageIndex: number
  /** Which board the leaderboard screen opens on. */
  leaderboardMode: 'solo' | 'coop'
  ```
  Action signatures:
  ```ts
  openLeaderboard: (mode?: 'solo' | 'coop') => void
  openCoopLobby: () => void
  /** Co-op: a wingmate brought us back at (x, y) with `hp`. */
  revivePlayer: (x: number, y: number, hp: number) => void
  ```
  (replace the existing `openLeaderboard: () => void`).
  3. Initial state: add `down: false, coopStageIndex: 0, leaderboardMode: 'solo',` to the object literal.
  4. Constant next to `IFRAMES`: `const REVIVE_IFRAMES = 2000`.
  5. `openLeaderboard: (mode = 'solo') => set((s) => ({ gameState: 'leaderboard', hangarReturn: s.gameState, leaderboardMode: mode })),`
     `openCoopLobby: () => set({ gameState: 'coopLobby' }),`
  6. In `startGame`:
  ```ts
    const coop = opts.mode === 'coop'
    // Test switches are single-player only: co-op runs the server's stage at normal difficulty
    const easy = !coop && (!!opts.easy || new URLSearchParams(location.search).has('easy'))
    const skip = !coop && (!!opts.skipToBoss || new URLSearchParams(location.search).has('boss'))
    const q = new URLSearchParams(location.search)
    // ?stage=N (dev/testing) overrides the chosen stage
    const stageId = (coop && opts.stageId) || Number(q.get('stage')) || opts.stageId || get().selectedStageId || 1
  ```
  and add `down: false,` in the big `set({...})`.
  7. `setPlayerPosition: (x, y) => get().flyout || get().down ? undefined : set({...})`.
  8. `damagePlayer`:
  ```ts
    const { invincibleUntil, shieldMs, playerHp, runStats, victoryMs, flyout, down } = get()
    if (down || Date.now() < invincibleUntil || victoryMs > 0 || flyout) return
    …
    net()?.gotHit(hits, hp)
    if (hp <= 0) {
      // Co-op: shot down, not out — a wingmate can revive us (the server ends the run when nobody's left)
      if (get().mode === 'coop') set({ down: true })
      else get().finalizeResults(false)
    }
  ```
  9. `revivePlayer`:
  ```ts
  revivePlayer: (x, y, hp) => set((s) => ({
    down: false,
    playerHp: Math.max(1, Math.min(s.playerMaxHp, hp)),
    playerX: Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, x)),
    playerY: Math.max(BOUNDS.minY, Math.min(BOUNDS.maxY, y)),
    invincibleUntil: Date.now() + REVIVE_IFRAMES,
  })),
  ```
  10. `finalizeResults`, right after `if (s.gameState === 'results') return`:
  ```ts
    // Co-op: the server keeps the score and moves the run on; no saga progress or gold stars
    if (s.mode === 'coop') {
      set({ gameState: won ? 'coopStageClear' : 'coopResults', enemies: [], bullets: [], boss: null })
      return
    }
  ```

Run: `npx vitest run src/store/gameStore.coop.test.ts`
Expected: PASS.

- [ ] **Step 3: `src/net/coop/coopError.ts`**
```ts
/** Why the last co-op attempt ended badly (connection lost, refused…), shown once by the lobby. */
let last: string | null = null
export const setCoopError = (msg: string | null) => { last = msg }
export function takeCoopError(): string | null {
  const m = last
  last = null
  return m
}
```

- [ ] **Step 4: Rewrite** `src/net/coop/storeWorld.ts`
```ts
import { useGameStore } from '../../store/gameStore'
import { ROLE_STATS } from '../../game/roster'
import { getStage } from '../../game/stages'
import { getPlane } from '../../game/planes'
import { inFireZone } from '../../game/world'
import { ENEMY_BULLET, enemyVolley } from '../../components/game/Enemies'
import { applyPickup, bossKilled, enemyKilled } from '../../components/game/effects'
import { setCoopError } from './coopError'
import type { WorldAdapter } from './coopSession'

/** WorldAdapter over the zustand game store: how server events show up in the running game. */
export function storeWorld(): WorldAdapter {
  const get = useGameStore.getState
  return {
    startStage: ({ stageId, seed, stageIndex }) => {
      // Each pilot keeps their gun through the run; the first stage starts from scratch
      useGameStore.setState({ carryWeapon: stageIndex > 0 ? get().weaponPower : 0, coopStageIndex: stageIndex })
      get().startGame({ stageId, seed, mode: 'coop' })
    },

    self: () => {
      const s = get()
      return {
        x: s.playerX, y: s.playerY,
        fire: s.gameState === 'playing' && !s.flyout && !s.down && s.playerHp > 0,
        power: s.weaponPower, plane: s.progress.plane, hp: s.playerHp,
      }
    },

    enemyHp: (id, hp) => get().setEnemyHp(id, hp),
    bossHp: (hp) => get().setBossHp(hp),

    enemyDead: (id, mine) => {
      const s = get()
      if (id === 'boss') {
        if (s.boss) { bossKilled(s.boss.x, s.boss.y, { mine }); s.defeatBoss() }
        return
      }
      const e = s.enemies.find((x) => x.id === id)
      // Not spawned here yet (we're catching up): spawnAllowed() keeps it from appearing
      if (!e) return
      enemyKilled(e, { mine, rollDrops: false })
      s.removeEnemy(id)
    },

    drop: (id, type, x, z) => get().addPickup({ id, type, x, y: 0.3, z }),

    picked: (id, mine, type) => {
      get().removePickup(id)
      if (mine) applyPickup(type)
    },

    aimed: (id, at) => {
      const s = get()
      const e = s.enemies.find((x) => x.id === id)
      // Same rule as a local shot: only from inside the playfield
      if (!e || !e.entered || s.gameState !== 'playing' || !inFireZone(e.x, e.y)) return
      const speed = ENEMY_BULLET.speed * getStage(s.currentStageId).bulletSpeedMult
      enemyVolley(e.x, e.y, ROLE_STATS[e.type].shot, Math.atan2(at.x - e.x, at.y - e.y), speed)
    },

    down: (x, y) => useGameStore.setState({ down: true, playerHp: 0, playerX: x, playerY: y }),
    revived: (x, y, hp) => get().revivePlayer(x, y, hp),

    phase: (phase, info) => {
      const s = get()
      if (phase === 'bossWarning') useGameStore.setState({ gameState: 'bossWarning' })
      else if (phase === 'boss') {
        if (!s.boss) s.spawnBoss()
        if (info.bossHp) get().setBossHp(info.bossHp)
      } else if (phase === 'complete' || phase === 'failed') {
        useGameStore.setState({ gameState: 'coopResults', enemies: [], bullets: [], boss: null })
      }
    },

    lost: (reason) => {
      setCoopError(`Connection lost (${reason})`)
      useGameStore.setState({ gameState: 'coopLobby', mode: 'single', down: false, enemies: [], bullets: [], boss: null })
    },
  }
}

/** Our plane's hull, for READY. */
export const selfHp = () => getPlane(useGameStore.getState().progress.plane).hp
```

- [ ] **Step 5: Gameplay guards**
  - `Enemies.tsx`:
    - Add `const runKey = useRef('')` next to `lastWave`.
    - In the subscribe callback, before the wave check, insert:
    ```ts
      // A new run (co-op's next stage can start without leaving 'playing'): forget the old queue
      const run = `${s.currentStageId}:${s.runSeed}`
      if (run !== runKey.current) {
        runKey.current = run
        lastWave.current = -1
        queue.current = []
        clock.current = 0
      }
    ```
    - In the ram loop, change `if (isGround(e.type)) continue` to `if (isGround(e.type) || s.down) continue`.
  - `Player.tsx`:
    - Step guard: `if (s.gameState !== 'playing' || s.flyout || s.down) return`.
    - In `useFrame`: `group.current.visible = !blink && !s.down`.
  - `Pickups.tsx`: inside the step, after `const n = net()`, add `const canTouch = !s.down`. Then:
    - Rescue: `const near = canTouch && Math.hypot(...) < RESCUE_RADIUS`.
    - Drops: `if (canTouch && Math.hypot(...) < 0.85) {`.
  - `Bullets.tsx`: in the enemy-bullet branch, change `if (Math.hypot(b.x - s.playerX, b.z - s.playerY) < 0.55 + b.radius) {` to `if (!s.down && Math.hypot(b.x - s.playerX, b.z - s.playerY) < 0.55 + b.radius) {`.
  - `GameScene.tsx` (CRLF — Edit tool only):
    - Escape handler: `if (st.gameState === 'playing' && st.mode !== 'coop') st.pauseGame()`.
    - Import `ReviveBeacon` and render `{coop && <ReviveBeacon />}` next to `{coop && <Teammates />}`.

- [ ] **Step 6: `src/components/game/ReviveBeacon.tsx`**
```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../store/gameStore'
import { ORDER } from '../../game/sim/clock'
import { useSimStep } from '../../game/sim/useSimStep'
import { REVIVE_RADIUS, REVIVE_SECONDS } from '../../net/coop/coopData'
import { activeSession } from '../../net/coop/active'
import type { Downed } from '../../net/coop/coopSession'

const ARC_STEPS = 48
const RING_IN = 0.9, RING_OUT = 1.1

/**
 * Co-op SOS beacons where pilots went down. Hovering over a teammate's beacon for a few seconds
 * fills its ring and asks the server to revive them (REVIVE); the server's PLAYER says it worked.
 */
export function ReviveBeacon() {
  const [beacons, setBeacons] = useState<(Downed & { progress: number })[]>([])
  const progress = useRef(new Map<string, number>())
  const sent = useRef(new Set<string>())

  useSimStep(ORDER.pickups, ({ realDt }) => {
    const session = activeSession()
    const s = useGameStore.getState()
    if (!session || s.gameState !== 'playing') return
    const list = session.downedPlayers()
    const live = new Set(list.map((b) => b.id))
    for (const id of [...progress.current.keys()]) if (!live.has(id)) { progress.current.delete(id); sent.current.delete(id) }
    for (const b of list) {
      if (b.self) continue
      const near = !s.down && Math.hypot(b.x - s.playerX, b.y - s.playerY) < REVIVE_RADIUS
      const p = progress.current.get(b.id) ?? 0
      const next = near ? Math.min(1, p + realDt / REVIVE_SECONDS) : Math.max(0, p - realDt / (REVIVE_SECONDS * 2))
      progress.current.set(b.id, next)
      if (next >= 1 && !sent.current.has(b.id)) { session.revive(b.id); sent.current.add(b.id) }
    }
    const view = list.map((b) => ({ ...b, progress: Math.round((progress.current.get(b.id) ?? 0) * ARC_STEPS) / ARC_STEPS }))
    const key = view.map((b) => `${b.id}:${b.progress}:${b.x.toFixed(1)}`).join()
    if (key !== beacons.map((b) => `${b.id}:${b.progress}:${b.x.toFixed(1)}`).join()) setBeacons(view)
  })

  return <>{beacons.map((b) => <Beacon key={b.id} beacon={b} />)}</>
}

function Beacon({ beacon }: { beacon: Downed & { progress: number } }) {
  const pulse = useRef<THREE.Mesh>(null)
  const steps = Math.round(beacon.progress * ARC_STEPS)
  const arc = useMemo(() => {
    if (steps <= 0) return null
    const len = (steps / ARC_STEPS) * Math.PI * 2
    return new THREE.RingGeometry(RING_IN, RING_OUT, ARC_STEPS, 1, Math.PI / 2 - len, len)
  }, [steps])
  useEffect(() => () => arc?.dispose(), [arc])
  useFrame(({ clock }) => {
    if (!pulse.current) return
    const k = (clock.elapsedTime * 1.2) % 1
    pulse.current.scale.setScalar(1 + k * 0.8)
    ;(pulse.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k)
  })
  const color = beacon.self ? '#ff8a80' : '#ff1744'
  return (
    <group position={[beacon.x, 0.4, beacon.y]} rotation={[-Math.PI / 2, 0, Math.PI]}>
      <mesh><ringGeometry args={[RING_IN, RING_OUT, 48]} /><meshBasicMaterial color="#000000" transparent opacity={0.45} depthWrite={false} /></mesh>
      {arc && <mesh geometry={arc} position={[0, 0, 0.01]}><meshBasicMaterial color="#3dff8a" toneMapped={false} /></mesh>}
      <mesh ref={pulse}><ringGeometry args={[0.55, 0.65, 32]} /><meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} /></mesh>
      {/* SOS cross */}
      <mesh position={[0, 0, 0.02]}><planeGeometry args={[0.18, 0.7]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
      <mesh position={[0, 0, 0.02]}><planeGeometry args={[0.7, 0.18]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
    </group>
  )
}
```
`activeSession` is imported from `active.ts`, which Task 8 rewrites. Its export name stays the same.

- [ ] **Step 7: Typecheck the touched game files**

Run: `npx tsc --noEmit 2>&1 | grep -v "src/net/coop/\(active\|nakamaTransport\)" | head -30`
Expected: no errors outside `active.ts`/`nakamaTransport.ts` (Task 8).

Run: `npx vitest run`
Expected: all PASS (Lua tests included).

- [ ] **Step 8: Commit** (check that `git diff --stat` shows GameScene.tsx with only a few lines)
```bash
git add src/store/gameStore.ts src/store/gameStore.coop.test.ts src/net/coop/storeWorld.ts src/net/coop/coopError.ts src/components/game/Enemies.tsx src/components/game/Player.tsx src/components/game/Pickups.tsx src/components/game/Bullets.tsx src/components/game/GameScene.tsx src/components/game/ReviveBeacon.tsx
git commit -m "Co-op gameplay: shot down → revive beacons, stage-to-stage runs, co-op-only store branches

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Nakama client, transport and session entry points

**Files:**
- Create: `src/net/coop/nakamaClient.ts`, `src/net/coop/coopApi.ts`
- Modify: `src/net/coop/nakamaTransport.ts`, `src/net/coop/active.ts`, `src/main.tsx` (unchanged API; verify only)

**Interfaces:**
- Consumes: `CoopSession`, `storeWorld`, `coopData`, `useAccount`, `readToken`.
- Produces:
  ```ts
  nakamaConfig(): NakamaConfig
  customId(playerId: string): string
  nakamaSession(playerId: string): Promise<{ client: Client; session: Session }>
  nakamaRpc<T>(playerId: string, id: string, payload: object): Promise<T>
  coopLeaderboard(board: CoopBoard): Promise<CoopBoardResult>  // uses the logged-in account
  type CoopBoard = 'stage' | 'kills' | 'score'
  interface CoopRow { rank: number; owner: string; names: string; score: number; subscore: number; mine?: boolean; metadata?: { timeMs?: number; stages?: number; kills?: number; score?: number } }
  interface CoopBoardResult { rows: CoopRow[]; me: CoopRow | null }
  startNakamaCoop(room: 'create' | 'match' | { code: string }): Promise<CoopSession>
  startLoopbackCoop(q: URLSearchParams): Promise<CoopSession>
  stopCoop(): Promise<void>
  activeSession(); sessionLabel(); lastRoomCode(): string | null
  ```

- [ ] **Step 1: `src/net/coop/nakamaClient.ts`**
```ts
import type { Client, Session } from '@heroiclabs/nakama-js'

/** Where the Nakama cluster is (VITE_NAKAMA_* at build time; defaults = the shared ZPS cluster). */
export interface NakamaConfig { serverKey: string; host: string; port: string; useSSL: boolean }

export function nakamaConfig(): NakamaConfig {
  const env = import.meta.env
  return {
    serverKey: env.VITE_NAKAMA_KEY || 'defaultkey',
    host: env.VITE_NAKAMA_HOST || 'nakama.zingplay.dev',
    port: env.VITE_NAKAMA_PORT || '443',
    useSSL: (env.VITE_NAKAMA_SSL || 'true') === 'true',
  }
}

/** Nakama custom id for a game account (6–128 chars). The match verifies the game login itself. */
export const customId = (playerId: string) => `skystriker-${playerId}`

let conn: { playerId: string; promise: Promise<{ client: Client; session: Session }> } | null = null

/** One Nakama session per game account, refreshed when it is about to expire. nakama-js loads on demand. */
export async function nakamaSession(playerId: string): Promise<{ client: Client; session: Session }> {
  if (conn && conn.playerId === playerId) {
    const c = await conn.promise.catch(() => null)
    if (c && !c.session.isexpired(Date.now() / 1000 + 60)) return c
  }
  const promise = (async () => {
    const { Client } = await import('@heroiclabs/nakama-js')
    const { serverKey, host, port, useSSL } = nakamaConfig()
    const client = new Client(serverKey, host, port, useSSL)
    const session = await client.authenticateCustom(customId(playerId), true)
    return { client, session }
  })()
  conn = { playerId, promise }
  return promise
}

export async function nakamaRpc<T>(playerId: string, id: string, payload: object): Promise<T> {
  const { client, session } = await nakamaSession(playerId)
  const res = await client.rpc(session, id, payload)
  const raw = res.payload as unknown
  return (typeof raw === 'string' ? JSON.parse(raw || '{}') : raw ?? {}) as T
}
```

- [ ] **Step 2: Rewrite** `src/net/coop/nakamaTransport.ts`
```ts
import type { Socket } from '@heroiclabs/nakama-js'
import { encode, parseServer, type ClientMessages, type ClientOp, type ServerMessage } from './protocol'
import { Listeners, type ConnectOptions, type RoomInfo, type Transport } from './transport'
import { nakamaConfig, nakamaRpc, nakamaSession } from './nakamaClient'

/**
 * Transport over the Sky Striker co-op match (nakama/modules/skystriker_coop.lua): rooms come from
 * the skystriker_* RPCs, the match verifies our game login from the join metadata.
 */
export class NakamaTransport implements Transport {
  private socket: Socket | null = null
  private matchId: string | null = null
  private playerId = ''
  private meta: Record<string, string> = {}
  private messages = new Listeners<[ServerMessage]>()
  private disconnects = new Listeners<[string]>()

  async connect(opts: ConnectOptions): Promise<void> {
    this.playerId = opts.userId
    this.meta = { token: opts.token ?? '', plane: opts.plane ?? 'hawk', dataVersion: opts.dataVersion ?? '' }
    const { client, session } = await nakamaSession(opts.userId)
    const socket = client.createSocket(nakamaConfig().useSSL, false)
    socket.onmatchdata = (d) => {
      const msg = parseServer(d.op_code, d.data, d.presence?.user_id)
      if (msg) this.messages.emit(msg)
    }
    socket.ondisconnect = () => this.disconnects.emit('socket closed')
    await socket.connect(session, true)
    this.socket = socket
  }

  private async join(matchId: string, code: string): Promise<RoomInfo> {
    try {
      const match = await this.need().joinMatch(matchId, undefined, this.meta)
      this.matchId = match.match_id
      return { roomId: match.match_id, selfId: match.self.user_id, code }
    } catch (e) {
      // The match's join_attempt reason, e.g. "Room is full"
      const reason = (e as { message?: string })?.message
      throw new Error(reason || 'Could not join the room')
    }
  }

  private async room(rpc: string, payload: object): Promise<RoomInfo> {
    const r = await nakamaRpc<{ matchId?: string; code?: string; error?: string }>(this.playerId, rpc, payload)
    if (!r.matchId) throw new Error(r.error || 'No room available')
    return this.join(r.matchId, r.code ?? '')
  }

  createRoom(): Promise<RoomInfo> { return this.room('skystriker_create_match', {}) }
  joinRoom(code: string): Promise<RoomInfo> { return this.room('skystriker_join_code', { code }) }
  matchmake(): Promise<RoomInfo> { return this.room('skystriker_find_match', {}) }

  send<K extends ClientOp>(op: K, data: ClientMessages[K]): void {
    if (!this.socket || !this.matchId) return
    void this.socket.sendMatchState(this.matchId, op, encode(data)).catch(() => {})
  }

  onMessage(cb: (msg: ServerMessage) => void): () => void { return this.messages.add(cb) }
  onDisconnect(cb: (reason: string) => void): () => void { return this.disconnects.add(cb) }

  async leave(): Promise<void> {
    const socket = this.socket
    this.socket = null
    if (socket && this.matchId) await socket.leaveMatch(this.matchId).catch(() => {})
    this.matchId = null
    socket?.disconnect(false)
    this.messages.clear()
  }

  private need(): Socket {
    if (!this.socket) throw new Error('NakamaTransport: call connect() first')
    return this.socket
  }
}
```

- [ ] **Step 3: `src/net/coop/coopApi.ts`**
```ts
import { useAccount } from '../../store/account'
import { list } from './protocol'
import { nakamaRpc } from './nakamaClient'

export type CoopBoard = 'stage' | 'kills' | 'score'
export interface CoopRow {
  rank: number; owner: string; names: string; score: number; subscore: number; mine?: boolean
  metadata?: { timeMs?: number; stages?: number; kills?: number; score?: number }
}
export interface CoopBoardResult { rows: CoopRow[]; me: CoopRow | null }

/** A co-op leaderboard (top 50 + my best pair), for the logged-in account. */
export async function coopLeaderboard(board: CoopBoard): Promise<CoopBoardResult> {
  const user = useAccount.getState().user
  if (!user) throw new Error('Log in to see the co-op leaderboards')
  const r = await nakamaRpc<{ rows?: CoopRow[]; me?: CoopRow; error?: string }>(String(user.id), 'skystriker_leaderboard', { board, limit: 50 })
  if (r.error) throw new Error(r.error)
  return { rows: list(r.rows), me: r.me ?? null }
}
```

- [ ] **Step 4: Rewrite** `src/net/coop/active.ts`
```ts
import { useGameStore } from '../../store/gameStore'
import { useAccount } from '../../store/account'
import { readToken } from '../api'
import { CoopSession } from './coopSession'
import { coopData } from './coopData'
import { LoopbackServer, LoopbackTransport } from './loopbackServer'
import { NakamaTransport } from './nakamaTransport'
import { selfHp, storeWorld } from './storeWorld'

/** The co-op session currently running (null in single-player). */
let active: CoopSession | null = null
let label = ''

export const activeSession = () => active
export const sessionLabel = () => label

const ROOM_KEY = 'sky-striker-coop-room'
/** Code of the last room we were in (for REJOIN after a reload or a dropped connection). */
export const lastRoomCode = () => sessionStorage.getItem(ROOM_KEY)

function track(session: CoopSession, name: string): void {
  active = session
  label = name
  session.onStop(() => {
    if (active === session) { active = null; label = '' }
  })
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__coop = session
}

/** Enter a co-op room on the Nakama cluster (needs a game login; the match verifies it). */
export async function startNakamaCoop(room: 'create' | 'match' | { code: string }): Promise<CoopSession> {
  await stopCoop()
  const { status, user } = useAccount.getState()
  if (status !== 'user' || !user) throw new Error('Log in to play co-op')
  const session = new CoopSession(new NakamaTransport(), storeWorld())
  track(session, 'ONLINE')
  try {
    const info = await session.start({
      userId: String(user.id), name: user.name, token: readToken() ?? '',
      plane: useGameStore.getState().progress.plane, hp: selfHp(), dataVersion: coopData().version, room,
    })
    if (info.code) sessionStorage.setItem(ROOM_KEY, info.code)
  } catch (e) {
    await stopCoop()
    throw e
  }
  return session
}

/**
 * Dev / test entry (`?coop=loopback[&stage=N&lat=80&jitter=20]`): an in-browser authoritative
 * server with a bot wingmate, reached through a simulated network. Starts right away.
 */
export async function startLoopbackCoop(q: URLSearchParams): Promise<CoopSession> {
  await stopCoop()
  const latencyMs = Number(q.get('lat') ?? 80)
  const jitterMs = Number(q.get('jitter') ?? 20)
  const server = new LoopbackServer({ bot: true, startStage: (Number(q.get('stage')) || 1) - 1 })
  server.startTimer()
  const session = new CoopSession(new LoopbackTransport(server, { latencyMs, jitterMs }), storeWorld())
  track(session, `LOOPBACK ${latencyMs}±${jitterMs}ms`)
  session.onStop(() => server.stopTimer())
  const s = useGameStore.getState()
  await session.start({ userId: 'me', name: 'YOU', plane: s.progress.plane, hp: selfHp(), dataVersion: server.data.version, room: 'create' })
  session.ready()
  if (import.meta.env.DEV) {
    const w = window as unknown as Record<string, unknown>
    w.__coopServer = server
    w.__coopDebug = () => ({ ...session.status(), serverPhase: server.phase, serverStage: server.stageIndex, serverT: +server.stageTime().toFixed(1) })
  }
  return session
}

/** Leave the room (if any) and go back to single-player mode. */
export async function stopCoop(): Promise<void> {
  const s = active
  active = null
  label = ''
  await s?.stop()
  useGameStore.setState({ mode: 'single', down: false })
}

/** The run is over (results screen left): forget the rejoin code too. */
export function forgetRoom(): void {
  sessionStorage.removeItem(ROOM_KEY)
}
```

- [ ] **Step 5: Typecheck + tests + build**

Run: `npx tsc --noEmit`
Expected: no errors. If `import.meta.env.VITE_*` is typed `any`, that's fine. If `Socket.joinMatch` metadata typing complains, cast: `this.meta as Record<string, string>`.

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 6: Commit**
```bash
git add src/net/coop/nakamaClient.ts src/net/coop/nakamaTransport.ts src/net/coop/coopApi.ts src/net/coop/active.ts
git commit -m "Co-op on Nakama: custom auth per game account, room RPCs, login-verified joins

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Co-op UI: lobby, stage-clear card, results, HUD, menu

**Files:**
- Create: `src/components/ui/useCoop.ts`, `CoopLobby.tsx`, `CoopStageClear.tsx`, `CoopResults.tsx`
- Modify: `src/components/ui/UI.tsx`, `HUD.tsx`, `MainMenu.tsx`, `CoopBadge.tsx`

**Interfaces:**
- Consumes: `activeSession`, `startNakamaCoop`, `stopCoop`, `forgetRoom`, `lastRoomCode` (Task 8), `takeCoopError` (Task 7), `coopLeaderboard` (Task 8), `LoginButtons` (Account.tsx), `useAccount`.
- Produces: `useCoopStatus(): { status: SessionStatus | null; team: TeamStats; summary: RunSummary | null; roster: RosterEntry[] }` (polls every 250 ms).

- [ ] **Step 1: `src/components/ui/useCoop.ts`**
```ts
import { useEffect, useState } from 'react'
import { activeSession } from '../../net/coop/active'
import type { RosterEntry, SessionStatus } from '../../net/coop/coopSession'
import type { RunSummary, TeamStats } from '../../net/coop/protocol'

export interface CoopView { status: SessionStatus | null; team: TeamStats; summary: RunSummary | null; roster: RosterEntry[] }

const read = (): CoopView => {
  const s = activeSession()
  return { status: s?.status() ?? null, team: s?.team ?? { score: 0, kills: 0 }, summary: s?.summary ?? null, roster: s?.roster() ?? [] }
}

/** The running co-op session, polled for the UI (same cadence as CoopBadge). */
export function useCoopStatus(ms = 250): CoopView {
  const [view, setView] = useState(read)
  useEffect(() => {
    const id = setInterval(() => setView(read()), ms)
    return () => clearInterval(id)
  }, [ms])
  return view
}
```

- [ ] **Step 2: `src/components/ui/CoopLobby.tsx`**
```tsx
import { useEffect, useState, type CSSProperties } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useAccount } from '../../store/account'
import { activeSession, lastRoomCode, startNakamaCoop, stopCoop } from '../../net/coop/active'
import { takeCoopError } from '../../net/coop/coopError'
import { getPlane } from '../../game/planes'
import { sounds } from '../../hooks/useAudio'
import { LoginButtons } from './Account'
import { useCoopStatus } from './useCoop'

/** Co-op lobby: quick match / create a room / join by code, then the room with both pilots and READY. */
export function CoopLobby() {
  const setGameState = useGameStore((s) => s.setGameState)
  const status = useAccount((s) => s.status)
  const { status: room, roster } = useCoopStatus(200)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(() => takeCoopError())
  const [code, setCode] = useState('')
  const rejoin = lastRoomCode()

  useEffect(() => {
    // Back in the lobby with a finished or dead session: clean it up
    const s = activeSession()
    if (s && (s.phase === 'complete' || s.phase === 'failed')) void stopCoop()
  }, [])

  const go = async (target: 'create' | 'match' | { code: string }) => {
    sounds.uiSelect()
    setBusy(true)
    setError(null)
    try { await startNakamaCoop(target) } catch (e) { setError((e as Error).message || 'Could not connect') }
    setBusy(false)
  }
  const leave = async () => { sounds.uiClick(); await stopCoop() }
  const back = async () => { sounds.uiClick(); await stopCoop(); setGameState('menu') }

  const inRoom = room && room.phase === 'lobby'
  const me = roster.find((r) => r.id === room?.selfId)

  return (
    <div style={overlay}>
      <div style={panel}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" style={iconBtn} onClick={back} aria-label="Back">←</button>
          <div style={{ flex: 1, textAlign: 'center', ...title }}>CO-OP</div>
          <div style={{ width: 40 }} />
        </div>
        <div style={{ color: '#9fd6ff', textAlign: 'center', fontSize: 13 }}>
          Two pilots, all 10 stages back to back. Revive your wingmate by hovering over their beacon.
        </div>

        {status !== 'user' ? (
          <div style={card}>
            <div style={{ color: '#e8f4ff', textAlign: 'center', fontWeight: 800 }}>Log in to fly co-op</div>
            <LoginButtons />
          </div>
        ) : inRoom ? (
          <div style={card}>
            <div style={{ color: '#8eb8d4', fontSize: 12, textAlign: 'center' }}>ROOM CODE — share it with your wingmate</div>
            <button type="button" style={codeBox} onClick={() => { if (room.code) void navigator.clipboard?.writeText(room.code) }}>
              {room.code ?? '—'}
            </button>
            {[0, 1].map((i) => {
              const p = roster[i]
              return (
                <div key={i} style={slot}>
                  <span style={{ flex: 1, color: p ? '#e8f4ff' : '#5f7d94', fontWeight: 800 }}>
                    {p ? `${p.name}${p.id === room.selfId ? ' (you)' : ''}` : 'Waiting for a wingmate…'}
                  </span>
                  {p && <span style={{ color: '#9fd6ff', fontSize: 12 }}>{getPlane(p.plane).name}</span>}
                  {p && <span style={{ color: p.ready ? '#3dff8a' : '#ffb74d', fontWeight: 900, fontSize: 12 }}>{p.ready ? 'READY' : '…'}</span>}
                </div>
              )
            })}
            <button type="button" style={btnPrimary} disabled={room.ready || me?.ready}
              onClick={() => { sounds.uiSelect(); activeSession()?.ready() }}>
              {room.ready || me?.ready ? 'WAITING FOR WINGMATE…' : 'READY'}
            </button>
            <button type="button" style={btnGhost} onClick={leave}>LEAVE ROOM</button>
          </div>
        ) : (
          <div style={card}>
            <button type="button" style={btnPrimary} disabled={busy} onClick={() => go('match')}>⚡ QUICK MATCH</button>
            <button type="button" style={{ ...btnPrimary, background: 'linear-gradient(180deg, #5ec8ff, #1a8fd0)', color: '#fff', boxShadow: '0 6px 0 #0d5f90' }}
              disabled={busy} onClick={() => go('create')}>＋ CREATE ROOM</button>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <input value={code} maxLength={5} placeholder="CODE" onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} style={input} />
              <button type="button" style={{ ...btnSmall }} disabled={busy || code.length !== 5} onClick={() => go({ code })}>JOIN</button>
            </div>
            {rejoin && <button type="button" style={btnGhost} disabled={busy} onClick={() => go({ code: rejoin })}>↻ REJOIN {rejoin}</button>}
          </div>
        )}
        {busy && <div style={{ color: '#9fd6ff', textAlign: 'center' }}>Connecting…</div>}
        {error && <div style={{ color: '#ff8a80', textAlign: 'center', fontWeight: 700 }}>{error}</div>}
      </div>
    </div>
  )
}

const overlay: CSSProperties = {
  position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center',
  background: 'linear-gradient(180deg, rgba(6,18,36,0.94) 0%, rgba(8,28,48,0.9) 100%)',
  padding: 'max(0.75rem, env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right)) max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left))',
}
const panel: CSSProperties = { width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 10 }
const title: CSSProperties = { color: '#fff', fontWeight: 900, fontSize: 'clamp(1.2rem, 5vw, 1.6rem)', letterSpacing: 2, textShadow: '0 0 18px rgba(61,255,138,0.5)' }
const iconBtn: CSSProperties = { width: 40, height: 40, borderRadius: 12, border: '1px solid rgba(78,196,255,0.35)', background: 'rgba(20,40,70,0.8)', color: '#fff', fontSize: 18, cursor: 'pointer' }
const card: CSSProperties = { background: 'rgba(10,24,44,0.92)', border: '1px solid rgba(78,196,255,0.28)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }
const btnPrimary: CSSProperties = {
  display: 'block', width: '100%', padding: '0.85rem 1rem', border: 'none', borderRadius: 14,
  background: 'linear-gradient(180deg, #5dffa0, #1fae5b)', color: '#062312', fontWeight: 900, fontSize: '1.05rem', cursor: 'pointer', boxShadow: '0 6px 0 #11733a',
}
const btnGhost: CSSProperties = { ...btnPrimary, background: 'rgba(255,255,255,0.12)', color: '#fff', boxShadow: 'none', fontSize: '0.9rem' }
const btnSmall: CSSProperties = { ...btnPrimary, width: 'auto', padding: '0.6rem 1.1rem', fontSize: '0.95rem' }
const input: CSSProperties = {
  flex: 1, padding: '0.6rem 0.8rem', borderRadius: 12, border: '1px solid rgba(78,196,255,0.4)', background: 'rgba(5,14,28,0.9)',
  color: '#fff', fontWeight: 900, fontSize: '1.1rem', letterSpacing: 4, textAlign: 'center',
}
const codeBox: CSSProperties = {
  padding: '0.6rem', borderRadius: 12, border: '1px dashed rgba(61,255,138,0.6)', background: 'rgba(61,255,138,0.08)',
  color: '#3dff8a', fontWeight: 900, fontSize: '2rem', letterSpacing: 8, textAlign: 'center', cursor: 'copy',
}
const slot: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)' }
```

- [ ] **Step 3: `src/components/ui/CoopStageClear.tsx`**
```tsx
import { useGameStore } from '../../store/gameStore'
import { getStage } from '../../game/stages'
import { useCoopStatus } from './useCoop'

/** Between co-op stages: what the squad just did, and what's next (the server starts it). */
export function CoopStageClear() {
  const stageId = useGameStore((s) => s.currentStageId)
  const { status, team } = useCoopStatus()
  const index = status?.stageIndex ?? 0
  const stages = status?.stages ?? 10
  const last = index + 1 >= stages
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(4,12,24,0.6)', pointerEvents: 'none' }}>
      <div style={{ textAlign: 'center', color: '#fff', textShadow: '0 2px 6px #000' }}>
        <div style={{ fontSize: 'clamp(1.6rem, 7vw, 2.4rem)', fontWeight: 900, color: '#ffd23f' }}>STAGE {index + 1}/{stages} CLEAR</div>
        <div style={{ marginTop: 4, color: '#9fd6ff', fontWeight: 700 }}>{getStage(stageId).name}</div>
        <div style={{ marginTop: 14, fontWeight: 800 }}>TEAM {team.score.toLocaleString()} pts · {team.kills} kills</div>
        <div style={{ marginTop: 10, color: '#3dff8a', fontWeight: 800 }}>{last ? 'Final stage cleared!' : `Next: stage ${index + 2} — get ready`}</div>
      </div>
    </div>
  )
}
```
Check that `StageConfig` has a `name` field: `grep -n "name:" src/game/stages.ts | head -3`. If it doesn't, drop that line.

- [ ] **Step 4: `src/components/ui/CoopResults.tsx`**
```tsx
import { useEffect, useState, type CSSProperties } from 'react'
import { useGameStore } from '../../store/gameStore'
import { forgetRoom, stopCoop } from '../../net/coop/active'
import { coopLeaderboard, type CoopBoard } from '../../net/coop/coopApi'
import { sounds } from '../../hooks/useAudio'
import { useCoopStatus } from './useCoop'

const fmtTime = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`
const BOARDS: { id: CoopBoard; label: string }[] = [{ id: 'stage', label: 'Furthest stage' }, { id: 'kills', label: 'Team kills' }, { id: 'score', label: 'Team score' }]

/** End of a co-op run: what the pair achieved and where it ranks. */
export function CoopResults() {
  const setGameState = useGameStore((s) => s.setGameState)
  const openLeaderboard = useGameStore((s) => s.openLeaderboard)
  const { summary, status } = useCoopStatus()
  const [ranks, setRanks] = useState<Partial<Record<CoopBoard, number | null>>>({})

  useEffect(() => {
    if (!summary) return
    forgetRoom()
    // The match writes the records as the run ends; give it a moment
    const t = setTimeout(() => {
      for (const b of BOARDS) coopLeaderboard(b.id).then((r) => setRanks((x) => ({ ...x, [b.id]: r.me?.rank ?? null }))).catch(() => {})
    }, 800)
    return () => clearTimeout(t)
  }, [summary])

  const won = summary?.result === 'complete'
  const stages = status?.stages ?? 10
  const leave = async (to: 'menu' | 'coopLobby' | 'leaderboard') => {
    sounds.uiClick()
    await stopCoop()
    if (to === 'leaderboard') openLeaderboard('coop')
    else setGameState(to)
  }

  return (
    <div style={overlay}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ textAlign: 'center', fontSize: 'clamp(1.6rem, 7vw, 2.4rem)', fontWeight: 900, color: won ? '#ffd23f' : '#ff8a80' }}>
          {won ? 'CAMPAIGN COMPLETE' : 'SQUAD DOWN'}
        </div>
        <div style={{ textAlign: 'center', color: '#9fd6ff', fontWeight: 700 }}>{summary?.names.join(' & ')}</div>
        <div style={card}>
          <Stat label="Stages cleared" value={`${summary?.stagesCleared ?? 0}/${stages}`} />
          <Stat label="Team kills" value={(summary?.kills ?? 0).toLocaleString()} />
          <Stat label="Team score" value={(summary?.score ?? 0).toLocaleString()} />
          <Stat label="Time" value={fmtTime(summary?.timeMs ?? 0)} />
        </div>
        <div style={card}>
          {BOARDS.map((b) => <Stat key={b.id} label={`🏆 ${b.label}`} value={ranks[b.id] ? `#${ranks[b.id]}` : '…'} />)}
        </div>
        <button type="button" style={btnPrimary} onClick={() => leave('coopLobby')}>FLY AGAIN</button>
        <button type="button" style={btnGhost} onClick={() => leave('leaderboard')}>CO-OP LEADERBOARD</button>
        <button type="button" style={btnGhost} onClick={() => leave('menu')}>MENU</button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e8f4ff', fontWeight: 700 }}>
      <span style={{ color: '#8eb8d4' }}>{label}</span><span style={{ fontWeight: 900 }}>{value}</span>
    </div>
  )
}

const overlay: CSSProperties = {
  position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center',
  background: 'linear-gradient(180deg, rgba(6,18,36,0.94) 0%, rgba(8,28,48,0.9) 100%)', padding: '1rem',
}
const card: CSSProperties = { background: 'rgba(10,24,44,0.92)', border: '1px solid rgba(78,196,255,0.28)', borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }
const btnPrimary: CSSProperties = {
  width: '100%', padding: '0.85rem 1rem', border: 'none', borderRadius: 14, background: 'linear-gradient(180deg, #5dffa0, #1fae5b)',
  color: '#062312', fontWeight: 900, fontSize: '1.05rem', cursor: 'pointer', boxShadow: '0 6px 0 #11733a',
}
const btnGhost: CSSProperties = { ...btnPrimary, background: 'rgba(255,255,255,0.12)', color: '#fff', boxShadow: 'none', fontSize: '0.9rem' }
```

- [ ] **Step 5: Wire it up**
  - `UI.tsx`: import the three screens and add:
  ```tsx
      {gameState === 'coopLobby' && <CoopLobby />}
      {gameState === 'coopStageClear' && <CoopStageClear />}
      {gameState === 'coopResults' && <CoopResults />}
  ```
  - `MainMenu.tsx`:
    - Add `const openCoopLobby = useGameStore((s) => s.openCoopLobby)`.
    - Insert after the PLAY button:
  ```tsx
        <button
          type="button"
          onClick={() => { sounds.uiSelect(); openCoopLobby() }}
          style={{ ...btnPrimary, background: 'linear-gradient(180deg, #5dffa0, #1fae5b)', color: '#062312', boxShadow: '0 6px 0 #11733a' }}
        >
          👥 CO-OP
        </button>
  ```
  - `HUD.tsx`:
    - Add the co-op data:
    ```tsx
    const coop = useGameStore((s) => s.mode === 'coop')
    const down = useGameStore((s) => s.down)
    const { team, status } = useCoopStatus()
    const [leaving, setLeaving] = useState(false)
    ```
    (import `useState` from react, `useCoopStatus` from `./useCoop`, `stopCoop` from `../../net/coop/active`).
    - Score cell: `{(coop ? team.score : score).toLocaleString()}`. When `coop`, add the line `<div style={{ color: '#3dff8a', fontWeight: 800, fontSize: 11, textShadow: shadow }}>TEAM · STAGE {(status?.stageIndex ?? 0) + 1}/{status?.stages ?? 10}</div>` under it.
    - Pause button: `<IconBtn onClick={coop ? () => setLeaving(true) : pauseGame}>{coop ? '⏏' : '⏸'}</IconBtn>`.
    - Before the `<style>` tag add:
  ```tsx
      {coop && down && (
        <div style={{ position: 'absolute', bottom: '18%', left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 'clamp(1.3rem, 6vw, 2rem)', fontWeight: 900, color: '#ff5252', textShadow: '0 0 14px #ff1744' }}>SHOT DOWN</div>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 13, textShadow: shadow }}>Hang on — your wingmate can revive you at your beacon</div>
        </div>
      )}
      {coop && leaving && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', pointerEvents: 'auto' }}>
          <div style={{ background: 'rgba(10,24,44,0.95)', borderRadius: 16, padding: 18, textAlign: 'center', color: '#fff', maxWidth: 300 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Leave the run?</div>
            <div style={{ fontSize: 12, color: '#9fd6ff', marginBottom: 12 }}>The game keeps going for your wingmate. You can rejoin with the room code.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', fontWeight: 800 }} onClick={() => setLeaving(false)}>STAY</button>
              <button style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', fontWeight: 800, background: '#ff5252', color: '#fff' }}
                onClick={() => { setLeaving(false); void stopCoop().then(() => useGameStore.getState().setGameState('coopLobby')) }}>LEAVE</button>
            </div>
          </div>
        </div>
      )}
  ```
  - `CoopBadge.tsx`: change the text line to include the stage:
  ```ts
      setText(`CO-OP · ${sessionLabel()} · STAGE ${st.stageIndex + 1}/${st.stages || '?'} · RTT ${st.rtt}ms · ${st.teammates} WINGMATE${st.teammates === 1 ? '' : 'S'}${count}`)
  ```

- [ ] **Step 6: Typecheck, tests, build**

Run: `npx tsc --noEmit && npx vitest run && npx vite build`
Expected: clean, all PASS, build OK.

- [ ] **Step 7: Commit**
```bash
git add src/components/ui
git commit -m "Co-op UI: lobby (quick match / room code / rejoin), stage-clear card, results with ranks, team HUD

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Leaderboard screen: co-op boards

**Files:**
- Modify: `src/components/ui/Leaderboard.tsx`

**Interfaces:**
- Consumes: `coopLeaderboard`, `CoopBoard`, `CoopBoardResult` (Task 8), store `leaderboardMode` (Task 7).

- [ ] **Step 1: Implement.** In `Leaderboard.tsx`:
  - Add state `const [mode, setMode] = useState(useGameStore.getState().leaderboardMode)` and `const [coopTab, setCoopTab] = useState<CoopBoard>('stage')`, `const [coopData, setCoopData] = useState<CoopBoardResult | null>(null)`.
  - Add an effect:
  ```tsx
  useEffect(() => {
    if (status !== 'user' || mode !== 'coop') return
    let live = true
    setCoopData(null)
    setError(null)
    coopLeaderboard(coopTab).then((d) => live && setCoopData(d)).catch((e) => live && setError(e.message || 'Could not load the co-op leaderboard'))
    return () => { live = false }
  }, [coopTab, mode, status])
  ```
  and guard the existing solo effect with `if (status !== 'user' || mode !== 'solo') return` (add `mode` to its deps).
  - Above the tabs (logged-in branch), add a SOLO/CO-OP switch using the same `tabs`/`tabBtn` styles with `gridTemplateColumns: 'repeat(2, 1fr)'`:
  ```tsx
  <div style={{ ...tabs, gridTemplateColumns: 'repeat(2, 1fr)' }}>
    {(['solo', 'coop'] as const).map((m) => (
      <button key={m} type="button" onClick={() => { sounds.uiClick(); setMode(m) }} style={{ ...tabBtn, ...(m === mode ? tabActive : {}) }}>
        {m === 'solo' ? 'SOLO' : 'CO-OP'}
      </button>
    ))}
  </div>
  ```
  - When `mode === 'coop'`, render co-op tabs `[{id:'stage',label:'FURTHEST STAGE'},{id:'kills',label:'TEAM KILLS'},{id:'score',label:'TEAM SCORE'}]` and rows from `coopData.rows`:
  ```tsx
  const coopValue = (r: CoopRow) => coopTab === 'stage'
    ? `Stage ${r.score} · ${fmtTime(r.metadata?.timeMs ?? 0)}`
    : `${r.score.toLocaleString()} ${coopTab === 'kills' ? 'kills' : 'pts'}`
  ```
  Each row is `<div key={r.owner} style={{ ...row, ...(r.mine ? rowMine : {}) }}>` with the rank or medal, `r.names`, and `coopValue(r)`. If `coopData.me` exists and no row has `mine`, add a footer row with `me.rank` and `coopValue(me)`. When `coopData.rows` is empty, show "No squads ranked yet — fly a co-op run!".
  - `fmtTime` is the same helper as in CoopResults. Define it locally in this file.

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npx vite build`
Expected: clean.

- [ ] **Step 3: Commit**
```bash
git add src/components/ui/Leaderboard.tsx
git commit -m "Leaderboard: co-op boards (furthest stage, team kills, team score)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Install script and local Nakama smoke

**Files:**
- Create: `scripts/nakama-install.mjs`, `nakama/docker-compose.yml`, `nakama/README.md`, `scripts/coop-smoke.mjs`

**Interfaces:**
- Consumes: the Lua modules, `coopData` (via vite ssrLoadModule in the smoke).

- [ ] **Step 1: `scripts/nakama-install.mjs`**
```js
// Copies the co-op Lua modules into the Nakama cluster repo (default ../nakama-cluster).
//   NAKAMA_CLUSTER_DIR=/path npm run nakama:install
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const target = resolve(process.env.NAKAMA_CLUSTER_DIR ?? '../nakama-cluster', 'modules')
if (!existsSync(target)) {
  console.error(`No modules directory at ${target} (set NAKAMA_CLUSTER_DIR)`)
  process.exit(1)
}
for (const f of ['skystriker_coop.lua', 'skystriker_data.lua']) {
  copyFileSync(resolve('nakama/modules', f), resolve(target, f))
  console.log(`copied ${f} → ${target}`)
}
```

- [ ] **Step 2: `nakama/docker-compose.yml`** (single node, for local testing)
```yaml
# Local single-node Nakama with the Sky Striker co-op module, for the smoke test / two-tab play.
#   docker compose -f nakama/docker-compose.yml up -d
# SKYSTRIKER_API_URL must reach the game's /api (the smoke test runs a stub on :7999).
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: nakama
      POSTGRES_PASSWORD: localdb
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "postgres", "-d", "nakama"]
      interval: 3s
      retries: 10
  nakama:
    image: heroiclabs/nakama:3.37.0
    depends_on:
      postgres:
        condition: service_healthy
    entrypoint:
      - /bin/sh
      - -ecx
      - >
        /nakama/nakama migrate up --database.address postgres:localdb@postgres:5432/nakama &&
        exec /nakama/nakama --name nakama1 --database.address postgres:localdb@postgres:5432/nakama
        --logger.level DEBUG --runtime.env "SKYSTRIKER_API_URL=${SKYSTRIKER_API_URL:-http://host.docker.internal:7999}"
    extra_hosts:
      - "host.docker.internal:host-gateway"
    volumes:
      - ./modules:/nakama/data/modules:ro
    ports:
      - "7350:7350"
      - "7351:7351"
```

- [ ] **Step 3: `scripts/coop-smoke.mjs`**: two nakama-js clients play a short failed run against a real Nakama
```js
// End-to-end smoke against a running Nakama with the co-op module (nakama/docker-compose.yml):
// stub /api/me, two clients, create → join by code → READY → kill → both down → leaderboard row.
//   node scripts/coop-smoke.mjs [host=127.0.0.1] [port=7350]
import http from 'node:http'
import { Client } from '@heroiclabs/nakama-js'
import { createServer } from 'vite'

const [host = '127.0.0.1', port = '7350'] = process.argv.slice(2)
const USERS = { 'tok-1': { id: 1, name: 'ALPHA' }, 'tok-2': { id: 2, name: 'BRAVO' } }
const api = http.createServer((req, res) => {
  const u = USERS[(req.headers.authorization ?? '').replace('Bearer ', '')]
  res.writeHead(u ? 200 : 401, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(u ? { user: u, progress: {} } : { message: 'Unauthorized' }))
}).listen(7999)

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { coopData } = await vite.ssrLoadModule('/src/net/coop/coopData.ts')
const data = coopData()
await vite.close()

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const enc = (o) => JSON.stringify(o)
async function pilot(tok, gid) {
  const client = new Client('defaultkey', host, port, false)
  const session = await client.authenticateCustom(`skystriker-smoke-${gid}`, true)
  const socket = client.createSocket(false, false)
  const inbox = []
  socket.onmatchdata = (d) => inbox.push({ op: d.op_code, data: JSON.parse(new TextDecoder().decode(d.data)) })
  await socket.connect(session, true)
  const rpc = async (id, p) => { const r = await client.rpc(session, id, p); return typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload }
  return { client, session, socket, inbox, rpc, meta: { token: tok, plane: 'hawk', dataVersion: data.version } }
}
const phase = (p) => p.inbox.filter((m) => m.op === 106).at(-1)?.data.phase

try {
  const a = await pilot('tok-1', 1), b = await pilot('tok-2', 2)
  const room = await a.rpc('skystriker_create_match', {})
  console.log('room', room)
  const ma = await a.socket.joinMatch(room.matchId, undefined, a.meta)
  const found = await b.rpc('skystriker_join_code', { code: room.code })
  const mb = await b.socket.joinMatch(found.matchId, undefined, b.meta)
  for (const [p, m] of [[a, ma], [b, mb]]) await p.socket.sendMatchState(m.match_id, 6, enc({ name: 'x', plane: 'hawk', hp: 3, dataVersion: data.version }))
  await sleep(3500)
  if (phase(a) !== 'playing') throw new Error(`expected playing, got ${phase(a)}`)
  const first = data.stages[0].enemies.filter((e) => e.enterT !== null).sort((x, y) => x.enterT - y.enterT)[0]
  await sleep((first.enterT / data.rules.gameSpeed) * 1000 + 200)
  await a.socket.sendMatchState(ma.match_id, 2, enc({ hits: [[first.id, first.hp]] }))
  await sleep(300)
  if (!a.inbox.some((m) => m.op === 102 && m.data.id === first.id)) throw new Error('no ENEMY_DEAD')
  await a.socket.sendMatchState(ma.match_id, 3, enc({ hits: 3, hp: 0 }))
  await b.socket.sendMatchState(mb.match_id, 3, enc({ hits: 3, hp: 0 }))
  await sleep(500)
  if (phase(b) !== 'failed') throw new Error(`expected failed, got ${phase(b)}`)
  const lb = await a.rpc('skystriker_leaderboard', { board: 'kills' })
  console.log('leaderboard', JSON.stringify(lb))
  if (!lb.me || lb.me.names !== 'ALPHA & BRAVO') throw new Error('leaderboard row missing')
  console.log('SMOKE OK')
  process.exitCode = 0
} catch (e) {
  console.error('SMOKE FAILED:', e)
  process.exitCode = 1
} finally {
  api.close()
  setTimeout(() => process.exit(process.exitCode), 200)
}
```
nakama-js in Node 24 uses the global `WebSocket`/`fetch`. If `authenticateCustom` for `skystriker-smoke-1` collides on re-runs, that's fine (`create=true` logs in).

- [ ] **Step 4: `nakama/README.md`**
```md
# Sky Striker co-op — Nakama module

- `modules/skystriker_coop.lua`: authoritative match + RPCs + leaderboards (Lua 5.1, gopher-lua).
- `modules/skystriker_data.lua`: **generated** stage data/rules (`npm run gen:coop`).
- `test/`: runs the module in vitest through fengari with a mock `nakama` module.

Workflow: change stages → `npm run gen:coop` → `npx vitest run` → `npm run nakama:install`
(copies both files into `../nakama-cluster/modules`, or `NAKAMA_CLUSTER_DIR`) → commit there.

Runtime env on every Nakama node: `SKYSTRIKER_API_URL=https://<game host>` (joins are verified with `GET /api/me`).

Local check (Docker): `docker compose -f nakama/docker-compose.yml up -d` then `node scripts/coop-smoke.mjs`.
```

- [ ] **Step 5: Run the smoke if Docker is available**

Run: `docker version --format '{{.Server.Version}}'`. If that fails (engine not running), skip the next two commands and note it in the final report.

Run: `docker compose -f nakama/docker-compose.yml up -d && sleep 15 && node scripts/coop-smoke.mjs`
Expected: `SMOKE OK`.

Run: `docker compose -f nakama/docker-compose.yml down`

- [ ] **Step 6: Commit**
```bash
git add scripts/nakama-install.mjs scripts/coop-smoke.mjs nakama/docker-compose.yml nakama/README.md
git commit -m "Nakama co-op: install script, local single-node compose and end-to-end smoke

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Integrate into nakama-cluster

**Files (repo `E:\projects\others\nakama-cluster`):**
- Create: `modules/skystriker_coop.lua`, `modules/skystriker_data.lua` (via install script), `docs/skystriker-coop.md`
- Modify: `config/node1-config.yml`, `config/node2-config.yml`, `config/node3-config.yml`, `deploy/helm/nakama-cluster/templates/nakama-configmap.yaml`, `deploy/helm/nakama-cluster/values.yaml`

- [ ] **Step 1: Branch**

Run: `git -C /e/projects/others/nakama-cluster status --short && git -C /e/projects/others/nakama-cluster switch -c feat/skystriker-coop`
Expected: clean tree, new branch.

- [ ] **Step 2: Install modules**

Run (in sky-striker): `npm run nakama:install`
Expected: two `copied …` lines.

- [ ] **Step 3: Runtime env**
  - Each `config/node{1,2,3}-config.yml`: append
  ```yaml
  runtime:
    env:
      - "SKYSTRIKER_API_URL=http://127.0.0.1:5847"
  ```
  (local compose is host-network; 5847 is the sky-striker dev server, which proxies `/api`).
  - `deploy/helm/nakama-cluster/values.yaml`: add a top-level block
  ```yaml
  skystriker:
    # Game server that verifies co-op logins (GET /api/me), e.g. https://sky-striker.zingplay.dev
    apiUrl: ""
  ```
  - `nakama-configmap.yaml`: inside `config.yaml.tpl`, after the `session:` block, add
  ```yaml
      runtime:
        env:
          - "SKYSTRIKER_API_URL={{ .Values.skystriker.apiUrl }}"
  ```
  First run `grep -n "runtime" deploy/helm/nakama-cluster/templates/nakama-configmap.yaml`. If a `runtime:` key already exists, add the `env` list under it instead.

- [ ] **Step 4: `docs/skystriker-coop.md`**
```md
# Sky Striker co-op module

Lua modules loaded beside tictactoe and the tankz bundle:

| File | Role |
|------|------|
| `modules/skystriker_coop.lua` | Authoritative 2-player match `skystriker_coop` (whole campaign, revives), RPCs, leaderboards |
| `modules/skystriker_data.lua` | Generated stage data + rules — regenerate in sky-striker (`npm run gen:coop && npm run nakama:install`) |

Source of truth and tests: sky-striker `nakama/` (vitest + fengari). Do not edit these copies here.

## RPCs
| Id | Payload → result |
|----|------------------|
| `skystriker_create_match` | `{}` → `{matchId, code}` (private room) |
| `skystriker_join_code` | `{code}` → `{matchId, code}` or `{error}` |
| `skystriker_find_match` | `{}` → `{matchId, code}` (open public room, else a new one) |
| `skystriker_leaderboard` | `{board: stage\|kills\|score, limit?}` → `{rows, me?}` |

Match label `{"game":"skystriker","open":0|1,"public":0|1,"code":"<lowercase>"}`; listing fans out across nodes.

## Leaderboards (authoritative, desc, best, no reset)
`skystriker_coop_stage` (stages cleared; subscore 1e9 − seconds), `skystriker_coop_kills`, `skystriker_coop_score`.
One record per pilot pair (owner = UUID from their game ids); pair lists in storage `skystriker/pairs`.

## Runtime env
`SKYSTRIKER_API_URL` — base URL of the game server. Joins send `{token, plane, dataVersion}` metadata; the
match calls `GET <url>/api/me` with the token and refuses wrong versions, full rooms and strangers mid-run.
Set it in `config/node*-config.yml` (compose) and `values.yaml: skystriker.apiUrl` (helm).

## Failure policy
Matches are node-local (see cluster-match-recreate.md). If a pod dies, clients return to the lobby; the run's
leaderboard record is written on `match_terminate` when the node shuts down cleanly.
```

- [ ] **Step 5: Commit in nakama-cluster** (check its line-ending style first: `git -C … config core.autocrlf`, and look at `git diff --stat`)
```bash
git -C /e/projects/others/nakama-cluster add modules/skystriker_coop.lua modules/skystriker_data.lua config/node1-config.yml config/node2-config.yml config/node3-config.yml deploy/helm/nakama-cluster/templates/nakama-configmap.yaml deploy/helm/nakama-cluster/values.yaml docs/skystriker-coop.md
git -C /e/projects/others/nakama-cluster commit -m "Add Sky Striker co-op Lua module (match, RPCs, leaderboards) and SKYSTRIKER_API_URL runtime env

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Final verification

- [ ] **Step 1: Full checks (sky-striker)**

Run: `npx tsc --noEmit && npx vitest run && npx vite build`
Expected: clean. All tests PASS, including the conformance suite for both servers and the Lua tests.

- [ ] **Step 2: Loopback playtest across a stage transition** (dev server + bot)

Run the dev server in the background: `npx vite --port 5847`. Then:
`node scripts/playtest-bot.mjs "http://localhost:5847/?coop=loopback&stage=9" 400 shots/coop-stage9.png`

The run starts at stage 9 so it ends with the stage 9 → 10 transition and then `complete`.

Expected:
- `__coopDebug` shows `serverStage` going 8 → 9, then `serverPhase: complete`.
- The game state passes through `coopStageClear` and ends at `coopResults`.
- No console errors, apart from the known `/api` 500 when the backend isn't running.

If the headless frame rate makes this too slow, use `stage=10` and 200 s and check the `complete` path only.

- [ ] **Step 3: Single-player regression**

Run: `node scripts/playtest-bot.mjs "http://localhost:5847/" 140 shots/single.png`
Expected: as before. Boss at about 70 s of sim time, and the results screen after victory or death, never `coopStageClear`.

- [ ] **Step 4: Spec touch-up**

In `docs/superpowers/specs/2026-10-12-coop-nakama-design.md`, add an "Implementation notes" section listing the four deviations in this plan's "Deviations from the spec".

- [ ] **Step 5: Commit**
```bash
git add docs/superpowers/specs/2026-10-12-coop-nakama-design.md
git commit -m "Co-op on Nakama: implementation notes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Report to the user.** Cover:
  - What was verified, and what was skipped (e.g. the Docker smoke if the engine wasn't running).
  - That `SKYSTRIKER_API_URL` must be set to the deployed game URL in helm `values-cloud.yaml` / `values.yaml`.
  - That nothing was pushed.
