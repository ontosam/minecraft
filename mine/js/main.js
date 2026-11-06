// Ezra's Mine — the screen: board, mine block (and monsters), dock, panels
// (workbench, hero, furnace, shop, village, quests…), the guide's tutorial,
// celebrations, effects, sound and saving. The rules live in game.js; this
// file only draws them and turns taps/drags into game actions.

import { Game, SAVE_KEY, N_CELLS, UNLOCK_ORDER, validateCard } from './game.js';
import {
  TIERS, MAX_TIER, COLS, ROWS, caveFor, xpNeeded, openCells, MATERIALS, GEAR, SLOTS, SLOT_NAME, gearName,
  RECIPES, SMELT, FUEL_TIER, MONSTERS, BOOSTERS, BUILDINGS, VILLAGE_MERGES, shaftNeed, TASKS, ACHIEVEMENTS, HUNT,
  SKINS, STORE, STORE_TABS, storeItem, ENERGY, CARD_DIGITS, SWORD_ATK, PICK_TAPS, BOW_ATK, armorPoints,
} from './data.js';
import {
  tileURL, iconURL, tileColors, crackURL, buildingURL,
  swordURL, pickURL, armorURL, itemURL, emeraldURL, monsterURL, guideURL, heroURL,
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
const GEM = () => emeraldURL(64);

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
    const obj = JSON.parse(raw);
    // The first version's save gets converted: keep the original, just in case.
    if (obj && !(obj.v >= 2) && !localStorage.getItem(SAVE_KEY + '.v1bak')) localStorage.setItem(SAVE_KEY + '.v1bak', raw);
    return obj;
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
const CHEST_GOLD = { t: 0xf6c935, b: 0xd99a1e, B: 0x8a5a10 };
function chestURL(kind, size = 96) { return kind === 'gold' ? iconURL('chest', size, CHEST_GOLD) : iconURL('chest', size); }
function renderCell(i) {
  const s = game.s, c = s.board[i], e = cellEls[i];
  const open = game.isOpen(i);
  // Only the next couple of locked squares show a padlock; the rest stay quiet.
  const soon = !open && UNLOCK_ORDER.indexOf(i) < openCellsNow() + 2;
  const key = open ? (c ? (c.chest ? 'chest-' + c.chest : 't' + c.t) : 'empty') + (settings().nums ? 'n' : '') : 'lock' + (soon ? game.unlockLevel(i) : '');
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
  if (c.chest) { const b = el('div', 'chest-blk' + (c.chest === 'gold' ? ' gold' : '')); b.appendChild(img(chestURL(c.chest, 96))); e.appendChild(b); return; }
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

// Pictures for anything in the storage chest.
function gearURL(id, size = 96) {
  const g = GEAR[id];
  if (!g) return tileURL('mystery', size);
  if (g.slot === 'sword') return swordURL(g.mat, size);
  if (g.slot === 'pick') return pickURL(g.mat, size);
  if (g.slot === 'bow') return itemURL('bow', size);
  if (g.slot === 'orb') return itemURL('orb', size);
  return armorURL(g.slot === 'chest' ? 'chestplate' : g.slot === 'legs' ? 'leggings' : g.slot, g.mat, size);
}
function invURL(k, size = 96) {
  if (k[0] === 'b') return tierURL(Number(k.slice(1)), size);
  if (k.startsWith('m:')) return itemURL(k.slice(2), size);
  if (k.startsWith('g:')) return gearURL(k.slice(2), size);
  return tileURL('mystery', size);
}
function invName(k) {
  if (k[0] === 'b') return TIERS[Number(k.slice(1))].name;
  if (k.startsWith('m:')) return (MATERIALS[k.slice(2)] || {}).name || k;
  if (k.startsWith('g:')) return gearName(k.slice(2));
  return k;
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
  setText('xptext', `${Math.floor(s.xp)} / ${fmt(need)}`);
  $('xpfill').style.width = Math.min(100, (s.xp / need) * 100) + '%';
  setText('cave-name', game.cave().name);
  // BOOST button: shows the longest running booster
  const rb = $('btn-rush');
  const left = Math.max(s.boosts.damage, s.boosts.gold, s.boosts.block);
  rb.classList.toggle('active', left > 0);
  setText('rush-time', left > 0 ? fmtTime(left) : 'x2');
  document.body.classList.toggle('rush', s.boosts.gold > 0);
  $('pill-bricks').classList.toggle('later', !(s.bricks > 0 || s.level >= 3));
  $('pill-gems').classList.toggle('later', !(s.gems > 0));
  rb.classList.toggle('later', s.level < 3 && left <= 0);
  updateGoal();
  // Energy bar (yellow lightning): every block broken uses one.
  const on = game.energyOn(), en = $('energy');
  en.classList.toggle('inf', !on);
  en.classList.toggle('out', on && s.energy < 1);
  $('energybar').firstElementChild.style.width = (on ? Math.min(100, (s.energy / game.energyMax()) * 100) : 100) + '%';
  const et = on ? (s.energy >= 1 ? `${Math.floor(s.energy)}/${game.energyMax()}` : `+1 in ${Math.ceil(game.secsToNextEnergy())}s`) : '∞';
  const num = $('energy-num'); if (num.textContent !== et) num.textContent = et;
  $('mine').classList.toggle('empty', on && s.energy < 1 && !s.monster);
  const pb = $('btn-pass'), pt = s.iap.pass ? '⭐ SUPER MINER' : '⭐ PASS';
  if (pb.textContent !== pt) pb.textContent = pt;
  pb.classList.toggle('owned', !!s.iap.pass);
  updateMine();
  updateStations();
}

// ------------------------------------------------------------------ goal card
let goalKey = '';
function questIcon(q) {
  const m = q.metric;
  if (m === 'tier') return tierURL(Math.min(MAX_TIER, q.n), 64);
  if (m === 'taps' || m === 'mined') return pickURL('wood', 64);
  if (m === 'opened') return chestURL('wood', 64);
  if (m === 'merges') return iconURL('sparkle', 64);
  if (m === 'level') return iconURL('star', 64);
  if (m === 'kills' || m.startsWith('kill:')) return monsterURL(m.startsWith('kill:') ? m.slice(5) : 'grumble', 64);
  if (m === 'builds') return iconURL('house', 64);
  if (m === 'smelts') return iconURL('furnace', 64);
  if (m === 'equip:sword') return swordURL('wood', 64);
  if (m === 'equip:pick') return pickURL('stone', 64);
  if (m === 'armorCrafted' || m === 'armorWorn') return armorURL('chestplate', 'iron', 64);
  if (m.startsWith('craft:')) {
    const id = m.slice(6);
    if (id === 'planks' || id === 'stick') return itemURL(id, 64);
    if (GEAR[id]) return gearURL(id, 64);
    return iconURL('hammer', 64);
  }
  return iconURL('book', 64);
}
function updateGoal() {
  const a = game.activeTasks()[0];
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
}
function initGoal() {
  $('goal').addEventListener('click', () => {
    sound.resume();
    const a = game.activeTasks()[0];
    if (!a) return;
    if (a.ready) { game.claim('t', a.i); goalKey = ''; return; }
    speak(a.q.text);
    const m = a.q.metric;
    const go = m.startsWith('craft:') ? 'craft' : m.startsWith('equip:') || m === 'armorWorn' ? 'hero' : m === 'smelts' ? 'furnace' : m === 'builds' ? 'village' : null;
    if (go && stationOpen(go)) { openPanel(go); return; }
    hint(`${a.q.text} (${fmt(a.have)} / ${fmt(a.q.n)})`);
  });
}

// ------------------------------------------------------------------ mine block
let mineKey = '';
function updateMine() {
  const s = game.s, m = s.monster;
  const key = m ? 'm' + m.id : 'b' + game.dropTier() + ':' + (game.gearMat('pick') || '-');
  if (key !== mineKey) {
    mineKey = key;
    $('mine').classList.toggle('monster', !!m);
    if (m) $('mine-monster').src = monsterURL(m.id, 160);
    else {
      $('mine-img').src = tierURL(game.dropTier(), 128);
      const pm = game.gearMat('pick');
      $('mine-pick').style.display = pm ? '' : 'none';
      if (pm) $('mine-pick').src = pickURL(pm, 128);
    }
  }
  if (m) {
    $('mine-hp').firstElementChild.style.width = Math.max(0, (m.hp / m.max) * 100) + '%';
    const t = `${m.hp}/${m.max}`;
    const sp = $('mine-hp').querySelector('span'); if (sp.textContent !== t) sp.textContent = t;
    $('mine-taps').textContent = '⚔' + game.attack();
  } else {
    const max = game.tapsPerBlock();
    const stage = max <= 1 ? 0 : Math.round((1 - s.mineHp / max) * 4);
    const cu = crackURL(stage, 128);
    if ($('mine-crack').getAttribute('src') !== cu) $('mine-crack').src = cu;
    $('mine-taps').textContent = String(s.mineHp);
  }
}

function mineTap() {
  sound.resume();
  lastAction = performance.now();
  hideHand();
  return game.tapMine();
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
  { id: 'craft', name: 'Workbench', icon: () => iconURL('hammer', 96), side: 'a', unlock: 1 },
  { id: 'furnace', name: 'Furnace', icon: () => iconURL('furnace', 96), side: 'a', unlock: 4 },
  { id: 'shop', name: 'Shop', icon: () => iconURL('cart', 96), side: 'a', unlock: 3 },
  { id: 'village', name: 'Village', icon: () => iconURL('house', 96), side: 'a', merges: VILLAGE_MERGES },
  { id: 'quests', name: 'Quests', icon: () => iconURL('book', 96), side: 'b', unlock: 1 },
  { id: 'book', name: 'Blocks', icon: () => iconURL('shelf', 96), side: 'b', unlock: 1 },
  { id: 'chest', name: 'Chest', icon: () => iconURL('chest', 96), side: 'b', unlock: 1 },
  { id: 'hero', name: 'Hero', icon: () => heroIcon(), side: 'b', unlock: 1 },
];
function heroIcon(size = 96) {
  return heroURL(heroGear(), size);
}
function heroGear() {
  const s = game.s, mat = (slot) => game.gearMat(slot);
  return { helmet: mat('helmet'), chest: mat('chest'), legs: mat('legs'), boots: mat('boots'), sword: mat('sword'), pick: mat('pick'), bow: !!s.equip.bow, orb: !!s.equip.orb, skin: s.skin || 'classic' };
}
function stationOpen(id) {
  const st = STATIONS.find((x) => x.id === id);
  if (!st) return true;
  if (st.merges) return !!game.s.villageOpen;
  return game.s.level >= st.unlock;
}
const stationEls = {};
function initStations() {
  for (const st of STATIONS) {
    const b = el('button', 'station');
    b.dataset.id = st.id;
    b.appendChild(img(st.icon()));
    b.appendChild(el('span', '', st.name));
    b.addEventListener('click', () => {
      sound.resume();
      if (!stationOpen(st.id)) {
        sound.play('deny');
        const msg = st.merges ? `Merge ${st.merges} blocks to open the Village! (${Math.min(game.s.stats.merges, st.merges)}/${st.merges})` : `${st.name} opens at level ${st.unlock}!`;
        toast(msg, st.icon()); speak(msg);
        return;
      }
      openPanel(st.id);
    });
    $(st.side === 'a' ? 'stations-a' : 'stations-b').appendChild(b);
    stationEls[st.id] = b;
  }
}
let heroKey = '';
function updateStations() {
  const s = game.s;
  s.seenSt = s.seenSt || {};
  for (const st of STATIONS) {
    const b = stationEls[st.id];
    const locked = !stationOpen(st.id);
    b.classList.toggle('locked', locked);
    const label = b.querySelector('span');
    const want = locked ? (st.merges ? `🔒 ${Math.min(s.stats.merges, st.merges)}/${st.merges}` : '🔒 Lv ' + st.unlock)
      : st.id === 'chest' ? (game.invBlocks() ? `Chest (${game.invBlocks()})` : 'Chest') : st.name;
    if (label.textContent !== want) label.textContent = want;
    let n = b.querySelector('.new');
    const showNew = !locked && (st.unlock > 1 || st.merges) && !s.seenSt[st.id];
    if (showNew && !n) { n = el('span', 'new', 'NEW'); b.appendChild(n); }
    if (!showNew && n) n.remove();
    if (st.id === 'quests') {
      const r = game.readyQuests();
      let bd = b.querySelector('.badge');
      if (r && !bd) { bd = el('span', 'badge'); b.appendChild(bd); }
      if (bd) { if (r) bd.textContent = String(r); else bd.remove(); }
    }
  }
  const hk = JSON.stringify(heroGear());
  if (hk !== heroKey) { heroKey = hk; stationEls.hero.querySelector('img').src = heroIcon(); }
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
    if (!stationOpen(id)) continue;
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
  if (!c || c.chest) return 0;
  let n = 0;
  game.s.board.forEach((o, j) => {
    if (j === i || !o || o.chest) return;
    if (c.t && o.t === c.t && c.t < MAX_TIER) { cellEls[j].classList.add('match'); n++; }
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
      ghost.querySelector('img').src = tierURL(c.t, 128);
      ghost.style.display = 'block';
      sound.play('pick');
    }
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
      if (d.station === 'chest') game.storeBlock(d.src);
      else if (d.station === 'furnace') game.smeltFromBoard(d.src);
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
  if (c && c.chest) { deselect(); game.openChest(i); return; }
  if (selected >= 0 && selected !== i) {
    const a = selected, A = game.s.board[a];
    if (A && c && A.t && A.t === c.t) {
      // tap-tap: the first block flies over to its twin
      deselect();
      const from = cellCenter(a), to = cellCenter(i);
      cellEls[a].classList.add('hidden-blk');
      flying = true;
      fly(tierURL(A.t, 96), from, to, cellSize * 0.75, 260, 'flyblock').then(() => {
        flying = false;
        cellEls[a].classList.remove('hidden-blk');
        game.drop(a, i);
        deselect();
        renderBoard();
      });
      return;
    }
    if (!c) { deselect(); game.drop(a, i); renderBoard(); return; }
  }
  if (!c) { deselect(); return; }
  if (selected === i) { deselect(); return; }
  select(i);
  sound.play('pick');
  const t = TIERS[c.t];
  hint(t.gps ? `${t.name} · makes ${fmt(t.gps * game.goldMult())} gold a second` : `${t.name} · drag it to your Chest to craft with it`);
  speak(t.name);
}

// ------------------------------------------------------------------ game events → effects
let lastFullToast = 0;
function onGameEvent(type, d) {
  const s = game.s;
  switch (type) {
    case 'hit': {
      sound.play('hit');
      const m = $('mine');
      m.classList.remove('hit'); void m.offsetWidth; m.classList.add('hit');
      const c = elCenter(m);
      burst(c.x, c.y - 10, tileColors(TIERS[game.dropTier()].art), 4, 60);
      updateMine();
      break;
    }
    case 'break': {
      const from = elCenter($('mine'));
      sound.play('break');
      burst(from.x, from.y, tileColors(TIERS[game.dropTier()].art), 12, 110);
      for (const dr of d.drops) {
        if (dr.stored) {
          fly(tierURL(dr.t, 96), from, elCenter(stationEls.chest), 46, 500, 'flyblock');
          if (performance.now() - lastFullToast > 6000) { lastFullToast = performance.now(); hint('Board full! New blocks go in your Chest 📦'); }
          continue;
        }
        const e = cellEls[dr.cell];
        e.classList.add('hidden-blk');
        renderCell(dr.cell);
        fly(chestURL(dr.chest, 96), from, cellCenter(dr.cell), cellSize * 0.75, 420, 'flyblock').then(() => {
          e.classList.remove('hidden-blk');
          renderCell(dr.cell);
          animCell(dr.cell, 'land');
          sound.play('drop');
        });
      }
      tutorialPoke();
      break;
    }
    case 'open': {
      sound.play('chest');
      renderCell(d.i); animCell(d.i, 'pop');
      const c = cellCenter(d.i);
      burst(c.x, c.y, ['#c99a5b', '#8a6a3a', '#fff6c9'], 10, 70);
      tutorialPoke();
      break;
    }
    case 'treasure': {
      sound.play('chest');
      const c = cellCenter(d.i);
      burst(c.x, c.y, ['#ffd23f', '#fff6c9', '#c99a5b', '#ff8a7a'], 16, 120);
      coinsTo(c, 4, 'gold');
      setTimeout(() => coinsTo(c, 2, 'bricks'), 200);
      if (d.gems) setTimeout(() => coinsTo(c, 1, 'gems'), 400);
      renderCell(d.i); animCell(d.i, 'pop');
      const loot = [{ icon: COIN(), text: '+' + fmt(d.gold) }, { icon: BRICK(), text: '+' + d.bricks }, { icon: invURL(d.mat, 64), text: '+' + d.nMat }];
      if (d.gems) loot.push({ icon: GEM(), text: '+' + d.gems });
      celebrate({ title: 'TREASURE!', img: chestURL('gold', 160), name: 'A golden chest!', loot, say: 'Treasure!', auto: 3500 });
      break;
    }
    case 'monster': {
      sound.play('empty');
      const m = $('mine'); m.classList.remove('spawn'); void m.offsetWidth; m.classList.add('spawn');
      updateMine();
      const name = MONSTERS[d.id].name;
      hint(`${name} wandered into your mine! Tap to chase it off!`, 3500);
      speak(`Uh oh! ${name}! Tap to chase it away!`);
      tutorialPoke();
      break;
    }
    case 'hitMonster': {
      sound.play('hit');
      const m = $('mine'); m.classList.remove('hit'); void m.offsetWidth; m.classList.add('hit');
      const c = elCenter(m);
      floatText(c.x, c.y - 40, '-' + d.dmg, 'dmg');
      burst(c.x, c.y, ['#ffffff', '#ffd23f'], 5, 50);
      updateMine();
      break;
    }
    case 'kill': {
      sound.play('levelup');
      const c = elCenter($('mine'));
      burst(c.x, c.y, ['#ffd23f', '#9cff5e', '#fff', '#ff8a7a'], 22, 140);
      coinsTo(c, 6, 'gold');
      updateMine();
      const loot = [{ icon: COIN(), text: '+' + fmt(d.coins) }];
      for (const l of d.loot) loot.push({ icon: l.k === 'gems' ? GEM() : invURL(l.k, 64), text: (l.n > 1 ? '+' + l.n : '') });
      celebrate({ title: 'YOU WON!', img: monsterURL(d.id, 160), name: `${MONSTERS[d.id].name} ran away!`, text: d.first ? 'It dropped a Stone Pickaxe! Put it on in your Hero.' : '', loot, say: d.first ? 'You won! It dropped a stone pickaxe!' : 'You won!', auto: d.first ? 0 : 3500 });
      tutorialPoke();
      break;
    }
    case 'move': case 'swap': sound.play('swap'); break;
    case 'merge': {
      renderCell(d.a); renderCell(d.b);
      animCell(d.b, 'pop');
      const c = cellCenter(d.b);
      burst(c.x, c.y, tileColors(TIERS[d.t].art).concat(['#fff6c9']), 12, 80);
      if (s.seen[d.t]) sound.play('merge', d.t);
      floatText(c.x, c.y - cellSize * 0.4, '+' + d.xp + ' XP');
      fly(BRICK(), c, elCenter($('pill-bricks').querySelector('img')), 28, 550).then(() => bumpPill('pill-bricks'));
      if (d.gem) coinsTo(c, 1, 'gems');
      tutorialPoke();
      break;
    }
    case 'villageOpen': {
      celebrate({ title: 'THE VILLAGE IS OPEN!', img: iconURL('house', 160), name: 'You merged 29 blocks!', text: 'Use your bricks to build houses that help you mine.', sound: 'levelup', say: 'The village is open! Use your bricks to build!' });
      break;
    }
    case 'discover': {
      if (d.t <= 1) break;
      sound.play('new');
      const t = TIERS[d.t];
      celebrate({
        title: 'NEW BLOCK!', img: tierURL(d.t, 160), name: t.name,
        text: t.gps ? `Makes ${fmt(t.gps)} gold every second!` : 'A crafting block — put it in your Chest!',
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
    case 'store': {
      sound.play('store');
      fly(tierURL(d.t, 96), cellCenter(d.i), elCenter(stationEls.chest), 46, 450, 'flyblock').then(() => stationPulse('chest'));
      renderCell(d.i);
      tutorialPoke();
      break;
    }
    case 'unstore': { sound.play('drop'); renderCell(d.cell); animCell(d.cell, 'land'); break; }
    case 'grid': sound.play('pick'); break;
    case 'craft': {
      sound.play('craft');
      setTimeout(() => sound.play('buy'), 120);
      const r = d.recipe;
      toast(`You made ${r.n > 1 ? r.n + ' ' : 'a '}${r.name}!`, invURL(r.out, 64));
      speak('You made ' + r.name + '!');
      tutorialPoke();
      break;
    }
    case 'equip': sound.play('buy'); tutorialPoke(); break;
    case 'skin': sound.play('buy'); break;
    case 'fuelFromBoard': renderCell(d.i); break;
    case 'smeltStart': {
      sound.play('smelt');
      if (d.i !== undefined) {
        fly(tierURL(d.t, 96), cellCenter(d.i), elCenter(stationEls.furnace), 46, 450, 'flyblock').then(() => stationPulse('furnace'));
        renderCell(d.i);
      }
      break;
    }
    case 'unsmelt': sound.play('drop'); break;
    case 'smelted': {
      sound.play('coin');
      toast(`You made ${/^[aeiou]/i.test(invName(d.out)) ? 'an' : 'a'} ${invName(d.out)}!`, invURL(d.out, 64));
      break;
    }
    case 'booster': sound.play('levelup'); toast(`${BOOSTERS[d.id].name}! (${fmtTime(d.secs)})`, iconURL(d.id === 'damage' ? 'sword' : d.id === 'gold' ? 'coin' : 'uparrow', 64)); break;
    case 'build': sound.play('buy'); toast(`${BUILDINGS.find((b) => b.id === d.id).name} is now level ${d.lv}!`, iconURL('house', 64)); tutorialPoke(); break;
    case 'buy': sound.play('buy'); renderCell(d.cell); animCell(d.cell, 'land'); break;
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
      const msg = {
        cost: 'Not enough yet — keep mining!', gems: 'You need more emeralds 💚', full: 'Your board is full!',
        furnace: 'The furnace is full — wait a moment!', max: 'That one is already the biggest!',
        energyfull: 'Your energy is already full! ⚡', notore: 'Only Iron, Gold and Diamond ore melt in the furnace',
        nofuel: 'The furnace needs Coal to burn! 🔥', norecipe: 'That doesn’t make anything yet — try a recipe!',
        notmaterial: 'Gear goes on your Hero, not the workbench',
      }[d.reason];
      if (msg) { hint(msg); if (d.reason === 'nofuel' || d.reason === 'notore') speak(msg); }
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
    craft: 'Put materials on the table to make tools!',
    furnace: 'Melt ore with coal to make metal bars.',
    shop: 'Buy blocks and boosters with your gold.',
    village: 'Use bricks to build houses that help you!',
    hero: 'Put on your gear here.',
    quests: 'Tasks, achievements and monster hunts!',
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
  if (it.gems) return emeraldURL(size);
  if (it.bricks) return iconURL('brick', size);
  if (it.refill || it.unlimited) return iconURL('bolt', size);
  if (it.rush) return iconURL('coin', size);
  if (it.chest === 'mega') return iconURL('chest', size, { t: 0xf6c935, b: 0xd99a1e, B: 0x8a5a10 });
  if (it.chest) return iconURL('chest', size);
  if (it.pass) return iconURL('star', size);
  return iconURL('sparkle', size);
}
function storeWhat(it) {
  if (it.gems) return `+${it.gems} emeralds`;
  if (it.bricks) return `+${it.bricks} bricks`;
  if (it.refill) return 'Fill your energy right up';
  if (it.unlimited) return 'Mine forever — never run out';
  if (it.rush) return `Double gold for ${Math.round(it.rush / 60)} minutes`;
  if (it.chest === 'mega') return '6 big blocks, iron, string, 25 emeralds + lots of gold';
  if (it.chest) return '3 surprise blocks + emeralds + gold';
  if (it.pass) return 'Double gold forever, more energy, faster refills, +10 emeralds';
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
  if (s.gems >= ENERGY.gemRefill) buttons.push({ text: `Use ${ENERGY.gemRefill} 💚`, fn: () => game.refillWithGems() });
  buttons.push({ text: 'Wait' });
  celebrate({
    title: 'OUT OF ENERGY!', img: iconURL('bolt', 160), name: 'Your pickaxe is tired!',
    text: `You get +1 energy every ${Math.round(game.energyRegenSecs())} seconds — or fill it up now!`,
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
  if (co.digits.length === CARD_DIGITS) $('co-buy').scrollIntoView({ block: 'nearest' });
}
function coDecline(text) {
  sound.play('deny');
  coMsg(text, true);
  speak(text);
  const c = document.querySelector('.co-card'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake');
}
// Energy filled itself up while he was typing: nothing to buy, no charge.
function refillNotNeeded() {
  co.digits = ''; renderDigits();
  const msg = 'Your energy is already full! ⚡ No need to buy.';
  coMsg(msg); speak(msg);
  setTimeout(() => { if (co && co.state === 'enter') closeCheckout(); }, 1600);
}
function coBuy() {
  if (!co || co.state !== 'enter') return;
  const it = storeItem(co.id);
  if (co.digits.length < CARD_DIGITS) { coDecline(`Type all ${CARD_DIGITS} numbers on your card`); return; }
  if (!validateCard(co.digits)) { co.digits = ''; renderDigits(); coDecline('Card declined. Check the number and try again.'); return; }
  if (game.declineReason(it.price) === 'limit') { co.digits = ''; renderDigits(); coDecline('Card declined — not enough money left on this card.'); return; }
  if (it.refill && !game.refillUseful()) { refillNotNeeded(); return; }
  const last4 = co.digits.slice(-4);
  co.digits = ''; // the number is never kept
  renderDigits();
  co.state = 'busy';
  $('checkout').classList.add('busy');
  sound.play('process');
  setTimeout(() => {
    if (!co) return;
    if (it.refill && !game.refillUseful()) { co.state = 'enter'; $('checkout').classList.remove('busy'); refillNotNeeded(); return; }
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
let uiClosedAt = 0; // ...and taps right after one closes don't land on what was underneath
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
  uiClosedAt = performance.now();
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
const aff = (ok) => (ok ? '1' : '0');

// --- Store (pretend money)
PANELS.store = {
  title: () => 'Emerald Store', icon: () => emeraldURL(96),
  // (energy only matters on the Energy tab — rebuilding on every break would eat taps)
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
      body.appendChild(row(iconURL('bolt', 96), 'Refill with emeralds', `Use ${ENERGY.gemRefill} emeralds to fill your energy`,
        full ? buyButton('Full ✓', null, false, () => {}, 'max')
          : buyButton(String(ENERGY.gemRefill), GEM(), s.gems >= ENERGY.gemRefill, () => game.refillWithGems(), '', 'You need more emeralds 💚')));
    }
  },
};

// --- dragging items inside panels (workbench grid, hero slots) ---------------
// Tap an item = quick action; drag it = drop it on a grid square or gear slot.
let pDrag = null; // { key, x0, y0, active, onDrop, onTap }
function itemToken(key, count, opts = {}) {
  const t = el('button', 'token' + (opts.cls ? ' ' + opts.cls : ''));
  t.dataset.key = key;
  t.appendChild(img(invURL(key, 64)));
  if (count !== undefined) t.appendChild(el('span', 'count', String(count)));
  t.appendChild(el('small', '', invName(key)));
  t.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    sound.resume();
    pDrag = { key, x0: e.clientX, y0: e.clientY, active: false, onDrop: opts.onDrop, onTap: opts.onTap, pid: e.pointerId };
  });
  return t;
}
function initPanelDrag() {
  window.addEventListener('pointermove', (e) => {
    if (!pDrag || e.pointerId !== pDrag.pid) return;
    if (!pDrag.active) {
      if (Math.hypot(e.clientX - pDrag.x0, e.clientY - pDrag.y0) < 8) return;
      pDrag.active = true;
      ghost.querySelector('img').src = invURL(pDrag.key, 128);
      ghost.style.display = 'block';
      ghost.style.zIndex = 80;
    }
    const gs = cellSize * 0.8;
    ghost.style.transform = `translate(${e.clientX - gs / 2}px, ${e.clientY - gs * 0.85}px)`;
    for (const x of document.querySelectorAll('.drop-hover')) x.classList.remove('drop-hover');
    const t = dropTargetAt(e.clientX, e.clientY - 20);
    if (t) t.classList.add('drop-hover');
  });
  const end = (e) => {
    if (!pDrag || e.pointerId !== pDrag.pid) return;
    const d = pDrag; pDrag = null;
    ghost.style.display = 'none'; ghost.style.zIndex = '';
    for (const x of document.querySelectorAll('.drop-hover')) x.classList.remove('drop-hover');
    if (!d.active) { if (d.onTap) d.onTap(d.key); refreshPanel(true); return; }
    const t = dropTargetAt(e.clientX, e.clientY - 20);
    if (t && d.onDrop) d.onDrop(d.key, t);
    refreshPanel(true);
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', (e) => { if (pDrag && e.pointerId === pDrag.pid) { pDrag = null; ghost.style.display = 'none'; } });
}
function dropTargetAt(x, y) {
  const els = document.elementsFromPoint(x, y);
  for (const e of els) { const t = e.closest && e.closest('.ccell, .slot'); if (t) return t; }
  return null;
}

// --- Workbench (3x3 crafting grid) -----------------------------------------
let craftSel = null; // the recipe whose ghost pattern is shown
function ghostMap(rec) {
  const map = {};
  if (!rec) return map;
  const w = Math.max(...rec.pattern.map((r) => r.length));
  const dc = w === 1 ? 1 : 0, dr = rec.pattern.length === 1 ? 1 : 0;
  rec.pattern.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== ' ') map[(r + dr) * 3 + c + dc] = rec.key[ch]; }));
  return map;
}
function recipeSeen(rec) {
  // Show a recipe once you've had (or seen) everything it needs.
  const s = game.s;
  return Object.values(rec.key).every((k) => (k[0] === 'b' ? s.seen[Number(k.slice(1))] : (game.have(k) || s.grid.includes(k) || (s.everHad && s.everHad[k]))));
}
PANELS.craft = {
  title: () => 'Workbench', icon: () => iconURL('hammer', 96),
  key() { const s = game.s; return JSON.stringify([s.grid, craftSel, Object.keys(s.inv).filter((k) => !k.startsWith('g:')).map((k) => k + s.inv[k])]); },
  onClose() { game.gridClear(); craftSel = null; },
  render(body) {
    const s = game.s;
    const rec = game.gridRecipe();
    const sel = RECIPES.find((r) => r.id === craftSel);
    const ghosts = ghostMap(sel);
    const bench = el('div', 'bench');
    const grid = el('div', 'cgrid');
    for (let i = 0; i < 9; i++) {
      const c = el('button', 'ccell');
      c.dataset.i = i;
      if (s.grid[i]) c.appendChild(img(invURL(s.grid[i], 64)));
      else if (ghosts[i]) { const g = img(invURL(ghosts[i], 64), 'ghost'); c.appendChild(g); }
      c.addEventListener('click', () => { if (s.grid[i]) { game.gridTake(i); refreshPanel(true); } });
      grid.appendChild(c);
    }
    bench.appendChild(grid);
    bench.appendChild(el('div', 'carrow', '➜'));
    const res = el('div', 'cresult' + (rec ? ' ready' : ''));
    if (rec) { res.appendChild(img(invURL(rec.out, 96))); if (rec.n > 1) res.appendChild(el('span', 'count', '×' + rec.n)); }
    else if (sel) { const g = img(invURL(sel.out, 96), 'ghost'); res.appendChild(g); }
    const side = el('div', 'cside');
    side.appendChild(res);
    side.appendChild(el('small', 'cname', rec ? rec.name : sel ? sel.name : ''));
    const cb = buyButton('CRAFT', null, !!rec, () => { game.craft(); }, '', 'Lay out a recipe on the table first!');
    cb.classList.add('craft-btn');
    side.appendChild(cb);
    bench.appendChild(side);
    body.appendChild(bench);
    if (sel && !rec) {
      const can = game.canFill(sel);
      const fill = buyButton(can ? 'Fill it for me' : 'Need more…', null, can, () => { game.fillRecipe(sel.id); }, 'alt', 'You need more materials in your Chest for this one.');
      const r = el('div', 'fillrow'); r.appendChild(fill); body.appendChild(r);
    }
    // recipe book
    body.appendChild(el('div', 'section', '📖 Recipes'));
    const rl = el('div', 'rlist');
    for (const r of RECIPES) {
      if (!recipeSeen(r)) continue;
      const chip = el('button', 'rchip' + (r.id === craftSel ? ' on' : '') + (game.canFill(r) ? ' can' : ''));
      chip.appendChild(img(invURL(r.out, 64)));
      chip.appendChild(el('small', '', r.name));
      chip.addEventListener('click', () => { craftSel = craftSel === r.id ? null : r.id; sound.play('pick'); refreshPanel(true); });
      rl.appendChild(chip);
    }
    body.appendChild(rl);
    // the storage chest's materials
    body.appendChild(el('div', 'section', '📦 From your Chest (drag onto the table)'));
    const keys = Object.keys(s.inv).filter((k) => !k.startsWith('g:')).sort();
    if (!keys.length) body.appendChild(el('div', 'note', 'Your chest is empty. Drag blocks like Logs from the board onto the Chest!'));
    const g = el('div', 'grid-items tokens');
    for (const k of keys) {
      g.appendChild(itemToken(k, s.inv[k], {
        onTap: (key) => {
          // tap = put it where the recipe wants it (or in the first empty square)
          let at = -1;
          for (const i in ghosts) if (ghosts[i] === key && !s.grid[i]) { at = Number(i); break; }
          if (at < 0) at = s.grid.findIndex((x) => !x);
          if (at >= 0) game.gridPut(at, key);
        },
        onDrop: (key, target) => { if (target.classList.contains('ccell')) game.gridPut(Number(target.dataset.i), key); },
      }));
    }
    body.appendChild(g);
  },
};

// --- Hero (gear slots) -------------------------------------------------------
PANELS.hero = {
  title: () => 'Hero', icon: () => heroIcon(),
  key() { const s = game.s; return JSON.stringify([s.equip, s.skin, s.skins, s.gems >= 10, Object.keys(s.inv).filter((k) => k.startsWith('g:')).map((k) => k + s.inv[k])]); },
  render(body) {
    const s = game.s;
    const wrap = el('div', 'hero-wrap');
    const col = (slots) => {
      const c = el('div', 'slots');
      for (const slot of slots) {
        const b = el('button', 'slot' + (s.equip[slot] ? ' full' : ''));
        b.dataset.slot = slot;
        if (s.equip[slot]) b.appendChild(img(gearURL(s.equip[slot], 64)));
        else b.appendChild(el('span', 'empty-slot', ''));
        b.appendChild(el('small', '', SLOT_NAME[slot]));
        b.addEventListener('click', () => { if (s.equip[slot]) { game.unequip(slot); refreshPanel(true); } else hint(`Craft a ${SLOT_NAME[slot]} at the Workbench!`); });
        c.appendChild(b);
      }
      return c;
    };
    wrap.appendChild(col(['helmet', 'chest', 'legs', 'boots']));
    const av = el('div', 'avatar');
    av.appendChild(img(heroURL(heroGear(), 192)));
    wrap.appendChild(av);
    wrap.appendChild(col(['sword', 'pick', 'bow', 'orb']));
    body.appendChild(wrap);
    const stats = el('div', 'hero-stats');
    stats.appendChild(el('span', '', `⚔ Attack ${game.attack()}`));
    stats.appendChild(el('span', '', `🛡 Armor ${game.armor()}`));
    stats.appendChild(el('span', '', `⛏ ${game.tapsPerBlock()} taps`));
    body.appendChild(stats);
    if (game.armor()) body.appendChild(el('div', 'note', `🛡 Armor gives you more energy: +${game.armor() * ENERGY.perArmor} ⚡`));
    body.appendChild(el('div', 'section', '🎒 Your gear (tap to put on)'));
    const gear = Object.keys(s.inv).filter((k) => k.startsWith('g:'));
    if (!gear.length) body.appendChild(el('div', 'note', 'Craft swords, pickaxes and armor at the Workbench!'));
    const g = el('div', 'grid-items tokens');
    for (const k of gear) {
      g.appendChild(itemToken(k, s.inv[k] > 1 ? s.inv[k] : undefined, {
        onTap: (key) => game.equip(key.slice(2)),
        onDrop: (key, target) => { const gg = GEAR[key.slice(2)]; if (target.classList.contains('slot') && gg && target.dataset.slot === gg.slot) game.equip(key.slice(2)); else hint('That goes in its own slot!'); },
      }));
    }
    body.appendChild(g);
    body.appendChild(el('div', 'section', '👕 Skins'));
    const sk = el('div', 'grid-items');
    for (const k of SKINS) {
      const it = el('button', 'item' + (s.skin === k.id ? ' sel' : ''));
      it.appendChild(img(heroURL(Object.assign(heroGear(), { skin: k.id, helmet: null, chest: null, legs: null, boots: null, sword: null, pick: null, bow: false, orb: false }), 64)));
      it.appendChild(el('small', '', k.name));
      it.appendChild(el('small', '', s.skins[k.id] ? (s.skin === k.id ? '✓ wearing' : 'wear') : `💚 ${k.gems}`));
      it.addEventListener('click', () => { game.buySkin(k.id); refreshPanel(true); });
      sk.appendChild(it);
    }
    body.appendChild(sk);
  },
};

// --- Furnace -------------------------------------------------------------------
PANELS.furnace = {
  title: () => 'Furnace', icon: () => iconURL('furnace', 96),
  key() { const s = game.s; return JSON.stringify(s.furnace.map((f) => f.t)) + JSON.stringify(s.inv) + s.board.filter((c) => c && c.t === FUEL_TIER).length; },
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
    const coal = game.have('b' + FUEL_TIER) + s.board.filter((c) => c && !c.chest && c.t === FUEL_TIER).length;
    body.appendChild(el('div', 'note', `Drag Iron, Gold or Diamond ore onto the Furnace. Each one burns 1 Coal 🔥 (you have ${coal}).`));
    body.appendChild(el('div', 'section', '🔥 Melting now'));
    if (!s.furnace.length) body.appendChild(el('div', 'note', 'Nothing yet — the furnace is waiting!'));
    s.furnace.forEach((f, k) => {
      const sub = el('div');
      sub.appendChild(el('small', '', `→ ${invName(SMELT[f.t].out)}`));
      const bar = el('div', 'bar'); const fill = el('i'); fill.style.width = Math.round((1 - f.left / f.total) * 100) + '%'; bar.appendChild(fill); sub.appendChild(bar);
      sub.appendChild(el('small', 'left', fmtTime(f.left)));
      const rr = row(tierURL(f.t, 96), TIERS[f.t].name, sub, buyButton('Take out', null, true, () => game.unsmelt(k), 'alt'));
      rr.classList.add('melting');
      body.appendChild(rr);
    });
    body.appendChild(el('div', 'section', '✨ What melts'));
    const g = el('div', 'grid-items');
    for (const t in SMELT) {
      const it = el('div', 'item');
      it.appendChild(img(tierURL(Number(t), 64)));
      it.appendChild(el('div', '', '+ coal ↓'));
      it.appendChild(img(invURL(SMELT[t].out, 64)));
      it.appendChild(el('small', '', `${invName(SMELT[t].out)} (have ${game.have(SMELT[t].out)})`));
      g.appendChild(it);
    }
    body.appendChild(g);
    const ores = Object.keys(SMELT).map(Number).filter((t) => game.have('b' + t));
    if (ores.length) {
      body.appendChild(el('div', 'section', '📦 Melt from your chest'));
      const g2 = el('div', 'grid-items');
      for (const t of ores) {
        const it = el('button', 'item');
        it.appendChild(img(tierURL(t, 64)));
        it.appendChild(el('span', 'count', String(game.have('b' + t))));
        it.appendChild(el('small', '', TIERS[t].name));
        it.addEventListener('click', () => { game.smeltFromInv(t); refreshPanel(true); });
        g2.appendChild(it);
      }
      body.appendChild(g2);
    }
  },
};

// --- Shop: blocks + boosters (coins) ---------------------------------------
PANELS.shop = {
  title: () => 'Shop', icon: () => iconURL('cart', 96),
  key() {
    const s = game.s;
    const can = game.shopTiers().filter((t) => s.gold >= game.shopPrice(t)).length;
    return [panelTab, s.maxTier, game.emptyCells().length > 0, can, s.gold >= game.boosterPrice(), s.boosts.damage > 0, s.boosts.gold > 0, s.boosts.block > 0].join('|');
  },
  render(body) {
    const s = game.s, tab = panelTab || 'boost';
    const tabs = $('panel-tabs');
    for (const [id, name] of [['boost', 'Boosters'], ['blocks', 'Blocks']]) {
      const b = el('button', 'tab' + (id === tab ? ' on' : ''), name);
      b.addEventListener('click', () => { panelTab = id; sound.play('pick'); refreshPanel(true); });
      tabs.appendChild(b);
    }
    body.appendChild(row(GEM(), 'Emerald Store', 'Emeralds, energy, chests & the Super Miner Pass', buyButton('Open', null, true, () => openPanel('store'), 'price')));
    if (tab === 'boost') {
      const price = game.boosterPrice();
      for (const id in BOOSTERS) {
        const b = BOOSTERS[id];
        const sub = el('div');
        sub.appendChild(el('small', '', b.desc));
        if (s.boosts[id] > 0) sub.appendChild(el('small', '', `⏱ ${fmtTime(s.boosts[id])} left`));
        body.appendChild(row(iconURL(id === 'damage' ? 'sword' : id === 'gold' ? 'coin' : 'uparrow', 96), b.name + ` (${Math.round(b.secs / 60)} min)`, sub,
          buyButton(fmt(price), COIN(), s.gold >= price, () => game.buyBooster(id))));
      }
      return;
    }
    if (!game.emptyCells().length) body.appendChild(el('div', 'note', 'Your board is full — merge some blocks first!'));
    // the 8 biggest you can buy, plus Logs (for crafting) and Coal (furnace fuel)
    const all = game.shopTiers(), list = all.slice().reverse().slice(0, 8);
    for (const t of [4, 2]) if (all.includes(t) && !list.includes(t)) list.push(t);
    for (const t of list) {
      const price = game.shopPrice(t);
      const r = row(tierURL(t, 96), TIERS[t].name, TIERS[t].gps ? `Makes ${fmt(TIERS[t].gps)} gold/s` : t === 2 ? 'For crafting planks and sticks' : 'A building block', buyButton(fmt(price), COIN(), s.gold >= price && game.emptyCells().length > 0, () => game.buyBlock(t)));
      r.dataset.tier = t;
      body.appendChild(r);
    }
  },
};

// --- Village (opens after 29 merges) ----------------------------------------
PANELS.village = {
  title: () => 'Village', icon: () => iconURL('house', 96),
  key() { return [game.s.villageOpen, game.s.level, game.s.maxTier, ...BUILDINGS.map((b) => game.villageLv(b.id) + aff(game.canBuild(b)))].join('|'); },
  render(body) {
    const s = game.s;
    if (!s.villageOpen) {
      body.appendChild(el('div', 'section', `Merge ${VILLAGE_MERGES} blocks to open the Village!`));
      const bar = el('div', 'bar big'); const fill = el('i'); fill.style.width = Math.min(100, (s.stats.merges / VILLAGE_MERGES) * 100) + '%'; bar.appendChild(fill);
      body.appendChild(bar);
      body.appendChild(el('div', 'note', `${Math.min(s.stats.merges, VILLAGE_MERGES)} / ${VILLAGE_MERGES} merges`));
      return;
    }
    const scene = el('div', 'village-scene');
    for (const b of BUILDINGS) {
      const lv = game.villageLv(b.id);
      const d = el('div', 'bld' + (lv ? '' : ' empty'));
      const im = img(buildingURL(b.roof, b.wall, 96));
      const sc = lv ? 0.75 + lv * 0.06 : 0.75;
      im.style.width = im.style.height = Math.round(48 * sc) + 'px';
      d.appendChild(im);
      d.appendChild(el('small', '', lv ? 'Lv ' + lv : '?'));
      scene.appendChild(d);
    }
    body.appendChild(scene);
    body.appendChild(el('div', 'note', 'Every merge gives you a brick 🧱. Build houses that help you mine!'));
    for (const b of BUILDINGS) {
      const lv = game.villageLv(b.id);
      const sub = el('div'); sub.appendChild(el('small', '', b.desc)); sub.appendChild(el('div', 'stars', '★'.repeat(Math.min(lv, b.max)) + '☆'.repeat(Math.max(0, b.max - lv))));
      const gate = game.buildingGate(b);
      let btn;
      if (gate === 'max') btn = buyButton('Done!', null, false, () => {}, 'max');
      else if (gate === 'level') btn = buyButton('Lv ' + b.unlock, iconURL('lock', 64), false, () => {}, '', `Opens at level ${b.unlock}`);
      else if (gate === 'deeper') { const need = TIERS[Math.min(MAX_TIER, shaftNeed(lv))].name; sub.appendChild(el('small', '', `Make ${need} first!`)); btn = buyButton(fmt(game.buildingCost(b)), BRICK(), false, () => {}, '', `Make ${need} first!`); }
      else btn = buyButton(fmt(game.buildingCost(b)), BRICK(), game.canBuild(b), () => game.build(b.id), '', 'You need more bricks — merge blocks!');
      body.appendChild(row(buildingURL(b.roof, b.wall, 96), b.name, sub, btn));
    }
  },
};

// --- Quests: Tasks / Achievements / Monster Hunt -----------------------------
PANELS.quests = {
  title: () => 'Quests', icon: () => iconURL('book', 96),
  key() { return panelTab + JSON.stringify(['t', 'a', 'h'].map((t) => game.questList(t).map((x) => [x.have, x.ready, x.done]))); },
  render(body) {
    const tab = panelTab || 't';
    const tabs = $('panel-tabs');
    for (const [id, name] of [['t', 'Tasks'], ['a', 'Achievements'], ['h', 'Monster Hunt']]) {
      const n = game.readyCount(id);
      const b = el('button', 'tab' + (id === tab ? ' on' : ''), name + (n ? ` (${n})` : ''));
      b.addEventListener('click', () => { panelTab = id; sound.play('pick'); refreshPanel(true); });
      tabs.appendChild(b);
    }
    let list = tab === 't' ? game.activeTasks() : game.questList(tab).filter((x) => !x.done).sort((a, b) => (b.ready - a.ready) || (b.have / b.q.n - a.have / a.q.n));
    if (tab !== 't') list = list.slice(0, 12);
    if (!list.length) body.appendChild(el('div', 'note', 'All done here! You are a super miner! ⭐'));
    for (const a of list) {
      const q = a.q;
      const sub = el('div');
      const bar = el('div', 'bar'); const fill = el('i'); fill.style.width = Math.round((a.have / q.n) * 100) + '%'; bar.appendChild(fill);
      const rw = el('small');
      if (q.reward.gold) rw.append(`🪙 ${fmt(q.reward.gold)}  `);
      if (q.reward.bricks) rw.append(`🧱 ${q.reward.bricks}  `);
      if (q.reward.gems) rw.append(`💚 ${q.reward.gems}`);
      sub.appendChild(el('small', '', `${fmt(a.have)} / ${fmt(q.n)}`)); sub.appendChild(bar); sub.appendChild(rw);
      const r = row(questIcon(q), q.text, sub, a.ready ? buyButton('Collect!', iconURL('star', 64), true, () => game.claim(tab, a.i)) : null);
      const sp = el('button', 'speak', '🔊'); sp.addEventListener('click', () => speak(q.text));
      r.appendChild(sp);
      if (a.ready) r.classList.add('ready');
      body.appendChild(r);
    }
    const all = game.questList(tab), done = all.filter((x) => x.done).length;
    body.appendChild(el('div', 'note', `Done: ${done} of ${all.length}`));
  },
};

// --- Block Book (collection) ---------------------------------------------------
PANELS.book = {
  title: () => 'My Blocks', icon: () => iconURL('shelf', 96),
  key() { return Object.keys(game.s.seen).join(','); },
  render(body) {
    const s = game.s;
    body.appendChild(el('div', 'section', `You found ${Object.keys(s.seen).length} of ${MAX_TIER} blocks!`));
    const g = el('div', 'grid-items');
    for (let t = 1; t <= MAX_TIER; t++) {
      const known = !!s.seen[t];
      const it = el('button', 'item' + (known ? '' : ' unknown'));
      if (known) {
        it.appendChild(img(tierURL(t, 64)));
        it.appendChild(el('span', 'count', String(t)));
        it.appendChild(el('small', '', TIERS[t].name));
        it.appendChild(el('small', '', TIERS[t].gps ? '🪙 ' + fmt(TIERS[t].gps) + '/s' : '🛠 crafting'));
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

// --- Storage chest -------------------------------------------------------------
PANELS.chest = {
  title: () => 'My Chest', icon: () => iconURL('chest', 96),
  key() { return JSON.stringify(game.s.inv) + (game.emptyCells().length > 0); },
  render(body) {
    const s = game.s;
    body.appendChild(el('div', 'note', 'Drag a block onto the Chest to keep it for crafting. Tap a block here to put it back on your board.'));
    const keys = Object.keys(s.inv);
    const sec = (title, pred, onTap) => {
      const ks = keys.filter(pred).sort();
      if (!ks.length) return;
      body.appendChild(el('div', 'section', title));
      const g = el('div', 'grid-items');
      for (const k of ks) {
        const it = el('button', 'item');
        it.appendChild(img(invURL(k, 64)));
        it.appendChild(el('span', 'count', String(s.inv[k])));
        it.appendChild(el('small', '', invName(k)));
        if (onTap) it.addEventListener('click', () => { onTap(k); refreshPanel(true); });
        g.appendChild(it);
      }
      body.appendChild(g);
    };
    if (!keys.length) body.appendChild(el('div', 'note', 'Your chest is empty.'));
    sec('🧱 Blocks', (k) => k[0] === 'b', (k) => game.unstore(Number(k.slice(1))));
    sec('🪵 Materials', (k) => k.startsWith('m:'));
    sec('⚔ Gear (tap to put on)', (k) => k.startsWith('g:'), (k) => game.equip(k.slice(2)));
  },
};


// --- Grown-ups corner (behind a press-and-hold gate)
let gateOpen = false;
// Two-digit sums written in words (too hard to guess for a six-year-old).
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty'];
const numWords = (n) => TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
function newSum() {
  const a = 21 + Math.floor(Math.random() * 29), b = 21 + Math.floor(Math.random() * 29);
  return [`${numWords(a)} plus ${numWords(b)}`, a + b];
}
let gateStep = 0, gateSum = newSum(), gateMisses = 0, gateLockUntil = 0;
PANELS.parent = {
  title: () => 'Grown-ups', icon: () => iconURL('gear', 96),
  key() { return gateOpen + ':' + gateStep + JSON.stringify(settings()); },
  onClose() { gateOpen = false; gateStep = 0; },
  render(body) {
    if (!gateOpen && gateStep === 0) {
      const g = el('div', 'gate');
      const wait = Math.ceil((gateLockUntil - performance.now()) / 1000);
      if (wait > 0) {
        g.appendChild(el('div', 'note', `Not quite! Try again in ${wait} seconds.`));
        body.appendChild(g);
        setTimeout(() => { if (panelOpen === 'parent') refreshPanel(true); }, 1000);
        return;
      }
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
        try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      });
      const up = (e) => {
        fingers = Math.max(0, fingers - 1);
        if (e.pointerId !== pid) return;
        const held = performance.now() - t0;
        reset();
        if (held >= 3000) { // open on release, so the lifting finger can't press anything
          gateStep = 1; gateSum = newSum();
          uiOpenedAt = performance.now(); refreshPanel(true);
        } else b.textContent = 'Hold';
      };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', (e) => { if (e.pointerId === pid) { fingers = Math.max(0, fingers - 1); reset(); b.textContent = 'Hold'; } });
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
        if (Number(inp.value.trim()) === gateSum[1]) { gateOpen = true; gateMisses = 0; sound.play('done'); refreshPanel(true); }
        else { // wrong: back to the hold, and a little wait after two misses
          sound.play('deny');
          gateMisses++;
          if (gateMisses >= 2) { gateMisses = 0; gateLockUntil = performance.now() + 30000; }
          gateStep = 0; refreshPanel(true);
        }
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
        try {
          const o = JSON.parse(bak); // keep the grown-ups' settings, history and card total
          o.settings = game.s.settings; o.purchases = game.s.purchases; o.cardSpent = game.s.cardSpent;
          localStorage.setItem(SAVE_KEY, JSON.stringify(o)); localStorage.removeItem(SAVE_KEY + '.bak');
        } catch (e) { /* ignore */ }
        skipSave = true; location.reload();
      });
      body.appendChild(row(null, 'Undo “Start over”', 'Brings back the earlier game', rs));
    }
    const link = el('button', 'buy', 'Open');
    link.addEventListener('click', () => { save(); location.href = '../'; });
    body.appendChild(row(null, 'Ezra’s Blocks', 'The 3D building game', link));
  },
};

// ------------------------------------------------------------------ the guide (tutorial)
// Pip the guide walks a new miner through the whole loop, one small step at a
// time: dig → open the chest → merge → put a Log in the Chest → Workbench
// (planks, sticks, a wooden sword) → put it on → chase off the first monster →
// wear the stone pickaxe. Every step is checked against the real game state, so
// it can't get stuck: if he wanders off, the hand just points at what's next.
const handEl = $('hand');
let handQuiet = 0;
function showHandAt(target, mode = 'tap', to) {
  const c = target.x !== undefined ? target : elCenter(target);
  handEl.style.left = c.x - 20 + 'px';
  handEl.style.top = c.y - 6 + 'px';
  if (mode === 'drag' && to) {
    const t = to.x !== undefined ? to : elCenter(to);
    handEl.style.setProperty('--dx', t.x - c.x + 'px');
    handEl.style.setProperty('--dy', t.y - c.y + 'px');
  }
  if (handEl.className !== mode) handEl.className = mode;
}
// Called when he does something: the hand steps aside for a moment.
function hideHand(quiet = true) { handEl.className = ''; if (quiet) handQuiet = performance.now() + 1100; }

const tut = { t: 0, said: '', confirm: false, ok: null };
const q = (sel) => document.querySelector(sel);

function pairOnBoard() {
  const s = game.s, by = {};
  for (let i = 0; i < N_CELLS; i++) {
    const c = s.board[i];
    if (!c || c.chest || c.t >= MAX_TIER || !game.isOpen(i)) continue;
    (by[c.t] = by[c.t] || []).push(i);
  }
  const ts = Object.keys(by).map(Number).filter((t) => by[t].length >= 2).sort((a, b) => a - b);
  return ts.length ? by[ts[0]].slice(0, 2) : null;
}
function chestCell() { return game.s.board.findIndex((c, i) => c && c.chest && game.isOpen(i)); }
function closeFirst(text = 'Tap ✖ to close this.') { return { text, at: $('panel-close') }; }
function chestOrMine(chestText = 'Open the chest!', mineText = 'Dig another block!') {
  if (panelOpen) return closeFirst();
  const ci = chestCell();
  if (ci >= 0) return { text: chestText, at: cellEls[ci] };
  if (!game.emptyCells().length) return makeRoom();
  return { text: mineText, at: $('mine') };
}
// A full board: new blocks would skip the board, so make a free square first.
function makeRoom() {
  const p = pairOnBoard();
  if (p) return { text: 'Your board is full! Merge two the same to make room.', at: cellEls[p[0]], to: cellEls[p[1]] };
  const i = game.s.board.findIndex((c, k) => c && !c.chest && game.isOpen(k));
  return { text: 'Your board is full! Drag a block onto your Chest.', at: cellEls[i], to: stationEls.chest };
}
// Everything a Wooden Sword needs starts with a Log in the Chest.
function getLog() {
  if (panelOpen === 'shop' && game.dropTier() > 2) {
    if (panelTab !== 'blocks') { panelTab = 'blocks'; refreshPanel(true); }
    const b = q('#panel-body .row[data-tier="2"] .buy');
    if (b) return { text: 'Tap to buy a Log!', at: b };
  }
  if (panelOpen) return closeFirst();
  const s = game.s;
  const li = s.board.findIndex((c, i) => c && !c.chest && c.t === 2 && game.isOpen(i));
  if (li >= 0) return { text: 'Logs make tools! Drag the Log onto your Chest.', at: cellEls[li], to: stationEls.chest };
  const dirt = [];
  s.board.forEach((c, i) => { if (c && !c.chest && c.t === 1 && game.isOpen(i)) dirt.push(i); });
  if (dirt.length >= 2) return { text: 'Merge two Dirt to make a Log!', at: cellEls[dirt[0]], to: cellEls[dirt[1]] };
  // A deep mine doesn't drop Dirt any more: Logs come from the Shop.
  if (game.dropTier() > 2 && !dirt.length && stationOpen('shop')) return { text: 'Buy a Log in the Shop!', at: stationEls.shop };
  return chestOrMine('Open the chest!', 'Dig more Dirt to make a Log!');
}
// What can he make right now on the way to `id`? (null = he needs a Log first)
function count(k) { return game.have(k) + game.s.grid.filter((x) => x === k).length; }
function tutWant(id) {
  const P = count('m:planks'), S = count('m:stick'), L = count('b2');
  if (id === 'wood_sword') {
    if (P >= 2 && S >= 1) return 'wood_sword';
    if (S < 1 && P >= 4) return 'stick';
    if (L >= 1) return 'planks';
    if (S < 1 && P >= 2) return 'stick';
    return null;
  }
  if (id === 'stick') return P >= 2 ? 'stick' : L >= 1 ? 'planks' : null;
  return L >= 1 ? 'planks' : null;
}
const RECIPE_TIP = {
  planks: 'Tap the Log to put it on the table!',
  stick: 'Sticks: tap the Planks twice — one on top of the other!',
  wood_sword: 'A sword: two Planks, and a Stick at the bottom!',
};
function recipeGo(id) {
  const s = game.s, want = tutWant(id);
  if (panelOpen !== 'craft') {
    if (!want) return getLog();
    if (panelOpen) return closeFirst();
    return { text: id === 'planks' ? 'Now open the Workbench!' : 'Back to the Workbench!', at: stationEls.craft };
  }
  if (!want) return closeFirst('You need a Log! Tap ✖ and get one.');
  if (craftSel !== want) { craftSel = want; refreshPanel(true); }
  const rec = RECIPES.find((r) => r.id === want);
  const cur = game.gridRecipe();
  const lead = want !== id ? 'First make ' + rec.name + '. ' : '';
  if (cur && cur.id === want) return { text: 'Now tap CRAFT!', at: q('#panel-body .craft-btn') };
  const ghosts = ghostMap(rec);
  for (let i = 0; i < 9; i++) {
    if (s.grid[i] && s.grid[i] !== ghosts[i]) return { text: 'Oops — tap that one to take it off.', at: q(`#panel-body .ccell[data-i="${i}"]`) };
  }
  for (const i in ghosts) {
    if (!s.grid[i]) return { text: lead + RECIPE_TIP[want], at: q(`#panel-body .token[data-key="${ghosts[i]}"]`) };
  }
  return null;
}
function gearGo(slot, openText, tapText) {
  const key = Object.keys(game.s.inv).find((k) => k.startsWith('g:') && GEAR[k.slice(2)] && GEAR[k.slice(2)].slot === slot);
  if (!key) return null; // nothing to put on: skip this step
  if (panelOpen !== 'hero') {
    if (panelOpen) return closeFirst();
    return { text: openText, at: stationEls.hero };
  }
  return { text: tapText, at: q(`#panel-body .token[data-key="${key}"]`) };
}

const TUT_STEPS = [
  { id: 'hello', ok: 'Let’s go!', skip: (s) => !!s.migrated, text: 'Hi Ezra! I’m Pip. Let’s go mining!' },
  { id: 'upgrade', ok: 'Show me!', skip: (s) => !s.migrated, text: 'Welcome back, Ezra! Your mine got an upgrade: chests, a workbench and monsters! Let me show you.' },
  { id: 'dig', done: (s) => s.stats.mined >= 1, go: () => (panelOpen ? closeFirst() : { text: 'Tap the big block until it breaks!', at: $('mine') }) },
  { id: 'chest', done: (s) => s.stats.opened >= 1, go: () => chestOrMine('A chest! Tap it to open it!', 'Dig another block!') },
  { id: 'twin', done: (s) => s.stats.merges >= 1 || !!pairOnBoard(), go: () => chestOrMine('Open the chest!', 'Dig another block!') },
  {
    id: 'merge', done: (s) => s.stats.merges >= 1,
    go: () => {
      if (panelOpen) return closeFirst();
      const p = pairOnBoard();
      return p ? { text: 'Two the same! Drag one onto the other!', at: cellEls[p[0]], to: cellEls[p[1]] } : chestOrMine();
    },
  },
  { id: 'log', done: (s) => count('b2') > 0 || (s.stats.craftBy.planks || 0) > 0, go: getLog },
  { id: 'planks', done: (s) => (s.stats.craftBy.planks || 0) > 0, go: () => recipeGo('planks') },
  { id: 'stick', done: (s) => (s.stats.craftBy.stick || 0) > 0, go: () => recipeGo('stick') },
  { id: 'sword', done: (s) => (s.stats.craftBy.wood_sword || 0) > 0 || !!s.equip.sword, go: () => recipeGo('wood_sword') },
  { id: 'wear', done: (s) => !!s.equip.sword, go: () => gearGo('sword', 'Put your sword on! Open your Hero.', 'Tap the sword to hold it!') },
  {
    id: 'fight', done: (s) => s.stats.kills >= 1,
    go: () => {
      const s = game.s;
      if (panelOpen) return closeFirst('Tap ✖ — something is in your mine!');
      if (!s.monster) {
        if (s.stats.kills > 0) return null;
        game.spawnMonster('grumble');
      }
      return { text: `Oh no, ${MONSTERS[s.monster.id].name}! Tap it with your sword to chase it off!`, at: $('mine') };
    },
  },
  { id: 'pick', done: (s) => !!s.equip.pick, go: () => gearGo('pick', 'It dropped a Stone Pickaxe! Open your Hero.', 'Tap the pickaxe! It digs faster.') },
  { id: 'bye', ok: 'OK!', text: 'Awesome, Ezra! Merge blocks to find new ones — they make gold! Check your Quests for prizes.' },
];

function tutIndex() { const k = TUT_STEPS.findIndex((x) => x.id === game.s.tut); return k < 0 ? 0 : k; }
function hideGuide() {
  const g = $('guide');
  if (!g.classList.contains('hidden')) g.classList.add('hidden');
  if (handEl.className) hideHand(false);
}
function finishTutorial() {
  game.s.tut = 'done';
  tut.confirm = false;
  hideGuide();
  save();
}
function tutNext() {
  const k = tutIndex() + 1;
  game.s.tut = k < TUT_STEPS.length ? TUT_STEPS[k].id : 'done';
  if (game.s.tut === 'done') finishTutorial();
  tutUpdate(true);
}
function tutorialActive() { return !!game.s.tut && game.s.tut !== 'done'; }
// Something happened in the game: re-check the step right away.
function tutorialPoke() { if (tutorialActive()) setTimeout(() => tutUpdate(true), 30); }

function tutUpdate(force) {
  const s = game.s;
  if (!tutorialActive()) { hideGuide(); return; }
  const now = performance.now();
  if (!force && now - tut.t < 150) return;
  tut.t = now;
  // Move past every step that's already done (or doesn't apply).
  let k = tutIndex();
  while (k < TUT_STEPS.length) {
    const st = TUT_STEPS[k];
    if ((st.skip && st.skip(s)) || (st.done && st.done(s))) { k++; continue; }
    break;
  }
  if (k >= TUT_STEPS.length) { finishTutorial(); return; }
  if (TUT_STEPS[k].id !== s.tut) { s.tut = TUT_STEPS[k].id; save(); }
  if (celOpen || coOpen()) { hideGuide(); return; }
  const st = TUT_STEPS[k];
  let r;
  if (tut.confirm) r = { text: 'Skip Pip’s lessons?', ok: 'Yes, skip', no: 'No, keep going' };
  else if (st.ok) r = { text: st.text, ok: st.ok };
  else if (s.monster && st.id !== 'fight' && !panelOpen) r = { text: `A monster! Tap ${MONSTERS[s.monster.id].name} to chase it away!`, at: $('mine') };
  else r = st.go();
  if (!r) { // nothing to do here after all: on to the next step
    s.tut = TUT_STEPS[k + 1] ? TUT_STEPS[k + 1].id : 'done';
    if (s.tut === 'done') finishTutorial();
    return;
  }
  // Draw it.
  const g = $('guide');
  g.classList.remove('hidden');
  const txt = $('guide-text');
  if (txt.textContent !== r.text) txt.textContent = r.text;
  const ok = $('guide-ok');
  ok.style.display = r.ok ? '' : 'none';
  if (r.ok && ok.textContent !== r.ok) ok.textContent = r.ok;
  const skip = $('guide-skip'), sk = r.no || 'Skip';
  if (skip.textContent !== sk) skip.textContent = sk;
  skip.style.display = st.id === 'bye' && !tut.confirm ? 'none' : '';
  tut.ok = r.ok ? (tut.confirm ? finishTutorial : tutNext) : null;
  if (r.text !== tut.said) { tut.said = r.text; speak(r.text); }
  // Keep the bubble away from what he needs to tap.
  let low = true;
  if (r.at) {
    const rc = r.at.getBoundingClientRect();
    // inside a scrolling panel: bring the target into view
    const pb = $('panel-body');
    if (panelOpen && pb.contains(r.at)) {
      const pr = pb.getBoundingClientRect();
      if (rc.top < pr.top || rc.bottom > pr.bottom) r.at.scrollIntoView({ block: 'center' });
    }
    const c = elCenter(r.at), H = window.innerHeight;
    low = c.y < H * 0.5;
    if (r.to) { const t2 = elCenter(r.to); if (t2.y > H * 0.5) low = false; }
    if (now > handQuiet && !drag && !pDrag) showHandAt(r.at, r.to ? 'drag' : 'tap', r.to);
    else if (handEl.className && (drag || pDrag)) hideHand(false);
  } else if (handEl.className) hideHand(false);
  g.classList.toggle('low', low);
  g.classList.toggle('talk', !!r.ok);
  // Up top: sit just under the money bar (not over it) unless a panel is open.
  const top = !low && !r.ok && !panelOpen ? Math.round($('board-wrap').getBoundingClientRect().top) + 'px' : '';
  if (g.style.top !== top) g.style.top = top;
}

function initTutorial() {
  const s = game.s;
  if (s.tut === undefined) s.tut = s.migrated ? 'upgrade' : s.stats.mined === 0 ? 'hello' : 'done';
  $('guide-img').src = guideURL(128);
  $('guide-ok').addEventListener('click', () => { sound.resume(); sound.play('pick'); const f = tut.ok; if (f) f(); });
  $('guide-skip').addEventListener('click', () => {
    sound.resume();
    tut.confirm = !tut.confirm;
    tut.said = '';
    tutUpdate(true);
  });
  tutUpdate(true);
}

// After the lessons: if he's been still for a while, wiggle a chest or a pair.
function idleHints(now) {
  const s = game.s;
  if (tutorialActive() || celOpen || panelOpen || drag || coOpen()) return;
  if (now - lastAction < 8000) return;
  lastAction = now - 3000; // look again in ~5 s
  const ci = chestCell();
  const cells = ci >= 0 ? [ci] : pairOnBoard();
  if (!cells) return;
  for (const i of cells) cellEls[i].classList.add('hinted');
  setTimeout(() => { for (const i of cells) cellEls[i].classList.remove('hinted'); }, 2400);
}

// ------------------------------------------------------------------ gold "pops" from blocks
let popT = 0;
function goldPops(dt) {
  popT += dt;
  if (popT < 1.6) return;
  popT = 0;
  const filled = [];
  game.s.board.forEach((c, i) => { if (c && c.t && !c.chest && TIERS[c.t].gps > 0) filled.push(i); });
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
    title: 'Great mining today!', img: guideURL(160), name: 'Pip is getting sleepy…',
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
  tutUpdate(false);
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
  initPanelDrag();
  layout();
  renderBoard();
  applyCave(false);
  updateHud(1);

  // A second tap on ✕ must not press the button that was under it.
  document.addEventListener('click', (e) => {
    if (performance.now() - uiClosedAt < 350 && !e.target.closest('#panel, #celebrate, #checkout')) { e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
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
  $('btn-rush').addEventListener('click', () => { sound.resume(); openPanel('shop', 'boost'); });
  initCheckout();
  for (const id of ['pill-gems', 'pill-bricks']) $(id).addEventListener('click', () => { sound.resume(); openPanel('store', 'gems'); });
  $('energy').addEventListener('click', () => { sound.resume(); openPanel('store', 'energy'); });
  $('btn-pass').addEventListener('click', () => { sound.resume(); openPanel('store', 'pass'); });
  for (const [id, msg] of [['pill-gold', 'Gold comes from the blocks on your board!']]) {
    $(id).addEventListener('click', () => { hint(msg); speak(msg); });
  }
  initGoal();
  initTutorial();
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
    tut: () => game.s.tut, skipTut: finishTutorial, tutText: () => $('guide').classList.contains('hidden') ? '' : $('guide-text').textContent,
    tutNext: () => { if (tut.ok) tut.ok(); },
    hand: () => handEl.className,
    craftSel: (id) => { if (id !== undefined) { craftSel = id; refreshPanel(true); } return craftSel; },
  };
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
}

try { init(); } catch (e) { showError(e && e.stack || e); }
