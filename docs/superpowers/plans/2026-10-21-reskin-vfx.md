# Reskin part 2: bullets and aircraft effects — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every bullet and aircraft effect is redrawn in code: plasma bolts, readable enemy bullets, missiles with smoke, muzzle flashes, hit sparks, fire-and-smoke explosions, a boss death sequence, shader flames, a layered laser, a rippling shield and a nova ring. Gameplay, co-op and phone FPS stay as they are.

**Architecture:**
- **Pure core** in `src/game/fx/`, unit-tested in node: colours, bullet look, a particle pool, emitters and a visual-event queue.
- **Render layer** in `src/components/game/fx/`: shader materials and instanced meshes, plus an `FxRenderer` that owns the pools. Every render component takes plain data or getters, so the same components run in the game and in a dev preview page.
- **Game glue** (`FxGame`, `Bullets.tsx`, `Player.tsx`, `Boss.tsx`, `effects.ts`): reads the store and the event queue and calls the renderer. Nothing visual writes gameplay state.

**Tech Stack:** Three.js 0.180, React Three Fiber, `@react-three/postprocessing` (Bloom is unchanged), vitest (jsdom only where React must render), Playwright for the bench.

**Spec:** `docs/superpowers/specs/2026-10-21-reskin-vfx-design.md`

## Global Constraints
- Gameplay and co-op do not change: bullet speed, collision radii, damage, timing, `LASER_HALF_WIDTH`, shield and nova rules, and when a boss death ends the stage.
  - No edits to `src/game/sim/`, the `src/net/coop/` protocol or data, or `nakama/`. The existing sim, coop and Lua tests stay unchanged and green.
- Effects only read gameplay state. A visual-only event is allowed where none exists; it must not change what gameplay does.
- Enemy bullets stay round and magenta (`ENEMY_BULLET_COLOR` `#ff2bd6`): the easiest thing to pick out, no smaller than today, never hidden by smoke or explosions. Smoke and debris draw beneath pickups and stars.
- Player bolts take the plane's flame colour, with the hue pushed at least 45° from the enemy magenta.
- Phones: FPS no lower than today; when look and FPS conflict, FPS wins.
- Bounded cost: every effect type has a fixed pool or cap, and no point lights are added per explosion.
- No new runtime dependencies.
- The repo is public: no keys and no internal host names in commits.
- Keep each file's line endings: check with `git cat-file -p HEAD:<file> | tr -cd '\r' | wc -c`, and patch CRLF files with Python `newline=''`, never `sed -i`.
  - CRLF: `Bullets.tsx`, `Player.tsx`, `GameScene.tsx`, `Model.tsx`, `Enemies.tsx`, `gameStore.ts`, `planes.ts`, `weapon.ts`, `App.tsx`, `main.tsx`, `vite.config.ts`, `artPreview.tsx`.
  - LF: `BossLaser.tsx`, `Boss.tsx`, `Explosions.tsx`, `EngineFlame.tsx`, `Teammates.tsx`, `effects.ts`, `HangarPreview.tsx`.
- Before npm or npx on this machine: `export TEMP='E:\projects\others\sky-striker\.superpowers\tmp' TMP=$TEMP`.
- Commit with `git commit -q -F <file>`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Branch `feat/fx`.

## Review Focus
1. **Pause or quit mid-effect.** While paused the effects freeze (smoke, a boss wreck), and they carry on when play resumes. Quitting to the menu or starting another stage leaves no smoke or wreck behind (test in Task 3: `fxShouldStep`; test in Task 6: `wreckAlive`).
2. **Co-op.** A teammate's ghost bolts take that teammate's plane colour, and their hits spark. A boss killed by the server's event still gets its death sequence, since `storeWorld` calls `bossKilled` (test in Task 2: `planeBoltColor`; test in Task 6: `bossKilled` emits `bossDeath`).
3. **Saturated pools.** Nova bolts, missiles, many explosions and sparks at once replace the oldest particles. Nothing allocates per frame, and enemy bullets still draw on top (test in Task 3: a full pool replaces the oldest).
4. **Store explosions seen once.** Each explosion entry starts exactly one burst, even though the entry lives for 600 ms across many frames, and entries the store has dropped are forgotten (test in Task 3: `takeNewExplosions`).
5. **Draw size follows radius.** A higher weapon tier draws bigger bolts. The drawn bolt tip never runs far ahead of the hit point, and enemy bullets are never drawn smaller than today (test in Task 2: `boltQuad`, `enemyBulletLayers`).

## Rulings made while planning
- **Baseline measured at the end, not first.** Task 1 adds the stats readout before any effect changes, so the Task 1 commit *is* `main` plus the readout. The phone check in Task 8 compares a build of that commit with the branch, side by side, the way part 1 was checked. The spec's "first step measures main on the phone" would cost the user an extra round trip at the start. Task 1 runs the headless bench at once to catch big regressions early. Cost if wrong: if the phone is already below its refresh rate, we learn it late and cut effects in Task 8.
- **Enemy bullets draw above the clouds.** Today they are opaque meshes drawn before the clouds (renderOrder 10), so a cloud can cover them. The spec says they are never hidden. Player bolts and every other effect stay under the clouds. Cost if wrong: one renderOrder number.
- **All effect times are real seconds**, as today's explosions (500 ms real). They step only while `gameState` is `'playing'`, so they freeze on pause.
- **Bolt colour is a visual-only field** `color?: string` on the store `Bullet`. Bullets are never networked, so co-op is unaffected.
- **Boss footprint** for the death bursts is ± `def.size × 0.4` on both axes.

---

### Task 1: Stats readout and bench (the baseline)

**Files:**
- Create: `src/game/fx/fpsMeter.ts`, `src/game/fx/fpsMeter.test.ts`, `src/components/game/StatsProbe.tsx`, `scripts/fx-bench.mjs`
- Modify: `src/components/game/GameScene.tsx` (mount the probe)

**Interfaces:**
- Produces:
  - `createFpsMeter(): { frame(dtMs: number): void; fps(): number; ms(): number }`. Over the last 1000 ms of frames: `fps` = frames / window seconds, `ms` = mean frame time.
  - `StatsProbe` (mounted only when the URL has `stats`). It sets `window.__stats = { fps, ms, calls, tris }` and draws a small fixed DOM readout at the top left, `pointer-events: none`.
  - `scripts/fx-bench.mjs <baseUrl> [seconds=20]` prints JSON `{ fpsMedian, fpsP10, callsMedian }`.

- [ ] **Step 1: Write the failing tests** in `fpsMeter.test.ts`:
  - `'60 frames of 16.67 ms read 60 fps and 16.7 ms'`: `fps()` is close to 60 (±0.5) and `ms()` close to 16.7 (±0.1).
  - `'only the last second counts'`: 100 frames of 50 ms, then 60 frames of 16.67 ms, read close to 60 fps.
- [ ] **Step 2: Run** `npx vitest run src/game/fx/fpsMeter.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `createFpsMeter`.** It is a ring of frame times and their running sum.
- [ ] **Step 4: Implement `StatsProbe`:**
  - In `useFrame` at priority 0, set `gl.info.autoReset = false` once.
  - Each frame, read `gl.info.render.calls` and `.triangles`; this is the total of the previous frame across every pass, EffectComposer included. Then call `gl.info.reset()` and feed the meter.
  - Update the DOM text and `window.__stats` 4 times a second.
  - Mount it in `GameScene.tsx` as `{STATS && <StatsProbe />}`, with `STATS = new URLSearchParams(location.search).has('stats')`.
- [ ] **Step 5: Write `scripts/fx-bench.mjs`:**
  - Launch with `launchBrowser()` from `scripts/art/preview.mjs`, at 540×960, opening `${baseUrl}/?stats`.
  - Set `progress.plane = 'nova'`, call `startGame({ stageId: 4, easy: true, skipToBoss: true })`, and keep the player invincible (as `.superpowers/tmp/shot-fx.mjs` does).
  - Every 250 ms: 3 `addExplosion` calls at random on-screen points (scale 1 or 1.6), and 20 enemy bullets via `addBullet` (radius 0.13, vz −6, spread across x).
  - After a 4 s warm-up, sample `window.__stats` once a second, then print the JSON.
- [ ] **Step 6: Verify:**
  - `npx vitest run src/game/fx/` passes.
  - `npx tsc --noEmit -p .` returns 0.
  - With `npm run dev` running, `node scripts/fx-bench.mjs http://localhost:5847` prints the JSON.
  - Record it in the ledger as the headless baseline.
- [ ] **Step 7: Commit** "FX: stats readout and a heavy-scene bench (baseline)".

### Task 2: Colours and bullet look (pure)

**Files:**
- Create: `src/game/fx/color.ts`, `src/game/fx/bulletLook.ts`, `src/game/fx/look.test.ts`
- Modify: `src/components/game/Bullets.tsx`. `ENEMY_BULLET_COLOR` moves to `color.ts`, and Bullets re-exports it, so the `BossLaser` import keeps working.

**Interfaces:**
- Produces:
  - `ENEMY_BULLET_COLOR = '#ff2bd6'`
  - `hueDistance(a: string, b: string): number`: 0..180 degrees.
  - `boltColor(flame: string): string`: the same hex when it is already ≥ 45° from `ENEMY_BULLET_COLOR`. Otherwise its hue is set to the enemy hue ± 45°, on the side it was on, with saturation and lightness kept.
  - `planeBoltColor(planeId: string): string` = `boltColor(getPlane(planeId).flame)`. Player bolts, wingmen, nova and a teammate's ghost bolts all use it.
  - `boltQuad(radius): { width: number; front: number; back: number }`: width = radius × 3, front = radius × 1.2, back = radius × 9.
  - `enemyBulletLayers(radius): { rim: number; halo: number; core: number }`: diameters 4.2r, 2.8r and 1.35r, today's values.

- [ ] **Step 1: Write the failing tests** in `look.test.ts`:
  - `'every plane's bolts stay at least 45° of hue from enemy magenta'`: loops over `PLANES` and checks `hueDistance(boltColor(p.flame), ENEMY_BULLET_COLOR) >= 45`.
  - `'a colour already far from magenta is kept'`: `boltColor('#3fd4ff') === '#3fd4ff'`.
  - `'a teammate's bolts take their own plane's colour'`: `planeBoltColor('nova') === boltColor(getPlane('nova').flame)`, and it differs from `planeBoltColor('hawk')`.
  - `'NOVA and MAGNETAR are pushed off magenta'`: `boltColor('#ff6aa8') !== '#ff6aa8'`, and its hue lies on the red side (between 350° and 360°, or 0° and 10°). `boltColor('#c07aff')` lands on the blue side (hue < 270°).
  - `'drawn bolts follow radius: never thinner than today, tip near the hit point'`: for radius 0.1 and 0.205, `width >= 2.2 * r`, `front <= 1.5 * r`, and the size grows with radius.
  - `'enemy bullets are never drawn smaller than today'`: `enemyBulletLayers(0.13)` is `{ rim: 0.546, halo: 0.364, core: 0.1755 }` within 1e-9.
- [ ] **Step 2: Run** `npx vitest run src/game/fx/look.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement both modules.** Use HSL via `THREE.Color.getHSL/setHSL`.
- [ ] **Step 4: Run** the tests, `npx tsc --noEmit -p .` and `npm test`. Expected: PASS, 0, and all green.
- [ ] **Step 5: Commit** "FX: bolt colours off enemy magenta, bullet draw sizes from radius".

### Task 3: Particle pool, emitters and visual events (pure)

**Files:**
- Create: `src/game/fx/particles.ts`, `src/game/fx/emitters.ts`, `src/game/fx/events.ts`, `src/game/fx/core.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type RGB = [number, number, number]
  interface ParticleSpec { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; size0: number; size1: number; color: RGB; alpha: number }
  interface Particles {
    readonly capacity: number; count: number
    pos: Float32Array   // 3 per particle
    col: Float32Array   // 4 per particle: r, g, b, alpha0
    misc: Float32Array  // 4 per particle: age, life, size0, size1
    spawn(p: ParticleSpec): void; step(dt: number): void; clear(): void
  }
  function createParticles(capacity: number, opts?: { drag?: number; gravity?: number }): Particles
  ```
  - Live particles stay packed in `[0, count)` (swap-remove). A full pool overwrites the particle with the greatest age.
  - `drag` decays velocity by `exp(-drag·dt)`. `gravity` is added to `vy`.
  - The renderer binds `pos`, `col` and `misc` as instanced attributes without copying.
  ```ts
  type Rand = () => number
  interface Burst { fire: ParticleSpec[]; sparks: ParticleSpec[]; debris: ParticleSpec[]; smoke: ParticleSpec[]; ring: ParticleSpec }
  function explosionBurst(x: number, z: number, scale: number, rand: Rand): Burst
  function hitSparks(x: number, z: number, color: RGB, rand: Rand): ParticleSpec[]
  function missilePuff(x: number, z: number, vx: number, vz: number, rand: Rand): ParticleSpec
  function novaRing(x: number, z: number, color: RGB): ParticleSpec
  function bossDeathBursts(x: number, z: number, half: number, rand: Rand): { at: number; x: number; z: number; scale: number }[]
  function fxShouldStep(gameState: string): boolean   // true only for 'playing'
  function takeNewExplosions<T extends { id: string }>(seen: Set<string>, list: readonly T[]): T[]
  // events.ts
  type FxEvent =
    | { kind: 'hit'; x: number; z: number; color: string }
    | { kind: 'nova'; x: number; z: number; color: string }
    | { kind: 'bossDeath'; x: number; z: number }
    | { kind: 'shieldHit'; x: number; z: number }
    | { kind: 'laserHit'; x: number; z: number }
  function emitFx(e: FxEvent): void
  function drainFx(): FxEvent[]
  ```
  A ring is a particle: `size0` and `size1` are its start and end radius.
- Pinned values (game units, real seconds):

  | Effect | Count | Life |
  |---|---|---|
  | Explosion fire | `min(18, round(6s))` | 0.35–0.6 |
  | Explosion sparks | `min(40, round(14s))` | 0.25–0.5 |
  | Explosion debris | `min(15, round(5s))` | 0.5–0.9 |
  | Explosion smoke | `min(12, round(4s))` | 1.2–2.0 |
  | Explosion ring | 1, radius 0.3 → `2.2s` | 0.35 |
  | Hit sparks | 6 sparks plus 1 flash (size 0.6) | sparks 0.15–0.3, flash 0.08 |
  | Missile puff | 1 | 0.6–0.9 |
  | Boss death | 7 bursts | over 0–1.4 s |

  - Explosion particles start within `1.2 × scale` of (x, z).
  - Hit sparks fly at 4–9 units/s.
  - The missile puff starts behind the missile and grows 0.25 → 0.8.
  - Boss death: the last burst is at 1.4 s, at (x, z), scale 3. The others have scale 1–1.8, within ±`half`.
  - The event queue holds at most 256 events and drops the oldest.

- [ ] **Step 1: Write the failing tests** in `core.test.ts`. Use a seeded `rand` (mulberry32) in every test.
  - `'a pool keeps live particles packed and drops them when their life ends'`
  - `'a full pool replaces the oldest particle'`: capacity 3. Spawn a, step 0.1; spawn b, step 0.1; spawn c, spawn d. `count` is 3 and a is gone.
  - `'drag slows a particle and gravity pulls it'`
  - `'explosion counts scale with size and stay capped'`: at scales 1, 1.6 and 3, the counts match the table and never exceed the caps.
  - `'smoke outlives fire'`: min smoke life > max fire life.
  - `'a boss dies in 7 bursts, the last and biggest at its centre at 1.4 s'`: times are sorted within [0, 1.4], and all positions lie within the footprint.
  - `'effects step only while playing'`: `fxShouldStep` is true for 'playing' and false for 'paused', 'menu', 'results' and 'bossWarning'.
  - `'each store explosion starts one burst, and dropped ones are forgotten'`: calling `takeNewExplosions` twice with the same list returns the entries once. After an entry leaves the list, `seen` no longer holds its id.
  - `'events drain in order and the queue keeps the latest 256'`
- [ ] **Step 2: Run** `npx vitest run src/game/fx/core.test.ts`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement** the three modules.
- [ ] **Step 4: Run** the tests and `npm test`. Expected: all green.
- [ ] **Step 5: Commit** "FX: particle pool, emitters and a visual event queue".

### Task 4: Materials, particle layers, the renderer and the preview page

**Files:**
- Create: `src/components/game/fx/materials.ts`, `src/components/game/fx/ParticleLayer.tsx`, `src/components/game/fx/FxRenderer.tsx`, `fx-preview.html`, `src/fxPreview.tsx`

**Interfaces:**
- Consumes: Task 3's `Particles`, emitters and `RGB`.
- Produces:
  - **Materials** (`materials.ts`). Each is a `THREE.ShaderMaterial` with `toneMapped: false` and `depthWrite: false`, drawn on a unit quad lying in the XZ plane (the camera always looks straight down). Each has a `uTime` uniform, updated once a frame by its owner.
    - `glowMaterial()`: additive. A soft radial falloff with a hot centre. Per instance: colour, alpha, and age/life for fade and size.
    - `smokeMaterial()`: normal blending. A noisy grey puff that darkens, grows and fades.
    - `ringMaterial()`: additive. A soft annulus from size0 to size1 over life.
    - `streakMaterial()`: additive. A capsule with a white core and a coloured halo, plus a fading tail toward −Z of the quad.
    - `sparkMaterial()`: additive. A short streak stretched along its velocity.
  - `ParticleLayer({ particles, material, y, renderOrder })`: an InstancedMesh of `particles.capacity` quads. `pos`, `col` and `misc` are bound as InstancedBufferAttributes. `count` and `needsUpdate` are set each frame.
  - `FxRenderer({ paused, shield, children })` provides `useFx(): Fx`:
    ```ts
    interface Fx {
      explosion(x: number, z: number, scale: number): void
      hit(x: number, z: number, color: string): void
      puff(x: number, z: number, vx: number, vz: number): void
      nova(x: number, z: number, color: string): void
      bossDeath(x: number, z: number, boss: BossDef): void
      laserHit(x: number, z: number): void
      shieldHit(x: number, z: number): void
      clear(): void
    }
    ```
    - It owns the pools and their draw heights and render orders, kept in `src/game/fx/layers.ts`:

      | Pool | Capacity | y | renderOrder |
      |---|---|---|---|
      | smoke | 256 | 0.15 | 1 |
      | debris | 128 | 0.2 | 2 |
      | rings | 32 | 0.45 | 3 |
      | fire | 256 | 0.5 | 3 |
      | sparks | 512 | 0.55 | 4 |

      Bolts use y 0.35 and renderOrder 5. Enemy bullets use rim, halo and core at y 0.3, 0.4 and 0.75, renderOrder 20–22, above the clouds' 10.
    - It steps the pools with real dt when `paused()` is false.
    - In this task only `puff` and `clear` are implemented; the other methods are stubs that later tasks fill in.
  - **Preview page.** `fx-preview.html` and `src/fxPreview.tsx`, at `?fx=<cell>,<cell>…`. Each cell is a 540×300 orthographic top-down canvas over `<Environment biome=…>`, inside `FxRenderer`. It plays its effect on a 3 s loop and sets `window.__previewReady`. The first cell is `puff` (a missile path puffing smoke).

- [ ] **Step 1: Write the failing test** `src/components/game/fx/ParticleLayer.test.ts` (node is enough: no WebGL is needed). `'a layer shares the pool's arrays and draws only live particles'`: build the InstancedMesh with `buildParticleMesh(particles, material)` (exported from `ParticleLayer.tsx`). Its attributes' `.array` are the pool's typed arrays (same object), and after `syncParticleMesh` the mesh `count` equals `particles.count`.
- [ ] **Step 2: Run** it. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** the materials, `ParticleLayer` (`buildParticleMesh` and `syncParticleMesh`), `FxRenderer`, `layers.ts` and the preview page with its `puff` cell.
- [ ] **Step 4: Verify:**
  - The test passes, `npx tsc --noEmit -p .` returns 0 and `npm test` is green.
  - `http://localhost:5847/fx-preview.html?fx=puff` shows the smoke, with no console errors (Playwright screenshot).
- [ ] **Step 5: Commit** "FX: shader materials, particle layers, renderer and preview page".

### Task 5: Batch 1 — bolts, enemy bullets, missiles, muzzle flash (review STOP)

**Files:**
- Create: `src/components/game/fx/BulletMeshes.tsx` (`BoltsMesh`, `EnemyBulletsMesh`, `MissilesMesh`), `src/components/game/fx/MuzzleFlash.tsx`, `src/components/game/fx/FxGame.tsx`
- Modify:
  - `src/store/gameStore.ts`: `Bullet` gets `color?: string`, visual only.
  - `src/components/game/Bullets.tsx`: the render half uses the meshes; collision is untouched.
  - `src/components/game/Player.tsx`: bolts, wingmen and nova bolts get `color: planeBoltColor(plane.id)`; `MuzzleFlash` replaces the re-render-gated sphere.
  - `src/components/game/Teammates.tsx`: ghost bolts get `color: planeBoltColor(m.plane)`.
  - `src/components/game/GameScene.tsx`: wraps the actors in `<FxRenderer>` and mounts `<FxGame />`.
  - `src/fxPreview.tsx`: cells `bolts`, `enemy`, `missiles` and `muzzle`.

**Interfaces:**
- Consumes: `boltQuad`, `enemyBulletLayers`, `planeBoltColor` and `ENEMY_BULLET_COLOR` (Task 2); `streakMaterial` and `glowMaterial` (Task 4); `useFx` (Task 4).
- Produces:
  - `BoltsMesh({ bolts: () => readonly BoltView[] })`, with `BoltView = { x: number; z: number; vx: number; vz: number; radius: number; color: string }`.
  - `EnemyBulletsMesh({ bullets: () => readonly { x: number; z: number; radius: number }[] })`.
  - `MissilesMesh({ missiles: () => readonly { x: number; z: number; vx: number; vz: number }[] })`.
  - `MuzzleFlash({ guns: () => readonly number[]; flash: () => number })`.
  - `FxGame()`: in-game glue. Each frame it emits `fx.puff` for each homing bullet, with probability `dt / 0.04`. It calls `fx.clear()` when the stage id changes or the game leaves `'playing'`/`'paused'`. In later tasks it also handles explosions and events.
- **Look:**
  - **Bolts:** a `streakMaterial` quad sized by `boltQuad`, in `boltColor`. Untinted bolts use `'#7cf9ff'`.
  - **Enemy bullets:** the dark rim disc (normal blending, opacity 0.75) and a soft magenta glow halo, then a white core, sized by `enemyBulletLayers`.
  - **Missiles:** a dark metal body 0.32 × 0.9 with a red tip glow, a tail flame sprite and the smoke puffs.
  - **Muzzle flash:** a star-shaped glow at each stream's x offset, 0.9 ahead of the plane. It shows while the store's `muzzleFlash > 0.75` (about 90 ms real per volley), flickers in scale, and is read in `useFrame` (this fixes the re-render bug).
- Draw calls: bolts 1, enemy bullets 3, missiles 2, muzzle flash 1, whatever the counts.

- [ ] **Step 1: Write the failing test** `src/components/game/fx/BulletMeshes.test.ts` (node):
  - `'bolt instances take their colour and size from the bullet'`: two `BoltView`s with different colours and radii. After `syncBolts(mesh, views)`, which is exported, the instance colours equal `boltColor` of each view and the scales equal `boltQuad`.
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Implement** the meshes, `MuzzleFlash`, `FxGame`, the colour fields and the preview cells.
  - Bullets.tsx keeps its sim step unchanged; only its `useFrame` and JSX change (Tasks 6 and 7 add `emitFx` calls there).
- [ ] **Step 4: Verify:**
  - `npm test` is green and tsc returns 0.
  - The 10-stage start check (`.superpowers/tmp/briefing-all.mjs`) passes.
  - Re-run the bench and compare with the Task 1 baseline.
  - Take preview and in-game shots of hawk, nova, magnetar and hornet (missiles) at max weapon, plus a boss fight.
- [ ] **Step 5: STOP.** Show the user the preview link and the shots, and wait for approval.
- [ ] **Step 6: Commit** "FX batch 1: plasma bolts, readable enemy bullets, missiles, muzzle flash".

### Task 6: Batch 2 — explosions, hit sparks, boss death (review STOP)

**Files:**
- Create: `src/components/game/fx/BossWreck.tsx`
- Modify:
  - `FxRenderer.tsx`: `explosion`, `hit` and `bossDeath`.
  - `FxGame.tsx`: new store explosions with scale < 3 go to `fx.explosion`; it drains `hit` and `bossDeath` events.
  - `Bullets.tsx`: `emitFx({ kind: 'hit', … })` at each enemy, boss or ghost hit, in the sim step after the hit is decided, with `b.color`.
  - `effects.ts`: `bossKilled` adds `emitFx({ kind: 'bossDeath', x, z: y })`.
  - `GameScene.tsx`: removes `<Explosions />`.
  - `fxPreview.tsx`: cells `explosion` (scales 1, 1.2, 1.6), `hits` and `bossdeath`.
- Delete: `src/components/game/Explosions.tsx`.

**Interfaces:**
- Consumes: `explosionBurst`, `hitSparks`, `bossDeathBursts`, `takeNewExplosions` and the events (Task 3).
- Produces:
  - `wreckAlive(w: { t0: number; stageId: number }, now: number, stageId: number, gameState: string): boolean`, in `src/game/fx/emitters.ts`. `now` is the renderer's clock (`FxRenderer` keeps one that only advances while it steps, so a pause freezes it). True while `now − t0 < 1.5`, the stage is the same, and the game is `'playing'` or `'paused'`.
  - **`BossWreck`:**
    - It draws the stage's boss model, or its vehicle, at the death spot for 1.5 s, using Boss.tsx's height and π rotation.
    - Its materials flash with `applyFlash` and darken toward 0.3 brightness.
    - Bursts go off from `bossDeathBursts` with `half = def.size × 0.4`. The last burst removes the wreck.

- [ ] **Step 1: Write the failing tests.** In `src/game/fx/core.test.ts`:
  - `'a wreck ends after 1.5 s, on a stage change or back at the menu'`
  - In a new `src/components/game/effects.test.ts` (`// @vitest-environment jsdom`, since `effects.ts` pulls in `Coins.tsx`): `'killing the boss raises one bossDeath event at its spot'`. Call `bossKilled(3, 9, { mine: false })` against the real store, then `drainFx()` contains exactly one `{ kind: 'bossDeath', x: 3, z: 9 }`.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.** No pointLights. The shake values stay as the store sets them.
- [ ] **Step 4: Verify:**
  - `npm test` is green and tsc returns 0.
  - The 10-stage check passes, and the bench is compared with the baseline.
  - Shots: the preview cells; in game, a wave being shot down; a ram; a tank kill; a boss death, in single player and in loopback co-op (`?coop=loopback`).
- [ ] **Step 5: STOP.** The user reviews.
- [ ] **Step 6: Commit** "FX batch 2: fire-and-smoke explosions, hit sparks, boss death".

### Task 7: Batch 3 — engine flames, boss laser, shield, nova (review STOP)

**Files:**
- Create: `src/components/game/fx/ShieldBubble.tsx`
- Modify:
  - `EngineFlame.tsx`: same props.
    - One quad with `flameMaterial()`: noise flicker, a hot core fading into the colour, then transparent at the tail.
    - Plus a nozzle glow sprite: 2 draw calls per flame instead of 3.
  - `BossLaser.tsx`: same timing.
    - Beam layers with `beamMaterial()` (soft outer glow, white core, noise flicker along the length) and a muzzle flash sprite.
    - Charge sparks drawn with the glow material.
  - `Boss.tsx`: `emitFx({ kind: 'laserHit', x: playerX, z: playerY })` when the beam hits, at most every 0.05 s.
  - `Bullets.tsx`: `emitFx({ kind: 'shieldHit', x: b.x, z: b.z })` before `damagePlayer` when `shieldMs > 0`.
  - `Player.tsx`: removes the shield group; nova emits `emitFx({ kind: 'nova', … })`.
  - `FxRenderer.tsx`: `laserHit` (sparks), `shieldHit` (ripples), `nova` (ring and flash), and `ShieldBubble`.
  - `materials.ts`: `flameMaterial`, `beamMaterial` and `shieldMaterial`.
  - `fxPreview.tsx`: cells `flames` (hawk and a boss), `laser`, `shield` and `nova`.

**Interfaces:**
- Produces:
  - `ShieldBubble({ target: () => { x: number; z: number; ms: number; down: boolean } | null })`. It reads ripples from the renderer.
  - Its look: a flattened bubble, brighter at its edge (fresnel on the XZ radius), pulsing ±4%, and flickering in its last 1.5 s as today. It shows up to 4 ripples, each spreading from its hit point over 0.4 s.
  - `rippleSlots(ripples: { x: number; z: number; t0: number }[], now: number): { x: number; z: number; age: number }[]`, in `src/game/fx/emitters.ts`. It keeps the newest 4 younger than 0.4 s; `now` is the renderer's clock.

- [ ] **Step 1: Write the failing test** in `core.test.ts`: `'the shield shows the newest 4 ripples younger than 0.4 s'`.
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify:**
  - `npm test` is green and tsc returns 0.
  - The 10-stage check passes, the bench is compared, and the hangar still shows the flames.
  - Shots: the preview cells; in game, the boss laser charge and fire with its contact sparks; an AEGIS shield blocking; a nova burst.
- [ ] **Step 5: STOP.** The user reviews.
- [ ] **Step 6: Commit** "FX batch 3: shader flames, layered laser, rippling shield, nova ring".

### Task 8: Clean-up, cost check and phone check (STOP)

**Files:**
- Modify: whatever the checks find; `docs/superpowers/specs/2026-10-21-reskin-vfx-design.md` (resume notes and follow-ups).

- [ ] **Step 1: Remove dead code:**
  - the old meshes and materials;
  - the unused `muzzleFlash` render path;
  - any `Explosion` render leftovers.
  - Store fields stay: `explosions`, `muzzleFlash` and `screenShake` are still read.
- [ ] **Step 2: Bench.** Compare `node scripts/fx-bench.mjs` against the Task 1 commit, run in a worktree dev server on port 5848.
  - Expected: branch `fpsMedian` ≥ 95% of baseline, and `callsMedian` ≤ baseline.
  - If not, cut counts and sizes (FPS wins), then re-bench.
- [ ] **Step 3: Verify:** `npm test`, tsc 0, `npm run build`, the 10-stage check, and `npm run art:memory`.
- [ ] **Step 4: Phone check (STOP).**
  - Serve builds of the Task 1 commit (:4174) and the branch (:4173) on the LAN.
  - The user plays, with `?stats` on both:
    - the boss fight with the laser (`?boss`, EASY START for max weapon);
    - a wave-heavy stretch;
    - one loopback co-op run.
  - The user compares FPS, then gives a verdict.
- [ ] **Step 5: Commit**, then the final whole-branch review (superpowers:executing-plans) and superpowers:finishing-a-development-branch.
