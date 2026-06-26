// Ezra's Blocks — entry point. Wires the worlds, player, creatures, touch
// controls, UI, rendering, and autosave together. Worlds are data-driven
// (see worlds.js): adding a new place is a recipe, not a rewrite.

import { mat4 } from './math.js';
import { initGL, makeWorldProgram, makeAtlasTexture, GLMesh, blockPreview, shadowMesh, quadMesh, makeSkyProgram, skyQuad } from './gfx.js';
import { World, BLOCKS, CATEGORIES, B, SX, SY, SZ, isLego } from './world.js';
import { WORLD_KINDS, WORLD_ORDER } from './worlds.js';
import { SecretPark, ATTRACTIONS, STANDS } from './secretworld.js';
import { Player } from './player.js';
import { Animals } from './animals.js';
import { Creepers } from './creepers.js';
import { NetherMobs } from './nethermobs.js';
import { Zombies } from './zombies.js';
import { Spiders } from './spiders.js';
import { Skeletons } from './skeletons.js';
import { Villagers } from './villagers.js';
import { Dragon } from './dragon.js';
import { AlienCops } from './aliencops.js';
import { Astronauts } from './astronaut.js';
import { Rover } from './rover.js';
import { DragonMount } from './dragonmount.js';
import { RocketShip } from './rocketship.js';
import { SpaceRace } from './spacerace.js';
import { Controls } from './input.js';
import { Sound } from './audio.js';
import { Character, CHARACTERS, charById, charPreview } from './character.js';
import { Goals, GOAL_DEFS } from './goals.js';

const SAVE_KEY = 'ezrablocks.save.v2';
const NETHER_STARS = 4;                   // stars needed to open the Nether portal
const MAX_HEARTS = 6;                      // base hearts (a shop unlock can add one)
const NIGHT_SKY = [0.05, 0.07, 0.15];     // dark, starry-feeling night

let hearts = MAX_HEARTS;
let maxHearts = MAX_HEARTS;
let heartBuff = 0;                         // temporary bonus hearts (Golden Apple)
let heartBuffT = 0;                        // seconds left on the bonus
const effMax = () => maxHearts + heartBuff; // total hearts right now (base + bonus)
let night = false;                        // night-time toggle (zombies come out)
let nightAmt = 0;                         // eased 0..1 for the day↔night look
let nightAuto = false;                    // is the current night an automatic one?
const AUTO_NIGHT_EVERY = 900;            // ~15 min of play between automatic nights
const AUTO_NIGHT_DURATION = 85;          // how long an auto-night lasts before dawn
let autoNightT = AUTO_NIGHT_EVERY;       // seconds until the next automatic night
let autoNightLeft = 0;                   // seconds left in the current auto-night
let invuln = 0;                           // brief mercy window after taking damage
let hurtFlash = 0;                        // red screen flash timer
let regenT = 0, sinceHurt = 99;           // gentle heart regen when safe
let hurtEl = null;                        // cached red-flash overlay

// The big "Oops" overlay is reserved for a FATAL failure to even start the game
// (see init()'s catch). Everything that happens after start-up is recovered
// gently instead — a 6-year-old should never get a scary full-screen error.
function showError(msg) {
  const el = document.getElementById('error-overlay');
  if (el) {
    el.style.display = 'flex';
    el.querySelector('.msg').textContent = String(msg);
  }
}
// A runtime hiccup (a bad render frame, an odd touch event, an iOS WebGL blip):
// log it for us, keep the game running, and show at most one tiny friendly note.
let _hiccups = 0;
function softError(msg) {
  console.error('recovered runtime error:', msg);
  if (_hiccups++ === 0) { try { showToast('🛠️ Tiny hiccup — all good, keep playing!', 2400); } catch (e) { } }
}
window.addEventListener('error', (e) => softError(e.message || e.error || 'Unknown error'));
window.addEventListener('unhandledrejection', (e) => softError(e.reason && e.reason.message || e.reason || 'Promise error'));

let gl, worldProg, atlas, world, player, controls, sound, character, goals;
let skyProg, skyMesh;    // gradient-sky backdrop
const worlds = {};                       // key -> { world, mobs, kind }; created lazily
const positions = {};                    // key -> remembered player position
let dimension = 'over';                  // active world key
let sky = WORLD_KINDS.over.sky;          // active sky/fog colour
let portalCooldown = 0;                  // brief grace after a swap so you don't bounce back
let minimapDirty = true;                 // redraw the minimap's terrain layer when set
let portalUnlocked = false;              // the Nether portal opens once enough stars are earned
let portalHintTimer = 0;                 // throttle the "earn more stars" nudge
let identity, proj, view, pv, scratch4;
let shadow, mShadow;     // soft blob-shadow mesh + a scratch matrix for it
let buildPreview;        // green footprint quad shown while placing a big build
let selected = B.GRASS;
let selectedChar = 'ezra';     // which character you're playing as
let lastTool = 'build', actionAnim = 0;
let flintMode = false;         // flint & steel tool active (tap to light TNT/portals)
let pendingFrame = null;       // an obsidian frame waiting for a chosen destination
let saveDirty = false, lastSave = 0;
let prevX = 0, prevZ = 0, goalToastTimer = 0;
let shake = 0;            // camera kick from explosions
let trailT = 0;           // throttle for the "Sparkle Trail" shop reward
let riding = null;        // the pony Animal you're currently riding (or null)
let rover = null;         // the Space Rover mesh (created on first space visit)
let roving = false;       // currently driving the rover
let roverSpeedIdx = 0;    // index into ROVER_SPEEDS (0 = parked/off)
let roverT = 0;           // little timer for the rover's bob/wobble
let engineLevel = 0;      // current rover engine-hum level (so we only change it on change)
let dragonMount = null;   // the Ride-On Dragon mesh (created on first ride)
let dragonRiding = false; // currently soaring on the dragon
let dragonT = 0;          // wing-flap timer
let rocketShip = null;    // the rideable Rocket mesh (created on first ride)
let rocketState = 'off';  // 'off' | 'ready' (on pad) | 'countdown' | 'flying'
let rocketCountT = 0;     // launch countdown timer
let rocketT = 0;          // rocket animation timer
let rocketBoost = 0;      // eased 0..1 engine-flame intensity
let rocketKick = 0;       // brief blast-off window that lifts him skyward at launch
let spaceRace = null;     // the glowing-ring race course in Space World
let ride = null;          // an active fun-park ride: { att, t, dur, returnPos }
let resting = null;       // lying on a pillow: { x, y, z, zt } — cozy heart regen
let pendingRide = null;   // a ride waiting on the "Ride for 💎?" prompt
let fishing = null;       // an active cast: { wx, wy, wz, t } while waiting for a bite
let bobberEl = null;      // the on-screen bobber marker
const saplings = [];      // planted saplings growing into trees: { world, x, y, z, t }
let steveChar = null, stevePos = null, steveYaw = 0; // Steve at the Lava Chicken stand
let buddyChar = null, buddy = null;       // the adventure-host friend who strolls up to say hi
let mathQ = null;         // the current math question
const MATH_POUCH_MAX = 6; // Steve only has so many 💎 to give before he runs out…
let mathPouch = MATH_POUCH_MAX, mathRefillT = 0;  // …it refills slowly over time
const fuses = [];         // lit TNT awaiting detonation: { x, y, z, t }
const canvas = document.getElementById('game');

// Third-person follow camera.
let camYaw = 0, camPitch = 0.42;
const CAM_LOOK = 0.005;
// "Switch view" zoom: wide overview (default) → mid → zoomed-in close.
// View presets cycled by the 🔍 button: wide, close, far (zoomed out to navigate),
// and a top-down map view. `pitch:null` keeps your current look angle.
const VIEW_PRESETS = [
  { dist: 7.0, pitch: null, icon: '🔍' },   // wide (default)
  { dist: 4.5, pitch: null, icon: '🔎' },   // close up
  { dist: 11.0, pitch: null, icon: '🔭' },  // far — see more around you
  { dist: 13.0, pitch: 1.12, icon: '🗺️' },  // top-down map view (great for finding your way)
];
let zoomIndex = 0;             // which preset; remembered between sessions
let camDist = VIEW_PRESETS[0].dist;  // target follow distance
let camDistEased = camDist;    // smoothed toward camDist for a gentle zoom
const REACH = 16;              // how far a build/dig tap can reach from the camera
const camPos = [0, 0, 0], camDir = [0, 0, -1], camTarget = [0, 0, 0];

function refreshSpawn(w) { w.spawn[1] = w.heightAt(Math.floor(w.spawn[0]), Math.floor(w.spawn[2])) + 2; }
function mobs() { return worlds[dimension].mobs; }

// --- Creatures: each world has its own set, chosen by its recipe ---
function makeMobs(kind, w) {
  const m = {};
  for (const t of kind.mobs) {
    if (t === 'animals') m.animals = new Animals(gl, w);
    else if (t === 'creepers') {
      m.creepers = new Creepers(gl, w);
      m.creepers.onEvent = (type) => { if (type === 'uhoh') sound.play('uhoh'); else if (type === 'chip') saveDirty = true; };
    } else if (t === 'nethermobs') {
      m.nethermobs = new NetherMobs(gl, w);
      m.nethermobs.onMeet = (species, pos) => { sound.play('coo'); spawnHearts(pos); goals.bump(species); };
    } else if (t === 'ants') {
      m.ants = new Animals(gl, w, ['ant']);
    } else if (t === 'zombies') {
      m.zombies = new Zombies(gl, w);
      m.zombies.onEvent = (type, pos) => {
        if (type === 'hit') hurt(1);
        else if (type === 'groan') sound.play('groan');
      };
    } else if (t === 'spiders') {
      m.spiders = new Spiders(gl, w);
      m.spiders.onEvent = (type, pos) => {
        if (type === 'hit') hurt(0.5);          // spiders only nibble a half-heart
        else if (type === 'hiss') sound.play('hiss');
        else if (type === 'web') {              // a sticky web briefly slows you (no damage)
          player.webT = 1.6; sound.play('hiss');
          spawnParticles(pos, '🕸️', 'puff', 1, 14);
          tip('web', '🕸️ Spider web! A bit slow for a sec — keep going!');
        }
      };
    } else if (t === 'skeletons') {
      m.skeletons = new Skeletons(gl, w);
      m.skeletons.onEvent = (type, pos) => {
        if (type === 'hit') hurt(0.5);
        else if (type === 'shoot') { hurt(0.5); sound.play('bow'); spawnParticles([player.pos[0], player.pos[1] + 1.0, player.pos[2]], '🏹', 'puff', 1, 12); }
        else if (type === 'rattle') sound.play('rattle');
      };
    } else if (t === 'villagers') {
      m.villagers = new Villagers(gl, w);
    } else if (t === 'astronaut') {
      m.astronaut = new Astronauts(gl, w);
    } else if (t === 'funpark') {
      m.funpark = new SecretPark(gl, w);
      m.funpark.onFirework = (pos) => { spawnParticles(pos, ['🎆', '🎇', '✨'][Math.floor(Math.random() * 3)], 'puff', 5, 80); sound.note(Math.floor(Math.random() * 5)); };
      m.funpark.onApproachTicket = () => { if (!ride) openRideMenu(); };   // walk up to the booth → ride menu
    } else if (t === 'aliencops') {
      m.aliencops = new AlienCops(gl, w);
      m.aliencops.onSiren = (pos) => {
        sound.play('uhoh');
        spawnParticles([pos[0], pos[1] + 0.6, pos[2]], '🚨', 'puff', 2, 40);
        showToast('👽🚨 Space cop: "Whoa — slow down! Space speed limit!"', 3000);
        if (roving && roverSpeedIdx >= 3) setRoverSpeed(2);   // ease off the gas (no harm)
      };
    } else if (t === 'dragon') {
      m.dragon = new Dragon(gl, w);
      m.dragon.onEvent = (type, pos) => {
        if (type === 'crystal') { sound.play('poof'); spawnSparkles(pos); }
        else if (type === 'tamed') { sound.play('coo'); showToast('✨ The crystals are gone! Tap the dragon to make friends! 🐉', 4200); }
      };
      m.dragon.onTame = () => {
        const first = !goals.done['dragontamer'];   // big 💎 reward only the first time
        goals.bump('dragon');
        if (first) { goals.addGems(12); updateGems(); }
        sound.play('portal');
        const p = m.dragon.dragon ? m.dragon.dragon.pos : player.pos;
        spawnParticles([p[0], p[1], p[2]], '🎉', 'puff', 12, 90);
        spawnHearts([p[0], p[1], p[2]]);
        showToast(first ? '🐉🎉 You tamed the friendly dragon! +💎12 — you\'re a hero!' : '🐉💜 The dragon is happy to see you again!', 5000);
      };
    }
  }
  return m;
}
function populateMobs(m) {
  if (m.animals) m.animals.spawn(10);
  if (m.ants) m.ants.spawn(14);
  if (m.villagers) m.villagers.spawn(2);
  if (m.astronaut) m.astronaut.spawn();
  if (m.funpark) m.funpark.populate();
  if (m.nethermobs) m.nethermobs.populate(SX, SZ);
  if (m.aliencops) m.aliencops.populate(2);
  if (m.dragon) m.dragon.populate();
  // creepers spawn lazily (paced) during update — no initial spawn
}
function updateMobs(m, dt) {
  if (m.animals) m.animals.update(dt, player);
  if (m.creepers) m.creepers.update(dt, player, goals.stars);
  if (m.nethermobs) m.nethermobs.update(dt, player, SX, SZ);
  if (m.ants) m.ants.update(dt, player);
  if (m.zombies) m.zombies.update(dt, player, night && dimension === 'over');
  if (m.spiders) m.spiders.update(dt, player, night && dimension === 'over');
  if (m.skeletons) m.skeletons.update(dt, player, night && dimension === 'over');
  if (m.villagers) m.villagers.update(dt, player);
  if (m.astronaut) m.astronaut.update(dt, player);
  if (m.funpark) { try { m.funpark.update(dt, player); } catch (e) { softError(e); } }
  if (m.aliencops) m.aliencops.update(dt, player, roving, roverSpeedIdx);
  if (m.dragon) m.dragon.update(dt, player);
}
function drawMobs(m) {
  if (m.animals) m.animals.draw(worldProg);
  if (m.creepers) m.creepers.draw(worldProg);
  if (m.nethermobs) m.nethermobs.draw(worldProg);
  if (m.ants) m.ants.draw(worldProg);
  if (m.zombies) m.zombies.draw(worldProg);
  if (m.spiders) m.spiders.draw(worldProg);
  if (m.skeletons) m.skeletons.draw(worldProg);
  if (m.villagers) m.villagers.draw(worldProg);
  if (m.astronaut) m.astronaut.draw(worldProg);
  if (m.funpark) { try { m.funpark.draw(worldProg); } catch (e) { softError(e); } }
  if (m.aliencops) { try { m.aliencops.draw(worldProg); } catch (e) { softError(e); } }
  if (m.dragon) m.dragon.draw(worldProg);
}

// Soft blob shadows under every creature (and the player) so nothing looks like
// it's just floating — grounds the whole cast in the world. A blended pass
// drawn between the terrain and the characters.
function shadowAt(x, z, diam) {
  const gy = world.heightAt(Math.floor(x), Math.floor(z));
  if (gy < 0) return;
  mat4.model(mShadow, x, gy + 1.02, z, 0, diam, 1, diam);
  gl.uniformMatrix4fv(worldProg.u.uModel, false, mShadow);
  shadow.draw(worldProg);
}
function drawShadows(m) {
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);
  gl.uniform1f(worldProg.u.uAlpha, 0.26);
  if (dragonRiding) shadowAt(player.pos[0], player.pos[2], 2.0);   // the dragon's big shadow below
  else if (rocketState !== 'off') shadowAt(player.pos[0], player.pos[2], 1.6);
  else if (roving) shadowAt(player.pos[0], player.pos[2], 1.5);    // the rover's footprint
  else if (resting) shadowAt(player.pos[0], player.pos[2], 1.4);   // lying down spreads the shadow
  else if (!riding) shadowAt(player.pos[0], player.pos[2], 0.9);
  if (stevePos && dimension === 'over') shadowAt(stevePos[0], stevePos[2], 0.9);
  if (buddy && dimension === 'over') shadowAt(buddy.pos[0], buddy.pos[2], 0.85);
  const groups = [
    [m.animals, (a) => a.isPony ? 1.7 : (a.isPet ? 0.8 : 1.0)],
    [m.creepers, () => 1.0],
    [m.zombies, () => 0.9],
    [m.spiders, () => 1.1],
    [m.skeletons, () => 0.9],
    [m.ants, () => 0.55],
    [m.villagers, () => 0.85],
    [m.astronaut, () => 0.85],
    [m.nethermobs, (a) => a.species === 'ghast' ? 1.7 : 1.0],
    [m.aliencops, () => 1.3],
  ];
  for (const [grp, diamf] of groups) {
    if (!grp) continue;
    for (const a of grp.list) { if (a.state === 'poof') continue; shadowAt(a.pos[0], a.pos[2], diamf(a)); }
  }
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  gl.uniform1f(worldProg.u.uAlpha, 1);
}

// --- Worlds: created on first visit, then cached ---
function registerDim(key, w) {
  refreshSpawn(w);
  const kind = WORLD_KINDS[key];
  const m = makeMobs(kind, w);
  worlds[key] = { world: w, mobs: m, kind };
  populateMobs(m);
  ensurePortalsFor(key);
  placePuzzleFixture(w);                  // a discoverable 🧩 puzzle cube near spawn (every world)
  placeCraftFixture(w);                   // a 🛠️ crafting table near spawn (every stone world)
  if (key === 'over') { w.carveCavesIfNone(); w.carveVaultIfNone(); }  // caves + the Deep Vault for older saves (build-safe)
  else if (w.findVault) w.findVault();    // locate the relic in any world that has one
  w.sprinkleOre();                        // seed coal/iron/deep treasure to mine (new worlds + older saves)
  w.computeLight();                       // bake skylight + torch/glow block light before meshing
  w.rebuildAll();
  w.updateRedstone();                    // light any saved lamps wired to on-levers
  scanSaplings(w);                        // resume growing any saved saplings
  if (!positions[key]) positions[key] = w.spawn.slice();
  return worlds[key];
}
function ensureDim(key) {
  if (worlds[key]) return worlds[key];
  const w = new World(gl);
  w[WORLD_KINDS[key].gen]();
  return registerDim(key, w);
}

// Home gets the (earned) Nether portal; every away world gets an always-open
// obsidian portal back home — Ezra can never get stuck.
function portalCoordsFor(key) {
  const w = worlds[key].world, kind = WORLD_KINDS[key];
  if (key === 'over') return [Math.min(SX - 5, Math.floor(w.spawn[0]) + 4), Math.min(SZ - 3, Math.floor(w.spawn[2]) + 8), kind.ground];
  return [Math.min(SX - 5, Math.max(1, Math.floor(w.spawn[0]) - 1)), Math.min(SZ - 3, Math.floor(w.spawn[2]) + 2), kind.ground];
}
function ensurePortalsFor(key) {
  const w = worlds[key].world;
  const dest = (key === 'over') ? 'nether' : 'over';
  if (w.portals.some((p) => p.dest === dest)) return;
  const [ox, oz, ground] = portalCoordsFor(key);
  w.addPortal(ox, oz, ground, dest, key === 'over' ? portalUnlocked : true);
}

function setDimension(key) {
  dimension = key;
  world = worlds[key].world;
  if (!player) player = new Player(world); else player.world = world;
  sky = WORLD_KINDS[key].sky;
  player.gravityScale = WORLD_KINDS[key].lowGrav ? 0.36 : 1;   // float + bounce sky-high in Space World
  if (key !== 'space' && roving) stopRover();                  // the rover stays in Space World
  if (key !== 'space' && rocketState !== 'off') stopRocket(false); // the rocket flies in Space World
  updateRoverButton();
  updateRocketButton();
  updateQuestButton();           // the 📜 Great Quest is an overworld journey
  minimapDirty = true;
}

// Travel through a gateway to another world, arriving at the matching portal.
function travelTo(dest) {
  if (!WORLD_KINDS[dest]) return;
  try {
    if (fishing) reelIn();               // reel in before leaving
    if (riding) dismount();                   // the pony stays home in the overworld
    if (dragonRiding) dismountDragon();       // land the dragon before traveling
    if (rocketState !== 'off') stopRocket(false);   // park the rocket before traveling
    if (ride) { const fp = mobs().funpark; if (fp) { fp.rideKind = null; fp.rideBalloon = null; } ride = null; } // end any ride safely
    if (resting) getUp();                      // hop off the pillow before traveling
    if (pendingBuild) cancelPlacement();      // cancel a half-placed big build
    fuses.length = 0;                         // cancel any fuses lit in the world we're leaving
    positions[dimension] = player.pos.slice();
    const from = dimension;
    ensureDim(dest);
    setDimension(dest);
    const match = world.portals.find((p) => p.dest === from) || world.portals[0];
    const a = match ? match.a : world.spawn;
    player.pos = [a[0], a[1] + 0.3, a[2]];
    player.vel = [0, 0, 0];
    camYaw = player.yaw;
    portalCooldown = 1.3;
    saveDirty = true;
    sound.play('portal');
    if (dest === 'nether') goals.bump('nether'); // first trip completes "Find the portal"
    goals.bump('travel');
    recheckBuild();                           // build challenges check the world you're now in
    if (dest === 'lego' && !isLego(selected)) selected = B.LEGO_RED; // arrive holding a Lego brick
    buildPicker(); refreshBlocksButton();     // Lego World shows a Lego-only palette
    if (dest === 'secret') tip('tickets', '🎟️ Walk up to the Ticket booth to pick a ride! There\'s a Popcorn stand and Gift Shop too. 🍿🛍️');
    if (dest === 'space') { goals.bump('space'); startSpaceRace(); tip('space', '🚀 Welcome to Space! Say hi to Captain Nova 🧑‍🚀 for a mission. Jump to bounce sky-high! 🌟'); }
  } catch (e) {
    // A portal should never strand Ezra on the scary "Oops" screen. If anything
    // goes wrong mid-trip, log it for us and pop him safely back home instead.
    console.error('travelTo failed', dest, e);
    try { recoverHome(); } catch (e2) { console.error('recoverHome failed', e2); }
    showToast('🏠 Whoops — the portal hiccuped, so I brought you home safe!', 3600);
  }
}

// Safety net: get the player back to a known-good spot in the overworld.
function recoverHome() {
  if (dragonRiding) dismountDragon();
  if (rocketState !== 'off') stopRocket(false);
  if (ride) { const fp = mobs().funpark; if (fp) { fp.rideKind = null; fp.rideBalloon = null; } ride = null; }
  resting = null;
  ensureDim('over');
  setDimension('over');
  player.world = world;
  player.goHome();
  player.vel = [0, 0, 0];
  portalCooldown = 1.3;
  camYaw = player.yaw;
  positions.over = player.pos.slice();
  minimapDirty = true; saveDirty = true;
}

// Flint & steel portals line up in a tidy row right by home, one slot per
// destination — so they never stack behind each other and are easy to find.
const HUB_DESTS = ['gold', 'ant', 'tnt', 'sky', 'end', 'lego'];
function placeHubPortal(W, kind, dest) {
  const slot = Math.max(0, HUB_DESTS.indexOf(dest));
  const sp = W.spawn;
  const ox = Math.max(1, Math.min(SX - 5, Math.floor(sp[0]) - 9 + slot * 6));
  const oz = Math.max(1, Math.min(SZ - 3, Math.floor(sp[2]) - 6));
  return W.addPortal(ox, oz, kind.ground, dest, true);
}
function lightPortal(dest) {
  if (!WORLD_KINDS[dest]) return;
  let p = world.portals.find((q) => q.dest === dest);   // one portal per destination
  if (p) world.setPortalActive(p, true);
  else if (HUB_DESTS.includes(dest)) p = placeHubPortal(world, WORLD_KINDS[dimension], dest);
  else p = world.addPortal(Math.min(SX - 5, Math.floor(world.spawn[0]) - 2), Math.max(1, Math.floor(world.spawn[2]) - 6), WORLD_KINDS[dimension].ground, dest, true);
  minimapDirty = true; saveDirty = true;
  portalCooldown = 0.8;
  sound.play('portal');
  showToast('🌀 ' + WORLD_KINDS[dest].emoji + ' Portal to ' + WORLD_KINDS[dest].name + ' is ready by your home — tap 🏠, then walk in!', 4000);
}

// --- Flint & steel (Minecraft-style): build an obsidian frame, then light it ---
function updateFlintButton() {
  const b = document.getElementById('btn-flint');
  if (b) b.classList.toggle('on', flintMode);
}
// March the aim ray and return the interior cells of the first obsidian frame
// the player is looking through (or null).
function aimFrameCell(dir) {
  for (let t = 0.5; t < REACH; t += 0.25) {
    const bx = Math.floor(camPos[0] + dir[0] * t), by = Math.floor(camPos[1] + dir[1] * t), bz = Math.floor(camPos[2] + dir[2] * t);
    const id = world.get(bx, by, bz);
    if (id === B.AIR) { const cells = world.findFrame(bx, by, bz); if (cells) return cells; }
    else if (id !== B.OBSIDIAN) break;     // hit a solid that isn't frame → stop
  }
  return null;
}
// After picking a destination for a freshly-tapped frame, light it.
function lightChosenFrame(dest) {
  if (!pendingFrame || !WORLD_KINDS[dest]) { pendingFrame = null; return; }
  const cells = pendingFrame; pendingFrame = null;
  const portal = world.lightFrame(cells, dest);
  // Arrival = standing one block IN FRONT of the frame (the side you lit it from),
  // not inside the swirl — so returning here never bounce-loops.
  const swirl = portal.a.slice();
  const sameZ = cells.every((c) => c[2] === cells[0][2]);
  if (sameZ) { const fz = cells[0][2], side = player.pos[2] >= fz ? 1 : -1; portal.a = [swirl[0], swirl[1], fz + 0.5 + side]; }
  else { const fx = cells[0][0], side = player.pos[0] >= fx ? 1 : -1; portal.a = [fx + 0.5 + side, swirl[1], swirl[2]]; }
  minimapDirty = true; saveDirty = true; portalCooldown = 0.6;
  sound.play('portal'); spawnParticles(swirl, '🔥', 'puff', 4, 30);
  showToast('🔥✨ Portal lit! Walk into the swirl to visit ' + WORLD_KINDS[dest].emoji + ' ' + WORLD_KINDS[dest].name + '!', 4200);
}
// Flint tap: light TNT, or light an obsidian frame you're aiming through.
function flintTap(dir) {
  const hit = world.raycast(camPos, dir, REACH);
  if (hit && isTNT(world.get(hit.block[0], hit.block[1], hit.block[2]))) { lightTNT(hit.block[0], hit.block[1], hit.block[2]); return; }
  const cells = aimFrameCell(dir);
  if (cells) { pendingFrame = cells; openPortalMenu(); }
  else showToast('🔥 Build an obsidian doorway (a closed frame), then tap inside it to light a portal!', 3600);
}

// Re-lay any flint portals in a world into the tidy row (cleans up older saves
// where they were dropped on top of each other). Never touches builds — only
// clears the old obsidian/swirl blocks and rebuilds the frames in a neat line.
function tidyPortals(key) {
  const W = worlds[key].world, kind = WORLD_KINDS[key];
  const dests = [...new Set(W.portals.filter((p) => HUB_DESTS.includes(p.dest)).map((p) => p.dest))];
  if (!dests.length) return;
  for (const p of W.portals) {
    if (!HUB_DESTS.includes(p.dest)) continue;
    const [ox, oy, oz] = p.f;
    for (let dx = 0; dx <= 3; dx++) for (let dy = 0; dy <= 4; dy++) {
      const id = W.get(ox + dx, oy + dy, oz);
      if (id === B.OBSIDIAN || id === B.PORTAL) W.set(ox + dx, oy + dy, oz, B.AIR);
    }
  }
  W.portals = W.portals.filter((p) => !HUB_DESTS.includes(p.dest));
  for (const dest of dests) placeHubPortal(W, kind, dest);
}

// Rebuild the always-there home/Nether gateway with the new flush, walk-straight-
// in geometry, so older saves stop showing a "floating" sill-and-swirl portal.
function regroundHome(key) {
  const W = worlds[key].world, kind = WORLD_KINDS[key];
  const dest = (key === 'over') ? 'nether' : 'over';
  const p = W.portals.find((q) => q.dest === dest);
  if (!p) return;
  const [ox, oy, oz] = p.f;
  const wasActive = p.active;
  for (let dx = 0; dx <= 3; dx++) for (let dy = 0; dy <= 4; dy++) {
    const id = W.get(ox + dx, oy + dy, oz);
    if (id === B.OBSIDIAN || id === B.PORTAL) W.set(ox + dx, oy + dy, oz, B.AIR);
  }
  W.portals = W.portals.filter((q) => q !== p);
  W.addPortal(ox, oz, kind.ground, dest, wasActive);
}

// The Nether portal is a reward: it opens once enough goal-stars are earned.
function maybeUnlockNether(silent) {
  if (portalUnlocked || goals.stars < NETHER_STARS) return;
  portalUnlocked = true;
  const ov = worlds.over && worlds.over.world;
  const op = ov && ov.portals.find((p) => p.dest === 'nether');
  if (ov && op) ov.setPortalActive(op, true);
  minimapDirty = true;
  saveDirty = true;
  if (!silent) {
    setTimeout(() => { showToast('✨ The Nether portal opened! Find the 🌀 on your map! ✨', 4200); sound.play('portal'); }, 1300);
  }
}

// --- Camera (third-person, follows the character) ---
function applyLook() {
  camYaw += controls.lookDX * CAM_LOOK;
  camPitch += controls.lookDY * CAM_LOOK;
  camPitch = Math.max(-0.1, Math.min(1.25, camPitch));
  controls.lookDX = 0; controls.lookDY = 0;
}

function cameraFollow(dt) {
  // Ease the camera behind the character only while moving forward (so backing
  // up doesn't whip the camera around). Skipped while dragging to look.
  if (controls.lookPtr === null && player.movingForward) {
    let d = player.yaw - camYaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    camYaw += d * Math.min(1, dt * 2.5);
  }
}

function computeCamera() {
  const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
  camDir[0] = -Math.sin(camYaw) * cp;
  camDir[1] = -sp;
  camDir[2] = -Math.cos(camYaw) * cp;
  camTarget[0] = player.pos[0];
  camTarget[1] = player.pos[1] + 1.35;
  camTarget[2] = player.pos[2];
  // Pull the camera in if there's terrain behind the character.
  let dist = camDistEased;
  for (let t = 0.4; t <= camDistEased; t += 0.3) {
    const x = camTarget[0] - camDir[0] * t, y = camTarget[1] - camDir[1] * t, z = camTarget[2] - camDir[2] * t;
    if (world.solidAt(Math.floor(x), Math.floor(y), Math.floor(z))) { dist = Math.max(2.4, t - 0.3); break; }
  }
  camPos[0] = camTarget[0] - camDir[0] * dist;
  camPos[1] = camTarget[1] - camDir[1] * dist;
  camPos[2] = camTarget[2] - camDir[2] * dist;
  if (shake > 0.001) {
    camPos[0] += (Math.random() - 0.5) * shake;
    camPos[1] += (Math.random() - 0.5) * shake;
    camPos[2] += (Math.random() - 0.5) * shake;
  }
  mat4.lookAt(view, camPos, camTarget, [0, 1, 0]);
}

// --- Aiming: cast a ray from the camera through a screen point ---
function screenRay(sx, sy) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const ndcx = (sx / w) * 2 - 1, ndcy = 1 - (sy / h) * 2;
  const tanH = Math.tan(1.05 / 2), aspect = w / h;
  const f = camDir;
  let rx = -f[2], rz = f[0];
  const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;          // right (y=0)
  const ux = -rz * f[1], uy = rz * f[0] - rx * f[2], uz = rx * f[1]; // up = right × f
  let dx = rx * (ndcx * tanH * aspect) + ux * (ndcy * tanH) + f[0];
  let dy = uy * (ndcy * tanH) + f[1];
  let dz = rz * (ndcx * tanH * aspect) + uz * (ndcy * tanH) + f[2];
  const dl = Math.hypot(dx, dy, dz) || 1;
  return [dx / dl, dy / dl, dz / dl];
}
function rayHitAt(sx, sy) { return world.raycast(camPos, screenRay(sx, sy), REACH); }
// Does a ray pass within radius r of a point? (used to tap Steve at his stand)
function rayHitsSphere(o, d, cx, cy, cz, r) {
  const ax = cx - o[0], ay = cy - o[1], az = cz - o[2];
  const tca = ax * d[0] + ay * d[1] + az * d[2];
  if (tca < 0) return false;
  return (ax * ax + ay * ay + az * az - tca * tca) <= r * r;
}
function targetCells() { return rayHitAt(canvas.clientWidth / 2, canvas.clientHeight / 2); }

function overlapsPlayer(x, y, z) {
  const px0 = Math.floor(player.pos[0] - 0.28), px1 = Math.floor(player.pos[0] + 0.28);
  const pz0 = Math.floor(player.pos[2] - 0.28), pz1 = Math.floor(player.pos[2] + 0.28);
  const py0 = Math.floor(player.pos[1]), py1 = Math.floor(player.pos[1] + 1.7 - 0.001);
  return x >= px0 && x <= px1 && y >= py0 && y <= py1 && z >= pz0 && z <= pz1;
}

function doBuild(hit) {
  if (!hit) return;
  if (selected === B.DOOR) { placeDoor(hit); return; }
  if (selected === B.BED_FOOT) { placeBed(hit); return; }
  const [x, y, z] = hit.place;
  if (x < 0 || x >= SX || y < 0 || y >= SY || z < 0 || z >= SZ) return;
  if (world.get(x, y, z) !== B.AIR || overlapsPlayer(x, y, z)) { sound.play('deny'); return; }
  world.set(x, y, z, selected);
  // Water + nature plants aren't "your house" — keep creepers off them.
  if (selected !== B.WATER && selected !== B.SAPLING) world.placed.add(world.idx(x, y, z));
  sound.play('place'); saveDirty = true; actionAnim = 1; minimapDirty = true;
  goals.onBuild(selected);
  if (selected === B.TORCH) { goals.bump('torch'); tip('torchplaced', '🔦 Nice! Torches glow even at night. Light up your caves and rooms!'); }
  if (isRedstone(selected)) {
    world.updateRedstone();   // a new wire/lamp may light up
    tip('redstone', '⚙️ Put a Lamp next to a Lever, then tap the Lever!');
  }
  recheckBuild();             // did this block finish a build challenge?
  if (selected === B.SAPLING) { saplings.push({ world, x, y, z, t: 14 + Math.random() * 14 }); goals.bump('plant'); }
}

// Planted saplings sprout into full trees after a little while.
function growSaplings(dt) {
  for (let i = saplings.length - 1; i >= 0; i--) {
    const s = saplings[i];
    s.t -= dt;
    if (s.t > 0) continue;
    saplings.splice(i, 1);
    if (s.world.get(s.x, s.y, s.z) !== B.SAPLING) continue;   // dug up before it grew
    s.world.set(s.x, s.y, s.z, B.AIR);
    s.world.placeTree(s.x, s.y, s.z, Math.random);
    for (const [dx, dz] of [[0, 0], [2, 2], [-2, -2], [2, -2], [-2, 2]]) s.world.markDirty(s.x + dx, s.z + dz);
    saveDirty = true;
    if (s.world === world) { sound.play('place'); spawnSparkles([s.x + 0.5, s.y + 1.2, s.z + 0.5]); minimapDirty = true; }
  }
}
// On load, find any saplings saved in a world and give them a fresh grow timer.
function scanSaplings(w) {
  for (let i = 0; i < w.data.length; i++) {
    if (w.data[i] !== B.SAPLING) continue;
    const x = i % SX, y = Math.floor(i / (SX * SZ)), z = Math.floor(i / SX) % SZ;
    saplings.push({ world: w, x, y, z, t: 10 + Math.random() * 14 });
  }
}

function doDig(hit) {
  if (!hit) return;
  const [x, y, z] = hit.block;
  const id = world.get(x, y, z);
  if (id === B.AIR || (BLOCKS[id] && BLOCKS[id].indestructible)) { sound.play('deny'); return; }
  if (id === B.RELIC) { claimVault(); return; }                       // the prize: tap to claim, never dig away
  if (world.isPortalBlock(x, y, z)) { sound.play('deny'); return; }   // portals can't be broken
  if (isDoor(id)) { removeDoor(x, y, z); return; }
  if (isBed(id)) { removeBed(x, y, z); return; }
  const key = world.idx(x, y, z);
  const wasPlaced = world.placed.has(key);
  // Break-time: natural rock/ore takes a few "chips" to break, and a better
  // pickaxe chips harder — so tools FEEL more powerful. Soft blocks (dirt/sand/
  // wood) and anything YOU placed break in one tap, so creative stays snappy.
  const need = wasPlaced ? 0 : blockHardness(id);
  if (need > 0) {
    if (!breaking || breaking.key !== key) breaking = { key, progress: 0 };
    breaking.progress += pickPower();
    if (breaking.progress < need) {                 // chipped, not broken yet — tap again
      sound.play('dig'); actionAnim = 1;
      spawnParticles([x + 0.5, y + 0.5, z + 0.5], '⛏️', 'puff', 1, 22);
      return;
    }
    breaking = null;                                // this tap broke through
  }
  world.set(x, y, z, B.AIR);
  world.placed.delete(key);
  sound.play('dig'); saveDirty = true; actionAnim = 1; minimapDirty = true;
  goals.onDig();
  if (isRedstone(id)) world.updateRedstone();   // removing wire can switch lamps off
  recheckBuild();
  // Buried treasure! Natural gold/diamond the player dug up (not their own block).
  if (!wasPlaced && (id === B.GOLD || id === B.DIAMOND)) {
    goals.bump('treasure'); sound.play('treasure'); spawnSparkles([x + 0.5, y + 0.6, z + 0.5]);
    if (id === B.DIAMOND) { goals.bump('diamond'); goals.addGems(2); } else goals.addGems(1);
    updateGems();
  }
  // Space crystals: mine a natural glowing crystal on the moon for a 💎.
  if (!wasPlaced && id === B.CRYSTAL_ORE) {
    goals.bump('spacegem'); sound.play('treasure'); spawnSparkles([x + 0.5, y + 0.6, z + 0.5]);
    goals.addGems(1); updateGems();
    tip('spacegem', '🔷 Space crystals are treasure! Dig them for 💎. Drive around to find more!');
  }
  collectFromDig(id, wasPlaced, [x + 0.5, y + 0.6, z + 0.5]);
}

// --- ⛏️ The earn-your-tools loop: mining NATURAL blocks gives crafting
// materials, and a better pickaxe unlocks collecting better ones, so effort
// compounds (wood → stone+coal → iron → diamond). Purely additive: nothing gets
// harder, and YOUR placed blocks are never "mined" — creative building stays free.
// Break-time: how many "chips" a natural rock/ore needs, and how hard each
// pickaxe tier chips. Tuned so the pickaxe that UNLOCKS a block breaks it in ~1
// tap (snappy), while a weaker tool takes a few more (a nudge to upgrade), and
// the diamond pickaxe shatters everything instantly (the power-fantasy reward).
let breaking = null;                          // { key, progress } for the block being chipped
const PICK_POWER = [1, 2, 3, 5, 8];           // bare, wood, stone, iron, diamond
function pickPower() { return PICK_POWER[goals.pickTier()] || 1; }
let HARDNESS = null;
function blockHardness(id) {
  if (!HARDNESS) HARDNESS = { [B.STONE]: 2, [B.COBBLE]: 2, [B.COAL_ORE]: 2, [B.IRON_ORE]: 3, [B.GOLD]: 4, [B.DIAMOND]: 4, [B.DEEPSLATE]: 3 };
  return HARDNESS[id] || 0;                    // 0 = instant (soft natural blocks)
}
let pickNudgeT = -1e9;
function pickNudge(msg) {
  if (performance.now() - pickNudgeT < 12000) return;   // a gentle reminder, never spammy
  pickNudgeT = performance.now();
  sound.play('deny'); showToast(msg, 3200);
}
function collectFromDig(id, wasPlaced, pos) {
  if (wasPlaced) return;                                  // only untouched, natural blocks are "mined"
  const tier = goals.pickTier();
  if (id === B.LOG || id === B.BIRCH_LOG) {               // wood: bare hands are fine
    goals.addItem('wood'); gotMaterial('wood', pos);
    tip('craft', '🪵 You got Wood! Tap the 🛠️ crafting table to make a Pickaxe — then you can mine stone, coal & iron!');
  } else if (id === B.COAL_ORE) {
    if (tier >= 1) { goals.addItem('coal'); gotMaterial('coal', pos); }
    else pickNudge('⛏️ Coal! Make a Wooden Pickaxe at the 🛠️ table to dig it up.');
  } else if (id === B.STONE || id === B.COBBLE) {
    if (tier >= 1) { goals.addItem('stone'); gotMaterial('stone', pos); }
    else pickNudge('⛏️ Make a Wooden Pickaxe at the 🛠️ table to collect stone! (Chop a tree for 🪵 wood first.)');
  } else if (id === B.IRON_ORE) {
    if (tier >= 2) { goals.addItem('iron'); gotMaterial('iron', pos); }
    else pickNudge('⚙️ Iron! Make a Stone Pickaxe at the 🛠️ table to mine it.');
  }
}
function gotMaterial(k, pos) {
  if (pos) spawnParticles(pos, ITEM_ICON[k], 'puff', 1, 30);
  updateInventory(k);
}

// --- Redstone: a lever powers wire, which lights up lamps ---
function isRedstone(id) { return id === B.LEVER || id === B.LEVER_ON || id === B.REDSTONE || id === B.REDLAMP || id === B.REDLAMP_ON; }
function toggleLever(x, y, z) {
  const id = world.get(x, y, z);
  world.set(x, y, z, id === B.LEVER_ON ? B.LEVER : B.LEVER_ON);
  sound.play('door');                       // a satisfying click
  const lit = world.updateRedstone();
  saveDirty = true; minimapDirty = true;
  goals.bump('lever');
  if (lit > 0) goals.bump('lamp');
}

// --- Note block: tap it to play a musical note (taps climb the scale, so a row
// of note blocks makes a little tune — just like the Minecraft videos) ---
let noteStep = 0;
function playNoteBlock(x, y, z) {
  sound.note(noteStep++);
  spawnParticles([x + 0.5, y + 1.1, z + 0.5], '🎵', 'heart', 1, 14);
  tip('note', '🎵 Tap it for a note! A row makes a song!');
}

// --- Doors: a 2-tall openable door for house-building ---
function isDoor(id) { return id === B.DOOR || id === B.DOOR_OPEN; }
function doorBase(x, y, z) { return isDoor(world.get(x, y - 1, z)) ? y - 1 : y; }
function placeDoor(hit) {
  const [x, y, z] = hit.place;
  if (x < 0 || x >= SX || y < 0 || y + 1 >= SY || z < 0 || z >= SZ) { sound.play('deny'); return; }
  if (world.get(x, y, z) !== B.AIR || world.get(x, y + 1, z) !== B.AIR ||
    overlapsPlayer(x, y, z) || overlapsPlayer(x, y + 1, z)) { sound.play('deny'); return; }
  world.set(x, y, z, B.DOOR); world.set(x, y + 1, z, B.DOOR);
  world.placed.add(world.idx(x, y, z)); world.placed.add(world.idx(x, y + 1, z));
  sound.play('door'); saveDirty = true; actionAnim = 1; minimapDirty = true;
  goals.onBuild(B.DOOR);
  goals.bump('doors');
}
function toggleDoor(x, y, z) {
  const by = doorBase(x, y, z);
  const nb = world.get(x, by, z) === B.DOOR_OPEN ? B.DOOR : B.DOOR_OPEN;
  world.set(x, by, z, nb);
  if (isDoor(world.get(x, by + 1, z))) world.set(x, by + 1, z, nb);
  sound.play('door'); saveDirty = true;
}
function removeDoor(x, y, z) {
  const by = doorBase(x, y, z);
  for (const yy of [by, by + 1]) if (isDoor(world.get(x, yy, z))) { world.set(x, yy, z, B.AIR); world.placed.delete(world.idx(x, yy, z)); }
  sound.play('dig'); saveDirty = true; actionAnim = 1; minimapDirty = true; goals.onDig();
}

// --- Bed: place it (foot + head, lying along the way you face), tap to sleep ---
// (turns night → morning, fills hearts, and sets your 🏠 home right here).
function isBed(id) { return id === B.BED_FOOT || id === B.BED_HEAD; }
function bedDir() {
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  return Math.abs(fx) >= Math.abs(fz) ? [fx >= 0 ? 1 : -1, 0] : [0, fz >= 0 ? 1 : -1];
}
function placeBed(hit) {
  const [x, y, z] = hit.place;
  const [dx, dz] = bedDir();
  const hx = x + dx, hz = z + dz;
  const ok = (a, b, c) => a >= 0 && a < SX && b >= 0 && b < SZ && y >= 1 && y < SY;
  if (!ok(x, y, z) || !ok(hx, y, hz)) { sound.play('deny'); return; }
  if (world.get(x, y, z) !== B.AIR || world.get(hx, y, hz) !== B.AIR ||
    world.get(x, y - 1, z) === B.AIR || world.get(hx, y - 1, hz) === B.AIR ||
    overlapsPlayer(x, y, z) || overlapsPlayer(hx, y, hz)) { sound.play('deny'); return; }
  world.set(x, y, z, B.BED_FOOT); world.set(hx, y, hz, B.BED_HEAD);
  world.placed.add(world.idx(x, y, z)); world.placed.add(world.idx(hx, y, hz));
  sound.play('door'); saveDirty = true; actionAnim = 1; minimapDirty = true;
  goals.onBuild(B.BED_FOOT);
  tip('bed', '🛏️ Tap to lie down! You can nap, sleep through the night, and it sets your home.');
}
// Tapping a bed now LAYS Ezra down on it (like Minecraft) — he visibly rests,
// hearts refill, and it sets home. At night, lying down also sleeps the night
// away to a safe morning. Reuses the pillow `resting` system; tap/move to get up.
function sleepInBed(x, y, z) {
  if (resting || ride || riding || dragonRiding || rocketState !== 'off' || roving) return;
  if (pendingBuild) cancelPlacement();
  // Orient + center along the two bed halves so he lies neatly along the bed.
  let mx = x + 0.5, mz = z + 0.5, yaw = player.yaw;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (isBed(world.get(x + dx, y, z + dz))) { mx = x + 0.5 + dx * 0.5; mz = z + 0.5 + dz * 0.5; yaw = Math.atan2(-dx, -dz); break; }
  }
  resting = { x, y, z, zt: 0, bed: true };
  player.flying = false; player.vel = [0, 0, 0];
  player.pos = [mx, y + 1, mz]; player.yaw = yaw;
  world.spawn = [x + 0.5, y, z + 0.5];     // beds set your home, just like Minecraft
  sound.play('coo');
  spawnParticles([x + 0.5, y + 1.4, z + 0.5], '💤', 'heart', 3, 22);
  goals.bump('sleep');
  if (night || nightAuto) {                // lying down at night sleeps it away to morning
    night = false; nightAuto = false; autoNightT = AUTO_NIGHT_EVERY; updateNightButton();
    const om = worlds.over && worlds.over.mobs;
    if (om) { if (om.zombies) om.zombies.list.length = 0; if (om.spiders) om.spiders.list.length = 0; if (om.skeletons) om.skeletons.list.length = 0; }
    hearts = effMax(); updateHearts();
    showToast('💤 …Zzz… ☀️ Good morning! Hearts full, home set here. Tap to get up.', 3400);
  } else {
    hearts = effMax(); updateHearts();
    showToast('🛌 Cozy! Resting in your bed — home set here. Tap or move to get up.', 2800);
  }
  saveDirty = true; minimapDirty = true;
}
function removeBed(x, y, z) {
  world.set(x, y, z, B.AIR); world.placed.delete(world.idx(x, y, z));
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (isBed(world.get(x + dx, y, z + dz))) { world.set(x + dx, y, z + dz, B.AIR); world.placed.delete(world.idx(x + dx, y, z + dz)); break; }
  }
  sound.play('dig'); saveDirty = true; actionAnim = 1; minimapDirty = true; goals.onDig();
}

// --- Pillows: tap one to lie down for a cozy rest (gentle heart regen). Tap
// again, move, or press Up to get back up. No night-skip — just a comfy nap. ---
function lieDown(x, y, z) {
  if (resting || ride || riding || dragonRiding || rocketState !== 'off' || roving) return;
  if (pendingBuild) cancelPlacement();
  resting = { x, y, z, zt: 0 };
  player.flying = false; player.vel = [0, 0, 0];
  player.pos = [x + 0.5, y + 1, z + 0.5];     // rest on top of the cushion
  sound.play('coo');
  spawnParticles([x + 0.5, y + 1.6, z + 0.5], '💤', 'heart', 2, 18);
  tip('pillow', '🛌 Nighty-night! Resting fills your hearts. Tap or move to get up.');
}
function getUp() {
  if (!resting) return;
  resting = null;
  sound.play('jump');
}

// --- Big Builds: one-tap structures so building isn't a one-block-at-a-time
// chore for a 6-year-old. Each appears a few steps in front of where you're
// looking, sits on the ground, and only fills empty space / natural terrain —
// it never overwrites blocks you placed yourself. ---
const sgn = (v) => (v >= 0 ? 1 : -1);
// Pick a sensible solid material for floors/walls (fall back to brick for
// passable picks like water, or the special door).
function solidSelected() {
  const def = BLOCKS[selected];
  if (!def || def.passable || selected === B.DOOR) return B.BRICK;
  return selected;
}
// Place one block of a big build. By default it skips your own placed blocks
// (so a stamp can never wreck an existing creation) and tallies/owns each new
// solid block. `force` carves through even placed blocks — used for a structure
// to punch its own door/windows through the walls it just put up.
function bigSet(x, y, z, id, force) {
  if (x < 1 || x >= SX - 1 || y < 1 || y >= SY - 1 || z < 1 || z >= SZ - 1) return 0;
  const k = world.idx(x, y, z);
  if (!force && world.placed.has(k)) return 0;     // never touch his own builds
  world.set(x, y, z, id);
  if (id === B.AIR) { world.placed.delete(k); return 0; }
  world.placed.add(k);
  return 1;
}
// Where a big build lands: a few steps in front, level with the ground right
// where you're standing (the door threshold), plus the facing axis.
function bigBuildSpot(dist, rad = 3) {
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  const m = rad + 1;
  const cx = Math.max(m, Math.min(SX - 1 - m, Math.round(player.pos[0] + fx * dist)));
  const cz = Math.max(m, Math.min(SZ - 1 - m, Math.round(player.pos[2] + fz * dist)));
  const g = Math.max(1, world.heightAt(cx, cz));
  return { cx, cz, g, fx, fz, horiz: Math.abs(fx) >= Math.abs(fz) };
}
// Make a clean, level pad at height g across the footprint: fill any dips below
// so it never floats, and clear anything above (hills poking through) — without
// ever disturbing blocks he placed himself.
function levelPad(cx, cz, rad, g, floorId) {
  let n = 0;
  for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
    const x = cx + dx, z = cz + dz;
    for (let yy = g + 1; yy <= g + 6; yy++) bigSet(x, yy, z, B.AIR);                 // clear bumps above
    for (let yy = g - 1; yy > 0 && world.get(x, yy, z) === B.AIR; yy--) bigSet(x, yy, z, B.DIRT, true); // fill dips below
    n += bigSet(x, g, z, floorId, true);                                            // the level floor
  }
  return n;
}
function finishBigBuild(n, cx, cy, cz, label) {
  world.flushDirty(40);
  goals.onBuildMany(selected, n);
  saveDirty = true; minimapDirty = true; actionAnim = 1;
  sound.play('place');
  spawnSparkles([cx + 0.5, cy + 1.5, cz + 0.5]);
  showToast(label, 2800);
  recheckBuild();             // a big build may complete a build challenge
}
// A room with 4 walls you can walk around inside — a door facing you, windows,
// a floor and roof, and a ceiling lamp. `rad` sets the size (3 = cozy, 4 = big).
function roomAt(s, rad, wall) {
  const { cx, cz, g, fx, fz, horiz } = s;
  const y0 = g + 1, H = 4;
  let n = levelPad(cx, cz, rad, g, B.PLANKS);
  for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
    n += bigSet(cx + dx, y0 + H, cz + dz, B.PLANKS);                  // roof
    const edge = (Math.abs(dx) === rad || Math.abs(dz) === rad);
    for (let dy = 0; dy < H; dy++) {
      if (edge) n += bigSet(cx + dx, y0 + dy, cz + dz, wall);          // walls
      else bigSet(cx + dx, y0 + dy, cz + dz, B.AIR);                   // open inside
    }
  }
  for (let t = -1; t <= 1; t++) {                                      // windows on each wall
    bigSet(cx + t, y0 + 2, cz - rad, B.GLASS, true); bigSet(cx + t, y0 + 2, cz + rad, B.GLASS, true);
    bigSet(cx - rad, y0 + 2, cz + t, B.GLASS, true); bigSet(cx + rad, y0 + 2, cz + t, B.GLASS, true);
  }
  const dX = horiz ? cx - rad * sgn(fx) : cx, dZ = horiz ? cz : cz - rad * sgn(fz);
  bigSet(dX, y0, dZ, B.DOOR, true); bigSet(dX, y0 + 1, dZ, B.DOOR, true); bigSet(dX, y0 + 2, dZ, B.GLASS, true);
  goals.bump('doors');
  bigSet(cx, y0 + H - 1, cz, B.GLOWSTONE, true);                       // cozy ceiling lamp
  finishBigBuild(n, cx, y0, cz, '🏠 Your house is ready — walk in the door!');
}
function buildHouse(s) { roomAt(s, 3, solidSelected()); }
function buildBigHouse(s) { roomAt(s, 4, solidSelected()); }
// A tall tower with a door, windows up the sides, and a crenellated top.
function buildTower(s) {
  const { cx, cz, g, fx, fz, horiz } = s, wall = solidSelected(), r = 1, H = 9;
  let n = levelPad(cx, cz, r, g, B.STONE_BRICK);
  for (let dy = 1; dy <= H; dy++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    const edge = Math.abs(dx) === r || Math.abs(dz) === r;
    if (edge) n += bigSet(cx + dx, g + dy, cz + dz, wall); else bigSet(cx + dx, g + dy, cz + dz, B.AIR);
  }
  const dX = horiz ? cx - r * sgn(fx) : cx, dZ = horiz ? cz : cz - r * sgn(fz);
  bigSet(dX, g + 1, dZ, B.DOOR, true); bigSet(dX, g + 2, dZ, B.DOOR, true);
  for (let dy = 3; dy <= H - 1; dy += 2) { bigSet(cx + r, g + dy, cz, B.GLASS, true); bigSet(cx - r, g + dy, cz, B.GLASS, true); bigSet(cx, g + dy, cz + r, B.GLASS, true); bigSet(cx, g + dy, cz - r, B.GLASS, true); }
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if ((dx + dz) % 2 === 0) n += bigSet(cx + dx, g + H + 1, cz + dz, wall);
  bigSet(cx, g + H, cz, B.GLOWSTONE, true);
  finishBigBuild(n, cx, g + H, cz, '🗼 A tall tower!');
}
// A castle: high walls with crenellations, four corner towers, and a gateway.
function buildCastle(s) {
  const { cx, cz, g, fx, fz, horiz } = s, wall = B.STONE_BRICK, r = 5, H = 4;
  let n = levelPad(cx, cz, r, g, B.STONE);
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    if (Math.abs(dx) === r || Math.abs(dz) === r) {
      for (let dy = 1; dy <= H; dy++) n += bigSet(cx + dx, g + dy, cz + dz, wall);
      if ((dx + dz) % 2 === 0) n += bigSet(cx + dx, g + H + 1, cz + dz, wall);      // crenellations
    }
  }
  for (const ox of [-r, r]) for (const oz of [-r, r]) { for (let dy = 1; dy <= H + 3; dy++) n += bigSet(cx + ox, g + dy, cz + oz, wall); bigSet(cx + ox, g + H + 3, cz + oz, B.GLOWSTONE, true); }
  // Gateway: a 2-wide, 2-tall opening in the wall facing you.
  for (let t = -1; t <= 0; t++) for (let dy = 1; dy <= 2; dy++) {
    if (horiz) bigSet(cx - r * sgn(fx), g + dy, cz + t, B.AIR, true);
    else bigSet(cx + t, g + dy, cz - r * sgn(fz), B.AIR, true);
  }
  finishBigBuild(n, cx, g + H, cz, '🏰 A mighty castle!');
}
// A stepped pyramid of sandstone.
function buildPyramid(s) {
  const { cx, cz, g } = s; let n = 0;
  for (let layer = 0; layer <= 4; layer++) { const r = 4 - layer; for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) n += bigSet(cx + dx, g + 1 + layer, cz + dz, B.SANDSTONE); }
  finishBigBuild(n, cx, g + 5, cz, '🔺 A pyramid!');
}
// A long bridge/walkway of your chosen block, with glass railings.
function buildBridge(s) {
  const { cx, cz, g, fx, fz, horiz } = s, id = solidSelected(); let n = 0; const L = 9;
  for (let i = 0; i < L; i++) for (let w = -1; w <= 1; w++) {
    const x = horiz ? cx + sgn(fx) * i : cx + w, z = horiz ? cz + w : cz + sgn(fz) * i;
    n += bigSet(x, g, z, id);
    if (Math.abs(w) === 1) bigSet(x, g + 1, z, B.GLASS);
  }
  finishBigBuild(n, cx, g, cz, '🌉 A bridge!');
}
// A big flat floor / a long wall of your chosen block.
function stampFloor(s) { const { cx, cz, g } = s; finishBigBuild(levelPad(cx, cz, 3, g, solidSelected()), cx, g, cz, '🟫 A whole floor, done!'); }
function stampWall(s) {
  const { cx, cz, g, horiz } = s, id = solidSelected(); let n = 0;
  for (let i = -3; i <= 3; i++) for (let dy = 1; dy <= 4; dy++) n += horiz ? bigSet(cx, g + dy, cz + i, id) : bigSet(cx + i, g + dy, cz, id);
  finishBigBuild(n, cx, g + 2, cz, '🧱 A whole wall, done!');
}
// A space rocket: a metal launch pad + a hollow tube body with a window, a nose
// cone, fins, and glowing plasma engines. Walk in the door and look up!
function buildRocket(s) {
  const { cx, cz, g, fx, fz, horiz } = s, r = 1, H = 6;
  let n = levelPad(cx, cz, 2, g, B.SPACE_METAL);          // a 5×5 metal launch pad
  const y0 = g + 1;
  for (let dy = 0; dy < H; dy++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    const edge = Math.abs(dx) === r || Math.abs(dz) === r;
    if (edge) n += bigSet(cx + dx, y0 + dy, cz + dz, B.SPACE_METAL); else bigSet(cx + dx, y0 + dy, cz + dz, B.AIR);
  }
  for (const [dx, dz] of [[0, -r], [0, r], [-r, 0], [r, 0]]) bigSet(cx + dx, y0 + 3, cz + dz, B.GLASS, true);  // window band
  for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) n += bigSet(cx + dx, y0 + H, cz + dz, B.SPACE_METAL); // nose
  n += bigSet(cx, y0 + H + 1, cz, B.PLASMA);              // glowing tip
  for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) { n += bigSet(cx + dx, y0, cz + dz, B.METEOR); n += bigSet(cx + dx, y0 + 1, cz + dz, B.METEOR); } // fins
  for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) bigSet(cx + dx, g, cz + dz, B.PLASMA, true);  // engine glow
  const dX = horiz ? cx - r * sgn(fx) : cx, dZ = horiz ? cz : cz - r * sgn(fz);
  bigSet(dX, y0, dZ, B.DOOR, true); bigSet(dX, y0 + 1, dZ, B.DOOR, true);
  goals.bump('doors');
  finishBigBuild(n, cx, y0 + H, cz, '🚀 A rocket ship! Walk in the door!');
}
// A moon-base dome: a metal silo wall with a glass dome roof, a door, and lights.
function buildDome(s) {
  const { cx, cz, g, fx, fz, horiz } = s, R = 3, WH = 2;
  let n = levelPad(cx, cz, R, g, B.SPACE_METAL);
  const y0 = g + 1;
  for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > R - 0.5 && d <= R + 0.45) { for (let dy = 0; dy < WH; dy++) n += bigSet(cx + dx, y0 + dy, cz + dz, B.SPACE_METAL); }
    else if (d < R - 0.5) { for (let dy = 0; dy < WH + R; dy++) bigSet(cx + dx, y0 + dy, cz + dz, B.AIR); }
  }
  for (let dx = -R; dx <= R; dx++) for (let dy = 0; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) {
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > R - 0.55 && d <= R + 0.45) n += bigSet(cx + dx, y0 + WH + dy, cz + dz, B.GLASS);
  }
  const dX = horiz ? cx - R * sgn(fx) : cx, dZ = horiz ? cz : cz - R * sgn(fz);
  bigSet(dX, y0, dZ, B.DOOR, true); bigSet(dX, y0 + 1, dZ, B.DOOR, true);
  goals.bump('doors');
  bigSet(cx, y0 + WH + R - 1, cz, B.PLASMA, true);        // glowing core in the dome
  bigSet(cx, y0, cz, B.SEA_LANTERN, true);                // floor light
  finishBigBuild(n, cx, y0 + WH + R, cz, '🛖 A moon-base dome! Walk inside!');
}

const BIG_BUILDS = [
  { emoji: '🏠', name: 'House', rad: 3, dist: 5, fn: buildHouse, hint: 'A room with 4 walls + a door' },
  { emoji: '🏡', name: 'Big House', rad: 4, dist: 6, fn: buildBigHouse, hint: 'A bigger room to play in' },
  { emoji: '🗼', name: 'Tower', rad: 1, dist: 4, fn: buildTower, hint: 'A tall tower with windows' },
  { emoji: '🏰', name: 'Castle', rad: 5, dist: 7, fn: buildCastle, hint: 'Walls + corner towers' },
  { emoji: '🔺', name: 'Pyramid', rad: 4, dist: 6, fn: buildPyramid, hint: 'A sandstone pyramid' },
  { emoji: '🚀', name: 'Rocket', rad: 2, dist: 5, fn: buildRocket, hint: 'A space rocket with fins!' },
  { emoji: '🛖', name: 'Moon Base', rad: 3, dist: 6, fn: buildDome, hint: 'A dome base with a glass roof' },
  { emoji: '🌉', name: 'Bridge', rad: 1, dist: 3, fn: buildBridge, hint: 'A long walkway — pick a block!' },
  { emoji: '🟫', name: 'Big Floor', rad: 3, dist: 5, fn: stampFloor, hint: 'A big floor — pick a block!' },
  { emoji: '🧱', name: 'Long Wall', rad: 3, dist: 4, fn: stampWall, hint: 'A whole wall — pick a block!' },
];
function buildBuildMenu() {
  const body = document.getElementById('buildmenu-body');
  body.innerHTML = '';
  for (const b of BIG_BUILDS) {
    const btn = document.createElement('button');
    btn.className = 'portal-choice';
    btn.innerHTML = '<span class="pe">' + b.emoji + '</span><b>' + b.name + '</b><small>' + b.hint + '</small>';
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); closeBuildMenu(); startPlacement(b); });
    body.appendChild(btn);
  }
}
function openBuildMenu() { buildBuildMenu(); document.getElementById('buildmenu').classList.remove('hidden'); }
function closeBuildMenu() { document.getElementById('buildmenu').classList.add('hidden'); }

// --- Walk-and-confirm placement: pick a structure, a green outline shows where
// it will go (you move it by walking/turning), then tap "Build here!" ---
let pendingBuild = null;
function startPlacement(b) {
  pendingBuild = b;
  document.getElementById('place-label').textContent = b.emoji + ' Walk where you want your ' + b.name + ', then tap Build!';
  document.getElementById('placebar').classList.remove('hidden');
  tip('place', '🟦 The blue square shows where it goes — walk around to move it, then tap ✅ Build here!');
}
function confirmPlacement() {
  if (!pendingBuild) return;
  const b = pendingBuild; cancelPlacement();
  b.fn(bigBuildSpot(b.dist, b.rad));
}
function cancelPlacement() { pendingBuild = null; document.getElementById('placebar').classList.add('hidden'); }
function drawBuildPreview() {
  if (!pendingBuild) return;
  const s = bigBuildSpot(pendingBuild.dist, pendingBuild.rad), size = pendingBuild.rad * 2 + 1;
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
  gl.uniform1f(worldProg.u.uAlpha, 0.5 + 0.22 * Math.sin(performance.now() / 200));
  mat4.model(mShadow, s.cx + 0.5, s.g + 1.05, s.cz + 0.5, 0, size, 1, size);
  gl.uniformMatrix4fv(worldProg.u.uModel, false, mShadow);
  buildPreview.draw(worldProg);
  gl.uniform1f(worldProg.u.uAlpha, 1); gl.depthMask(true); gl.disable(gl.BLEND);
}

// --- TNT: place it, tap to light it, then BOOM (it chain-reacts) ---
// Mega TNT (the 💎-shop block) behaves the same but blows a much bigger crater.
function isTNT(id) { return id === B.TNT || id === B.MEGA_TNT; }
function lightTNT(x, y, z) {
  if (!isTNT(world.get(x, y, z))) return;
  if (fuses.some((f) => f.x === x && f.y === y && f.z === z)) return;
  fuses.push({ x, y, z, t: 1.1 });
  sound.play('fuse');
  spawnParticles([x + 0.5, y + 1.0, z + 0.5], '🧨', 'puff', 1, 6);
}
function detonate(x, y, z) {
  const mega = world.get(x, y, z) === B.MEGA_TNT;
  world.set(x, y, z, B.AIR);
  world.placed.delete(world.idx(x, y, z));
  const chain = world.explode(x + 0.5, y + 0.5, z + 0.5, mega ? MEGA_TNT_RADIUS : TNT_RADIUS);
  sound.play('boom');
  spawnBoom([x + 0.5, y + 0.6, z + 0.5]);
  if (mega) spawnParticles([x + 0.5, y + 0.8, z + 0.5], '💥', 'puff', 9, 110);  // an extra-big flash
  shake = Math.min(0.9, shake + (mega ? 0.75 : 0.5));
  saveDirty = true; minimapDirty = true;
  goals.bump('boom');
  // gentle knockback away from the blast — a thrill, never harmful
  const dx = player.pos[0] - (x + 0.5), dy = player.pos[1] - (y + 0.5), dz = player.pos[2] - (z + 0.5);
  const d = Math.hypot(dx, dy, dz);
  if (d < 5.5) {
    const k = (1 - d / 5.5) * 9, inv = 1 / (d || 1);
    player.vel[0] += dx * inv * k; player.vel[2] += dz * inv * k;
    player.vel[1] += 4 + (1 - d / 5.5) * 3;
  }
  for (const [cx, cy, cz] of chain) if (!fuses.some((f) => f.x === cx && f.y === cy && f.z === cz)) fuses.push({ x: cx, y: cy, z: cz, t: 0.12 + Math.random() * 0.12 });
}

function doPet() {
  // Pet the nearest friendly creature in whichever world you're in.
  const m = mobs();
  const p = (m.animals && m.animals.petNearest(player)) ||
    (m.nethermobs && m.nethermobs.petNearest(player)) ||
    (m.ants && m.ants.petNearest(player));
  if (p) { sound.play('pet'); spawnHearts(p); goals.onPet(); }
}

// The Build/Dig buttons pick the "tool"; a quick tap on the world acts there.
function doAction(hit) { if (lastTool === 'dig') doDig(hit); else doBuild(hit); }
function setTool(t) {
  lastTool = t;
  const bb = document.getElementById('btn-build'), bd = document.getElementById('btn-dig');
  if (bb) bb.classList.toggle('active', t === 'build');
  if (bd) bd.classList.toggle('active', t === 'dig');
  syncHeldTool();                 // hold the pickaxe while digging, the sword otherwise
}

// --- Floating particles (hearts when petting, puffs when bonking a creeper) ---
function spawnParticles(worldPos, text, cls, n, spread) {
  if (!pv) return;
  mat4.transformPoint(scratch4, pv, worldPos[0], worldPos[1], worldPos[2]);
  if (scratch4[3] <= 0) return;
  const sx = (scratch4[0] / scratch4[3] * 0.5 + 0.5) * canvas.clientWidth;
  const sy = (1 - (scratch4[1] / scratch4[3] * 0.5 + 0.5)) * canvas.clientHeight;
  const layer = document.getElementById('hearts');
  for (let i = 0; i < n; i++) {
    const h = document.createElement('div');
    h.className = cls;
    h.textContent = text;
    h.style.left = (sx + (Math.random() - 0.5) * spread) + 'px';
    h.style.top = (sy + (Math.random() - 0.5) * spread * 0.5) + 'px';
    h.style.animationDelay = (i * 0.06) + 's';
    h.addEventListener('animationend', () => h.remove());
    layer.appendChild(h);
  }
}
function spawnHearts(worldPos) { spawnParticles(worldPos, '💗', 'heart', 4, 40); }
function spawnPuffs(worldPos) { spawnParticles(worldPos, '💨', 'puff', 6, 60); }
function spawnSparkles(worldPos) { spawnParticles(worldPos, '✨', 'puff', 7, 56); }
function spawnSplash(worldPos) { spawnParticles([worldPos[0], worldPos[1] + 0.3, worldPos[2]], '💦', 'puff', 7, 60); }
function spawnBoom(worldPos) { spawnParticles(worldPos, '💥', 'puff', 9, 72); }

// The End: tap a glowing crystal to pop it; once they're all gone, tap the
// dragon to tame her. (All harmless — pure adventure, never any danger.)
function doDragonTap(dg) {
  const dr = mobs().dragon;
  if (!dr) return;
  if (dg.kind === 'crystal') { dr.popCrystal(dg.c); goals.bump('crystal'); saveDirty = true; }
  else if (dg.kind === 'dragon') {
    if (!dr.tame()) {
      if (!dr.tamed) showToast('🐉 Pop the glowing crystals on the pillars first to tame her!', 3400);
    } else saveDirty = true;
  }
}
// Tap a creeper to defend: it poofs harmlessly, your blocks pop back, +a star.
function doDefend(cr) {
  const cz = mobs().creepers;
  if (!cz) return;
  const head = cz.defend(cr);
  sound.play('poof');
  spawnPuffs(head);
  goals.onDefend();
  saveDirty = true;
}

// Tap a zombie to bonk it (two bonks defeats it → a harmless poof).
function doBonkZombie(z) {
  const zb = mobs().zombies;
  if (!zb) return;
  const defeated = zb.bonk(z, swordDamage());
  sound.play(defeated ? 'poof' : 'dig');
  spawnPuffs([z.pos[0], z.pos[1] + 1.0, z.pos[2]]);
  if (defeated) { goals.bump('zombie'); goals.bump('monster'); }
}

// Tap a spider to shoo it (two taps, or one with the sword → harmless poof).
function doBonkSpider(s) {
  const sp = mobs().spiders;
  if (!sp) return;
  const defeated = sp.bonk(s, swordDamage());
  sound.play(defeated ? 'poof' : 'dig');
  spawnPuffs([s.pos[0], s.pos[1] + 0.5, s.pos[2]]);
  if (defeated) { goals.bump('spider'); goals.bump('monster'); }
}

// Tap a skeleton to bonk it — tougher (4 taps, or 2 with the sword), but it pays
// out extra 💎 when defeated.
function doBonkSkeleton(s) {
  const sk = mobs().skeletons;
  if (!sk) return;
  const defeated = sk.bonk(s, swordDamage());
  sound.play(defeated ? 'poof' : 'dig');
  spawnPuffs([s.pos[0], s.pos[1] + 1.0, s.pos[2]]);
  if (defeated) {
    goals.bump('skeleton'); goals.bump('monster');
    goals.addGems(3); updateGems();
    showToast('💀 Skeleton defeated! +💎3');
  }
}

// --- Hearts: getting hurt, a gentle knock-out, slow regen ---
function updateHearts() {
  const el = document.getElementById('hearts-bar');
  if (!el) return;
  // Render each heart as full / half / empty so damage can land in half-hearts.
  // Bonus (Golden Apple) hearts beyond the normal max show as golden 💛.
  let html = '';
  for (let i = 1; i <= effMax(); i++) {
    const cls = hearts >= i ? 'hf' : (hearts >= i - 0.5 ? 'hh' : 'he');
    const buff = i > maxHearts ? ' hb' : '';
    html += '<span class="hs ' + cls + buff + '"></span>';
  }
  el.innerHTML = html;
}
function updateGems() {
  const el = document.getElementById('gem-bar');
  if (el) el.textContent = '💎 ' + (goals ? goals.gems : 0);
}
function applyUnlocks() {
  maxHearts = MAX_HEARTS + (goals.hasUnlock('heart') ? 1 : 0);
  if (hearts > effMax()) hearts = effMax();
  if (player) {
    player.speedMul = goals.hasUnlock('boots') ? 1.55 : 1;
    player.jumpMul = goals.hasUnlock('superjump') ? 1.4 : 1;
  }
  if (character) {
    character.wearCrown = goals.hasUnlock('crown');
    character.armor = goals.armorTier();   // forged armor shows on the kid
    syncHeldTool();              // sets holdSword / holdPick based on the current tool
  }
  updateHearts();
}
// Show the pickaxe in hand while the Dig tool is active (and you own one); the
// diamond sword shows the rest of the time. Tier picks which pickaxe mesh.
const PICK_TIER_NAME = ['', 'wood', 'stone', 'iron', 'diamond'];
function syncHeldTool() {
  if (!character || !goals) return;
  const tier = goals.pickTier();
  character.holdPick = (tier > 0 && lastTool === 'dig') ? PICK_TIER_NAME[tier] : false;
  character.holdSword = goals.hasUnlock('sword') && !character.holdPick;
}
// Regular TNT vs. the Mega TNT block (bought in the 💎 shop) — a much bigger boom.
const TNT_RADIUS = 3.2, MEGA_TNT_RADIUS = 5.2;
// How much a single tap-bonk hurts an enemy — the Diamond Sword hits much harder.
function swordDamage() { return goals.hasUnlock('sword') ? 3 : 1; }
function ensurePet() {
  if (!goals.hasUnlock('pet')) return;
  const am = worlds.over && worlds.over.mobs.animals;
  if (!am || am.list.some((a) => a.isPet)) return;
  const sp = worlds.over.world.spawn;
  am.spawnPet(sp[0], sp[2]);
}

// The rideable pony lives in the overworld; re-spawned each load if owned.
function ponyMob() { return worlds.over && worlds.over.mobs.animals; }
function findPony() { const am = ponyMob(); return am && am.list.find((a) => a.isPony); }
function ensurePony() {
  const btn = document.getElementById('btn-ride');
  if (!goals.hasUnlock('pony')) { if (btn) btn.style.display = 'none'; return; }
  if (btn) btn.style.display = '';
  const am = ponyMob();
  if (am && !findPony()) { const sp = worlds.over.world.spawn; am.spawnPony(sp[0], sp[2]); }
}

// Hop on / off the pony. Mounting snaps the pony to you (kid-friendly — it
// always comes when called); dismounting sets it down beside you.
function toggleRide() {
  if (riding) { dismount(); return; }
  if (dimension !== 'over') { showToast('🐴 Your pony is back home — tap 🏠 first!'); return; }
  const pony = findPony();
  if (!pony) { showToast('🐴 Buy a Ride-On Pony in the 💎 shop!'); return; }
  riding = pony;
  pony.ridden = true; pony.follower = false;
  player.pos = pony.pos.slice(); player.pos[1] += 0.05;
  player.mountSpeed = 1.7; player.mountJump = 1.18;
  camYaw = player.yaw;
  sound.play('neigh');
  goals.bump('ride');
  updateRideButton();
}
function dismount() {
  if (!riding) return;
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  riding.pos = [player.pos[0] - fx * 1.0, player.pos[1], player.pos[2] - fz * 1.0];
  riding.ridden = false; riding.follower = true;
  riding = null;
  player.mountSpeed = 1; player.mountJump = 1;
  sound.play('neigh');
  updateRideButton();
}
function updateRideButton() {
  const b = document.getElementById('btn-ride');
  if (b) b.classList.toggle('on', !!riding);
}

// --- Space Rover: a moon buggy you buy in the shop and drive across Space
// World. The 🛸 button starts/stops it and cycles the speed. We reuse the pony's
// `player.mountSpeed` to make the player move faster while driving. ---
const ROVER_SPEEDS = [
  { icon: '🛸', name: 'Park', mul: 1 },
  { icon: '🐢', name: 'Slow', mul: 1.8 },
  { icon: '🚗', name: 'Cruise', mul: 3.0 },
  { icon: '🚀', name: 'Zoom', mul: 4.6 },   // over the space speed limit — cops notice!
];
function ensureRover() { if (!rover) rover = new Rover(gl); }
function setRoverSpeed(i) {
  roverSpeedIdx = ((i % ROVER_SPEEDS.length) + ROVER_SPEEDS.length) % ROVER_SPEEDS.length;
  roving = roverSpeedIdx > 0;
  if (player) player.mountSpeed = ROVER_SPEEDS[roverSpeedIdx].mul;
  if (roving) { ensureRover(); goals.bump('rover'); sound.play('jump'); }
  updateRoverButton();
  const s = ROVER_SPEEDS[roverSpeedIdx];
  showToast(roving ? ('🛸 ' + s.icon + ' ' + s.name + (roverSpeedIdx >= 3 ? ' — careful, space speed limit! 🚨' : '')) : '🛸 Rover parked.');
}
function stopRover() { roverSpeedIdx = 0; roving = false; if (player) player.mountSpeed = 1; updateRoverButton(); }
// Tap the 🛸 button: hop on (Slow), then cycle Slow → Cruise → Zoom → Park.
function toggleRover() {
  if (!goals.hasUnlock('rover')) { showToast('🛸 Buy the Space Rover in the 💎 shop!'); return; }
  if (dimension !== 'space') { showToast('🛸 Drive it in 🚀 Space World — tap 🌍 to go!'); return; }
  setRoverSpeed(roving ? roverSpeedIdx + 1 : 1);
  tip('rover', '🛸 Tap 🛸 to change speed. Watch for hidden black holes! 🕳️');
}
function updateRoverButton() {
  const b = document.getElementById('btn-rover');
  if (!b) return;
  const show = goals.hasUnlock('rover') && dimension === 'space';
  b.style.display = show ? '' : 'none';
  b.textContent = roving ? ROVER_SPEEDS[roverSpeedIdx].icon : '🛸';
  b.classList.toggle('on', roving);
}

// Space black holes: fall below the moon floor → whoosh safely back to the
// launch pad. Never scary, always recover; ticks the "Black hole!" goal.
function blackHoleWhoosh() {
  if (roving) stopRover();
  if (rocketState !== 'off') stopRocket(false);
  if (dragonRiding) dismountDragon();
  sound.play('portal');
  spawnParticles([player.pos[0], player.pos[1], player.pos[2]], '🌀', 'puff', 8, 80);
  spawnParticles([player.pos[0], player.pos[1] + 1, player.pos[2]], '🕳️', 'puff', 3, 64);
  player.goHome(); player.vel = [0, 0, 0];
  camYaw = player.yaw; portalCooldown = 1.2; saveDirty = true;
  goals.bump('blackhole');
  showToast('🕳️ A black hole! Whoosh — back to the launch pad! 🚀', 3200);
}

// --- Ride-On Dragon: a flying mount. Tap 🐉 to hop on and soar (it reuses the
// Fly physics: hold Up to climb, let go to glide down gently). ---
function ensureDragonMount() { if (!dragonMount) dragonMount = new DragonMount(gl); }
function updateDragonButton() {
  const b = document.getElementById('btn-dragon');
  if (!b) return;
  b.style.display = goals.hasUnlock('dragonride') ? '' : 'none';
  b.classList.toggle('on', dragonRiding);
}
function toggleDragon() {
  if (!goals.hasUnlock('dragonride')) { showToast('🐉 Buy the Flying Dragon in the 💎 shop!'); return; }
  if (dragonRiding) { dismountDragon(); return; }
  if (riding) dismount();           // can't ride a pony and a dragon at once
  if (roving) stopRover();
  ensureDragonMount();
  dragonRiding = true;
  player.flying = true;             // soar! (hold Up to climb, release to glide down)
  player.mountSpeed = 1.7; player.vel = [0, 0, 0];
  syncFlyButton(); updateJumpLabel(); updateDragonButton();
  sound.play('roar');
  goals.bump('dragonfly');
  if (dimension === 'space') startSpaceRace();   // the dragon can race the rings too
  tip('dragon', '🐉 Hold Up to fly higher, let go to glide down. Tap 🐉 to land!');
}
function dismountDragon() {
  if (!dragonRiding) return;
  dragonRiding = false;
  player.flying = false;            // glide gently back down to the ground
  player.mountSpeed = 1;
  syncFlyButton(); updateJumpLabel(); updateDragonButton();
  sound.play('roar');
}
function syncFlyButton() {
  const b = document.getElementById('btn-fly');
  if (b) b.classList.toggle('on', !!player.flying);
}

// --- The Rocket: a launch-and-fly challenge in Space World. Tap 🚀 to board, tap
// again to LAUNCH (a 3-2-1 countdown — he's in charge), then fly fast through the
// asteroids. Crashing into one is a harmless boom + back to the pad to try again. ---
const rocketRiding = () => rocketState !== 'off';
function ensureRocket() { if (!rocketShip) rocketShip = new RocketShip(gl); }
function updateRocketButton() {
  const b = document.getElementById('btn-rocket');
  if (!b) return;
  b.style.display = (dimension === 'space') ? '' : 'none';
  b.textContent = rocketState === 'flying' ? '🛬' : '🚀';
  b.classList.toggle('on', rocketRiding());
}
function toggleRocket() {
  if (dimension !== 'space') { showToast('🚀 The rocket launches from 🚀 Space World — tap 🌍 to go!'); return; }
  if (riding) dismount(); if (roving) stopRover(); if (dragonRiding) dismountDragon();
  if (rocketState === 'off') {                 // board it on the pad
    ensureRocket();
    rocketState = 'ready'; rocketBoost = 0;
    player.flying = false; player.vel = [0, 0, 0]; player.mountSpeed = 1;
    updateRocketButton();
    sound.play('door');
    showToast('🚀 Buckle up! Tap 🚀 again to LAUNCH! 🔥', 3600);
    tip('rocket', '🚀 Tap 🚀 to blast off, then fly! Dodge the asteroids or BOOM! Tap 🛬 to land.');
  } else if (rocketState === 'ready') {         // ignite → countdown
    rocketState = 'countdown'; rocketCountT = 3.2;
    sound.play('fuse');
    showToast('🚀 3…', 1000);
  } else if (rocketState === 'flying') {        // land it
    stopRocket(false);
  }
}
function rocketLiftoff() {
  rocketState = 'flying';
  player.flying = true;
  player.vel = [0, 0, 0];
  rocketKick = 1.1;                             // BLAST OFF — lifts him skyward for ~1s
  player.mountSpeed = 2.6;                      // fast (racing!)
  shake = Math.min(0.9, shake + 0.7);
  syncFlyButton(); updateJumpLabel(); updateRocketButton();
  sound.play('boom');
  const p = player.pos;
  spawnParticles([p[0], p[1] + 0.1, p[2]], '🔥', 'puff', 10, 70);
  spawnParticles([p[0], p[1] + 0.1, p[2]], '💨', 'puff', 8, 80);
  goals.bump('rocketfly');
  startSpaceRace();                              // fresh ring course each launch
  showToast('🚀 BLAST OFF! Hold Up to soar — dodge the asteroids + race the rings! ✨', 3600);
}
function stopRocket(crashed) {
  if (rocketState === 'off') return;
  rocketState = 'off'; rocketBoost = 0; rocketKick = 0;
  player.flying = false; player.mountSpeed = 1;
  syncFlyButton(); updateJumpLabel(); updateRocketButton();
  if (!crashed) { sound.play('fly'); showToast('🛬 Nice flying! Rocket parked.', 2200); }
}
// Crash physics shared by the rocket + the dragon: flying fast into an asteroid
// (any solid block ahead) in Space World → a harmless boom + back to the pad.
function flightCrashCheck() {
  if (dimension !== 'space') return;
  const flyingMount = (rocketState === 'flying') || dragonRiding;
  if (!flyingMount || !player.flying) return;
  const sp = Math.hypot(player.vel[0], player.vel[2]);
  if (sp < 1.2) return;                          // only a real collision counts
  const ax = player.pos[0] + (player.vel[0] / sp) * 0.55;
  const az = player.pos[2] + (player.vel[2] / sp) * 0.55;
  const id = world.get(Math.floor(ax), Math.floor(player.pos[1] + 0.9), Math.floor(az));
  if (id !== B.AIR && !(BLOCKS[id] && BLOCKS[id].passable)) crashFlight();
}
function crashFlight() {
  const p = player.pos.slice();
  sound.play('boom');
  spawnParticles([p[0], p[1] + 0.9, p[2]], '💥', 'puff', 12, 90);
  spawnParticles([p[0], p[1] + 0.9, p[2]], '🔥', 'puff', 6, 70);
  shake = Math.min(0.9, shake + 0.7);
  const wasRocket = rocketState === 'flying';
  if (rocketState !== 'off') stopRocket(true);
  if (dragonRiding) dismountDragon();
  player.goHome(); player.vel = [0, 0, 0]; player.flying = false;
  camYaw = player.yaw; portalCooldown = 1.0; saveDirty = true;
  syncFlyButton(); updateJumpLabel();
  showToast(wasRocket ? '💥 Crash! Watch the asteroids! Back to the pad — tap 🚀 to try again! 🚀'
    : '💥 Oof — the dragon bonked an asteroid! Back to the pad. 🐉', 3400);
}

// --- Space Race: fly through the glowing rings in order. The next ring pulses
// gold; finishing the loop pays 💎. Fresh course each time you take off. ---
function ensureSpaceRace() {
  if (!spaceRace) {
    spaceRace = new SpaceRace(gl);
    spaceRace.onPass = (n, total, pos) => {
      sound.note(Math.min(6, n));                 // a climbing chime per ring
      spawnParticles([pos[0], pos[1], pos[2]], '⭐', 'puff', 5, 50);
      if (n < total) showToast('🏁 Ring ' + n + '/' + total + '! Fly to the next gold ring! ✨', 1800);
    };
    spaceRace.onFinish = (time) => {
      goals.addGems(3); updateGems(); goals.bump('spacerace');
      sound.play('treasure');
      spawnParticles([player.pos[0], player.pos[1] + 1, player.pos[2]], '🎉', 'puff', 14, 90);
      showToast('🏁🎉 Race finished in ' + time.toFixed(1) + 's! +💎3 — fly again to beat it!', 4200);
    };
  }
  return spaceRace;
}
function startSpaceRace() { ensureSpaceRace().reset(); tip('race', '🏁 Fly through the glowing rings in order! The next one glows gold. ✨'); }

// --- Fishing: a calm activity at any water. Cast near water, wait for a bite,
// reel in a fish (+💎), sometimes treasure, sometimes a silly old boot. ---
function findWaterSpot() {
  const px = Math.floor(player.pos[0]), pz = Math.floor(player.pos[2]), py = Math.floor(player.pos[1]);
  let best = null, bestD = 1e9;
  for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {
    const x = px + dx, z = pz + dz;
    for (let y = py + 2; y >= py - 5; y--) {
      if (world.get(x, y, z) === B.WATER && world.get(x, y + 1, z) === B.AIR) {
        const d = dx * dx + dz * dz;
        if (d < bestD) { bestD = d; best = [x + 0.5, y + 1.0, z + 0.5]; }
        break;
      }
    }
  }
  return best;
}
function castLine() {
  if (fishing) {                               // tapping 🎣 again…
    if (fishing.phase === 'bite') hookCatch(); // …HOOKS the fish if one's biting!
    else reelIn();                        // …otherwise just reels the empty line in
    return;
  }
  const spot = findWaterSpot();
  if (!spot) { showToast('🎣 Find some water to fish in! 🌊  (try the beach)'); return; }
  fishing = { wx: spot[0], wy: spot[1], wz: spot[2], phase: 'wait', t: 1.5 + Math.random() * 2.2, catch: null };
  sound.play('splash');
  updateFishButton();
  tip('fishing', '🎣 Watch the bobber! When a 🐟 bites, TAP to catch it. Bigger water = bigger fish!');
}
// How big is the body of water at (x,y,z)? A flood-fill, capped — bigger water
// has bigger fish worth more 💎 (so a 1-block puddle can't farm diamonds).
function waterBodySize(x, y, z) {
  x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);   // bobber coords are floats
  const seen = new Set(), stack = [[x, y, z]]; let n = 0; const CAP = 50;
  while (stack.length && n < CAP) {
    const [cx, cy, cz] = stack.pop();
    if (cx < 0 || cx >= SX || cz < 0 || cz >= SZ || cy < 0 || cy >= SY) continue;
    if (world.get(cx, cy, cz) !== B.WATER) continue;
    const k = world.idx(cx, cy, cz); if (seen.has(k)) continue;
    seen.add(k); n++;
    stack.push([cx + 1, cy, cz], [cx - 1, cy, cz], [cx, cy, cz + 1], [cx, cy, cz - 1], [cx, cy - 1, cz], [cx, cy + 1, cz]);
  }
  return n;
}
// Roll what's nibbling, based on the size of the water. Bigger water hides
// bigger, rarer fish: they're worth more 💎 but bite for a SHORTER time, so
// you have to be quicker to hook them. Missing just lets you try again.
function rollCatch(size) {
  const r = Math.random();
  if (size < 8) {                 // a puddle: easy little nibbles, no 💎
    if (r < 0.5) return { icon: '🐟', msg: 'a tiny minnow!', gems: 0, win: 1.5 };
    if (r < 0.8) return { icon: '🌿', msg: 'some seaweed!', gems: 0, win: 1.6 };
    return { icon: '🥾', msg: 'an old boot! Ha!', gems: 0, win: 1.6 };
  }
  if (size < 32) {                // a decent pond
    if (r < 0.15) return { icon: '🥾', msg: 'an old boot! Ha!', gems: 0, win: 1.3 };
    if (r < 0.55) return { icon: '🐟', msg: 'a fish! +💎1', gems: 1, win: 1.15 };
    if (r < 0.8) return { icon: '🐠', msg: 'a BIG fish! +💎2', gems: 2, win: 0.85 };
    return { icon: '💎', msg: 'sunken treasure! +💎2', gems: 2, treasure: true, win: 1.0 };
  }
  // a big lake or the ocean — the trophies live here
  if (r < 0.35) return { icon: '🐠', msg: 'a BIG fish! +💎2', gems: 2, win: 0.85 };
  if (r < 0.6) return { icon: '🐡', msg: 'a HUGE fish! +💎3', gems: 3, win: 0.7 };
  if (r < 0.8) return { icon: '💎', msg: 'sunken treasure! +💎3', gems: 3, treasure: true, win: 0.9 };
  return { icon: '🐋', msg: 'a GIANT fish!! +💎4', gems: 4, win: 0.6 };   // the rare, hard, big one
}
// A fish takes the bait: show the bite and open a short window to tap-to-hook.
function startBite() {
  if (!fishing) return;
  const size = waterBodySize(fishing.wx, fishing.wy - 1, fishing.wz);
  fishing.catch = rollCatch(size);
  fishing.phase = 'bite';
  fishing.biteT = fishing.catch.win;
  sound.play('pet');             // a soft "plip" cue
  showToast('🐟❗ A bite! TAP to catch it!', 1100);
  spawnParticles([fishing.wx, fishing.wy + 0.1, fishing.wz], '💦', 'puff', 2, 12);
}
// Too slow — the fish wriggles off the hook. No penalty; keep watching.
function missBite() {
  if (!fishing) return;
  sound.play('deny');
  showToast('🐟💨 Aw, it wiggled off! Keep watching…', 1300);
  fishing.phase = 'wait'; fishing.t = 1.0 + Math.random() * 1.6; fishing.catch = null;
}
// Tapped in time! Land whatever was biting and pay out.
function hookCatch() {
  const f = fishing, c = f && f.catch; fishing = null; hideBobber(); updateFishButton();
  if (!c) { if (f) sound.play('splash'); return; }
  goals.bump('fish');
  if (c.treasure) goals.bump('treasure');
  if (c.gems > 0) { goals.addGems(c.gems); updateGems(); }
  sound.play(c.gems > 0 ? 'treasure' : 'pet');
  spawnParticles([f.wx, f.wy + 0.5, f.wz], c.icon, 'heart', 2, 12);
  showToast('🎣 You caught ' + c.msg + ' ' + c.icon);
}
// Reel the (empty) line in — used when you cancel, travel, or get knocked out.
function reelIn() {
  if (!fishing) return;
  fishing = null; hideBobber(); updateFishButton(); sound.play('splash');
}
function positionBobber(f) {
  if (!bobberEl) bobberEl = document.getElementById('bobber');
  if (!bobberEl || !pv) return;
  mat4.transformPoint(scratch4, pv, f.wx, f.wy, f.wz);
  if (scratch4[3] <= 0) { bobberEl.style.display = 'none'; return; }
  bobberEl.style.display = 'block';
  bobberEl.style.left = (scratch4[0] / scratch4[3] * 0.5 + 0.5) * canvas.clientWidth + 'px';
  bobberEl.style.top = (1 - (scratch4[1] / scratch4[3] * 0.5 + 0.5)) * canvas.clientHeight + 'px';
  const biting = f.phase === 'bite';
  bobberEl.textContent = biting ? '🐟' : '🔴';        // a real bite — TAP to hook it!
  bobberEl.classList.toggle('bite', biting);
}
function hideBobber() { if (!bobberEl) bobberEl = document.getElementById('bobber'); if (bobberEl) { bobberEl.style.display = 'none'; bobberEl.classList.remove('bite'); } }
function updateFishButton() { const b = document.getElementById('btn-fish'); if (b) b.classList.toggle('on', !!fishing); }

// --- Treasure shop: spend 💎 (mined + earned from goals) on fun unlocks ---
const SHOP = [
  { id: 'pet', icon: '🐾', name: 'Pet Friend', cost: 5, desc: 'A cute cat that follows you around' },
  { id: 'pony', icon: '🐴', name: 'Ride-On Pony', cost: 16, desc: 'Your own pony — tap 🐴 to ride it fast!' },
  { id: 'boots', icon: '👟', name: 'Speed Boots', cost: 6, desc: 'Zoom around — walk much faster!' },
  { id: 'superjump', icon: '🦘', name: 'Super Jump', cost: 6, desc: 'Boing! Jump up really high' },
  { id: 'heart', icon: '❤️', name: 'Extra Heart', cost: 8, desc: 'One more heart for night adventures' },
  { id: 'sparkle', icon: '✨', name: 'Sparkle Trail', cost: 8, desc: 'Leave a trail of sparkles as you run' },
  { id: 'sword', icon: '⚔️', name: 'Diamond Sword', cost: 12, desc: 'Defeat zombies & spiders in one hit!' },
  { id: 'megatnt', icon: '💥', name: 'Mega TNT', cost: 10, desc: 'A giant TNT block — find it in the Mega 💣 blocks!' },
  { id: 'rainbow', icon: '🌈', name: 'Rainbow Block', cost: 10, desc: 'A magic rainbow block to build with' },
  { id: 'crown', icon: '👑', name: 'Golden Crown', cost: 14, desc: 'Wear a royal crown — be the king!' },
  { id: 'skyworld', icon: '☁️', name: 'Sky World', cost: 20, desc: 'A whole new floating-islands world — best with Fly!' },
  { id: 'endworld', icon: '🐉', name: 'The End', cost: 30, desc: 'A floating world with a friendly dragon to tame!' },
  { id: 'legoworld', icon: '🧱', name: 'Lego World', cost: 50, desc: 'A giant Lego table + 12 shiny Lego bricks! (a big treasure goal)' },
  { id: 'spaceworld', icon: '🚀', name: 'Space World', cost: 100, desc: 'Bounce sky-high in a low-gravity world of floating islands in the stars! ✨ (the BIG 100💎 dream)' },
  { id: 'rover', icon: '🛸', name: 'Space Rover', cost: 30, desc: 'Drive a moon buggy across Space World! Tap 🛸 to ride and pick your speed! 🚀' },
  { id: 'dragonride', icon: '🐉', name: 'Flying Dragon', cost: 45, desc: 'Your very own dragon — tap 🐉 to hop on and soar through the sky! ✨' },
];
function buildShop() {
  document.getElementById('shop-gems').textContent = 'You have 💎 ' + goals.gems;
  const body = document.getElementById('shop-body');
  body.innerHTML = '';
  for (const it of SHOP) {
    const owned = goals.hasUnlock(it.id);
    const btn = document.createElement('button');
    btn.className = 'shop-item' + (owned ? ' owned' : '');
    btn.innerHTML = '<span class="si">' + it.icon + '</span><div class="st"><b>' + it.name + '</b><small>' + it.desc + '</small></div>' +
      '<div class="sc">' + (owned ? '✓ Got it!' : '💎 ' + it.cost) + '</div>';
    if (!owned) btn.addEventListener('pointerdown', (e) => { e.preventDefault(); buyItem(it); });
    body.appendChild(btn);
  }
}
function openShop() { buildShop(); document.getElementById('shop').classList.remove('hidden'); }
function closeShop() { document.getElementById('shop').classList.add('hidden'); }
function buyItem(it) {
  if (goals.hasUnlock(it.id)) return;
  if (!goals.spend(it.cost)) { sound.play('deny'); showToast('Mine more 💎 first! (need ' + it.cost + ')'); return; }
  goals.setUnlock(it.id);
  goals.bump('bought');                 // counts toward the "Treasure shopper" goal
  applyUnlocks();
  if (it.id === 'pet') { ensurePet(); if (dimension !== 'over') showToast('🐾 Your new pet is waiting at home — tap 🏠!'); }
  if (it.id === 'pony') { ensurePony(); showToast(dimension === 'over' ? '🐴 Your pony is here — tap 🐴 to ride!' : '🐴 Your pony is at home — tap 🏠, then 🐴 to ride!'); }
  if (it.id === 'heart') { hearts = maxHearts; updateHearts(); }
  if (it.id === 'rainbow') {             // reveal it in the picker + select it right away
    buildPicker(); selected = B.RAINBOW; refreshBlocksButton(); saveDirty = true;
  }
  if (it.id === 'megatnt') {             // reveal the new Mega TNT block + hand it to him
    buildPicker(); selected = B.MEGA_TNT; refreshBlocksButton(); saveDirty = true;
    showToast('💣 Mega TNT is in your blocks! Place it, then tap it to light a HUGE boom!', 4200);
  }
  if (it.id === 'skyworld') showToast('☁️ Sky World unlocked! Tap 🔥, choose Sky World, then walk in!', 4200);
  if (it.id === 'endworld') showToast('🐉 The End unlocked! Tap 🔥, choose The End, then walk in to meet the dragon!', 4600);
  if (it.id === 'legoworld') { buildPicker(); selected = B.LEGO_RED; refreshBlocksButton(); showToast('🧱 Lego World! Tap 🌍 → Lego World. New Lego bricks are in your blocks!', 4600); }
  if (it.id === 'spaceworld') showToast('🚀 SPACE WORLD unlocked! 🌟 Tap 🌍 → Space World — jump to bounce sky-high!', 5200);
  if (it.id === 'rover') { updateRoverButton(); showToast(dimension === 'space' ? '🛸 Your Space Rover is ready — tap 🛸 to drive!' : '🛸 Take it for a spin in 🚀 Space World — tap 🛸 there!', 4600); }
  if (it.id === 'dragonride') { updateDragonButton(); showToast('🐉 Your Flying Dragon is here — tap 🐉 to hop on and soar!', 4600); }
  sound.play('treasure');
  updateGems(); buildShop();
  showToast('✨ Unlocked: ' + it.name + '!');
}

// --- ⛏️ Crafting: turn mined materials into better pickaxes (the ladder) ---
// You can only craft the NEXT pickaxe up, so it's a clear step-by-step climb.
// The Diamond Pickaxe costs 💎 — so the diamonds you earn everywhere finally buy
// real digging power, not just cosmetics.
const ITEM_ICON = { wood: '🪵', stone: '🪨', coal: '⚫', iron: '⛓️', ingot: '🔩' };
const PICK_LABEL = ['', '🪵⛏️', '🪨⛏️', '⚙️⛏️', '💠⛏️'];
const ARMOR_LABEL = ['', '🛡️', '💠🛡️'];
// The pickaxe ladder. Iron+ now need smelted 🔩 iron bars (mine ⛓️ raw iron →
// smelt it at the 🔥 furnace), so the furnace is a real step on the climb.
const RECIPES = [
  { tier: 1, icon: '🪵⛏️', name: 'Wooden Pickaxe', cost: { wood: 4 }, desc: 'Mine stone & coal!' },
  { tier: 2, icon: '🪨⛏️', name: 'Stone Pickaxe', cost: { stone: 5, wood: 2 }, desc: 'Mine iron!' },
  { tier: 3, icon: '⚙️⛏️', name: 'Iron Pickaxe', cost: { ingot: 3, wood: 2 }, desc: 'Strong & speedy!' },
  { tier: 4, icon: '💠⛏️', name: 'Diamond Pickaxe', cost: { ingot: 2, gems: 10 }, desc: 'The very best — uses 💎!' },
];
// Armor: forge a suit to take less damage at night & in deep caves (the bridge
// that ties mining → smelting → crafting into surviving tougher adventures).
const ARMOR_RECIPES = [
  { tier: 1, icon: '🛡️', name: 'Iron Armor', cost: { ingot: 6 }, desc: 'Take less damage — be brave at night!' },
  { tier: 2, icon: '💠🛡️', name: 'Diamond Armor', cost: { ingot: 3, gems: 12 }, desc: 'The toughest armor of all!' },
];
function costStr(cost) { return Object.keys(cost).map((k) => (k === 'gems' ? '💎' : ITEM_ICON[k]) + cost[k]).join(' '); }
function openCrafting() {
  buildCraft();
  document.getElementById('craft').classList.remove('hidden');
  sound.play('pet');
  tip('craft2', '🛠️ Mine 🪵 wood, 🪨 stone and ⚙️ iron, then make a better pickaxe here. Each one digs up more!');
}
function craftRow(body, r, owned, locked, onMake) {
  const can = !owned && !locked && goals.canAfford(r.cost);
  const btn = document.createElement('button');
  btn.className = 'shop-item' + (owned ? ' owned' : '') + (locked ? ' locked' : '');
  const sub = owned ? '✓ You made this!' : locked ? '🔒 Make the one above first' : r.desc + '  ·  ' + costStr(r.cost);
  btn.innerHTML = '<span class="si">' + r.icon + '</span><div class="st"><b>' + r.name + '</b><small>' + sub + '</small></div>' +
    '<div class="sc">' + (owned ? '✓' : locked ? '🔒' : (can ? 'Make!' : costStr(r.cost))) + '</div>';
  if (can) btn.addEventListener('pointerdown', (e) => { e.preventDefault(); onMake(r); });
  body.appendChild(btn);
}
function buildCraft() {
  const inv = document.getElementById('craft-inv');
  if (inv) inv.innerHTML = ['wood', 'stone', 'coal', 'iron', 'ingot'].map((k) => '<span>' + ITEM_ICON[k] + ' ' + goals.itemCount(k) + '</span>').join('') + '<span>💎 ' + goals.gems + '</span>';
  const body = document.getElementById('craft-body');
  body.innerHTML = '';
  const pt = goals.pickTier();
  for (const r of RECIPES) craftRow(body, r, pt >= r.tier, r.tier > pt + 1, craftItem);
  const at = goals.armorTier();
  const head = document.createElement('div'); head.className = 'craft-sep'; head.textContent = '🛡️ Armor';
  body.appendChild(head);
  for (const r of ARMOR_RECIPES) craftRow(body, r, at >= r.tier, r.tier > at + 1, craftArmor);
}
function craftItem(r) {
  const tier = goals.pickTier();
  if (tier >= r.tier || r.tier > tier + 1) return;
  if (!goals.spendItems(r.cost)) { sound.play('deny'); showToast('Mine a little more first! Need ' + costStr(r.cost)); return; }
  goals.setPickTier(r.tier);
  syncHeldTool();
  sound.play('treasure'); spawnSparkles([player.pos[0], player.pos[1] + 1.2, player.pos[2]]);
  updateGems(); updateInventory(); buildCraft(); updateQuestButton();
  const next = { 1: 'Now you can mine 🪨 stone and ⚫ coal!', 2: 'Now you can mine ⚙️ iron!', 3: 'You dig nice and strong now!', 4: '💠 The best pickaxe ever!' };
  showToast('✨ You made the ' + r.name + '! ' + (next[r.tier] || ''), 4200);
  if (r.tier === 1) tip('quest2', '📜 You\'re on an adventure! Tap 📜 up top to see the Great Quest — a legendary treasure waits deep below!');
}
function craftArmor(r) {
  const at = goals.armorTier();
  if (at >= r.tier || r.tier > at + 1) return;
  if (!goals.spendItems(r.cost)) { sound.play('deny'); showToast('Forge more 🔩 iron bars first! Need ' + costStr(r.cost)); return; }
  goals.setArmor(r.tier);
  if (character) character.armor = r.tier;
  sound.play('treasure'); spawnSparkles([player.pos[0], player.pos[1] + 1.2, player.pos[2]]);
  updateGems(); updateInventory(); buildCraft(); updateQuestButton();
  showToast('✨ You forged ' + r.name + '! Now monsters can\'t hurt you as much — be brave! 🛡️', 4400);
}
function closeCraft() { document.getElementById('craft').classList.add('hidden'); }
// --- 🔥 Furnace: smelt raw iron (⛓️) into iron bars (🔩), burning coal as fuel.
// Iron+ tools/armor need bars, so the furnace is a real step on the ladder. ---
function openFurnace() {
  buildFurnace();
  document.getElementById('furnace').classList.remove('hidden');
  sound.play('pet');
  tip('furnace', '🔥 Smelt your ⛓️ raw iron into 🔩 iron bars here (burns a ⚫ coal). Bars make iron tools + armor!');
}
function buildFurnace() {
  const inv = document.getElementById('furnace-inv');
  if (inv) inv.innerHTML = ['iron', 'coal', 'ingot'].map((k) => '<span>' + ITEM_ICON[k] + ' ' + goals.itemCount(k) + '</span>').join('');
  const body = document.getElementById('furnace-body');
  if (!body) return;
  body.innerHTML = '';
  const can = goals.itemCount('iron') >= 1 && goals.itemCount('coal') >= 1;
  const one = document.createElement('button');
  one.className = 'shop-item' + (can ? '' : ' locked');
  one.innerHTML = '<span class="si">🔥</span><div class="st"><b>Smelt iron bar</b><small>⛓️1 + ⚫1 → 🔩1</small></div><div class="sc">' + (can ? 'Smelt!' : '🔒') + '</div>';
  if (can) one.addEventListener('pointerdown', (e) => { e.preventDefault(); doSmelt(1); });
  body.appendChild(one);
  const n = Math.min(goals.itemCount('iron'), goals.itemCount('coal'));
  if (n > 1) {
    const all = document.createElement('button');
    all.className = 'shop-item';
    all.innerHTML = '<span class="si">🔥</span><div class="st"><b>Smelt all (' + n + ')</b><small>turn all your raw iron into bars</small></div><div class="sc">Smelt!</div>';
    all.addEventListener('pointerdown', (e) => { e.preventDefault(); doSmelt(n); });
    body.appendChild(all);
  }
}
function doSmelt(n) {
  let made = 0;
  for (let i = 0; i < n; i++) { if (goals.smeltIron()) made++; else break; }
  if (made > 0) { sound.play('treasure'); spawnSparkles([player.pos[0], player.pos[1] + 1.2, player.pos[2]]); showToast('🔥 Smelted ' + made + ' iron bar' + (made > 1 ? 's' : '') + '! 🔩', 3000); }
  else sound.play('deny');
  updateInventory(); buildFurnace();
}
function closeFurnace() { document.getElementById('furnace').classList.add('hidden'); }

// --- 📜 Journey to the Deep: the grand quest. Gather → craft an iron pickaxe →
// forge armor → dig deep through the caves → claim the legendary Relic in the
// Deep Vault. It gives the whole mining/crafting/armor spine one epic destination.
function questStages() {
  return [
    { icon: '⛏️', label: 'Forge an Iron Pickaxe', done: goals.pickTier() >= 3, hint: 'Mine iron, smelt 🔩 bars at the 🔥 furnace, craft it at the 🛠️ table.' },
    { icon: '🛡️', label: 'Forge a suit of Armor', done: goals.armorTier() >= 1, hint: 'Make 🔩 bars, then craft Armor at the 🛠️ table.' },
    { icon: '🕳️', label: 'Dig deep underground', done: (goals.counts.wentdeep || 0) >= 1, hint: 'Find a cave and dig down — follow the gold ✦ on your map!' },
    { icon: '🏆', label: 'Claim the Legendary Relic', done: !!goals.done.champion, hint: 'Tap the glowing Relic deep in the Vault!' },
  ];
}
function questReadyToClaim() { const s = questStages(); return !goals.done.champion && s[0].done && s[1].done; }
function openQuestJournal() {
  const st = questStages();
  document.getElementById('quest2-msg').innerHTML = goals.done.champion ? '🏆 You are the Champion of the Deep! 🏆' : '📜 A legendary treasure waits deep below.<br>Gear up, then dig down to claim it!';
  document.getElementById('quest2-body').innerHTML = st.map((s) => '<div class="qstage' + (s.done ? ' qdone' : '') + '"><span class="qi">' + (s.done ? '✅' : s.icon) + '</span><div class="qt"><b>' + s.label + '</b><small>' + (s.done ? 'Done!' : s.hint) + '</small></div></div>').join('');
  document.getElementById('quest2').classList.remove('hidden');
  sound.play('pet');
}
function closeQuest2() { document.getElementById('quest2').classList.add('hidden'); }
function updateQuestButton() {
  const b = document.getElementById('btn-quest'); if (!b) return;
  b.style.display = (dimension === 'over' && !goals.done.champion) ? '' : 'none';   // an overworld journey
  b.classList.toggle('ready', questReadyToClaim());
}
function claimVault() {
  if (goals.done.champion) { sound.play('pet'); showToast('🏆 You are the Champion of the Deep! The Relic glows just for you.', 3500); return; }
  if (goals.pickTier() < 3 || goals.armorTier() < 1) {
    sound.play('deny');
    showToast('✨ The Relic is sealed by magic… Gear up first — forge an Iron Pickaxe AND Armor, then return! 📜', 5400);
    openQuestJournal();
    return;
  }
  goals.bump('champion');                       // completes the Champion of the Deep goal (a ⭐)
  goals.addGems(25); updateGems();
  if (!goals.hasUnlock('crown')) { goals.setUnlock('crown'); applyUnlocks(); }   // the Hero's Crown trophy
  const v = (world.vault || [player.pos[0], player.pos[1], player.pos[2]]);
  for (let i = 0; i < 6; i++) spawnSparkles([v[0] + 0.5, v[1] + 0.7 + i * 0.25, v[2] + 0.5]);
  sound.play('treasure');
  showToast('🏆🎉 YOU CLAIMED THE LEGENDARY RELIC! +💎25 and a Hero\'s Crown! You are the Champion of the Deep! 👑', 6500);
  updateQuestButton(); minimapDirty = true;
}
// The little materials HUD (top-left). Hidden until you start mining, so it's
// never clutter; `pulse` is the item key that just changed (for a pop animation).
function updateInventory(pulse) {
  const el = document.getElementById('inv-bar');
  if (!el || !goals) return;
  const keys = ['wood', 'stone', 'coal', 'iron', 'ingot'];
  const any = goals.pickTier() > 0 || goals.armorTier() > 0 || keys.some((k) => goals.itemCount(k) > 0);
  el.style.display = any ? 'flex' : 'none';
  if (!any) return;
  let html = '';
  for (const k of keys) if (goals.itemCount(k) > 0 || k !== 'ingot') html += '<span class="invi' + (k === pulse ? ' pop' : '') + '">' + ITEM_ICON[k] + goals.itemCount(k) + '</span>';
  const tier = goals.pickTier();
  if (tier > 0) html += '<span class="invi pick">' + PICK_LABEL[tier] + '</span>';
  const at = goals.armorTier();
  if (at > 0) html += '<span class="invi pick">' + ARMOR_LABEL[at] + '</span>';
  el.innerHTML = html;
}
// A 🛠️ crafting table + 🔥 furnace on the ground near spawn (every world).
// Idempotent like the puzzle cube: only fills AIR, never overwrites a build, and
// respawns if dug. The two sit side by side so the forge reads as one workshop.
function placeFixtureBlock(w, dx, dz, id) {
  const sp = w.spawn;
  const x = Math.floor(sp[0]) + dx, z = Math.floor(sp[2]) + dz;
  if (x < 1 || x >= SX - 1 || z < 1 || z >= SZ - 1) return;
  const gy = w.heightAt(x, z);
  if (gy < 1) return;
  const top = w.get(x, gy, z);
  if (top === id) return;
  if (top !== B.AIR && top !== B.WATER) w.set(x, gy + 1, z, id);
}
function placeCraftFixture(w) { placeFixtureBlock(w, -3, 0, B.CRAFTING); placeFixtureBlock(w, -3, 1, B.FURNACE); }

// --- Villager quests: tap a villager for a little task, finish it for 💎 ---
// Each quest tracks a goals counter from a baseline, so it's "from now on".
const QUEST_POOL = [
  { metric: 'place', n: 10, reward: 3, icon: '🧱', label: 'place {n} blocks' },
  { metric: 'pet', n: 3, reward: 3, icon: '🐾', label: 'pet {n} animals' },
  { metric: 'fish', n: 3, reward: 4, icon: '🎣', label: 'catch {n} fish' },
  { metric: 'diamond', n: 2, reward: 5, icon: '💎', label: 'mine {n} diamonds' },
  { metric: 'treasure', n: 2, reward: 4, icon: '✨', label: 'dig up {n} buried treasures' },
  { metric: 'dig', n: 14, reward: 3, icon: '⛏️', label: 'dig up {n} blocks' },
  { metric: 'monster', n: 2, reward: 5, icon: '⚔️', label: 'defeat {n} night creatures' },
  { metric: 'plant', n: 2, reward: 4, icon: '🌱', label: 'plant {n} saplings' },
];
let questVillager = null;
function makeQuest() {
  const q = QUEST_POOL[Math.floor(Math.random() * QUEST_POOL.length)];
  return { metric: q.metric, target: q.n, base: goals.counts[q.metric] || 0, reward: q.reward, icon: q.icon, label: q.label.replace('{n}', q.n) };
}
function questProgress(q) { return Math.max(0, Math.min(q.target, (goals.counts[q.metric] || 0) - q.base)); }
function questDone(q) { return questProgress(q) >= q.target; }
function talkToVillager(v) {
  sound.play('pet');
  if (!v.quest) { v.quest = makeQuest(); showQuest(v, 'offer'); }
  else if (questDone(v.quest)) showQuest(v, 'done');
  else showQuest(v, 'progress');
}
function showQuest(v, state) {
  questVillager = v;
  const q = v.quest, msg = document.getElementById('quest-msg'), btn = document.getElementById('quest-ok');
  if (state === 'offer') {
    msg.innerHTML = '<div class="qface">🧑‍🌾</div>Hello there! 👋<br>Can you <b>' + q.icon + ' ' + q.label + '</b> for me?<br>I\'ll give you <b>💎' + q.reward + '</b>!';
    btn.textContent = 'Okay! 👍';
  } else if (state === 'progress') {
    msg.innerHTML = '<div class="qface">🧑‍🌾</div><b>' + q.icon + ' ' + q.label + '</b><br>You\'ve done <b>' + questProgress(q) + ' / ' + q.target + '</b> so far — keep going!';
    btn.textContent = 'Okay';
  } else {
    msg.innerHTML = '<div class="qface">🥳</div>You did it! 🎉<br>Here\'s your reward: <b>💎' + q.reward + '</b><br>Thank you so much!';
    btn.textContent = 'Yay! 🎉';
  }
  document.getElementById('quest').classList.remove('hidden');
}
function closeQuest() { document.getElementById('quest').classList.add('hidden'); }
function questOk() {
  const v = questVillager;
  if (v && v.quest && questDone(v.quest)) {
    goals.addGems(v.quest.reward); updateGems();
    goals.bump('quest');
    sound.play('treasure');
    showToast('🎉 Quest done! +💎' + v.quest.reward);
    v.quest = null;          // tapping again offers a fresh quest
  }
  closeQuest();
}

// --- Captain Nova's space missions: tap the astronaut in Space World for a
// space-themed task, finish it for 💎. Same baseline-relative ("from now on")
// tracking as the villager quests, just with a friendly astronaut face. ---
const ASTRO_MISSIONS = [
  { metric: 'spacegem', n: 3, reward: 4, icon: '🔷', label: 'mine {n} space crystals' },
  { metric: 'dig', n: 12, reward: 3, icon: '⛏️', label: 'dig up {n} moon rocks' },
  { metric: 'place', n: 8, reward: 3, icon: '🧱', label: 'build with {n} blocks on the moon' },
  { metric: 'spacerace', n: 1, reward: 5, icon: '🏁', label: 'race through the glowing rings' },
];
let astroNpc = null;
function makeMission() {
  const q = ASTRO_MISSIONS[Math.floor(Math.random() * ASTRO_MISSIONS.length)];
  return { metric: q.metric, target: q.n, base: goals.counts[q.metric] || 0, reward: q.reward, icon: q.icon, label: q.label.replace('{n}', q.n) };
}
function missionProgress(q) { return Math.max(0, Math.min(q.target, (goals.counts[q.metric] || 0) - q.base)); }
function missionDone(q) { return missionProgress(q) >= q.target; }
function talkToAstronaut(a) {
  sound.play('pet');
  if (!a.mission) { a.mission = makeMission(); showAstro(a, 'offer'); }
  else if (missionDone(a.mission)) showAstro(a, 'done');
  else showAstro(a, 'progress');
}
function showAstro(a, state) {
  astroNpc = a;
  const q = a.mission, msg = document.getElementById('astro-msg'), btn = document.getElementById('astro-ok');
  if (state === 'offer') {
    msg.innerHTML = '<div class="qface">🧑‍🚀</div>Hi, space friend! 👋<br>I\'m <b>Captain Nova</b>.<br>Can you <b>' + q.icon + ' ' + q.label + '</b>?<br>I\'ll give you <b>💎' + q.reward + '</b>!';
    btn.textContent = 'Blast off! 🚀';
  } else if (state === 'progress') {
    msg.innerHTML = '<div class="qface">🧑‍🚀</div><b>' + q.icon + ' ' + q.label + '</b><br>You\'ve done <b>' + missionProgress(q) + ' / ' + q.target + '</b> — keep going!';
    btn.textContent = 'Okay';
  } else {
    msg.innerHTML = '<div class="qface">🎉</div>Mission complete, astronaut! 🚀<br>Here\'s <b>💎' + q.reward + '</b>!<br>You\'re a space star! ⭐';
    btn.textContent = 'Yay! 🎉';
  }
  document.getElementById('astro').classList.remove('hidden');
}
function closeAstro() { document.getElementById('astro').classList.add('hidden'); }
function astroOk() {
  const a = astroNpc;
  if (a && a.mission && missionDone(a.mission)) {
    goals.addGems(a.mission.reward); updateGems();
    goals.bump('spacemission');
    sound.play('treasure');
    showToast('🚀 Mission done! +💎' + a.mission.reward);
    a.mission = null;          // tapping again offers a fresh mission
  }
  closeAstro();
}

// --- 🧩 Color Puzzle: a "watch then repeat" colour-memory mini-game inside a
// puzzle cube. Found in every world (and placeable from the Creative tab), so
// there are puzzles to solve for 💎 everywhere. Watch the colours flash, tap
// them back in order. Longer sequences pay more; a wrong tap just replays it
// (forgiving). Difficulty climbs as you keep getting them right. ---
let puzzle = null;                 // { level, seq:[], pos, showing }
function puzzleButtons() { return Array.from(document.querySelectorAll('#puzzle-pad .pz')); }
function setPuzzleMsg(t) { const e = document.getElementById('puzzle-msg'); if (e) e.innerHTML = t; }
function openPuzzle() {
  if (puzzle) return;
  puzzle = { level: 2, seq: [], pos: 0, showing: false };
  document.getElementById('puzzle').classList.remove('hidden');
  sound.play('pet');
  startPuzzleRound();
}
function startPuzzleRound() {
  if (!puzzle) return;
  puzzle.seq = []; for (let i = 0; i < puzzle.level; i++) puzzle.seq.push(Math.floor(Math.random() * 4));
  puzzle.pos = 0;
  showPuzzleSequence();
}
function flashPuzzle(ci) {
  const b = puzzleButtons()[ci]; if (!b) return;
  b.classList.add('flash'); sound.note(ci);
  setTimeout(() => b.classList.remove('flash'), 360);
}
function showPuzzleSequence() {
  if (!puzzle) return;
  puzzle.showing = true;
  setPuzzleMsg('👀 Watch the colors…');
  let i = 0;
  const step = () => {
    if (!puzzle) return;                        // dialog closed mid-show
    if (i >= puzzle.seq.length) { puzzle.showing = false; setPuzzleMsg('🎵 Your turn! Tap them in order.'); return; }
    flashPuzzle(puzzle.seq[i]); i++;
    setTimeout(step, 680);
  };
  setTimeout(step, 480);
}
function puzzleTap(ci) {
  if (!puzzle || puzzle.showing) return;        // ignore taps while it's showing
  flashPuzzle(ci);
  if (ci === puzzle.seq[puzzle.pos]) {
    puzzle.pos++;
    if (puzzle.pos >= puzzle.seq.length) puzzleWin();
  } else { puzzleFail(); }
}
function puzzleWin() {
  const reward = Math.max(1, Math.min(3, Math.floor(puzzle.level / 2)));  // 1 → 3 as it gets longer
  goals.addGems(reward); updateGems(); goals.bump('puzzle');
  sound.play('treasure');
  setPuzzleMsg('🎉 You did it! +💎' + reward + '<br>Here comes a trickier one…');
  puzzle.level = Math.min(7, puzzle.level + 1);
  puzzle.showing = true;                          // lock input during the gap
  setTimeout(() => { if (puzzle) startPuzzleRound(); }, 1500);
}
function puzzleFail() {
  sound.play('deny');
  setPuzzleMsg('😅 Oops — watch again!');
  puzzle.pos = 0; puzzle.showing = true;
  setTimeout(() => { if (puzzle) showPuzzleSequence(); }, 1100);
}
function closePuzzle() { puzzle = null; document.getElementById('puzzle').classList.add('hidden'); }
// Drop a puzzle cube on solid ground a few steps from spawn, in every world.
// Idempotent: if one's already there (loaded from save) it does nothing, so it
// never piles up; if it was dug away it comes back next load (a respawning
// puzzle station). Only fills AIR, so it never overwrites terrain or a build.
function placePuzzleFixture(w) {
  const sp = w.spawn;
  const x = Math.floor(sp[0]) + 3, z = Math.floor(sp[2]);
  if (x < 1 || x >= SX - 1 || z < 1 || z >= SZ - 1) return;
  const gy = w.heightAt(x, z);
  if (gy < 1) return;                                   // no ground here (void/water edge)
  const top = w.get(x, gy, z);                           // the topmost solid block
  if (top === B.PUZZLE) return;                          // already placed (it IS the top block now)
  if (top !== B.AIR && top !== B.WATER) w.set(x, gy + 1, z, B.PUZZLE);   // sit it on the ground
}

// --- 📖 Adventure: a story journey across the worlds, hosted by Ezra's friends.
// Each chapter = a friend, a short readable blurb, one clear "do it together"
// task (tracked from now via a goals counter), a 💎 reward, friendship hearts,
// and sometimes a gift. The 📖 button is always there so he's never lost. ---
const STORY = [
  { friend: 'chris', say: "Let's build a cozy house! 🏠", hint: 'Tap 🏗️ → Cozy House.', task: { metric: 'place', n: 20, mode: 'do', icon: '🏠', label: 'build a house' }, reward: 4 },
  { friend: 'alex', say: "Hi, I'm Alex! Build a tower! 🗼", hint: 'Tap 🏗️ → Long Wall.', task: { kind: 'build', type: 'tower', n: 4, icon: '🗼', label: 'build a tower 4 tall' }, reward: 5 },
  { friend: 'vlad', say: "Let's pet 3 animals! 🐾", hint: 'Tap 🐾 next to an animal.', task: { metric: 'pet', n: 3, mode: 'do', icon: '🐾', label: 'pet 3 animals' }, reward: 4, gift: 'pet' },
  { friend: 'chip', say: "I'm Chip! Build a bridge! 🌉", hint: 'Tap 🏗️ → Big Floor.', task: { kind: 'build', type: 'line', n: 7, icon: '🌉', label: 'build a bridge 7 long' }, reward: 5 },
  { friend: 'cora', say: "Plant a little tree! 🌱", hint: 'Place a 🌱 sapling on grass.', task: { metric: 'plant', n: 1, mode: 'do', icon: '🌱', label: 'plant a sapling' }, reward: 4 },
  { friend: 'milo', say: "I'm Milo! Build a big floor! 🟫", hint: 'Tap 🏗️ → Big Floor.', task: { kind: 'build', type: 'floor', n: 4, icon: '🟫', label: 'build a 4×4 floor' }, reward: 5 },
  { friend: 'jovi', say: "Find treasure in Gold World! 💎", hint: 'Tap 🌍 → Gold World, then dig.', task: { metric: 'treasure', n: 2, mode: 'do', icon: '💎', label: 'dig up 2 treasures' }, reward: 5 },
  { friend: 'brexin', say: "I'm Brexin! Build a big wall! 🧱", hint: 'Tap 🏗️ → Long Wall.', task: { kind: 'build', type: 'wall', n: 6, n2: 3, icon: '🧱', label: 'build a wall 6 long, 3 tall' }, reward: 6, gift: 'sparkle' },
  { friend: 'steve', say: "Answer 3 number puzzles! 🧮", hint: 'Tap Steve at his stand.', task: { metric: 'math', n: 3, mode: 'do', icon: '🍗', label: 'answer 3 math questions' }, reward: 5 },
  { friend: 'cristiano', say: "Let's bounce on slime! 🟢", hint: 'Place slime, then jump on it.', task: { metric: 'bounce', n: 1, mode: 'do', icon: '🟢', label: 'bounce on slime' }, reward: 4, gift: 'crown' },
  { friend: 'hero', say: "Be brave at night! 🦸", hint: 'Tap 🌙, then tap a monster.', task: { metric: 'monster', n: 1, mode: 'do', icon: '⚔️', label: 'bonk 1 night monster' }, reward: 6 },
  { friend: 'cora', say: "Last one — tame the dragon! 🐉", hint: 'Go to The End, pop crystals, pet her.', task: { metric: 'dragon', n: 1, mode: 'have', icon: '🐉', label: 'tame the dragon' }, reward: 12, gift: 'rainbow' },
];
const ADV_FRIENDS = [...new Set(STORY.map((c) => c.friend))];

// After the story, friends keep dropping by with endless BUILD CHALLENGES that
// the game actually checks against what you've built.
const BUILD_POOL = [
  { type: 'tower', n: 5, icon: '🗼', label: 'build a tower 5 tall' },
  { type: 'tower', n: 8, icon: '🗼', label: 'build a tall tower 8 high' },
  { type: 'line', n: 8, icon: '🌉', label: 'build a bridge 8 long' },
  { type: 'floor', n: 5, icon: '🟫', label: 'build a 5×5 floor' },
  { type: 'wall', n: 7, n2: 4, icon: '🧱', label: 'build a wall 7 long, 4 tall' },
];
const BUILD_FRIENDS = ['alex', 'chip', 'milo', 'brexin'];
function makeFreeChallenge() {
  const b = BUILD_POOL[Math.floor(Math.random() * BUILD_POOL.length)];
  const friend = BUILD_FRIENDS[Math.floor(Math.random() * BUILD_FRIENDS.length)];
  return { friend, free: true, say: charById(friend).name + " says: build with me! 🛠️", hint: 'Use 🏗️ or your blocks near you!', task: { kind: 'build', type: b.type, n: b.n, n2: b.n2, icon: b.icon, label: b.label }, reward: 4 };
}

// Scan the blocks the player has placed for a finished structure.
let buildMet = false;
function runBuildCheck(task) {
  const P = world.placed;
  if (!P || !P.size) return false;
  const has = (x, y, z) => P.has(world.idx(x, y, z));
  for (const i of P) {
    const x = i % SX, y = Math.floor(i / (SX * SZ)), z = Math.floor(i / SX) % SZ;
    if (task.type === 'tower') { let c = 1; while (has(x, y + c, z)) c++; if (c >= task.n) return true; }
    else if (task.type === 'line') {
      let c = 1; while (has(x + c, y, z)) c++; if (c >= task.n) return true;
      c = 1; while (has(x, y, z + c)) c++; if (c >= task.n) return true;
    } else if (task.type === 'floor') {
      let ok = true; for (let dx = 0; dx < task.n && ok; dx++) for (let dz = 0; dz < task.n; dz++) if (!has(x + dx, y, z + dz)) { ok = false; break; }
      if (ok) return true;
    } else if (task.type === 'wall') {
      const w = task.n, h = task.n2 || 3;
      let ok = true; for (let a = 0; a < w && ok; a++) for (let b = 0; b < h; b++) if (!has(x + a, y + b, z)) { ok = false; break; }
      if (ok) return true;
      ok = true; for (let a = 0; a < w && ok; a++) for (let b = 0; b < h; b++) if (!has(x, y + b, z + a)) { ok = false; break; }
      if (ok) return true;
    }
  }
  return false;
}

function storyDone() { return goals.adv && goals.adv.i >= STORY.length; }
// The chapter the player is on: a story chapter, then (after a one-time finale)
// an endless build challenge.
function activeChapter() {
  if (!storyDone()) return STORY[goals.adv.i];
  if (!goals.adv.fin) return null;                 // null = show the finale once
  if (!goals.adv.fc) { goals.adv.fc = makeFreeChallenge(); goals.save(); }
  return goals.adv.fc;
}
function startChapter(i) {
  const ch = STORY[i];
  const metric = ch && ch.task.metric;
  goals.adv = { i, base: metric ? (goals.counts[metric] || 0) : 0, fin: goals.adv && goals.adv.fin, fc: null };
  goals.save();
  recheckBuild();
}
function recheckBuild() { const ch = activeChapter(); buildMet = !!(ch && ch.task.kind === 'build' && runBuildCheck(ch.task)); }
function advProgress(ch) {
  const t = ch.task;
  if (t.kind === 'build') return buildMet ? t.n : 0;
  const cur = goals.counts[t.metric] || 0;
  return t.mode === 'have' ? Math.min(t.n, cur) : Math.max(0, Math.min(t.n, cur - goals.adv.base));
}
function advDone(ch) { return ch.task.kind === 'build' ? buildMet : (advProgress(ch) >= ch.task.n); }
function heartsHtml(id) { const n = Math.min(3, goals.friends[id] || 0); let s = ''; for (let k = 0; k < 3; k++) s += k < n ? '❤️' : '🤍'; return s; }
function advReady() { return (storyDone() && !goals.adv.fin) || (() => { const c = activeChapter(); return !!(c && advDone(c)); })(); }
function updateAdventureButton() {
  const b = document.getElementById('btn-adventure');
  if (b) b.classList.toggle('on', advReady());     // gold ring = something to claim
}
function openAdventure() { recheckBuild(); renderAdventure(); document.getElementById('adventure').classList.remove('hidden'); }
function closeAdventure() { document.getElementById('adventure').classList.add('hidden'); }
function renderAdventure() {
  const body = document.getElementById('adv-body'), btn = document.getElementById('adv-ok');
  body.innerHTML = '';
  const ch = activeChapter();
  if (!ch) {                         // the story is finished — a happy finale (then endless builds)
    const row = document.createElement('div'); row.className = 'adv-finale-row';
    for (const id of ADV_FRIENDS) row.appendChild(charPreview(charById(id), 48));
    body.appendChild(row);
    const t = document.createElement('div'); t.className = 'adv-text';
    t.innerHTML = '🎉 You did the whole adventure! 🎉<br>Great job, Ezra! 💖<br>Now friends bring fun build jobs!';
    body.appendChild(t);
    btn.textContent = 'Yay! 🎉';
    return;
  }
  const c = charById(ch.friend);
  const port = charPreview(c, 84); port.className = 'adv-portrait'; body.appendChild(port);
  const name = document.createElement('div'); name.className = 'adv-name'; name.innerHTML = c.name + ' &nbsp; ' + heartsHtml(ch.friend); body.appendChild(name);
  const say = document.createElement('div'); say.className = 'adv-text'; say.innerHTML = ch.say; body.appendChild(say);
  const done = advDone(ch);
  const task = document.createElement('div'); task.className = 'adv-task' + (done ? ' done' : '');
  if (ch.task.kind === 'build') {
    task.innerHTML = (done ? '✅ ' : '') + ch.task.icon + ' <b>' + ch.task.label + '</b>' + (done ? ' — done! 🎉' : '<br><small>💡 ' + ch.hint + '</small>');
  } else {
    task.innerHTML = (done ? '✅ ' : '') + ch.task.icon + ' <b>' + ch.task.label + '</b> — ' + advProgress(ch) + ' / ' + ch.task.n + (done ? '' : '<br><small>💡 ' + ch.hint + '</small>');
  }
  body.appendChild(task);
  btn.textContent = done ? "Yay! What's next? 🎉" : 'Okay! 👍';
}
function applyGift(id) {
  goals.setUnlock(id);
  applyUnlocks();
  if (id === 'pet') ensurePet();
  if (id === 'pony') ensurePony();
  if (id === 'rainbow') { buildPicker(); selected = B.RAINBOW; refreshBlocksButton(); }
  saveDirty = true;
}
function advOk() {
  if (storyDone() && !goals.adv.fin) {     // acknowledge the finale, then start endless builds
    goals.adv.fin = true; goals.save(); recheckBuild(); renderAdventure(); updateAdventureButton(); return;
  }
  const ch = activeChapter();
  if (!ch || !advDone(ch)) { closeAdventure(); return; }
  goals.addGems(ch.reward); updateGems();
  goals.bump('story');
  goals.friends[ch.friend] = (goals.friends[ch.friend] || 0) + 1;
  sound.play('treasure');
  let giftMsg = '';
  if (ch.gift && !goals.hasUnlock(ch.gift)) { applyGift(ch.gift); giftMsg = ' 🎁 ' + charById(ch.friend).name + ' gave you a present!'; }
  if (ch.free) { goals.adv.fc = makeFreeChallenge(); goals.save(); }   // a fresh build challenge
  else startChapter(goals.adv.i + 1);                                  // advance the story
  recheckBuild();
  showToast('🎉 +💎' + ch.reward + giftMsg, 3800);
  updateAdventureButton();
  renderAdventure();
}

// --- A friend who strolls up (gently!) ---
// The current adventure host wanders near home and, now and then (long cooldown,
// so it's never annoying) ambles over to say hi — especially when a chapter is
// ready to claim. Tap the friend to open the Adventure. Overworld only.
function buddyHostId() { const ch = activeChapter(); return ch ? ch.friend : 'chris'; }
function setupBuddy() {
  if (!worlds.over) return;
  if (!buddyChar) buddyChar = new Character(gl);
  const W = worlds.over.world, sp = W.spawn;
  const hx = Math.max(2, Math.min(SX - 2, Math.floor(sp[0]) + 4)), hz = Math.max(2, Math.min(SZ - 2, Math.floor(sp[2]) + 4));
  buddy = { pos: [hx + 0.5, W.heightAt(hx, hz) + 1, hz + 0.5], home: [hx + 0.5, hz + 0.5], yaw: 0, mode: 'home', timer: 16 + Math.random() * 22, walk: 0, linger: 0, hostId: null, chimed: false };
  syncBuddySkin();
}
function syncBuddySkin() {
  const id = buddyHostId();
  if (buddy && buddyChar && buddy.hostId !== id) { buddy.hostId = id; buddyChar.setCharacter(charById(id)); }
}
function updateBuddy(dt) {
  if (!buddy || dimension !== 'over') return;
  syncBuddySkin();
  const W = world;
  const dx = player.pos[0] - buddy.pos[0], dz = player.pos[2] - buddy.pos[2], dist = Math.hypot(dx, dz) || 1;
  const claimable = advReady();
  buddy.timer -= dt;
  if (buddy.mode === 'home') {
    buddy.walk = 0;
    if (dist < 6) buddy.yaw = Math.atan2(-dx, -dz);                 // turn to look if you're near
    if ((buddy.timer <= 0 || claimable) && dist < 24 && dist > 2.6) { buddy.mode = 'approach'; buddy.chimed = false; buddy.linger = 0; }
    else if (buddy.timer <= 0) buddy.timer = 35 + Math.random() * 30;
  } else if (buddy.mode === 'approach') {
    if (dist > 2.3) { buddy.yaw = Math.atan2(-dx, -dz); buddy.pos[0] += dx / dist * 2.1 * dt; buddy.pos[2] += dz / dist * 2.1 * dt; buddy.walk += dt * 8; }
    else {
      buddy.yaw = Math.atan2(-dx, -dz); buddy.walk = 0;
      if (!buddy.chimed) {                       // a clear "tap me!" greeting every visit
        buddy.chimed = true; sound.play('pet');
        const nm = charById(buddy.hostId).name;
        spawnParticles([buddy.pos[0], buddy.pos[1] + 1.9, buddy.pos[2]], claimable ? '⭐' : '👋', 'heart', 2, 14);
        showToast(claimable ? ('📖 ' + nm + ': you did it! Tap me! 🎉') : ('👋 ' + nm + ' is here! Tap me!'), 3000);
      }
      buddy.linger += dt;
      if (buddy.linger > (claimable ? 16 : 9)) { buddy.mode = 'leave'; buddy.timer = 38 + Math.random() * 30; }
    }
  } else { // leave → wander home
    const hx = buddy.home[0] - buddy.pos[0], hz = buddy.home[1] - buddy.pos[2], hd = Math.hypot(hx, hz) || 1;
    if (hd > 0.5) { buddy.yaw = Math.atan2(-hx, -hz); buddy.pos[0] += hx / hd * 1.8 * dt; buddy.pos[2] += hz / hd * 1.8 * dt; buddy.walk += dt * 8; }
    else { buddy.mode = 'home'; buddy.walk = 0; }
  }
  buddy.pos[0] = Math.max(2, Math.min(SX - 2, buddy.pos[0]));
  buddy.pos[2] = Math.max(2, Math.min(SZ - 2, buddy.pos[2]));
  buddy.pos[1] = W.heightAt(Math.floor(buddy.pos[0]), Math.floor(buddy.pos[2])) + 1;
}
function drawBuddy() {
  if (!buddy || dimension !== 'over' || !buddyChar) return;
  const moving = buddy.mode === 'approach' || buddy.mode === 'leave';
  buddyChar.draw(worldProg, buddy.pos[0], buddy.pos[1], buddy.pos[2], buddy.yaw, buddy.walk, moving ? 1 : 0, 0, false);
}

// --- Steve's Lava Chicken stand: a math challenge that pays 💎 + 🍗 ---
// Build a cute little stand (only into empty space, so it never wrecks a build).
function buildLavaStand(w, sx, gy, sz) {
  const put = (x, y, z, id) => { if (w.get(x, y, z) === B.AIR) w.set(x, y, z, id); };
  for (let dx = -1; dx <= 1; dx++) put(sx + dx, gy + 1, sz - 1, B.PLANKS);      // counter
  put(sx - 1, gy + 2, sz - 1, B.ORANGE); put(sx + 1, gy + 2, sz - 1, B.ORANGE); // "lava" fire
  put(sx, gy + 2, sz - 1, B.GLOWSTONE);                                         // grill glow
  for (const px of [sx - 2, sx + 2]) for (let dy = 1; dy <= 3; dy++) put(px, gy + dy, sz - 1, B.LOG); // posts
  for (let dx = -2; dx <= 2; dx++) put(sx + dx, gy + 4, sz - 1, B.BRICK);       // roof awning
  for (let i = 0; i < 6; i++) w.markDirty(sx - 2 + i, sz - 1);
}
function setupSteve() {
  const ov = worlds.over && worlds.over.world;
  if (!ov || !steveChar) return;
  const sp = ov.spawn;
  const sx = Math.max(3, Math.min(SX - 4, Math.floor(sp[0]) + 7));
  const sz = Math.max(3, Math.min(SZ - 4, Math.floor(sp[2])));
  const gy = ov.heightAt(sx, sz);
  stevePos = [sx + 0.5, gy + 1, sz + 0.5];
  buildLavaStand(ov, sx, gy, sz);
}
function makeMath() {
  const lvl = goals.counts.math || 0;
  const ri = (n) => Math.floor(Math.random() * n);
  // Mix of question types, easing in by how many he's answered.
  const pool = lvl < 3 ? ['count', 'add'] : lvl < 8 ? ['count', 'add', 'add'] :
    lvl < 14 ? ['add', 'add', 'sub', 'bond'] : ['add', 'sub', 'bond', 'count'];
  const type = pool[ri(pool.length)];
  let prompt, ans;
  if (type === 'count') {
    const n = 2 + ri(7), f = ['🍎', '🍗', '⭐', '🐟', '🌸', '🍓'][ri(6)];
    prompt = 'How many ' + f + '?<span class="big">' + f.repeat(n) + '</span>'; ans = n;
  } else if (type === 'bond') {
    const total = lvl < 12 ? 10 : 10 + ri(6) * 0 + (ri(2) ? 0 : 10);  // 10 (or 20 later)
    const a = 1 + ri(total - 1); prompt = '<span class="big">' + a + ' + ? = ' + total + '</span>'; ans = total - a;
  } else if (type === 'sub') {
    const a = 6 + ri(12), b = 1 + ri(a - 1); prompt = '<span class="big">' + a + ' − ' + b + ' = ?</span>'; ans = a - b;
  } else {
    const a = lvl < 5 ? 1 + ri(5) : 2 + ri(9), b = lvl < 5 ? 1 + ri(5) : 2 + ri(9);
    prompt = '<span class="big">' + a + ' + ' + b + ' = ?</span>'; ans = a + b;
  }
  const opts = new Set([ans]);
  while (opts.size < 3) { const d = ans + (ri(2) ? 1 : -1) * (1 + ri(3)); if (d >= 0) opts.add(d); }
  // Harder questions are worth more 💎 (counting/easy add = 1, the rest = 2).
  const reward = (type === 'count' || (type === 'add' && lvl < 5)) ? 1 : 2;
  return { prompt, ans, opts: [...opts].sort(() => Math.random() - 0.5), reward };
}
function showMath() {
  document.getElementById('math-q').innerHTML =
    '<div class="qface">🍗</div><b>Steve\'s Lava Chicken</b><br>' + mathQ.prompt;
  const o = document.getElementById('math-opts'); o.innerHTML = '';
  for (const v of mathQ.opts) {
    const btn = document.createElement('button');
    btn.className = 'math-opt'; btn.textContent = v;
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); answerMath(v); });
    o.appendChild(btn);
  }
}
function openMath() { mathQ = makeMath(); showMath(); document.getElementById('math').classList.remove('hidden'); }
function closeMath() { document.getElementById('math').classList.add('hidden'); }
function answerMath(v) {
  if (!mathQ) return;
  if (v === mathQ.ans) {
    goals.bump('math');                       // always counts toward the math goals
    const pay = Math.min(mathQ.reward || 1, mathPouch);   // …but 💎 are limited by Steve's pouch
    mathPouch -= pay;
    if (pay > 0) { goals.addGems(pay); updateGems(); sound.play('treasure'); showToast('🍗 Correct! Lava chicken + 💎' + pay + '!'); }
    else { sound.play('pet'); showToast('🍗 Correct! Steve is out of 💎 for now — come back later! Enjoy a lava chicken 😋'); }
    mathQ = makeMath(); showMath();          // a fresh (gently harder) question
  } else {
    sound.play('deny');
    showToast('Oops — not quite! Try again 😊');
  }
}

// --- Steve's stall menu: a math challenge (earn 💎) + snacks (spend 💎 → ❤️) ---
const SNACKS = [
  { icon: '🍎', name: 'Apple', cost: 1, heal: 1, desc: 'Restores 1 heart' },
  { icon: '🍗', name: 'Lava Chicken', cost: 2, heal: 2, desc: 'Restores 2 hearts' },
  { icon: '🍰', name: 'Cake', cost: 3, heal: 99, desc: 'Fills you all the way up!' },
  { icon: '🍏', name: 'Golden Apple', cost: 5, buff: true, desc: 'Extra golden hearts for a while!' },
];
function openSteveMenu() { buildSteveMenu(); document.getElementById('steve').classList.remove('hidden'); }
function closeSteve() { document.getElementById('steve').classList.add('hidden'); }
function buildSteveMenu() {
  const body = document.getElementById('steve-body');
  body.innerHTML = '';
  const g = document.createElement('div'); g.id = 'steve-gems';
  g.textContent = 'You have 💎 ' + goals.gems;
  body.appendChild(g);
  const mb = document.createElement('button'); mb.className = 'steve-math';
  mb.innerHTML = '🧮 Math Challenge! <small>answer to earn 💎</small>';
  mb.addEventListener('pointerdown', (e) => { e.preventDefault(); closeSteve(); openMath(); });
  body.appendChild(mb);
  const lbl = document.createElement('div'); lbl.className = 'snack-label';
  lbl.textContent = '🍎 Snacks — spend 💎 to fill up hearts:';
  body.appendChild(lbl);
  for (const s of SNACKS) {
    const btn = document.createElement('button'); btn.className = 'shop-item';
    btn.innerHTML = '<span class="si">' + s.icon + '</span><div class="st"><b>' + s.name + '</b><small>' + s.desc + '</small></div><div class="sc">💎 ' + s.cost + '</div>';
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); buySnack(s); });
    body.appendChild(btn);
  }
}
function buySnack(s) {
  if (!s.buff && hearts >= effMax()) { sound.play('deny'); showToast('You\'re already full of energy! 💪'); return; }
  if (!goals.spend(s.cost)) { sound.play('deny'); showToast('Earn more 💎 first! (need ' + s.cost + ')'); return; }
  if (s.buff) { heartBuff = 2; heartBuffT = 90; hearts = effMax(); }   // golden bonus hearts for 90s
  else hearts = Math.min(effMax(), hearts + s.heal);
  updateHearts();
  goals.bump('snack');
  sound.play('pet'); spawnHearts([player.pos[0], player.pos[1] + 1.4, player.pos[2]]);
  updateGems(); buildSteveMenu();
  showToast(s.buff ? '🍏 Golden power! 💛 Extra hearts for a while!' : 'Yum! ' + s.icon + ' Hearts filled!');
}

// --- Start the current world fresh (asked for, behind a confirmation) ---
function resetWorld() {
  if (roving) stopRover();
  if (dragonRiding) dismountDragon();
  if (rocketState !== 'off') stopRocket(false);
  resting = null;
  const key = dimension, W = worlds[key].world, kind = WORLD_KINDS[key];
  const hubDests = [...new Set(W.portals.filter((p) => HUB_DESTS.includes(p.dest)).map((p) => p.dest))];
  for (let i = saplings.length - 1; i >= 0; i--) if (saplings[i].world === W) saplings.splice(i, 1);
  W[kind.gen]();                         // regenerate fresh (clears builds + placed)
  refreshSpawn(W);
  ensurePortalsFor(key);                 // keep the standard portal(s)
  for (const d of hubDests) placeHubPortal(W, kind, d);   // and re-lay any flint portals
  W.rebuildAll();
  if (key === 'over') { setupSteve(); setupBuddy(); }   // re-place Steve + the friend
  player.world = W; player.goHome(); player.vel = [0, 0, 0];
  positions[key] = W.spawn.slice();
  minimapDirty = true; saveDirty = true;
  showToast('✨ Fresh ' + kind.name + '! Your ⭐ and 💎 are safe.', 3200);
}
function askReset() {
  document.getElementById('confirm-msg').innerHTML =
    '🔄 <b>Start ' + WORLD_KINDS[dimension].name + ' fresh?</b><br>Everything you built here will be cleared.<br>Your ⭐ stars and 💎 diamonds are safe!';
  document.getElementById('goals').classList.add('hidden');
  document.getElementById('confirm').classList.remove('hidden');
}
function hurt(n) {
  if (invuln > 0 || hearts <= 0) return;
  const armor = goals.armorTier();                 // forged armor soaks up damage (the mining→combat bridge)
  if (armor > 0) n = Math.max(0.5, Math.round(n * (armor >= 2 ? 0.25 : 0.5) * 2) / 2);
  hearts = Math.max(0, hearts - n);
  invuln = 0.7; hurtFlash = 0.55; sinceHurt = 0; regenT = 0;
  sound.play('hurt');
  updateHearts();
  if (hearts <= 0) knockout();
}
function knockout() {
  if (riding) dismount();
  if (dragonRiding) dismountDragon();
  if (rocketState !== 'off') stopRocket(false);
  if (fishing) reelIn();
  resting = null;
  heartBuff = 0; heartBuffT = 0;          // bonus hearts end on a knockout
  showToast('💤 Oof! You got sleepy — back home, safe and sound.', 3400);
  night = false; nightAuto = false; autoNightT = AUTO_NIGHT_EVERY; updateNightButton();
  const om = worlds.over && worlds.over.mobs;
  if (om && om.zombies) om.zombies.list.length = 0;
  if (om && om.spiders) om.spiders.list.length = 0;
  if (om && om.skeletons) om.skeletons.list.length = 0;
  if (dimension !== 'over') setDimension('over');
  player.goHome(); player.vel = [0, 0, 0];
  hearts = maxHearts; invuln = 1.6; updateHearts();
}
function updateNightButton() {
  const b = document.getElementById('btn-night');
  if (b) { b.textContent = night ? '☀️' : '🌙'; b.classList.toggle('on', night); }
}
// Auto-night: every ~15 min of play the world darkens and monsters come out — a
// gentle recurring challenge. He can shelter in his builds; it lifts at dawn.
function startAutoNight() {
  night = true; nightAuto = true; autoNightLeft = AUTO_NIGHT_DURATION;
  updateNightButton();
  goals.bump('night');
  sound.play('uhoh');
  showToast('🌙 Night is falling! Quick — get inside your house or build a shelter! 🏠', 4800);
  tip('autonight', '🌙 Night comes now and then! Hide in a house, or tap the monsters. You always wake up safe!');
}
function endAutoNight() {
  night = false; nightAuto = false; autoNightT = AUTO_NIGHT_EVERY;
  updateNightButton();
  showToast('☀️ Morning! You made it through the night — well done! 🎉', 3600);
}

// --- UI wiring ---
function blockIcon(id, size) {
  return blockPreview(BLOCKS[id].tiles.side, size, BLOCKS[id].tint);
}

function refreshBlocksButton() {
  const b = document.getElementById('btn-blocks');
  b.innerHTML = '';
  b.appendChild(blockIcon(selected, 46));
}

function openPicker() { document.getElementById('picker').classList.remove('hidden'); }
function closePicker() { document.getElementById('picker').classList.add('hidden'); }

// --- Character picker: choose who you want to be (Ezra, Mama, Dada, …) ---
function applyCharacter() {
  if (character) character.setCharacter(charById(selectedChar));
}
function buildCharPicker() {
  const body = document.getElementById('chars-body');
  body.innerHTML = '';
  for (const c of CHARACTERS) {
    const btn = document.createElement('button');
    btn.className = 'char-tile' + (c.id === selectedChar ? ' sel' : '');
    btn.appendChild(charPreview(c, 60));
    const nm = document.createElement('b'); nm.textContent = c.name; btn.appendChild(nm);
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      selectedChar = c.id; applyCharacter(); saveDirty = true;
      body.querySelectorAll('.char-tile').forEach((t) => t.classList.remove('sel'));
      btn.classList.add('sel');
      sound.play('pet');
      setTimeout(closeChars, 220);
    });
    body.appendChild(btn);
  }
}
function openChars() { buildCharPicker(); document.getElementById('chars').classList.remove('hidden'); }
function closeChars() { document.getElementById('chars').classList.add('hidden'); }

function buildPicker() {
  const body = document.getElementById('picker-body');
  body.innerHTML = '';
  // In Lego World the picker is a pure Lego table — only the Lego bricks show.
  const legoOnly = dimension === 'lego' && goals.hasUnlock('legoworld');
  for (const cat of CATEGORIES) {
    if (cat.locked && !goals.hasUnlock(cat.locked)) continue;   // hidden until bought
    if (legoOnly && cat.name !== 'Lego 🧱') continue;           // Lego World = Lego pieces only
    const label = document.createElement('div');
    label.className = 'pick-cat'; label.textContent = cat.name;
    body.appendChild(label);
    const grid = document.createElement('div');
    grid.className = 'pick-grid';
    for (const id of cat.blocks) {
      const tile = document.createElement('button');
      tile.className = 'pick-tile';
      if (id === selected) tile.classList.add('sel');
      tile.appendChild(blockIcon(id, 46));
      tile.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        selected = id; saveDirty = true;
        body.querySelectorAll('.pick-tile').forEach((s) => s.classList.remove('sel'));
        tile.classList.add('sel');
        refreshBlocksButton();
        closePicker();
      });
      grid.appendChild(tile);
    }
    body.appendChild(grid);
  }
}

// --- Flint & steel "Where to?" menu (built from the world registry) ---
function buildPortalMenu() {
  const body = document.getElementById('portalmenu-body');
  body.innerHTML = '';
  const dests = [];
  if (dimension !== 'over') dests.push('over');                       // Home
  for (const k of WORLD_ORDER) {
    const kind = WORLD_KINDS[k];
    if (k === dimension || !kind.flint) continue;
    if (kind.locked && !goals.hasUnlock(kind.locked)) continue;       // bought-only worlds
    dests.push(k);
  }
  for (const k of dests) {
    const kind = WORLD_KINDS[k];
    const btn = document.createElement('button');
    btn.className = 'portal-choice';
    btn.innerHTML = '<span class="pe">' + kind.emoji + '</span><b>' + kind.name + '</b>';
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); closePortalMenu(); lightChosenFrame(k); });
    body.appendChild(btn);
  }
}
function openPortalMenu() { buildPortalMenu(); document.getElementById('portalmenu').classList.remove('hidden'); }
function closePortalMenu() { document.getElementById('portalmenu').classList.add('hidden'); }

// --- 🌍 Worlds menu: one tap to hop straight to any world (the kid-friendly way
// to travel — the flint & steel "build your own portal" path still works too). ---
function buildWorldMenu() {
  const body = document.getElementById('worldmenu-body');
  body.innerHTML = '';
  for (const k of WORLD_ORDER) {
    if (k === dimension) continue;                 // you're already here
    const kind = WORLD_KINDS[k];
    let locked = false, reason = '';
    if (k === 'nether' && !portalUnlocked) { locked = true; reason = 'Earn ⭐' + NETHER_STARS; }
    else if (kind.locked && !goals.hasUnlock(kind.locked)) { locked = true; reason = 'Buy in 💎 shop'; }
    const btn = document.createElement('button');
    btn.className = 'portal-choice' + (locked ? ' locked' : '');
    const name = k === 'over' ? 'Home' : kind.name;
    btn.innerHTML = '<span class="pe">' + kind.emoji + '</span><b>' + name + '</b>' + (locked ? '<small>🔒 ' + reason + '</small>' : '');
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault(); closeWorldMenu();
      if (!locked) { travelTo(k); return; }
      if (k === 'nether') showToast('🌀 Earn ⭐' + NETHER_STARS + ' goals to open the Nether! (You have ⭐' + goals.stars + ')', 3600);
      else openShop();                             // send him to buy the locked world
    });
    body.appendChild(btn);
  }
}
function openWorldMenu() { buildWorldMenu(); document.getElementById('worldmenu').classList.remove('hidden'); }
function closeWorldMenu() { document.getElementById('worldmenu').classList.add('hidden'); }

// --- Secret World fun-park rides: tap a ride → pay 💎 → enjoy. The reward is
// pure fun + a ⭐; rides NEVER pay diamonds (you earn those working elsewhere). ---
function openRidePrompt(att) {
  if (ride) return;
  pendingRide = att;
  document.getElementById('ride-title').textContent = att.icon + ' ' + att.name;
  document.getElementById('ride-msg').textContent = 'Ride for 💎' + att.cost + '?   (You have 💎' + goals.gems + ')';
  document.getElementById('ride').classList.remove('hidden');
}
function closeRidePrompt() { pendingRide = null; document.getElementById('ride').classList.add('hidden'); }
function rideById(id) { return ATTRACTIONS.find((a) => a.id === id); }
// Pay for + start a ride (used by the per-ride prompt and the ticket menu).
function beginRide(att) {
  if (!att || ride) return false;
  if (!goals.spend(att.cost)) { sound.play('deny'); showToast('Mine more 💎 first! Earn 💎 in the other worlds, then come splurge here! (need ' + att.cost + ')', 4000); return false; }
  updateGems();
  const fp = mobs().funpark; if (!fp) return false;
  ride = { att, t: 0, dur: att.dur, returnPos: player.pos.slice() };
  fp.rideKind = att.id;
  sound.play('portal');
  showToast('🎟️ ' + att.icon + ' Hold on tight — here we go!', 2200);
  return true;
}
function confirmRide() { const att = pendingRide; closeRidePrompt(); beginRide(att); }

// --- Stands: the Ticket booth (ride menu), Popcorn stand, and Gift Shop ---
function openStand(id) {
  if (id === 'tickets') openRideMenu();
  else if (id === 'popcorn') openPopcorn();
  else if (id === 'shop') { showToast('🛍️ Welcome to the Gift Shop! Spend your 💎 on cool things!', 2600); openShop(); }
}
// The Ticket booth: a simple tap-a-ride menu (the easy, can't-miss way to ride).
function buildRideMenu() {
  const body = document.getElementById('ridemenu-body');
  body.innerHTML = '';
  for (const att of ATTRACTIONS) {
    const btn = document.createElement('button');
    btn.className = 'portal-choice';
    btn.innerHTML = '<span class="pe">' + att.icon + '</span><b>' + att.name + '</b><small>💎 ' + att.cost + '</small>';
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); closeRideMenu(); beginRide(att); });
    body.appendChild(btn);
  }
}
function openRideMenu() { if (ride) return; buildRideMenu(); document.getElementById('ridemenu').classList.remove('hidden'); }
function closeRideMenu() { document.getElementById('ridemenu').classList.add('hidden'); }

// The Popcorn stand: tasty treats to spend 💎 on (pure fun + a goal; some heal).
const TREATS = [
  { icon: '🍿', name: 'Popcorn', cost: 1, heal: 1 },
  { icon: '🥤', name: 'Fizzy Pop', cost: 1, heal: 1 },
  { icon: '🍭', name: 'Cotton Candy', cost: 2, heal: 2 },
  { icon: '🍦', name: 'Ice Cream', cost: 2, heal: 2 },
];
function buildPopcornMenu() {
  const body = document.getElementById('popcorn-body');
  body.innerHTML = '';
  for (const t of TREATS) {
    const btn = document.createElement('button');
    btn.className = 'portal-choice';
    btn.innerHTML = '<span class="pe">' + t.icon + '</span><b>' + t.name + '</b><small>💎 ' + t.cost + '</small>';
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); buyTreat(t); });
    body.appendChild(btn);
  }
}
function openPopcorn() { buildPopcornMenu(); document.getElementById('popcorn').classList.remove('hidden'); }
function closePopcorn() { document.getElementById('popcorn').classList.add('hidden'); }
function buyTreat(t) {
  if (!goals.spend(t.cost)) { sound.play('deny'); showToast('Mine more 💎 first! (need ' + t.cost + ')'); return; }
  updateGems();
  if (hearts < effMax()) { hearts = Math.min(effMax(), hearts + t.heal); updateHearts(); }
  goals.bump('snack'); goals.bump('treat');
  sound.play('pet');
  spawnParticles([player.pos[0], player.pos[1] + 1.8, player.pos[2]], t.icon, 'puff', 8, 60);
  showToast(t.icon + ' Yum! Enjoy your ' + t.name + '!', 2200);
  buildPopcornMenu();   // refresh the 💎 you have
}
// Drive the player along the active ride each frame (replaces normal physics).
function updateRide(dt) {
  const fp = mobs().funpark;
  if (!fp) { ride = null; return; }
  ride.t += dt;
  const u = Math.min(1, ride.t / ride.dur);
  if (ride.att.id === 'ferris') {
    fp.wheel.angle = u * Math.PI * 4;                 // two gentle turns
    const gp = fp.gondolaPos(0);
    player.pos = [gp[0], gp[1] + 0.15, gp[2]];
    player.yaw = Math.PI;
  } else if (ride.att.id === 'carousel') {
    fp.carousel.angle = u * Math.PI * 6;              // three spins
    const a = fp.carousel.angle;
    player.pos = [fp.carousel.cx + Math.cos(a) * 1.9, fp.carousel.cy + 0.9, fp.carousel.cz + Math.sin(a) * 1.9];
    player.yaw = a + Math.PI / 2;
  } else {                                            // balloon: up, hover, gently down
    const pad = fp.balloonPad;
    const h = u < 0.4 ? (u / 0.4) : (u < 0.62 ? 1 : (1 - (u - 0.62) / 0.38));
    player.pos = [pad.cx, pad.cy + 1.2 + h * 15, pad.cz];
    player.yaw += dt * 0.5;
    fp.rideBalloon = [player.pos[0], player.pos[1] + 2.7, player.pos[2]];
  }
  player.vel = [0, 0, 0];
  if (ride.t >= ride.dur) endRide();
}
function endRide() {
  const att = ride.att, fp = mobs().funpark;
  if (fp) { fp.rideKind = null; fp.rideBalloon = null; }
  player.pos = ride.returnPos.slice();
  player.vel = [0, 0, 0];
  ride = null;
  goals.bump('funride');
  spawnParticles([player.pos[0], player.pos[1] + 2, player.pos[2]], '🎉', 'puff', 12, 90);
  spawnSparkles([player.pos[0], player.pos[1] + 1.2, player.pos[2]]);
  sound.play('treasure');
  showToast('⭐ ' + att.icon + ' Wheee! What a ride! You went on the ' + att.name + '!', 3600);
}

// Big, bright, tappable signs that float over each Secret World ride + stand —
// so a 6-year-old can clearly see what to tap (aiming at the 3-D ride is fiddly).
let rideSignEls = null;
function ensureRideSigns() {
  if (rideSignEls) return;
  const layer = document.getElementById('ridesigns');
  if (!layer) return;
  const configs = [
    ...ATTRACTIONS.map((a) => ({ id: a.id, icon: a.icon, text: 'Ride! 💎' + a.cost, tap: () => openRidePrompt(a) })),
    ...STANDS.map((s) => ({ id: s.id, icon: s.icon, text: s.label, tap: () => openStand(s.id), cls: 'stand' })),
  ];
  rideSignEls = configs.map((c) => {
    const el = document.createElement('button');
    el.className = 'ridesign' + (c.cls ? ' ' + c.cls : '');
    el.innerHTML = '<span class="rs-emoji">' + c.icon + '</span><span>' + c.text + '</span>';
    el.style.display = 'none';
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); sound.resume(); c.tap(); });
    layer.appendChild(el);
    return { el, id: c.id };
  });
}
function updateRideSigns() {
  ensureRideSigns();
  if (!rideSignEls) return;
  const fp = (dimension === 'secret') ? mobs().funpark : null;
  if (!fp || !pv || ride) { for (const s of rideSignEls) s.el.style.display = 'none'; return; }
  for (const s of rideSignEls) {
    const sign = fp.signs.find((g) => g.id === s.id);
    if (!sign) { s.el.style.display = 'none'; continue; }
    mat4.transformPoint(scratch4, pv, sign.pos[0], sign.pos[1], sign.pos[2]);
    if (scratch4[3] <= 0) { s.el.style.display = 'none'; continue; }    // behind the camera
    s.el.style.display = 'flex';
    s.el.style.left = (scratch4[0] / scratch4[3] * 0.5 + 0.5) * canvas.clientWidth + 'px';
    s.el.style.top = (1 - (scratch4[1] / scratch4[3] * 0.5 + 0.5)) * canvas.clientHeight + 'px';
  }
}

function refreshGoalsButton() {
  document.getElementById('btn-goals').textContent = '⭐' + goals.stars;
}

function buildGoals() {
  const body = document.getElementById('goals-body');
  body.innerHTML = '';
  document.getElementById('goals-title').textContent = 'My Goals  ⭐' + goals.stars + '/' + GOAL_DEFS.length;
  if (!portalUnlocked) {
    const note = document.createElement('div');
    note.className = 'goal-note';
    note.textContent = '🌀 Earn ⭐' + NETHER_STARS + ' to open the Nether portal!  (You have ⭐' + goals.stars + ')';
    body.appendChild(note);
  }
  for (const g of GOAL_DEFS) {
    const done = !!goals.done[g.id];
    const prog = goals.progress(g);
    const pct = Math.round(prog / g.target * 100);
    const row = document.createElement('div');
    row.className = 'goal-row' + (done ? ' done' : '');
    row.innerHTML =
      '<div class="gi">' + g.icon + '</div>' +
      '<div class="gt"><b>' + g.title + '</b><small>' + g.desc + '</small>' +
      '<div class="goal-bar"><i style="width:' + pct + '%"></i></div></div>' +
      '<div class="gc">' + (done ? '✓' : prog + '/' + g.target) + '</div>';
    body.appendChild(row);
  }
}

function showToast(text, ms) {
  const el = document.getElementById('goaltoast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(goalToastTimer);
  goalToastTimer = setTimeout(() => el.classList.remove('show'), ms || 2600);
}
function showGoalToast(g) { showToast('⭐ Goal done: ' + g.title + '!'); sound.play('pet'); }

// A friendly one-time "blurb" that explains a feature the first time it matters,
// so a young player is never lost. Each id shows once (remembered in the save).
function tip(id, text, ms) {
  if (!goals || goals.seenTip(id)) return;
  goals.markTip(id);
  showToast(text, ms || 5200);
}

function holdButton(id, fn, repeat) {
  const el = document.getElementById(id);
  if (!el) return;
  let timer = null;
  const start = (e) => {
    e.preventDefault();
    sound.resume();
    fn();
    if (repeat) timer = setInterval(fn, 220);
    el.classList.add('pressed');
  };
  const end = () => { if (timer) { clearInterval(timer); timer = null; } el.classList.remove('pressed'); };
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', end);
  el.addEventListener('pointerleave', end);
  el.addEventListener('pointercancel', end);
}

// --- "Switch view": cycle the camera from wide overview to zoomed-in close ---
function cycleZoom() {
  const wasTopDown = VIEW_PRESETS[zoomIndex].pitch != null;
  zoomIndex = (zoomIndex + 1) % VIEW_PRESETS.length;
  const v = VIEW_PRESETS[zoomIndex];
  camDist = v.dist;
  if (v.pitch != null) camPitch = v.pitch;            // snap up to look down for the map view
  else if (wasTopDown) camPitch = 0.42;               // leaving top-down → back to a normal angle
  saveDirty = true;
  updateViewButton();
}
function updateViewButton() {
  const b = document.getElementById('btn-view');
  if (b) b.textContent = VIEW_PRESETS[zoomIndex].icon;
}
// While flying, the Jump button reads "Up" (hold to rise, let go to float down).
function updateJumpLabel() {
  const b = document.querySelector('#btn-jump b');
  if (b) b.textContent = (player && player.flying) ? 'Up' : 'Jump';
}

function wireUI() {
  buildPicker();
  refreshBlocksButton();
  document.getElementById('btn-blocks').addEventListener('pointerdown', (e) => { e.preventDefault(); openPicker(); });
  document.getElementById('picker-close').addEventListener('pointerdown', (e) => { e.preventDefault(); closePicker(); });
  document.getElementById('picker').addEventListener('pointerdown', (e) => { if (e.target.id === 'picker') closePicker(); });
  holdButton('btn-build', () => { setTool('build'); doBuild(targetCells()); }, false);
  holdButton('btn-dig', () => { setTool('dig'); doDig(targetCells()); }, false);
  holdButton('btn-pet', doPet, false);
  setTool('build');

  const jb = document.getElementById('btn-jump');
  const setJump = (v) => (e) => { e.preventDefault(); controls.jump = v; if (v) sound.resume(); };
  jb.addEventListener('pointerdown', setJump(true));
  jb.addEventListener('pointerup', setJump(false));
  jb.addEventListener('pointerleave', setJump(false));
  jb.addEventListener('pointercancel', setJump(false));

  const flyBtn = document.getElementById('btn-fly');
  flyBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault(); sound.resume();
    player.flying = !player.flying;
    flyBtn.classList.toggle('on', player.flying);
    updateJumpLabel();
    sound.play('fly');
    if (player.flying) goals.bump('fly');
  });

  document.getElementById('btn-flint').addEventListener('pointerdown', (e) => {
    e.preventDefault(); sound.resume();
    flintMode = !flintMode; updateFlintButton();
    if (flintMode) tip('flint', '🔥 Build an obsidian frame, tap inside to make a portal! Tap 🔥 to put away.');
  });
  document.getElementById('portalmenu-close').addEventListener('pointerdown', (e) => { e.preventDefault(); closePortalMenu(); });
  document.getElementById('portalmenu').addEventListener('pointerdown', (e) => { if (e.target.id === 'portalmenu') closePortalMenu(); });

  document.getElementById('btn-worlds').addEventListener('pointerdown', (e) => {
    e.preventDefault(); sound.resume();
    tip('worlds', '🌍 Tap a world to go there! 🔒 = buy in 💎 shop.');
    openWorldMenu();
  });
  document.getElementById('worldmenu-close').addEventListener('pointerdown', (e) => { e.preventDefault(); closeWorldMenu(); });
  document.getElementById('worldmenu').addEventListener('pointerdown', (e) => { if (e.target.id === 'worldmenu') closeWorldMenu(); });

  document.getElementById('ride-yes').addEventListener('pointerdown', (e) => { e.preventDefault(); confirmRide(); });
  document.getElementById('ride-no').addEventListener('pointerdown', (e) => { e.preventDefault(); closeRidePrompt(); });

  document.getElementById('ridemenu-close').addEventListener('pointerdown', (e) => { e.preventDefault(); closeRideMenu(); });
  document.getElementById('ridemenu').addEventListener('pointerdown', (e) => { if (e.target.id === 'ridemenu') closeRideMenu(); });
  document.getElementById('popcorn-close').addEventListener('pointerdown', (e) => { e.preventDefault(); closePopcorn(); });
  document.getElementById('popcorn').addEventListener('pointerdown', (e) => { if (e.target.id === 'popcorn') closePopcorn(); });

  document.getElementById('btn-buildkit').addEventListener('pointerdown', (e) => {
    e.preventDefault(); sound.resume();
    tip('buildkit', '🏗️ Pick House, Floor or Wall — it builds in front of you!');
    openBuildMenu();
  });
  document.getElementById('buildmenu-close').addEventListener('pointerdown', (e) => { e.preventDefault(); closeBuildMenu(); });
  document.getElementById('buildmenu').addEventListener('pointerdown', (e) => { if (e.target.id === 'buildmenu') closeBuildMenu(); });
  document.getElementById('place-ok').addEventListener('pointerdown', (e) => { e.preventDefault(); sound.resume(); confirmPlacement(); });
  document.getElementById('place-cancel').addEventListener('pointerdown', (e) => { e.preventDefault(); cancelPlacement(); });

  document.getElementById('btn-night').addEventListener('pointerdown', (e) => {
    e.preventDefault(); sound.resume();
    night = !night; nightAuto = false; updateNightButton();
    if (night) { goals.bump('night'); tip('night', '🌙 Monsters come out! Tap them, or fly up. You always wake up safe!'); }
    else autoNightT = AUTO_NIGHT_EVERY;   // turning day back on resets the ~15 min timer
  });

  document.getElementById('btn-ride').addEventListener('pointerdown', (e) => { e.preventDefault(); sound.resume(); toggleRide(); });
  document.getElementById('btn-rover').addEventListener('pointerdown', (e) => { e.preventDefault(); sound.resume(); toggleRover(); });
  document.getElementById('btn-dragon').addEventListener('pointerdown', (e) => { e.preventDefault(); sound.resume(); toggleDragon(); });
  document.getElementById('btn-rocket').addEventListener('pointerdown', (e) => { e.preventDefault(); sound.resume(); toggleRocket(); });
  document.getElementById('btn-fish').addEventListener('pointerdown', (e) => { e.preventDefault(); sound.resume(); castLine(); });
  document.getElementById('btn-char').addEventListener('pointerdown', (e) => { e.preventDefault(); sound.resume(); openChars(); });
  document.getElementById('chars-close').addEventListener('pointerdown', (e) => { e.preventDefault(); closeChars(); });
  document.getElementById('chars').addEventListener('pointerdown', (e) => { if (e.target.id === 'chars') closeChars(); });
  document.getElementById('math-close').addEventListener('pointerdown', (e) => { e.preventDefault(); closeMath(); });
  document.getElementById('math').addEventListener('pointerdown', (e) => { if (e.target.id === 'math') closeMath(); });
  document.getElementById('steve-close').addEventListener('pointerdown', (e) => { e.preventDefault(); closeSteve(); });
  document.getElementById('steve').addEventListener('pointerdown', (e) => { if (e.target.id === 'steve') closeSteve(); });

  document.getElementById('gem-bar').addEventListener('pointerdown', (e) => { e.preventDefault(); sound.resume(); openShop(); });
  document.getElementById('shop-close').addEventListener('pointerdown', (e) => { e.preventDefault(); closeShop(); });
  document.getElementById('shop').addEventListener('pointerdown', (e) => { if (e.target.id === 'shop') closeShop(); });
  document.getElementById('craft-close').addEventListener('pointerdown', (e) => { e.preventDefault(); closeCraft(); });
  document.getElementById('craft').addEventListener('pointerdown', (e) => { if (e.target.id === 'craft') closeCraft(); });
  document.getElementById('furnace-close').addEventListener('pointerdown', (e) => { e.preventDefault(); closeFurnace(); });
  document.getElementById('furnace').addEventListener('pointerdown', (e) => { if (e.target.id === 'furnace') closeFurnace(); });
  document.getElementById('btn-quest').addEventListener('pointerdown', (e) => { e.preventDefault(); sound.resume(); openQuestJournal(); });
  document.getElementById('quest2-close').addEventListener('pointerdown', (e) => { e.preventDefault(); closeQuest2(); });
  document.getElementById('quest2').addEventListener('pointerdown', (e) => { if (e.target.id === 'quest2') closeQuest2(); });
  document.getElementById('btn-adventure').addEventListener('pointerdown', (e) => {
    e.preventDefault(); sound.resume();
    tip('adventure', '📖 Friends give you fun jobs! Do it, then tap 📖.');
    openAdventure();
  });
  document.getElementById('adv-ok').addEventListener('pointerdown', (e) => { e.preventDefault(); advOk(); });
  document.getElementById('adventure').addEventListener('pointerdown', (e) => { if (e.target.id === 'adventure') closeAdventure(); });
  document.getElementById('quest-ok').addEventListener('pointerdown', (e) => { e.preventDefault(); questOk(); });
  document.getElementById('quest').addEventListener('pointerdown', (e) => { if (e.target.id === 'quest') closeQuest(); });
  document.getElementById('astro-ok').addEventListener('pointerdown', (e) => { e.preventDefault(); astroOk(); });
  document.getElementById('astro').addEventListener('pointerdown', (e) => { if (e.target.id === 'astro') closeAstro(); });
  for (const b of document.querySelectorAll('#puzzle-pad .pz')) b.addEventListener('pointerdown', (e) => { e.preventDefault(); puzzleTap(+b.dataset.c); });
  document.getElementById('puzzle-close').addEventListener('pointerdown', (e) => { e.preventDefault(); closePuzzle(); });
  document.getElementById('puzzle').addEventListener('pointerdown', (e) => { if (e.target.id === 'puzzle') closePuzzle(); });
  document.getElementById('btn-reset').addEventListener('pointerdown', (e) => { e.preventDefault(); askReset(); });
  document.getElementById('confirm-no').addEventListener('pointerdown', (e) => { e.preventDefault(); document.getElementById('confirm').classList.add('hidden'); });
  document.getElementById('confirm-yes').addEventListener('pointerdown', (e) => { e.preventDefault(); document.getElementById('confirm').classList.add('hidden'); resetWorld(); });

  document.getElementById('btn-home').addEventListener('pointerdown', (e) => { e.preventDefault(); player.goHome(); });
  document.getElementById('btn-view').addEventListener('pointerdown', (e) => { e.preventDefault(); sound.resume(); cycleZoom(); });
  updateViewButton();

  refreshGoalsButton();
  document.getElementById('btn-goals').addEventListener('pointerdown', (e) => { e.preventDefault(); buildGoals(); document.getElementById('goals').classList.remove('hidden'); });
  document.getElementById('goals-close').addEventListener('pointerdown', (e) => { e.preventDefault(); document.getElementById('goals').classList.add('hidden'); });
  document.getElementById('goals').addEventListener('pointerdown', (e) => { if (e.target.id === 'goals') document.getElementById('goals').classList.add('hidden'); });
}

// --- Minimap: a small top-down map (terrain + you + the portals) ---
let mmCanvas, mmCtx, mmTerrain, mmTerrainCtx;
const MM_SIZE = 120;
function hexToRgb(h) { const n = parseInt((h || '#888').slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function initMinimap() {
  mmCanvas = document.getElementById('minimap');
  if (!mmCanvas) return;
  mmCanvas.width = MM_SIZE; mmCanvas.height = MM_SIZE;
  mmCtx = mmCanvas.getContext('2d');
  mmTerrain = document.createElement('canvas'); mmTerrain.width = SX; mmTerrain.height = SZ;
  mmTerrainCtx = mmTerrain.getContext('2d');
}
function renderMinimapTerrain() {
  const img = mmTerrainCtx.createImageData(SX, SZ);
  for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
    const h = world.heightAt(x, z);
    let r = 110, g = 150, b = 95;
    if (h >= 0) {
      const def = BLOCKS[world.get(x, h, z)];
      const c = hexToRgb(def ? def.ui : '#888');
      const f = 0.65 + 0.35 * Math.min(1, h / 14);   // higher ground = brighter
      r = c[0] * f; g = c[1] * f; b = c[2] * f;
    }
    const i = (z * SX + x) * 4;
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  mmTerrainCtx.putImageData(img, 0, 0);
  minimapDirty = false;
}
function drawMinimap() {
  if (!mmCtx) return;
  if (minimapDirty) renderMinimapTerrain();
  const s = MM_SIZE / SX;
  mmCtx.imageSmoothingEnabled = false;
  mmCtx.clearRect(0, 0, MM_SIZE, MM_SIZE);
  mmCtx.drawImage(mmTerrain, 0, 0, SX, SZ, 0, 0, MM_SIZE, MM_SIZE);
  // portal markers — purple when open, dim grey while a reward is still locked
  for (const p of world.portals) {
    const locked = (dimension === 'over' && !portalUnlocked && p.dest === 'nether');
    mmCtx.strokeStyle = locked ? '#9a9aa0' : '#c89cff';
    mmCtx.fillStyle = locked ? 'rgba(120,120,130,0.7)' : 'rgba(150,90,230,0.9)';
    mmCtx.lineWidth = 2;
    const ox = p.a[0] * s, oz = p.a[2] * s;
    mmCtx.beginPath(); mmCtx.arc(ox, oz, 4.5, 0, Math.PI * 2); mmCtx.fill(); mmCtx.stroke();
  }
  // Steve's Lava Chicken stand (🍗 orange) + villagers (green) so they're easy
  // to find in the overworld.
  if (dimension === 'over') {
    const vs = mobs().villagers;
    if (vs) for (const v of vs.list) {
      mmCtx.fillStyle = '#6fbf5a'; mmCtx.strokeStyle = '#2f5a22'; mmCtx.lineWidth = 1;
      mmCtx.beginPath(); mmCtx.arc(v.pos[0] * s, v.pos[2] * s, 2.6, 0, Math.PI * 2); mmCtx.fill(); mmCtx.stroke();
    }
    if (stevePos) {
      mmCtx.fillStyle = '#ff8c1a'; mmCtx.strokeStyle = '#5a2e00'; mmCtx.lineWidth = 1.5;
      mmCtx.beginPath(); mmCtx.arc(stevePos[0] * s, stevePos[2] * s, 4, 0, Math.PI * 2); mmCtx.fill(); mmCtx.stroke();
    }
    // The Deep Vault — a gold ✦ showing where to dig down for the Relic (until claimed).
    if (world.vault && !goals.done.champion) {
      const vx = world.vault[0] * s, vz = world.vault[2] * s;
      mmCtx.fillStyle = '#ffe24a'; mmCtx.strokeStyle = '#8a6a00'; mmCtx.lineWidth = 1.5; mmCtx.font = 'bold 11px sans-serif'; mmCtx.textAlign = 'center'; mmCtx.textBaseline = 'middle';
      mmCtx.beginPath(); mmCtx.arc(vx, vz, 5, 0, Math.PI * 2); mmCtx.fill(); mmCtx.stroke();
      mmCtx.fillStyle = '#7a5a00'; mmCtx.fillText('✦', vx, vz + 0.5);
    }
  }
  // Secret World markers: rides (pink) + stands incl. the ticket booth (gold).
  if (dimension === 'secret') {
    const fp = mobs().funpark;
    if (fp) {
      for (const k of fp.kiosks) {
        mmCtx.fillStyle = '#ff4d88'; mmCtx.strokeStyle = '#7a1840'; mmCtx.lineWidth = 1.5;
        mmCtx.beginPath(); mmCtx.arc(k.pos[0] * s, k.pos[2] * s, 4, 0, Math.PI * 2); mmCtx.fill(); mmCtx.stroke();
      }
      for (const st of fp.stands) {
        mmCtx.fillStyle = '#ffcf33'; mmCtx.strokeStyle = '#7a5a00'; mmCtx.lineWidth = 1.5;
        mmCtx.beginPath(); mmCtx.arc(st.pos[0] * s, st.pos[2] * s, 4, 0, Math.PI * 2); mmCtx.fill(); mmCtx.stroke();
      }
    }
  }
  // Space World: a gold marker for the next race ring + a white marker for
  // Captain Nova the astronaut, so both are easy to find on the big moon.
  if (dimension === 'space') {
    if (spaceRace) {
      const g = spaceRace.nextGate();
      if (g) {
        mmCtx.fillStyle = '#ffd11a'; mmCtx.strokeStyle = '#7a5a00'; mmCtx.lineWidth = 1.5;
        mmCtx.beginPath(); mmCtx.arc(g[0] * s, g[2] * s, 4.5, 0, Math.PI * 2); mmCtx.fill(); mmCtx.stroke();
      }
    }
    const ast = mobs().astronaut;
    if (ast) for (const a of ast.list) {
      mmCtx.fillStyle = '#eaf2ff'; mmCtx.strokeStyle = '#3a5a9a'; mmCtx.lineWidth = 1.5;
      mmCtx.beginPath(); mmCtx.arc(a.pos[0] * s, a.pos[2] * s, 3.4, 0, Math.PI * 2); mmCtx.fill(); mmCtx.stroke();
    }
  }
  // player arrow (points the way you face)
  const px = player.pos[0] * s, pz = player.pos[2] * s;
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw), rx = -fz, rz = fx;
  mmCtx.fillStyle = '#fff'; mmCtx.strokeStyle = '#16335f'; mmCtx.lineWidth = 1.5;
  mmCtx.beginPath();
  mmCtx.moveTo(px + fx * 6, pz + fz * 6);
  mmCtx.lineTo(px - fx * 4 + rx * 4, pz - fz * 4 + rz * 4);
  mmCtx.lineTo(px - fx * 4 - rx * 4, pz - fz * 4 - rz * 4);
  mmCtx.closePath(); mmCtx.fill(); mmCtx.stroke();
}

// --- Render ---
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
}

let last = 0;
// The render loop is wrapped so a single bad frame can NEVER stop the game or
// pop the scary "Oops" screen — we log it, end any ride safely, and the next
// frame just carries on. (frameBody holds the real work.)
function frame(now) {
  try {
    frameBody(now);
  } catch (e) {
    softError(e && e.stack || e);
    if (ride) { try { endRide(); } catch (_) { } }   // never get stuck mid-ride
  }
  requestAnimationFrame(frame);
}
function frameBody(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  actionAnim = Math.max(0, actionAnim - dt * 3);
  shake = Math.max(0, shake - dt * 2.2);
  invuln = Math.max(0, invuln - dt);
  hurtFlash = Math.max(0, hurtFlash - dt);
  sinceHurt += dt;
  // Gentle, fairly quick regen (in half-hearts) once you've been safe a moment —
  // so getting hurt stings but you always climb back. Keeps an anxious kid in it.
  if (hearts > 0 && hearts < maxHearts && sinceHurt > 4) { regenT += dt; if (regenT >= 2.2) { regenT = 0; hearts = Math.min(maxHearts, hearts + 0.5); updateHearts(); } }
  // Golden-Apple bonus hearts count down, then gently fade away.
  if (heartBuffT > 0) { heartBuffT -= dt; if (heartBuffT <= 0) { heartBuff = 0; hearts = Math.min(hearts, maxHearts); updateHearts(); } }
  // Steve's math 💎 pouch refills slowly (caps how fast math earns diamonds).
  if (mathPouch < MATH_POUCH_MAX) { mathRefillT += dt; if (mathRefillT >= 30) { mathRefillT = 0; mathPouch++; } }
  // Auto-night timer: count down play-time while it's day, then fall to night the
  // next time he's home in the overworld; lift back to day after a while.
  if (!night) { autoNightT -= dt; if (autoNightT <= 0 && dimension === 'over' && !pendingBuild) startAutoNight(); }
  else if (nightAuto) { autoNightLeft -= dt; if (autoNightLeft <= 0) endAutoNight(); }
  const nightTarget = (night && dimension === 'over') ? 1 : 0;
  nightAmt += (nightTarget - nightAmt) * Math.min(1, dt * 1.5);
  if (hurtEl) hurtEl.style.opacity = (hurtFlash * 0.9).toFixed(3);

  controls.frame();
  applyLook();
  // Resting on a pillow: hold still and fill hearts; any move/jump gets you up.
  if (resting && (Math.hypot(controls.moveX, controls.moveY) > 0.2 || controls.jump)) getUp();
  if (resting) {
    player.vel = [0, 0, 0];
    resting.zt += dt;
    if (hearts < effMax()) { hearts = Math.min(effMax(), hearts + dt * 0.7); updateHearts(); }
    if (resting.zt >= 2.4) { resting.zt = 0; spawnParticles([player.pos[0], player.pos[1] + 1.0, player.pos[2]], '💤', 'heart', 1, 14); }
  } else if (ride) updateRide(dt);
  else player.update(dt, controls, camYaw);
  // Rocket blast-off: lift him skyward for ~1s so launch really feels like LIFTOFF
  // (fly physics resets vel each frame, so we nudge the position directly).
  if (rocketKick > 0) { rocketKick = Math.max(0, rocketKick - dt); player.pos[1] = Math.min(SY - 2, player.pos[1] + 12 * dt); player.onGround = false; }
  cameraFollow(dt);
  const dxm = player.pos[0] - prevX, dzm = player.pos[2] - prevZ;
  const dm = Math.hypot(dxm, dzm);
  if (dm > 0.0005 && dm < 2) goals.onMove(dm);
  prevX = player.pos[0]; prevZ = player.pos[2];

  // Friendly first-time blurbs when you wander near something new (overworld).
  if (dimension === 'over') {
    if (stevePos) { const dx = player.pos[0] - stevePos[0], dz = player.pos[2] - stevePos[2]; if (dx * dx + dz * dz < 30) tip('steve', '🍗 Tap Steve for math games and snacks!'); }
    const vs = mobs().villagers;
    if (vs) for (const v of vs.list) { const dx = player.pos[0] - v.pos[0], dz = player.pos[2] - v.pos[2]; if (dx * dx + dz * dz < 16) { tip('villager', '🧑‍🌾 Tap a villager for a job + 💎!'); break; } }
    // First time underground in the dark → nudge toward torches.
    if (world.skyLight) {
      const px = player.pos[0] | 0, py = player.pos[1] | 0, pz = player.pos[2] | 0;
      if (py > 1 && py < SY && px >= 0 && px < SX && pz >= 0 && pz < SZ && world.skyLight[world.idx(px, py, pz)] === 0)
        tip('darkcave', '🌑 So dark! Open the Light 💡 tab and place Torches to see your way.');
    }
  }

  // Step into a portal swirl → travel to its destination world.
  portalCooldown = Math.max(0, portalCooldown - dt);
  portalHintTimer = Math.max(0, portalHintTimer - dt);
  if (portalCooldown === 0 && !ride) {
    const bx = Math.floor(player.pos[0]), bz = Math.floor(player.pos[2]);
    const p = world.portalAt(bx, Math.floor(player.pos[1] + 0.4), bz) || world.portalAt(bx, Math.floor(player.pos[1] + 1.2), bz);
    if (p) travelTo(p.dest);
    else if (dimension === 'over' && !portalUnlocked && portalHintTimer === 0) {
      const np = world.portals.find((q) => q.dest === 'nether');
      if (np) {
        const dx = player.pos[0] - np.a[0], dz = player.pos[2] - np.a[2];
        if (dx * dx + dz * dz < 2.6) { showToast('Earn ⭐' + NETHER_STARS + ' to open the Nether! (You have ⭐' + goals.stars + ')'); portalHintTimer = 4; }
      }
    }
  }

  // Space World: drop below the moon floor (a hidden black hole) → whoosh home.
  if (dimension === 'space' && portalCooldown === 0 && player.pos[1] < 3) blackHoleWhoosh();

  // The grand quest: reaching the deep ticks the "dig deep" stage (once).
  if (dimension === 'over' && player.pos[1] <= 4 && (goals.counts.wentdeep || 0) < 1) {
    goals.bump('wentdeep'); updateQuestButton();
    tip('deep', "🕳️ You're deep underground! The Legendary Relic is near — find the gold ✦ on your map (top-right).");
  }

  // Rocket: tick the launch countdown (3-2-1-blast off), then watch for crashes.
  if (rocketState === 'countdown') {
    const was = Math.ceil(rocketCountT);
    rocketCountT -= dt;
    const now = Math.ceil(rocketCountT);
    if (now !== was && now >= 1) { showToast('🚀 ' + now + '…', 900); sound.play('fuse'); }
    if (rocketCountT <= 0) rocketLiftoff();
  }
  rocketBoost += (((rocketState === 'flying' && (controls.jump || player.moveAmt > 0.2)) ? 1 : (rocketState === 'flying' ? 0.4 : 0)) - rocketBoost) * Math.min(1, dt * 6);
  if (rocketState === 'flying' || dragonRiding) flightCrashCheck();

  // Tick lit TNT fuses → detonate when they reach zero.
  for (let i = fuses.length - 1; i >= 0; i--) {
    fuses[i].t -= dt;
    if (fuses[i].t > 0) continue;
    const f = fuses.splice(i, 1)[0];
    if (isTNT(world.get(f.x, f.y, f.z))) detonate(f.x, f.y, f.z);
  }

  updateAdventureButton();          // gold ring on 📖 when a chapter is ready to claim
  updateBuddy(dt);                   // the friend strolls up now and then

  const m = mobs();
  updateMobs(m, dt);
  if (dimension === 'space') { ensureSpaceRace(); spaceRace.update(dt, player, player.flying); }
  growSaplings(dt);
  world.flushDirty(fuses.length ? 6 : 2);   // catch up faster while things are blowing up

  resize();
  gl.viewport(0, 0, canvas.width, canvas.height);
  const rsky = [sky[0] + (NIGHT_SKY[0] - sky[0]) * nightAmt, sky[1] + (NIGHT_SKY[1] - sky[1]) * nightAmt, sky[2] + (NIGHT_SKY[2] - sky[2]) * nightAmt];
  const dayLight = 1 - 0.6 * nightAmt;
  gl.clearColor(rsky[0], rsky[1], rsky[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const aspect = canvas.width / Math.max(1, canvas.height);
  mat4.perspective(proj, 1.05, aspect, 0.08, 220);   // far plane reaches across the bigger world
  camDistEased += (camDist - camDistEased) * Math.min(1, dt * 8); // smooth zoom
  computeCamera();
  if (controls.tapPending && pendingBuild) { controls.tapPending = false; }   // placing a big build — taps do nothing (use the Build button)
  if (controls.tapPending && resting) { controls.tapPending = false; getUp(); }   // tap anywhere to get off the pillow
  if (controls.tapPending && fishing && fishing.phase === 'bite') { controls.tapPending = false; hookCatch(); }   // tap anywhere to hook a biting fish
  if (controls.tapPending) {
    controls.tapPending = false;
    const dir = screenRay(controls.tapX, controls.tapY);
    const fk = (!ride && m.funpark) ? m.funpark.pickRay(camPos, dir) : null;   // Secret World rides
    const dg = (!fk && m.dragon) ? m.dragon.pickRay(camPos, dir) : null;   // The End: crystals + dragon
    const cr = (!dg && m.creepers) ? m.creepers.pickRay(camPos, dir) : null;
    const zb = (!dg && !cr && m.zombies) ? m.zombies.pickRay(camPos, dir) : null;
    const sp = (!dg && !cr && !zb && m.spiders) ? m.spiders.pickRay(camPos, dir) : null;
    const sk = (!dg && !cr && !zb && !sp && m.skeletons) ? m.skeletons.pickRay(camPos, dir) : null;
    const vl = (!dg && !cr && !zb && !sp && !sk && m.villagers) ? m.villagers.pickRay(camPos, dir) : null;
    const as = (!dg && !cr && !zb && !sp && !sk && !vl && m.astronaut) ? m.astronaut.pickRay(camPos, dir) : null;
    const bd = (!dg && !cr && !zb && !sp && !sk && !vl && !as && buddy && dimension === 'over') &&
      rayHitsSphere(camPos, dir, buddy.pos[0], buddy.pos[1] + 0.9, buddy.pos[2], 1.2);
    const stv = (!dg && !cr && !zb && !sp && !sk && !vl && !bd && stevePos && dimension === 'over') &&
      rayHitsSphere(camPos, dir, stevePos[0], stevePos[1] + 0.9, stevePos[2], 1.2);
    if (ride) { /* enjoying a ride — taps do nothing */ }
    else if (fk) { if (fk.kind === 'stand') openStand(fk.id); else openRidePrompt(rideById(fk.id)); }
    else if (dg) doDragonTap(dg);
    else if (cr) doDefend(cr);
    else if (zb) doBonkZombie(zb);
    else if (sp) doBonkSpider(sp);
    else if (sk) doBonkSkeleton(sk);
    else if (vl) talkToVillager(vl);
    else if (as) talkToAstronaut(as);
    else if (bd) openAdventure();
    else if (stv) openSteveMenu();
    else if (flintMode) flintTap(dir);     // flint & steel: light TNT / a portal frame
    else {
      const hit = world.raycast(camPos, dir, REACH);
      const bid = hit ? world.get(hit.block[0], hit.block[1], hit.block[2]) : 0;
      if (hit && isDoor(bid)) toggleDoor(hit.block[0], hit.block[1], hit.block[2]);
      else if (hit && isBed(bid)) sleepInBed(hit.block[0], hit.block[1], hit.block[2]);
      else if (hit && bid === B.PILLOW) lieDown(hit.block[0], hit.block[1], hit.block[2]);
      else if (hit && bid === B.PUZZLE) openPuzzle();
      else if (hit && (bid === B.LEVER || bid === B.LEVER_ON)) toggleLever(hit.block[0], hit.block[1], hit.block[2]);
      else if (hit && bid === B.NOTE_BLOCK) playNoteBlock(hit.block[0], hit.block[1], hit.block[2]);
      else if (hit && bid === B.CRAFTING) openCrafting();
      else if (hit && bid === B.FURNACE) openFurnace();
      else if (hit && bid === B.RELIC) claimVault();
      else if (hit && isTNT(bid)) lightTNT(hit.block[0], hit.block[1], hit.block[2]);
      else doAction(hit);
    }
  }
  mat4.multiply(pv, proj, view);

  // Fishing: count down to a bite, keep the bobber on the water.
  if (fishing) {
    if (fishing.phase === 'wait') { fishing.t -= dt; if (fishing.t <= 0) startBite(); }
    else if (fishing.phase === 'bite') { fishing.biteT -= dt; if (fishing.biteT <= 0) missBite(); }
    positionBobber(fishing);
  }

  updateRideSigns();   // floating "Tap to ride!" signs over Secret World attractions

  // Sparkle Trail (shop reward): drop little ✨ behind you while you move.
  if (goals.hasUnlock('sparkle')) {
    trailT -= dt;
    if (player.moveAmt > 0.45 && trailT <= 0) {
      trailT = 0.09;
      spawnParticles([player.pos[0], player.pos[1] + 0.3, player.pos[2]], '✨', 'puff', 1, 26);
    }
  }

  // Gradient sky backdrop (drawn behind everything, no depth) — saturated up top,
  // a soft hazy band near the horizon that the fog blends into.
  {
    const lift = 0.40 * (1 - 0.72 * nightAmt);
    const sHor = [Math.min(1, rsky[0] * 0.62 + lift), Math.min(1, rsky[1] * 0.62 + lift), Math.min(1, rsky[2] * 0.62 + lift + 0.03)];
    const sTop = [rsky[0] * 0.80, rsky[1] * 0.87, Math.min(1, rsky[2] * 1.06)];
    gl.useProgram(skyProg.program);
    gl.disable(gl.DEPTH_TEST);
    gl.uniform3f(skyProg.u.uTop, sTop[0], sTop[1], sTop[2]);
    gl.uniform3f(skyProg.u.uHorizon, sHor[0], sHor[1], sHor[2]);
    skyMesh.draw(skyProg);
    gl.enable(gl.DEPTH_TEST);
  }

  const kind = WORLD_KINDS[dimension];
  gl.useProgram(worldProg.program);
  gl.uniformMatrix4fv(worldProg.u.uProj, false, proj);
  gl.uniformMatrix4fv(worldProg.u.uView, false, view);
  gl.uniformMatrix4fv(worldProg.u.uModel, false, identity);
  gl.uniform3f(worldProg.u.uFogColor, rsky[0], rsky[1], rsky[2]);
  gl.uniform1f(worldProg.u.uFogNear, kind.fog[0] * 1.5);   // open up the view for the bigger world
  gl.uniform1f(worldProg.u.uFogFar, kind.fog[1] * 1.7);
  gl.uniform1f(worldProg.u.uAlpha, 1);
  gl.uniform1f(worldProg.u.uDayLight, dayLight);
  // Ambient floor: only the overworld goes truly dark underground (so its caves
  // need torches). Every other world keeps a bright floor — nothing surprising
  // ever goes dark in Lego/Build/Secret/Space/etc.
  gl.uniform1f(worldProg.u.uAmbient, dimension === 'over' ? 0.18 : 0.42);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, atlas);
  gl.uniform1i(worldProg.u.uTex, 0);

  world.draw(worldProg);
  // While riding, the pony tracks the player and the kid sits up on its back.
  if (riding) {
    riding.pos[0] = player.pos[0]; riding.pos[1] = player.pos[1]; riding.pos[2] = player.pos[2];
    riding.yaw = player.yaw; riding.walking = player.moving;
  }
  drawShadows(m);
  drawBuildPreview();                                      // green "build here" footprint
  // The Space Rover sits at the player's feet; the kid is drawn seated on top.
  if (roving) { roverT += dt; ensureRover(); rover.draw(worldProg, player.pos[0], player.pos[1], player.pos[2], player.yaw, player.moveAmt, roverT); }
  // The Flying Dragon — wings beat faster while climbing/moving.
  if (dragonRiding) {
    dragonT += dt; ensureDragonMount();
    const climb = (controls.jump ? 1 : 0.3) + player.moveAmt * 0.5;
    dragonMount.draw(worldProg, player.pos[0], player.pos[1], player.pos[2], player.yaw, dragonT, climb);
  }
  // The Rocket — sits on the pad, then flames out when it flies.
  if (rocketState !== 'off') {
    rocketT += dt; ensureRocket();
    rocketShip.draw(worldProg, player.pos[0], player.pos[1], player.pos[2], player.yaw, rocketBoost, rocketT);
  }
  // Engine hum: idles when seated, revs up as you drive. Only touch it on change.
  const wantEngine = roving ? (player.moveAmt > 0.15 ? roverSpeedIdx + 1 : 1) : 0;
  if (wantEngine !== engineLevel) { engineLevel = wantEngine; sound.engine(engineLevel); }
  const seatRide = ride && ride.att.id !== 'balloon';     // sit in the gondola/carousel
  const seated = !!riding || !!seatRide || roving || dragonRiding || rocketState !== 'off';
  character.draw(worldProg, player.pos[0], player.pos[1] + (seated ? 0.62 : 0), player.pos[2], player.yaw, player.walkPhase, player.moveAmt, actionAnim, seated, !!resting);
  drawMobs(m);
  if (dimension === 'space') { ensureSpaceRace(); spaceRace.draw(worldProg, now / 1000); }
  // Steve mans his Lava Chicken stand in the overworld, turning to face you.
  if (stevePos && dimension === 'over') {
    let dd = Math.atan2(-(player.pos[0] - stevePos[0]), -(player.pos[2] - stevePos[2])) - steveYaw;
    while (dd > Math.PI) dd -= Math.PI * 2;
    while (dd < -Math.PI) dd += Math.PI * 2;
    steveYaw += dd * Math.min(1, dt * 4);
    steveChar.draw(worldProg, stevePos[0], stevePos[1], stevePos[2], steveYaw, 0, 0, 0, false);
  }
  drawBuddy();

  drawMinimap();

  // Autosave.
  if (saveDirty && now - lastSave > 6000) { saveGame(); lastSave = now; }
}

// --- Save / load (v4: a map of worlds; still reads old v3/v2 saves) ---
function saveGame() {
  try {
    positions[dimension] = player.pos.slice();
    const ws = {};
    for (const k of Object.keys(worlds)) ws[k] = worlds[k].world.serialize();
    const obj = {
      v: 4, dim: dimension, sel: selected, zoom: zoomIndex, yaw: player.yaw, pu: portalUnlocked,
      char: selectedChar, worlds: ws, pos: positions,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(obj));
    saveDirty = false;
  } catch (e) { /* ignore quota errors */ }
}

function loadGame() {
  let obj;
  try { obj = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return false; }
  if (!obj) return false;
  if (typeof obj.sel === 'number' && BLOCKS[obj.sel]) selected = obj.sel;
  if (typeof obj.char === 'string') selectedChar = charById(obj.char).id;   // resolves old ids too
  if (typeof obj.zoom === 'number' && VIEW_PRESETS[obj.zoom]) {
    zoomIndex = obj.zoom; camDist = camDistEased = VIEW_PRESETS[zoomIndex].dist;
    if (VIEW_PRESETS[zoomIndex].pitch != null) camPitch = VIEW_PRESETS[zoomIndex].pitch;
  }
  portalUnlocked = !!obj.pu;
  try {
    if (obj.v === 4 && obj.worlds) {                       // current multi-world save
      for (const k of WORLD_ORDER) {
        const data = obj.worlds[k];
        if (!data || !WORLD_KINDS[k]) continue;
        const w = new World(gl);
        w[WORLD_KINDS[k].gen]();              // fresh terrain first (so a grown world has land around old builds)
        if (!w.loadFrom(data)) { if (k === 'over') return false; continue; }
        if (k === 'space') migrateSpaceIfOld(w);   // upgrade old floating-island space → the new moon (keeps builds)
        registerDim(k, w);
      }
      if (!worlds.over) return false;
      worlds.over.world.carveBeachIfClear();
      for (const k of Object.keys(worlds)) { tidyPortals(k); regroundHome(k); worlds[k].world.rebuildAll(); }
      Object.assign(positions, obj.pos || {});
      // If a migrated Space World left the arrival point hanging over the void,
      // drop it onto the new moon so you never load mid-fall.
      if (worlds.space) {
        const sw = worlds.space.world, p = positions.space;
        if (!p || sw.heightAt(Math.floor(p[0]), Math.floor(p[2])) < 2) positions.space = sw.spawn.slice();
      }
      setDimension(worlds[obj.dim] ? obj.dim : 'over');
      player.yaw = obj.yaw || 0;
      player.pos = (positions[dimension] || world.spawn).slice();
      return true;
    }
    if (obj.v === 3 && obj.over) {                         // older two-dimension save
      const over = new World(gl); over.generate();
      if (!over.loadFrom(obj.over)) return false;
      over.carveBeachIfClear();
      registerDim('over', over);
      const neth = new World(gl); neth.generateNether();
      if (obj.nether) neth.loadFrom(obj.nether);
      registerDim('nether', neth);
      positions.over = (obj.overPos || over.spawn).slice();
      positions.nether = (obj.netherPos || neth.spawn).slice();
      setDimension(obj.dim === 'nether' ? 'nether' : 'over');
      player.yaw = obj.yaw || 0;
      player.pos = positions[dimension].slice();
      return true;
    }
    if (obj.world) {                                       // oldest overworld-only save
      const over = new World(gl); over.generate();
      if (!over.loadFrom(obj.world)) return false;
      over.carveBeachIfClear();
      registerDim('over', over);
      const neth = new World(gl); neth.generateNether(); registerDim('nether', neth);
      setDimension('over');
      player.yaw = (obj.player && obj.player.yaw) || 0;
      player.pos = (obj.player ? obj.player.pos.slice() : over.spawn.slice());
      positions.over = player.pos.slice();
      return true;
    }
  } catch (e) { console.error('loadGame failed (starting fresh):', e && e.stack || e); }
  return false;
}

// Space World got a big terrain redesign (sparse floating islands → a solid,
// drivable moon with black holes). An old save would otherwise keep the old
// terrain; detect it and rebuild the moon, but KEEP every block Ezra placed.
function migrateSpaceIfOld(w) {
  let solid = 0;
  const pts = [[8, 8], [SX - 8, 8], [8, SZ - 8], [SX - 8, SZ - 8], [SX >> 2, SZ >> 2], [(SX * 3) >> 2, (SZ * 3) >> 2]];
  for (const [x, z] of pts) if (w.heightAt(x, z) >= 4) solid++;
  if (solid >= 4) return;                          // already the new moon — leave it alone
  const keep = [];
  for (const k of w.placed) keep.push([k, w.data[k]]);   // remember his builds
  w.generateSpace();                               // fresh moon + black holes
  for (const [k, id] of keep) if (id) { w.data[k] = id; w.placed.add(k); }   // stamp builds back
}

function freshStart() {
  ensureDim('over');
  ensureDim('nether');
  setDimension('over');
  player.goHome();
  positions.over = player.pos.slice();
}

function init() {
  gl = initGL(canvas);
  worldProg = makeWorldProgram(gl);
  skyProg = makeSkyProgram(gl); skyMesh = skyQuad(gl);
  atlas = makeAtlasTexture(gl);

  identity = mat4.identity(mat4.create());
  proj = mat4.create(); view = mat4.create(); pv = mat4.create();
  scratch4 = new Float32Array(4);
  shadow = shadowMesh(gl); mShadow = mat4.create();
  buildPreview = quadMesh(gl, [0.15, 0.85, 1.0]);    // bright cyan "build here" footprint (pops on grass + plaza)

  sound = new Sound();
  goals = new Goals();
  goals.onComplete = (g) => { showGoalToast(g); refreshGoalsButton(); maybeUnlockNether(false); updateGems(); };
  character = new Character(gl);
  steveChar = new Character(gl); steveChar.setCharacter(charById('steve'));
  controls = new Controls(canvas);

  if (!loadGame()) freshStart();

  player.onSplash = (pos) => { sound.play('splash'); spawnSplash(pos); goals.bump('splash'); saveDirty = true; };
  player.onLava = () => hurt(1);
  player.onBounce = (pos) => { sound.play('boing'); spawnParticles(pos, '✨', 'puff', 2, 22); goals.bump('bounce'); };
  maybeUnlockNether(true);                       // open now if a returning player already qualifies

  camYaw = player.yaw;
  prevX = player.pos[0]; prevZ = player.pos[2];
  initMinimap();
  wireUI();
  hurtEl = document.getElementById('hurt-flash');
  applyUnlocks();
  applyCharacter();
  ensurePet();
  ensurePony();
  updateRoverButton();
  updateRocketButton();
  updateDragonButton();
  setupSteve();
  if (!goals.adv) startChapter(0);     // begin the adventure (captures "from now" baselines)
  setupBuddy();
  recheckBuild();
  updateAdventureButton();
  updateHearts();
  updateNightButton();
  updateGems();
  updateInventory();
  syncHeldTool();
  updateQuestButton();

  // Resume audio on first interaction.
  const firstTouch = () => {
    sound.resume();
    window.removeEventListener('pointerdown', firstTouch);
  };
  window.addEventListener('pointerdown', firstTouch);

  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  window.addEventListener('beforeunload', () => { if (saveDirty) saveGame(); goals.save(); });
  window.addEventListener('pagehide', () => { if (saveDirty) saveGame(); goals.save(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (saveDirty) saveGame(); goals.save(); } });

  // Only enable the offline service worker in production (HTTPS), so local
  // previews always load the latest files.
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => { });
  }

  // Lightweight debug handle (handy for support and automated demos).
  window.__ezra = {
    get world() { return world; }, player, worlds,
    get animals() { return mobs().animals; },
    get creepers() { return mobs().creepers; },
    get nethermobs() { return mobs().nethermobs; },
    get ants() { return mobs().ants; },
    get zombies() { return mobs().zombies; },
    get spiders() { return mobs().spiders; },
    get skeletons() { return mobs().skeletons; },
    get villagers() { return mobs().villagers; },
    get dragon() { return mobs().dragon; },
    popCrystals: () => { const d = mobs().dragon; if (d) d.crystals.forEach((c) => doDragonTap({ kind: 'crystal', c })); },
    tameDragon: () => { const d = mobs().dragon; if (d) doDragonTap({ kind: 'dragon' }); },
    cam: () => ({ yaw: camYaw, pitch: camPitch, pos: camPos.slice(), dir: camDir.slice() }),
    setView: (y, p) => { camYaw = y; if (p != null) camPitch = p; },
    target: () => targetCells(),
    rayHit: (x, y) => rayHitAt(x, y),
    sel: () => selected,
    dim: () => dimension,
    portalOpen: () => portalUnlocked,
    hearts: () => hearts,
    hurt: (n) => hurt(n),
    night: () => night,
    crown: () => character.wearCrown,
    sword: () => character.holdSword,
    gems: () => goals.gems,
    openCraft: () => openCrafting(),
    craft: (tier) => { const r = RECIPES.find((x) => x.tier === tier); if (r) craftItem(r); },
    openFurnace: () => openFurnace(),
    smelt: (n) => doSmelt(n || 1),
    craftArmor: (tier) => { const r = ARMOR_RECIPES.find((x) => x.tier === tier); if (r) craftArmor(r); },
    armorTier: () => goals.armorTier(),
    vault: () => (world.vault ? world.vault.slice() : null),
    openQuest: () => openQuestJournal(),
    claimVault: () => claimVault(),
    goDeep: () => { const v = world.vault; if (v) { player.pos = [v[0] + 0.5, v[1], v[2] + 0.5]; player.vel = [0, 0, 0]; } },
    champion: () => !!goals.done.champion,
    pickTier: () => goals.pickTier(),
    holdPick: () => character.holdPick,
    inventory: () => ({ ...goals.items, pick: goals.pickTier() }),
    giveMaterials: (n = 9) => { for (const k of ['wood', 'stone', 'coal', 'iron']) goals.addItem(k, n); updateInventory(); },
    mine: (x, y, z) => doDig({ block: [x, y, z] }),    // dig a specific cell (exercises the collect/gating path)
    breaking: () => breaking,                          // current break-time chip progress
    caveAir: () => { let a = 0; const w = world; for (let i = 0; i < w.data.length; i++) if (w.data[i] === B.AIR) a++; return a; },
    buy: (idd) => { const it = SHOP.find((s) => s.id === idd); if (it) buyItem(it); },
    resetWorld: () => resetWorld(),
    travelTo: (k) => travelTo(k),
    get funpark() { return mobs().funpark; },
    funRide: (id) => { const a = ATTRACTIONS.find((x) => x.id === id); if (a) { openRidePrompt(a); confirmRide(); } },
    openStand: (id) => openStand(id),
    buyTreat: (i) => buyTreat(TREATS[i || 0]),
    placeBuild: (name) => { const b = BIG_BUILDS.find((x) => x.name === name); if (b) startPlacement(b); },
    confirmPlace: () => confirmPlacement(),
    save: () => saveGame(),
    saveSize: () => (localStorage.getItem(SAVE_KEY) || '').length,
    placing: () => (pendingBuild ? pendingBuild.name : null),
    endFunRide: () => { if (ride) endRide(); },
    funRiding: () => (ride ? ride.att.id : null),
    lightPortal: (k) => lightPortal(k),
    enterPortal: () => travelTo(dimension === 'over' ? 'nether' : 'over'),
    goals,
    spawnCreeper: () => { const c = mobs().creepers; if (c) c.spawnNow(player); },
    lightTNT: (x, y, z) => lightTNT(x, y, z),
    toggleLever: (x, y, z) => toggleLever(x, y, z),
    flint: () => flintMode,
    toggleFlint: () => { flintMode = !flintMode; updateFlintButton(); },
    findFrame: (x, y, z) => world.findFrame(x, y, z),
    lightFrame: (x, y, z, dest) => { const c = world.findFrame(x, y, z); if (!c) return false; pendingFrame = c; lightChosenFrame(dest); return true; },
    riding: () => !!riding,
    toggleRide: () => toggleRide(),
    roving: () => roving,
    roverSpeed: () => roverSpeedIdx,
    toggleRover: () => toggleRover(),
    setRoverSpeed: (i) => setRoverSpeed(i),
    blackHoles: () => (world.blackHoles || []),
    blackHole: () => blackHoleWhoosh(),
    dragonRiding: () => dragonRiding,
    toggleDragon: () => toggleDragon(),
    toggleRocket: () => toggleRocket(),
    rocketState: () => rocketState,
    rocketLaunch: () => { if (rocketState === 'off') toggleRocket(); if (rocketState === 'ready') toggleRocket(); },
    crashFlight: () => crashFlight(),
    flightCrash: () => flightCrashCheck(),
    _liftoff: () => { ensureRocket(); rocketState = 'ready'; rocketLiftoff(); },
    race: () => spaceRace && { current: spaceRace.current, total: spaceRace.gates.length, finished: spaceRace.finished, time: spaceRace.time },
    nextGate: () => spaceRace && spaceRace.nextGate(),
    flyThroughGate: () => { if (spaceRace) { const g = spaceRace.nextGate(); if (g) { player.pos = [g[0], g[1], g[2]]; player.flying = true; } } },
    forceNight: () => startAutoNight(),
    endNight: () => endAutoNight(),
    autoNightT: () => autoNightT,
    setNightTimer: (s) => { autoNightT = s; },
    nightInfo: () => ({ night, nightAuto, autoNightT, autoNightLeft }),
    aliencops: () => { const a = mobs().aliencops; return a ? a.list : []; },
    fishing: () => (fishing ? fishing.phase : false),
    castLine: () => castLine(),
    bite: () => { if (fishing && fishing.phase === 'wait') startBite(); return fishing && fishing.catch; },
    catchFish: () => { if (fishing) { if (fishing.phase !== 'bite') startBite(); hookCatch(); } },
    reelNow: () => { if (fishing) reelIn(); },
    waterSize: (x, y, z) => waterBodySize(x, y, z),
    talkVillager: () => { const v = mobs().villagers; if (v && v.list.length) talkToVillager(v.list[0]); },
    questOk: () => questOk(),
    astronaut: () => { const a = mobs().astronaut; return a ? a.list : []; },
    talkAstronaut: () => { const a = mobs().astronaut; if (a && a.list.length) talkToAstronaut(a.list[0]); },
    astroOk: () => astroOk(),
    lieDown: (x, y, z) => lieDown(x != null ? x : Math.floor(player.pos[0]), y != null ? y : Math.floor(player.pos[1]) - 1, z != null ? z : Math.floor(player.pos[2])),
    sleepBed: (x, y, z) => sleepInBed(x, y, z),
    getUp: () => getUp(),
    resting: () => !!resting,
    restingBed: () => !!(resting && resting.bed),
    openPuzzle: () => openPuzzle(),
    puzzleState: () => (puzzle ? { level: puzzle.level, seq: puzzle.seq.slice(), pos: puzzle.pos, showing: puzzle.showing } : null),
    puzzleSolve: () => { if (!puzzle) return; puzzle.showing = false; const s = puzzle.seq.slice(); for (const c of s) puzzleTap(c); },
    puzzleMiss: () => { if (!puzzle) return; puzzle.showing = false; puzzleTap((puzzle.seq[0] + 1) % 4); },
    closePuzzle: () => closePuzzle(),
    setCharacter: (id) => { selectedChar = id; applyCharacter(); saveDirty = true; },
    character: () => selectedChar,
    openMath: () => openMath(),
    mathQ: () => mathQ,
    mathPouch: () => mathPouch,
    steve: () => stevePos,
    get buddy() { return buddy; },
    callBuddy: () => { if (buddy) buddy.timer = 0; },
    sleep: (x, y, z) => sleepInBed(x, y, z),
    openAdventure: () => openAdventure(),
    openSteve: () => openSteveMenu(),
    plant: (x, y, z) => { world.set(x, y, z, B.SAPLING); saplings.push({ world, x, y, z, t: 14 + Math.random() * 14 }); goals.bump('plant'); },
    growNow: () => { for (const s of saplings) s.t = 0; },
    saplingCount: () => saplings.length,
  };

  last = performance.now();
  requestAnimationFrame(frame);
}

try { init(); } catch (e) { showError(e && e.stack || e); }
