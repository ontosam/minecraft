// Ezra's Blocks — entry point. Wires the world, player, animals, touch
// controls, UI, rendering, and autosave together.

import { mat4 } from './math.js';
import { initGL, makeWorldProgram, makeAtlasTexture, GLMesh, blockPreview, cubeMesh, frameMesh } from './gfx.js';
import { World, BLOCKS, CATEGORIES, B, SX, SY, SZ } from './world.js';
import { Player } from './player.js';
import { Animals } from './animals.js';
import { Creepers } from './creepers.js';
import { Controls } from './input.js';
import { Sound } from './audio.js';
import { Character } from './character.js';
import { Goals, GOAL_DEFS } from './goals.js';

const SAVE_KEY = 'ezrablocks.save.v2';
const SKY = [0.62, 0.82, 0.96];

function showError(msg) {
  const el = document.getElementById('error-overlay');
  if (el) {
    el.style.display = 'flex';
    el.querySelector('.msg').textContent = String(msg);
  }
}
window.addEventListener('error', (e) => showError(e.message || e.error || 'Unknown error'));
window.addEventListener('unhandledrejection', (e) => showError(e.reason && e.reason.message || e.reason || 'Promise error'));

let gl, worldProg, atlas, world, player, animals, creepers, controls, sound, character, goals;
let glowCube, buildFrame;
let identity, proj, view, pv, scratch4, scratch4m;
let selected = B.GRASS;
let lastTool = 'build', actionAnim = 0;
let saveDirty = false, lastSave = 0;
let prevX = 0, prevZ = 0, goalToastTimer = 0;
const canvas = document.getElementById('game');

// Third-person follow camera.
let camYaw = 0, camPitch = 0.42;
const CAM_DIST = 7.0, CAM_LOOK = 0.005;
const camPos = [0, 0, 0], camDir = [0, 0, -1], camTarget = [0, 0, 0];

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (world.loadFrom(obj.world)) {
        const x = Math.floor(world.spawn[0]), z = Math.floor(world.spawn[2]);
        world.spawn[1] = world.heightAt(x, z) + 2;
        if (obj.player) {
          player.pos = obj.player.pos.slice();
          player.yaw = obj.player.yaw || 0;
        }
        if (typeof obj.sel === 'number' && BLOCKS[obj.sel]) selected = obj.sel;
        return true;
      }
    }
  } catch (e) { /* fall through to a fresh world */ }
  return false;
}

function saveGame() {
  try {
    const obj = {
      v: 2, world: world.serialize(), sel: selected,
      player: { pos: player.pos, yaw: player.yaw },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(obj));
    saveDirty = false;
  } catch (e) { /* ignore quota errors */ }
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
  let dist = CAM_DIST;
  for (let t = 0.4; t <= CAM_DIST; t += 0.3) {
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
function rayHitAt(sx, sy) { return world.raycast(camPos, screenRay(sx, sy), CAM_DIST + 8); }
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
  sound.play('place'); saveDirty = true; actionAnim = 1;
  goals.onBuild(selected);
}

function doDig(hit) {
  if (!hit) return;
  const [x, y, z] = hit.block;
  const id = world.get(x, y, z);
  if (id === B.AIR || (BLOCKS[id] && BLOCKS[id].indestructible)) { sound.play('deny'); return; }
  world.set(x, y, z, B.AIR);
  world.placed.delete(world.idx(x, y, z));
  sound.play('dig'); saveDirty = true; actionAnim = 1;
  goals.onDig();
}

function doPet() {
  const p = animals.petNearest(player);
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

  refreshGoalsButton();
  document.getElementById('btn-goals').addEventListener('pointerdown', (e) => { e.preventDefault(); buildGoals(); document.getElementById('goals').classList.remove('hidden'); });
  document.getElementById('goals-close').addEventListener('pointerdown', (e) => { e.preventDefault(); document.getElementById('goals').classList.add('hidden'); });
  document.getElementById('goals').addEventListener('pointerdown', (e) => { if (e.target.id === 'goals') document.getElementById('goals').classList.add('hidden'); });
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
  animals.update(dt, player);
  creepers.update(dt, player, goals.stars);
  world.flushDirty(2);

  resize();
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(SKY[0], SKY[1], SKY[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const aspect = canvas.width / Math.max(1, canvas.height);
  mat4.perspective(proj, 1.05, aspect, 0.08, 120);
  computeCamera();
  if (controls.tapPending) {
    controls.tapPending = false;
    const dir = screenRay(controls.tapX, controls.tapY);
    const cr = creepers.pickRay(camPos, dir);
    if (cr) doDefend(cr);
    else doAction(world.raycast(camPos, dir, CAM_DIST + 8));
  }
  mat4.multiply(pv, proj, view);

  gl.useProgram(worldProg.program);
  gl.uniformMatrix4fv(worldProg.u.uProj, false, proj);
  gl.uniformMatrix4fv(worldProg.u.uView, false, view);
  gl.uniformMatrix4fv(worldProg.u.uModel, false, identity);
  gl.uniform3f(worldProg.u.uFogColor, SKY[0], SKY[1], SKY[2]);
  gl.uniform1f(worldProg.u.uFogNear, 38);
  gl.uniform1f(worldProg.u.uFogFar, 78);
  gl.uniform1f(worldProg.u.uAlpha, 1);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, atlas);
  gl.uniform1i(worldProg.u.uTex, 0);

  world.draw(worldProg);
  character.draw(worldProg, player.pos[0], player.pos[1], player.pos[2], player.yaw, player.walkPhase, player.moveAmt, actionAnim);
  animals.draw(worldProg);
  creepers.draw(worldProg);

  // Build/Dig guides: a translucent "ghost" of the block that will be placed,
  // and a bold outline around the block that would be dug.
  // Indicator at the spot under the finger/cursor (or screen centre at rest):
  // a light outline where a block will go (build) or a glow on it (dig).
  const ax = controls.aim.active ? controls.aim.x : canvas.clientWidth / 2;
  const ay = controls.aim.active ? controls.aim.y : canvas.clientHeight / 2;
  const hit = rayHitAt(ax, ay);
  if (hit) {
    gl.enable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST); // draw on top so the character never hides it
    if (lastTool === 'build') {
      const [qx, qy, qz] = hit.place;
      if (qx >= 0 && qx < SX && qy >= 0 && qy < SY && qz >= 0 && qz < SZ &&
        world.get(qx, qy, qz) === B.AIR && !overlapsPlayer(qx, qy, qz)) {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        mat4.model(scratch4m, qx - 0.01, qy - 0.01, qz - 0.01, 0, 1.02, 1.02, 1.02);
        gl.uniformMatrix4fv(worldProg.u.uModel, false, scratch4m);
        gl.uniform1f(worldProg.u.uAlpha, 0.9);
        buildFrame.draw(worldProg);
      }
    } else {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      const pulse = 0.22 + 0.16 * (0.5 + 0.5 * Math.sin(now * 0.006));
      mat4.model(scratch4m, hit.block[0] - 0.02, hit.block[1] - 0.02, hit.block[2] - 0.02, 0, 1.04, 1.04, 1.04);
      gl.uniformMatrix4fv(worldProg.u.uModel, false, scratch4m);
      gl.uniform1f(worldProg.u.uAlpha, pulse);
      glowCube.draw(worldProg);
    }
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1f(worldProg.u.uAlpha, 1.0);
  }

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
  scratch4 = new Float32Array(4); scratch4m = mat4.create();

  world = new World(gl);
  player = new Player(world);
  animals = new Animals(gl, world);
  creepers = new Creepers(gl, world);
  creepers.onEvent = (type, pos) => {
    if (type === 'uhoh') sound.play('uhoh');
    else if (type === 'chip') saveDirty = true;
  };
  character = new Character(gl);
  controls = new Controls(canvas);
  sound = new Sound();
  goals = new Goals();
  goals.onComplete = (g) => { showGoalToast(g); refreshGoalsButton(); };

  if (!loadGame()) { world.generate(); player.goHome(); }
  camYaw = player.yaw;
  prevX = player.pos[0]; prevZ = player.pos[2];
  world.rebuildAll();
  animals.spawn(10);
  glowCube = cubeMesh(gl, BLOCKS[B.WHITE].tiles, [1, 1, 1], true);
  buildFrame = frameMesh(gl, 0.028, [0.5, 0.95, 1.0]);
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
    world, player, animals, creepers,
    cam: () => ({ yaw: camYaw, pitch: camPitch, pos: camPos.slice(), dir: camDir.slice() }),
    target: () => targetCells(),
    rayHit: (x, y) => rayHitAt(x, y),
    sel: () => selected,
    goals,
    spawnCreeper: () => creepers.spawnNow(player),
  };

  last = performance.now();
  requestAnimationFrame(frame);
}

try { init(); } catch (e) { showError(e && e.stack || e); }
