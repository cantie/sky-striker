# Reskin, part 2: bullets and aircraft effects — design

Status: **done and merged into `main` (2026-10-22).** The user approved the three look batches, the phone
check (FPS no lower than before) and the items pass below. The final whole-branch review's Important
findings are fixed; its minors are listed under the follow-ups.
Follows part 1, [2026-10-20-reskin-aircraft-design.md](2026-10-20-reskin-aircraft-design.md), whose AI aircraft
are on `main`.

## How to resume (next session, any machine)
1. No keys are needed: everything here is drawn in code.
2. The plan is [2026-10-21-reskin-vfx.md](../plans/2026-10-21-reskin-vfx.md); all its tasks are done and on
   `main`. What is left is under "Follow-ups after part 2".
3. Looking at the effects: `npm run dev`, then `/fx-preview.html?fx=puff,bolts,enemy,missiles,muzzle,explosion,`
   `hits,bossdeath,flames,laser,shield,nova,pickups,cover` (`&at=<s>` freezes a cell, `&biome=<name>` swaps
   the ground).
   In the game, `?stats` shows FPS and draw calls; `node scripts/fx-bench.mjs <url>` runs the heavy scene.
4. The user writes Vietnamese; answer in Vietnamese.

## Intent
Part 1 put every aircraft, ground unit and boss on semi-realistic AI models (Sky Force Reloaded style). The
bullets and effects around them are still flat-colour spheres and cones made bright by bloom, so they look
like toys next to the new models. The user wants the bullets and the aircraft effects to look real, in the
same style as the models.

The user looked at the environment (ground, scenery, lighting, sky) next to Sky Force Reloaded and decided to
leave it as it is. Of the five planned sub-projects, 2 (lighting, sky, post) and 3 (ground and scenery) are
dropped for now. This document is sub-project 4 (VFX). UI (sub-project 5) stays for later.

Success: in a busy fight the effects read as hot plasma, fire, smoke and sparks in the style of the models,
enemy bullets are as easy to dodge as today, and the game is no slower on a phone.

## Scope
In scope. The left column is today (measured 2026-10-21), the right column is the target:

| Effect | Today | Target |
|---|---|---|
| Player bolts (every weapon level, wingmen, nova, a teammate's ghost bolts) | small cyan capsules, the same for every plane | long plasma bolts: a hot white core, a halo in the plane's flame colour (`PlaneDef.flame`), a short glow streak behind |
| Homing missiles | orange ovals | a small missile body, a flame at the tail, a smoke trail that thins and fades |
| Enemy and boss bullets | magenta sphere, white core, dark disc under it | still round, magenta, bright and readable: a hot core, a soft glowing halo and the dark contrast disc kept. Same apparent size as today |
| Muzzle flash | a sphere that only shows when the Player happens to re-render (bug) | a short star-shaped flash at each gun on every volley |
| Bullet hits | sound only | sparks at the hit point; a small flash on the target as today |
| Explosions (enemy, heavy/tank, ram, boss death) | 3 coloured spheres growing for 0.5 s, a point light each | a fireball, sparks and debris thrown out, a shockwave ring, smoke that lingers and drifts after the fire. Size follows today's scale (1, 1.2, 1.6, 3). Boss death: several bursts over the boss body over about 1.5 s |
| Engine flames | an additive cone and core | a flickering flame with a hot core and a heat glow; positions still from `flamePositions` |
| Boss laser (charge and beam) | a flat magenta strip | charge: gathering sparks and a growing core. Beam: layered, a white-hot core, a magenta outer glow, a flicker along its length, a flash at the muzzle, sparks where it ends |
| Shield | a translucent blue bubble and ring | an energy bubble that is brighter at its edge and ripples where it blocks a hit |
| Nova burst | no visual of its own | an expanding shockwave ring as the 18 bolts leave |

Out of scope: pickups, coins and stars; the environment and its clouds; lighting, tone mapping and the
post-processing chain, apart from settings an effect needs (for example the bloom threshold); UI; sounds;
camera shake values.

## Constraints
- **Gameplay and co-op do not change.** This covers bullet speed, collision radii (`radius` is both the hit
  size and today's draw size, so the draw size must stay derived from it), damage, timing, laser width
  (`LASER_HALF_WIDTH`), the shield and nova rules, and the moment a boss death ends the stage.
  - No edits to `src/game/sim/`, the `src/net/coop/` protocol or data, or `nakama/`. The existing sim, coop and
    Lua tests stay unchanged and green.
  - Effects only read gameplay state: store bullets, explosions, shield and boss state, and the events
    gameplay already raises. They never write it.
  - A visual-only event is allowed where none exists today, such as "a bullet hit here" for sparks or "the
    shield blocked a hit here" for the ripple. It must not change what gameplay does.
- **Enemy bullets stay readable:** round, magenta (`ENEMY_BULLET_COLOR`), the easiest thing on screen to pick
  out, no smaller than today, and never hidden by smoke or explosions.
  - Anti-goal: realistic but harder to dodge.
  - Effects that could cover them draw beneath them.
  - Smoke and debris also draw beneath the pickups and stars, which the player has to collect.
- **Phones: FPS no lower than today**, measured in the worst case:
  - a boss fight with its laser;
  - the player at max weapon level;
  - many explosions at once.
- **Bounded cost.** Every effect type has a fixed pool or cap: no unbounded React components per explosion,
  and no point lights added per explosion. The light count changes today as explosions come and go. Draw
  calls for all effects together stay small and do not grow with the number of bullets or explosions.
- **No new runtime dependencies.** Three.js, R3F, drei and postprocessing are already there.
- The repo is public: no keys and no internal host names in commits. Nothing in this part needs either.
- Keep each file's line endings. CRLF files include `Player.tsx`, `Enemies.tsx`, `GameScene.tsx` and
  `Model.tsx`; check with `git cat-file -p HEAD:<file> | tr -cd '\r' | wc -c`.

## Decided
By the user:
- Drop the environment work; do bullets and aircraft effects.
- The look per effect is the target column in Scope.

Executor's calls, accepted by the user in chat:
- **Drawn in code** with shaders and particles, with textures made in code (soft dots, noise). There is no
  AI image or 3D pipeline here: files stay light and phone cost stays under control.
- **Player bolts take the plane's flame colour.** This is visual only; bullets stay plain data.

Executor's calls after the builder check (the user checks them while reading):
- **Bolt colour near the enemy magenta.**
  - NOVA's flame `#ff6aa8` is about 23° of hue from `ENEMY_BULLET_COLOR` `#ff2bd6`, and its nova bolts fly
    down through enemy fire. MAGNETAR's `#c07aff` is about 40° away.
  - So a bolt's halo uses the flame colour with its hue pushed to at least 45° from the enemy magenta: NOVA's
    bolts turn warm orange-pink, MAGNETAR's a bluer violet.
  - Player bolts are always long streaks with a thin core; only enemy bullets are round with the dark disc.
  - Unit test: no plane's bolt hue lands within 45° of the enemy magenta.
- **Boss death.**
  - Gameplay keeps clearing the boss on the kill frame as today; stars, victory timing and co-op are
    untouched.
  - The effects layer keeps a visual-only copy of the boss model where it died for about 1.5 s. The copy
    flashes and darkens while bursts go off across its footprint, then is gone in the last big blast.
  - The copy must not block the stage's model freeing or the co-op stage change. It simply ends early if the
    stage ends first.
- **When the look and phone FPS conflict, FPS wins.**
  - The effects cut particle counts, sizes and smoke life until they fit.
  - No global quality tiers, and nothing outside the effects is changed for cost (shadows, dpr, scene
    lights). Per-explosion point lights go away; the player's and the boss's flame lights may stay.
  - The first step measures `main` on the user's phone with the stats readout. That gives the baseline, and
    shows whether the phone is already below its refresh rate.
  - Fact: `AdaptiveDpr` never lowers the resolution, because nothing calls `regress()`.
- **Laser sparks.** The beam is still drawn at full length (48 units, past the screen edge). Sparks fly where
  it crosses the player or the shield, not at its end, so the drawn beam keeps matching the hit zone.

## Left to the builder
- Effect architecture: shared particle pools versus per-effect instanced meshes, shader details, pool
  sizes, how effects learn about hits.
  - Explosions are already store entries (x, z, scale, born time). The effects layer may keep its own
    visual-only state for smoke and debris that outlives the 600 ms store entry.
- Exact colours, timings and sizes, within the targets above.
- **How the user reviews the look.** Reuse the art preview idea: a dev page, or a URL flag in the game, that
  plays each effect on a loop from the game camera. Plus in-game screenshots per effect.
  - Review in batches, like part 1: bolts and enemy bullets first, since they matter most for play, then
    explosions and hits, then flames, laser, shield and nova.
- **How FPS is measured.** There is no FPS readout today, and the part 1 phone check was by eye. A dev-only
  readout (for example `?stats`: FPS and draw calls) would let the user compare `main` and the branch on
  their phone. It must not ship visible to players.
- **Tests.** Pure parts get unit tests: pools, emitters, colour mapping, the boss-death burst timing, and
  "draw size follows radius". Looks are checked by the user from the preview and in-game shots. Cost
  under load is checked with a scripted heavy scene in the headless browser (relative to `main`), then on
  the user's phone.

## Facts the builder needs (measured on `main`, 2026-10-21)
- **Bullets** are store objects: `x, y, z, vx, vy, vz, isEnemy, damage, radius, pierce, hits, homing, ghost`.
  - `Bullets.tsx` draws them with 5 InstancedMeshes, capped at 512 each, and also runs collision.
  - Collision uses `x`/`z` and `radius`: enemy `role.radius + b.radius`, boss `bossRadius`, player
    `0.55 + b.radius`.
  - Draw scale multipliers (2.2, 5.5, 4.2, 2.8, 1.35, missile 0.32 × 0.9) and draw heights are visual only.
- **Co-op:** bullets are never networked; every client simulates them locally. A teammate's bolts are local
  `ghost` copies with damage 0. Kills are confirmed by the server. Bullet radius is not part of the co-op
  data version hash; `weaponStats` damage, streams and interval are.
- **Explosions:** `Explosions.tsx` renders one component per store entry. Each has 3 spheres and a
  pointLight. The store drops an entry after 600 ms. Scales: 1 normal, 1.2 ram, 1.6 heavy/tank, 3 boss death.
- **Engine flames:** `EngineFlame.tsx` draws 3 meshes per flame on every ship. Sizes come from the model
  footprint (`Model.tsx`), flameScale is 1.1 for the player and 1.3 for bosses, and positions come from
  `src/game/flames.ts`.
- **Boss laser:** `BossLaser.tsx`. Charge 1.1 s, fire 0.9 s, aim lock 0.35 s (game seconds). The gameplay
  half-width is `LASER_HALF_WIDTH` 0.6 + 0.35.
- **Shield:** drawn in `Player.tsx`. It lasts 8 s from a pickup, or 5 s every 10 game-s for AEGIS. A blocked
  hit raises a 0.15 shake in `gameStore.ts`.
- **Nova:** 18 bolts through the player-bolt mesh and a 0.2 shake (`Player.tsx`).
- **Glow:** effects use `MeshBasicMaterial` with `toneMapped={false}`. Bloom is threshold 0.7, intensity
  0.7, mipmapBlur, 5 levels; then Vignette (`GameScene.tsx`). Tone mapping is ACES at exposure 1.15.
- **Renderer:** dpr [1, 1.75] with AdaptiveDpr. There are no quality tiers.
- **Tests:** none cover `Bullets`, `Explosions`, `EngineFlame`, `BossLaser` or the Player skills today.

## Items pass (asked after part 2, 2026-10-22)
The user asked for three things after the batches: fewer health drops (at most 3 a map), dropping the star
pod item, and redrawn items, bigger, prettier, easier to read and more real, after Sky Force Reloaded (the
item they like there is the winged fire-rate badge).
- **Decided with the user:** mockup direction B (each item its own shape: gold winged badge with a red crest
  and white chevrons for the power-up, a glossy red heart with a white cross for health, a glass orb with a
  white shield, a faceted gold star). **The star pod stays** (and is redrawn), so Nakama needs no redeploy.
- **Health cap:** single-player only. Co-op drops come from the Nakama server, so co-op keeps uncapped
  health until the server is next deployed: add `healthDropped` / `MAX_HEALTH` to `coopData`, the Lua
  `pick_drop` and the loopback server then (it changes the co-op data version, so clients and server must
  update together).
- **My calls:** health is spread like power-ups (the 2nd after a third of the stage, the 3rd after two
  thirds); when no drop type is allowed, a kill drops nothing. The pieces are about 1.35× the old badge (the
  power-up's wings about 2.2 wide); the pick-up radius is unchanged. They draw in the see-through pass with
  no depth test (`PICKUP_LAYERS`), because the tallest trees reach above them; clouds and enemy bullets
  still cover them. Each is at most 3 draws (outlines are painted into the vertex colours), with matcap
  finishes painted on a canvas, not images.
- **Where:** `src/components/game/pickups/` (shapes, finishes, PickupArt) and the `pickups` preview cell.

## Follow-ups after part 2
- Co-op health cap: see "Items pass" above (needs a Nakama deploy).
- `npm run art:memory` reads the texture count 5 s into each stage, before its models have always loaded,
  so it passes or fails by load timing on a slow machine (`main` does the same). It should wait for the
  stage's models, or compare counts once they settle.
- The headless bench runs on software GL at 2–5 fps: compare builds with each other, never with a phone.
  The phone with `?stats` is the real FPS check.
- The laser crossing a shield throws its contact sparks but no ripple: the renderer does not know where the
  beam meets the rim.
- The shield bubble no longer blinks during the post-hit invincibility, since it is no longer part of the
  plane.
- A missile's smoke trail is faint on light sand.
- Effects run on real seconds and step at most 0.1 s a frame, so below 10 fps a boss death sequence runs
  slower than the stage around it and can be cut off by the results screen.
- From the final review (minor, deferred):
  - The InstancedMeshes made as `<primitive>` (bullet meshes, muzzle flash, laser sparks, particle layers)
    are not `.dispose()`d on unmount, so their instance buffers wait for GC (about 180 KB per stage).
  - Small per-frame allocations in the glue: `takeNewExplosions`, `drainFx`, and `rippleSlots` while
    shielded.
  - Shader time comes from the canvas clock unwrapped; after hours the noise inputs grow large. Wrap it.
  - Laser contact sparks still fly at a downed co-op player.
  - The boss wreck hides the boss's stars for their first half second or so (they spawn inside its hull).
  - FxGame's clear rules are inline and untested; nothing tests that a ghost bolt's hit sparks.
  - The wreck's shudder and the missile flame flicker keep moving while paused.
