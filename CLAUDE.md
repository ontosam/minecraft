# CLAUDE.md — project context & handoff

A gentle, third-person, Minecraft-style block world built for **Ezra, age 6**
(his dad is the collaborator; Ezra finds real Minecraft too hard to navigate).
The whole thing is a **zero-dependency static web app** (raw WebGL) that runs in
Safari/Chrome and installs to the iPad home screen as a PWA.

> New here? Read this file, skim `js/main.js`, then run it (see **Run it**).
> The dad is non-technical — explain choices simply and keep things forgiving
> and non-scary (always daytime, no death).

## Status (end of session 1)
Playable: third-person character with a follow-camera, walk/look, **tap to
build/dig where you touch**, ~30 block types via a categorized pop-up picker,
wandering animals you can pet, a **goals/progression** system with stars, and
**auto-save/resume**. All verified by headless tests; the dad has been playing
it on laptop + iPad and loves it.

## Deploy / hosting
- **GitHub Pages**, served from the **`main`** branch (root). Live at
  **https://ontosam.github.io/minecraft/**. `.nojekyll` makes Pages serve files
  as-is. Every push to `main` auto-redeploys (~1 min).
- Dev branch is **`claude/tender-mayer-550bb0`**; we push there AND mirror to
  `main` (`git push origin claude/tender-mayer-550bb0:main`). Keep both in sync.
- The Claude GitHub App token **cannot enable Pages** ("Resource not accessible
  by integration") — the repo owner enabled it once by hand. Don't re-add a
  Pages Actions workflow expecting it to self-enable.

## Run it (local dev)
No build step. Plain ES modules + procedural assets.
```
node scripts/serve.mjs            # static server on :8000 (correct MIME, no-store)
# syntax-check a module:
node --input-type=module --check - < js/main.js
# regenerate icons:
node scripts/make-icons.mjs
```
The dev sandbox has **allowlisted network egress** (no arbitrary CDNs/npm) — this
is *why* the engine is hand-written with no libraries. Don't add npm deps.

## Architecture (all files ~2k lines)
- `index.html` — app shell: `#game` canvas + `#ui` overlay (crosshair, topbar
  [🏠 home, ⭐ goals, current-block button], action buttons [Pet/Jump/Dig/Build],
  joystick visuals, block **picker** overlay, **goals** overlay, hearts layer,
  error overlay).
- `styles.css` — all UI; touch-friendly, no zoom/scroll, safe-area aware.
- `js/math.js` — `mat4` (perspective, lookAt, multiply, `model`=T·Ry·S,
  translate, rotateX, transformPoint), clamp.
- `js/gfx.js` — WebGL init; **world shader** (textured · per-vertex tint · baked
  light · fog · `uAlpha`); procedural **texture atlas** (8×8 of 16px tiles,
  `TILE`); `getUV`, `blockPreview` (UI swatches), `GLMesh`, `cubeMesh`,
  `frameMesh` (configurable wireframe). NOTE: `makeLineProgram` is currently
  unused (safe to delete).
- `js/world.js` — voxels (`SX=64,SY=32,SZ=64`), `B` ids, `BLOCKS` defs,
  `CATEGORIES`/`PALETTE`, terrain gen (gentle hills + pond + trees), **chunk
  mesher** (16×16 columns, face culling + baked ambient occlusion), `raycast`
  (DDA), save/load (base64 of the byte array). Chunk meshes use **Uint16**
  indices with a guard (`base+24 > 0xffff` breaks) so extreme builds can't
  overflow.
- `js/player.js` — third-person physics: **camera-relative** movement, character
  faces travel (but **backpedals** when moving toward the camera), gravity, AABB
  collision, auto-jump, walk-phase, `movingForward` flag (camera trails only
  when true).
- `js/character.js` — blocky kid (legs/arms/body/head, eyes+hair); walk-swing +
  **action chop + forward body-lean** when building/digging (`act` param).
- `js/animals.js` — pig/sheep/cow/chick/cat; wander AI; `petNearest` → follower.
- `js/input.js` — unified pointer+keyboard. Touch: left half = floating
  joystick, right half = drag-look. Mouse: drag-look + hover; WASD/arrows + Space.
  **Tap detection**: quick tap (no drag, <300ms) sets `tapPending` + `tapX/tapY`;
  `aim{active,x,y}` tracks the finger/cursor for the live indicator.
- `js/audio.js` — tiny WebAudio synth (place/dig/jump/pet/deny). No audio files.
- `js/goals.js` — `GOAL_DEFS` + `Goals` (counters, stars, localStorage). Saves on
  every completion; throttled otherwise.
- `js/main.js` — the glue: GL/program/atlas setup; **camera** (`camYaw/camPitch`,
  `CAM_DIST=7`, `cameraFollow`, collision pull-in, `screenRay`/`rayHitAt`);
  render loop; build/dig (`doBuild/doDig(hit)`, `doAction`, `lastTool`,
  tap→`rayHitAt(tapX,tapY)`); indicators (`buildFrame` cyan outline / `glowCube`
  additive glow); UI wiring (picker, goals, buttons); hearts; autosave; SW reg.
- `scripts/serve.mjs`, `scripts/make-icons.mjs`, `sw.js` (offline, network-first,
  https only), `manifest.webmanifest`, `icons/`.

## Controls (current)
- **iPad:** drag **left** = walk, drag **right** = look (camera auto-trails when
  moving forward; backing up is a backpedal). **Press a spot** → light outline
  preview → **lift to place** (build) / glow → lift to dig. **Drag = move/look**,
  **tap = act**. Buttons: Build/Dig (also act in front + pick the tool, gold
  ring = active), Jump, Pet; 🏠 home, ⭐ goals, block-picker button.
- **Laptop:** **WASD/arrows** move, **drag mouse** to look, **hover** previews,
  **click** builds/digs there.

## Debug & testing (no browser-in-the-loop otherwise)
- `window.__ezra = { world, player, animals, cam(), target(), rayHit(x,y),
  sel(), goals }` — exposed for support/automated demos.
- **Headless verification** (how every change this session was checked): drive
  the bundled Chromium via the **DevTools Protocol** over a WebSocket (Node 22
  has global `WebSocket`/`fetch`), dispatch real input, read `__ezra`, and
  `Page.captureScreenshot`. Browser binary:
  `/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`
  with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`.
  Example test scripts lived in `/tmp/*.mjs` (not committed).
- **Video:** record the canvas with in-page `MediaRecorder` (canvas-only, no
  UI). The bundled ffmpeg (`/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux`) is
  minimal: **VP8/WebM only**, no JPEG decode, no `pipe:` protocol.
- Pure-logic Node smoke tests work too (math/world/mesher/raycast/save/physics)
  by importing modules with `file://` URLs (gfx/world don't touch DOM at import).

## Conventions & guardrails
- No build step, no dependencies, ES modules only. Procedural textures stay
  **16px** (authentic Minecraft look — do not "HD" them).
- Keep it **non-scary and forgiving**: always daytime, no death, no fall damage,
  can't leave the world, no accidental world-wipe button.
- Save keys: `ezrablocks.save.v2` (world+player+selected block),
  `ezrablocks.goals.v1`. iOS clears localStorage for non-home-screen sites — tell
  users to **Add to Home Screen** for durable progress.

## Roadmap / backlog (priority order)
1. **Friendly creepers (greenlit, do next).** Spec agreed with the dad:
   blocky creepers wander toward the player's builds and **slowly nibble a block
   now and then**; they **never touch or harm the character** (no death ever).
   He **defends by tapping them** (they *poof* harmlessly). New goal
   **"Protect your house!"**, stars for defending; chipped blocks are just
   rebuilt. **Paced**: one slow creeper occasionally, ramping gently with stars.
   Gentle "uh-oh" wobble/sound for tension, nothing more. This is the key
   engagement/"stakes" feature.
2. **Giants** — big friendly creatures to find/pet (extend `animals.js`).
3. **Villagers** — friendly quest-givers (problem-solving; supports "an hour
   without skipping a beat").
4. **More goal tiers + build challenges** (bridge across the pond, 5-tall tower,
   house with a door).
5. **Graphics/atmosphere pass** — gradient sky, softer sun/lighting, maybe
   water transparency. Must not cost FPS; keep 16px textures.
6. **Skeletons etc.** — only after he's hooked, still non-scary.

## Open questions for the dad
- **Ezra's third wish** — he had a third request he couldn't remember (creepers
  + giants were the first two). Ask and slot it in.
- **Feel tuning:** walk speed felt "slightly too fast"; confirm. Does
  "press-to-preview, lift-to-place" feel right, or prefer a plain single tap?

## Working style that's landed well
Ship small, verified increments; show a screenshot each time; explain trade-offs
plainly; recommend an order but let the dad steer; keep everything auto-saving
and on `main`.
