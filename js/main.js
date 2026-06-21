// Ezra's Blocks — entry point. Wires the world, player, animals, touch
// controls, UI, rendering, and autosave together.

import { mat4 } from './math.js';
import { initGL, makeWorldProgram, makeLineProgram, makeAtlasTexture, GLMesh } from './gfx.js';
import { World, BLOCKS, PALETTE, B, SX, SY, SZ } from './world.js';
import { Player } from './player.js';
import { Animals } from './animals.js';
import { Controls } from './input.js';
import { Sound } from './audio.js';

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

let gl, worldProg, lineProg, atlas, world, player, animals, controls, sound;
let highlight, identity, proj, view, pv, scratch4, scratch4m;
let selected = B.GRASS;
let saveDirty = false, lastSave = 0;
const canvas = document.getElementById('game');

function buildHighlight() {
  const a = -0.004, b = 1.004;
  const pos = [];
  for (let c = 0; c < 8; c++) pos.push((c & 1) ? b : a, (c & 2) ? b : a, (c & 4) ? b : a);
  const idx = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7];
  highlight = new GLMesh(gl);
  highlight.setAttrib('aPos', new Float32Array(pos), 3);
  highlight.setIndex(new Uint16Array(idx));
}

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
          player.yaw = obj.player.yaw; player.pitch = obj.player.pitch;
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
      player: { pos: player.pos, yaw: player.yaw, pitch: player.pitch },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(obj));
    saveDirty = false;
  } catch (e) { /* ignore quota errors */ }
}

// --- Build / dig actions ---
function targetCells() {
  const eye = player.eye();
  const hit = world.raycast(eye, player.lookDir(), 6);
  return hit;
}

function overlapsPlayer(x, y, z) {
  const px0 = Math.floor(player.pos[0] - 0.3), px1 = Math.floor(player.pos[0] + 0.3);
  const pz0 = Math.floor(player.pos[2] - 0.3), pz1 = Math.floor(player.pos[2] + 0.3);
  const py0 = Math.floor(player.pos[1]), py1 = Math.floor(player.pos[1] + 1.7 - 0.001);
  return x >= px0 && x <= px1 && y >= py0 && y <= py1 && z >= pz0 && z <= pz1;
}

function doBuild() {
  const hit = targetCells();
  if (!hit) return;
  const [x, y, z] = hit.place;
  if (x < 0 || x >= SX || y < 0 || y >= SY || z < 0 || z >= SZ) return;
  if (world.get(x, y, z) !== B.AIR || overlapsPlayer(x, y, z)) { sound.play('deny'); return; }
  world.set(x, y, z, selected);
  sound.play('place'); saveDirty = true;
}

function doDig() {
  const hit = targetCells();
  if (!hit) return;
  const [x, y, z] = hit.block;
  const id = world.get(x, y, z);
  if (id === B.AIR || (BLOCKS[id] && BLOCKS[id].indestructible)) { sound.play('deny'); return; }
  world.set(x, y, z, B.AIR);
  sound.play('dig'); saveDirty = true;
}

function doPet() {
  const p = animals.petNearest(player);
  if (p) { sound.play('pet'); spawnHearts(p); }
}

// --- Floating hearts ---
function spawnHearts(worldPos) {
  if (!pv) return;
  mat4.transformPoint(scratch4, pv, worldPos[0], worldPos[1], worldPos[2]);
  if (scratch4[3] <= 0) return;
  const sx = (scratch4[0] / scratch4[3] * 0.5 + 0.5) * canvas.clientWidth;
  const sy = (1 - (scratch4[1] / scratch4[3] * 0.5 + 0.5)) * canvas.clientHeight;
  const layer = document.getElementById('hearts');
  for (let i = 0; i < 4; i++) {
    const h = document.createElement('div');
    h.className = 'heart';
    h.textContent = '💗';
    h.style.left = (sx + (Math.random() - 0.5) * 40) + 'px';
    h.style.top = (sy + (Math.random() - 0.5) * 20) + 'px';
    h.style.animationDelay = (i * 0.08) + 's';
    h.addEventListener('animationend', () => h.remove());
    layer.appendChild(h);
  }
}

// --- UI wiring ---
function buildPalette() {
  const row = document.getElementById('palette');
  row.innerHTML = '';
  for (const id of PALETTE) {
    const sw = document.createElement('button');
    sw.className = 'swatch';
    sw.style.background = BLOCKS[id].ui;
    sw.dataset.id = id;
    if (id === selected) sw.classList.add('sel');
    sw.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      selected = id; saveDirty = true;
      row.querySelectorAll('.swatch').forEach((s) => s.classList.remove('sel'));
      sw.classList.add('sel');
    });
    row.appendChild(sw);
  }
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
  buildPalette();
  holdButton('btn-build', doBuild, false);
  holdButton('btn-dig', doDig, false);
  holdButton('btn-pet', doPet, false);

  const jb = document.getElementById('btn-jump');
  const setJump = (v) => (e) => { e.preventDefault(); controls.jump = v; if (v) sound.resume(); };
  jb.addEventListener('pointerdown', setJump(true));
  jb.addEventListener('pointerup', setJump(false));
  jb.addEventListener('pointerleave', setJump(false));
  jb.addEventListener('pointercancel', setJump(false));

  document.getElementById('btn-home').addEventListener('pointerdown', (e) => { e.preventDefault(); player.goHome(); });

  const sb = document.getElementById('btn-sound');
  sb.addEventListener('pointerdown', (e) => {
    e.preventDefault(); sound.enabled = !sound.enabled;
    sb.textContent = sound.enabled ? '🔊' : '🔇';
  });

  document.getElementById('btn-new').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!confirm('Start a brand new world? This clears the current one.')) return;
    localStorage.removeItem(SAVE_KEY);
    world.generate(); world.rebuildAll(); world.dirty.clear();
    player.goHome();
    animals.list.length = 0; animals.spawn(10);
    saveDirty = true;
  });
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

  player.update(dt, controls);
  animals.update(dt, player);
  world.flushDirty(2);

  resize();
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(SKY[0], SKY[1], SKY[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const aspect = canvas.width / Math.max(1, canvas.height);
  mat4.perspective(proj, 1.05, aspect, 0.08, 120);
  const eye = player.eye(), dir = player.lookDir();
  mat4.lookAt(view, eye, [eye[0] + dir[0], eye[1] + dir[1], eye[2] + dir[2]], [0, 1, 0]);
  mat4.multiply(pv, proj, view);

  gl.useProgram(worldProg.program);
  gl.uniformMatrix4fv(worldProg.u.uProj, false, proj);
  gl.uniformMatrix4fv(worldProg.u.uView, false, view);
  gl.uniformMatrix4fv(worldProg.u.uModel, false, identity);
  gl.uniform3f(worldProg.u.uFogColor, SKY[0], SKY[1], SKY[2]);
  gl.uniform1f(worldProg.u.uFogNear, 38);
  gl.uniform1f(worldProg.u.uFogFar, 78);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, atlas);
  gl.uniform1i(worldProg.u.uTex, 0);

  world.draw(worldProg);
  animals.draw(worldProg);

  // Targeted-block highlight.
  const hit = targetCells();
  if (hit) {
    const m = mat4.model(scratch4m, hit.block[0], hit.block[1], hit.block[2], 0, 1, 1, 1);
    gl.useProgram(lineProg.program);
    gl.uniformMatrix4fv(lineProg.u.uProj, false, proj);
    gl.uniformMatrix4fv(lineProg.u.uView, false, view);
    gl.uniformMatrix4fv(lineProg.u.uModel, false, m);
    gl.uniform4f(lineProg.u.uColor, 0.1, 0.1, 0.12, 0.8);
    highlight.draw(lineProg, gl.LINES);
  }

  // Autosave.
  if (saveDirty && now - lastSave > 6000) { saveGame(); lastSave = now; }

  requestAnimationFrame(frame);
}

function init() {
  gl = initGL(canvas);
  worldProg = makeWorldProgram(gl);
  lineProg = makeLineProgram(gl);
  atlas = makeAtlasTexture(gl);

  identity = mat4.identity(mat4.create());
  proj = mat4.create(); view = mat4.create(); pv = mat4.create();
  scratch4 = new Float32Array(4); scratch4m = mat4.create();

  world = new World(gl);
  player = new Player(world);
  animals = new Animals(gl, world);
  controls = new Controls(canvas);
  sound = new Sound();

  if (!loadGame()) { world.generate(); player.goHome(); }
  world.rebuildAll();
  animals.spawn(10);
  buildHighlight();
  wireUI();

  // Resume audio + hide the hint on first interaction.
  const firstTouch = () => {
    sound.resume();
    const t = document.getElementById('toast');
    if (t) t.classList.add('hide');
    window.removeEventListener('pointerdown', firstTouch);
  };
  window.addEventListener('pointerdown', firstTouch);

  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  window.addEventListener('beforeunload', () => { if (saveDirty) saveGame(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && saveDirty) saveGame(); });

  // Only enable the offline service worker in production (HTTPS), so local
  // previews always load the latest files.
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => { });
  }

  // Lightweight debug handle (handy for support and automated demos).
  window.__ezra = { world, player, animals };

  last = performance.now();
  requestAnimationFrame(frame);
}

try { init(); } catch (e) { showError(e && e.stack || e); }
