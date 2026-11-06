# CLAUDE.md — project context & handoff

A gentle, third-person, Minecraft-style block world built for **Ezra, age 6**
(his dad is the collaborator; Ezra finds real Minecraft too hard to navigate).
The whole thing is a **zero-dependency static web app** (raw WebGL) that runs in
Safari/Chrome and installs to the iPad home screen as a PWA.

> New here? Read this file, skim `js/main.js`, then run it (see **Run it**).
> The dad is non-technical — explain choices simply and keep things forgiving
> and non-scary (always daytime, no death).

## Two games in one repo
1. **Ezra's Blocks** (root `/`) — the 3D builder described below.
2. **Ezra's Mine** (`/mine/`, session 2) — an *original* tap-and-merge idle
   mining game, made because Ezra loves the mobile game "Minetap" and kept
   asking to buy things in it. Same genre/mechanics, **our own name, art,
   text and characters** (we must not copy Minetap's name/art, nor Minecraft
   trademarks like Creeper/Nether/Redstone/Glowstone), and **no ads, no real
   money, no energy limits**. See **Ezra's Mine** section at the bottom.

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
- **Headless verification** (how every change was checked): drive
  the bundled Chromium via the **DevTools Protocol** over a WebSocket (Node 22
  has global `WebSocket`/`fetch`), dispatch real input, read `__ezra`, and
  `Page.captureScreenshot`. A reusable driver is committed at
  `mine/tests/cdp.mjs` (`launch({width,height,touch})` → `tap/drag/eval/shot`).
  Browser binary moves between sandbox images — `ls /opt/pw-browsers/`; in
  session 2 it was
  `/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`
  with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`.
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


## Ezra's Mine (`/mine/`) — session 2
Live at **https://ontosam.github.io/minecraft/mine/** (own manifest + icons,
so it can be its own home-screen app; the root `sw.js` precaches it too).
Blocks has a ⛏️ topbar button to hop over; the Mine's grown-ups corner links
back.

**Core loop (matches the genre Ezra knows):** tap the big **mine block** (its
face shows the block it will drop; taps-left number; hold = slow auto-tap) →
a block flies onto a free square → **drag a block onto its twin** (or tap one,
then its twin) to merge into the next of **20 tiers** (Dirt → … → Star Block)
→ every block on the board earns **gold/sec** → **levels** open more squares
(9 → 30) → new **caves** (backdrops) as you discover deeper blocks.

**Healthy replacements for the paid bits:** the yellow lightning bar is a
**Spark bar** that *fills* as you mine (full → next break is a 2-block "Super
Swing"), never an energy limit; the x2 boost is a **Gold Rush jar** filled by
merging (never by ads); **purple gems** (not emerald green) are earned only
(new blocks, level-ups, quests, chests, Wishing Well on a fixed count) and buy
Boom Blocks / Magic Merge; treasure chests open instantly with a single tap;
board full → new blocks hop into the (unlimited) storage chest, so tapping is
never blocked. No streaks, no daily rewards; offline gold is half-rate with
one fixed 12 h cap (so checking in hourly never pays more than once a day).
Grown-ups corner (hold one finger 3 s, then answer a sum written in words):
sound, read-aloud, tier numbers, optional break reminder (default 30 min — a
friendly card with "Done for now" first; "Keep digging" snoozes 10 min; never
a lock), "Start over" (keeps one `.bak` save you can restore).

**Safety rails added after the session-2 review:** the furnace won't melt your
two best kinds of block and queued items can be taken back out; Boom Blocks
are stored in their own `s.booms` counter (never in the `b<tier>` store keys);
taps within 0.4 s of a panel/card opening are ignored (double-tap accidents);
grey buttons still answer with a spoken reason; audio/speech unlock on
touchend/click (iPad ignores pointerdown as a gesture).

**Files** (`mine/`): `index.html`, `mine.css`, `js/data.js` (ALL content and
numbers: tiers, caves, pickaxes+recipes, upgrades, furnace, village, shop,
quests), `js/game.js` (pure rules, no DOM — emits events `game.on(type, data)`),
`js/main.js` (screen: board/drag/tap-merge, dock stations + panels,
celebrations, FX, HUD, speech, save), `js/art.js` (procedural 16px tiles +
hand-authored 16×16 sprite icons, incl. our own mole helper "Digby"),
`js/sound.js`, `js/fmt.js`. Save key `ezramine.save.v1`.
`scripts/make-mine-icons.mjs` regenerates `mine/icons/`.

**Stations** (unlock by level): Quests/Blocks book/Chest (1), Workshop +
Digby helper (2: pickaxes crafted from blocks *on the board or in the chest* +
furnace bars; Dig Deeper (7 levels); Mole Helper; Lucky Dig), Shop (3),
Furnace (4: any block → bricks; ores → metal bars), Village (5: bricks → 6
buildings: hut +gold, blacksmith faster furnace, well gems, bakery more
bricks, tower more chests, castle +gold). A goal card under the HUD always
shows the next quest (tap = read aloud / open the right station / collect).

**Balance:** `node mine/tests/sim.mjs [hours] [tapsPerSec] [mergeSecs]` plays
a robot kid. Kid pace (1.5 taps/s, 1.8 s per merge): Copper ~3 min, Ruby
~45 min, Gold Block ~1.5 h, Star Block ~4.5 h. The main pacing knob is
`depthNeed()` in data.js (when "Dig Deeper" becomes available); prices are
anchored to the tier ladder (`anchored()`).

**Tests:** `PORT=8123 node scripts/serve.mjs &` then
`node mine/tests/e2e.mjs` — real touch taps/drags for merge, tap-tap, chest,
crafting, furnace, village, quests, Gold Rush, overflow, Boom, save/reload,
offline gold, grown-ups gate, every panel, and layout on 9 screen sizes.
Debug handle: `window.__mine` (`game`, `speed(x)`, `openPanel(id)`, …).

**Mine backlog ideas:** more caves/blocks after the Star Block (a gentle
"new world" instead of prestige pressure), Pebble Pals (friendly critters you
tickle for coins — replaces the original's monsters), cosmetic pickaxe paints
for gems, Ezra-designed block painter, and linking discoveries to unlock
blocks in Ezra's Blocks (same origin → shared localStorage).
