// Ezra's Blocks — entry point. Wires the worlds, player, creatures, touch
// controls, UI, rendering, and autosave together. Worlds are data-driven
// (see worlds.js): adding a new place is a recipe, not a rewrite.

import { mat4 } from './math.js';
import { initGL, makeWorldProgram, makeAtlasTexture, GLMesh, blockPreview, shadowMesh } from './gfx.js';
import { World, BLOCKS, CATEGORIES, B, SX, SY, SZ } from './world.js';
import { WORLD_KINDS, WORLD_ORDER } from './worlds.js';
import { Player } from './player.js';
import { Animals } from './animals.js';
import { Creepers } from './creepers.js';
import { NetherMobs } from './nethermobs.js';
import { Zombies } from './zombies.js';
import { Spiders } from './spiders.js';
import { Skeletons } from './skeletons.js';
import { Villagers } from './villagers.js';
import { Dragon } from './dragon.js';
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
let invuln = 0;                           // brief mercy window after taking damage
let hurtFlash = 0;                        // red screen flash timer
let regenT = 0, sinceHurt = 99;           // gentle heart regen when safe
let hurtEl = null;                        // cached red-flash overlay

function showError(msg) {
  const el = document.getElementById('error-overlay');
  if (el) {
    el.style.display = 'flex';
    el.querySelector('.msg').textContent = String(msg);
  }
}
window.addEventListener('error', (e) => showError(e.message || e.error || 'Unknown error'));
window.addEventListener('unhandledrejection', (e) => showError(e.reason && e.reason.message || e.reason || 'Promise error'));

let gl, worldProg, atlas, world, player, controls, sound, character, goals;
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
const ZOOM_LEVELS = [7.0, 4.5, 3.0];
let zoomIndex = 0;             // which level; remembered between sessions
let camDist = ZOOM_LEVELS[0];  // target follow distance
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
          tip('web', '🕸️ A spider web! It slows you down for a moment — keep moving, it wears off fast.');
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
  if (m.nethermobs) m.nethermobs.populate(SX, SZ);
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
  if (!riding) shadowAt(player.pos[0], player.pos[2], 0.9);
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
    [m.nethermobs, (a) => a.species === 'ghast' ? 1.7 : 1.0],
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
  minimapDirty = true;
}

// Travel through a gateway to another world, arriving at the matching portal.
function travelTo(dest) {
  if (!WORLD_KINDS[dest]) return;
  try {
    if (fishing) reelIn(false);               // reel in before leaving
    if (riding) dismount();                   // the pony stays home in the overworld
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
const HUB_DESTS = ['gold', 'ant', 'tnt', 'sky', 'end'];
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
  if (isRedstone(selected)) {
    world.updateRedstone();   // a new wire/lamp may light up
    tip('redstone', '⚙️ Redstone! Put a Lamp next to a Lever (or join them with Redstone wire), then tap the Lever to switch the light on and off!');
  }
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
  if (world.isPortalBlock(x, y, z)) { sound.play('deny'); return; }   // portals can't be broken
  if (isDoor(id)) { removeDoor(x, y, z); return; }
  if (isBed(id)) { removeBed(x, y, z); return; }
  const key = world.idx(x, y, z);
  const wasPlaced = world.placed.has(key);
  world.set(x, y, z, B.AIR);
  world.placed.delete(key);
  sound.play('dig'); saveDirty = true; actionAnim = 1; minimapDirty = true;
  goals.onDig();
  if (isRedstone(id)) world.updateRedstone();   // removing wire can switch lamps off
  // Buried treasure! Natural gold/diamond the player dug up (not their own block).
  if (!wasPlaced && (id === B.GOLD || id === B.DIAMOND)) {
    goals.bump('treasure'); sound.play('treasure'); spawnSparkles([x + 0.5, y + 0.6, z + 0.5]);
    if (id === B.DIAMOND) { goals.bump('diamond'); goals.addGems(2); } else goals.addGems(1);
    updateGems();
  }
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
  tip('bed', '🛏️ A bed! Tap it to sleep — it turns night into morning, fills your hearts, and sets your 🏠 home right here.');
}
function sleepInBed(x, y, z) {
  night = false; updateNightButton();
  hearts = effMax(); updateHearts();
  world.spawn = [x + 0.5, y, z + 0.5];     // beds set your home, just like Minecraft
  sound.play('coo');
  spawnParticles([x + 0.5, y + 1.3, z + 0.5], '💤', 'heart', 3, 22);
  goals.bump('sleep');
  showToast('💤 …Zzz… ☀️ Good morning! Hearts full, and home set here!', 3200);
  saveDirty = true; minimapDirty = true;
}
function removeBed(x, y, z) {
  world.set(x, y, z, B.AIR); world.placed.delete(world.idx(x, y, z));
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (isBed(world.get(x + dx, y, z + dz))) { world.set(x + dx, y, z + dz, B.AIR); world.placed.delete(world.idx(x + dx, y, z + dz)); break; }
  }
  sound.play('dig'); saveDirty = true; actionAnim = 1; minimapDirty = true; goals.onDig();
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
function bigBuildSpot(dist) {
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  const cx = Math.max(4, Math.min(SX - 5, Math.round(player.pos[0] + fx * dist)));
  const cz = Math.max(4, Math.min(SZ - 5, Math.round(player.pos[2] + fz * dist)));
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
}
// A roomy house you can walk around inside: 5×5 floor, tall walls, a door
// facing you, big windows, and a glowstone ceiling lamp.
function buildHouse() {
  const { cx, cz, g, fx, fz, horiz } = bigBuildSpot(5);
  const wall = solidSelected();
  const y0 = g + 1, H = 4;                 // interior floor level + a tall ceiling
  let n = levelPad(cx, cz, 3, g, B.PLANKS);  // a clean, flat floor even on a hill
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
    n += bigSet(cx + dx, y0 + H, cz + dz, B.PLANKS);       // roof
    const edge = (Math.abs(dx) === 3 || Math.abs(dz) === 3);
    for (let dy = 0; dy < H; dy++) {
      if (edge) n += bigSet(cx + dx, y0 + dy, cz + dz, wall);   // walls
      else bigSet(cx + dx, y0 + dy, cz + dz, B.AIR);            // keep the inside open
    }
  }
  // Big windows midway up each wall so it's bright and you can see out (force —
  // they replace the wall blocks we just put up).
  for (let t = -1; t <= 1; t++) {
    bigSet(cx + t, y0 + 2, cz - 3, B.GLASS, true); bigSet(cx + t, y0 + 2, cz + 3, B.GLASS, true);
    bigSet(cx - 3, y0 + 2, cz + t, B.GLASS, true); bigSet(cx + 3, y0 + 2, cz + t, B.GLASS, true);
  }
  // A doorway on the wall facing you (so you walk straight in).
  const dX = horiz ? cx - 3 * sgn(fx) : cx;
  const dZ = horiz ? cz : cz - 3 * sgn(fz);
  bigSet(dX, y0, dZ, B.DOOR, true); bigSet(dX, y0 + 1, dZ, B.DOOR, true); bigSet(dX, y0 + 2, dZ, B.GLASS, true);
  goals.bump('doors');
  bigSet(cx, y0 + H - 1, cz, B.GLOWSTONE, true);   // a cozy ceiling lamp
  finishBigBuild(n, cx, y0, cz, '🏠 Your cozy house is ready — walk in the door!');
}
// A big flat floor of your chosen block — lay a whole patio in one tap.
function stampFloor() {
  const { cx, cz, g } = bigBuildSpot(5);
  const n = levelPad(cx, cz, 3, g, solidSelected());
  finishBigBuild(n, cx, g, cz, '🟫 A whole floor, done!');
}
// A long wall of your chosen block, standing across in front of you.
function stampWall() {
  const { cx, cz, g, horiz } = bigBuildSpot(4);
  const id = solidSelected();
  let n = 0;
  for (let i = -3; i <= 3; i++) for (let dy = 1; dy <= 4; dy++) {
    n += horiz ? bigSet(cx, g + dy, cz + i, id) : bigSet(cx + i, g + dy, cz, id);
  }
  finishBigBuild(n, cx, g + 2, cz, '🧱 A whole wall, done!');
}
const BIG_BUILDS = [
  { emoji: '🏠', name: 'Cozy House', fn: buildHouse, hint: 'A whole house you can walk around inside' },
  { emoji: '🟫', name: 'Big Floor', fn: stampFloor, hint: 'A big floor — pick the block first!' },
  { emoji: '🧱', name: 'Long Wall', fn: stampWall, hint: 'A whole wall — pick the block first!' },
];
function buildBuildMenu() {
  const body = document.getElementById('buildmenu-body');
  body.innerHTML = '';
  for (const b of BIG_BUILDS) {
    const btn = document.createElement('button');
    btn.className = 'portal-choice';
    btn.innerHTML = '<span class="pe">' + b.emoji + '</span><b>' + b.name + '</b><small>' + b.hint + '</small>';
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); closeBuildMenu(); b.fn(); });
    body.appendChild(btn);
  }
}
function openBuildMenu() { buildBuildMenu(); document.getElementById('buildmenu').classList.remove('hidden'); }
function closeBuildMenu() { document.getElementById('buildmenu').classList.add('hidden'); }

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
    character.holdSword = goals.hasUnlock('sword');
  }
  updateHearts();
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
  if (fishing) { reelIn(false); return; }      // tapping again reels in early
  const spot = findWaterSpot();
  if (!spot) { showToast('🎣 Find some water to fish in! 🌊  (try the beach)'); return; }
  fishing = { wx: spot[0], wy: spot[1], wz: spot[2], t: 1.6 + Math.random() * 2.4 };
  sound.play('splash');
  updateFishButton();
  tip('fishing', '🎣 Little ponds have little fish — find or build a BIG lake or ocean for bigger fish worth more 💎!');
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
function reelIn(caught) {
  const f = fishing; fishing = null; hideBobber(); updateFishButton();
  if (!f || !caught) { if (f) sound.play('splash'); return; }
  const size = waterBodySize(f.wx, f.wy - 1, f.wz);
  const r = Math.random();
  let icon, msg, gems;
  if (size < 8) {                 // a tiny puddle — only little minnows, no 💎 here
    if (r < 0.45) { icon = '🐟'; msg = 'a tiny minnow!'; }
    else if (r < 0.8) { icon = '🌿'; msg = 'some seaweed!'; }
    else { icon = '🥾'; msg = 'an old boot! Ha!'; }
    gems = 0;
  } else if (size < 32) {         // a decent pond
    if (r < 0.18) { icon = '🥾'; msg = 'an old boot! Ha!'; gems = 0; }
    else if (r < 0.38) { icon = '💎'; msg = 'sunken treasure! +2 💎'; gems = 2; goals.bump('treasure'); }
    else { icon = '🐟'; msg = 'a fish! +1 💎'; gems = 1; }
  } else {                        // a big lake or the ocean — BIG fish!
    if (r < 0.5) { icon = '🐠'; msg = 'a BIG fish! +2 💎'; gems = 2; }
    else if (r < 0.8) { icon = '💎'; msg = 'sunken treasure! +3 💎'; gems = 3; goals.bump('treasure'); }
    else { icon = '🐡'; msg = 'a HUGE fish! +3 💎'; gems = 3; }
  }
  goals.bump('fish');
  if (gems > 0) { goals.addGems(gems); updateGems(); }
  sound.play(gems > 0 ? 'treasure' : 'deny');
  spawnParticles([f.wx, f.wy + 0.4, f.wz], icon, 'heart', 1, 8);
  showToast('🎣 You caught ' + msg);
}
function positionBobber(f) {
  if (!bobberEl) bobberEl = document.getElementById('bobber');
  if (!bobberEl || !pv) return;
  mat4.transformPoint(scratch4, pv, f.wx, f.wy, f.wz);
  if (scratch4[3] <= 0) { bobberEl.style.display = 'none'; return; }
  bobberEl.style.display = 'block';
  bobberEl.style.left = (scratch4[0] / scratch4[3] * 0.5 + 0.5) * canvas.clientWidth + 'px';
  bobberEl.style.top = (1 - (scratch4[1] / scratch4[3] * 0.5 + 0.5)) * canvas.clientHeight + 'px';
  bobberEl.textContent = (f.t < 0.6) ? '🐠' : '🔴';   // a nibble! near the end
}
function hideBobber() { if (!bobberEl) bobberEl = document.getElementById('bobber'); if (bobberEl) bobberEl.style.display = 'none'; }
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
  sound.play('treasure');
  updateGems(); buildShop();
  showToast('✨ Unlocked: ' + it.name + '!');
}

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

// --- 📖 Adventure: a story journey across the worlds, hosted by Ezra's friends.
// Each chapter = a friend, a short readable blurb, one clear "do it together"
// task (tracked from now via a goals counter), a 💎 reward, friendship hearts,
// and sometimes a gift. The 📖 button is always there so he's never lost. ---
const STORY = [
  { friend: 'chris', say: "Welcome to our big adventure, Ezra! 🎉 Let's start at home — build a cozy house so we have somewhere to play!", hint: "Tap 🏗️, then pick 'Cozy House'.", task: { metric: 'place', n: 20, mode: 'do', icon: '🏠', label: 'build a house' }, reward: 4 },
  { friend: 'vlad', say: "Every explorer needs animal friends! 🐾 Come and say hello to the animals with me.", hint: 'Walk up to a pig or sheep and tap 🐾 Pet.', task: { metric: 'pet', n: 3, mode: 'do', icon: '🐾', label: 'pet 3 animals' }, reward: 4, gift: 'pet' },
  { friend: 'cora', say: "Let's make the world greener! 🌱 Plant a little sapling and we'll watch it grow into a tree.", hint: 'Pick the 🌱 sapling (Nature tab) and tap the grass.', task: { metric: 'plant', n: 1, mode: 'do', icon: '🌱', label: 'plant a sapling' }, reward: 4 },
  { friend: 'jovi', say: "I heard there's shiny treasure in the 🪙 Gold World! ✨ Let's go dig some up!", hint: 'Tap 🌍 → Gold World, then dig the shiny blocks.', task: { metric: 'treasure', n: 2, mode: 'do', icon: '💎', label: 'dig up 2 treasures' }, reward: 5 },
  { friend: 'steve', say: "Brain power time! 🧮 Answer some of my fun number questions and I'll cheer you on!", hint: 'Find Steve at his stand and tap him.', task: { metric: 'math', n: 3, mode: 'do', icon: '🍗', label: 'answer 3 math questions' }, reward: 5 },
  { friend: 'cristiano', say: "Goooal! ⚽ Actually... let's BOUNCE! Put down a slime block and boing on it with me!", hint: 'Pick the 🟢 slime block (Fun tab), place it, and jump!', task: { metric: 'bounce', n: 1, mode: 'do', icon: '🟢', label: 'bounce on slime' }, reward: 4, gift: 'sparkle' },
  { friend: 'hero', say: "Time to be BRAVE! 🦸 Turn on night and gently bonk a wobbly monster. I'm right beside you — you always wake up safe!", hint: 'Tap 🌙, then tap a zombie or spider.', task: { metric: 'monster', n: 1, mode: 'do', icon: '⚔️', label: 'bonk 1 night monster' }, reward: 6, gift: 'crown' },
  { friend: 'cora', say: "The GRAND finale! 🐉 Let's go to The End and tame the friendly dragon together. You can do it!", hint: 'Buy The End in the 💎 shop, tap 🌍 → The End, pop the crystals, then pet the dragon!', task: { metric: 'dragon', n: 1, mode: 'have', icon: '🐉', label: 'tame the dragon' }, reward: 12, gift: 'rainbow' },
];
const ADV_FRIENDS = [...new Set(STORY.map((c) => c.friend))];
function startChapter(i) {
  const ch = STORY[i];
  goals.adv = { i, base: ch ? (goals.counts[ch.task.metric] || 0) : 0 };
  goals.save();
}
function curChapter() { return (goals.adv && goals.adv.i < STORY.length) ? STORY[goals.adv.i] : null; }
function advProgress(ch) {
  const cur = goals.counts[ch.task.metric] || 0;
  return ch.task.mode === 'have' ? Math.min(ch.task.n, cur) : Math.max(0, Math.min(ch.task.n, cur - goals.adv.base));
}
function advDone(ch) { return advProgress(ch) >= ch.task.n; }
function heartsHtml(id) { const n = Math.min(3, goals.friends[id] || 0); let s = ''; for (let k = 0; k < 3; k++) s += k < n ? '❤️' : '🤍'; return s; }
function updateAdventureButton() {
  const b = document.getElementById('btn-adventure');
  if (b) { const ch = curChapter(); b.classList.toggle('on', !!(ch && advDone(ch))); }   // gold ring = ready to claim
}
function openAdventure() { renderAdventure(); document.getElementById('adventure').classList.remove('hidden'); }
function closeAdventure() { document.getElementById('adventure').classList.add('hidden'); }
function renderAdventure() {
  const body = document.getElementById('adv-body'), btn = document.getElementById('adv-ok');
  body.innerHTML = '';
  const ch = curChapter();
  if (!ch) {                         // the whole journey is finished — a happy finale
    const row = document.createElement('div'); row.className = 'adv-finale-row';
    for (const id of ADV_FRIENDS) row.appendChild(charPreview(charById(id), 48));
    body.appendChild(row);
    const t = document.createElement('div'); t.className = 'adv-text';
    t.innerHTML = '🎉 You finished the Big Adventure with all your friends! 🎉<br>You are an amazing adventurer, Ezra! 💖';
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
  task.innerHTML = (done ? '✅ ' : '') + ch.task.icon + ' <b>' + ch.task.label + '</b> — ' + advProgress(ch) + ' / ' + ch.task.n + (done ? '' : '<br><small>💡 ' + ch.hint + '</small>');
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
  const ch = curChapter();
  if (!ch || !advDone(ch)) { closeAdventure(); return; }
  goals.addGems(ch.reward); updateGems();
  goals.bump('story');
  goals.friends[ch.friend] = (goals.friends[ch.friend] || 0) + 1;
  sound.play('treasure');
  let giftMsg = '';
  if (ch.gift && !goals.hasUnlock(ch.gift)) { applyGift(ch.gift); giftMsg = ' 🎁 ' + charById(ch.friend).name + ' gave you a present!'; }
  startChapter(goals.adv.i + 1);          // advance + capture the next baseline (also saves)
  showToast('🎉 +💎' + ch.reward + giftMsg, 3800);
  updateAdventureButton();
  renderAdventure();                      // show the next chapter (or finale) right away
}

// --- A friend who strolls up (gently!) ---
// The current adventure host wanders near home and, now and then (long cooldown,
// so it's never annoying) ambles over to say hi — especially when a chapter is
// ready to claim. Tap the friend to open the Adventure. Overworld only.
function buddyHostId() { const ch = curChapter(); return ch ? ch.friend : 'chris'; }
function setupBuddy() {
  if (!worlds.over) return;
  if (!buddyChar) buddyChar = new Character(gl);
  const W = worlds.over.world, sp = W.spawn;
  const hx = Math.max(2, Math.min(SX - 2, Math.floor(sp[0]) + 4)), hz = Math.max(2, Math.min(SZ - 2, Math.floor(sp[2]) + 4));
  buddy = { pos: [hx + 0.5, W.heightAt(hx, hz) + 1, hz + 0.5], home: [hx + 0.5, hz + 0.5], yaw: 0, mode: 'home', timer: 25 + Math.random() * 30, walk: 0, linger: 0, hostId: null, chimed: false };
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
  const claimable = (() => { const ch = curChapter(); return !!(ch && advDone(ch)); })();
  buddy.timer -= dt;
  if (buddy.mode === 'home') {
    buddy.walk = 0;
    if (dist < 6) buddy.yaw = Math.atan2(-dx, -dz);                 // turn to look if you're near
    if ((buddy.timer <= 0 || claimable) && dist < 24 && dist > 2.6) { buddy.mode = 'approach'; buddy.chimed = false; buddy.linger = 0; }
    else if (buddy.timer <= 0) buddy.timer = 45 + Math.random() * 40;
  } else if (buddy.mode === 'approach') {
    if (dist > 2.3) { buddy.yaw = Math.atan2(-dx, -dz); buddy.pos[0] += dx / dist * 2.1 * dt; buddy.pos[2] += dz / dist * 2.1 * dt; buddy.walk += dt * 8; }
    else {
      buddy.yaw = Math.atan2(-dx, -dz); buddy.walk = 0;
      if (!buddy.chimed) {
        buddy.chimed = true; sound.play('pet');
        spawnParticles([buddy.pos[0], buddy.pos[1] + 1.9, buddy.pos[2]], claimable ? '⭐' : '👋', 'heart', 1, 12);
        if (claimable) showToast('📖 ' + charById(buddy.hostId).name + ': you did it! Tap me! 🎉', 2800);
      }
      buddy.linger += dt;
      if (buddy.linger > (claimable ? 14 : 8)) { buddy.mode = 'leave'; buddy.timer = 50 + Math.random() * 40; }
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
  hearts = Math.max(0, hearts - n);
  invuln = 0.7; hurtFlash = 0.55; sinceHurt = 0; regenT = 0;
  sound.play('hurt');
  updateHearts();
  if (hearts <= 0) knockout();
}
function knockout() {
  if (riding) dismount();
  if (fishing) reelIn(false);
  heartBuff = 0; heartBuffT = 0;          // bonus hearts end on a knockout
  showToast('💤 Oof! You got sleepy — back home, safe and sound.', 3400);
  night = false; updateNightButton();
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
  for (const cat of CATEGORIES) {
    if (cat.locked && !goals.hasUnlock(cat.locked)) continue;   // hidden until bought
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
  zoomIndex = (zoomIndex + 1) % ZOOM_LEVELS.length;
  camDist = ZOOM_LEVELS[zoomIndex];
  saveDirty = true;
  updateViewButton();
}
function updateViewButton() {
  const b = document.getElementById('btn-view');
  if (b) b.textContent = zoomIndex < ZOOM_LEVELS.length - 1 ? '🔍' : '🗺️';
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
    if (flintMode) tip('flint', '🔥 Flint & steel! Build an obsidian doorway (a closed frame), then tap inside it to light a portal. It also lights TNT. Tap 🔥 again to put it away.');
  });
  document.getElementById('portalmenu-close').addEventListener('pointerdown', (e) => { e.preventDefault(); closePortalMenu(); });
  document.getElementById('portalmenu').addEventListener('pointerdown', (e) => { if (e.target.id === 'portalmenu') closePortalMenu(); });

  document.getElementById('btn-worlds').addEventListener('pointerdown', (e) => {
    e.preventDefault(); sound.resume();
    tip('worlds', '🌍 Tap any world to zoom straight there! Locked ones (🔒) you buy in the 💎 shop or earn with ⭐.');
    openWorldMenu();
  });
  document.getElementById('worldmenu-close').addEventListener('pointerdown', (e) => { e.preventDefault(); closeWorldMenu(); });
  document.getElementById('worldmenu').addEventListener('pointerdown', (e) => { if (e.target.id === 'worldmenu') closeWorldMenu(); });

  document.getElementById('btn-buildkit').addEventListener('pointerdown', (e) => {
    e.preventDefault(); sound.resume();
    tip('buildkit', '🏗️ Big builds! Pick a House, Floor or Wall and it appears right in front of you. Tip: choose a block first to pick what your Floor and Wall are made of.');
    openBuildMenu();
  });
  document.getElementById('buildmenu-close').addEventListener('pointerdown', (e) => { e.preventDefault(); closeBuildMenu(); });
  document.getElementById('buildmenu').addEventListener('pointerdown', (e) => { if (e.target.id === 'buildmenu') closeBuildMenu(); });

  document.getElementById('btn-night').addEventListener('pointerdown', (e) => {
    e.preventDefault(); sound.resume();
    night = !night; updateNightButton();
    if (night) { goals.bump('night'); tip('night', '🌙 At night friendly monsters wander out. Tap to bonk them, or fly up high to stay safe — you always wake up at home, never losing anything!'); }
  });

  document.getElementById('btn-ride').addEventListener('pointerdown', (e) => { e.preventDefault(); sound.resume(); toggleRide(); });
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
  document.getElementById('btn-adventure').addEventListener('pointerdown', (e) => {
    e.preventDefault(); sound.resume();
    tip('adventure', '📖 This is your Adventure! Your friends give you fun things to do together. Do the job, then tap 📖 to see what\'s next!');
    openAdventure();
  });
  document.getElementById('adv-ok').addEventListener('pointerdown', (e) => { e.preventDefault(); advOk(); });
  document.getElementById('adventure').addEventListener('pointerdown', (e) => { if (e.target.id === 'adventure') closeAdventure(); });
  document.getElementById('quest-ok').addEventListener('pointerdown', (e) => { e.preventDefault(); questOk(); });
  document.getElementById('quest').addEventListener('pointerdown', (e) => { if (e.target.id === 'quest') closeQuest(); });
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
function frame(now) {
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
  const nightTarget = (night && dimension === 'over') ? 1 : 0;
  nightAmt += (nightTarget - nightAmt) * Math.min(1, dt * 1.5);
  if (hurtEl) hurtEl.style.opacity = (hurtFlash * 0.9).toFixed(3);

  controls.frame();
  applyLook();
  player.update(dt, controls, camYaw);
  cameraFollow(dt);
  const dxm = player.pos[0] - prevX, dzm = player.pos[2] - prevZ;
  const dm = Math.hypot(dxm, dzm);
  if (dm > 0.0005 && dm < 2) goals.onMove(dm);
  prevX = player.pos[0]; prevZ = player.pos[2];

  // Friendly first-time blurbs when you wander near something new (overworld).
  if (dimension === 'over') {
    if (stevePos) { const dx = player.pos[0] - stevePos[0], dz = player.pos[2] - stevePos[2]; if (dx * dx + dz * dz < 30) tip('steve', '🍗 That\'s Steve! Tap him for a fun math game (earn 💎) and snacks that fill your hearts.'); }
    const vs = mobs().villagers;
    if (vs) for (const v of vs.list) { const dx = player.pos[0] - v.pos[0], dz = player.pos[2] - v.pos[2]; if (dx * dx + dz * dz < 16) { tip('villager', '🧑‍🌾 Villagers have little jobs for you — tap one for a job and earn 💎!'); break; } }
  }

  // Step into a portal swirl → travel to its destination world.
  portalCooldown = Math.max(0, portalCooldown - dt);
  portalHintTimer = Math.max(0, portalHintTimer - dt);
  if (portalCooldown === 0) {
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
  growSaplings(dt);
  world.flushDirty(fuses.length ? 6 : 2);   // catch up faster while things are blowing up

  resize();
  gl.viewport(0, 0, canvas.width, canvas.height);
  const rsky = [sky[0] + (NIGHT_SKY[0] - sky[0]) * nightAmt, sky[1] + (NIGHT_SKY[1] - sky[1]) * nightAmt, sky[2] + (NIGHT_SKY[2] - sky[2]) * nightAmt];
  const dayLight = 1 - 0.6 * nightAmt;
  gl.clearColor(rsky[0], rsky[1], rsky[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const aspect = canvas.width / Math.max(1, canvas.height);
  mat4.perspective(proj, 1.05, aspect, 0.08, 120);
  camDistEased += (camDist - camDistEased) * Math.min(1, dt * 8); // smooth zoom
  computeCamera();
  if (controls.tapPending) {
    controls.tapPending = false;
    const dir = screenRay(controls.tapX, controls.tapY);
    const dg = m.dragon ? m.dragon.pickRay(camPos, dir) : null;   // The End: crystals + dragon
    const cr = (!dg && m.creepers) ? m.creepers.pickRay(camPos, dir) : null;
    const zb = (!dg && !cr && m.zombies) ? m.zombies.pickRay(camPos, dir) : null;
    const sp = (!dg && !cr && !zb && m.spiders) ? m.spiders.pickRay(camPos, dir) : null;
    const sk = (!dg && !cr && !zb && !sp && m.skeletons) ? m.skeletons.pickRay(camPos, dir) : null;
    const vl = (!dg && !cr && !zb && !sp && !sk && m.villagers) ? m.villagers.pickRay(camPos, dir) : null;
    const bd = (!dg && !cr && !zb && !sp && !sk && !vl && buddy && dimension === 'over') &&
      rayHitsSphere(camPos, dir, buddy.pos[0], buddy.pos[1] + 0.9, buddy.pos[2], 1.2);
    const stv = (!dg && !cr && !zb && !sp && !sk && !vl && !bd && stevePos && dimension === 'over') &&
      rayHitsSphere(camPos, dir, stevePos[0], stevePos[1] + 0.9, stevePos[2], 1.2);
    if (dg) doDragonTap(dg);
    else if (cr) doDefend(cr);
    else if (zb) doBonkZombie(zb);
    else if (sp) doBonkSpider(sp);
    else if (sk) doBonkSkeleton(sk);
    else if (vl) talkToVillager(vl);
    else if (bd) openAdventure();
    else if (stv) openSteveMenu();
    else if (flintMode) flintTap(dir);     // flint & steel: light TNT / a portal frame
    else {
      const hit = world.raycast(camPos, dir, REACH);
      const bid = hit ? world.get(hit.block[0], hit.block[1], hit.block[2]) : 0;
      if (hit && isDoor(bid)) toggleDoor(hit.block[0], hit.block[1], hit.block[2]);
      else if (hit && isBed(bid)) sleepInBed(hit.block[0], hit.block[1], hit.block[2]);
      else if (hit && (bid === B.LEVER || bid === B.LEVER_ON)) toggleLever(hit.block[0], hit.block[1], hit.block[2]);
      else if (hit && isTNT(bid)) lightTNT(hit.block[0], hit.block[1], hit.block[2]);
      else doAction(hit);
    }
  }
  mat4.multiply(pv, proj, view);

  // Fishing: count down to a bite, keep the bobber on the water.
  if (fishing) {
    fishing.t -= dt;
    if (fishing.t <= 0) reelIn(true);
    else positionBobber(fishing);
  }

  // Sparkle Trail (shop reward): drop little ✨ behind you while you move.
  if (goals.hasUnlock('sparkle')) {
    trailT -= dt;
    if (player.moveAmt > 0.45 && trailT <= 0) {
      trailT = 0.09;
      spawnParticles([player.pos[0], player.pos[1] + 0.3, player.pos[2]], '✨', 'puff', 1, 26);
    }
  }

  const kind = WORLD_KINDS[dimension];
  gl.useProgram(worldProg.program);
  gl.uniformMatrix4fv(worldProg.u.uProj, false, proj);
  gl.uniformMatrix4fv(worldProg.u.uView, false, view);
  gl.uniformMatrix4fv(worldProg.u.uModel, false, identity);
  gl.uniform3f(worldProg.u.uFogColor, rsky[0], rsky[1], rsky[2]);
  gl.uniform1f(worldProg.u.uFogNear, kind.fog[0]);
  gl.uniform1f(worldProg.u.uFogFar, kind.fog[1]);
  gl.uniform1f(worldProg.u.uAlpha, 1);
  gl.uniform1f(worldProg.u.uDayLight, dayLight);
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
  character.draw(worldProg, player.pos[0], player.pos[1] + (riding ? 0.62 : 0), player.pos[2], player.yaw, player.walkPhase, player.moveAmt, actionAnim, !!riding);
  drawMobs(m);
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

  requestAnimationFrame(frame);
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
  if (typeof obj.zoom === 'number' && ZOOM_LEVELS[obj.zoom] !== undefined) {
    zoomIndex = obj.zoom; camDist = camDistEased = ZOOM_LEVELS[zoomIndex];
  }
  portalUnlocked = !!obj.pu;
  try {
    if (obj.v === 4 && obj.worlds) {                       // current multi-world save
      for (const k of WORLD_ORDER) {
        const data = obj.worlds[k];
        if (!data || !WORLD_KINDS[k]) continue;
        const w = new World(gl);
        if (!w.loadFrom(data)) { if (k === 'over') return false; continue; }
        registerDim(k, w);
      }
      if (!worlds.over) return false;
      worlds.over.world.carveBeachIfClear();
      for (const k of Object.keys(worlds)) { tidyPortals(k); worlds[k].world.rebuildAll(); }
      Object.assign(positions, obj.pos || {});
      setDimension(worlds[obj.dim] ? obj.dim : 'over');
      player.yaw = obj.yaw || 0;
      player.pos = (positions[dimension] || world.spawn).slice();
      return true;
    }
    if (obj.v === 3 && obj.over) {                         // older two-dimension save
      const over = new World(gl);
      if (!over.loadFrom(obj.over)) return false;
      over.carveBeachIfClear();
      registerDim('over', over);
      const neth = new World(gl);
      if (!obj.nether || !neth.loadFrom(obj.nether)) neth.generateNether();
      registerDim('nether', neth);
      positions.over = (obj.overPos || over.spawn).slice();
      positions.nether = (obj.netherPos || neth.spawn).slice();
      setDimension(obj.dim === 'nether' ? 'nether' : 'over');
      player.yaw = obj.yaw || 0;
      player.pos = positions[dimension].slice();
      return true;
    }
    if (obj.world) {                                       // oldest overworld-only save
      const over = new World(gl);
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
  } catch (e) { /* fall through to a fresh world */ }
  return false;
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
  atlas = makeAtlasTexture(gl);

  identity = mat4.identity(mat4.create());
  proj = mat4.create(); view = mat4.create(); pv = mat4.create();
  scratch4 = new Float32Array(4);
  shadow = shadowMesh(gl); mShadow = mat4.create();

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
  setupSteve();
  if (!goals.adv) startChapter(0);     // begin the adventure (captures "from now" baselines)
  setupBuddy();
  updateAdventureButton();
  updateHearts();
  updateNightButton();
  updateGems();

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
    buy: (idd) => { const it = SHOP.find((s) => s.id === idd); if (it) buyItem(it); },
    resetWorld: () => resetWorld(),
    travelTo: (k) => travelTo(k),
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
    fishing: () => !!fishing,
    castLine: () => castLine(),
    reelNow: () => { if (fishing) reelIn(true); },
    waterSize: (x, y, z) => waterBodySize(x, y, z),
    talkVillager: () => { const v = mobs().villagers; if (v && v.list.length) talkToVillager(v.list[0]); },
    questOk: () => questOk(),
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
