# Reskin, part 1: AI art pipeline + aircraft — design

Status: **approved by the user (2026-10-20).**
Next: superpowers:writing-plans (plan in docs/superpowers/plans/). Branch off `main` (e.g. `feat/reskin`)
before implementing.

## How to resume (next session, any machine)
1. Create `~/.config/sky-striker/assets.env` (format in [Setup](#setup-on-another-machine)): copy it from the
   first machine or ask the user. Never commit it — this repo is public.
2. If no plan exists yet in docs/superpowers/plans/, run superpowers:writing-plans for this spec;
   otherwise follow the plan.
3. The user writes Vietnamese; answer in Vietnamese.

## Goal
User: reskin the whole game so it is more eye-catching and looks more realistic. Style: Sky Force Reloaded
(semi-realistic PBR). 3D models come from the internal Hunyuan3D image-to-3D service, input images from the
internal image model.

This part builds the asset pipeline and replaces every aircraft, ground vehicle and boss.

Constraints:
- Gameplay, hitboxes and logic (single-player and co-op) stay as they are; only the visuals change.
- The game must stay smooth on phones: FPS no lower than today.
- The repo is public: no keys and no internal host names in commits.

## The whole reskin: five sub-projects
Each gets its own spec → plan → implementation, in this order (chosen by the user):
1. **Pipeline + aircraft** — this spec
2. Lighting, sky, post-processing
3. Ground and scenery of the 10 biomes (reuses the pipeline)
4. VFX: bullets, explosions, engine trails, stars, pickups
5. UI: HUD, menus, hangar

## Decisions (user)
| Question | Answer |
|---|---|
| Style | Sky Force Reloaded, semi-realistic PBR |
| Models | AI-generated with the internal Hunyuan3D |
| Input images | internal image model |
| First sub-project | pipeline + aircraft |
| Enemy aircraft | 4 base designs (one per role: basic, fast, heavy, shooter), each repainted per stage by image edit → 40 models. The silhouette tells the role, the colors follow the biome |
| Ground vehicles (tank, boat, hover, fixed turret, Sand Crawler boss) | AI in two pieces, hull + gun, put together at runtime so the gun still turns on its own |
| Review | 2D concept images reviewed in batches; only approved images go to 3D; each batch is then checked in the game view |
| Pipeline | A: in the repo, driven by a manifest (rejected: B throwaway scripts, C separate tool repo) |

## Spike results (2026-10-19)
Throwaway probe (scripts in `.superpowers/spike/reskin/`, not committed): Hawk concept image → Hunyuan3D →
optimize → view from the game camera, next to the current Kenney Hawk.

- **Image**, 1024², 18 s.
- **Hunyuan3D**, 64 s (55 s on the GPU, empty queue). 6.06 MB GLB, 40,000 tris, one mesh, one PBR material:
  base color (JPEG, 2048²) + metallic-roughness (PNG, 2048²); attributes POSITION + TEXCOORD_0 only.
- **Orientation**: lies flat, Y up, nose +Z, centered, bbox ≈ 1.9 × 0.4 × 2.0. No rotation needed.
- **Optimized** with gltf-transform 4.5 `optimize --compress meshopt --texture-compress webp`:
  6k tris + 512 px = 130 KB; 2k tris + 256 px = 53 KB. At game size (plane size 2 on a 16.6-unit-wide field,
  about 12% of the screen width) 2k/256 looks the same as the raw model. Underside and rear (guessed by the
  model) are plausible.
- **Image edit** (`/v1/images/edits`) repainted the Hawk in desert camo in 19 s; shape, angle and framing
  stayed the same → per-stage liveries work.
- **Problems the pipeline handles** (see Section 1, `build`)
  1. The base color is JPEG bytes labeled `image/png`; gltf-transform resize then fails ("width 0").
  2. No normals, so three.js falls back to flat shading. Creased normals at 35° look right.
  3. Lights (nozzles, accent strips) are only painted; there is no emissive.
  4. One textured material, so recoloring by material name no longer applies (see Section 3).
- **Not verified by the spike**: style consistency across ~84 models, thin parts, the look under bloom and the
  real drei HDRI environments. Batch 1 (Section 2) exists to settle these before mass production.

## Section 1 — Pipeline

### Files
- `art/manifest.mjs`: every asset with `id`; `kind` (player | enemy | boss | hull | base | gun); the design
  prompt, or `base` + `livery` for a repaint of an approved base; `seed`; `glow` color; budget `small`
  (2k tris, 256 px), `medium` (4k, 512) or `large` (8k, 512); approval state.
- `art/concepts/<id>.webp`: approved concept images at 512 px. Hunyuan shrinks its input to 512 anyway, so
  rebuilding from these loses nothing.
- `art/.gitignore` with `.cache/`: drafts and raw GLBs live in `art/.cache/`. A separate ignore file keeps the
  root `.gitignore` untouched.
- `scripts/art/*.mjs`: the steps, run as `npm run art -- <step> <batch|id>`.
- Keys come from `~/.config/sky-striker/assets.env` or the environment, never from the repo.
- Output: `public/models/ai/<id>.glb`, committed.

### Steps
1. `concept`: generate the image of a base design; a repaint edits the approved base image (so the base is
   approved first). Then build a review page for the batch: a grid with id and prompt.
2. Review in chat (e.g. "hawk #2; viper: thicker wings, redo"). `approve` copies the pick to `art/concepts/`
   and marks it in the manifest.
3. `model`: approved images → Hunyuan3D, at most 2 jobs in flight (2 GPUs), following the service rules in
   [Setup](#setup-on-another-machine). On a failed job, retry once with another seed. Assets that already
   have a raw GLB are skipped unless `--force`.
4. `build`: raw GLB → `public/models/ai/<id>.glb`:
   - set each texture's mimeType from its magic bytes;
   - weld and simplify to the budget;
   - bake creased normals (35°);
   - emissive map: base-color pixels that are bright and close to the asset's `glow` hue;
   - WebP textures at the budget size; meshopt.
   Prints tris and KB per asset; fails an asset that is over budget.
5. `preview`: screenshots of the batch from the game camera next to the old model, for the after-3D review
   (Playwright).

### Errors
Every step only does what is missing, so running it again is safe. One failed asset does not stop the
batch; the batch ends with the list of failures. A missing `assets.env` or key stops with a message that
says which file to create.

## Section 2 — Art direction and asset list

### Shared prompt
Every image uses the same style block:
- semi-realistic 3D render in the style of Sky Force Reloaded, painted PBR metal, crisp panel lines;
- bold, readable shapes; no thin antennas, hanging missiles or pilots;
- front three-quarter view from about 45° above, centered in the frame with margin;
- plain flat #808080 background, soft even light.

Each asset adds its own shape, livery and glow color. The glow color is used only for lights and exhausts,
so `build` can pull out the emissive map.

### Direction per group
- **Player planes**: one design each, matching its character (Titan a heavy "flying fortress", Viper slim and
  fast, …). Keep the colors of `planes.ts`. Bright and clean "hero" look.
- **Enemy aircraft**: 4 base designs, more angular and aggressive than the player planes. A base is approved
  in a neutral livery, then repainted for each stage starting from that stage's colors in `stages.ts`.
- **Ground vehicles**: one hull design each for tank, boat and hover, repainted per stage. One fixed-turret
  base design, repainted per stage. 4 guns in dark steel shared by all stages (small; repainting is not worth
  it).
- **Bosses**: 10 unique designs, no repaints. Names and colors follow `bosses.ts`. Dread Galleon is a
  battleship; Sand Crawler is a giant tank made of hull + gun.

### Count and budget
| Group | Designs | Models | Budget |
|---|---|---|---|
| Player planes | 9 | 9 | medium (4k, 512) |
| Enemy aircraft | 4 | 40 | small (2k, 256) |
| Hulls (tank, boat, hover) | 3 | 10 | small |
| Turret bases | 1 | 10 | small |
| Guns | 4 | 4 | small |
| Bosses (plus the Sand Crawler gun) | 11 | 11 | large (8k, 512) |
| **Total** | 32 | **84** | ~7 MB in all, ~1–2 MB loaded per stage |

About 1.5 h of GPU time in all.

### Batches
Each batch goes through 2D review → 3D → review in the game view.
1. **Style batch**: Hawk, the 4 enemy bases, 1 tank (hull + gun). Fixes the look before mass production.
2. The other 8 player planes.
3. The 36 enemy repaints.
4. The rest of the hulls, bases and guns.
5. Bosses.

## Section 3 — Game integration

### Pointing at the new models
In `planes.ts`, `stages.ts` and `bosses.ts`, `model` points at `/models/ai/<id>.glb`. Each batch changes only
its own lines, after its in-game review, so the game stays playable throughout and old and new models can
mix. Gameplay, hitboxes and the co-op data do not change (the co-op data sent to Nakama holds no models or
colors, so its data version is untouched).

### One textured material
- **Hit flash**: today it sets the emissive color to white. With an emissive map three.js multiplies that
  color by the map, so only the lights would flash. One shared flash helper (used by enemies and bosses)
  takes the emissive map off while flashing and puts back the map, color and intensity afterwards.
- **Locked planes in the hangar** are darkened by material name today, which no longer works. `GlbModel`
  gets a `silhouette` prop: drop the texture and paint the whole model one dark color.
- **Engine flames** keep today's bounding-box rule. An asset whose exhausts sit elsewhere gets an optional
  `nozzles` field in its definition (positions as fractions of the bounding box), tuned from the `preview`
  screenshots.
- `palette` stays for the old models; on an AI model the material-name lookup finds nothing and does nothing.

### Ground vehicles
`GroundSkin` gains optional `hullModel`, `baseModel`, `gunModel` and `gunY` (height of the gun pivot). With
them, `Vehicle` draws the GLB hull or base and mounts the GLB gun on top; the gun still turns by
`aim - heading`. The boat wake stays. Without them, `Vehicle` draws today's boxes. Sand Crawler uses the same
path.

### Loading per stage
AI models are not preloaded at startup like the old ones: all of them would take about 110 MB of GPU
memory, too much for phones.
- A pure function `stageModels(stage, planes)` lists a stage's models: the 4 enemy kinds, the vehicle set,
  the boss, our plane and the wingmate's plane.
- The stage briefing loads them before the stage can start, shows that it is loading, and offers a retry on
  a network error.
- Co-op plays the 10 stages back to back, so the next stage's models load during the current stage.
- Models of a finished stage are freed (`useGLTF.clear`): about 20 MB held at a time.
- Each model gets its own `Suspense`, so a model that still arrives late hides only itself, not the whole
  scene (today one `Suspense` covers the scene).

### Clean-up
The Kenney space and Quaternius kits are removed at the end of this sub-project, once nothing uses them.
Kenney nature, city and pirate stay for sub-project 3.

## Section 4 — Testing

### Automated, in `npm test` (vitest, no network)
- **Pipeline**: each step as pure functions tested on small fixtures.
  - mimeType fix: JPEG bytes labeled PNG → `image/jpeg`; a real PNG stays.
  - Emissive extraction: on a small synthetic image, bright pixels near `glow` go into the emissive map,
    gray ones do not.
  - Budget: an asset over its tris or KB budget fails, others pass.
  - Hunyuan3D client, with a fake `fetch` and a fake clock: polls every 5 s and gives up after 30 min; a
    failed job is retried exactly once with another seed; never more than 2 jobs in flight; one failed asset
    does not stop the batch, and the batch ends with the list of failures.
  - Safe re-runs: an asset with a raw GLB is skipped unless `--force`.
  - A missing `assets.env` or key gives a clear error that says where to create the file.
- **Manifest**: unique ids; a repaint points at a real base of the same `kind`; valid budget names; every
  `/models/ai/...` path in `planes.ts`, `stages.ts` and `bosses.ts` is in the manifest and exists on disk
  (a typo fails here instead of becoming a 404 on a phone).
- **Built and committed GLBs**: every file in `public/models/ai/` has normals, WebP textures and meshopt, is
  within its tris and KB budget, faces +Z, and glows where its `glow` says.
- **Game**:
  - `stageModels`: exactly the 4 enemy kinds, the vehicle set, the boss and our plane, plus the wingmate's
    plane in co-op; no duplicates.
  - Flash helper: on, the emissive map is off and the color white; off, the map, color and intensity are
    back as before.
  - `silhouette`: no texture, the whole model one dark color.
  - The existing sim and co-op tests (sim, coop, Lua, the shared server conformance suite) stay unchanged;
    green means the gameplay did not change.

### Playwright, a separate command (not in `npm test`)
- `art preview`: per-batch screenshots from the game camera, old and new side by side, for the user's review.
- Memory: play through several stages in debug mode and check that `renderer.info.memory.textures` does not
  keep growing from stage to stage, which shows that a finished stage's models are freed.

### By hand, at the end of the sub-project
Play stage 1 and one co-op run on a real mid-range phone: FPS no lower than today, the briefing loads within
a few seconds, and no model appears late during play.

## Setup on another machine
`~/.config/sky-striker/assets.env`, outside the repo (the repo's `.env` is loaded into the game server
container by docker-compose, and the repo is public):

```
HY3D_API=<Hunyuan3D base URL, from HUNYUAN3D_AGENT_GUIDE.md>
HY3D_KEY=<Hunyuan3D key, from the same guide>
IMAGE_API=<LLM gateway base URL, OpenAI-compatible; ask the user>
IMAGE_MODEL=openai/gpt-image-2.5-flare
IMAGE_KEY=<gateway key; ask the user>
```

- Hunyuan3D (from the guide): `POST /send {image: <base64>, seed}` → `uid`; `GET /status/{uid}` every 5 s
  until `completed` or `error`, give up after 30 min; download `result_url` with the Bearer header right away
  (results are deleted after 24 h). Never `/generate`, never `?base64=true`. Input: one object, centered with
  margin, square, plain medium-gray background, soft light. On a bad result fix the image rather than
  resubmitting it.
- Image model: `POST /v1/images/generations {model, prompt, size: '1024x1024', n: 1}` → `data[0].b64_json`.
  Edits: `POST /v1/images/edits`, multipart with `model`, `prompt`, `size`, `image`.
- On the Windows machine C: is nearly full: point TEMP, TMP and `npm_config_cache` at E: when running npm,
  npx or gltf-transform.
