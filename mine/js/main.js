// Ezra's Mine — the screen: board, mine block, dock, panels, celebrations,
// effects, sound, saving. The rules live in game.js; this file only draws
// them and turns taps/drags into game actions.

import { Game, SAVE_KEY, N_CELLS, UNLOCK_ORDER, validateCard } from './game.js';
import {
  TIERS, MAX_TIER, COLS, ROWS, caveFor, PICKAXES, PICK_RECIPES, UPGRADES, INGOTS,
  BUILDINGS, shopPrice, POWERS, QUESTS, xpNeeded, SPARK_FULL, RUSH_FULL, depthNeed, openCells,
  STORE, STORE_TABS, storeItem, ENERGY, CARD_DIGITS,
} from './data.js';
import {
  tileURL, iconURL, pickaxeURL, tileColors, crackURL, barURL, gemURL, buildingURL,
} from './art.js';
import { Sound } from './sound.js';
import { fmt, fmtTime } from './fmt.js';

// ------------------------------------------------------------------ errors
function showError(msg) {
  const el = document.getElementById('error-overlay');
  if (el) { el.style.display = 'flex'; el.querySelector('.msg').textContent = String(msg); }
}
window.addEventListener('error', (e) => showError(e.message || e.error || 'Unknown error'));
window.addEventListener('unhandledrejection', (e) => showError((e.reason && e.reason.message) || e.reason || 'Promise error'));

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const img = (src, cls) => { const i = new Image(); i.src = src; i.alt = ''; i.draggable = false; if (cls) i.className = cls; return i; };
const tierURL = (t, size) => tileURL(TIERS[t].art, size);
const COIN = () => iconURL('coin', 64);
const BRICK = () => iconURL('brick', 64);
const GEM = () => gemURL(64);

// ------------------------------------------------------------------ state
const sound = new Sound();
let game;
let timeScale = 1;          // debug: speed up time
let selected = -1;          // tap-tap merge: the first tapped block
let gotFirstTouch = false;
let lastAction = performance.now();
let playSecs = 0;           // this session's visible play time (for the rest reminder)
let restShown = false;
const SETTINGS_DEFAULT = { sound: true, speak: true, nums: true, rest: 30, energy: true, cardLimit: 0 };

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    try { localStorage.setItem(SAVE_KEY + '.broken', localStorage.getItem(SAVE_KEY) || ''); } catch (e2) { /* ignore */ }
    return null;
  }
}
function save() {
  try { localStorage.setItem(SAVE_KEY, game.serialize(Date.now())); } catch (e) { /* storage full or private mode */ }
}
function settings() {
  if (!game.s.settings) game.s.settings = Object.assign({}, SETTINGS_DEFAULT);
  for (const k in SETTINGS_DEFAULT) if (game.s.settings[k] === undefined) game.s.settings[k] = SETTINGS_DEFAULT[k];
  return game.s.settings;
}

// ------------------------------------------------------------------ speech
function speak(text) {
  if (!settings().speak || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95; u.pitch = 1.1;
    speechSynthesis.speak(u);
  } catch (e) { /* no voice available */ }
}

// ------------------------------------------------------------------ layout
const boardEl = $('board');
const cellEls = [];
let cellSize = 80, portrait = true;

function buildBoard() {
  boardEl.innerHTML = '';
  for (let i = 0; i < N_CELLS; i++) {
    const c = el('div', 'cell');
    c.dataset.i = i;
    cellEls.push(c);
    boardEl.appendChild(c);
  }
}

function layout() {
  const W = window.innerWidth, H = window.innerHeight;
  portrait = H >= W * 0.9;
  const small = Math.min(W, H) < 600;
  document.body.classList.toggle('portrait', portrait);
  document.body.classList.toggle('landscape', !portrait);
  document.documentElement.classList.toggle('small', small);
  const root = document.documentElement.style;
  const gapSt = small ? 6 : 10;
  root.setProperty('--st-gap', gapSt + 'px');
  // Size the dock to the space we really have.
  const hudH = $('hud').getBoundingClientRect().height;
  let mine, dockBtn;
  if (portrait) {
    mine = Math.max(84, Math.min(170, Math.floor(W / 5.2)));
    dockBtn = Math.floor((W - 24 - mine - 2 * gapSt - 2 * 10) / 4);
    dockBtn = Math.max(44, Math.min(96, dockBtn, Math.floor((H * 0.3 - 30) / 2)));
  } else {
    const avail = H - hudH - 16;
    mine = Math.max(72, Math.min(160, Math.floor(avail * 0.36)));
    dockBtn = Math.max(40, Math.min(92, Math.floor((avail - mine - 34 - 18 - gapSt) / 2)));
  }
  root.setProperty('--dock-btn', dockBtn + 'px');
  root.setProperty('--mine', mine + 'px');

  const cols = portrait ? COLS : ROWS, rows = portrait ? ROWS : COLS;
  root.setProperty('--cell', '36px'); // let the board area take its natural size first
  const wrap = $('board-wrap').getBoundingClientRect();
  const gap = Math.max(5, Math.min(10, Math.round(Math.min(wrap.width, wrap.height) / 90)));
  const cw = (wrap.width - 12 - gap * (cols + 1)) / cols;
  const ch = (wrap.height - 12 - gap * (rows + 1)) / rows;
  cellSize = Math.max(36, Math.min(132, Math.floor(Math.min(cw, ch))));
  document.documentElement.style.setProperty('--cell', cellSize + 'px');
  document.documentElement.style.setProperty('--gap', gap + 'px');
  boardEl.style.gridTemplateColumns = `repeat(${cols}, var(--cell))`;
  for (let i = 0; i < N_CELLS; i++) {
    const x = i % COLS, y = Math.floor(i / COLS);
    cellEls[i].style.gridColumn = String((portrait ? x : y) + 1);
    cellEls[i].style.gridRow = String((portrait ? y : x) + 1);
  }
}

// ------------------------------------------------------------------ board drawing
function renderCell(i) {
  const s = game.s, c = s.board[i], e = cellEls[i];
  const open = game.isOpen(i);
  // Only the next couple of locked squares show a padlock; the rest stay quiet.
  const soon = !open && UNLOCK_ORDER.indexOf(i) < openCellsNow() + 2;
  const key = open ? (c ? (c.t ? 't' + c.t : c.chest ? 'chest' : 'boom') : 'empty') + (settings().nums ? 'n' : '') : 'lock' + (soon ? game.unlockLevel(i) : '');
  e.classList.toggle('locked', !open);
  e.classList.toggle('far', !open && !soon);
  if (e.dataset.key === key) return;
  const wasLocked = e.dataset.key && e.dataset.key.startsWith('lock');
  e.dataset.key = key;
  e.innerHTML = '';
  if (!open) {
    if (soon) {
      e.appendChild(img(iconURL('lock', 64), 'lock'));
      e.appendChild(el('small', '', 'Lv ' + game.unlockLevel(i)));
    }
    return;
  }
  if (wasLocked) { e.classList.remove('unlock-anim'); void e.offsetWidth; e.classList.add('unlock-anim'); setTimeout(() => e.classList.remove('unlock-anim'), 600); }
  if (!c) return;
  if (c.chest) { const b = el('div', 'chest-blk'); b.appendChild(img(iconURL('chest', 96))); e.appendChild(b); return; }
  if (c.boom) { const b = el('div', 'boom-blk'); b.appendChild(img(iconURL('boom', 96))); e.appendChild(b); return; }
  const b = el('div', 'blk');
  b.appendChild(img(tierURL(c.t), 'tile'));
  if (settings().nums) b.appendChild(el('span', 'tier', String(c.t)));
  e.appendChild(b);
}
function openCellsNow() { let n = 0; for (let i = 0; i < N_CELLS; i++) if (game.isOpen(i)) n++; return n; }
function renderBoard() { for (let i = 0; i < N_CELLS; i++) renderCell(i); }

function animCell(i, cls) {
  const e = cellEls[i];
  if (!e) return;
  e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls);
  setTimeout(() => e.classList.remove(cls), 1300);
}
function cellCenter(i) {
  const r = cellEls[i].getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
function elCenter(e) {
  const r = e.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// ------------------------------------------------------------------ effects
const fxEl = $('fx');
const canAnimate = typeof Element.prototype.animate === 'function';

function burst(x, y, colors, n = 10, spread = 90) {
  if (!canAnimate) return;
  for (let k = 0; k < n; k++) {
    const p = el('div', 'particle');
    p.style.background = colors[k % colors.length];
    p.style.left = x - 5 + 'px'; p.style.top = y - 5 + 'px';
    const size = 6 + Math.random() * 8;
    p.style.width = p.style.height = size + 'px';
    fxEl.appendChild(p);
    const a = Math.random() * Math.PI * 2, d = spread * (0.4 + Math.random() * 0.6);
    const dx = Math.cos(a) * d, dy = Math.sin(a) * d - 30;
    p.animate([
      { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy + 60}px) rotate(${Math.random() * 360}deg)`, opacity: 0 },
    ], { duration: 500 + Math.random() * 300, easing: 'cubic-bezier(.2,.6,.4,1)' }).onfinish = () => p.remove();
  }
}
function floatText(x, y, text, cls = '') {
  const f = el('div', 'floatnum ' + cls, text);
  f.style.left = x + 'px'; f.style.top = y + 'px';
  fxEl.appendChild(f);
  setTimeout(() => f.remove(), 1000);
}
// Fly a small picture from one point to another along an arc.
function fly(src, from, to, size = 40, ms = 550, cls = 'flycoin') {
  return new Promise((resolve) => {
    if (!canAnimate) { resolve(); return; }
    const f = img(src, cls);
    f.style.width = f.style.height = size + 'px';
    f.style.left = from.x - size / 2 + 'px'; f.style.top = from.y - size / 2 + 'px';
    fxEl.appendChild(f);
    const dx = to.x - from.x, dy = to.y - from.y;
    const lift = -Math.min(160, 60 + Math.abs(dx) * 0.3);
    f.animate([
      { transform: 'translate(0,0) scale(.7)' },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 + lift}px) scale(1.1)`, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(.9)` },
    ], { duration: ms, easing: 'ease-in-out' }).onfinish = () => { f.remove(); resolve(); };
  });
}
function bumpPill(id) { const p = $(id); p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); }
function coinsTo(from, n = 3, kind = 'gold') {
  const target = kind === 'gold' ? $('pill-gold') : kind === 'bricks' ? $('pill-bricks') : $('pill-gems');
  const src = kind === 'gold' ? COIN() : kind === 'bricks' ? BRICK() : GEM();
  const to = elCenter(target.querySelector('img'));
  for (let k = 0; k < n; k++) {
    setTimeout(() => fly(src, { x: from.x + (Math.random() - 0.5) * 30, y: from.y + (Math.random() - 0.5) * 30 }, to, 34, 600)
      .then(() => { bumpPill(target.id); }), k * 90);
  }
}

let toastTimer = 0;
function toast(text, icon) {
  const t = $('toast');
  t.innerHTML = '';
  if (icon) t.appendChild(img(icon));
  t.appendChild(document.createTextNode(text));
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
let hintTimer = 0;
function hint(text, ms = 2600) {
  if (panelOpen) { toast(text); return; }   // the board's hint line is hidden under panels
  const h = $('hint');
  h.textContent = text;
  h.classList.add('show');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => h.classList.remove('show'), ms);
}

// ------------------------------------------------------------------ celebrations
const celQueue = [];
let celOpen = false, celTimer = 0, celCurrent = null;
function celebrate(opts) { celQueue.push(opts); if (!celOpen) nextCelebration(); }
function nextCelebration() {
  const c = celQueue.shift();
  if (!c) { celOpen = false; $('celebrate').classList.add('hidden'); return; }
  celOpen = true;
  $('cel-title').textContent = c.title || '';
  $('cel-img').src = c.img || '';
  $('cel-img').style.display = c.img ? '' : 'none';
  $('cel-name').textContent = c.name || '';
  $('cel-text').textContent = c.text || '';
  const extra = $('cel-extra'); extra.innerHTML = '';
  for (const l of c.loot || []) {
    const d = el('div', 'loot');
    d.appendChild(img(l.icon));
    d.appendChild(document.createTextNode(l.text));
    extra.appendChild(d);
  }
  const btns = $('cel-buttons'); btns.innerHTML = '';
  const buttons = c.buttons || [{ text: c.ok || 'Yay!' }];
  clearTimeout(celTimer);
  buttons.forEach((b, k) => {
    const e = el('button', k ? 'alt' : '', b.text);
    e.id = k ? '' : 'cel-ok';
    e.addEventListener('click', () => { clearTimeout(celTimer); sound.play('close'); if (b.fn) b.fn(); nextCelebration(); });
    btns.appendChild(e);
  });
  // Small celebrations close by themselves so play isn't interrupted for long.
  if (c.auto) {
    const bar = el('span', 't');
    $('cel-ok').appendChild(bar);
    if (canAnimate) bar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: c.auto, fill: 'forwards' });
    celTimer = setTimeout(() => nextCelebration(), c.auto);
  }
  $('celebrate').classList.remove('hidden');
  uiOpenedAt = performance.now();
  celCurrent = c;
  if (c.sound) sound.play(c.sound);
  if (c.say) speak(c.say);
}

// ------------------------------------------------------------------ HUD
let goldShown = 0;
const hud = {};
function initHud() {
  $('pill-gold').querySelector('img').src = COIN();
  $('pill-bricks').querySelector('img').src = BRICK();
  $('pill-gems').querySelector('img').src = GEM();
  $('btn-settings').appendChild(img(iconURL('gear', 64)));
  $('btn-rush').querySelector('img').src = iconURL('bolt', 64);
  $('energy').querySelector('img').src = iconURL('bolt', 64);
  goldShown = game.s.gold;
  for (const id of ['gold', 'gps', 'bricks', 'gems', 'lvl', 'xptext', 'cave-name', 'rush-time']) hud[id] = $(id);
}
function setText(id, v) { if (hud[id].textContent !== v) hud[id].textContent = v; }

function updateHud(dt) {
  const s = game.s;
  // Count the gold up smoothly (but drop straight down after spending).
  if (s.gold < goldShown) goldShown = s.gold;
  else goldShown += (s.gold - goldShown) * Math.min(1, dt * 6);
  if (s.gold - goldShown < 1) goldShown = s.gold;
  setText('gold', fmt(goldShown));
  setText('gps', '+' + fmt(game.gps()) + '/s');
  setText('bricks', fmt(s.bricks));
  setText('gems', fmt(s.gems));
  setText('lvl', String(s.level));
  const need = xpNeeded(s.level);
  setText('xptext', `${Math.floor(s.xp)} / ${need}`);
  $('xpfill').style.width = Math.min(100, (s.xp / need) * 100) + '%';
  setText('cave-name', game.cave().name);
  // Gold Rush jar
  const rb = $('btn-rush');
  const active = s.boostLeft > 0;
  rb.classList.toggle('active', active);
  rb.classList.toggle('ready', !active && game.rushReady());
  rb.style.setProperty('--fill', Math.round((s.rush / RUSH_FULL) * 100) + '%');
  setText('rush-time', active ? fmtTime(s.boostLeft) : '');
  document.body.classList.toggle('rush', active);
  // Counters appear once they matter (less to take in at the start).
  $('pill-bricks').classList.toggle('later', !(s.bricks > 0 || s.level >= 4));
  $('pill-gems').classList.toggle('later', !(s.gems > 0));
  rb.classList.toggle('later', !(s.level >= 3 || s.rush > 0 || active));
  updateGoal();
  // Energy bar (yellow lightning): every block broken uses one.
  const on = game.energyOn(), en = $('energy');
  en.classList.toggle('inf', !on);
  en.classList.toggle('out', on && s.energy < 1);
  $('energybar').firstElementChild.style.width = (on ? Math.min(100, (s.energy / game.energyMax()) * 100) : 100) + '%';
  const et = on ? (s.energy >= 1 ? `${Math.floor(s.energy)}/${game.energyMax()}` : `+1 in ${Math.ceil(game.secsToNextEnergy())}s`) : '∞';
  const num = $('energy-num'); if (num.textContent !== et) num.textContent = et;
  $('mine').classList.toggle('empty', on && s.energy < 1);
  // Pass badge (where the other game's paid badge sits)
  const pb = $('btn-pass'), pt = s.iap.pass ? '⭐ SUPER MINER' : '⭐ PASS';
  if (pb.textContent !== pt) pb.textContent = pt;
  pb.classList.toggle('owned', !!s.iap.pass);
  updateMine();
  updateStations();
}

// ------------------------------------------------------------------ goal card
let goalKey = '';
function questIcon(q) {
  switch (q.metric) {
    case 'tier': return tierURL(Math.min(MAX_TIER, q.n), 64);
    case 'taps': case 'mined': return pickaxeURL(game.s.pick, 64);
    case 'merges': return iconURL('sparkle', 64);
    case 'level': return iconURL('star', 64);
    case 'pick': return pickaxeURL(Math.min(7, q.n), 64);
    case 'helper': return iconURL('mole', 64);
    case 'build': case 'castle': return iconURL('house', 64);
    case 'chests': return iconURL('chest', 64);
    case 'smelts': return iconURL('furnace', 64);
    default: return iconURL('book', 64);
  }
}
function updateGoal() {
  const a = game.activeQuests()[0];
  const g = $('goal');
  if (!a) { g.classList.add('empty'); return; }
  const key = a.i + '|' + a.have + '|' + a.ready;
  if (key === goalKey) return;
  goalKey = key;
  g.classList.remove('empty');
  g.classList.toggle('ready', a.ready);
  $('goal-img').src = questIcon(a.q);
  $('goal-text').textContent = a.q.text;
  $('goal-prog').firstElementChild.style.width = Math.round((a.have / a.q.n) * 100) + '%';
  g.dataset.i = a.i;
}
function initGoal() {
  $('goal').addEventListener('click', () => {
    sound.resume();
    const a = game.activeQuests()[0];
    if (!a) return;
    if (a.ready) { game.claimQuest(a.i); goalKey = ''; return; }
    speak(a.q.text);
    const go = { pick: 'workshop', helper: 'workshop', smelts: 'furnace', build: 'village', hut: 'village', castle: 'village' }[a.q.metric];
    const st = go && STATIONS.find((x) => x.id === go);
    if (st && game.s.level >= st.unlock) { openPanel(go); return; }
    hint(`${a.q.text} (${fmt(a.have)} / ${fmt(a.q.n)})`);
  });
}

// ------------------------------------------------------------------ mine block
let lastCrack = -1, lastDropTier = -1, lastPick = -1;
function updateMine() {
  const s = game.s, max = game.pickaxe.taps;
  const dt = game.dropTier();
  if (dt !== lastDropTier) { $('mine-img').src = tierURL(dt, 128); lastDropTier = dt; }
  const stage = max <= 1 ? 0 : Math.round((1 - s.mineHp / max) * 4);
  if (stage !== lastCrack) { $('mine-crack').src = crackURL(stage, 128); lastCrack = stage; }
  if (s.pick !== lastPick) { $('mine-pick').src = pickaxeURL(s.pick, 128); lastPick = s.pick; }
  $('mine-taps').textContent = String(s.mineHp);
}

function mineTap() {
  sound.resume();
  lastAction = performance.now();
  hideHand();
  return game.tapMine(false);
}

function initMine() {
  const m = $('mine');
  let holdT = 0, repeatT = 0;
  const down = new Set();
  const stop = () => { clearTimeout(holdT); clearInterval(repeatT); holdT = repeatT = 0; };
  m.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    down.add(e.pointerId);
    mineTap();
    stop();
    // Holding the block keeps mining slowly (easier on little fingers).
    holdT = setTimeout(() => { repeatT = setInterval(() => { const r = mineTap(); if (r && r.noEnergy) stop(); }, 330); }, 450);
  });
  const up = (e) => { down.delete(e.pointerId); if (!down.size) stop(); };
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) m.addEventListener(ev, up);
  m.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ------------------------------------------------------------------ dock stations
const STATIONS = [
  { id: 'workshop', name: 'Workshop', icon: () => iconURL('hammer', 96), side: 'a', unlock: 2 },
  { id: 'furnace', name: 'Furnace', icon: () => iconURL('furnace', 96), side: 'a', unlock: 4 },
  { id: 'shop', name: 'Shop', icon: () => iconURL('cart', 96), side: 'a', unlock: 3 },
  { id: 'village', name: 'Village', icon: () => iconURL('house', 96), side: 'a', unlock: 5 },
  { id: 'quests', name: 'Quests', icon: () => iconURL('book', 96), side: 'b', unlock: 1 },
  { id: 'book', name: 'Blocks', icon: () => iconURL('shelf', 96), side: 'b', unlock: 1 },
  { id: 'chest', name: 'Chest', icon: () => iconURL('chest', 96), side: 'b', unlock: 1 },
  { id: 'mole', name: 'Helper', icon: () => iconURL('mole', 96), side: 'b', unlock: 2 },
];
const stationEls = {};
function initStations() {
  for (const st of STATIONS) {
    const b = el('button', 'station');
    b.dataset.id = st.id;
    b.appendChild(img(st.icon()));
    b.appendChild(el('span', '', st.name));
    b.addEventListener('click', () => {
      sound.resume();
      if (game.s.level < st.unlock) { sound.play('deny'); toast(`${st.name} opens at level ${st.unlock}!`, st.icon()); return; }
      if (st.id === 'mole') { openPanel('workshop'); return; }
      openPanel(st.id);
    });
    $(st.side === 'a' ? 'stations-a' : 'stations-b').appendChild(b);
    stationEls[st.id] = b;
  }
}
function updateStations() {
  const s = game.s;
  s.seenSt = s.seenSt || {};
  for (const st of STATIONS) {
    const b = stationEls[st.id];
    const locked = s.level < st.unlock;
    b.classList.toggle('locked', locked);
    const label = b.querySelector('span');
    if (locked) label.textContent = '🔒 Lv ' + st.unlock;
    else if (label.textContent.startsWith('🔒')) label.textContent = st.name;
    // "NEW" sticker the first time a station opens up
    let n = b.querySelector('.new');
    const showNew = !locked && st.unlock > 1 && !s.seenSt[st.id] && st.id !== 'mole';
    if (showNew && !n) { n = el('span', 'new', 'NEW'); b.appendChild(n); }
    if (!showNew && n) n.remove();
    // quests: count of rewards ready to collect
    if (st.id === 'quests') {
      const r = game.readyQuests();
      let bd = b.querySelector('.badge');
      if (r && !bd) { bd = el('span', 'badge'); b.appendChild(bd); }
      if (bd) { if (r) bd.textContent = String(r); else bd.remove(); }
    }
    if (st.id === 'chest') {
      const n2 = game.storedBlocks() + (s.booms || 0);
      b.querySelector('span').textContent = n2 ? `Chest (${n2})` : 'Chest';
    }
    if (st.id === 'mole') {
      const has = s.up.helper > 0;
      b.classList.toggle('mole', true);
      b.style.opacity = has || locked ? '' : '0.6';
      b.querySelector('span').textContent = has ? 'Digby' : 'Helper';
    }
  }
}

// ------------------------------------------------------------------ drag & tap on the board
const ghost = $('drag-ghost');
let drag = null; // { id, src, x0, y0, active, target, station }
let flying = false; // a tap-tap block is on its way to its twin

function pointToCell(x, y) {
  // Magnet drop: the nearest open cell whose centre is within ~0.8 of a cell.
  let best = -1, bestD = (cellSize + 10) * 0.8;
  for (let i = 0; i < N_CELLS; i++) {
    if (!game.isOpen(i)) continue;
    const c = cellCenter(i);
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}
function pointToStation(x, y) {
  for (const id of ['chest', 'furnace']) {
    const b = stationEls[id];
    if (game.s.level < STATIONS.find((s) => s.id === id).unlock) continue;
    const r = b.getBoundingClientRect();
    const pad = id === 'chest' ? 10 : -4; // melting can't be undone by accident: be strict
    if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) return id;
  }
  return null;
}
function clearMarks() {
  for (const e of cellEls) e.classList.remove('match', 'over', 'dragging', 'hinted');
  for (const id in stationEls) stationEls[id].classList.remove('drop-target');
}
function markTwins(i) {
  const c = game.s.board[i];
  if (!c) return 0;
  let n = 0;
  game.s.board.forEach((o, j) => {
    if (j === i || !o) return;
    if (c.boom ? game.canBoom(o.t) : (c.t && o.t === c.t && c.t < MAX_TIER)) { cellEls[j].classList.add('match'); n++; }
  });
  return n;
}
function select(i) {
  deselect();
  selected = i;
  cellEls[i].classList.add('selected');
  markTwins(i);
}
function deselect() {
  if (selected >= 0 && cellEls[selected]) cellEls[selected].classList.remove('selected');
  selected = -1;
  for (const e of cellEls) e.classList.remove('match');
}

function initBoardInput() {
  boardEl.addEventListener('pointerdown', (e) => {
    sound.resume();
    lastAction = performance.now();
    hideHand();
    const ce = e.target.closest('.cell');
    if (!ce || drag || flying) return;
    const i = Number(ce.dataset.i);
    e.preventDefault();
    drag = { id: e.pointerId, src: i, x0: e.clientX, y0: e.clientY, active: false, target: -1, station: null };
    try { boardEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  boardEl.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const c = game.s.board[drag.src];
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 10) return;
      if (!c || c.chest) return; // chests open with a tap; empty squares do nothing
      drag.active = true;
      deselect();
      cellEls[drag.src].classList.add('dragging');
      markTwins(drag.src);
      const g = ghost.querySelector('img');
      g.src = c.boom ? iconURL('boom', 128) : tierURL(c.t, 128);
      ghost.style.display = 'block';
      sound.play('pick');
    }
    // the ghost floats a little above the finger so it isn't hidden
    const gs = cellSize * 0.9;
    ghost.style.transform = `translate(${e.clientX - gs / 2}px, ${e.clientY - gs * 0.85}px)`;
    const st = pointToStation(e.clientX, e.clientY);
    const t = st ? -1 : pointToCell(e.clientX, e.clientY - cellSize * 0.3);
    if (t !== drag.target) {
      if (drag.target >= 0) cellEls[drag.target].classList.remove('over');
      drag.target = t;
      if (t >= 0 && t !== drag.src) cellEls[t].classList.add('over');
    }
    if (st !== drag.station) {
      if (drag.station) stationEls[drag.station].classList.remove('drop-target');
      drag.station = st;
      if (st) stationEls[st].classList.add('drop-target');
    }
  });
  const end = (e, cancelled) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    ghost.style.display = 'none';
    clearMarks();
    if (cancelled) { renderBoard(); return; }
    if (d.active) {
      if (d.station === 'chest') { if (game.storeBlock(d.src)) { tutorialDone('chest'); } }
      else if (d.station === 'furnace') { game.smeltFromBoard(d.src); }
      else if (d.target >= 0 && d.target !== d.src) {
        const r = game.drop(d.src, d.target);
        if (r.none) { animCell(d.src, 'invalid'); sound.play('deny'); }
      }
      renderBoard();
      return;
    }
    onCellTap(d.src);
  };
  boardEl.addEventListener('pointerup', (e) => end(e, false));
  boardEl.addEventListener('pointercancel', (e) => end(e, true));
}

function onCellTap(i) {
  const c = game.s.board[i];
  if (!game.isOpen(i)) { sound.play('deny'); hint(`This square opens at level ${game.unlockLevel(i)}`); return; }
  if (c && c.chest) { game.openChest(i); deselect(); return; }
  if (selected >= 0 && selected !== i) {
    const a = selected, A = game.s.board[a];
    if (A && c && ((A.t && A.t === c.t) || (A.boom && game.canBoom(c.t)))) {
      // tap-tap: the first block flies over to its twin
      deselect();
      const from = cellCenter(a), to = cellCenter(i);
      cellEls[a].classList.add('hidden-blk');
      flying = true;
      fly(A.boom ? iconURL('boom', 96) : tierURL(A.t, 96), from, to, cellSize * 0.75, 260, 'flyblock').then(() => {
        flying = false;
        cellEls[a].classList.remove('hidden-blk');
        game.drop(a, i);
        deselect();
        renderBoard();
      });
      return;
    }
    if (!c) { // move the selected block to an empty square
      deselect();
      game.drop(a, i);
      renderBoard();
      return;
    }
  }
  if (!c) { deselect(); return; }
  if (selected === i) { deselect(); return; }
  select(i);
  sound.play('pick');
  if (c.boom) { hint('Drag the Boom Block onto a block to make it bigger!'); speak('Boom block!'); return; }
  const twins = cellEls.filter((e) => e.classList.contains('match')).length;
  hint(`${TIERS[c.t].name} · makes ${fmt(TIERS[c.t].gps * game.goldMult())} gold a second` + (twins ? '' : ''));
  speak(TIERS[c.t].name);
}

// ------------------------------------------------------------------ game events → effects
let lastFullToast = 0;
function onGameEvent(type, d) {
  const s = game.s;
  switch (type) {
    case 'hit': {
      if (!d.auto) {
        sound.play('hit');
        const m = $('mine');
        m.classList.remove('hit'); void m.offsetWidth; m.classList.add('hit');
        const c = elCenter(m);
        burst(c.x, c.y - 10, tileColors(TIERS[game.dropTier()].art), 4, 60);
      } else {
        const mb = stationEls.mole;
        mb.classList.remove('dig'); void mb.offsetWidth; mb.classList.add('dig');
      }
      updateMine();
      break;
    }
    case 'break': {
      const from = elCenter($('mine'));
      sound.play('break');
      burst(from.x, from.y, tileColors(TIERS[game.dropTier()].art), d.auto ? 6 : 12, 110);
      if (d.superSwing) { floatText(from.x, from.y - 70, 'SUPER!', 'big'); sound.play('new'); }
      for (const dr of d.drops) {
        if (dr.stored) {
          fly(tierURL(dr.t, 96), from, elCenter(stationEls.chest), 46, 500, 'flyblock');
          if (performance.now() - lastFullToast > 6000) { lastFullToast = performance.now(); hint('Board full! New blocks go in your chest 📦'); }
          continue;
        }
        const e = cellEls[dr.cell];
        e.classList.add('hidden-blk');
        renderCell(dr.cell);
        const src = dr.chest ? iconURL('chest', 96) : tierURL(dr.t, 96);
        fly(src, from, cellCenter(dr.cell), cellSize * 0.75, 420, 'flyblock').then(() => {
          e.classList.remove('hidden-blk');
          renderCell(dr.cell);
          animCell(dr.cell, 'land');
          sound.play('drop');
        });
      }
      maybeTutorial();
      break;
    }
    case 'move': case 'swap': sound.play('swap'); break;
    case 'merge': {
      renderCell(d.a); renderCell(d.b);
      animCell(d.b, 'pop');
      const c = cellCenter(d.b);
      burst(c.x, c.y, tileColors(TIERS[d.t].art).concat(['#fff6c9']), 12, 80);
      if (!s.seen[d.t] || d.t > s.maxTier) { /* the discover event plays its own sound */ } else sound.play('merge', d.t);
      floatText(c.x, c.y - cellSize * 0.4, '+' + d.xp + ' XP');
      if (d.gem) { coinsTo(c, 1, 'gems'); }
      tutorialDone('merge');
      break;
    }
    case 'discover': {
      if (d.t <= 1) break;
      sound.play('new');
      const t = TIERS[d.t];
      celebrate({
        title: 'NEW BLOCK!', img: tierURL(d.t, 160), name: t.name,
        text: `Makes ${fmt(t.gps)} gold every second!`,
        loot: d.gem ? [{ icon: GEM(), text: '+1' }] : [],
        say: 'New block! ' + t.name, auto: 4500,
      });
      break;
    }
    case 'cave': {
      applyCave(true);
      toast(`New cave: ${d.cave.name}!`, tileURL(d.cave.wall, 64));
      break;
    }
    case 'levelup': {
      renderBoard();
      const unl = STATIONS.find((st) => st.unlock === d.level);
      if (unl) {
        celebrate({
          title: 'LEVEL ' + d.level + '!', img: unl.icon(), name: 'New: ' + unl.name,
          text: stationBlurb(unl.id),
          loot: [{ icon: COIN(), text: '+' + fmt(d.reward) }, { icon: GEM(), text: '+' + d.gems }],
          sound: 'levelup', say: 'Level ' + d.level + '! You unlocked the ' + unl.name + '!',
        });
      } else {
        // a quick banner instead of a pop-up for ordinary level-ups
        sound.play('levelup');
        toast(`Level ${d.level}!` + (d.newCells ? ' New square!' : ''), iconURL('star', 64));
        if (!celOpen && !celQueue.length) speak('Level ' + d.level + '!');
        const c = elCenter($('lvl-badge'));
        burst(c.x, c.y, ['#9cff5e', '#ffd23f', '#fff'], 14, 90);
        coinsTo(c, 3, 'gold'); setTimeout(() => coinsTo(c, 1, 'gems'), 200);
      }
      for (const i of UNLOCK_ORDER.slice(openCells(d.level - 1), openCells(d.level))) { const c = cellCenter(i); burst(c.x, c.y, ['#fff6c9', '#ffd23f'], 10, 60); }
      break;
    }
    case 'chest': {
      sound.play('chest');
      const c = cellCenter(d.i);
      burst(c.x, c.y, ['#ffd23f', '#fff6c9', '#c99a5b', '#ff8a7a'], 16, 120);
      coinsTo(c, 4, 'gold');
      if (d.bricks) setTimeout(() => coinsTo(c, 2, 'bricks'), 200);
      if (d.gems) setTimeout(() => coinsTo(c, 1, 'gems'), 400);
      renderBoard();
      for (const b of d.blocks) if (b.cell !== undefined) animCell(b.cell, 'pop');
      const loot = [{ icon: COIN(), text: '+' + fmt(d.gold) }, { icon: BRICK(), text: '+' + d.bricks }];
      if (d.gems) loot.push({ icon: GEM(), text: '+' + d.gems });
      for (const b of d.blocks) loot.push({ icon: b.boom ? iconURL('boom', 64) : tierURL(b.t, 64), text: '' });
      celebrate({ title: 'TREASURE!', img: iconURL('chest', 160), name: 'You opened a chest!', loot, say: 'Treasure!', auto: 3500 });
      break;
    }
    case 'store': {
      sound.play('store');
      fly(d.boom ? iconURL('boom', 96) : tierURL(d.t, 96), cellCenter(d.i), elCenter(stationEls.chest), 46, 450, 'flyblock')
        .then(() => stationPulse('chest'));
      renderCell(d.i);
      break;
    }
    case 'unstore': {
      sound.play('drop');
      renderCell(d.cell); animCell(d.cell, 'land');
      break;
    }
    case 'smeltStart': {
      sound.play('smelt');
      if (d.i !== undefined) {
        fly(tierURL(d.t, 96), cellCenter(d.i), elCenter(stationEls.furnace), 46, 450, 'flyblock').then(() => stationPulse('furnace'));
        renderCell(d.i);
      }
      break;
    }
    case 'unsmelt': {
      sound.play('drop');
      if (d.cell >= 0) { renderCell(d.cell); animCell(d.cell, 'land'); }
      break;
    }
    case 'smelted': {
      const c = elCenter(stationEls.furnace);
      sound.play('coin');
      coinsTo(c, Math.min(4, 1 + Math.floor(d.bricks / 5)), 'bricks');
      floatText(c.x, c.y - 40, '+' + d.bricks + ' bricks');
      if (d.ingot) { toast(`You made a ${INGOTS[d.ingot].name.replace('Ingot', 'Bar')}!`, barURL(d.ingot, 64)); }
      break;
    }
    case 'pickaxe': {
      renderBoard();
      celebrate({ title: 'NEW PICKAXE!', img: pickaxeURL(d.pick, 160), name: PICKAXES[d.pick].name,
        text: `Breaks a block in ${PICKAXES[d.pick].taps} tap${PICKAXES[d.pick].taps > 1 ? 's' : ''}!`, sound: 'levelup', say: 'New pickaxe! ' + PICKAXES[d.pick].name });
      break;
    }
    case 'upgrade': sound.play('buy'); if (d.id === 'helper' && d.lv === 1) celebrate({ title: 'NEW HELPER!', img: iconURL('mole', 160), name: 'Digby the Mole', text: 'Digby taps the big block for you!', say: 'Say hi to Digby the mole!' }); break;
    case 'build': sound.play('buy'); toast(`${BUILDINGS.find((b) => b.id === d.id).name} is now level ${d.lv}!`, iconURL('house', 64)); break;
    case 'buy': {
      sound.play('buy');
      renderCell(d.cell); animCell(d.cell, 'land');
      break;
    }
    case 'boom': {
      sound.play('boom');
      renderCell(d.a); renderCell(d.b); animCell(d.b, 'pop');
      const c = cellCenter(d.b);
      burst(c.x, c.y, ['#ff6a3a', '#ffd23f', '#fff', '#e0403a'], 20, 140);
      boardEl.classList.remove('shake'); void boardEl.offsetWidth; boardEl.classList.add('shake');
      break;
    }
    case 'magic': {
      renderBoard();
      d.steps.forEach(([, b], k) => setTimeout(() => { animCell(b, 'pop'); sound.play('merge', Math.min(20, k + 2)); }, k * 120));
      break;
    }
    case 'rush': sound.play('levelup'); toast('Gold Rush! Double gold!', iconURL('bolt', 64)); speak('Gold rush!'); break;
    case 'quest': {
      sound.play('done');
      const r = d.reward, c = panelOpen === 'quests' ? elCenter(stationEls.quests) : elCenter($('goal'));
      floatText(c.x, c.y - 30, 'Quest done!', 'big');
      if (r.gold) coinsTo(c, 3, 'gold');
      if (r.bricks) setTimeout(() => coinsTo(c, 2, 'bricks'), 150);
      if (r.gems) setTimeout(() => coinsTo(c, r.gems, 'gems'), 300);
      break;
    }
    case 'noEnergy': outOfEnergy(); break;
    case 'energy': {
      const c = elCenter($('energy'));
      burst(c.x, c.y, ['#ffd23f', '#fff2a0', '#fff'], 14, 70);
      break;
    }
    case 'purchased':
      if (co) co.reward = { item: d.item, got: d.got }; // shown when the checkout closes
      else onPurchased(d.item, d.got);
      break;
    case 'deny': {
      sound.play('deny');
      const msg = { cost: 'Not enough yet — keep mining!', gems: 'You need more gems 💜', full: 'Your board is full!', nopairs: 'No matching blocks right now', toobig: 'Boom Blocks only work on smaller blocks', furnace: 'The furnace is full — wait a moment!', rush: 'Merge more blocks to fill the jar!', max: 'That one is already the biggest!', precious: 'That’s one of your best blocks — too special to melt!', energyfull: 'Your energy is already full! ⚡' }[d.reason];
      if (msg) hint(msg);
      if (d.i !== undefined) animCell(d.i, 'invalid');
      break;
    }
    case 'win': {
      celebrate({ title: 'YOU BEAT THE MINE!', img: tierURL(MAX_TIER, 160), name: 'Amazing, Ezra!', text: 'You made the Star Block — the biggest block of all! Keep digging as long as you like.', sound: 'levelup', say: 'You beat the mine! Amazing, Ezra!' });
      break;
    }
  }
  if (panelOpen) refreshPanel();
}
function stationPulse(id) { const b = stationEls[id]; b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); }
function stationBlurb(id) {
  return {
    workshop: 'Make better pickaxes and get a helper!',
    furnace: 'Melt blocks into bricks and shiny bars.',
    shop: 'Buy blocks and fun Boom Blocks.',
    village: 'Use bricks to build your own village!',
    mole: 'Digby the mole can dig for you!',
  }[id] || '';
}

// ------------------------------------------------------------------ cave backdrop
let caveShown = null;
function applyCave(animate) {
  const cv = game.cave();
  if (cv === caveShown) return;
  caveShown = cv;
  const b = $('backdrop');
  b.style.backgroundImage = `linear-gradient(rgba(10,6,14,${cv.dim}), rgba(10,6,14,${cv.dim})), url(${tileURL(cv.wall, 64)})`;
  b.style.setProperty('--glow', cv.glow);
  if (animate && canAnimate) b.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 900 });
}

// ------------------------------------------------------------------ pretend store
// Make-believe shopping with a toy "game card" whose number starts 0000.
// Prices are pretend dollars; nothing is charged, saved or sent anywhere —
// only the last 4 digits are kept, in the grown-ups' purchase history.
const money = (p) => '$' + p.toFixed(2);
function storeIcon(it, size = 96) {
  if (it.gems) return gemURL(size);
  if (it.bricks) return iconURL('brick', size);
  if (it.refill || it.unlimited) return iconURL('bolt', size);
  if (it.rush) return iconURL('coin', size);
  if (it.chest === 'mega') return iconURL('chest', size, { t: 0xf6c935, b: 0xd99a1e, B: 0x8a5a10 });
  if (it.chest) return iconURL('chest', size);
  if (it.pass) return iconURL('star', size);
  return iconURL('sparkle', size);
}
function storeWhat(it) {
  if (it.gems) return `+${it.gems} gems`;
  if (it.bricks) return `+${it.bricks} bricks`;
  if (it.refill) return 'Fill your energy right up';
  if (it.unlimited) return 'Mine forever — never run out';
  if (it.rush) return `Double gold for ${Math.round(it.rush / 60)} minutes`;
  if (it.chest === 'mega') return '6 big blocks, a Boom Block, 25 gems + lots of gold';
  if (it.chest) return '3 surprise blocks + gems + gold';
  if (it.pass) return 'Double gold forever, more energy, faster refills, +10 gems';
  return '';
}

let lastNoEnergy = 0;
function outOfEnergy() {
  const now = performance.now();
  if (now - lastNoEnergy < 1500) return;
  lastNoEnergy = now;
  sound.play('empty');
  const m = $('mine'); m.classList.remove('hit'); void m.offsetWidth; m.classList.add('hit');
  if (celOpen || coOpen() || panelOpen) { hint('Out of energy! ⚡'); return; }
  const s = game.s;
  const buttons = [{ text: 'Refill ' + money(storeItem('energy').price), fn: () => openCheckout('energy') }];
  if (s.gems >= ENERGY.gemRefill) buttons.push({ text: `Use ${ENERGY.gemRefill} 💜`, fn: () => game.refillWithGems() });
  buttons.push({ text: 'Wait' });
  celebrate({
    title: 'OUT OF ENERGY!', img: iconURL('bolt', 160), name: 'Your pickaxe is tired!',
    text: `You get +1 energy every ${game.energyRegenSecs()} seconds — or fill it up now!`,
    buttons, say: 'Out of energy!', noKeys: true, escCloses: true,
  });
}

function onPurchased(it, got) {
  sound.play('kaching');
  const from = { x: innerWidth / 2, y: innerHeight / 2 };
  if (got.gems) coinsTo(from, Math.min(8, 2 + Math.floor(got.gems / 40)), 'gems');
  if (got.bricks) setTimeout(() => coinsTo(from, Math.min(6, 2 + Math.floor(got.bricks / 50)), 'bricks'), 150);
  if (got.gold) setTimeout(() => coinsTo(from, 5, 'gold'), 250);
  if (it.rush) toast(`Gold Rush x2 for ${Math.round(it.rush / 60)} minutes!`, iconURL('coin', 64));
  if (it.refill) toast('Energy full! ⚡', iconURL('bolt', 64));
  if (it.chest) {
    renderBoard();
    for (const b of got.blocks) if (b.cell !== undefined) animCell(b.cell, 'land');
    const loot = [{ icon: COIN(), text: '+' + fmt(got.gold) }, { icon: GEM(), text: '+' + got.gems }, { icon: BRICK(), text: '+' + got.bricks }];
    for (const b of got.blocks) loot.push({ icon: b.boom ? iconURL('boom', 64) : tierURL(b.t, 64), text: '' });
    celebrate({ title: it.chest === 'mega' ? 'MEGA CHEST!' : 'MYSTERY CHEST!', img: storeIcon(it, 160), name: 'Look what was inside!', loot, sound: 'chest', say: 'Treasure!' });
  }
  if (it.unlimited) celebrate({ title: 'UNLIMITED ENERGY!', img: iconURL('bolt', 160), name: 'Mine forever!', text: 'Your energy never runs out now.', sound: 'levelup', say: 'Unlimited energy!' });
  if (it.pass) celebrate({ title: 'SUPER MINER PASS!', img: iconURL('star', 160), name: 'You’re a Super Miner!', text: 'Double gold forever, more energy and faster refills!', loot: [{ icon: GEM(), text: '+10' }], sound: 'levelup', say: 'Super Miner Pass!' });
  if (panelOpen) refreshPanel(true);
}

// --- checkout
let co = null; // { id, digits, state: 'enter' | 'busy' | 'done' }
const coOpen = () => !!co;
function renderDigits() {
  const d = co.digits;
  let html = '';
  for (let k = 0; k < CARD_DIGITS; k++) {
    if (k && k % 4 === 0) html += ' ';
    html += k < d.length ? d[k] : '<span class="ph">•</span>';
  }
  $('co-digits').innerHTML = html;
  $('co-buy').classList.toggle('off', d.length < CARD_DIGITS);
}
function coMsg(text, bad) { const m = $('co-msg'); m.textContent = text; m.classList.toggle('bad', !!bad); }
function openCheckout(id) {
  const it = storeItem(id);
  if (!it) return;
  sound.resume();
  if (game.owns(id)) { toast('You already have this! ✓'); return; }
  if (it.refill && !game.refillUseful()) { toast('Your energy is already full! ⚡'); return; }
  co = { id, digits: '', state: 'enter' };
  $('co-img').src = storeIcon(it, 96);
  $('co-name').textContent = it.name;
  $('co-what').textContent = storeWhat(it);
  $('co-price').textContent = money(it.price);
  $('co-buy').textContent = 'Buy for ' + money(it.price);
  coMsg('Type the number on your card');
  renderDigits();
  const ck = $('checkout');
  ck.classList.remove('hidden', 'busy', 'done');
  uiOpenedAt = performance.now();
  sound.play('open');
  speak('Type the number on your card');
}
function closeCheckout() {
  if (!co || co.state === 'busy') return;
  const reward = co.reward;
  co = null;
  $('co-digits').innerHTML = ''; // never leave a typed number on the page
  $('checkout').classList.add('hidden');
  // 7. the fun part happens where he can see it — after the checkout closes
  if (reward) setTimeout(() => onPurchased(reward.item, reward.got), 60);
}
function coKey(k) {
  if (!co || co.state !== 'enter') return;
  if (k === 'del') co.digits = co.digits.slice(0, -1);
  else if (k === 'clear') co.digits = '';
  else if (co.digits.length < CARD_DIGITS) co.digits += k;
  sound.play('key');
  // A game card always starts 0000 — catch a wrong card after 4 numbers, not 16.
  if (co.digits.length === 4 && !co.digits.startsWith('0000')) { co.digits = ''; renderDigits(); coDecline('That’s not your game card — it starts with 0000.'); return; }
  if (co.digits.length) coMsg(co.digits.length < CARD_DIGITS ? `${CARD_DIGITS - co.digits.length} more numbers` : 'Now tap Buy!');
  renderDigits();
}
function coDecline(text) {
  sound.play('deny');
  coMsg(text, true);
  speak(text);
  const c = document.querySelector('.co-card'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake');
}
function coBuy() {
  if (!co || co.state !== 'enter') return;
  const it = storeItem(co.id);
  if (co.digits.length < CARD_DIGITS) { coDecline(`Type all ${CARD_DIGITS} numbers on your card`); return; }
  if (!validateCard(co.digits)) { co.digits = ''; renderDigits(); coDecline('Card declined. Check the number and try again.'); return; }
  if (game.declineReason(it.price) === 'limit') { co.digits = ''; renderDigits(); coDecline('Card declined — not enough money left on this card.'); return; }
  const last4 = co.digits.slice(-4);
  co.digits = ''; // the number is never kept
  renderDigits();
  co.state = 'busy';
  $('checkout').classList.add('busy');
  sound.play('process');
  setTimeout(() => {
    if (!co) return;
    const ok = game.grant(co.id, last4, Date.now());
    if (!ok) { co.state = 'enter'; $('checkout').classList.remove('busy'); coDecline('Card declined. Try again.'); return; }
    co.state = 'done';
    $('checkout').classList.remove('busy');
    $('checkout').classList.add('done');
    save();
    setTimeout(() => { if (co && co.state === 'done') { co.state = 'enter'; closeCheckout(); } }, 1300);
  }, 1600);
}
function initCheckout() {
  const pad = $('co-pad');
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']) {
    const b = el('button', '', k === 'del' ? '⌫' : k);
    if (!k) { b.style.visibility = 'hidden'; pad.appendChild(b); continue; }
    b.addEventListener('click', () => coKey(k));
    pad.appendChild(b);
  }
  $('co-buy').addEventListener('click', coBuy);
  $('co-close').addEventListener('click', () => { sound.play('close'); closeCheckout(); });
  let coDownOnBg = false;
  $('checkout').addEventListener('pointerdown', (e) => { coDownOnBg = e.target === $('checkout'); });
  $('checkout').addEventListener('click', (e) => {
    // a stray tap beside the box only closes it before any numbers are typed
    if (e.target === $('checkout') && coDownOnBg && co && !co.digits.length && performance.now() - uiOpenedAt > 400) closeCheckout();
    coDownOnBg = false;
  });
}

// ------------------------------------------------------------------ panels
let panelOpen = null, panelKey = '', panelTab = null;
let uiOpenedAt = 0; // taps right after a panel/card opens are ignored (no double-tap accidents)
const PANELS = {};

function openPanel(id, tab) {
  sound.play('open');
  game.s.seenSt = game.s.seenSt || {};
  game.s.seenSt[id] = 1;
  if (id === 'parent') gateOpen = false;
  panelOpen = id; panelTab = tab || null; panelKey = '';
  uiOpenedAt = performance.now();
  if (!game.s.seenSt[id + '_spoken'] && stationBlurb(id)) { game.s.seenSt[id + '_spoken'] = 1; speak(PANELS[id].title() + '! ' + stationBlurb(id)); }
  deselect();
  const p = PANELS[id];
  $('panel-title').textContent = p.title();
  $('panel-icon').src = p.icon();
  $('panel').classList.remove('hidden');
  $('panel-body').scrollTop = 0;
  refreshPanel(true);
}
function closePanel() {
  if (!panelOpen) return;
  sound.play('close');
  if (PANELS[panelOpen].onClose) PANELS[panelOpen].onClose();
  panelOpen = null;
  $('panel').classList.add('hidden');
  updateStations();
}
function refreshPanel(force) {
  if (!panelOpen) return;
  const p = PANELS[panelOpen];
  const key = p.key ? p.key() : '';
  if (!force && key === panelKey) return;
  panelKey = key;
  const body = $('panel-body');
  const scroll = body.scrollTop;
  body.innerHTML = '';
  $('panel-tabs').innerHTML = '';
  p.render(body);
  body.scrollTop = scroll;
}
function row(icon, title, sub, button) {
  const r = el('div', 'row');
  if (icon) r.appendChild(img(icon));
  const info = el('div', 'info');
  info.appendChild(el('b', '', title));
  if (sub) { if (typeof sub === 'string') info.appendChild(el('small', '', sub)); else info.appendChild(sub); }
  r.appendChild(info);
  if (button) r.appendChild(button);
  return r;
}
function buyButton(label, icon, enabled, fn, cls = '', why = 'Not enough yet — keep mining!') {
  const b = el('button', 'buy ' + cls + (enabled ? '' : ' off'));
  if (icon) b.appendChild(img(icon));
  b.appendChild(document.createTextNode(label));
  b.setAttribute('aria-disabled', String(!enabled));
  b.addEventListener('click', () => {
    sound.resume();
    if (!enabled) {
      // A grey button still answers: a wiggle, a buzz and a spoken reason.
      if (cls.includes('max')) return;
      sound.play('deny'); toast(why); speak(why);
      b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope');
      return;
    }
    fn(); refreshPanel(true);
  });
  return b;
}
function needLabel(k) {
  if (k.startsWith('i:')) { const id = k.slice(2); return { icon: barURL(id, 64), name: INGOTS[id].name.replace('Ingot', 'Bar') }; }
  const t = Number(k.slice(1));
  return { icon: tierURL(t, 64), name: TIERS[t].name };
}
const aff = (ok) => (ok ? '1' : '0');

// --- Store (pretend money)
PANELS.store = {
  title: () => 'Gem Store', icon: () => gemURL(96),
  // (energy only matters on the Energy tab — rebuilding on every Digby break would eat taps)
  key() { const s = game.s; return [panelTab, s.iap.pass, s.iap.unlimited, s.gems >= ENERGY.gemRefill, (panelTab === 'energy') ? game.refillUseful() + ':' + Math.floor(s.energy / 10) : ''].join('|'); },
  render(body) {
    const s = game.s;
    const tab = panelTab || 'gems';
    const tabs = $('panel-tabs');
    for (const t of STORE_TABS) {
      const b = el('button', 'tab' + (t.id === tab ? ' on' : ''), t.name);
      b.addEventListener('click', () => { panelTab = t.id; sound.play('pick'); refreshPanel(true); });
      tabs.appendChild(b);
    }
    if (tab === 'energy') {
      body.appendChild(el('div', 'note', game.energyOn()
        ? `⚡ Energy: ${Math.floor(s.energy)} / ${game.energyMax()}. Every block you break uses 1. You get +1 every ${game.energyRegenSecs()} seconds.`
        : '⚡ Your energy never runs out!'));
    }
    const energyOff = s.settings && s.settings.energy === false;
    if (tab === 'energy' && energyOff) body.appendChild(el('div', 'note', 'A grown-up switched energy off, so you never need it! ⚡'));
    for (const it of STORE.filter((x) => x.tab === tab)) {
      if (energyOff && (it.refill || it.unlimited)) continue;
      const owned = game.owns(it.id);
      let btn;
      if (owned) btn = buyButton('Owned ✓', null, false, () => {}, 'max');
      else if (it.refill && !game.refillUseful()) btn = buyButton(game.energyOn() ? 'Full ✓' : '∞', null, false, () => {}, 'max');
      else btn = buyButton(money(it.price), null, true, () => openCheckout(it.id), 'price');
      const r = row(storeIcon(it), it.name, storeWhat(it), btn);
      r.classList.add('store-row');
      if (owned) r.classList.add('owned');
      if (it.tag && !owned) r.appendChild(el('span', 'ribbon', it.tag));
      body.appendChild(r);
    }
    if (tab === 'energy' && game.energyOn()) {
      const full = !game.refillUseful();
      body.appendChild(row(iconURL('bolt', 96), 'Refill with gems', `Use ${ENERGY.gemRefill} gems to fill your energy`,
        full ? buyButton('Full ✓', null, false, () => {}, 'max')
          : buyButton(String(ENERGY.gemRefill), GEM(), s.gems >= ENERGY.gemRefill, () => game.refillWithGems(), '', 'You need more gems 💜')));
    }
  },
};

// --- Workshop: pickaxe + upgrades
PANELS.workshop = {
  title: () => 'Workshop', icon: () => iconURL('hammer', 96),
  key() {
    const s = game.s, r = PICK_RECIPES[s.pick + 1];
    return [s.pick, s.up.depth, s.up.helper, s.up.lucky, s.maxTier, r ? aff(s.gold >= r.gold) + aff(game.canAffordNeed(r.need)) + JSON.stringify(Object.keys(r.need).map((k) => game.have(k))) : '',
      ...Object.keys(UPGRADES).map((id) => aff(game.canUpgrade(id)))].join('|');
  },
  render(body) {
    const s = game.s;
    body.appendChild(el('div', 'section', '⛏️ Your pickaxe'));
    const cur = PICKAXES[s.pick];
    body.appendChild(row(pickaxeURL(s.pick, 96), cur.name, `Breaks a block in ${cur.taps} tap${cur.taps > 1 ? 's' : ''}` + (cur.double ? ` · ${Math.round(cur.double * 100)}% double blocks` : '')));
    const next = PICKAXES[s.pick + 1], r = PICK_RECIPES[s.pick + 1];
    if (next) {
      const rec = el('div', 'recipe');
      for (const k in r.need) {
        const n = needLabel(k), have = game.have(k);
        const ing = el('span', 'ing' + (have < r.need[k] ? ' short' : ''));
        ing.appendChild(img(n.icon)); ing.appendChild(document.createTextNode(`${Math.min(have, r.need[k])}/${r.need[k]}`));
        rec.appendChild(ing);
      }
      const g = el('span', 'ing' + (s.gold < r.gold ? ' short' : ''));
      g.appendChild(img(COIN())); g.appendChild(document.createTextNode(fmt(r.gold)));
      rec.appendChild(g);
      const sub = el('div');
      sub.appendChild(el('small', '', `Next: ${next.taps} tap${next.taps > 1 ? 's' : ''}` + (next.double ? ` · ${Math.round(next.double * 100)}% double` : '')));
      sub.appendChild(rec);
      const ok = s.gold >= r.gold && game.canAffordNeed(r.need);
      body.appendChild(row(pickaxeURL(s.pick + 1, 96), next.name, sub, buyButton('Craft!', iconURL('hammer', 64), ok, () => game.craftPickaxe())));
      const missing = Object.keys(r.need).filter((k) => game.have(k) < r.need[k]);
      if (missing.some((k) => k.startsWith('i:'))) body.appendChild(el('div', 'note', '💡 Bars come from the Furnace: drag a shiny ore block onto it.'));
      else if (missing.length) body.appendChild(el('div', 'note', '💡 Blocks on your board or in your chest both count.'));
    } else body.appendChild(el('div', 'note', 'You have the very best pickaxe! ⭐'));

    body.appendChild(el('div', 'section', '🔧 Upgrades'));
    // Dig Deeper
    {
      const u = UPGRADES.depth, lv = s.up.depth, cur = game.dropTier();
      const sub = el('div');
      const line = el('small'); line.append('New blocks: ');
      line.appendChild(img(tierURL(cur, 32))); line.lastChild.style.cssText = 'width:22px;height:22px;vertical-align:middle';
      line.append(' ' + TIERS[cur].name);
      sub.appendChild(line);
      let btn;
      if (game.depthMaxed()) btn = buyButton('Max!', null, false, () => {}, 'max');
      else if (!game.depthUseful()) {
        const need = depthNeed(lv);
        const tip = el('small'); tip.textContent = `Make ${TIERS[Math.min(MAX_TIER, need)].name} first!`;
        sub.appendChild(tip);
        btn = buyButton(fmt(u.cost(lv)), COIN(), false, () => {});
      } else btn = buyButton(fmt(u.cost(lv)), COIN(), game.canUpgrade('depth'), () => game.upgrade('depth'));
      body.appendChild(row(iconURL('pickaxe', 96), `${u.name} (Lv ${lv})`, sub, btn));
    }
    // Helper mole
    {
      const u = UPGRADES.helper, lv = s.up.helper;
      const sub = lv ? `Digby taps every ${u.interval(lv).toFixed(1)} seconds` : 'A friendly mole who digs for you!';
      const btn = lv >= u.max ? buyButton('Max!', null, false, () => {}, 'max') : buyButton(fmt(u.cost(lv)), COIN(), game.canUpgrade('helper'), () => game.upgrade('helper'));
      body.appendChild(row(iconURL('mole', 96), lv ? `Digby the Mole (Lv ${lv})` : 'Get a Mole Helper', sub, btn));
    }
    // Lucky dig
    {
      const u = UPGRADES.lucky, lv = s.up.lucky;
      const sub = `${Math.round(u.chance(lv) * 100)}% chance a bigger block pops out`;
      const btn = lv >= u.max ? buyButton('Max!', null, false, () => {}, 'max') : buyButton(fmt(u.cost(lv)), COIN(), game.canUpgrade('lucky'), () => game.upgrade('lucky'));
      body.appendChild(row(iconURL('sparkle', 96), `${u.name} (Lv ${lv})`, sub, btn));
    }
  },
};

// --- Furnace
PANELS.furnace = {
  title: () => 'Furnace', icon: () => iconURL('furnace', 96),
  key() { const s = game.s; return JSON.stringify(s.furnace.map((f) => f.t)) + JSON.stringify(s.store); },
  // progress bars tick in place (rebuilding the panel every second could eat a tap)
  tick() {
    game.s.furnace.forEach((f, k) => {
      const r = document.querySelectorAll('#panel-body .row.melting')[k];
      if (!r) return;
      r.querySelector('.bar i').style.width = Math.round((1 - f.left / f.total) * 100) + '%';
      r.querySelector('.left').textContent = fmtTime(f.left);
    });
  },
  render(body) {
    const s = game.s;
    body.appendChild(el('div', 'note', 'Drag a block from your board onto the Furnace to melt it into bricks 🧱. Shiny ores become metal bars for pickaxes!'));
    body.appendChild(el('div', 'section', '🔥 Melting now'));
    if (!s.furnace.length) body.appendChild(el('div', 'note', 'Nothing yet — the furnace is waiting!'));
    s.furnace.forEach((f) => {
      const r = game.smeltResult(f.t);
      const sub = el('div');
      sub.appendChild(el('small', '', r.ingot ? `→ ${INGOTS[r.ingot].name.replace('Ingot', 'Bar')} + ${r.bricks} bricks` : `→ ${r.bricks} bricks`));
      const bar = el('div', 'bar'); const fill = el('i'); fill.style.width = Math.round((1 - f.left / f.total) * 100) + '%'; bar.appendChild(fill); sub.appendChild(bar);
      sub.appendChild(el('small', 'left', fmtTime(f.left)));
      const k = s.furnace.indexOf(f);
      const out = buyButton('Take out', null, true, () => game.unsmelt(k), 'alt');
      const rr = row(tierURL(f.t, 96), TIERS[f.t].name, sub, out);
      rr.classList.add('melting');
      body.appendChild(rr);
    });
    for (let k = s.furnace.length; k < game.furnaceSlots(); k++) body.appendChild(row(iconURL('furnace', 64), 'Empty spot', 'Close this, then drag a block onto the Furnace button'));
    // what's good to melt
    body.appendChild(el('div', 'section', '✨ Shiny ores make bars'));
    const g = el('div', 'grid-items');
    for (const id in INGOTS) {
      const it = el('div', 'item');
      it.appendChild(img(tierURL(INGOTS[id].from, 64)));
      it.appendChild(el('div', '', '↓'));
      it.appendChild(img(barURL(id, 64)));
      it.appendChild(el('small', '', `${INGOTS[id].name.replace('Ingot', 'Bar')} (have ${game.have('i:' + id)})`));
      g.appendChild(it);
    }
    body.appendChild(g);
    // melt from chest
    const stored = game.storedTiers().filter((t) => game.canSmelt(t)).sort((a, b) => a - b);
    if (stored.length) {
      body.appendChild(el('div', 'section', '📦 Melt from your chest'));
      const g2 = el('div', 'grid-items');
      for (const t of stored) {
        const it = el('button', 'item');
        it.appendChild(img(tierURL(t, 64)));
        it.appendChild(el('span', 'count', String(s.store['b' + t])));
        it.appendChild(el('small', '', TIERS[t].name));
        it.addEventListener('click', () => { game.smeltFromStore(t); refreshPanel(true); });
        g2.appendChild(it);
      }
      body.appendChild(g2);
    }
  },
};

// --- Shop
PANELS.shop = {
  title: () => 'Shop', icon: () => iconURL('cart', 96),
  key() { return [game.s.maxTier, game.emptyCells().length > 0, game.s.gems, ...game.shopTiers().map((t) => aff(game.s.gold >= shopPrice(t)))].join('|'); },
  render(body) {
    const s = game.s;
    body.appendChild(row(gemURL(96), 'Gem Store', 'Gems, energy, chests & the Super Miner Pass', buyButton('Open', null, true, () => openPanel('store'), 'price')));
    body.appendChild(el('div', 'section', '🧱 Buy blocks'));
    if (!game.emptyCells().length) body.appendChild(el('div', 'note', 'Your board is full — merge some blocks first!'));
    const tiers = game.shopTiers().slice().reverse().slice(0, 8);
    for (const t of tiers) {
      const price = shopPrice(t);
      body.appendChild(row(tierURL(t, 96), TIERS[t].name, `Makes ${fmt(TIERS[t].gps)} gold/s`, buyButton(fmt(price), COIN(), s.gold >= price && game.emptyCells().length > 0, () => game.buyBlock(t))));
    }
    body.appendChild(el('div', 'section', '💜 Gem power-ups'));
    body.appendChild(el('div', 'note', 'You earn gems by finding new blocks, levelling up and doing quests.'));
    for (const id in POWERS) {
      const p = POWERS[id];
      body.appendChild(row(id === 'boom' ? iconURL('boom', 96) : iconURL('sparkle', 96), p.name, p.desc,
        buyButton(String(p.gems), GEM(), s.gems >= p.gems, () => { if (game.usePower(id) && id === 'magic') closePanel(); })));
    }
  },
};

// --- Village
PANELS.village = {
  title: () => 'Village', icon: () => iconURL('house', 96),
  key() { return [game.s.level, ...BUILDINGS.map((b) => game.villageLv(b.id) + aff(game.canBuild(b)))].join('|'); },
  render(body) {
    const scene = el('div', 'village-scene');
    for (const b of BUILDINGS) {
      const lv = game.villageLv(b.id);
      const d = el('div', 'bld' + (lv ? '' : ' empty'));
      const im = img(buildingURL(b.roof, b.wall, 96));
      const sc = lv ? 0.75 + lv * 0.06 : 0.75;
      im.style.width = im.style.height = Math.round(56 * sc) + 'px';
      d.appendChild(im);
      d.appendChild(el('small', '', lv ? 'Lv ' + lv : '?'));
      scene.appendChild(d);
    }
    body.appendChild(scene);
    body.appendChild(el('div', 'note', 'Bricks 🧱 come from the Furnace, treasure chests and quests.'));
    for (const b of BUILDINGS) {
      const lv = game.villageLv(b.id);
      const stars = el('div', 'stars', '★'.repeat(lv) + '☆'.repeat(b.max - lv));
      const sub = el('div'); sub.appendChild(el('small', '', b.desc)); sub.appendChild(stars);
      let btn;
      if (game.s.level < (b.unlock || 1)) btn = buyButton('Lv ' + b.unlock, iconURL('lock', 64), false, () => {});
      else if (lv >= b.max) btn = buyButton('Done!', null, false, () => {}, 'max');
      else btn = buyButton(fmt(game.buildingCost(b)), BRICK(), game.canBuild(b), () => game.build(b.id));
      body.appendChild(row(buildingURL(b.roof, b.wall, 96), b.name, sub, btn));
    }
  },
};

// --- Quests
PANELS.quests = {
  title: () => 'Quests', icon: () => iconURL('book', 96),
  key() { return JSON.stringify(game.activeQuests().map((a) => [a.i, a.have, a.ready])); },
  render(body) {
    const qs = game.activeQuests();
    if (!qs.length) { body.appendChild(el('div', 'note', 'You did every quest! You are a super miner! ⭐')); return; }
    for (const a of qs) {
      const q = a.q;
      const sub = el('div');
      const bar = el('div', 'bar'); const fill = el('i'); fill.style.width = Math.round((a.have / q.n) * 100) + '%'; bar.appendChild(fill);
      const rw = el('small');
      if (q.reward.gold) rw.append(`🪙 ${fmt(q.reward.gold)}  `);
      if (q.reward.bricks) rw.append(`🧱 ${q.reward.bricks}  `);
      if (q.reward.gems) rw.append(`💜 ${q.reward.gems}`);
      sub.appendChild(el('small', '', `${fmt(a.have)} / ${fmt(q.n)}`)); sub.appendChild(bar); sub.appendChild(rw);
      const r = row(null, q.text, sub, a.ready ? buyButton('Collect!', iconURL('star', 64), true, () => game.claimQuest(a.i)) : null);
      const sp = el('button', 'speak', '🔊'); sp.addEventListener('click', () => speak(q.text));
      r.insertBefore(sp, r.firstChild);
      if (a.ready) r.classList.add('ready');
      body.appendChild(r);
    }
    const done = Object.keys(game.s.claimed).length;
    body.appendChild(el('div', 'note', `Quests done: ${done} of ${QUESTS.length}`));
  },
};

// --- Block Book (collection)
PANELS.book = {
  title: () => 'My Blocks', icon: () => iconURL('shelf', 96),
  key() { return Object.keys(game.s.seen).join(','); },
  render(body) {
    const s = game.s;
    const found = Object.keys(s.seen).length;
    body.appendChild(el('div', 'section', `You found ${found} of ${MAX_TIER} blocks!`));
    const g = el('div', 'grid-items');
    for (let t = 1; t <= MAX_TIER; t++) {
      const known = !!s.seen[t];
      const it = el('button', 'item' + (known ? '' : ' unknown'));
      if (known) {
        it.appendChild(img(tierURL(t, 64)));
        it.appendChild(el('span', 'count', String(t)));
        it.appendChild(el('small', '', TIERS[t].name));
        it.appendChild(el('small', '', '🪙 ' + fmt(TIERS[t].gps) + '/s'));
        it.addEventListener('click', () => speak(TIERS[t].name));
      } else if (s.seen[t - 1]) {
        it.classList.remove('unknown');
        it.appendChild(img(tileURL('mystery', 64)));
        it.appendChild(el('small', '', `2 × ${TIERS[t - 1].name} = ?`));
      } else {
        it.appendChild(img(tileURL('mystery', 64)));
        it.appendChild(el('small', '', '???'));
      }
      g.appendChild(it);
    }
    body.appendChild(g);
  },
};

// --- Storage chest
PANELS.chest = {
  title: () => 'My Chest', icon: () => iconURL('chest', 96),
  key() { return JSON.stringify(game.s.store) + game.s.booms + (game.emptyCells().length > 0); },
  render(body) {
    const s = game.s;
    body.appendChild(el('div', 'note', 'Drag a block onto the Chest to keep it safe. Blocks in the chest don’t make gold. Tap one to put it back on your board!'));
    const blocks = game.storedTiers().sort((a, b) => b - a);
    if (s.booms) blocks.unshift('boom');
    if (!blocks.length) body.appendChild(el('div', 'note', 'Your chest is empty.'));
    else {
      const g = el('div', 'grid-items');
      for (const t of blocks) {
        const it = el('button', 'item');
        it.appendChild(img(t === 'boom' ? iconURL('boom', 64) : tierURL(t, 64)));
        it.appendChild(el('span', 'count', String(t === 'boom' ? s.booms : s.store['b' + t])));
        it.appendChild(el('small', '', t === 'boom' ? 'Boom Block' : TIERS[t].name));
        it.addEventListener('click', () => { if (game.unstore(t) >= 0) refreshPanel(true); });
        g.appendChild(it);
      }
      body.appendChild(g);
    }
    const bars = Object.keys(INGOTS).filter((id) => game.have('i:' + id));
    if (bars.length) {
      body.appendChild(el('div', 'section', '✨ Metal bars'));
      const g = el('div', 'grid-items');
      for (const id of bars) {
        const it = el('div', 'item');
        it.appendChild(img(barURL(id, 64)));
        it.appendChild(el('span', 'count', String(game.have('i:' + id))));
        it.appendChild(el('small', '', INGOTS[id].name.replace('Ingot', 'Bar')));
        g.appendChild(it);
      }
      body.appendChild(g);
    }
  },
};

// --- Grown-ups corner (behind a press-and-hold gate)
let gateOpen = false;
const SUMS = [['seven plus five', 12], ['nine plus six', 15], ['eight plus seven', 15], ['six plus eight', 14], ['nine plus four', 13]];
let gateStep = 0, gateSum = SUMS[0];
PANELS.parent = {
  title: () => 'Grown-ups', icon: () => iconURL('gear', 96),
  key() { return gateOpen + ':' + gateStep + JSON.stringify(settings()); },
  onClose() { gateOpen = false; gateStep = 0; },
  render(body) {
    if (!gateOpen && gateStep === 0) {
      const g = el('div', 'gate');
      g.appendChild(el('div', 'note', 'For grown-ups: press and hold the circle with one finger for 3 seconds.'));
      const b = el('button', '', 'Hold');
      let t0 = 0, raf = 0, pid = null, fingers = 0;
      const reset = () => { cancelAnimationFrame(raf); raf = 0; pid = null; b.style.setProperty('--p', '0%'); };
      const tick = () => {
        const p = Math.min(1, (performance.now() - t0) / 3000);
        b.style.setProperty('--p', p * 100 + '%');
        if (p >= 1) { raf = 0; b.textContent = 'Let go'; return; }
        raf = requestAnimationFrame(tick);
      };
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        fingers++;
        if (pid !== null || fingers > 1) { reset(); return; } // two fingers = not a grown-up hold
        pid = e.pointerId; t0 = performance.now(); tick();
      });
      const up = (e) => {
        fingers = Math.max(0, fingers - 1);
        if (e.pointerId !== pid) return;
        const held = performance.now() - t0;
        reset();
        if (held >= 3000) { // open on release, so the lifting finger can't press anything
          gateStep = 1; gateSum = SUMS[Math.floor(Math.random() * SUMS.length)];
          uiOpenedAt = performance.now(); refreshPanel(true);
        } else b.textContent = 'Hold';
      };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', (e) => { if (e.pointerId === pid) reset(); });
      g.appendChild(b);
      body.appendChild(g);
      return;
    }
    if (!gateOpen) {
      const g = el('div', 'gate');
      g.appendChild(el('div', 'section', `What is ${gateSum[0]}?`));
      const inp = el('input'); inp.type = 'text'; inp.inputMode = 'numeric'; inp.maxLength = 3; inp.className = 'sum';
      const go = el('button', 'buy', 'OK');
      go.style.cssText = 'width:auto;height:58px;border-radius:16px;font-size:20px;background:linear-gradient(#8ef06a,#4fbf4a)';
      const check = () => {
        if (Number(inp.value.trim()) === gateSum[1]) { gateOpen = true; sound.play('done'); refreshPanel(true); }
        else { sound.play('deny'); inp.value = ''; }
      };
      go.addEventListener('click', check);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });
      g.appendChild(inp); g.appendChild(go);
      body.appendChild(g);
      setTimeout(() => inp.focus(), 50);
      return;
    }
    const st = settings();
    const toggle = (label, opts, cur, set) => {
      const t = el('div', 'toggle');
      for (const [txt, v] of opts) {
        const b = el('button', v === cur ? 'on' : '', txt);
        b.addEventListener('click', () => { set(v); save(); refreshPanel(true); });
        t.appendChild(b);
      }
      body.appendChild(row(null, label, t));
    };
    toggle('Sound', [['On', true], ['Off', false]], st.sound, (v) => { st.sound = v; sound.enabled = v; });
    toggle('Read words out loud', [['On', true], ['Off', false]], st.speak, (v) => { st.speak = v; });
    toggle('Numbers on blocks', [['On', true], ['Off', false]], st.nums, (v) => { st.nums = v; renderBoard(); });
    toggle('Break reminder', [['Off', 0], ['20 min', 20], ['30 min', 30], ['45 min', 45]], st.rest, (v) => { st.rest = v; restShown = false; });
    toggle('Energy limit', [['On', true], ['Off', false]], st.energy, (v) => { st.energy = v; });
    toggle('Pretend card limit', [['None', 0], ['$10', 10], ['$25', 25], ['$50', 50]], st.cardLimit, (v) => { st.cardLimit = v; });
    body.appendChild(el('div', 'note', 'The store is pretend: checkout only accepts a game-card number starting 0000 (any other number is “declined”). No real money is involved, and the card number is never saved or sent anywhere — only its last 4 digits appear in the history below. Ezra’s Mine has no ads, chat or accounts; progress is saved in this browser on this device. The break reminder is a friendly card that never locks the game.'));
    const s0 = game.s;
    const spent = el('div');
    spent.appendChild(el('small', '', `Pretend money spent: ${money(s0.cardSpent)}` + (st.cardLimit ? ` of ${money(st.cardLimit)} limit` : '')));
    body.appendChild(row(null, 'Game card', spent, buyButton('Reset', null, true, () => { s0.cardSpent = 0; save(); }, 'alt')));
    if (s0.purchases.length) {
      body.appendChild(el('div', 'section', '🧾 Purchase history'));
      const h = el('div', 'history');
      for (const p of s0.purchases.slice(-20).reverse()) {
        const line = el('div');
        const when = p.t ? new Date(p.t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
        line.appendChild(el('span', '', `${p.name} · ${when}`));
        line.appendChild(el('span', '', `${money(p.price)} ••${p.last4}`));
        h.appendChild(line);
      }
      body.appendChild(h);
    }
    const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
    if (!standalone) body.appendChild(el('div', 'note', '💡 On an iPad, tap Share → “Add to Home Screen” and play from that icon. Safari can clear saved games for websites that aren’t opened for a while; the home-screen app keeps them safe.'));
    const s = game.s;
    body.appendChild(el('div', 'note', `Play stats: level ${s.level}, ${Object.keys(s.seen).length} of ${MAX_TIER} blocks found, ${fmt(s.stats.merges)} merges, ${fmt(s.stats.mined)} blocks mined.`));
    // Reset (hidden behind a second hold)
    const rb = el('button', 'buy', 'Start over…');
    rb.style.background = 'linear-gradient(#ffb0a8,#e0403a)';
    rb.addEventListener('click', () => {
      if (window.confirm('Start a brand new game? Ezra’s mine will start over (you can undo this once from this screen).')) {
        try {
          save(); localStorage.setItem(SAVE_KEY + '.bak', localStorage.getItem(SAVE_KEY) || '');
          // the grown-ups' settings, card limit and purchase history carry over
          localStorage.setItem(SAVE_KEY + '.keep', JSON.stringify({ settings: game.s.settings, cardSpent: game.s.cardSpent, purchases: game.s.purchases }));
          localStorage.removeItem(SAVE_KEY);
        } catch (e) { /* ignore */ }
        skipSave = true;
        location.reload();
      }
    });
    body.appendChild(row(null, 'Start a new game', 'Keeps one backup you can restore', rb));
    let bak = null;
    try { bak = localStorage.getItem(SAVE_KEY + '.bak'); } catch (e) { /* ignore */ }
    if (bak) {
      const rs = el('button', 'buy', 'Restore');
      rs.addEventListener('click', () => {
        if (!window.confirm('Go back to the game from before “Start over”?')) return;
        try { localStorage.setItem(SAVE_KEY, bak); localStorage.removeItem(SAVE_KEY + '.bak'); } catch (e) { /* ignore */ }
        skipSave = true; location.reload();
      });
      body.appendChild(row(null, 'Undo “Start over”', 'Brings back the earlier game', rs));
    }
    const link = el('button', 'buy', 'Open');
    link.addEventListener('click', () => { save(); location.href = '../'; });
    body.appendChild(row(null, 'Ezra’s Blocks', 'The 3D building game', link));
  },
};

// ------------------------------------------------------------------ tutorial hints
const handEl = $('hand');
function showHandAt(target, mode = 'tap', to) {
  const c = elCenter(target);
  handEl.style.left = c.x - 20 + 'px';
  handEl.style.top = c.y - 6 + 'px';
  handEl.className = mode;
  if (mode === 'drag' && to) {
    handEl.style.setProperty('--dx', to.x - c.x + 'px');
    handEl.style.setProperty('--dy', to.y - c.y + 'px');
  }
}
function hideHand() { handEl.className = ''; }
function tutorialDone(k) { game.s.tut = game.s.tut || {}; game.s.tut[k] = 1; hideHand(); }
function maybeTutorial() {
  const s = game.s;
  s.tut = s.tut || {};
  if (!s.tut.merge && s.stats.merges === 0) {
    const pairs = game.mergeablePairs();
    if (pairs.length) {
      const [a, b] = pairs[0];
      setTimeout(() => {
        if (s.stats.merges || drag) return;
        showHandAt(cellEls[a], 'drag', cellCenter(b));
        hint('Drag a block onto its twin to merge them!', 4000);
        speak('Drag a block onto the same block!');
      }, 700);
    }
  }
}
function idleHints(now) {
  const s = game.s;
  if (celOpen || panelOpen || drag) return;
  if (s.stats.taps === 0 && now - lastAction > 1200 && !handEl.className) {
    showHandAt($('mine'), 'tap');
    return;
  }
  // After 8 quiet seconds, gently wiggle a pair that could merge.
  if (now - lastAction > 8000 && s.stats.merges < 40) {
    // don't nudge him to merge blocks the next pickaxe needs
    const goal = game.activeQuests()[0], rec = PICK_RECIPES[s.pick + 1];
    const keep = goal && goal.q.metric === 'pick' && rec ? Object.keys(rec.need).filter((k) => k[0] === 'b').map((k) => Number(k.slice(1))) : [];
    const pairs = game.mergeablePairs().filter(([x]) => !keep.includes(s.board[x].t));
    if (pairs.length) {
      const [a, b] = pairs[0];
      cellEls[a].classList.add('hinted'); cellEls[b].classList.add('hinted');
      setTimeout(() => { cellEls[a].classList.remove('hinted'); cellEls[b].classList.remove('hinted'); }, 2400);
      lastAction = now - 3000;
    }
  }
}

// ------------------------------------------------------------------ gold "pops" from blocks
let popT = 0;
function goldPops(dt) {
  popT += dt;
  if (popT < 1.6) return;
  popT = 0;
  const filled = [];
  game.s.board.forEach((c, i) => { if (c && c.t) filled.push(i); });
  if (!filled.length || document.hidden || celOpen || panelOpen) return;
  const mult = game.goldMult();
  for (let k = 0; k < Math.min(2, filled.length); k++) {
    const i = filled[Math.floor(Math.random() * filled.length)];
    const c = cellCenter(i);
    floatText(c.x, c.y - cellSize * 0.35, '+' + fmt(TIERS[game.s.board[i].t].gps * mult * 1.6));
  }
}

// ------------------------------------------------------------------ rest reminder
function restCheck(dt) {
  const st = settings();
  if (!document.hidden) playSecs += dt;
  if (!st.rest || restShown || playSecs < st.rest * 60) return;
  restShown = true;
  celebrate({
    title: 'Great mining today!', img: iconURL('mole', 160), name: 'Digby is getting sleepy…',
    text: 'Maybe it’s time for a little break? Your blocks keep making gold while you’re away.',
    say: 'Great mining today! Maybe it is time for a little break?',
    noKeys: true,
    buttons: [
      { text: 'Done for now', fn: () => { save(); sleepScreen(); } },
      // a snooze: ask again in 10 minutes
      { text: 'Keep digging', fn: () => { restShown = false; playSecs = Math.max(0, settings().rest * 60 - 600); } },
    ],
  });
}
function sleepScreen() {
  celebrate({ title: 'See you next time!', img: iconURL('star', 160), name: 'Bye bye, miner!', text: 'Your mine is saved. Come back any time.', ok: 'Play again', noKeys: true,
    buttons: [{ text: 'Play again', fn: () => { restShown = false; playSecs = 0; } }] });
}

// ------------------------------------------------------------------ main loop
let last = performance.now(), saveT = 0, panelT = 0, skipSave = false;
function frame(now) {
  const rdt = Math.min(0.25, (now - last) / 1000);
  last = now;
  const dt = rdt * timeScale;
  game.tick(dt);
  updateHud(rdt);
  goldPops(rdt);
  idleHints(now);
  restCheck(rdt);
  saveT += rdt; panelT += rdt;
  if (saveT > 5) { saveT = 0; if (!skipSave) save(); }
  if (panelT > 0.4) { panelT = 0; refreshPanel(); if (panelOpen && PANELS[panelOpen].tick) PANELS[panelOpen].tick(); }
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ boot
function init() {
  const saved = loadSave();
  game = new Game(saved, { on: (t, d) => onGameEvent(t, d) });
  settings();
  sound.enabled = settings().sound;
  buildBoard();
  initHud();
  initMine();
  initStations();
  initBoardInput();
  layout();
  renderBoard();
  applyCave(false);
  updateHud(1);

  // Swallow taps that land within 0.4s of a panel/card opening (double taps).
  for (const id of ['panel', 'celebrate', 'checkout']) {
    $(id).addEventListener('click', (e) => {
      if (performance.now() - uiOpenedAt < 400) { e.stopImmediatePropagation(); e.preventDefault(); }
    }, true);
  }
  $('panel-close').addEventListener('click', closePanel);
  let downOnBackdrop = false;
  $('panel').addEventListener('pointerdown', (e) => { downOnBackdrop = e.target === $('panel'); });
  $('panel').addEventListener('click', (e) => {
    if (e.target === $('panel') && downOnBackdrop && performance.now() - uiOpenedAt > 400) closePanel();
    downOnBackdrop = false;
  });
  $('btn-settings').addEventListener('click', () => { sound.resume(); openPanel('parent'); });
  $('btn-rush').addEventListener('click', () => {
    sound.resume();
    if (game.rushReady()) { game.startRush(); return; } // adds on top of any boost running
    if (game.s.boostLeft > 0) return;
    openPanel('store', 'boost');
  });
  initCheckout();
  for (const id of ['pill-gems', 'pill-bricks']) $(id).addEventListener('click', () => { sound.resume(); openPanel('store', 'gems'); });
  $('energy').addEventListener('click', () => { sound.resume(); openPanel('store', 'energy'); });
  $('btn-pass').addEventListener('click', () => { sound.resume(); openPanel('store', 'pass'); });
  for (const [id, msg] of [['pill-gold', 'Gold comes from the blocks on your board!']]) {
    $(id).addEventListener('click', () => { hint(msg); speak(msg); });
  }
  initGoal();
  // Keyboard (laptop): Space/Enter mines (held = slow repeat), Esc closes things.
  let lastKeyTap = 0;
  window.addEventListener('keydown', (e) => {
    if (coOpen()) { // typing a card on a laptop keyboard
      e.preventDefault();
      if (/^[0-9]$/.test(e.key)) coKey(e.key);
      else if (e.key === 'Backspace') coKey('del');
      else if (e.key === 'Enter') coBuy();
      else if (e.key === 'Escape') closeCheckout();
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (celOpen) { if (!e.repeat && !(celCurrent && celCurrent.noKeys)) { const ok = $('cel-ok'); if (ok) ok.click(); } return; }
      if (panelOpen) return;
      const now = performance.now();
      if (e.repeat && now - lastKeyTap < 330) return;
      lastKeyTap = now;
      const m = $('mine'); m.classList.remove('hit'); void m.offsetWidth;
      mineTap();
    } else if (e.key === 'Escape') {
      if (celOpen) {
        if (celCurrent && celCurrent.escCloses) { clearTimeout(celTimer); nextCelebration(); }
        else if (!(celCurrent && celCurrent.noKeys)) { const ok = $('cel-ok'); if (ok) ok.click(); }
      } else closePanel();
    }
  });
  // No pinch / double-tap zoom on iPad.
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  window.addEventListener('resize', () => { hideHand(); layout(); });
  window.addEventListener('orientationchange', () => { hideHand(); setTimeout(layout, 200); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (!skipSave) save(); }
    else {
      // Back after a real break (15+ min): the break-reminder clock starts fresh.
      if (Date.now() - (game.s.lastSeen || Date.now()) > 15 * 60 * 1000) { playSecs = 0; restShown = false; }
      const g = game.applyOffline(Date.now());
      if (g > 0) celebrate({ title: 'Welcome back!', img: iconURL('chest', 160), name: 'Your mine made gold!', loot: [{ icon: COIN(), text: '+' + fmt(g) }], sound: 'chest', say: 'Welcome back!' });
      last = performance.now();
    }
  });
  window.addEventListener('pagehide', () => { if (!skipSave) save(); });
  // iPad only lets sound start inside a real gesture (touchend/click, not
  // pointerdown), so keep trying on those until audio is running.
  const unlock = () => {
    sound.resume();
    if (!gotFirstTouch && 'speechSynthesis' in window) {
      gotFirstTouch = true;
      try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) { /* ignore */ }
    }
    if (sound.ctx && sound.ctx.state === 'running') for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) window.removeEventListener(ev, unlock, true);
  };
  for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(ev, unlock, true);

  // Gold earned while away.
  if (saved) {
    const g = game.applyOffline(Date.now());
    if (g > 0) celebrate({ title: 'Welcome back!', img: iconURL('chest', 160), name: 'Your mine made gold!', loot: [{ icon: COIN(), text: '+' + fmt(g) }], say: 'Welcome back!' });
  } else {
    game.s.lastSeen = Date.now();
    game.s.settings = Object.assign({}, SETTINGS_DEFAULT);
    try { // after "Start over": bring back the grown-ups' settings + history
      const keep = JSON.parse(localStorage.getItem(SAVE_KEY + '.keep') || 'null');
      if (keep) {
        if (keep.settings) Object.assign(game.s.settings, keep.settings);
        if (keep.cardSpent >= 0) game.s.cardSpent = keep.cardSpent;
        if (Array.isArray(keep.purchases)) game.s.purchases = keep.purchases;
        localStorage.removeItem(SAVE_KEY + '.keep');
        sound.enabled = settings().sound;
      }
    } catch (e) { /* ignore */ }
  }

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => { });
  }
  // Ask the browser not to clear the saved game when space runs low.
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { }); } catch (e) { /* ignore */ }

  // Debug / support handle (also used by the automated tests).
  window.__mine = {
    game, renderBoard, layout, save, openPanel, closePanel,
    speed(x) { timeScale = x; },
    noSave() { skipSave = true; },
    openCheckout, checkout: () => co && { id: co.id, digits: co.digits.length, state: co.state },
    cellCenter, elCenter: (id) => elCenter($(id)), station: (id) => elCenter(stationEls[id]),
    celebrations: () => celQueue.length + (celOpen ? 1 : 0),
    dismiss() { while (celOpen) nextCelebration(); },
  };
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
}

try { init(); } catch (e) { showError(e && e.stack || e); }
