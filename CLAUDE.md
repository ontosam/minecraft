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

## Status (session 2)
Shipped roadmap #1: **friendly "protect your house" creepers** (`js/creepers.js`).
They stroll in toward blocks *you placed*, give a gentle "uh-oh" wobble while
nibbling, slowly chip a block — but **chipped blocks always come back** (auto-
rebuild after ~6s, or instantly when you defend). **Tap a creeper → harmless
poof** + a ⭐. New goals **"Protect your house!"** and **"Block hero"**. Paced:
none appear until you've placed ≥3 blocks; rare/slow at first, ramps gently with
stars. Verified headless (spawn→seek→nibble→chip→rebuild, tap-to-poof, normal
build/dig unaffected). Deployed to `main`. Tuning candidates:
creeper green vs. grass (could pop more), nibble/rebuild timings, pacing.

## Status (session 3)
Two more rounds shipped + deployed:
1. **Navigation:** removed the hover build/dig outline (tap-anywhere made it
   redundant); added a **🔍/🗺️ "switch view"** zoom button (wide overview default,
   cycles to close, eased + saved). Movement/feel confirmed good by the dad.
2. **The Nether (Ezra's wishes #2 & #3):** a **separate Nether dimension** reached
   through a **portal** (find it via a new **minimap**, top-right). Home to
   **friendly ghasts** (big floaty white coo-ers) and **blazes** (glowy spinning
   rods) — both harmless, pettable, with "meet" goals. New goals: Find the portal,
   Meet a ghast, Meet a blaze.
3. **Make it a journey (engagement pass):** the Nether portal is now a **reward**
   — it starts as a **dormant obsidian frame** and **opens with a celebration once
   ⭐`NETHER_STARS`(=4) goals are earned** (locked frame nudges the kid + minimap
   marker is greyed until then; `maybeUnlockNether`, `portalUnlocked`, saved as
   `pu`). Plus **buried treasure**: gold/diamond pockets hidden in the stone (both
   worlds) — digging up a *natural* one (not your own placed block) sparkles ✨ +
   chimes + counts toward "Treasure hunter"/"Treasure chest" goals.
   All verified headless (locked→unlock at ⭐4→travel, treasure dig, portal swap
   both ways, mobs/goals, building in both worlds, **v3 save** persists the unlock,
   **v2 saves upgrade safely** — old worlds get a portal). Minimap is top-right
   (dad approved "anywhere"). Follow-ups: richer creature sounds, nether
   structures, build-shape challenges, giants (roadmap #2).

## Status (session 4)
Shipped Ezra's next batch of wishes (dad delegated the order + the "make worlds
scalable" design). Two increments:
1. **Fly + beach + water bucket (the "soft landing" wish).** A **🕊️ Fly** toggle
   (topbar): hold **Up** (the Jump button relabels) to rise, **let go to drift
   down gently**. **Water is swim-through now** (`passable`): gentle buoyancy + a
   **splash** on entry = a soft landing in any pool. **"Water 🪣"** is selectable
   in the picker (placed water is *not* added to `world.placed`, so creepers ignore
   it). A big **beach lagoon** in the overworld (`World.carveBeach`), also added to
   existing saves but **only if untouched** (`carveBeachIfClear`). New goals:
   *Take off!*, *Big splash!*. Sounds: `fly`, `splash`. (player.js: `flying`,
   `inWaterAt`, `onSplash`.)
2. **Scalable worlds + flint & steel + Gold/Ant worlds (Ezra's #1 wish).** Worlds
   are now a **registry of recipes** — `js/worlds.js` `WORLD_KINDS` (name/emoji,
   `sky`, `fog`, `gen` = a World method name, `ground`, `mobs` list, flags
   `home`/`reward`/`flint`). main.js holds a **lazy `worlds` map**
   (key→`{world,mobs,kind}`) built on first visit (`ensureDim`/`registerDim`,
   `makeMobs`/`populateMobs`/`updateMobs`/`drawMobs`). **Portals became a list per
   world with a destination** (`World.portals`, `addPortal(ox,oz,ground,dest,
   active)`, `setPortalActive(portal,active)`, `portalAt(x,y,z)`). **Flint & steel**
   (🔥 topbar → "Where to?" menu built from the registry) pops a **lit obsidian
   portal in front of the player** to the chosen world (`lightPortal`); stepping in
   `travelTo(dest)`. **Every away world auto-gets an always-open obsidian portal
   home** ("back to obsidian"); the **Nether stays the ⭐4 reward** (excluded from
   the flint menu). New worlds: **Gold World** (`generateGold`) and **Ant World**
   (`generateAnt` + an `ant` species in animals.js, spawned via
   `new Animals(gl,w,['ant'])`). New goal: *World hopper*. **Save is now v4** (a map
   of visited worlds, per-world `positions`, `pu`); the loader still reads **v3/v2**
   and upgrades them (and adds the beach). Verified: Node logic tests (fly/water
   physics, generators, portal list, save round-trip) + headless browser (clean
   boot, flint→travel→Gold/Ant, **v4 save+resume**, screenshots of beach/gold/ant/
   flint-menu). Dev branch this session: **`claude/jolly-brown-mndfr5`** (mirror to
   `main`/live pending the dad's OK). Tuning candidates: gold-world treasure makes
   the "treasure" goals trivial there; flint can make many portals (no limit);
   ant-world ants are small — could enlarge.

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
  `frameMesh` (configurable wireframe). NOTE: `makeLineProgram`, `cubeMesh` and
  `frameMesh` are now unused (the hover build/dig indicator was removed) — safe
  to delete.
- `js/world.js` — voxels (`SX=64,SY=32,SZ=64`), `B` ids, `BLOCKS` defs,
  `CATEGORIES`/`PALETTE`, terrain gen (gentle hills + pond + trees), **chunk
  mesher** (16×16 columns, face culling + baked ambient occlusion), `raycast`
  (DDA), save/load (base64 of the byte array + `placed`: a Set of packed indices
  of **player-placed** blocks, so creepers target your house not nature; +
  `arrival`: the portal drop point; `portalFrame` for (de)activation). Terrain
  also hides **gold/diamond ore** in the stone. Also `generateNether()`
  (netherrack + glowstone + lava + a little ore), `addPortal(ox,oz,ground,active)`
  + `setPortalActive()` (obsidian frame; the **passable** swirl interior is filled
  only when active — a dormant frame is the locked state). Chunk meshes use **Uint16**
  indices with a guard (`base+24 > 0xffff` breaks) so extreme builds can't
  overflow.
- `js/worlds.js` — the **world registry** (`WORLD_KINDS`, `WORLD_ORDER`): each
  world is a recipe (name/emoji, `sky`, `fog`, `gen` method name, `ground`, `mobs`
  list, `home`/`reward`/`flint` flags). Add an entry + a `generateXyz()` on World
  and it shows up everywhere (flint menu, travel, minimap, save) automatically.
- `js/player.js` — third-person physics: **camera-relative** movement, character
  faces travel (but **backpedals** when moving toward the camera), gravity, AABB
  collision, auto-jump, walk-phase, `movingForward` flag (camera trails only
  when true). Also **flying** (`flying`: hold to rise, release = gentle sink, sky
  cap) and **water** (`inWaterAt`: buoyant soft sink/swim + `onSplash` callback).
- `js/character.js` — blocky kid (legs/arms/body/head, eyes+hair); walk-swing +
  **action chop + forward body-lean** when building/digging (`act` param).
- `js/animals.js` — pig/sheep/cow/chick/cat; wander AI; `petNearest` → follower.
- `js/nethermobs.js` — friendly Nether creatures (built like animals, but they
  **float**). `NetherMobs` manages ghasts (puffy white cube + tentacles + calm
  face) and blazes (core + spinning glowing rod ring, drawn as 2 meshes). Gentle
  drift AI, ease to a hover height over the ground, `petNearest`, and an
  `onMeet(species,pos)` callback the first time the player comes close (drives the
  "meet a ghast/blaze" goals). Spawned via `populate(SX,SZ)`.
- `js/creepers.js` — friendly creepers (built like animals). `Creepers` manages a
  list + a `rebuilds` queue. Per-creeper state `seek`→`nibble`→`poof`; targets
  nearest `world.placed` block via `findTarget` (`unkey` inverts `world.idx`);
  `chip` removes a block and queues an auto-rebuild; `pickRay`(origin,dir) =
  ray/sphere test for tap-to-defend; `defend` poofs + rebuilds all chipped now.
  `onEvent('uhoh'|'chip', pos)` callback drives sound/save. Spawn paced by
  `world.placed.size≥3`, count/interval scale with stars. `spawnNow` is a debug
  helper (exposed as `__ezra.spawnCreeper()`).
- `js/input.js` — unified pointer+keyboard. Touch: left half = floating
  joystick, right half = drag-look. Mouse: drag-look + hover; WASD/arrows + Space.
  **Tap detection**: quick tap (no drag, <300ms) sets `tapPending` + `tapX/tapY`;
  `aim{active,x,y}` tracks the finger/cursor for the live indicator.
- `js/audio.js` — tiny WebAudio synth (place/dig/jump/pet/deny/uhoh/poof/portal/
  coo). No files.
- `js/goals.js` — `GOAL_DEFS` + `Goals` (counters incl. `defend`/`treasure`/
  `nether`/`ghast`/`blaze`, stars, localStorage, generic `bump(metric)`). Saves on
  every completion; throttled otherwise.
- `js/main.js` — the glue: GL/program/atlas setup; **camera** (`camYaw/camPitch`,
  `cameraFollow`, collision pull-in, `screenRay`/`rayHitAt`); **zoom/"switch
  view"** (`ZOOM_LEVELS=[7,4.5,3]`, `zoomIndex`, eased `camDistEased`, 🔍/🗺️
  `btn-view`, saved); **two dimensions** (`overworld`/`nether` Worlds, active
  `world` pointer, `dimension`, `setDimension`/`enterPortal`, per-dim `sky`/fog +
  entity update/draw; `portalCooldown`; `overPos`/`netherPos`); **minimap**
  (`initMinimap`/`drawMinimap`, top-down terrain + you + portal, `minimapDirty`);
  **Nether gating** (`portalUnlocked`, `NETHER_STARS`, `maybeUnlockNether` on goal
  completion → opens the portal + celebration; locked-frame nudge); **treasure**
  (digging a natural gold/diamond → `goals.bump('treasure')` + `spawnSparkles`);
  render loop; build/dig (`doBuild/doDig(hit)`, `doAction`, `lastTool`); **tap
  routing**: in the overworld a tap first tries `creepers.pickRay` (→`doDefend`,
  poof + ⭐), else `doAction` (no hover indicator — tap anywhere); UI wiring;
  hearts + `spawnPuffs`; autosave (**v3** save: both dimensions, positions, dim);
  SW reg.
- `scripts/serve.mjs`, `scripts/make-icons.mjs`, `sw.js` (offline, network-first,
  https only), `manifest.webmanifest`, `icons/`.

## Controls (current)
- **iPad:** drag **left** = walk, drag **right** = look (camera auto-trails when
  moving forward; backing up is a backpedal). **Tap a spot** = build/dig there
  (no hover outline anymore — tap-anywhere made it redundant/in-the-way). **Drag
  = move/look**, **tap = act**. Tap a **creeper** to poof it. Buttons: Build/Dig
  (also act in front + pick the tool, gold ring = active), Jump, Pet; 🏠 home,
  ⭐ goals, 🔍/🗺️ **switch view** (zoom wide↔close), block-picker button.
- **Laptop:** **WASD/arrows** move, **drag mouse** to look, **click** builds/digs
  there.

## Debug & testing (no browser-in-the-loop otherwise)
- `window.__ezra = { world (active, getter), player, animals, creepers,
  nethermobs, overworld, nether, cam(), target(), rayHit(x,y), sel(), dim(),
  enterPortal(), goals, spawnCreeper() }` — exposed for support/demos.
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
- Save keys: `ezrablocks.save.v2` (the localStorage *key* name is unchanged; the
  JSON inside is now **v4** — a `worlds` map (each = bytes + `placed` + `portals`
  list), per-world `pos`itions, current `dim`, selected block, `zoom`, `pu`
  (portal-unlocked). Loader still reads old **v3/v2** payloads and upgrades them —
  re-adds standard portals + carves the beach if untouched). `ezrablocks.goals.v1`.
  iOS clears localStorage for non-home-screen sites — **Add to Home Screen** for
  durable progress.

## Roadmap / backlog (priority order)
1. ~~**Friendly creepers.**~~ ✅ **DONE (session 2)** — see Status above and
   `js/creepers.js`. Built to the agreed spec (wander to your builds, slow
   nibble, never harm the kid, tap to poof, "Protect your house!" goal, chipped
   blocks rebuilt, paced + ramps with stars, "uh-oh" wobble/sound). Pending the
   dad's playtest + deploy to `main`. Possible follow-ups if he wants more: a
   tiny telegraph "!" above a nibbling creeper, distinct creeper color so it
   pops against grass, sound-on/off toggle.
1.5. ~~**The Nether (Ezra's wishes #2 & #3).**~~ ✅ **DONE (session 3)** — separate
   Nether dimension via a portal, minimap to find it, friendly ghasts + blazes,
   three new goals. See Status above + `js/nethermobs.js`. Follow-up ideas:
   richer creature sounds, nether structures/treasure, minimap reposition.
2. **Giants** — big friendly creatures to find/pet (extend `animals.js`).
3. **Villagers** — friendly quest-givers (problem-solving; supports "an hour
   without skipping a beat").
4. **More goal tiers + build challenges** (bridge across the pond, 5-tall tower,
   house with a door).
5. **Graphics/atmosphere pass** — gradient sky, softer sun/lighting, maybe
   water transparency. Must not cost FPS; keep 16px textures.
6. **Skeletons etc.** — only after he's hooked, still non-scary.

## Resolved with the dad (session 2)
- **Ezra's three wishes are now known:** creepers (done), **ghasts**, and
  **blaze** — both Nether mobs. The dad wants to **expand the world**, add a
  small **minimap** (bottom) to help find a **Nether portal**, and meet friendly
  ghasts + blazes through it. "Slightly challenging but not stressful." → the big
  next feature (see roadmap #1.5). Make them non-scary/no-harm like everything else.
- **Feel tuning:** movement now feels **great** (don't re-tune walk speed). The
  old "press-to-preview, lift-to-place" is gone — **plain single tap** to build/
  dig is the confirmed model, and the hover indicator was removed as in-the-way.

## Working style that's landed well
Ship small, verified increments; show a screenshot each time; explain trade-offs
plainly; recommend an order but let the dad steer; keep everything auto-saving
and on `main`.
