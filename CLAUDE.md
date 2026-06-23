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

## Status (session 5)
Ezra's next four wishes (dad picked **"real-er challenge"** for the night tier).
All shipped + deployed to `main`:
1. **🏠 House kit** — a 2-tall **openable door** (`B.DOOR`/`B.DOOR_OPEN`, procedural
   tiles): place as a unit (`placeDoor`), **tap to open/close** (`toggleDoor`, both
   halves), dig removes both (`removeDoor`). New **"House 🏠"** picker tab (door +
   glass "window" + planks + brick). `door` sound.
2. **💥 TNT** — `B.TNT` (new "Boom 💥" tab). **Tap a TNT block to light it**
   (`lightTNT` → a `fuses` list); after a short fuse it detonates (`detonate` →
   `World.explode(cx,cy,cz,r)` carves a crater; bedrock/portal survive). Caught TNT
   **chain-reacts**; explosions add camera **`shake`**, a harmless **knockback**, 💥
   particles + a `boom` sound. New **TNT World** (`generateTnt`, in the flint menu).
   Ant World kept as a bonus. Goal: *Demolition!*.
3. **🌙 Night + ❤️ hearts + 🧟 zombies (real-er).** `btn-night` toggles night; an
   eased `nightAmt` blends sky→`NIGHT_SKY` and drives a new world-shader uniform
   **`uDayLight`** (dims everything). `js/zombies.js` `Zombies` (built like creepers
   but they **chase + attack**): spawn at night in the overworld, bonk a **heart**
   off on a cooldown (`onEvent('hit')`→`hurt`), take **two taps** to defeat
   (`pickRay`/`bonk`), fade at dawn. **Hearts HUD** (`#hearts-bar`, `MAX_HEARTS=6`),
   red `#hurt-flash`, brief `invuln`, slow regen when safe. **Out of hearts → a
   gentle knock-out**: wake at home, full hearts, night cleared — **never lose
   builds or stars**. **Lava now hurts** (`player.onLava` → bounce out + a heart).
   Goals: *Brave at night*, *Zombie bonker*. Sounds: `hurt`, `groan`.
   All verified: Node logic (door, explosion+chain, zombie chase/attack/defeat,
   fly/water) + headless browser (boot, house, TNT detonation, **night→zombie
   hit→bonk→lava→knockout**, save/resume) with screenshots.
   Tuning candidates: night dim is gentle (`uDayLight≈0.4`) — could go darker;
   zombies cap at 4; lava damage is also active in the Nether.
   **Post-feedback fixes (same session):** flint portals were stacking in front of
   each other (hard to find/enter) — they now line up in a tidy **row by home**,
   **one per destination** (`HUB_DESTS`, `placeHubPortal`, keyed by `dest` so
   re-lighting never duplicates). **Portal frames are now unbreakable** (`World.
   isPortalBlock` guards both digging and explosions), so a gateway can't be lost;
   the 🏠 button is the always-works safety net. Older saves get their stacked
   portals **auto-tidied into the row on load** (`tidyPortals`, v4 only — clears
   just the old obsidian/swirl, never builds).

## Status (session 6)
End-of-arc additions (reset + an incentive economy beyond stars). All deployed:
- **Reset world (confirmed).** Goals panel → "🔄 Start this world fresh…" → a
  confirm dialog (`askReset`) → `resetWorld()` regenerates the **current** world
  (builds + `placed` cleared), keeps the standard + flint portals, and **never
  touches ⭐ stars or 💎**. `World.generate()` now clears `data/placed/portals` like
  the other generators.
- **Mine diamonds + a 💎 economy.** Digging a *natural* diamond → **+2 💎** (gold
  +1) and a new **Diamond miner** goal; **every goal also pays +2 💎**. A **💎
  counter** sits top-left (tap → shop). Currency + unlocks live in the goals save
  (`gems`, `unlocks`; `addGems`/`spend`/`hasUnlock`/`setUnlock`).
- **💎 Treasure Shop** (`SHOP`, `buildShop`/`buyItem`): **Pet Friend** (a follower
  cat — `Animals.spawnPet`, re-spawned each load by `ensurePet`), **Extra Heart**
  (`maxHearts` 6→7 via `applyUnlocks`), **Mega TNT** (bigger `explodeRadius()`).
- **More build incentives:** new goals Diamond miner, Master builder (75),
  Decorator (8 kinds), Door maker (`placeDoor` bumps `doors`). Goals now total 25.
  Verified: Node (gems/spend/unlocks/persist) + headless (mine→💎→shop→buy
  pet+heart, reset clears builds but keeps ⭐/💎) with a shop screenshot.
  Idea backlog: more shop items (speed boots, sparkle trail, new worlds), build
  challenges that check structures, spend 💎 to instantly unlock the Nether.

## Status (session 7)
Two bug fixes the dad flagged + a big reward pass (he said Ezra loves 💎;
"add more rewards he has to work for, plus special things — pen is yours").
Dev branch this session: **`claude/gifted-gates-h9dzy2`** (push there; mirror
to `main`/live pending the dad's OK).
1. **Reset button was invisible** — the Goals panel is `overflow:hidden`, but
   `#goals-body` had no internal scroll, so the long (now 28) goal list shoved
   the "🔄 Start this world fresh…" button off the clipped bottom. Fixed in CSS:
   `#goals-body` now `flex:1; min-height:0; overflow-y:auto` and `#btn-reset` is
   `flex:0 0 auto` (pinned, always visible). Verified headless (button is on-
   screen *and* `elementFromPoint` returns it = clickable).
2. **Zombie bug** — attacks only checked horizontal distance, so a zombie could
   bonk you from straight below while you flew/towered up to escape. Added a
   vertical gate: `ATTACK_VRANGE=2.0`, attack needs `d<=ATTACK_RANGE &&
   |dy|<=ATTACK_VRANGE` (zombies.js). Flying/climbing is now a real escape.
   Verified by a Node logic test.
3. **Bigger 💎 shop** (`SHOP` in main.js) — now 8 items, mixing "work for it"
   with delight: **👟 Speed Boots** (`player.speedMul`), **🦘 Super Jump**
   (`player.jumpMul`), **✨ Sparkle Trail** (frame-loop ✨ particles while
   moving, `trailT`), **🌈 Rainbow Block** (new `B.RAINBOW`/`TILE.RAINBOW`;
   shows up in a new **"Special ✨"** picker category gated by `cat.locked`, and
   is auto-selected on buy), **👑 Golden Crown** (`character.wearCrown` + a crown
   mesh on the head), plus the existing Pet/Heart/Mega-TNT. Costs 5–20💎.
   `applyUnlocks()` now also sets speed/jump/crown; `buyItem` bumps a new
   `bought` counter. 3 new goals (Treasure shopper, Diamond king, Marathon →
   28 total). All unlocks persist (goals save `u`).
4. **☁️ Sky World** (the big-ticket reward, 20💎) — `World.generateSky()`:
   grassy islands floating in a bright sky + trees/glowstone/treasure/clouds,
   a guaranteed central island for spawn + the home portal. Registered in
   `WORLD_KINDS.sky` with `flint:true` + `locked:'skyworld'`; the flint "Where
   to?" menu hides locked worlds until bought. Added to `WORLD_ORDER` and
   `HUB_DESTS` (tidy portal row). Falling off just respawns you (no harm) and
   it pairs perfectly with Fly. Verified headless: hidden→buy→appears in flint
   menu→travel→build→return home, and **builds persist across save/reload**;
   full world-hop regression (gold/ant/tnt/nether/over) stays green.
   New debug hook: `__ezra.crown()`. Tuning candidates: crown sits a touch tall;
   Sky World home-portal can land on a tree (cosmetic); sky-world treasure adds
   to the "treasure goals are easy in resource-rich worlds" note.

## Status (session 8)
Dad approved session 7 → pushed live to `main`. Then he handed over a wishlist
with full autonomy ("keep him busy like Minecraft, reward him, make him work;
he gets anxious losing lives so let him feel the loss but always recover").
Shipped as five verified increments on **`claude/gifted-gates-h9dzy2`**, mirrored
to `main`. Now **33 goals**, **10 shop items**, **49 block ids**.
1. **Half-heart stakes + tougher zombies.** Hearts now track in **half** steps and
   render full/half/empty (CSS `.hs` slot: a 🤍 base with a clipped ❤️ overlay).
   Regen is a bit quicker (0.5 every 2.2s after 4s safe) so he always climbs back.
   Zombies need **3** bare-hand bonks now (was 2); `bonk(a, dmg)` takes damage.
   `__ezra.hurt(n)` debug hook.
2. **🕷️ Spiders (`js/spiders.js`).** Quick, low, cute (big eyes) night mob that
   spawns with zombies, skitters in and **nibbles half a heart**; 2 taps to shoo
   (1 with the sword). Same vertical-reach escape rule. Wired into the over mob
   set, tap routing, knockout cleanup; `hiss` sound; 'Spider shoo-er' goal.
3. **⚔️ Diamond Sword (Ezra asked).** Shop item (12💎). `swordDamage()` = 3 when
   owned → one-shots zombies/spiders. Visibly **held in the action hand**
   (`character.holdSword` + sword mesh that swings with the chop). 'Monster masher'
   goal (`monster` counter, bumped on any night-mob defeat). `__ezra.sword()`.
4. **⚙️ Redstone (Ezra asked).** New blocks LEVER/REDSTONE/REDLAMP (+ on-states)
   in a 'Redstone ⚙️' picker tab. `World.updateRedstone()` floods power from
   on-levers through connected wire into touching lamps (REDLAMP↔REDLAMP_ON);
   recomputed on lever toggle, on place/dig of a redstone block, and on load
   (in `registerDim`). Tap a lever to flip it. Goals: 'Lever flipper', 'Light it
   up!'. `__ezra.toggleLever(x,y,z)`.
5. **🟢 Bouncy Slime block (creative extra).** `B.SLIME` (Fun tab): land with
   speed → spring up in decaying hops (`player.onBounce`, threshold vy<-3.5,
   bounce = min(13, -vy*0.85)); trampolines! 'Boing!' goal + sound.
   Verified throughout: Node logic tests (zombie/spider vertical-attack + HP +
   sword one-shot, redstone flood/break, slime bounce decays & settles) +
   headless (half-heart HUD + regen, spider live −0.5, sword one-shot, a
   lever→wire→lamp circuit lighting, a full build-everything **save/reload**
   keeping the lit lamp/slime/rainbow + all unlocks, and the world-hop
   regression). Tuning candidates: night dim still gentle (uDayLight≈0.4) so
   mobs are easy to spot but the scene isn't dark; up to 4 zombies + 3 spiders
   at once (weak but many — could cap lower if it feels busy); slime+sword could
   later combine (sword "knockback").

## Status (session 9)
Dad gave full creative freedom ("give you the torch… pen is yours, I love your
creativity"). Shipped two delightful, beloved-game-inspired features on
**`claude/gifted-gates-h9dzy2`**, mirrored to `main`. Now **36 goals**,
**11 shop items**.
1. **🐴 Rideable Pony (the headline).** New `🐴 Ride-On Pony` shop item (16💎).
   Once owned, a horse spawns at home (re-spawned each load via `ensurePony`) and
   **follows you like the pet cat**. A new **🐴 topbar button** (revealed when
   owned) hops you on/off. Riding **snaps the pony to you** (always comes when
   called), boosts speed/jump (`player.mountSpeed=1.7`, `mountJump=1.18`), and the
   kid is drawn **sitting astride it** (new `character.draw(..., seated)` pose:
   legs forward, hands on reins; rider raised +0.62). Dismount sets it down beside
   you. Travelling worlds / knockout auto-dismounts (pony stays home). New `horse`
   mesh in animals.js (shop-only, so it stays special); `Animals.update` skips a
   `ridden` pony. 'Giddy up!' goal, `neigh` sound, `__ezra.toggleRide()/riding()`.
2. **🎣 Fishing (cozy loop).** New **🎣 topbar button**: near any water it casts a
   projected **bobber** (`#bobber`), and after a short wait you reel in a 🐟 (+1💎),
   sometimes 💎 treasure (+2), or a silly 🥾 boot. Tapping again reels in early;
   travel/knockout reels in safely. Pairs with the beach lagoon. New goals
   'Gone fishing!' + 'Master angler' (12). `__ezra.castLine()/fishing()`.
   Verified headless: pony buy→spawn→mount(1.7×)→dismount→travel auto-dismount and
   **persists across reload**; fishing does nothing on dry land, casts at water,
   the bite pays out + ticks the goal; all 8 topbar buttons fit (right edge 548<
   1024); full world-hop + build-everything save/reload regression stays green,
   zero errors. Tuning candidates: pony's neck/head is hidden from directly behind
   (fine from the side); fishing is free (no rod to buy) — could gate it later;
   topbar is now 8 minis + block (fits tablet/laptop; a tools sub-menu later if it
   ever feels busy on small phones).

## Status (session 10)
Dad said simply "keep going" (full creative freedom continues). Shipped two more
beloved-game-inspired features on **`claude/gifted-gates-h9dzy2`**, mirrored to
`main`. Now **38 goals**, **11 shop items**, **50 block ids**.
1. **🧑‍🌾 Villagers + quests (a living world with purpose).** New
   `js/villagers.js`: two calm, cute townsfolk (big nose, robe) stand near the
   home spawn, turn to face you, bob gently. **Tap one to talk** (added to the tap
   routing after the hostile-mob picks). A quest system in main.js offers a simple
   task from `QUEST_POOL` (place/pet/fish/diamond/treasure/dig/monster/plant);
   progress tracks a goals counter **from a baseline**, so it's "from now on".
   Finish it, tap again, **claim 💎**, get a fresh one — an endless rewarding loop.
   Kid-friendly `#quest` dialog (villager + task + green button). New 'Village
   helper' goal. `__ezra.talkVillager()/questOk()`. Spawned via the over `mobs`
   list (`'villagers'`), re-spawned each load; quest state is transient.
2. **🌱 Planting (saplings grow into trees).** New walk-through `B.SAPLING`
   (Nature tab). Plant it and after ~15–30s it sprouts into a full tree
   (`World.placeTree`). Growth ticks per-sapling in the frame loop (`saplings`
   list with a `world` ref so it's correct across dimensions); on load each world
   is scanned (`scanSaplings`) so saved saplings keep growing. Sparkle+chime on
   grow. New 'Green thumb' goal + a 'plant saplings' quest. `__ezra.plant/growNow`.
   Verified headless: villager talk→offer→do→claim pays the exact reward + ticks
   the goal + re-offers; sapling → full tree (trunk + 57 leaves), list clears,
   saved sapling re-scanned after reload; world-hop + build-everything save/reload
   regression all green, zero errors. Tuning candidates: quests don't persist
   mid-progress across reloads (short enough that it's fine); villagers stand
   still (easy to find) — could let them stroll a little.

## Status (session 11) — polish pass (dad feedback)
Dad: "hearts are covering tiles up top… clean up; ghasts are just floating; make
characters more cohesive." Shipped on **`claude/gifted-gates-h9dzy2`**, mirrored
to `main`. No difficulty changes (purely look-and-feel).
1. **Hearts overlap fixed.** The centered `#hearts-bar` sat at the very top and
   covered the right-hand toolbar (now 8 minis + block). Moved it to its own row
   just under the toolbar (`top: 72px`); verified no overlap at tablet + portrait.
2. **Soft blob shadows for everyone (cohesion).** New `gfx.shadowMesh` (a flat
   1×1 dark quad, NEUTRAL-centre UV, black, light 1) drawn in a **blended pass**
   in main (`drawShadows`/`shadowAt`) between `world.draw()` and the characters:
   `gl.enable(BLEND)` + `depthMask(false)` + `uAlpha 0.26`, one quad per creature
   (+ the player, skipped while riding since the pony's covers it) sized per type,
   at `heightAt(x,z)+1.02`. Grounds the whole cast — floaty ghasts included.
3. **Nether floaters lowered** (`FLOAT` ghast 2.7→2.0, blaze 1.9→1.5) now that a
   shadow sits beneath them. Verified headless (no errors): hearts clear, shadows
   render in overworld + nether, world-hop + save/reload regression green.
   Note: shadows use `heightAt` (topmost block), so under deep overhangs a shadow
   lands on the roof — fine for this mostly-surface game.

## Status (session 12)
Dad's wishlist: character selection (himself/family/friends/Cristiano/Steve),
"Steve's lava chicken store" as a challenge, and "he loves math." Shipped both on
**`claude/gifted-gates-h9dzy2`**, mirrored to `main`. Now **40 goals**.
1. **🙂 Character selection.** The character rig is now **skinnable**:
   `character.js` exports a `CHARACTERS` roster (per-character colours + style
   flags `long`/`beard`/`cape`/`ball`) and `Character.setCharacter(def)` rebuilds
   the kid's part meshes live (crown/sword/seated-riding still work; old meshes
   `dispose()`d). New **🙂 topbar button** → "Who do you want to be?" picker with
   8 friendly blocky options: Ezra, Mama (long hair), Dada (beard), Cora (long
   hair), Jovi, Cristiano (red kit + a soccer ball), Steve (cyan), Super Hero
   (blue suit + red cape). Choice saved as `char` and applied on load
   (`applyCharacter`). `__ezra.setCharacter()/character()`.
2. **🍗 Steve's Lava Chicken math challenge.** A second `Character` (Steve skin)
   stands at a little stand near home (`setupSteve`/`buildLavaStand` — planks
   counter, glowstone grill + ORANGE "lava", log posts, brick awning; placed
   only into AIR so it never harms a build; rebuilt on reset). He turns to face
   you + casts a shadow. Tapped via a ray/sphere test (`rayHitsSphere`, in the
   tap routing after villagers, overworld only) → a **math dialog** (`#math`):
   `makeMath` scales difficulty by `goals.counts.math` (sums →10, →20, then
   subtraction), 3 answer buttons; right → +💎2 + 🍗 + next question, wrong →
   gentle retry. Goals 'Math whiz' (5) + 'Number master' (20).
   `__ezra.openMath()/mathQ()/steve()`. Verified headless: 8-char picker
   applies+persists, topbar (9 minis+block) still fits; math opens with 3 opts,
   correct pays +💎2 and advances, wrong doesn't; full regression green, zero
   errors. Tuning candidates: Steve's stand sits at spawn+7 (could collide with a
   pre-existing build on old saves since it only fills AIR — safe but may look
   sparse); character previews are emoji (no live 3D thumbnail).

## Status (session 13)
Dad feedback: "Steve selling snacks is great — snacks could give hearts; Jovi is
a girl; instead of dada/mama use Vlad and Chris." Shipped on
**`claude/gifted-gates-h9dzy2`**, mirrored to `main`. Now **41 goals**.
1. **🍎 Steve's snack stall (💎 → hearts).** Tapping Steve now opens a stall menu
   (`#steve`, `openSteveMenu`/`buildSteveMenu`) with the 🧮 Math Challenge button
   (earn 💎) **and** snacks that spend 💎 to restore hearts: `SNACKS` = Apple
   (1💎,+1❤️), Lava Chicken (2💎,+2❤️), Cake (3💎, full). `buySnack` heals up to
   `maxHearts`, refuses politely at full (no charge), bumps a `snack` counter
   (new 'Snack time' goal). A renewable 💎 *sink* to balance all the income.
2. **Character fixes.** `jovi` is now a girl (long hair, purple top, 👧). `mama`/
   `dada` renamed to **`chris`**/**`vlad`** (Chris keeps long hair, Vlad the
   beard). `CHAR_ALIAS` maps old saved ids (mama→chris, dada→vlad) in `charById`,
   and the loader normalises `selectedChar = charById(obj.char).id` so a saved
   pick survives the rename.
   Verified headless: roster reads Ezra/Chris/Vlad/Cora/Jovi/Cristiano/Steve/
   Super Hero; snack heals +charges +refuses-at-full; math still launches from the
   stall; a `char:'mama'` save loads as `chris`; full world-hop + save/reload
   regression green, zero errors. Note: snacks only help when you're below full
   hearts (by design) — pairs with night combat. Idea backlog: a temporary
   "golden apple" over-heal buff; live 3D character thumbnails; counting/number-
   bonds math mode.

## Status (session 14)
Dad: "go for it [on the backlog] — and will he keep up, or do you have cool
blurbs?" So: shipped the three backlog ideas AND a friendly one-time hint system
so a 6-year-old is never lost. On **`claude/gifted-gates-h9dzy2`**, mirrored to
`main`. Still 41 goals (no new metrics needed).
1. **🍏 Golden Apple (temporary bonus hearts).** 4th snack (5💎): sets
   `heartBuff=2` + `heartBuffT=90s`, fills to `effMax()`; bonus hearts render as
   golden 💛 (`.hs.hb`); buyable at full health (it's a buff, not a heal); ends on
   knockout; frame loop counts it down. Hearts code now uses `effMax()=maxHearts+
   heartBuff` everywhere (updateHearts/regen/applyUnlocks/buySnack).
2. **Varied math.** `makeMath` now returns `{prompt(html), ans, opts}` and picks a
   type by skill: **count** ("how many 🍎" + emoji row), **add**, **sub**, and
   **number bonds** ("3 + ? = 10"). `showMath` renders `prompt`.
3. **Character previews.** `charPreview(def,size)` draws a 2D blocky paper-doll in
   the character's real colours (hair/beard/long-hair/cape/ball); the picker shows
   these canvases instead of emoji.
4. **Friendly blurbs (`goals.tips` + `tip(id,text)`).** One-time hints shown the
   first time you're near **Steve** or a **villager**, and the first **night**.
   Saved (`p` in the goals save) so each shows once, ever.
   Verified headless: golden apple → 8 hearts incl. 2 gold; all 4 math types
   appear with valid options; 8 avatar previews render; night+steve blurbs fire
   once; full regression green, zero errors. Tuning: golden-apple buff is fixed
   at +2/90s (could scale); blurbs are proximity/event based (no full tutorial).

## Status (session 15)
Dad feedback: "can't find Steve; spiders too easy (give them webs); add
skeletons (fewer, harder, more rewarding); fishing = unlimited diamonds — tell
him bigger water = bigger fish; some features I'm not seeing." Shipped on
**`claude/gifted-gates-h9dzy2`**, mirrored to `main`. Now **42 goals**, **51 block
ids** unchanged.
1. **Deploy/caching.** "Not seeing features" → bumped `sw.js` `CACHE` v1→**v3** and
   completed `CORE` (all js/*). It's network-first already, but the bump forces
   old caches to clear on the installed iPad PWA. (Tell the dad: fully close &
   reopen the app once to pick it up.)
2. **Findability.** Minimap now marks **Steve** (orange dot) + **villagers**
   (green) in the overworld (`drawMinimap`).
3. **Fishing economy.** `reelIn` now scales by `waterBodySize()` (capped flood
   fill): size<8 → only minnows/boot (**0💎**), <32 → fish/treasure, ≥32 → BIG
   fish (2–3💎). First-cast blurb: "little ponds have little fish — find/build a
   big lake/ocean." **Bug fixed**: bobber coords are floats, so `world.get` read
   undefined → every catch counted as tiny (0💎); `waterBodySize` now floors.
4. **Spiders** tougher (HP 2→3) + **webs**: from ~2–6 blocks they `emit('web')`
   → `player.webT` halves walk speed for 1.6s (harmless, fun). `hiss`+🕸️.
5. **💀 Skeletons** (`js/skeletons.js`): rare (cap 2, ~9–15s), tough (HP 4 / 2
   sword hits), **more rewarding** (+3💎 + 'Skeleton slayer' goal). Aim telegraph
   (`AIM_TIME`) → slow **arrow** for half a heart, gated on `|dy|` so flying
   dodges. `bow`/`rattle` sounds. Wired into over mobs, tap routing, shadows,
   knockout cleanup, `__ezra.skeletons`.
   Verified: Node logic (spider web/HP, skeleton HP/melee/aim-shoot/fly-dodge) +
   headless (water-size: big lake ~97💎 vs puddle 0 over 40 casts; night spawns;
   blurbs) + full regression — all green, zero errors. Tuning: night still gentle
   (uDayLight≈0.4); skeleton arrow always lands after the telegraph if you didn't
   leave range/height (no true projectile dodge); could add real arrow physics.

## Status (session 16)
Dad feedback + two AskUserQuestion answers: flint "Full Minecraft: build your own
frame, then light it"; blocks "make them functional like Minecraft." Also: cap
math diamonds; springier slime. Shipped on **`claude/gifted-gates-h9dzy2`**,
mirrored to `main`. 42 goals (no new metrics). **sw cache v3→v4.**
1. **🔥 Flint & steel = a real tool.** The 🔥 button now **toggles flint mode**
   (gold ring) instead of an instant menu. In flint mode a tap lights **TNT** or,
   if you're aiming through a **closed obsidian frame**, opens the "Where to?"
   menu and lights it. `World.findFrame(x,y,z)` planar-floods the interior air and
   validates it's enclosed by obsidian (≤30 cells); `World.lightFrame(cells,dest)`
   fills the swirl + registers the portal. `portalAt` rewritten: nearest active
   portal while standing in a `B.PORTAL` block (works for any frame shape).
   `lightChosenFrame` sets arrival **one block in front** of the frame (player's
   side) so returning never bounce-loops. Existing hub/auto portals + 🏠 remain
   (no one gets stuck). `flintTap`/`aimFrameCell`; `__ezra.flint/findFrame/lightFrame`.
2. **Block fixes.** `blockPreview(tile,size,tint)` now multiplies the tint so the
   **colour blocks show real colours** in the picker (were all grey). **Glass &
   leaves are see-through**: shader `if (tex.a<0.5) discard;` (cutout), atlas
   punches transparent texels (glass = clear pane + frame; leaves = leafy gaps),
   `opaqueAt` returns false for `seethrough` blocks, and the mesher culls faces
   between two of the same see-through block (clean panes).
3. **Math 💎 cap.** Steve has a `MATH_POUCH_MAX=6` pouch that refills +1/30s; a
   correct answer pays `min(reward, pouch)` (reward 1 for count/easy-add, 2 for
   harder), then only lava chicken + praise when empty. `goals.bump('math')` still
   fires so the math goals progress. (14 correct = ~8💎 instead of ~28.)
4. **Slime** springier: bounce threshold −3.5→−2.3 and checks the whole footprint.
   Verified: Node (frame light/reject, see-through opacity) + headless (build→light
   →travel, auto-portal step still works, math cap, colour + glass screenshots) +
   full regression — all green, zero errors. Note: built obsidian frames go to the
   flint worlds (not the Nether — that stays the ⭐ reward with its own portal).

## Status (session 17) — bug-hunt pass (dad: lever? can't see his Mega TNT; a
portal shows an error). Shipped on **`claude/store-portal-bugs-hzcr72`**.
Now **52 block ids**.
1. **💣 Mega TNT is now a real, visible block (the headline fix).** It used to be
   an *invisible* shop upgrade — buying it only widened `explodeRadius()` on
   ordinary TNT, so Ezra "couldn't see his Mega TNT." It's now a proper block:
   new `B.MEGA_TNT` (id 50) with its own angry-red `TILE.MEGA_TNT_SIDE/TOP`
   (fat label, bold "M", spark dots), shown in a new **"Mega 💣"** picker tab
   **gated by the `megatnt` unlock** (same pattern as Rainbow). Buying it now
   reveals the tab, **auto-selects the block**, and toasts how to use it. Lighting
   it (tap, or flint & steel) blows a much bigger crater: `TNT_RADIUS=3.2` vs
   `MEGA_TNT_RADIUS=5.2` (decided per-block in `detonate`, not by a global
   unlock), with a bigger flash + shake. `isTNT(id)` now covers both everywhere
   (tap routing, flint tap, fuse tick, `World.explode` chain). Verified headless:
   buy→tab appears→block selected; mega crater (~44 cleared) ≫ regular (~21);
   chain reaction catches a mega in the middle; save/load round-trips id 50.
2. **Lever — works; made it *obvious* it works.** Logic was fine (toggles
   43↔44, powers wire→lamp, verified). But a lone lever gives almost no visible
   feedback, so it "looked broken." Added a one-time **`tip('redstone', …)`** the
   first time you place any redstone block, explaining: put a Lamp next to a
   Lever (or wire them up), then tap the Lever to switch the light.
3. **Portal "shows an error" — couldn't reproduce, so made it impossible to
   strand him.** Extensively black-box tested every world both ways (debug travel,
   real swirl step-through, flint-built frames, Nether reward, repeated in/out,
   night, TNT-by-portal, 4s render soaks) — **zero errors** in any path. As a
   safety net (and matching the "non-scary, never stuck" rule) `travelTo` is now
   wrapped in try/catch: any hiccup mid-trip is logged to the console for us and
   **pops Ezra safely back home** (`recoverHome`) with a friendly toast — never
   the scary "Oops" screen. Confirmed by forcing an exception mid-travel: lands
   in the overworld, no overlay. **Ask the dad** for the exact "Oops" text / which
   portal next time it happens so we can pin the root cause.
   All verified headless (CDP) + Node logic; full world-hop regression green.

## Status (session 18) — intuitive building (dad: one-block-at-a-time is too
hard for Ezra; he wants whole-wall/whole-floor builds + a roomy house he can
move around in and see). Shipped on **`claude/store-portal-bugs-hzcr72`**.
Now **52 block ids** + sandstone (**53** including SANDSTONE id 51), **sw cache
v4→v5**.
1. **🏗️ Big Builds — one-tap structures (the headline).** New topbar 🏗️ button
   opens a little "Build something big!" menu (`#buildmenu`, mirrors the portal
   menu; reuses `.portal-choice` styling) with three one-tap builds that appear
   a few steps **in front of where you're looking**, no aiming or block-by-block:
   - **🏠 Cozy House** — a roomy 5×5 interior, 4-high ceiling (so the
     third-person camera has room), a **door facing you**, **glass windows** on
     every wall, a **glowstone ceiling lamp**, planks floor/roof. Verified you
     can stand inside and see around.
   - **🟫 Big Floor** / **🧱 Long Wall** — a 7×7 patio / a 7×4 wall of **your
     currently-selected block**.
   Core helpers: `bigSet(x,y,z,id,force)` (force punches a build's own
   door/windows through walls it just placed; **never** overwrites *his* placed
   blocks otherwise), `bigBuildSpot(dist)` (lands in front, center-ground height,
   clamped in-world), `levelPad(cx,cz,rad,g,floor)` (**auto-flattens**: fills
   dips below + clears bumps above so a house sits clean even on a hill).
   `goals.onBuildMany(id,n)` credits every block (a house ≈194 → instant builder
   stars, intentional). One-time `tip('buildkit', …)`.
2. **🏜️ Sandstone block** (`B.SANDSTONE`, `TILE.SANDSTONE`) in the **Stone**
   picker tab — a desert/End-themed building block (down payment on the
   Ender-Dragon/Endermen/desert idea; in MC it's Enderman-proof).
   Verified headless: menu shows House/Floor/Wall; house has door+glass+glow+
   walkable interior and flattens on slopes; floor=+49, wall=+28; Stone tab now
   7 tiles; full world-hop + build-anywhere regression green, zero errors.
   **Open with the dad (asked via AskUserQuestion):** how gentle to make the
   **End / Ender Dragon / Endermen** (friendly pet-dragon vs. a gentle
   beat-the-crystals "boss" vs. hold) — it's a big feature so it's not built yet.
   Also unclear: his **"land with a water bucket in the sand"** remark — needs
   clarifying (likely the existing soft-landing water feature).

## Status (session 19) — The End + a gentle dragon (dad picked the
"gentle adventure-boss" via AskUserQuestion). Shipped on
**`claude/store-portal-bugs-hzcr72`**. Now **53 block ids** (END_STONE id 52),
**13 shop items**, **44 goals**, **sw cache v5→v6 (bump on deploy)**.
1. **🐉 The End world + friendly Ender Dragon (`js/dragon.js`).** A new flint
   world `WORLD_KINDS.end` (dark-indigo sky, `generateEnd()` = a pale END_STONE
   island floating in the void, ringed by **6 obsidian pillars topped with
   glowing magenta End Crystals**). Bought in the 💎 shop (`endworld`, 30💎 — the
   big reward), then lit via flint like Sky World. The **dragon glides in a big
   circle** above the island (harmless, never attacks). **Tap the crystals to pop
   them** (harmless poofs, `goals.bump('crystal')`); once all are gone she's
   **tamed** — **tap her for a celebration + 💎12** (first time only; re-taming
   just says hi, no farming). `Dragon` class mirrors the nethermob pattern
   (`pickRay` → crystal vs. dragon, `popCrystal`, `tame`, `onEvent`/`onTame`).
   Crystal spots persist in the save (`world.crystalSpots` ↔ `cs` in serialize).
   Tap routing checks the dragon first in the End. New goals **Crystal popper**
   (3) + **Dragon tamer** (1). Debug: `__ezra.dragon/popCrystals()/tameDragon()`.
   The dragon was darkened-against-dark-sky at first → lightened her body +
   lifted the End sky a touch so a 6-yr-old can clearly see (and she's friendly,
   not scary).
   Verified headless: buy→travel→6 crystals→early dragon-tap refused→pop all→
   tamed→tame pays +💎 once (not on revisit)→goals tick; 4s render soak + revisit
   + full world-hop all green, zero errors; screenshot of the island/pillars/
   crystals/portal. Tuning candidates: dragon is posed hard to frame in
   third-person (big + circles high); could add wing-flap; Endermen + a desert
   pyramid are the natural next End additions.

## Status (session 20) — one-tap world travel (dad: "how do we see the new
worlds?"). Shipped on **`claude/store-portal-bugs-hzcr72`**, mirrored to `main`.
**sw cache v6→v7.**
- The only way to reach flint worlds was **build an obsidian frame + light it** —
  far too hard for a 6-yr-old (hence the question). Added a **🌍 topbar button →
  "Go to a world!" menu** (`#worldmenu`, reuses `.portal-choice`) that lists every
  world and **travels there instantly on tap** (`travelTo`, the tested path). The
  flint & steel "build your own portal" path still works for the full-Minecraft
  experience. Locked worlds show dimmed with 🔒 + reason: **Nether** = "Earn ⭐4"
  (tapping nudges), **Sky/End** = "Buy in 💎 shop" (tapping opens the shop).
  One-time `tip('worlds', …)`. Verified headless: menu lists over/nether(locked)/
  gold/ant/tnt/sky(locked)/end(locked); tap Gold→travels, Home→back, buy Sky+End→
  they unlock, tap End→travels; zero errors; topbar still fits (right edge 668<
  1024).

## Status (session 21) — 📖 Adventure with friends (dad: engagement via friends
who do challenges *with* him; he picked "adventure story" + "friendship hearts +
gifts" via AskUserQuestion). Shipped on **`claude/store-portal-bugs-hzcr72`**,
mirrored to `main`. **sw cache v7→v8.** Now **45 goals**.
- **A story journey across the worlds, hosted by the character roster as
  friends.** New **📖 topbar button** opens an Adventure dialog: the current
  friend's `charPreview` portrait + name + **friendship hearts**, a short
  **readable blurb**, and one clear **do-it-together task** (tracked from a
  baseline like the villager quests) with a 💡 hint. Finish it → the 📖 button
  gets a **gold ring**; open it and tap **"Yay! What's next?"** to claim 💎,
  earn a friendship heart with that friend, sometimes get a **gift**, and
  advance. `STORY` = 8 chapters (Chris→build a house, Vlad→pet animals [gift
  pet], Cora→plant, Jovi→Gold-World treasure, Steve→math, Cristiano→slime bounce
  [gift sparkle], Hero→night monster [gift crown], Cora→tame the dragon [gift
  rainbow]). Tasks use `mode:'do'` (relative baseline) or `'have'` (absolute,
  for the dragon). A happy **finale** shows all friends. New 'Adventurer' goal
  (`story` counter, 5 chapters). All state persists in the goals save
  (`adv:{i,base}`, `fr:` friendship hearts). `__ezra`: drive via the buttons; the
  loop badges 📖 each frame (`updateAdventureButton`).
  Verified headless: dialog renders portrait+blurb+task; complete→badge→claim
  pays 💎 + heart + gift; all 8 chapters + finale; gifts (pet/sparkle/crown/
  rainbow) unlock; 'storyteller' goal completes; **state survives reload**; zero
  errors. Screenshots of the offer + done states.
  Next steps offered to dad: friends that physically **walk up** in the world
  (not just the 📖 log), build-challenges that **check the real structure**, and
  repeatable per-friend activities to grow hearts further.

## Status (session 22) — friends who walk up + bed + barrier + lantern (dad:
Ezra's enjoying building; wants friends that approach gently, a Minecraft-style
bed and barrier block, more build options). Shipped on
**`claude/store-portal-bugs-hzcr72`**, mirrored to `main`. **sw cache v8→v9.**
Now **56 block ids**, **46 goals**.
1. **🧑‍🤝‍🧑 A friend strolls up (gently).** The current Adventure host now appears
   in the overworld as a walking `Character` (`buddy`/`buddyChar`, skin synced to
   `curChapter().friend`). It idles near home and, on a **long cooldown
   (45–85s)** — or sooner when a chapter is **ready to claim** — ambles over
   (`updateBuddy`: home→approach→leave), says hi with a chime + ⭐/👋, lingers
   ~8–14s, then wanders back. **Never naggy** (no auto-popups; just a friendly
   presence). Tap it → opens the 📖 Adventure. Drawn + shadowed in the overworld;
   re-placed on reset. Debug: `__ezra.buddy/callBuddy()`.
2. **🛏️ Bed** (`B.BED_FOOT`/`B.BED_HEAD`, in the House tab). Placed as a 2-block
   unit lying along the way you face (`placeBed`, ground-supported, both halves
   to `placed`). **Tap to sleep** (`sleepInBed`): night→morning (clears monsters),
   **hearts refill**, and it **sets your 🏠 home here** (`world.spawn` = bed) —
   just like Minecraft. Dig removes both halves. 'Sweet dreams' goal (`sleep`).
3. **✨ Force Field / Barrier** (`B.BARRIER`, Fun tab) — a mostly-see-through but
   **solid** block (`seethrough` cutout: faint cyan border + sparkle), great for
   invisible-ish platforms/walls; monsters can't pass (it's solid). The MC barrier
   with a friendly twist.
4. **🏮 Lantern** (`B.LANTERN`, House tab) — a warm glowing decoration block, more
   building variety.
   Verified headless: picker tabs (House 6, Fun 3); bed sleep flips night→day +
   full hearts + moves home + ticks the goal; barrier places (id 55, see-through
   solid); buddy walks from home to ~2.2 blocks of the player and stops, tap opens
   Adventure; new block ids save/reload; full world-hop (gold/nether/end/over)
   green, zero errors. Screenshot of a friend stood by the player with the bed +
   lantern on a build pad. Tuning candidates: buddy walks straight (no terrain
   pathing — fine on mostly-open ground); barrier icon is faint in the picker (by
   design). Backlog still open: build-challenges that check real structures;
   repeatable per-friend activities; more decor (fences/stairs need sub-cube
   geometry the voxel engine doesn't have yet).

## Status (session 23) — new friends + build challenges that check real builds
(dad: added Ezra's real friends Alex/Chip/Milo/Brexin; "challenges sound great,
pen is yours"). Shipped on **`claude/store-portal-bugs-hzcr72`**, mirrored to
`main`. **sw cache v9→v10.** Roster now **12 characters**.
1. **4 new friends** in `CHARACTERS` (alex/chip/milo/brexin, distinct skins) —
   selectable in the 🙂 picker AND they host adventure chapters + walk up as the
   buddy.
2. **🏗️ Build challenges that detect real structures (the headline).** New
   `task.kind:'build'` chapters where a friend asks for a TOWER / BRIDGE / FLOOR /
   WALL and the game **scans `world.placed`** (`runBuildCheck`: vertical run =
   tower, horizontal run = line/bridge, n×n = floor, w×h plane = wall) to know
   when it's really built — re-checked on place/dig/big-build/travel/open (cached
   in `buildMet`, never per-frame). Tuned so the **🏗️ Big Build** buttons satisfy
   them (Long Wall → tower(4)+wall(6×3); Big Floor → bridge/floor) so a 6-yr-old
   can always complete one. Woven into the STORY (Alex=tower, Chip=bridge,
   Milo=floor, Brexin=wall, +gift sparkle) → now **12 chapters**.
3. **Endless build mode after the story.** Once the finale is acknowledged
   (`goals.adv.fin`), friends keep dropping by with random `BUILD_POOL`
   challenges (`goals.adv.fc`, `makeFreeChallenge`) — repeatable 💎 + friendship
   hearts, hosted by the new friends, so the build loop never ends.
   `activeChapter()` unifies story + free; `advReady()` drives the 📖 badge + the
   buddy "claimable" nudge.
   Verified headless: 12-friend picker; a 4-tall placed column completes Alex's
   tower → claim → advance; jump to finale → ack → endless build challenges
   generate, complete (a floor/tower slab), pay 💎 + heart, and re-roll; all
   persists across reload; zero errors. Screenshots of the roster + a build
   challenge. (Fixed a stale `curChapter` ref in `updateBuddy` found in testing.)
   Tuning candidates: build checks use "have such a structure" semantics, so a
   pre-existing big build can satisfy a challenge instantly (intentional — it
   rewards building); could later diff "new since the ask" if it feels too easy.

## Status (session 24) — big block-variety pass (dad: "variety charms him —
research more Minecraft blocks/elements that surprise him; a lot more block
types"). Shipped on **`claude/store-portal-bugs-hzcr72`**, mirrored to `main`.
**sw cache v10→v11.** Now **83 block ids** (26 new), **77 picker tiles**.
- **Atlas expanded** `perRow 8→16` / `size 128→256` (256 tiles) — everything is
  parameterized off `ATLAS`, so getUV/`at()`/blockPreview all scaled for free.
- **26 recognizable Minecraft-style blocks**, drawn with compact reusable
  texture styles (`metal`/`gem`/`speckle`/`glow`/`soft` helpers in
  `buildAtlasCanvas`): **Shiny 💎** (Iron/Gold/Diamond/Emerald/Lapis/Redstone/
  Coal blocks + Amethyst), **Stone 🪨** (Deepslate/Granite/Andesite/Diorite/
  Quartz/Prismarine), **Nature** (Moss/Mud/Cactus[top+side]/Red &Brown Mushroom),
  **Nether 🔥** (Nether Brick/Magma), **Decor 🪑** (Melon/Hay/Sponge/Sea Lantern
  + Note Block). Picker reorganized into clearer tabs (Stone🪨, Shiny💎, Decor🪑,
  Nether🔥).
- **🎵 Note Block is interactive** — tap it to play a pentatonic note (`sound.note`
  added to audio.js; taps climb the scale so a row makes a tune). One-time
  `tip('note', …)`.
  Verified: ids unique + every category block has a def (Node); headless boot
  with the 256-atlas = zero errors; all 26 new blocks place; picker shows 12 tabs
  / 77 tiles (Shiny 11, Decor 7); place + reload clean. Screenshots of a showcase
  wall + the picker. Tuning candidates: glow blocks (sea lantern/magma) use bright
  textures, not true emissive light (engine bakes light); more waves possible
  (crafting table/furnace/chest need multi-face art; froglight/sculk/copper easy
  to add next).

## Status (session 25) — readability + friend interaction + 🧱 Lego World (dad:
small font/long sentences mean he doesn't read them; friend interaction low; add
a high-value Lego World that costs lots of 💎; Legos should look higher-res).
Shipped on **`claude/store-portal-bugs-hzcr72`**, mirrored to `main`.
**sw cache v11→v12.** Now **95 block ids**, **8 worlds**, **14 shop items**.
1. **Readability pass.** Bumped dialog/toast fonts (`.adv-text` 17→24 bold,
   `.adv-name` 24, `.adv-task` 21, `#quest-msg` 22, `#goaltoast` 20 + wrap) and
   **rewrote every adventure blurb + all `tip()` strings into short, punchy lines**
   (e.g., "Let's build a cozy house! 🏠"). A 6-yr-old can actually read them now.
2. **Friend interaction.** The walking buddy now greets with a clear **"👋 [name]
   is here! Tap me!"** (or "you did it! Tap me! 🎉") on **every** visit, and
   visits a bit more often (first 16–38s, then 35–65s) — still gentle, not naggy.
3. **🧱 Lego World (the big-ticket reward, 50💎).** New flint world
   `WORLD_KINDS.lego` (`generateLego` = a big flat **studded green baseplate** +
   a few sample brick stacks, bright sky). Bought in the 💎 shop (priced high so
   it's real work — diamonds are easy to earn). Unlocks a **"Lego 🧱" picker tab**
   with **12 vivid Lego bricks** (`B.LEGO_*`): drawn from **two neutral tiles**
   (`LEGO_TOP` = 2×2 glossy studs via `ctx.arc`, `LEGO_SIDE` = shiny-rim brick)
   **× a per-colour tint** (new `tinted()` def helper) — so 12 colours cost only
   2 atlas tiles. Reachable via the 🌍 menu / flint; auto-selects a brick on buy.
   Verified headless: fonts 24px + short blurbs; Lego tab hidden→buy→12 bricks;
   travel to Lego (baseplate id 86 under spawn); place bricks; 4s soak; reload +
   world-hop all green, zero errors. Screenshots of the Lego build + the big-text
   dialog. Note on "higher res": the engine is 16px pixel-art atlas-wide, so the
   studs are as crisp as 16px + tint allows (glossy, rounded) — true HD or real
   3-D stud geometry would be an engine-level change (offered as a future step).

## Status (session 25, addendum) — handoff prep for the Lego "Vegas" build
Dad approved turning Lego World into the big fun hub (3-D studs + paid rides +
NPCs + dazzle) but asked to **scope it to its own session**. So this turn added
**`js/legoworld.js`** (an un-imported `LegoPark` skeleton — safe, zero runtime
effect) and the **"NEXT SESSION" spec below**. No behaviour changed; nothing new
shipped to players. Next session: implement per the spec + wire-in checklist.

## Status (session 26) — Lego glow-up + the new Secret World fun park
Dad **changed the plan** (this overrides the "Lego = Vegas" spec below): keep
**Lego World as a clean, high-res *build* world**, and put the "spend 💎 on fun"
hub in a **separate new world he named "Secret World."** He gave full creative
freedom on the rest ("let form what forms") and asked for **a few high-WOW
attractions, not many meh ones.** Shipped on **`claude/dreamy-mccarthy-g6wgjr`**
in two increments (push there; mirror to `main`/live pending the dad's OK).
Now **47 goals**, **sw cache v12→v14**.
1. **🧱 Lego World glow-up (high-res).** The chunk mesher now raises **real 3-D
   studs** — four little bumps on every exposed Lego-brick top (`isLego` ids
   83–94; visual only, never in collision; stud verts guarded separately so a
   dense build can't overflow the Uint16 index range). In **Lego World the block
   picker is a pure Lego palette** (only the 12 bricks show) and you **arrive
   holding a brick**; every other world is unchanged. `generateLego` now lays a
   cheerful **rainbow staircase + brick pyramid** to show off the studs.
2. **🎡 Secret World (`js/secretworld.js`) — a free-to-enter fun park.** New
   `WORLD_KINDS.secret` (festive ring-plaza `generateSecret`, reached via the 🌍
   menu — no purchase, no flint). You **earn 💎 working in the other worlds and
   SPLURGE here** (the dad's "work hard → treat yourself" grip): **rides cost a
   few 💎 (`goals.spend`) and NEVER pay 💎** — the reward is fun + a ⭐. Three
   WOW rides via a `SecretPark` mob-manager (mirrors nethermobs): a **real
   vertically-turning Ferris wheel** (rotateX, rainbow spokes + gondolas with
   **friends riding**), a **hot-air balloon ride** (float up for a view), and a
   **spinning carousel**. Plus **drifting balloons, fireworks (timed particle
   bursts + notes), glowing lamp posts, and roster-friend NPCs** wandering/riding.
   Tap a ride → "Ride for 💎X?" prompt (`#ride`) → pay → a scripted ride that
   drives the player along the attraction (physics paused via the `ride` state in
   the frame loop), then deposits them back safely + a ⭐. Travel/recover always
   ends a ride cleanly. New goals **Fun park!** + **Thrill seeker** (`funride`).
   Debug: `__ezra.funRide(id)/endFunRide()/funRiding()/funpark`, `setView(yaw,pitch)`.
   Deleted the obsolete `js/legoworld.js` scaffold (its "Lego = Vegas" purpose is
   now the Secret World).
   Verified: Node logic (studs geometry + no index overflow + covered-brick has
   no studs; Secret gen + registry + attractions) + headless browser (Lego studs
   ~21.7k verts/chunk + Lego-only picker; Secret World travel, all 3 rides
   start→spend the right 💎→animate→bump the goal→end clean, **refused when
   broke**, fireworks; full world-hop + **save/reload** keeps it all; zero
   errors) with screenshots of the studded rainbow staircase, the Ferris wheel
   with riders, and the carousel. Tuning candidates: fun-park NPCs have no blob
   shadow yet (rides are elevated, so minor); the Ferris wheel faces ±X (full
   from the front, thin edge-on from the side); carousel ride spins fast (fun but
   could ease). Backlog: go-kart ride, bumper cars, a Ferris-wheel that frames
   nicer in third-person, balloon variety.
3. **Crash-proofing hotfix (dad saw a "script error" Oops screen on iPad).** The
   render loop scheduled its next `requestAnimationFrame` only at the *end* of
   `frame()`, so ANY error in a frame froze the game and tripped the global
   handler → the scary full-screen "Oops". Couldn't repro headlessly (SwiftShader
   has loads of GPU/memory headroom; iOS Safari is stricter — likely a transient
   WebGL/render blip surfacing as the generic cross-origin "Script error."). Fixed
   the root fragility: `frame()` now wraps `frameBody()` in try/catch and ALWAYS
   reschedules (one bad frame is logged + skipped, the loop carries on; a ride is
   ended safely). Runtime `window` errors no longer pop the big overlay — they
   `softError()` (console log + one tiny toast), keeping the kid unscared; the
   overlay is reserved for a FATAL `init()` failure. `funpark` update/draw are
   also individually try/caught so the park can never take down the rest of the
   game. Trimmed park NPCs (5→4) as a small iPad-GPU hedge. **sw cache v14→v15.**
   Verified headless: forced frame error + park-draw-throwing-every-frame both
   leave the overlay hidden and the loop running; rides still complete; full
   regression green. (Ask the dad if the Oops is truly gone on the iPad — if a
   *specific* error text still shows in the console we can pin the iOS root cause.)

## (SUPERSEDED in session 26) — old plan: Lego World = the Fun Hub ("Vegas")
**This plan was replaced** (see session 26): Lego World stayed a *build* world
and the fun hub became the separate **Secret World** (`js/secretworld.js`). Kept
below only as historical context.
Dad's brief (approved, build NEXT session — this session only **set up the repo +
this handoff**; nothing below is built yet). He loved the Lego idea and wants it
to become the **most fun world**: a dazzling amusement park you **visit to spend
diamonds on fun**. Scaffold already in place: **`js/legoworld.js`** (a documented,
**un-imported** `LegoPark` skeleton — zero runtime effect until wired).

**Design pillars (keep these exact):**
- 🎰 **It's "Vegas."** Lego World is a *spend-only fun hub*. You can **buy/play
  here but NEVER earn diamonds here.** 💎 are earned by *working* in the other
  worlds (mining, build challenges, math, fishing, goals). The grip the dad named:
  **the feeling of achievement after hard work** — earn elsewhere, splurge here.
- 🏎️ **Paid attractions** (each costs a few 💎 via `goals.spend`): **go-kart
  racing, ice skating, hot-air-balloon rides** (+ maybe Ferris wheel, bumper
  cars). Reward = **fun + a ⭐/trophy/cosmetic, NOT 💎** (so it stays a pure sink).
- ✨ **Dazzle:** drifting balloons, fireworks, lights, music (audio `note`/blips),
  a Ferris wheel turning.
- 🧑‍🤝‍🧑 **Others having fun:** spawn the **friend roster** (Alex/Chip/Milo/Brexin/
  Cora/…) as NPCs skating/karting/riding around (reuse `Character`+`charById`, like
  the `buddy`/NetherMobs patterns). Makes it feel alive and social.
- 🟩 **Higher-res / "better resolution":** implement **real 3-D Lego studs** (the
  dad said yes). Approach: in `World.buildChunkArrays(cx,cz)` (js/world.js ~line
  780), when a `B.LEGO_*` block's TOP face is exposed (air above), also emit **4
  small raised stud boxes** on top (reuse the face-emit loop; respect the Uint16
  guard `base+24>0xffff` — studs add verts, so budget them / consider a separate
  stud mesh pass to avoid overflow on big builds). This is the headline visual.

**Build it in verifiable increments (recommended order):**
1. **3-D studs** for Lego blocks (mesher) — the "wow" resolution bump. Verify a
   Lego build shows bumps; perf OK; no index overflow on a big Lego floor.
2. **Park layout** in `LegoPark.populate()` (or extend `generateLego`): a kart
   **track** (loop of a smooth block, e.g. ICE/quartz), an **ice rink** (B.ICE),
   **balloon pads**, a **Ferris wheel** structure, decorative lights.
3. **Attraction kiosks + pay-to-play:** tap a kiosk (`pickRay` ⟶ `rayHitsSphere`),
   show a kid-friendly **"Ride for 💎X?"** prompt (new dialog, big short text per
   the readability rules), `goals.spend(cost)` (deny politely if short), then run
   the ride animation. New metrics + GOAL_DEFS (`kart`/`skate`/`balloon`), ⭐ only.
4. **Rides themselves** (juicy but simple): go-kart = a fun auto-drive lap around
   the track with the camera following; ice skating = low-friction movement on the
   rink + a trick counter; balloon = ride a balloon up for a view, drift down.
5. **NPC friends having fun** (`LegoPark.npcs`): a few roster `Character`s looping
   the rides/rink. Draw + shadow like the buddy.
6. **Dazzle pass:** fireworks (particle bursts on a timer), turning Ferris wheel,
   balloon drift, a little music.

**Wire-in checklist (so it "just works"):**
- `import { LegoPark } from './legoworld.js'` in main.js.
- In `makeMobs`, add a `'legopark'` entry (the lego kind's `mobs` list) →
  `m.legopark = new LegoPark(gl,w)` with `onPlay` → the pay-prompt; handle it in
  `populateMobs`/`updateMobs`/`drawMobs` (mirror `m.dragon`).
- Add `'legopark'` to `WORLD_KINDS.lego.mobs` (js/worlds.js) — `makeMobs` already
  loops `kind.mobs`.
- Tap routing (main.js ~`tapPending`): add a `legopark.pickRay` check in the
  Lego dimension (before `doAction`), like the dragon.
- New goals in js/goals.js (`kart/skate/balloon/trophy` counters + GOAL_DEFS).
- Bump `sw.js` CACHE (v12→v13) **and add `'js/legoworld.js'` to `CORE`**.
- Keep the rule: **no `goals.addGems` anywhere in Lego World.**

**Constraints / gotchas:**
- World size is a global `SX=64,SY=32,SZ=64` (js/world.js:6). "Much bigger" can't
  be per-world cheaply — options: (a) use the full 64×64 baseplate densely with
  attractions (recommended, no engine change), or (b) a real size refactor (big:
  arrays, minimap MM_SIZE, save format all key off SX/SZ — only if he insists).
- Engine is **16px pixel-art atlas** (256 tiles, lots free). 3-D studs give the
  "higher-res" feel without changing texture resolution.
- Verify with the headless **CDP** harness (browser binary + `__ezra` hooks; see
  "Debug & testing"); add `__ezra` debug hooks (`legoPark()`, `playRide(id)`).
- Currency safety net already exists; just don't grant 💎 here.

**Done-when (acceptance):** travel to Lego World shows 3-D studded bricks + a
park; tapping a kiosk asks to pay 💎 and (if you can afford it) runs a fun ride
that pays a ⭐/trophy but **0 💎**; friends are seen having fun; fireworks/dazzle
play; full world-hop + reload regression green, zero errors; screenshots.

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
- `js/secretworld.js` — the **Secret World fun park** (`SecretPark`, a mob-style
  manager for `WORLD_KINDS.secret`). Box-mesh attractions: a **vertically-turning
  Ferris wheel** (built in the Y-Z plane, spun with `mat4.rotateX`; gondolas drawn
  upright with seated roster-friend NPCs), **drifting balloons**, a **carousel**
  (spun about Y), glowing kiosks, wandering NPC `Character`s, and a fireworks
  timer (`onFirework`). `pickRay` → an attraction; main shows a "Ride for 💎X?"
  prompt, `goals.spend`s, then runs a scripted ride (see `ride`/`updateRide` in
  main.js). **Never grants 💎** — it's a pure diamond *sink*.
- `js/zombies.js` — night-time `Zombies` (built like creepers, but they **chase +
  attack**): spawn around the player at night, bonk a heart on a cooldown
  (`onEvent('hit')`), take two `bonk`s to defeat (`pickRay`), fade out by day.
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
