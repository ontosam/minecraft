// Ezra's Blocks — entry point. Wires the world, player, animals, touch
// controls, UI, rendering, and autosave together.

import { mat4 } from './math.js';
import { initGL, makeWorldProgram, makeAtlasTexture, GLMesh, blockPreview } from './gfx.js';
import { World, BLOCKS, CATEGORIES, B, SX, SY, SZ } from './world.js';
import { Player } from './player.js';
import { Animals } from './animals.js';
import { Creepers } from './creepers.js';
import { NetherMobs } from './nethermobs.js';
import { Controls } from './input.js';
import { Sound } from './audio.js';
import { Character } from './character.js';
import { Goals, GOAL_DEFS } from './goals.js';

const SAVE_KEY = 'ezrablocks.save.v2';
const SKY = [0.62, 0.82, 0.96];          // overworld daytime blue
const NETHER_SKY = [0.32, 0.12, 0.13];   // warm, dim Nether red

function showError(msg) {
  const el = document.getElementById('error-overlay');
  if (el) {
    el.style.display = 'flex';
    el.querySelector('.msg').textContent = String(msg);
  }
}
window.addEventListener('error', (e) => showError(e.message || e.error || 'Unknown error'));
window.addEventListener('unhandledrejection', (e) => showError(e.reason && e.reason.message || e.reason || 'Promise error'));

let gl, worldProg, atlas, world, player, animals, creepers, nethermobs, controls, sound, character, goals;
let overworld, nether;                   // the two dimensions; `world` points at the active one
let dimension = 'over';                  // 'over' | 'nether'
let sky = SKY;                           // active sky/fog colour
let portalCooldown = 0;                  // brief grace after a swap so you don't bounce back
let overPos = null, netherPos = null;    // remembered player position in each dimension
let minimapDirty = true;                 // redraw the minimap's terrain layer when set
let identity, proj, view, pv, scratch4;
let selected = B.GRASS;
let lastTool = 'build', actionAnim = 0;
let saveDirty = false, lastSave = 0;
let prevX = 0, prevZ = 0, goalToastTimer = 0;
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

// Where each dimension's portal sits (deterministic, so old saves can be upgraded).
function overworldPortalCoords() {
  return [Math.min(SX - 5, Math.floor(overworld.spawn[0]) + 4), Math.min(SZ - 3, Math.floor(overworld.spawn[2]) + 8), B.DIRT];
}
function netherPortalCoords() {
  return [Math.min(SX - 5, Math.max(1, Math.floor(nether.spawn[0]) - 1)), Math.min(SZ - 3, Math.floor(nether.spawn[2]) + 2), B.NETHERRACK];
}
function refreshSpawn(w) { w.spawn[1] = w.heightAt(Math.floor(w.spawn[0]), Math.floor(w.spawn[2])) + 2; }
function ensurePortals() {
  if (!overworld.arrival) overworld.addPortal(...overworldPortalCoords());
  if (!nether.arrival) nether.addPortal(...netherPortalCoords());
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const obj = JSON.parse(raw);
    if (typeof obj.sel === 'number' && BLOCKS[obj.sel]) selected = obj.sel;
    if (typeof obj.zoom === 'number' && ZOOM_LEVELS[obj.zoom] !== undefined) {
      zoomIndex = obj.zoom; camDist = camDistEased = ZOOM_LEVELS[zoomIndex];
    }
    if (obj.v === 3 && obj.over) {                 // new two-dimension save
      if (!overworld.loadFrom(obj.over)) return false;
      if (!obj.nether || !nether.loadFrom(obj.nether)) nether.generateNether();
      refreshSpawn(overworld); refreshSpawn(nether); ensurePortals();
      overPos = obj.overPos || overworld.spawn.slice();
      netherPos = obj.netherPos || nether.arrival.slice();
      player.yaw = obj.yaw || 0;
      setDimension(obj.dim === 'nether' ? 'nether' : 'over');
      player.pos = (dimension === 'over' ? overPos : netherPos).slice();
      return true;
    }
    if (obj.world && overworld.loadFrom(obj.world)) { // old overworld-only save
      nether.generateNether();
      refreshSpawn(overworld); refreshSpawn(nether); ensurePortals();
      if (obj.player) { player.pos = obj.player.pos.slice(); player.yaw = obj.player.yaw || 0; }
      overPos = player.pos.slice(); netherPos = nether.arrival.slice();
      setDimension('over');
      return true;
    }
  } catch (e) { /* fall through to a fresh world */ }
  return false;
}

function saveGame() {
  try {
    if (dimension === 'over') overPos = player.pos.slice(); else netherPos = player.pos.slice();
    const obj = {
      v: 3, dim: dimension, sel: selected, zoom: zoomIndex, yaw: player.yaw,
      over: overworld.serialize(), nether: nether.serialize(),
      overPos: overPos || overworld.spawn.slice(),
      netherPos: netherPos || nether.spawn.slice(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(obj));
    saveDirty = false;
  } catch (e) { /* ignore quota errors */ }
}

// --- Dimensions: the overworld and the Nether ---
function setDimension(dim) {
  dimension = dim;
  world = (dim === 'over') ? overworld : nether;
  player.world = world;
  sky = (dim === 'over') ? SKY : NETHER_SKY;
  minimapDirty = true;
}

function enterPortal() {
  if (dimension === 'over') overPos = player.pos.slice(); else netherPos = player.pos.slice();
  setDimension(dimension === 'over' ? 'nether' : 'over');
  const a = world.arrival || world.spawn;
  player.pos = [a[0], a[1] + 0.3, a[2]];
  player.vel = [0, 0, 0];
  camYaw = player.yaw;
  portalCooldown = 1.3;
  saveDirty = true;
  sound.play('portal');
  if (dimension === 'nether') goals.bump('nether'); // first trip completes "Find the portal"
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
  const [x, y, z] = hit.place;
  if (x < 0 || x >= SX || y < 0 || y >= SY || z < 0 || z >= SZ) return;
  if (world.get(x, y, z) !== B.AIR || overlapsPlayer(x, y, z)) { sound.play('deny'); return; }
  world.set(x, y, z, selected);
  world.placed.add(world.idx(x, y, z)); // remember it's the player's, so creepers find the house
  sound.play('place'); saveDirty = true; actionAnim = 1; minimapDirty = true;
  goals.onBuild(selected);
}

function doDig(hit) {
  if (!hit) return;
  const [x, y, z] = hit.block;
  const id = world.get(x, y, z);
  if (id === B.AIR || (BLOCKS[id] && BLOCKS[id].indestructible)) { sound.play('deny'); return; }
  world.set(x, y, z, B.AIR);
  world.placed.delete(world.idx(x, y, z));
  sound.play('dig'); saveDirty = true; actionAnim = 1; minimapDirty = true;
  goals.onDig();
}

function doPet() {
  // In the overworld you pet animals; in the Nether you pet the floaty creatures.
  const p = (dimension === 'over') ? animals.petNearest(player) : nethermobs.petNearest(player);
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

// Tap a creeper to defend: it poofs harmlessly, your blocks pop back, +a star.
function doDefend(cr) {
  const head = creepers.defend(cr);
  sound.play('poof');
  spawnPuffs(head);
  goals.onDefend();
  saveDirty = true;
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

function refreshGoalsButton() {
  document.getElementById('btn-goals').textContent = '⭐' + goals.stars;
}

function buildGoals() {
  const body = document.getElementById('goals-body');
  body.innerHTML = '';
  document.getElementById('goals-title').textContent = 'My Goals  ⭐' + goals.stars + '/' + GOAL_DEFS.length;
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

function showGoalToast(g) {
  const el = document.getElementById('goaltoast');
  el.textContent = '⭐ Goal done: ' + g.title + '!';
  el.classList.add('show');
  sound.play('pet');
  clearTimeout(goalToastTimer);
  goalToastTimer = setTimeout(() => el.classList.remove('show'), 2600);
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

  document.getElementById('btn-home').addEventListener('pointerdown', (e) => { e.preventDefault(); player.goHome(); });
  document.getElementById('btn-view').addEventListener('pointerdown', (e) => { e.preventDefault(); sound.resume(); cycleZoom(); });
  updateViewButton();

  refreshGoalsButton();
  document.getElementById('btn-goals').addEventListener('pointerdown', (e) => { e.preventDefault(); buildGoals(); document.getElementById('goals').classList.remove('hidden'); });
  document.getElementById('goals-close').addEventListener('pointerdown', (e) => { e.preventDefault(); document.getElementById('goals').classList.add('hidden'); });
  document.getElementById('goals').addEventListener('pointerdown', (e) => { if (e.target.id === 'goals') document.getElementById('goals').classList.add('hidden'); });
}

// --- Minimap: a small top-down map (terrain + you + the portal) ---
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
  // portal marker (pulsing purple ring)
  if (world.arrival) {
    mmCtx.strokeStyle = '#c89cff'; mmCtx.fillStyle = 'rgba(150,90,230,0.85)'; mmCtx.lineWidth = 2;
    const ox = world.arrival[0] * s, oz = world.arrival[2] * s;
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

  controls.frame();
  applyLook();
  player.update(dt, controls, camYaw);
  cameraFollow(dt);
  const dxm = player.pos[0] - prevX, dzm = player.pos[2] - prevZ;
  const dm = Math.hypot(dxm, dzm);
  if (dm > 0.0005 && dm < 2) goals.onMove(dm);
  prevX = player.pos[0]; prevZ = player.pos[2];

  // Step into a portal swirl → travel between the overworld and the Nether.
  portalCooldown = Math.max(0, portalCooldown - dt);
  if (portalCooldown === 0) {
    const bx = Math.floor(player.pos[0]), bz = Math.floor(player.pos[2]);
    if (world.get(bx, Math.floor(player.pos[1] + 0.4), bz) === B.PORTAL ||
        world.get(bx, Math.floor(player.pos[1] + 1.2), bz) === B.PORTAL) enterPortal();
  }

  if (dimension === 'over') { animals.update(dt, player); creepers.update(dt, player, goals.stars); }
  else nethermobs.update(dt, player, SX, SZ);
  world.flushDirty(2);

  resize();
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(sky[0], sky[1], sky[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const aspect = canvas.width / Math.max(1, canvas.height);
  mat4.perspective(proj, 1.05, aspect, 0.08, 120);
  camDistEased += (camDist - camDistEased) * Math.min(1, dt * 8); // smooth zoom
  computeCamera();
  if (controls.tapPending) {
    controls.tapPending = false;
    const dir = screenRay(controls.tapX, controls.tapY);
    const cr = (dimension === 'over') ? creepers.pickRay(camPos, dir) : null;
    if (cr) doDefend(cr);
    else doAction(world.raycast(camPos, dir, REACH));
  }
  mat4.multiply(pv, proj, view);

  gl.useProgram(worldProg.program);
  gl.uniformMatrix4fv(worldProg.u.uProj, false, proj);
  gl.uniformMatrix4fv(worldProg.u.uView, false, view);
  gl.uniformMatrix4fv(worldProg.u.uModel, false, identity);
  gl.uniform3f(worldProg.u.uFogColor, sky[0], sky[1], sky[2]);
  gl.uniform1f(worldProg.u.uFogNear, dimension === 'over' ? 38 : 26);
  gl.uniform1f(worldProg.u.uFogFar, dimension === 'over' ? 78 : 60);
  gl.uniform1f(worldProg.u.uAlpha, 1);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, atlas);
  gl.uniform1i(worldProg.u.uTex, 0);

  world.draw(worldProg);
  character.draw(worldProg, player.pos[0], player.pos[1], player.pos[2], player.yaw, player.walkPhase, player.moveAmt, actionAnim);
  if (dimension === 'over') { animals.draw(worldProg); creepers.draw(worldProg); }
  else nethermobs.draw(worldProg);

  drawMinimap();

  // Autosave.
  if (saveDirty && now - lastSave > 6000) { saveGame(); lastSave = now; }

  requestAnimationFrame(frame);
}

function init() {
  gl = initGL(canvas);
  worldProg = makeWorldProgram(gl);
  atlas = makeAtlasTexture(gl);

  identity = mat4.identity(mat4.create());
  proj = mat4.create(); view = mat4.create(); pv = mat4.create();
  scratch4 = new Float32Array(4);

  overworld = new World(gl);
  nether = new World(gl);
  world = overworld;
  player = new Player(world);
  animals = new Animals(gl, overworld);
  creepers = new Creepers(gl, overworld);
  creepers.onEvent = (type, pos) => {
    if (type === 'uhoh') sound.play('uhoh');
    else if (type === 'chip') saveDirty = true;
  };
  nethermobs = new NetherMobs(gl, nether);
  nethermobs.onMeet = (species, pos) => { sound.play('coo'); spawnHearts(pos); goals.bump(species); };
  character = new Character(gl);
  controls = new Controls(canvas);
  sound = new Sound();
  goals = new Goals();
  goals.onComplete = (g) => { showGoalToast(g); refreshGoalsButton(); };

  if (!loadGame()) {
    overworld.generate();
    nether.generateNether();
    refreshSpawn(overworld); refreshSpawn(nether);
    ensurePortals();
    setDimension('over');
    player.goHome();
    overPos = player.pos.slice();
    netherPos = nether.arrival.slice();
  }
  camYaw = player.yaw;
  prevX = player.pos[0]; prevZ = player.pos[2];
  overworld.rebuildAll();
  nether.rebuildAll();
  animals.spawn(10);
  nethermobs.populate(SX, SZ);
  initMinimap();
  wireUI();

  // Resume audio + hide the hint on first interaction.
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
    get world() { return world; }, player, animals, creepers, nethermobs, overworld, nether,
    cam: () => ({ yaw: camYaw, pitch: camPitch, pos: camPos.slice(), dir: camDir.slice() }),
    target: () => targetCells(),
    rayHit: (x, y) => rayHitAt(x, y),
    sel: () => selected,
    dim: () => dimension,
    enterPortal: () => enterPortal(),
    goals,
    spawnCreeper: () => creepers.spawnNow(player),
  };

  last = performance.now();
  requestAnimationFrame(frame);
}

try { init(); } catch (e) { showError(e && e.stack || e); }
