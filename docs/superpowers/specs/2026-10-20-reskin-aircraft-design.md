# Reskin, part 1: AI art pipeline + aircraft — design (DRAFT)

Status: **brainstorming in progress** (superpowers:brainstorming, architectural path), started 2026-10-19.
Approved so far: the decisions below and Section 1. Sections 2–4 are not presented yet.
This is not the final spec: do not write a plan or implement from it yet.

## How to resume (next session, any machine)
1. Create `~/.config/sky-striker/assets.env` (format in [Setup](#setup-on-another-machine)): copy it from the
   first machine or ask the user. Never commit it — this repo is public.
2. Continue the brainstorm at **Section 2**: present it in chat, get approval, then Section 3, then Section 4.
3. Rewrite this file as the final spec (drop the draft notes), self-review, ask the user to review it,
   then superpowers:writing-plans. Branch off `main` (e.g. `feat/reskin`) before implementing.
4. The user writes Vietnamese; answer in Vietnamese.

## Goal
User: reskin the whole game so it is more eye-catching and looks more realistic. Style: Sky Force Reloaded
(semi-realistic PBR). 3D models come from the internal Hunyuan3D image-to-3D service, input images from the
internal image model.

Assumptions told to the user and not corrected: gameplay, hitboxes and logic (single-player and co-op) stay
as they are, only the visuals change; the game must stay smooth on phones.

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

- **Image**, 1024², 18 s. Prompt: one aircraft, front three-quarter view from about 45° above, whole craft
  centered with margin, plain flat #808080 background, soft even light, livery from `planes.ts`, bold shapes,
  no thin antennas or hanging missiles.
- **Hunyuan3D**, 64 s (55 s on the GPU, empty queue). 6.06 MB GLB, 40,000 tris, one mesh, one PBR material:
  base color (JPEG, 2048²) + metallic-roughness (PNG, 2048²); attributes POSITION + TEXCOORD_0 only.
- **Orientation**: lies flat, Y up, nose +Z, centered, bbox ≈ 1.9 × 0.4 × 2.0. No rotation needed (nose +Z
  like the Quaternius models).
- **Optimized** with gltf-transform 4.5 `optimize --compress meshopt --texture-compress webp`:
  6k tris + 512 px = 130 KB; 2k tris + 256 px = 53 KB. At game size (plane size 2 on a 16.6-unit-wide field,
  about 12% of the screen width) 2k/256 looks the same as the raw model. Underside and rear (guessed by the
  model) are plausible.
- **Image edit** (`/v1/images/edits`) repainted the Hawk in desert camo in 19 s; shape, angle and framing
  stayed the same → per-stage liveries work.
- **Problems the pipeline must handle**
  1. The base color is JPEG bytes labeled `image/png`; gltf-transform resize then fails ("width 0").
     Set the mimeType from the magic bytes first.
  2. No normals, so three.js falls back to flat shading. Bake creased normals (35° looked right with three's
     `toCreasedNormals`).
  3. Lights (nozzles, accent strips) are only painted; there is no emissive.
  4. One textured material, so recoloring by material name (`palette` in planes.ts / stages.ts / bosses.ts,
     the dark locked silhouette in HangarPreview) no longer applies. The hit flash (materialsRef + emissive)
     still works.
- **Not verified yet**: style consistency across ~90 models, thin parts, the look under bloom and the real
  drei HDRI environments.

## Section 1 — Pipeline (approved 2026-10-19)

### Files
- `art/manifest.mjs`: every asset with `id`; `kind` (player | enemy | boss | hull | gun); the design prompt,
  or `base` + `livery` for a repaint of an approved base; `seed`; `glow` color; budget `small` (2k tris,
  256 px), `medium` (4k, 512) or `large` (8k, 512).
- `art/concepts/<id>.webp`: approved concept images at 512 px. Hunyuan shrinks its input to 512 anyway, so
  rebuilding from these loses nothing.
- `art/.gitignore` with `.cache/`: drafts and raw GLBs live in `art/.cache/`. A separate ignore file keeps the
  root `.gitignore` untouched.
- `scripts/art/*.mjs`: the steps, run as `npm run art -- <step> <batch|id>`.
- Keys come from `~/.config/sky-striker/assets.env` or the environment, never from the repo.

### Steps
1. `concept`: generate the image of a base design; a repaint edits the approved base image (so the base is
   approved first). Then build a review page for the batch: a grid with id and prompt.
2. Review in chat (e.g. "hawk #2; viper: thicker wings, redo"). `approve` copies the pick to `art/concepts/`
   and marks it in the manifest.
3. `model`: approved images → Hunyuan3D, at most 2 jobs in flight (2 GPUs), following the guide's rules
   (below). On a failed job, retry once with another seed. Assets that already have a raw GLB are skipped
   unless `--force`.
4. `build`: raw GLB → `public/models/ai/<id>.glb`: fix the texture mimeType; weld and simplify to the budget;
   bake creased normals; emissive from `glow`; WebP textures; meshopt. Prints tris and KB per asset; fails an
   asset that is over budget.
5. `preview`: screenshots of the batch from the game camera next to the old model, for the after-3D review.

### Errors
Every step only does what is missing, so running it again is safe. One failed asset does not stop the
batch; the batch ends with the list of failures.

## Draft notes for Sections 2–4 (not presented, not approved)
Planned sections: 2 art direction + asset list, 3 game integration, 4 testing.

### Facts from the code
- Player planes: 9 in `src/game/planes.ts` (hawk … nova): `model`, `size` 1.8–2.3, `palette`
  (kenneyLivery / quatLivery), `flame`, `flames`. Also drawn by `Teammates.tsx` (co-op) and `HangarPreview.tsx`
  (locked planes: every material `#2a3140`; a 0.9-size escort model).
- Enemy aircraft: `skins: Record<AirRole, AirSkin>` per stage in `src/game/stages.ts` (10 stages × 4 roles),
  built with `air(model, size, palette, flame, flames)`.
- Ground enemies: roles `tank` and `turret` (`src/game/roster.ts`). Each stage has
  `ground: { vehicle: 'tank' | 'boat' | 'hover', hull, turret, accent }`: tank in 8 stages, boat in stage 3,
  hover in stage 7. They are boxes and cylinders in `src/components/game/Vehicles.tsx`:
  `Vehicle({ skin, heading, aim, scale, turret })`; the gun turns by `aim - heading`.
- Bosses (`src/game/bosses.ts`), sizes 3.4–6: 8 use `ShipModel` (Kenney cargoB / miner, Quaternius ship1–6),
  Dread Galleon is the Kenney pirate ship, Sand Crawler is `Vehicle` tank at size 3.4.
- `Model.tsx` preloads every `MODEL_PATHS` entry on import. With ~90 AI models that is too much texture
  memory for phones, so load per stage instead.
- `ShipModel` places engine flames from the bounding box (tail at −z × 0.94, spread x × 0.16). Check this
  against the AI engines; it may need flame offsets per asset.
- Scenery props in `terrain/props.ts` (Kenney turrets, cargo craft, trees, buildings) belong to
  sub-project 3.

### Rough asset count
9 players (medium) + 40 enemy aircraft (small) + about 10 hulls, 10 turret bases and 10 guns (small/medium)
+ 9 bosses (large) ≈ 90 models, about 1.1 min of GPU time each, 2 GPUs.

### Ideas to present
- Emissive: in `build`, turn base-color pixels close to the asset's `glow` hue (and bright) into an emissive
  map; prompts keep the glow color for lights only. Untested; the fallback is engine flames + bloom.
- Texture memory: 256² for enemies, 512² for players and bosses; consider KTX2 later if memory is tight.
- Hangar locked look: drop the texture and tint dark instead of using `palette`.

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
