# Reskin part 1: AI art pipeline + aircraft — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An in-repo, manifest-driven pipeline (image model → Hunyuan3D → optimized GLB) and the 84 AI models
it produces, wired into the game in place of every aircraft, ground vehicle and boss.

**Architecture:** Node scripts in `scripts/art/` read `art/manifest.mjs` and write `art/concepts/*.webp` and
`public/models/ai/*.glb`; every step is pure functions plus a thin CLI, so it is unit-tested with fakes. In
the game, AI models load per stage through an awaitable model cache (`src/game/assets/modelCache.ts`); the
briefing waits for them and a stage change frees the previous stage's models. Definitions in `planes.ts`,
`stages.ts` and `bosses.ts` switch to `/models/ai/<id>.glb` one batch at a time.

**Tech Stack:** Node ≥ 20 ESM, `@gltf-transform/{core,extensions,functions}` 4.5, `meshoptimizer`, `sharp`,
three 0.180, React 19 + @react-three/fiber 9, vitest, Playwright (already a dev dependency).

**Spec:** `docs/superpowers/specs/2026-10-20-reskin-aircraft-design.md`

## Global Constraints
- The repo is public: no keys and no internal host names in commits. Keys only in
  `~/.config/sky-striker/assets.env` or the environment.
- Gameplay, hitboxes and logic (single-player and co-op) stay as they are: no edits to `src/game/sim/`,
  `src/net/coop/` protocol or data, `nakama/`; the existing sim, coop and Lua tests stay unchanged and green.
- Phones: FPS no lower than today.
- Budgets: `small` 2k tris / 256 px, `medium` 4k / 512, `large` 8k / 512.
- Hunyuan3D: `POST /send`, poll `GET /status/{uid}` every 5 s, give up after 30 min, at most 2 jobs in flight,
  download `result_url` at once with the Bearer header; never `/generate`, never `?base64=true`.
- Image model: `POST /v1/images/generations {model, prompt, size: '1024x1024', n: 1}`; edits
  `POST /v1/images/edits` multipart (`model`, `prompt`, `size`, `image`).
- Creased normals at 35°.
- Keep each file's line endings (all files touched here are LF). Commit with `git commit -F <file>`.
- On this Windows machine point `TEMP`, `TMP` and `npm_config_cache` at `E:\projects\others\sky-striker\.superpowers\tmp`
  before npm / npx / gltf-transform.
- Work on branch `feat/reskin` off `main`.

## Rulings made while planning (the spec leaves these open)
- **KB budgets**: `small` ≤ 80 KB, `medium` ≤ 160 KB, `large` ≤ 220 KB (spike: 2k/256 = 53 KB,
  6k/512 = 130 KB; totals ≈ 7.4 MB, matching the spec's ~7 MB). Cost if wrong: retune three numbers.
- **Approval mark**: an asset is approved when `art/concepts/<id>.webp` exists; the manifest stays hand-written
  code that tools never rewrite. Cost if wrong: an `approved` list would be a small change in `planModel`.
- **"Faces +Z"**: automated checks assert the model lies flat (Y is its thinnest extent); nose direction is
  checked in the `preview` review, and a manifest `turn: 180` makes `build` rotate it. Cost if wrong: one
  more check in `checkGlb`.
- **Model cache instead of `useGLTF.clear`**: drei/r3f `useGLTF.preload` returns nothing awaitable, so the
  briefing could not know when loading ends. Our own cache (GLTFLoader + MeshoptDecoder) gives awaitable
  loads, retry after failure and real disposal. Scenery (`Environment.tsx`, `terrain/props.ts`) stays on
  drei. Cost if wrong: two caches hold a Kenney model twice (small).
- **Enemy, hull and turret-base "designs" are their stage-1 models** (or stage 3 / 7 for boat / hover):
  `enemy-<role>-s1` is the design, `enemy-<role>-s2…s10` are its 36 repaints (spec: 4 designs, 40 models,
  batch 3 = 36 repaints).

## Review Focus
1. The image API answers with `data[0].url` instead of `b64_json` → the client downloads the URL
   (test in Task 2).
2. `GET /status` fails with a transient HTTP error mid-poll → keep polling until the 30-min cap, do not fail
   the job (test in Task 2).
3. The player changes plane in the hangar after the briefing finished loading → the briefing loads the new
   plane before START is enabled (test in Task 6).
4. A definition points at an AI model that 404s → the briefing shows the error and RETRY really refetches,
   instead of a spinner forever or a cached rejection (test in Task 5).
5. A stage change must never free Kenney/scenery models or models the current stage still lists
   (test in Task 5).

## File structure
| File | Responsibility |
|---|---|
| `art/manifest.mjs` | `STYLE`, `BUDGETS`, `ASSETS` rows (hand-written) |
| `art/.gitignore` | `.cache/` |
| `art/concepts/<id>.webp` | approved concepts, 512 px |
| `scripts/art/env.mjs` | read `assets.env`, require keys |
| `scripts/art/manifest.mjs` | validate the manifest, select a batch or ids |
| `scripts/art/clients.mjs` | image-model and Hunyuan3D HTTP clients |
| `scripts/art/batch.mjs` | bounded-concurrency batch runner, retry with another seed |
| `scripts/art/paths.mjs` | where drafts, concepts, raw and built GLBs live |
| `scripts/art/steps.mjs` | prompts, what each step still has to do, review page |
| `scripts/art/build.mjs` | raw GLB → optimized GLB |
| `scripts/art/checks.mjs` | checks on a built GLB (used by tests and `build`) |
| `scripts/art/preview.mjs` | Playwright screenshots of a batch |
| `scripts/art/memory-check.mjs` | Playwright texture-count check across stages |
| `scripts/art/cli.mjs` | `npm run art -- <step> …` |
| `art-preview.html`, `src/artPreview.tsx` | dev page: old vs new model from the game camera |
| `src/game/assets/modelCache.ts` | awaitable GLB cache, `useModelScene` |
| `src/game/assets/stageLoader.ts` | briefing load state, `useStageModels` |
| `src/game/stageModels.ts` | the models a stage needs |
| `src/game/flames.ts` | engine-flame positions, `Nozzle` |
| `src/components/game/materialLook.ts` | hit flash and silhouette on materials |
| `src/game/aiAssets.test.ts` | definitions ↔ manifest ↔ files, and every built GLB |

---

### Task 1: Art toolchain, env and manifest

**Files:**
- Modify: `package.json` (devDependencies, script `"art": "node scripts/art/cli.mjs"`), `vitest.config.ts`
  (add `'scripts/**/*.test.mjs'` to `include`)
- Create: `art/manifest.mjs`, `art/.gitignore`, `scripts/art/env.mjs`, `scripts/art/manifest.mjs`
- Test: `scripts/art/env.test.mjs`, `scripts/art/manifest.test.mjs`

**Interfaces:**
- Produces:
  - `art/manifest.mjs`: `STYLE: string`, `BUDGETS: Record<'small'|'medium'|'large', { tris, px, kb }>`,
    `ASSETS: Asset[]` (empty for now). `Asset = { id, kind: 'player'|'enemy'|'boss'|'hull'|'base'|'gun',
    batch: 1..5, budget, glow: '#rrggbb', prompt?: string, base?: string, livery?: string, seed?: number,
    size?: number, stage?: 1..10, old?: string, turn?: 0|180 }`
  - `loadArtEnv({ home?, env?, readFile? }) → Record<string, string>`;
    `requireKeys(env, keys: string[]) → void`; `ART_ENV_FILE = '~/.config/sky-striker/assets.env'`
  - `validateManifest(assets, budgets) → string[]` (error lines, empty = valid);
    `selectAssets(assets, selector: string) → Asset[]`

- [ ] **Step 1: Branch and install**

Run: `git switch -c feat/reskin` then
`npm i -D @gltf-transform/core@^4.5 @gltf-transform/extensions@^4.5 @gltf-transform/functions@^4.5 meshoptimizer sharp`
Expected: `package.json` lists the five; `npm test` still 104/104.

- [ ] **Step 2: Write the failing tests**

`env.test.mjs`:
- `reads KEY=value lines and ignores comments and blanks`: fake `readFile` returning
  `"# x\nHY3D_API=https://a\n\nIMAGE_KEY=k=v\r\n"` → `{ HY3D_API: 'https://a', IMAGE_KEY: 'k=v' }`.
- `the environment overrides the file`: file `HY3D_KEY=a`, `env: { HY3D_KEY: 'b' }` → `HY3D_KEY === 'b'`.
- `a missing file is not an error`: `readFile` throws ENOENT → `{}`.
- `requireKeys names the missing keys and the file`: `requireKeys({ HY3D_API: 'x' }, ['HY3D_API', 'HY3D_KEY'])`
  throws with message matching `/HY3D_KEY/` and `/~\/\.config\/sky-striker\/assets\.env/` and not `/HY3D_API,/`.

`manifest.test.mjs` (with a valid two-row fixture: design `enemy-basic-s1` with `prompt`, repaint
`enemy-basic-s2` with `base: 'enemy-basic-s1'`, `livery`):
- `accepts a valid manifest` → `[]`; and `validateManifest(ASSETS, BUDGETS)` from `art/manifest.mjs` → `[]`.
- one test per rule, each asserting an error line that contains the asset id: duplicate id; id not matching
  `/^[a-z0-9-]+$/`; unknown kind; unknown budget; both `prompt` and `base`; neither; `base` that does not
  exist; `base` of another kind; `base` that is itself a repaint; repaint without `livery`; `glow` not
  `#rrggbb`; `glow` `#808080` (HSV saturation < 0.4) and `#202a30` (value < 0.5); `batch` 6; `stage` 11;
  `turn` 90.
- `selectAssets`: `'3'` → rows with `batch: 3`; `'a,b'` → those two in that order; `'nope'` throws `/nope/`.

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run scripts/art`
Expected: FAIL, modules not found.

- [ ] **Step 4: Implement**

- `art/manifest.mjs` `BUDGETS = { small: { tris: 2000, px: 256, kb: 80 }, medium: { tris: 4000, px: 512, kb: 160 }, large: { tris: 8000, px: 512, kb: 220 } }`
  and `STYLE` exactly:
  `Semi-realistic 3D render in the style of Sky Force Reloaded: painted PBR metal with crisp panel lines. Bold, readable shapes; no thin antennas, hanging missiles or pilots. Front three-quarter view from about 45 degrees above, the whole craft centered in the frame with margin. Plain flat #808080 background, soft even light.`
- `art/.gitignore`: `.cache/`.
- `loadArtEnv`: parse `^\w+=` lines, split at the first `=`, strip `\r`; then override with `env` for any key
  present in it.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run scripts/art` → PASS. `npm test` → all green.

- [ ] **Step 6: Commit** `package.json package-lock.json vitest.config.ts art/ scripts/art/`

---

### Task 2: HTTP clients and batch runner

**Files:**
- Create: `scripts/art/clients.mjs`, `scripts/art/batch.mjs`
- Test: `scripts/art/clients.test.mjs`, `scripts/art/batch.test.mjs`

**Interfaces:**
- Produces:
  - `createImageClient({ api, key, model, fetch }) → { generate(prompt) → Promise<Buffer>, edit(png: Buffer, prompt) → Promise<Buffer> }`
  - `createHy3dClient({ api, key, fetch, sleep, now, pollMs = 5000, capMs = 1_800_000 }) → { generate(png: Buffer, seed: number) → Promise<Buffer> }`
  - `runBatch(items: {id}[], worker: (item) => Promise<void>, { concurrency }) → Promise<{ ok: string[], failed: { id, error: string }[] }>`
  - `withRetry(fn: (seed: number) => Promise<T>, seed: number) → Promise<T>`

- [ ] **Step 1: Write the failing tests** (fake `fetch` records calls and answers from a script; fake
  `sleep` advances a fake `now`)

Image client:
- `generate posts the model, prompt, 1024x1024, n 1 and decodes b64_json`: body JSON equals
  `{ model: 'm', prompt: 'p', size: '1024x1024', n: 1 }`, header `Authorization: Bearer k`, URL ends
  `/v1/images/generations`; result bytes equal the decoded base64.
- `downloads data[0].url when there is no b64_json` (Review Focus 1).
- `edit sends multipart model, prompt, size and image` to `/v1/images/edits`.
- `a non-2xx answer throws with the status and the start of the body`: 500 `"boom"` → `/500.*boom/`.

Hunyuan3D client:
- `sends the image as base64 with the seed, polls every 5 s and downloads with the Bearer header`:
  `/send` → `{ uid: 'u1' }`; statuses `running`, `running`, `completed` with `result_url`; asserts the
  sleeps were `[5000, 5000, 5000]`, the download carried `Authorization: Bearer k`, no URL contains
  `/generate` or `base64=true`.
- `keeps polling through a transient HTTP error` (Review Focus 2): statuses `503`, `completed` → resolves.
- `status error throws its message`: `{ status: 'error', message: 'bad mesh' }` → `/bad mesh/`.
- `gives up after 30 minutes`: always `running` → rejects `/u1.*30 min/`; `now` advanced ≥ 1 800 000.

Batch:
- `never runs more than concurrency workers at once`: 5 items, workers resolve on demand, max in-flight = 2.
- `one failure does not stop the batch`: item `b` throws `'x'` → `{ ok: ['a','c'], failed: [{ id: 'b', error: 'x' }] }`.
- `withRetry tries seed then seed+1, once`: fails on 42, succeeds on 43 → seeds `[42, 43]`; failing twice
  rejects with the second error and calls exactly twice.

- [ ] **Step 2: Run them to verify they fail** — `npx vitest run scripts/art` → FAIL, not found.
- [ ] **Step 3: Implement** the four exports (no retries beyond `withRetry`; `ok` keeps input order).
- [ ] **Step 4: Run the tests** → PASS.
- [ ] **Step 5: Commit**

---

### Task 3: Steps `concept`, `approve`, `model` and the CLI

**Files:**
- Create: `scripts/art/paths.mjs`, `scripts/art/steps.mjs`, `scripts/art/cli.mjs`
- Test: `scripts/art/steps.test.mjs`

**Interfaces:**
- Consumes: Task 1 (`ASSETS`, `STYLE`, `selectAssets`, `loadArtEnv`, `requireKeys`), Task 2 (clients,
  `runBatch`, `withRetry`).
- Produces:
  - `artPaths(root = process.cwd()) → { draft(id, k): string, concept(id), raw(id), out(id), review(batch), preview(batch) }`:
    `art/.cache/drafts/<id>/<k>.png`, `art/concepts/<id>.webp`, `art/.cache/raw/<id>.glb`,
    `public/models/ai/<id>.glb`, `art/.cache/review/batch-<n>.html`, `art/.cache/preview/batch-<n>.png`
  - `conceptPrompt(asset) → string`
  - `planConcept(assets, exists: (path) => boolean, force) → { todo: Asset[], blocked: { id, reason }[] }`
  - `planModel(assets, exists, force) → { todo: Asset[], blocked: { id, reason }[] }`
  - `reviewPage(batch: number, rows: { asset, drafts: string[] }[]) → string`
  - CLI: `npm run art -- concept <sel> [--n N] [--force]`, `approve <id> <k>`, `model <sel> [--force]`,
    `build <sel>`, `preview <sel>`; exit code 1 when anything failed or was blocked.

- [ ] **Step 1: Write the failing tests**
- `conceptPrompt for a design`: `{ prompt: 'A heavy gunship.', glow: '#ff3b2f' }` →
  `` `A heavy gunship.\n\n${STYLE} Glow color #ff3b2f only on lights and exhausts.` ``
- `conceptPrompt for a repaint`: `{ base: 'x', livery: 'desert sand with rust panels', glow: '#ff7a2a' }` →
  `Repaint this exact aircraft. Keep its shape, angle, framing and the plain #808080 background. New livery: desert sand with rust panels. Glow color #ff7a2a only on lights and exhausts.`
- `planConcept skips approved assets unless forced`, `blocks a repaint whose base is not approved` (reason
  `base enemy-basic-s1 not approved`), `a repaint with an approved base is todo`.
- `planModel`: unapproved → blocked `not approved`; approved with raw GLB → skipped; with `force` → todo.
- `reviewPage lists every id, its prompt and an <img> per draft`.

- [ ] **Step 2: Run them to verify they fail** → FAIL.
- [ ] **Step 3: Implement**
  - `concept`: drafts per asset = `--n`, else 3 for a design and 1 for a repaint; a design calls
    `generate(conceptPrompt)`, a repaint calls `edit(png of the base concept, conceptPrompt)`; writes drafts
    then the review page and prints its path.
  - `approve <id> <k>`: sharp draft → resize 512 → webp quality 90 → `concept(id)`.
  - `model`: `runBatch(todo, …, { concurrency: 2 })`, each `withRetry((s) => hy3d.generate(png512, s), asset.seed ?? 42)`
    → `raw(id)`. The input PNG is the concept webp decoded by sharp.
  - Keys: `requireKeys` for `IMAGE_API, IMAGE_KEY, IMAGE_MODEL` (concept) and `HY3D_API, HY3D_KEY` (model).
  - Summary line `ok N, failed M, blocked K` then each failure `id: error`.
- [ ] **Step 4: Run the tests** → PASS.
- [ ] **Step 5: Smoke run without keys** — `npm run art -- model 1` with no `assets.env` (set `HOME` to an
  empty temp dir) → prints the `requireKeys` message, exit code 1.
- [ ] **Step 6: Commit**

---

### Task 4: Step `build` and GLB checks

**Files:**
- Create: `scripts/art/build.mjs`, `scripts/art/checks.mjs`, `scripts/art/fixture.mjs` (test helper)
- Test: `scripts/art/build.test.mjs`

**Interfaces:**
- Consumes: Task 1 `BUDGETS`, Task 3 `artPaths`.
- Produces:
  - `realMime(bytes: Uint8Array) → 'image/jpeg' | 'image/png' | 'image/webp' | null`
  - `extractEmissive(rgba: Uint8Array, glow: string) → { rgba: Uint8Array, lit: number }`
  - `buildAsset(rawPath, outPath, asset, budget) → Promise<{ tris: number, bytes: number }>`
  - `checkGlb(path, asset, budget) → Promise<string[]>` (problems; empty = good)
  - `fixtureGlb({ tris = 10_000, normals = false, mimeLie = true, stripe = '#3fd4ff' }) → Promise<Uint8Array>`
    (a UV sphere with a 64×64 JPEG base color carrying one stripe of `stripe`)

- [ ] **Step 1: Write the failing tests**
- `realMime`: JPEG `ff d8 ff`, PNG `89 50 4e 47`, WebP `RIFF????WEBP`, else `null`.
- `extractEmissive` with glow `#3fd4ff`: pixel `(63,212,255)` lit and copied; `(128,128,128)` black;
  `(20,60,80)` black (value < 0.75); `(255,140,0)` black (hue far); `lit` counts lit pixels; alpha 255.
- `buildAsset turns a raw Hunyuan-like GLB into a game asset`: fixture (10k tris, no normals, JPEG labeled
  PNG) with asset `{ id: 't', kind: 'enemy', glow: '#3fd4ff' }` and `BUDGETS.small` → `checkGlb` returns `[]`,
  `tris ≤ 2000`, `bytes ≤ 80 * 1024`.
- `turn: 180 rotates the model about Y`: the max-Z vertex of the input ends at min Z.
- `checkGlb reports each problem`: a fixture written without normals, with PNG textures and no meshopt →
  problems matching `/normal/`, `/webp/`, `/meshopt/`; a 10k-tri file against `small` → `/2000/`; asset with
  `glow: '#ff3b2f'` on the cyan fixture → `/glow/`.

- [ ] **Step 2: Run them to verify they fail** → FAIL.
- [ ] **Step 3: Implement**
  - `extractEmissive`: HSV per pixel; lit when V ≥ 0.75, S ≥ 0.45 and hue distance to `glow` ≤ 20°.
  - `buildAsset` order: set each texture's mimeType from `realMime` → `weld()` → `simplify({ simplifier: MeshoptSimplifier, ratio: min(1, budget.tris / tris), error: 0.01 })`,
    and once more with `error: 0.05` if still over → creased normals: per primitive, copy to a
    `THREE.BufferGeometry`, `toCreasedNormals(geom, 35° in radians)` (three/examples/jsm/utils/BufferGeometryUtils),
    write POSITION/NORMAL/TEXCOORD_0 back, then `weld()` → `turn` → emissive: decode base color (sharp
    raw RGBA), `extractEmissive`; when `lit > 0` attach it as `emissiveTexture`, `emissiveFactor [1,1,1]` →
    `textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [px, px] })` → `reorder` + `meshopt`
    (`EXT_meshopt_compression`) → write.
  - `checkGlb`: NORMAL on every primitive; every texture `image/webp`; `EXT_meshopt_compression` used;
    tris ≤ budget; bytes ≤ `kb × 1024`; kinds player|enemy|boss lie flat (Y extent < X and < Z extents);
    when `glow` is set, an emissive texture whose lit pixels' mean hue is within 25° of `glow`.
  - CLI `build`: for each selected asset with a raw GLB, `buildAsset` then `checkGlb`; a problem fails the asset.
- [ ] **Step 4: Run the tests** → PASS.
- [ ] **Step 5: Spike regression** — `npm run art -- build` cannot run on the spike file without a manifest
  row, so run `node -e` on `.superpowers/spike/reskin/hawk-a.glb` via `buildAsset` with `BUDGETS.medium` and
  glow `#3fd4ff` → `checkGlb` `[]`, size ≈ 130–160 KB.
- [ ] **Step 6: Commit**

---

### Task 5: Awaitable model cache

**Files:**
- Create: `src/game/assets/modelCache.ts`
- Modify: `src/game/models.ts` (add `aiModel`, `isAiModel`), `src/components/game/Model.tsx`
- Test: `src/game/assets/modelCache.test.ts`

**Interfaces:**
- Produces:
  - `aiModel(id: string) → string` = `/models/ai/${id}.glb`; `isAiModel(path: string) → boolean`
  - `createModelCache<T>(load: (path) => Promise<T>, dispose: (value: T) => void) → ModelCache<T>` (type
    `ModelCache<T>` exported) with `get(path) → Promise<T>` (same promise per path), `peek(path) → T | undefined`, `release(path)`,
    `keepOnly(keep: Iterable<string>, releasable: (path) => boolean) → string[]` (released paths)
  - `models: ModelCache<THREE.Group>` (GLTFLoader + `MeshoptDecoder` from
    `three/examples/jsm/libs/meshopt_decoder.module.js`; dispose frees geometries, materials and textures)
  - `useModelScene(path) → THREE.Group` (React 19 `use(models.get(path))`)

- [ ] **Step 1: Write the failing tests** (fake `load` / `dispose`)
- `loads a path once`: two `get('a')` → one `load` call, same promise.
- `a failed load is forgotten so the next get retries` (Review Focus 4): first load rejects, `get` rejects;
  second `get` calls `load` again and resolves.
- `keepOnly releases only releasable paths that are not kept, and disposes them` (Review Focus 5): loaded
  `/models/ai/a.glb`, `/models/ai/b.glb`, `/models/kenney-space/x.glb`; `keepOnly(['/models/ai/a.glb'], isAiModel)`
  → returns `['/models/ai/b.glb']`, `dispose` called once, `peek` of the Kenney path still defined.
- `release of a path still loading drops it without disposing`.

- [ ] **Step 2: Run them to verify they fail** → FAIL.
- [ ] **Step 3: Implement** the cache, then in `Model.tsx`: `GlbModel` and `useModelDims` use
  `useModelScene` instead of `useGLTF`; the bottom line becomes
  `Object.values(MODEL_PATHS).forEach((p) => void models.get(p))`; `ShipModel` renders its current body
  inside its own `<Suspense fallback={null}>` (so a late model hides only itself).
- [ ] **Step 4: Run the tests** → PASS; `npx tsc --noEmit` clean; `npm run dev`, play stage 1 for a minute:
  models, hangar and hit flashes look as before, no console errors.
- [ ] **Step 5: Commit**

---

### Task 6: Load per stage

**Files:**
- Create: `src/game/stageModels.ts`, `src/game/assets/stageLoader.ts`
- Modify: `src/components/ui/StageBriefing.tsx`, `src/components/game/GameScene.tsx`,
  `src/components/ui/CoopLobby.tsx`
- Test: `src/game/stageModels.test.ts`, `src/game/assets/stageLoader.test.ts`

**Interfaces:**
- Consumes: Task 5 `models`, `isAiModel`.
- Produces:
  - `stageModels(stageId: number, planeIds: string[]) → string[]` (unique, no `undefined`): the 4 skins'
    `model`, the stage `ground.hullModel` / `gunModel` / `baseModel` / `turretGunModel` when set (Task 8 fields), the boss
    `model` or its `vehicle` parts, each plane's `model`.
  - `createStageLoader(cache: Pick<ModelCache<unknown>, 'get'>) → { request(paths), status(): 'loading'|'ready'|'error', retry(), subscribe(fn) → () => void }`;
    `stageLoader` instance; `useStageModels(paths) → { status, retry }` (useSyncExternalStore).

- [ ] **Step 1: Write the failing tests**
- `stageModels(1, ['hawk'])` contains `getStage(1).skins.basic.model`, `…fast`, `…heavy`, `…shooter`,
  `BOSSES[getStage(1).boss].model`, `getPlane('hawk').model`, and has no duplicates and no `undefined`.
- `stageModels(2, ['hawk', 'hawk'])` (crawler boss, a vehicle) has no `undefined` and lists hawk once.
- loader: `request(A)` → `loading` then `ready`; `request(A)` again does not reload; `request(B)` after ready
  goes back to `loading` and loads B's new path (Review Focus 3); a rejecting load → `error`; `retry()` calls
  `get` again and reaches `ready`.

- [ ] **Step 2: Run them to verify they fail** → FAIL.
- [ ] **Step 3: Implement and wire**
  - `StageBriefing`: `useStageModels(stageModels(stageId, [plane.id]))`; both start buttons disabled unless
    `ready`; while loading the START label reads `LOADING…`; on `error` a line `Could not load the aircraft`
    and a `RETRY` button calling `retry`.
  - `GameScene`: effect on `[stageId, coop, planes]`: keep = `stageModels(stageId, planes)` plus, in co-op,
    `stageModels(stageId + 1, planes)` when `stageId < TOTAL_STAGES`; `models.keepOnly(keep, isAiModel)`;
    in co-op `void models.get(p).catch(() => {})` for the next stage's paths. `planes` = our plane plus the
    wingmates' planes as `Teammates.tsx` reads them.
  - In DEV, expose the renderer: `window.__renderer = gl` (next to the existing `__store`).
  - `CoopLobby`: while in a room, prefetch `stageModels(1, [own plane, …roster planes])` the same way.
- [ ] **Step 4: Run the tests** → PASS; `npx tsc --noEmit` clean; dev: the briefing shows START at once
  (Kenney models are cached), stage 1 plays; `?coop=loopback` reaches stage 2.
- [ ] **Step 5: Commit**

---

### Task 7: Hit flash with emissive maps, hangar silhouette

**Files:**
- Create: `src/components/game/materialLook.ts`
- Modify: `src/components/game/Enemies.tsx:189-211`, `src/components/game/Boss.tsx:254-258`,
  `src/components/game/Model.tsx` (`silhouette` prop on `GlbModel` and `ShipModel`),
  `src/components/game/HangarPreview.tsx:53-61`
- Test: `src/components/game/materialLook.test.ts`

**Interfaces:**
- Produces: `type Look = { emissive: THREE.Color; intensity: number; map: THREE.Texture | null }`;
  `captureLooks(mats: THREE.MeshStandardMaterial[]) → Look[]`;
  `applyFlash(mats, looks: Look[], on: boolean, intensity: number) → void`;
  `applySilhouette(mat: THREE.MeshStandardMaterial, color: string) → void`;
  `GlbModel` / `ShipModel` prop `silhouette?: string`.

- [ ] **Step 1: Write the failing tests** (plain three materials in node)
- `flash on removes the emissive map and lights the whole material`: material with `emissiveMap = tex`,
  emissive `#112233`, intensity 1 → `applyFlash(…, true, 1.6)` → `emissiveMap === null`, emissive `#ffffff`,
  intensity 1.6.
- `flash off puts back the same map, color and intensity` (same `tex` object).
- `works on a material without a map`.
- `silhouette drops both maps and paints one dark color`: `map` and `emissiveMap` null, color `#2a3140`,
  emissive `#000000`.

- [ ] **Step 2: Run them to verify they fail** → FAIL.
- [ ] **Step 3: Implement**; Enemies keeps intensity 1.6 and Boss 1.2; set `needsUpdate = true` only when a
  map is added or removed. `GlbModel` with `silhouette` clones materials (like `palette`) and calls
  `applySilhouette`. `HangarPreview` main model: `silhouette={owned ? undefined : '#2a3140'}` and
  `palette={plane.palette}` (the escort models stay as they are).
- [ ] **Step 4: Run the tests** → PASS; dev: hit flash on enemies and a boss, a locked plane in the hangar
  still dark.
- [ ] **Step 5: Commit**

---

### Task 8: Nozzles and two-piece ground vehicles

**Files:**
- Create: `src/game/flames.ts`
- Modify: `src/components/game/Model.tsx` (`ShipModel` uses `flamePositions`, prop `nozzles`),
  `src/game/roster.ts` (`AirSkin.nozzles?`, `GroundSkin.hullModel?/gunModel?/baseModel?/turretGunModel?/gunY?`),
  `src/game/planes.ts` (`PlaneDef.nozzles?`), `src/game/bosses.ts` (`BossDef.nozzles?`),
  callers passing `nozzles` (Player, Teammates, HangarPreview, Enemies, Boss),
  `src/components/game/Vehicles.tsx`
- Test: `src/game/flames.test.ts`

**Interfaces:**
- Produces: `type Nozzle = [x: number, y: number, z: number]` (fractions of the model's half-extents,
  nose +Z frame); `flamePositions(dims: { x, y, z }, size: number, flames: 0 | 1 | 2, nozzles?: Nozzle[]) → [number, number, number][]`;
  `vehicleParts(skin: GroundSkin, turret: boolean) → { body: string; gun: string; gunY: number } | null`
  (exported from `Vehicles.tsx`); constants `HULL_SIZE = 1.3`, `GUN_SIZE = 0.8` (tuned in Task 10).

- [ ] **Step 1: Write the failing tests**
- `default rule matches today's`: dims `{ x: 1, y: 0.2, z: 0.9 }`, size 2: flames 2 →
  `[[-0.32, 0.02, -0.846], [0.32, 0.02, -0.846]]`; flames 1 → `[[0, 0.02, -0.846]]`; flames 0 → `[]`
  (toBeCloseTo).
- `nozzles override the rule and the count`: `[[0.5, 0, -1]]` → `[[0.5, 0, -0.9]]`.
- `vehicleParts`: tank skin with `hullModel` + `gunModel` → `{ body: hull, gun, gunY: 0.35 }`; `turret` with
  `baseModel` + `turretGunModel` → `{ body: base, gun: turretGun, gunY: 0.45 }`; explicit `gunY: 0.5` wins for
  the vehicle; a missing gun or body → `null` (so a stage can have AI tanks and box turrets).

- [ ] **Step 2: Run them to verify they fail** → FAIL.
- [ ] **Step 3: Implement**; `Vehicle`: when `vehicleParts` is not null, inside the same heading-rotated
  group as today's body draw `<GlbModel path={body} size={HULL_SIZE} grounded />` and, at
  `[0, gunY, 0]` rotated `[0, aimLocal, 0]`, `<GlbModel path={gun} size={GUN_SIZE} grounded />`, wrapped in
  `<Suspense fallback={null}>`; the boat wake is drawn in both paths; otherwise today's boxes. Boss
  `vehicle` skins go through the same `Vehicle`.
- [ ] **Step 4: Run the tests** → PASS; `npx tsc --noEmit`; dev: engine flames and vehicles unchanged.
- [ ] **Step 5: Commit**

---

### Task 9: Preview page, memory check, asset tests

**Files:**
- Create: `art-preview.html`, `src/artPreview.tsx`, `scripts/art/preview.mjs`, `scripts/art/memory-check.mjs`,
  `src/game/aiAssets.test.ts`
- Modify: `scripts/art/cli.mjs` (`preview`), `package.json` (script `"art:memory": "node scripts/art/memory-check.mjs"`)
- Test: `scripts/art/preview.test.mjs`, `src/game/aiAssets.test.ts`

**Interfaces:**
- Consumes: Task 1 manifest, Task 4 `checkGlb`, Task 5 `aiModel`/`isAiModel`, Task 6 `window.__renderer`.
- Produces: `previewUrl(base: string, assets: Asset[]) → string`
  (`${base}/art-preview.html?ids=<comma ids>`); the page sets `window.__previewReady = true` when every model
  has rendered.

- [ ] **Step 1: Write the failing tests**
- `previewUrl` encodes ids in manifest order.
- `aiAssets.test.ts`:
  - `every AI model the game uses is in the manifest and on disk`: collect every `isAiModel` path from
    `PLANES`, `STAGES` (skins and ground parts) and `BOSSES` (model and vehicle parts); each id is in `ASSETS`
    and `public/models/ai/<id>.glb` exists.
  - `every built GLB passes checkGlb`: for each file in `public/models/ai/`, its id is in `ASSETS` and
    `checkGlb(file, asset, BUDGETS[asset.budget])` → `[]`.
  - Prove the first test can fail: temporarily point `hawk` at `aiModel('nope')` → FAIL naming `nope`; revert.
- [ ] **Step 2: Run them to verify** — `previewUrl` FAIL (not found); `aiAssets` passes vacuously (no assets
  yet) except the temporary `nope` check, which must FAIL.
- [ ] **Step 3: Implement**
  - Preview page: one Canvas per id, the game camera (orthographic, position `[0, 50, 0]`, up `[0, 0, 1]`,
    zoom 28, ACES, exposure 1.15, same as `App.tsx`), the game `Environment` for the asset's `stage`
    (default 1); the `old` model at x −3 and the new one at x +3 at the asset's `size`, ground kinds grounded
    and air kinds at flight height; id label under each.
  - `preview` step: Playwright Chromium with the launch args of `scripts/playtest-bot.mjs`, viewport 540×960,
    open `previewUrl('http://localhost:5847', assets)`, wait for `__previewReady` (60 s), full-page screenshot
    to `artPaths().preview(batch)`; if the dev server does not answer, print `Start npm run dev first`, exit 1.
  - `memory-check`: open the dev game, for stage 1…4 call `__store.getState().startGame({ stageId })`, wait 5 s,
    read `__renderer.info.memory.textures`; pass when stage 4's count ≤ max(stage 1, stage 2) + 8, else print
    the four counts and exit 1.
- [ ] **Step 4: Run** — `npx vitest run` → PASS; with `npm run dev` up, `npm run art:memory` → pass.
- [ ] **Step 5: Commit**

---

### Tasks 10–14: Production batches

Every batch runs the same procedure. **Steps marked STOP wait for the user**: show the file, wait for their
picks, do not guess.

1. Add the batch's rows to `ASSETS` (below). `npx vitest run scripts/art` → PASS (manifest valid).
2. `npm run art -- concept <batch>` → summary without failures; send the user the review page path. **STOP.**
3. For each pick `npm run art -- approve <id> <k>`; for each "redo", edit that row's `prompt`/`livery` and
   rerun `concept <id> --force`; repeat 2–3 until every row is approved.
4. `npm run art -- model <batch>` then `npm run art -- build <batch>` → `ok` = all rows, no failures
   (≈ 1.1 GPU-min per model).
5. `npm run art -- preview <batch>` → send the screenshot. **STOP.** Fixes: `turn: 180`, `nozzles` on the
   definition, or back to step 3 for a new concept.
6. Switch the batch's definitions to `aiModel(id)` (fields below); `npm test` and `npx tsc --noEmit` green
   (`aiAssets.test.ts` now covers the batch); play the affected stage(s) in dev for a minute.
7. Commit `art/manifest.mjs`, `art/concepts/`, `public/models/ai/`, the definitions.

Row fields every batch fills: `glow` from the definition it replaces (plane `flame`, skin `flame`, ground
`accent`, boss `flameColor`), `size` from that definition, `stage`, `old` = the replaced model path. Prompts
follow the spec's Section 2 direction for the group.

#### Task 10: Batch 1 — style
Rows (`batch: 1`): `hawk` (player, medium); `enemy-basic-s1`, `enemy-fast-s1`, `enemy-heavy-s1`,
`enemy-shooter-s1` (enemy, small, stage 1, designs in a neutral livery); `hull-s1` (hull, small, tank design,
stage 1); `gun-tank` (gun, small, dark steel).
Switch: `PLANES` hawk `model`; stage 1 `skins.*.model`; stage 1 `ground.hullModel = aiModel('hull-s1')`,
`gunModel = aiModel('gun-tank')`.
Extra: this batch settles the look. If the user rejects the style, change `STYLE` and redo batch 1 before
batch 2. Tune `HULL_SIZE`, `GUN_SIZE` and the default `gunY` from the preview so the tank matches today's
footprint; check the hawk under bloom in the real stage.

#### Task 11: Batch 2 — the other player planes
Rows (player, medium): `magnetar`, `aegis`, `viper`, `hornet`, `titan`, `spectre`, `seraph`, `nova`. Prompts
follow each plane's `tagline` / `skillName` character.
Switch: each `PLANES` entry's `model`. Check the hangar (owned and locked) and the Seraph escorts.

#### Task 12: Batch 3 — enemy repaints
Rows (enemy, small): `enemy-<role>-s<N>` for role in basic, fast, heavy, shooter and N = 2…10, each
`base: 'enemy-<role>-s1'`, `livery` written from that stage's palette (`kl`/`ql` hull, panel, dark, glow
colors) and biome. The concept step does them as edits of the approved s1 image.
Switch: `skins.*.model` of stages 2–10.

#### Task 13: Batch 4 — vehicles, bases, guns
Rows (small): `hull-s3` (boat design), `hull-s7` (hover design); `hull-s2`, `-s4`, `-s5`, `-s6`, `-s8`, `-s9`,
`-s10` (repaints of `hull-s1`); `base-s1` (fixed-turret base design) and `base-s2…s10` (its repaints);
`gun-boat`, `gun-hover`, `gun-turret` (guns, dark steel).
Switch: each stage's `ground.hullModel`, `baseModel = aiModel('base-s<N>')`, `gunModel` (`gun-tank` for tank
stages, `gun-boat` stage 3, `gun-hover` stage 7), `turretGunModel = aiModel('gun-turret')`.

#### Task 14: Batch 5 — bosses
Rows (boss, large): `boss-vulture`, `boss-crawler`, `boss-galleon`, `boss-hornet`, `boss-warden`,
`boss-breaker`, `boss-wraith`, `boss-hive`, `boss-leviathan`, `boss-citadel`, and `boss-crawler-gun`
(kind gun, budget large). Dread Galleon is a battleship; Sand Crawler a giant tank (hull + gun).
Switch: each `BOSSES` entry's `model`; `crawler.vehicle.hullModel = aiModel('boss-crawler')`,
`gunModel = aiModel('boss-crawler-gun')`. Kinds `hull`/`gun` skip the flat check, so `boss-crawler` is kind
`hull` with budget large.

---

### Task 15: Clean-up and phone check

**Files:**
- Modify: `src/game/models.ts`, `src/game/planes.ts`, `src/game/stages.ts`, `src/game/bosses.ts`
- Delete: files under `public/models/kenney-space/` and `public/models/quaternius/` that nothing references

- [ ] **Step 1: Find unused models** — for each `MODEL_PATHS` key under `kenney-space`/`quaternius`, grep
  `src/` for `M.<key>` / `MODEL_PATHS.<key>`; keys used only in `models.ts` are unused (`turret`,
  `turretSingle` and the cargo craft in `terrain/props.ts` stay for sub-project 3).
- [ ] **Step 2: Remove** those keys and files, `palette` values on definitions whose model is now AI, and
  `kenneyLivery`/`quatLivery` if nothing uses them any more.
- [ ] **Step 3: Verify** — `npm test`, `npx tsc --noEmit`, `npm run build` green; dev: all 10 stages start
  from the briefing; `npm run art:memory` passes.
- [ ] **Step 4: Phone check (by hand, with the user)** — on a real mid-range phone, against a build of
  `afcc3d7` as the baseline: stage 1 and one co-op run; FPS no lower, the briefing loads within a few seconds,
  no model appears late during play. **STOP** for the user's verdict.
- [ ] **Step 5: Commit**, then superpowers:finishing-a-development-branch.
