// Ezra's Blocks — entry point. Wires the worlds, player, creatures, touch
// controls, UI, rendering, and autosave together. Worlds are data-driven
// (see worlds.js): adding a new place is a recipe, not a rewrite.

import { mat4 } from './math.js';
import { initGL, makeWorldProgram, makeAtlasTexture, GLMesh, blockPreview } from './gfx.js';
import { World, BLOCKS, CATEGORIES, B, SX, SY, SZ } from './world.js';
import { WORLD_KINDS, WORLD_ORDER } from './worlds.js';
import { Player } from './player.js';
import { Animals } from './animals.js';
import { Creepers } from './creepers.js';
import { NetherMobs } from './nethermobs.js';
import { Zombies } from './zombies.js';
import { Spiders } from './spiders.js';
import { Controls } from './input.js';
import { Sound } from './audio.js';
import { Character } from './character.js';
import { Goals, GOAL_DEFS } from './goals.js';

const SAVE_KEY = 'ezrablocks.save.v2';
const NETHER_STARS = 4;                   // stars needed to open the Nether portal
const MAX_HEARTS = 6;                      // base hearts (a shop unlock can add one)
const NIGHT_SKY = [0.05, 0.07, 0.15];     // dark, starry-feeling night

let hearts = MAX_HEARTS;
let maxHearts = MAX_HEARTS;
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
let selected = B.GRASS;
let lastTool = 'build', actionAnim = 0;
let saveDirty = false, lastSave = 0;
let prevX = 0, prevZ = 0, goalToastTimer = 0;
let shake = 0;            // camera kick from explosions
let trailT = 0;           // throttle for the "Sparkle Trail" shop reward
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
      };
    }
  }
  return m;
}
function populateMobs(m) {
  if (m.animals) m.animals.spawn(10);
  if (m.ants) m.ants.spawn(14);
  if (m.nethermobs) m.nethermobs.populate(SX, SZ);
  // creepers spawn lazily (paced) during update — no initial spawn
}
function updateMobs(m, dt) {
  if (m.animals) m.animals.update(dt, player);
  if (m.creepers) m.creepers.update(dt, player, goals.stars);
  if (m.nethermobs) m.nethermobs.update(dt, player, SX, SZ);
  if (m.ants) m.ants.update(dt, player);
  if (m.zombies) m.zombies.update(dt, player, night && dimension === 'over');
  if (m.spiders) m.spiders.update(dt, player, night && dimension === 'over');
}
function drawMobs(m) {
  if (m.animals) m.animals.draw(worldProg);
  if (m.creepers) m.creepers.draw(worldProg);
  if (m.nethermobs) m.nethermobs.draw(worldProg);
  if (m.ants) m.ants.draw(worldProg);
  if (m.zombies) m.zombies.draw(worldProg);
  if (m.spiders) m.spiders.draw(worldProg);
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
}

// Flint & steel portals line up in a tidy row right by home, one slot per
// destination — so they never stack behind each other and are easy to find.
const HUB_DESTS = ['gold', 'ant', 'tnt', 'sky'];
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
  const [x, y, z] = hit.place;
  if (x < 0 || x >= SX || y < 0 || y >= SY || z < 0 || z >= SZ) return;
  if (world.get(x, y, z) !== B.AIR || overlapsPlayer(x, y, z)) { sound.play('deny'); return; }
  world.set(x, y, z, selected);
  // Water is for fun pools, not "your house" — keep creepers off it.
  if (selected !== B.WATER) world.placed.add(world.idx(x, y, z));
  sound.play('place'); saveDirty = true; actionAnim = 1; minimapDirty = true;
  goals.onBuild(selected);
  if (isRedstone(selected)) world.updateRedstone();   // a new wire/lamp may light up
}

function doDig(hit) {
  if (!hit) return;
  const [x, y, z] = hit.block;
  const id = world.get(x, y, z);
  if (id === B.AIR || (BLOCKS[id] && BLOCKS[id].indestructible)) { sound.play('deny'); return; }
  if (world.isPortalBlock(x, y, z)) { sound.play('deny'); return; }   // portals can't be broken
  if (isDoor(id)) { removeDoor(x, y, z); return; }
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

// --- TNT: place it, tap to light it, then BOOM (it chain-reacts) ---
function lightTNT(x, y, z) {
  if (world.get(x, y, z) !== B.TNT) return;
  if (fuses.some((f) => f.x === x && f.y === y && f.z === z)) return;
  fuses.push({ x, y, z, t: 1.1 });
  sound.play('fuse');
  spawnParticles([x + 0.5, y + 1.0, z + 0.5], '🧨', 'puff', 1, 6);
}
function detonate(x, y, z) {
  world.set(x, y, z, B.AIR);
  world.placed.delete(world.idx(x, y, z));
  const chain = world.explode(x + 0.5, y + 0.5, z + 0.5, explodeRadius());
  sound.play('boom');
  spawnBoom([x + 0.5, y + 0.6, z + 0.5]);
  shake = Math.min(0.7, shake + 0.5);
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

// --- Hearts: getting hurt, a gentle knock-out, slow regen ---
function updateHearts() {
  const el = document.getElementById('hearts-bar');
  if (!el) return;
  // Render each heart as full / half / empty so damage can land in half-hearts.
  let html = '';
  for (let i = 1; i <= maxHearts; i++) {
    const cls = hearts >= i ? 'hf' : (hearts >= i - 0.5 ? 'hh' : 'he');
    html += '<span class="hs ' + cls + '"></span>';
  }
  el.innerHTML = html;
}
function updateGems() {
  const el = document.getElementById('gem-bar');
  if (el) el.textContent = '💎 ' + (goals ? goals.gems : 0);
}
function applyUnlocks() {
  maxHearts = MAX_HEARTS + (goals.hasUnlock('heart') ? 1 : 0);
  if (hearts > maxHearts) hearts = maxHearts;
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
function explodeRadius() { return goals.hasUnlock('megatnt') ? 4.6 : 3.2; }
// How much a single tap-bonk hurts an enemy — the Diamond Sword hits much harder.
function swordDamage() { return goals.hasUnlock('sword') ? 3 : 1; }
function ensurePet() {
  if (!goals.hasUnlock('pet')) return;
  const am = worlds.over && worlds.over.mobs.animals;
  if (!am || am.list.some((a) => a.isPet)) return;
  const sp = worlds.over.world.spawn;
  am.spawnPet(sp[0], sp[2]);
}

// --- Treasure shop: spend 💎 (mined + earned from goals) on fun unlocks ---
const SHOP = [
  { id: 'pet', icon: '🐾', name: 'Pet Friend', cost: 5, desc: 'A cute cat that follows you around' },
  { id: 'boots', icon: '👟', name: 'Speed Boots', cost: 6, desc: 'Zoom around — walk much faster!' },
  { id: 'superjump', icon: '🦘', name: 'Super Jump', cost: 6, desc: 'Boing! Jump up really high' },
  { id: 'heart', icon: '❤️', name: 'Extra Heart', cost: 8, desc: 'One more heart for night adventures' },
  { id: 'sparkle', icon: '✨', name: 'Sparkle Trail', cost: 8, desc: 'Leave a trail of sparkles as you run' },
  { id: 'sword', icon: '⚔️', name: 'Diamond Sword', cost: 12, desc: 'Defeat zombies & spiders in one hit!' },
  { id: 'megatnt', icon: '💥', name: 'Mega TNT', cost: 10, desc: 'Bigger, more powerful explosions!' },
  { id: 'rainbow', icon: '🌈', name: 'Rainbow Block', cost: 10, desc: 'A magic rainbow block to build with' },
  { id: 'crown', icon: '👑', name: 'Golden Crown', cost: 14, desc: 'Wear a royal crown — be the king!' },
  { id: 'skyworld', icon: '☁️', name: 'Sky World', cost: 20, desc: 'A whole new floating-islands world — best with Fly!' },
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
  if (it.id === 'heart') { hearts = maxHearts; updateHearts(); }
  if (it.id === 'rainbow') {             // reveal it in the picker + select it right away
    buildPicker(); selected = B.RAINBOW; refreshBlocksButton(); saveDirty = true;
  }
  if (it.id === 'skyworld') showToast('☁️ Sky World unlocked! Tap 🔥, choose Sky World, then walk in!', 4200);
  sound.play('treasure');
  updateGems(); buildShop();
  showToast('✨ Unlocked: ' + it.name + '!');
}

// --- Start the current world fresh (asked for, behind a confirmation) ---
function resetWorld() {
  const key = dimension, W = worlds[key].world, kind = WORLD_KINDS[key];
  const hubDests = [...new Set(W.portals.filter((p) => HUB_DESTS.includes(p.dest)).map((p) => p.dest))];
  W[kind.gen]();                         // regenerate fresh (clears builds + placed)
  refreshSpawn(W);
  ensurePortalsFor(key);                 // keep the standard portal(s)
  for (const d of hubDests) placeHubPortal(W, kind, d);   // and re-lay any flint portals
  W.rebuildAll();
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
  showToast('💤 Oof! You got sleepy — back home, safe and sound.', 3400);
  night = false; updateNightButton();
  const om = worlds.over && worlds.over.mobs;
  if (om && om.zombies) om.zombies.list.length = 0;
  if (om && om.spiders) om.spiders.list.length = 0;
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
  const cv = blockPreview(BLOCKS[id].tiles.side, size);
  return cv;
}

function refreshBlocksButton() {
  const b = document.getElementById('btn-blocks');
  b.innerHTML = '';
  b.appendChild(blockIcon(selected, 46));
}

function openPicker() { document.getElementById('picker').classList.remove('hidden'); }
function closePicker() { document.getElementById('picker').classList.add('hidden'); }

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
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); closePortalMenu(); lightPortal(k); });
    body.appendChild(btn);
  }
}
function openPortalMenu() { buildPortalMenu(); document.getElementById('portalmenu').classList.remove('hidden'); }
function closePortalMenu() { document.getElementById('portalmenu').classList.add('hidden'); }

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

  document.getElementById('btn-flint').addEventListener('pointerdown', (e) => { e.preventDefault(); sound.resume(); openPortalMenu(); });
  document.getElementById('portalmenu-close').addEventListener('pointerdown', (e) => { e.preventDefault(); closePortalMenu(); });
  document.getElementById('portalmenu').addEventListener('pointerdown', (e) => { if (e.target.id === 'portalmenu') closePortalMenu(); });

  document.getElementById('btn-night').addEventListener('pointerdown', (e) => {
    e.preventDefault(); sound.resume();
    night = !night; updateNightButton();
    if (night) goals.bump('night');
  });

  document.getElementById('gem-bar').addEventListener('pointerdown', (e) => { e.preventDefault(); sound.resume(); openShop(); });
  document.getElementById('shop-close').addEventListener('pointerdown', (e) => { e.preventDefault(); closeShop(); });
  document.getElementById('shop').addEventListener('pointerdown', (e) => { if (e.target.id === 'shop') closeShop(); });
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
    if (world.get(f.x, f.y, f.z) === B.TNT) detonate(f.x, f.y, f.z);
  }

  const m = mobs();
  updateMobs(m, dt);
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
    const cr = m.creepers ? m.creepers.pickRay(camPos, dir) : null;
    const zb = (!cr && m.zombies) ? m.zombies.pickRay(camPos, dir) : null;
    const sp = (!cr && !zb && m.spiders) ? m.spiders.pickRay(camPos, dir) : null;
    if (cr) doDefend(cr);
    else if (zb) doBonkZombie(zb);
    else if (sp) doBonkSpider(sp);
    else {
      const hit = world.raycast(camPos, dir, REACH);
      const bid = hit ? world.get(hit.block[0], hit.block[1], hit.block[2]) : 0;
      if (hit && isDoor(bid)) toggleDoor(hit.block[0], hit.block[1], hit.block[2]);
      else if (hit && (bid === B.LEVER || bid === B.LEVER_ON)) toggleLever(hit.block[0], hit.block[1], hit.block[2]);
      else if (hit && bid === B.TNT) lightTNT(hit.block[0], hit.block[1], hit.block[2]);
      else doAction(hit);
    }
  }
  mat4.multiply(pv, proj, view);

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
  character.draw(worldProg, player.pos[0], player.pos[1], player.pos[2], player.yaw, player.walkPhase, player.moveAmt, actionAnim);
  drawMobs(m);

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
      worlds: ws, pos: positions,
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

  sound = new Sound();
  goals = new Goals();
  goals.onComplete = (g) => { showGoalToast(g); refreshGoalsButton(); maybeUnlockNether(false); updateGems(); };
  character = new Character(gl);
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
  ensurePet();
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
  };

  last = performance.now();
  requestAnimationFrame(frame);
}

try { init(); } catch (e) { showError(e && e.stack || e); }
