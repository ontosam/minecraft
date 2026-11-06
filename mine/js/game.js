// The game rules for Ezra's Mine (v2), with no screen code at all (so it can
// be tested and balance-simulated in Node). The UI calls these methods and
// listens to events (game.on = (type, data) => ...) to animate things.
//
// The loop: tap the big block -> it breaks into a CHEST on the board -> tap
// the chest to open it into a block -> drag twins together to merge ->
// put materials in the chest -> craft gear on the 3x3 workbench -> equip it
// on the hero -> chase off monsters that wander into the mine.

import {
  TIERS, MAX_TIER, COLS, ROWS, openCells, xpNeeded, MERGE_XP, levelReward,
  MATERIALS, GEAR, SLOTS, SWORD_ATK, PICK_TAPS, PICK_DROP, armorPoints, BOW_ATK, ORB_GOLD,
  RECIPES, SMELT, FUEL_TIER, MONSTERS, monsterHp, monsterCoins, MONSTER_EVERY,
  BOOSTERS, boosterPrice, VILLAGE_MERGES, DROP_GAP, shaftNeed, BUILDINGS, wellEvery,
  treasureEvery, TASKS, ACHIEVEMENTS, HUNT, OFFLINE_RATE, offlineCapSecs, caveFor,
  SKINS, ENERGY, CARD_PREFIX, CARD_DIGITS, storeItem, blockValue,
} from './data.js';

export const SAVE_KEY = 'ezramine.save.v1';
export const N_CELLS = COLS * ROWS;
export const VERSION = 2;

// A pretend game card is valid when it is exactly 16 digits starting 0000.
// (No real card number starts with 0000, so a real one is always declined.)
export function validateCard(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  return d.length === CARD_DIGITS && d.startsWith(CARD_PREFIX);
}

// Cells open from the bottom-middle outwards so the board grows tidily.
export const UNLOCK_ORDER = (() => {
  const cx = (COLS - 1) / 2, cy = ROWS - 1.6;
  const idx = [...Array(N_CELLS).keys()];
  return idx.sort((a, b) => {
    const da = Math.hypot((a % COLS - cx) * 1.15, Math.floor(a / COLS) - cy);
    const db = Math.hypot((b % COLS - cx) * 1.15, Math.floor(b / COLS) - cy);
    return da - db || a - b;
  });
})();

export function freshState() {
  return {
    v: VERSION,
    gold: 0, bricks: 0, gems: 0,
    level: 1, xp: 0,
    board: Array(N_CELLS).fill(null),   // null | { t } | { chest: 'wood', t } | { chest: 'gold' }
    mineHp: PICK_TAPS.none,
    monster: null,                      // { id, hp, max } while a monster is in the mine
    monsterIn: 14,                      // blocks to break before the next monster
    inv: {},                            // the storage chest: 'b<t>' | 'm:<id>' | 'g:<id>' -> count
    equip: { helmet: null, chest: null, legs: null, boots: null, sword: null, pick: null, bow: null, orb: null },
    grid: Array(9).fill(null),          // the workbench
    furnace: [],                        // queue of { t, left, total }
    maxTier: 1,
    seen: { 1: 1 },
    stats: { taps: 0, merges: 0, mined: 0, opened: 0, kills: 0, smelts: 0, builds: 0, crafts: 0, armorCrafted: 0,
      killBy: {}, craftBy: {}, equipBy: {} },
    claimed: { t: {}, a: {}, h: {} },
    boosts: { damage: 0, gold: 0, block: 0 },
    treasureT: 0,
    wellN: 0,
    village: {},
    villageOpen: 0,
    skin: 'classic', skins: { classic: 1 },
    won: 0,
    energy: ENERGY.max, energyT: 0,
    iap: {}, purchases: [], cardSpent: 0,
    lastSeen: 0,
    sound: true,
  };
}

// ---- turning a v1 save (the first version of the mine) into v2 -----------------
const V1_TIER = { 1: 1, 2: 2, 3: 3, 4: 3, 5: 3, 6: 4, 7: 5, 8: 6, 9: 7, 10: 8, 11: 9, 12: 10, 13: 11, 14: 12, 15: 13, 16: 14, 17: 15, 18: 16, 19: 17, 20: 18 };
export function migrateV1(old) {
  const s = freshState();
  for (const k of ['gold', 'bricks', 'gems', 'level', 'iap', 'purchases', 'cardSpent', 'settings', 'lastSeen', 'won', 'seenSt']) if (old[k] !== undefined) s[k] = old[k];
  s.gold = Number(s.gold) || 0; s.level = Math.max(1, Number(s.level) || 1);
  const blocks = [];
  let oldChests = 0;
  for (const c of old.board || []) {
    if (!c) continue;
    if (c.t) blocks.push(V1_TIER[c.t] || 1);
    else if (c.boom) s.gems += 1;          // a Boom Block on the board → an emerald
    else if (c.chest) oldChests++;          // a treasure chest → a golden chest
  }
  const add = (k, n) => { s.inv[k] = (s.inv[k] || 0) + n; };
  // blocks that were melting in the old furnace go back into the chest
  for (const f of old.furnace || []) { const m = f && /^b(\d+)$/.exec(f.k || ''); if (m) add('b' + (V1_TIER[Number(m[1])] || 1), 1); }
  for (const k in old.store || {}) {
    const n = old.store[k] || 0;
    if (/^b\d+$/.test(k)) add('b' + (V1_TIER[Number(k.slice(1))] || 1), n);
    else if (k === 'i:iron') add('m:iron', n);
    else if (k === 'i:gold') add('m:gold', n);
    else if (k === 'i:ruby' || k === 'i:copper') s.gems += n;
  }
  s.gems += old.booms || 0;
  // Keep the biggest blocks on the board, but always leave 2 squares free so
  // new chests have somewhere to land; the rest wait in the storage chest.
  const open = UNLOCK_ORDER.slice(0, openCells(s.level));
  const room = Math.max(0, open.length - 2 - Math.min(oldChests, 1));
  blocks.sort((a, b) => b - a).forEach((t, k) => { if (k < room) s.board[open[k]] = { t }; else add('b' + t, 1); });
  if (oldChests) s.board[open[room]] = { chest: 'gold' };
  s.gold += Math.max(0, oldChests - 1) * 1500 * s.level;
  for (const t in old.seen || {}) s.seen[V1_TIER[t] || 1] = 1;
  s.maxTier = V1_TIER[old.maxTier] || 1;
  for (let t = 1; t <= s.maxTier; t++) s.seen[t] = 1;
  const pick = old.pick || 0; // old pickaxe level -> a real pickaxe, already worn
  const pm = pick >= 5 ? 'diamond' : pick >= 4 ? 'gold' : pick >= 3 ? 'iron' : pick >= 1 ? 'stone' : null;
  // ...and a sword to match, so the monsters at his level aren't a slog
  if (pm) { s.equip.pick = pm + '_pick'; s.equip.sword = pm + '_sword'; s.stats.equipBy = { pick: 1, sword: 1 }; }
  // Two Logs to try the new Workbench with (his mine is too deep to drop Dirt now).
  add('b2', 2);
  s.stats.merges = (old.stats && old.stats.merges) || 0;
  s.stats.mined = (old.stats && old.stats.mined) || 0;
  s.stats.taps = (old.stats && old.stats.taps) || 0;
  s.villageOpen = s.stats.merges >= VILLAGE_MERGES ? 1 : 0;
  for (const id in old.village || {}) {
    const b = BUILDINGS.find((x) => x.id === id), lv = Math.max(0, Math.floor(Number(old.village[id]) || 0));
    if (b) s.village[id] = Math.min(lv, b.max);
    else if (id === 'tower') for (let k = 0; k < lv; k++) s.bricks += Math.round(40 * Math.pow(2.5, k)); // bricks back
  }
  if (old.up && old.up.depth) s.village.shaft = Math.min(old.up.depth, 6);
  s.boosts.gold = Math.max(0, Number(old.boostLeft) || 0); // a Gold Rush still running
  // Old levels came about twice as fast; monsters are sized for the new pace.
  s.monOff = Math.floor((s.level - 1) / 2);
  s.energy = typeof old.energy === 'number' ? old.energy : ENERGY.max;
  s.mineHp = PICK_TAPS[pm || 'none'];
  s.migrated = 1;
  return s;
}

export class Game {
  constructor(state, opts = {}) {
    let st = state && typeof state === 'object' ? state : null;
    if (st && !(st.v >= VERSION)) st = migrateV1(st);
    const f = freshState();
    this.s = Object.assign(f, st || {});
    const s = this.s;
    // Defensive defaults for older or partial saves.
    s.stats = Object.assign(freshState().stats, s.stats || {});
    for (const k of ['killBy', 'craftBy', 'equipBy']) if (!s.stats[k] || typeof s.stats[k] !== 'object') s.stats[k] = {};
    s.equip = Object.assign(freshState().equip, s.equip || {});
    s.boosts = Object.assign(freshState().boosts, s.boosts || {});
    s.claimed = Object.assign({ t: {}, a: {}, h: {} }, s.claimed || {});
    if (!s.inv || typeof s.inv !== 'object') s.inv = {};
    for (const k of Object.keys(s.inv)) if (!/^(b\d+|m:\w+|g:\w+)$/.test(k) || !(s.inv[k] > 0)) delete s.inv[k];
    if (!Array.isArray(s.grid) || s.grid.length !== 9) s.grid = Array(9).fill(null);
    if (!Array.isArray(s.board) || s.board.length !== N_CELLS) {
      const old = Array.isArray(s.board) ? s.board : [];
      s.board = Array(N_CELLS).fill(null).map((_, i) => old[i] || null);
    }
    if (!s.iap || typeof s.iap !== 'object') s.iap = {};
    if (!Array.isArray(s.purchases)) s.purchases = [];
    if (!Array.isArray(s.furnace)) s.furnace = [];
    if (!s.skins || typeof s.skins !== 'object') s.skins = { classic: 1 };
    if (typeof s.energy !== 'number' || !(s.energy >= 0)) s.energy = ENERGY.max;
    if (!(s.cardSpent >= 0)) s.cardSpent = 0;
    s.v = VERSION;
    this.rand = opts.rand || Math.random;
    this.on = opts.on || (() => {});
  }

  emit(type, data) { try { this.on(type, data); } catch (e) { console.error(e); } }

  // ---------------------------------------------------------------- derived
  villageLv(id) { return this.s.village[id] || 0; }
  monsterLevel() { return Math.max(1, this.s.level - (this.s.monOff || 0)); }
  gearMat(slot) { const id = this.s.equip[slot]; return id && GEAR[id] ? GEAR[id].mat : null; }
  tapsPerBlock() { return PICK_TAPS[this.gearMat('pick') || 'none']; }
  attack() {
    let a = SWORD_ATK[this.gearMat('sword') || 'none'];
    if (this.s.equip.bow) a += BOW_ATK;
    a += 2 * this.villageLv('yard');
    return a;
  }
  armor() {
    let n = 0;
    for (const p of ['helmet', 'chest', 'legs', 'boots']) { const m = this.gearMat(p); if (m) n += armorPoints(p, m); }
    return n;
  }
  armorWorn() { return ['helmet', 'chest', 'legs', 'boots'].filter((p) => this.s.equip[p]).length; }
  goldMult() {
    return (1 + 0.1 * this.villageLv('hut')) * (1 + 0.25 * this.villageLv('castle'))
      * (this.s.boosts.gold > 0 ? 2 : 1) * (this.s.iap.pass ? 2 : 1) * (this.s.equip.orb ? ORB_GOLD : 1);
  }
  isOpen(i) { const r = UNLOCK_ORDER.indexOf(i); return r >= 0 && r < openCells(this.s.level); }
  unlockLevel(i) {
    const rank = UNLOCK_ORDER.indexOf(i);
    for (let lv = 1; lv < 200; lv++) if (rank < openCells(lv)) return lv;
    return 999;
  }
  baseGps() {
    let g = 0;
    for (const c of this.s.board) if (c && c.t && !c.chest) g += TIERS[c.t].gps;
    return g;
  }
  gps() { return this.baseGps() * this.goldMult(); }
  emptyCells() {
    const out = [];
    for (let i = 0; i < N_CELLS; i++) if (!this.s.board[i] && this.isOpen(i)) out.push(i);
    return out;
  }
  randomEmpty() { const e = this.emptyCells(); return e.length ? e[Math.floor(this.rand() * e.length)] : -1; }
  // Tier the mine gives: grows with a better pickaxe and the Mine Shaft, but
  // always stays DROP_GAP below your best block so merging is still needed.
  dropTier() {
    const base = 1 + PICK_DROP[this.gearMat('pick') || 'none'] + this.villageLv('shaft');
    return Math.max(1, Math.min(base, this.s.maxTier - DROP_GAP));
  }
  cave() { return caveFor(this.s.maxTier); }
  have(k) { return this.s.inv[k] || 0; }
  addInv(k, n = 1) {
    const s = this.s;
    s.inv[k] = (s.inv[k] || 0) + n;
    if (k[0] !== 'b') { s.everHad = s.everHad || {}; s.everHad[k] = 1; } // recipe book remembers it
  }
  takeInv(k, n = 1) {
    if (this.have(k) < n) return false;
    this.s.inv[k] -= n; if (!this.s.inv[k]) delete this.s.inv[k];
    return true;
  }
  invBlocks() { let n = 0; for (const k in this.s.inv) if (k[0] === 'b') n += this.s.inv[k]; return n; }

  // ------------------------------------------------------------- energy
  energyOn() { return !(this.s.settings && this.s.settings.energy === false) && !this.s.iap.unlimited; }
  energyMax() { return (this.s.iap.pass ? ENERGY.passMax : ENERGY.max) + ENERGY.perArmor * this.armor(); }
  energyRegenSecs() {
    const base = this.s.iap.pass ? ENERGY.passRegenSecs : ENERGY.regenSecs;
    return Math.max(3, Math.round(base * Math.pow(0.8, this.villageLv('bakery')) * 10) / 10); // every Bakery level helps
  }
  secsToNextEnergy() { return Math.max(0, this.energyRegenSecs() - this.s.energyT); }
  refillUseful() { return this.energyOn() && this.s.energy < this.energyMax(); }
  refillEnergy() { this.s.energy = Math.max(this.s.energy, this.energyMax()); this.s.energyT = 0; this.emit('energy', { full: true }); }
  refillWithGems() {
    const s = this.s;
    if (!this.refillUseful()) { this.emit('deny', { reason: 'energyfull' }); return false; }
    if (s.gems < ENERGY.gemRefill) { this.emit('deny', { reason: 'gems' }); return false; }
    s.gems -= ENERGY.gemRefill;
    this.refillEnergy();
    return true;
  }

  // ------------------------------------------------------------- the mine
  // One tap on the big block. If a monster is in the mine, the tap hits it.
  tapMine() {
    const s = this.s;
    if (s.monster) return this.hitMonster();
    if (this.energyOn() && s.energy < 1) { this.emit('noEnergy', {}); return { noEnergy: true }; }
    s.stats.taps++;
    s.mineHp -= 1;
    this.emit('hit', { hp: s.mineHp, max: this.tapsPerBlock() });
    if (s.mineHp > 0) return { hit: true };
    // The block breaks into a chest on the board.
    s.mineHp = this.tapsPerBlock();
    s.stats.mined++;
    if (this.energyOn()) s.energy = Math.max(0, s.energy - 1);
    const t = Math.min(s.maxTier, this.dropTier() + (s.boosts.block > 0 ? 2 : 0));
    const drops = [];
    const cell = this.randomEmpty();
    if (cell >= 0) { s.board[cell] = { chest: 'wood', t }; drops.push({ cell, chest: 'wood', t }); }
    else { this.addInv('b' + t); drops.push({ stored: true, t }); this.discover(t); }
    if (s.treasureT >= treasureEvery() && s.level >= 2) {
      const c2 = this.randomEmpty();
      if (c2 >= 0) { s.treasureT = 0; s.board[c2] = { chest: 'gold' }; drops.push({ cell: c2, chest: 'gold' }); }
    }
    s.monsterIn--;
    this.emit('break', { drops });
    if (s.monsterIn <= 0 && !s.monster) this.spawnMonster();
    return { broke: true, drops };
  }

  // Tap a chest on the board to open it.
  openChest(i) {
    const s = this.s, c = s.board[i];
    if (!c || !c.chest) return null;
    s.stats.opened++;
    if (c.chest === 'wood') {
      s.board[i] = { t: c.t };
      this.emit('open', { i, t: c.t });
      this.discover(c.t);
      return { t: c.t };
    }
    // A golden treasure chest: coins, bricks, maybe emeralds, a material and a block.
    const gold = Math.max(1500 * s.level, Math.round(this.gps() * 60));
    const bricks = 3 + s.level;
    const gems = this.rand() < 0.3 ? 1 : 0;
    s.gold += gold; s.bricks += bricks; s.gems += gems;
    const mats = ['m:planks', 'm:stick', 'm:string', 'm:iron'];
    const mat = mats[Math.floor(this.rand() * Math.min(mats.length, 2 + Math.floor(s.level / 3)))];
    const nMat = mat === 'm:planks' ? 4 : mat === 'm:iron' ? 1 : 2;
    this.addInv(mat, nMat);
    const t = Math.min(s.maxTier, this.dropTier() + 1);
    s.board[i] = { t };
    this.emit('treasure', { i, gold, bricks, gems, mat, nMat, t });
    this.discover(t);
    return { gold, bricks, gems, mat, t };
  }

  // ------------------------------------------------------------- monsters
  spawnMonster(id) {
    const s = this.s;
    if (s.monster) return false;
    if (!id) {
      const open = Object.keys(MONSTERS).filter((k) => MONSTERS[k].unlock <= s.level);
      id = s.stats.kills === 0 ? 'grumble' : open[Math.floor(this.rand() * open.length)];
    }
    const hp = monsterHp(id, this.monsterLevel());
    s.monster = { id, hp, max: hp };
    s.monsterIn = MONSTER_EVERY[0] + Math.floor(this.rand() * (MONSTER_EVERY[1] - MONSTER_EVERY[0] + 1));
    this.emit('monster', { id, hp });
    return true;
  }
  hitMonster() {
    const s = this.s, m = s.monster;
    if (!m) return { none: true };
    const dmg = this.attack() * (s.boosts.damage > 0 ? 2 : 1);
    m.hp = Math.max(0, m.hp - dmg);
    this.emit('hitMonster', { id: m.id, dmg, hp: m.hp, max: m.max });
    if (m.hp > 0) return { hitMonster: true, dmg };
    return this.defeatMonster();
  }
  defeatMonster() {
    const s = this.s, m = s.monster;
    const def = MONSTERS[m.id];
    s.monster = null;
    s.mineHp = this.tapsPerBlock();
    const first = s.stats.kills === 0;
    s.stats.kills++;
    s.stats.killBy[m.id] = (s.stats.killBy[m.id] || 0) + 1;
    const coins = Math.round(monsterCoins(m.id, this.monsterLevel()) * (s.equip.orb ? ORB_GOLD : 1));
    s.gold += coins;
    const loot = [];
    const give = (k, n = 1) => { this.addInv(k, n); loot.push({ k, n }); };
    if (first) give('g:stone_pick');
    if (m.id === 'gloop' && this.rand() < 0.25) { s.gems++; loot.push({ k: 'gems', n: 1 }); }
    if (m.id === 'grumble' && !first && this.rand() < 0.2) give('m:iron');
    if (m.id === 'webby') give('m:string', 2);
    if (m.id === 'rocky') { give('m:iron'); if (this.rand() < 0.5) give('m:gold'); }
    if (m.id === 'magma') { give('m:gold', 2); if (this.rand() < 0.3) give('m:diamond'); s.gems += 2; loot.push({ k: 'gems', n: 2 }); }
    this.emit('kill', { id: m.id, coins, loot, first });
    this.addXP(def.xp);
    return { killed: true, coins, loot };
  }

  // ------------------------------------------------------------ the board
  // Drag cell a onto cell b: merge (same block), move (empty), or swap.
  drop(a, b) {
    const s = this.s, A = s.board[a], B = s.board[b];
    if (a === b || !A || A.chest || !this.isOpen(b)) return { none: true };
    if (!B) { s.board[b] = A; s.board[a] = null; this.emit('move', { a, b }); return { moved: true }; }
    if (B.chest) return { none: true };
    if (A.t === B.t) return this.merge(a, b);
    s.board[a] = B; s.board[b] = A;
    this.emit('swap', { a, b });
    return { swapped: true };
  }
  canMerge(a, b) {
    const A = this.s.board[a], B = this.s.board[b];
    return !!(A && B && !A.chest && !B.chest && A.t && A.t === B.t && A.t < MAX_TIER && a !== b);
  }
  merge(a, b) {
    const s = this.s;
    if (!this.canMerge(a, b)) { this.emit('deny', { reason: 'max' }); return { none: true }; }
    const t = s.board[b].t + 1;
    s.board[a] = null;
    s.board[b] = { t };
    s.stats.merges++;
    s.bricks += 1;
    let gem = 0;
    const every = wellEvery(this.villageLv('well'));
    if (every) { s.wellN++; if (s.wellN >= every) { s.wellN = 0; gem = 1; s.gems += 1; } }
    const opened = !s.villageOpen && s.stats.merges >= VILLAGE_MERGES;
    if (opened) s.villageOpen = 1;
    this.emit('merge', { a, b, t, xp: MERGE_XP, gem });
    this.discover(t);
    this.addXP(MERGE_XP);
    if (opened) this.emit('villageOpen', {});
    return { merged: true, t };
  }
  discover(t) {
    const s = this.s;
    if (s.seen[t]) return;
    s.seen[t] = 1;
    const oldCave = caveFor(s.maxTier);
    if (t > s.maxTier) s.maxTier = t;
    if (t >= 3) s.gems += 1;
    this.emit('discover', { t, gem: t >= 3 ? 1 : 0 });
    if (t === MAX_TIER && !s.won) { s.won = 1; this.emit('win', {}); }
    const nc = caveFor(s.maxTier);
    if (nc !== oldCave) this.emit('cave', { cave: nc });
  }
  addXP(n) {
    const s = this.s;
    s.xp += n;
    while (s.xp >= xpNeeded(s.level)) {
      s.xp -= xpNeeded(s.level);
      const before = openCells(s.level);
      s.level++;
      const reward = levelReward(s.level);
      s.gold += reward; s.gems += 1;
      this.emit('levelup', { level: s.level, newCells: openCells(s.level) - before, reward, gems: 1 });
    }
  }

  // ------------------------------------------------- the storage chest
  storeBlock(i) {
    const s = this.s, c = s.board[i];
    if (!c || !c.t || c.chest) return false;
    this.addInv('b' + c.t);
    s.board[i] = null;
    this.emit('store', { i, t: c.t });
    return true;
  }
  // Put a stored block back on the board.
  unstore(t) {
    const s = this.s, k = 'b' + t;
    if (!this.have(k)) return -1;
    const cell = this.randomEmpty();
    if (cell < 0) { this.emit('deny', { reason: 'full' }); return -1; }
    this.takeInv(k);
    s.board[cell] = { t };
    this.emit('unstore', { cell, t });
    return cell;
  }

  // ------------------------------------------------------- the workbench
  // Place one item from the storage chest onto grid square i.
  gridPut(i, key) {
    const s = this.s;
    if (i < 0 || i > 8 || !key || !this.have(key)) return false;
    if (key.startsWith('g:')) { this.emit('deny', { reason: 'notmaterial' }); return false; }
    if (s.grid[i]) this.addInv(s.grid[i]);
    this.takeInv(key);
    s.grid[i] = key;
    this.emit('grid', { i, key });
    return true;
  }
  gridTake(i) {
    const s = this.s;
    if (!s.grid[i]) return false;
    this.addInv(s.grid[i]);
    s.grid[i] = null;
    this.emit('grid', { i, key: null });
    return true;
  }
  gridClear() { for (let i = 0; i < 9; i++) if (this.s.grid[i]) { this.addInv(this.s.grid[i]); this.s.grid[i] = null; } }
  // Which recipe (if any) is laid out on the grid right now?
  gridRecipe() {
    const g = this.s.grid;
    let r0 = 3, r1 = -1, c0 = 3, c1 = -1;
    for (let i = 0; i < 9; i++) if (g[i]) { const r = Math.floor(i / 3), c = i % 3; r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); }
    if (r1 < 0) return null;
    for (const rec of RECIPES) {
      const pat = rec.pattern, w = Math.max(...pat.map((row) => row.length)), h = pat.length;
      // try every placement of the pattern inside the 3x3
      for (let dr = 0; dr + h <= 3; dr++) for (let dc = 0; dc + w <= 3; dc++) {
        let ok = true;
        for (let r = 0; r < 3 && ok; r++) for (let c = 0; c < 3 && ok; c++) {
          const pr = r - dr, pc = c - dc;
          const ch = pr >= 0 && pr < h && pc >= 0 && pc < w ? (pat[pr][pc] || ' ') : ' ';
          const want = ch === ' ' ? null : rec.key[ch];
          if ((g[r * 3 + c] || null) !== want) ok = false;
        }
        if (ok) return rec;
      }
    }
    return null;
  }
  craft() {
    const s = this.s, rec = this.gridRecipe();
    if (!rec) { this.emit('deny', { reason: 'norecipe' }); return null; }
    s.grid = Array(9).fill(null);
    this.addInv(rec.out, rec.n);
    s.stats.crafts++;
    s.stats.craftBy[rec.id] = (s.stats.craftBy[rec.id] || 0) + 1;
    if (/_(helmet|chest|legs|boots)$/.test(rec.id)) s.stats.armorCrafted++;
    this.emit('craft', { recipe: rec });
    return rec;
  }
  // Helper: lay out a recipe's pattern from the chest (returns false if short).
  canFill(rec) {
    const need = {};
    for (const row of rec.pattern) for (const ch of row) if (ch !== ' ') need[rec.key[ch]] = (need[rec.key[ch]] || 0) + 1;
    const have = Object.assign({}, this.s.inv);
    for (const k of this.s.grid) if (k) have[k] = (have[k] || 0) + 1;
    for (const k in need) if ((have[k] || 0) < need[k]) return false;
    return true;
  }
  fillRecipe(id) {
    const rec = RECIPES.find((r) => r.id === id);
    if (!rec || !this.canFill(rec)) { this.emit('deny', { reason: 'cost' }); return false; }
    this.gridClear();
    const w = Math.max(...rec.pattern.map((r) => r.length));
    const dc = w === 1 ? 1 : 0, dr = rec.pattern.length === 1 ? 1 : 0;
    rec.pattern.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== ' ') this.gridPut((r + dr) * 3 + c + dc, rec.key[ch]); }));
    return true;
  }

  // ----------------------------------------------------------- the hero
  equip(gearId) {
    const s = this.s, g = GEAR[gearId];
    if (!g || !this.takeInv('g:' + gearId)) return false;
    const prev = s.equip[g.slot];
    if (prev) this.addInv('g:' + prev);
    s.equip[g.slot] = gearId;
    s.stats.equipBy[g.slot] = (s.stats.equipBy[g.slot] || 0) + 1;
    if (g.slot === 'pick') s.mineHp = Math.min(s.mineHp, this.tapsPerBlock());
    this.emit('equip', { slot: g.slot, id: gearId });
    return true;
  }
  unequip(slot) {
    const s = this.s, id = s.equip[slot];
    if (!id) return false;
    s.equip[slot] = null;
    this.addInv('g:' + id);
    if (slot === 'pick') s.mineHp = Math.min(s.mineHp, this.tapsPerBlock()) || this.tapsPerBlock();
    this.emit('equip', { slot, id: null });
    return true;
  }
  buySkin(id) {
    const s = this.s, sk = SKINS.find((x) => x.id === id);
    if (!sk) return false;
    if (!s.skins[id]) {
      if (s.gems < sk.gems) { this.emit('deny', { reason: 'gems' }); return false; }
      s.gems -= sk.gems; s.skins[id] = 1;
    }
    s.skin = id;
    this.emit('skin', { id });
    return true;
  }

  // ------------------------------------------------------------ the furnace
  furnaceSlots() { return 3; }
  smeltSecs(t) { return Math.max(1, SMELT[t].secs * Math.pow(0.82, this.villageLv('forge'))); }
  // Coal for fuel comes from the chest first, then from the board.
  takeFuel() {
    if (this.takeInv('b' + FUEL_TIER)) return true;
    const i = this.s.board.findIndex((c) => c && !c.chest && c.t === FUEL_TIER);
    if (i >= 0) { this.s.board[i] = null; this.emit('fuelFromBoard', { i }); return true; }
    return false;
  }
  smeltFromBoard(i) {
    const s = this.s, c = s.board[i];
    if (!c || !c.t || c.chest) return false;
    if (!SMELT[c.t]) { this.emit('deny', { reason: 'notore', i }); return false; }
    if (s.furnace.length >= this.furnaceSlots()) { this.emit('deny', { reason: 'furnace' }); return false; }
    s.board[i] = null;
    if (!this.takeFuel()) { s.board[i] = c; this.emit('deny', { reason: 'nofuel', i }); return false; }
    const secs = this.smeltSecs(c.t);
    s.furnace.push({ t: c.t, left: secs, total: secs });
    this.emit('smeltStart', { i, t: c.t });
    return true;
  }
  smeltFromInv(t) {
    const s = this.s;
    if (!SMELT[t] || !this.have('b' + t)) return false;
    if (s.furnace.length >= this.furnaceSlots()) { this.emit('deny', { reason: 'furnace' }); return false; }
    this.takeInv('b' + t);
    if (!this.takeFuel()) { this.addInv('b' + t); this.emit('deny', { reason: 'nofuel' }); return false; }
    const secs = this.smeltSecs(t);
    s.furnace.push({ t, left: secs, total: secs });
    this.emit('smeltStart', { t });
    return true;
  }
  unsmelt(k) {
    const s = this.s, f = s.furnace[k];
    if (!f) return false;
    s.furnace.splice(k, 1);
    this.addInv('b' + f.t);
    this.addInv('b' + FUEL_TIER); // the coal comes back too
    this.emit('unsmelt', { t: f.t });
    return true;
  }

  // ------------------------------------------------------------- spending
  boosterPrice() { return boosterPrice(this.baseGps(), this.s.level); }
  buyBooster(id) {
    const s = this.s, b = BOOSTERS[id], price = this.boosterPrice();
    if (!b) return false;
    if (s.gold < price) { this.emit('deny', { reason: 'cost' }); return false; }
    s.gold -= price;
    s.boosts[id] += b.secs;
    this.emit('booster', { id, secs: s.boosts[id], price });
    return true;
  }
  shopTiers() { const out = []; for (let t = 1; t <= Math.max(1, this.s.maxTier - DROP_GAP); t++) out.push(t); return out; }
  shopPrice(t) { return blockValue(t); }
  buyBlock(t) {
    const s = this.s;
    if (t > Math.max(1, s.maxTier - DROP_GAP)) return -1;
    const price = this.shopPrice(t), cell = this.randomEmpty();
    if (cell < 0) { this.emit('deny', { reason: 'full' }); return -1; }
    if (s.gold < price) { this.emit('deny', { reason: 'cost' }); return -1; }
    s.gold -= price;
    s.board[cell] = { t };
    this.emit('buy', { cell, t, price });
    return cell;
  }

  // --------------------------------------------------------------- village
  buildingCost(b) { return b.cost(this.villageLv(b.id)); }
  buildingGate(b) {
    if (!this.s.villageOpen) return 'closed';
    if (this.villageLv(b.id) >= b.max) return 'max';
    if (b.unlock && this.s.level < b.unlock) return 'level';
    if (b.id === 'shaft' && this.s.maxTier < shaftNeed(this.villageLv('shaft'))) return 'deeper';
    return null;
  }
  canBuild(b) { return !this.buildingGate(b) && this.s.bricks >= this.buildingCost(b); }
  build(id) {
    const b = BUILDINGS.find((x) => x.id === id);
    if (!b || !this.canBuild(b)) { this.emit('deny', { reason: 'cost' }); return false; }
    this.s.bricks -= this.buildingCost(b);
    this.s.village[id] = this.villageLv(id) + 1;
    this.s.stats.builds++;
    this.emit('build', { id, lv: this.s.village[id] });
    return true;
  }

  // ---------------------------------------------------------------- quests
  metric(m) {
    const s = this.s;
    if (m === 'tier') return s.maxTier;
    if (m === 'level') return s.level;
    if (m === 'armorWorn') return this.armorWorn();
    if (m.startsWith('craft:')) return s.stats.craftBy[m.slice(6)] || 0;
    if (m.startsWith('kill:')) return s.stats.killBy[m.slice(5)] || 0;
    if (m.startsWith('equip:')) { const k = m.slice(6); return Math.max(s.stats.equipBy[k] || 0, s.equip[k] ? 1 : 0); }
    return s.stats[m] || 0;
  }
  questList(tab) {
    const list = tab === 't' ? TASKS : tab === 'a' ? ACHIEVEMENTS : HUNT;
    return list.map((q, i) => ({ i, q, have: Math.min(q.n, this.metric(q.metric)), ready: this.metric(q.metric) >= q.n, done: !!this.s.claimed[tab][i] }));
  }
  activeTasks() { return this.questList('t').filter((x) => !x.done).slice(0, 3); }
  readyCount(tab) {
    if (tab === 't') return this.activeTasks().filter((x) => x.ready).length;
    return this.questList(tab).filter((x) => x.ready && !x.done).length;
  }
  readyQuests() { return this.readyCount('t') + this.readyCount('a') + this.readyCount('h'); }
  claim(tab, i) {
    const list = tab === 't' ? TASKS : tab === 'a' ? ACHIEVEMENTS : HUNT;
    const q = list[i];
    if (!q || this.s.claimed[tab][i] || this.metric(q.metric) < q.n) return false;
    if (tab === 't' && !this.activeTasks().some((x) => x.i === i)) return false;
    this.s.claimed[tab][i] = 1;
    const r = q.reward;
    this.s.gold += r.gold || 0; this.s.bricks += r.bricks || 0; this.s.gems += r.gems || 0;
    this.emit('quest', { tab, i, reward: r });
    return true;
  }

  // ------------------------------------------------------------------ time
  tick(dt) {
    const s = this.s;
    if (dt <= 0) return;
    s.gold += this.gps() * dt;
    s.treasureT += dt;
    for (const k in s.boosts) if (s.boosts[k] > 0) s.boosts[k] = Math.max(0, s.boosts[k] - dt);
    if (s.energy < this.energyMax()) {
      s.energyT += dt;
      const r = this.energyRegenSecs();
      while (s.energyT >= r && s.energy < this.energyMax()) { s.energyT -= r; s.energy++; }
      if (s.energy >= this.energyMax()) s.energyT = 0;
    } else s.energyT = 0;
    if (s.furnace.length) {
      const f = s.furnace[0];
      f.left -= dt;
      if (f.left <= 0) {
        s.furnace.shift();
        s.stats.smelts++;
        const out = SMELT[f.t].out;
        this.addInv(out);
        this.emit('smelted', { t: f.t, out });
      }
    }
  }

  // Gold earned while the app was closed (half speed, one fixed cap).
  applyOffline(now) {
    const s = this.s;
    if (!s.lastSeen) { s.lastSeen = now; return 0; }
    const away = Math.max(0, (now - s.lastSeen) / 1000);
    s.lastSeen = now;
    if (s.energy < this.energyMax()) s.energy = Math.min(this.energyMax(), s.energy + Math.floor(away / this.energyRegenSecs()));
    if (away < 300) return 0;
    const secs = Math.min(away, offlineCapSecs());
    const g = OFFLINE_RATE * this.baseGps() * (1 + 0.1 * this.villageLv('hut')) * (1 + 0.25 * this.villageLv('castle'))
      * (s.iap.pass ? 2 : 1) * (s.equip.orb ? ORB_GOLD : 1) * secs;
    s.gold += g;
    return g;
  }

  // ------------------------------------------------------- pretend store
  declineReason(price) {
    const lim = this.s.settings && this.s.settings.cardLimit;
    if (lim && this.s.cardSpent + price > lim + 1e-9) return 'limit';
    return null;
  }
  owns(id) { const it = storeItem(id); return !!(it && it.once && (it.pass ? this.s.iap.pass : it.unlimited ? this.s.iap.unlimited : false)); }
  grant(id, last4, now) {
    const s = this.s, it = storeItem(id);
    if (!it || this.owns(id) || this.declineReason(it.price)) return false;
    if (it.refill && !this.refillUseful()) return false;
    s.purchases.push({ id, name: it.name, price: it.price, t: now || 0, last4: String(last4 || '').slice(-4) });
    if (s.purchases.length > 200) s.purchases.splice(0, s.purchases.length - 200);
    s.cardSpent = Math.round((s.cardSpent + it.price) * 100) / 100;
    const got = { id, gems: 0, bricks: 0, gold: 0, blocks: [] };
    if (it.gems) { s.gems += it.gems; got.gems = it.gems; }
    if (it.bricks) { s.bricks += it.bricks; got.bricks = it.bricks; }
    if (it.refill) this.refillEnergy();
    if (it.unlimited) { s.iap.unlimited = 1; s.energy = this.energyMax(); }
    if (it.rush) s.boosts.gold += it.rush;
    if (it.pass) { s.iap.pass = 1; s.gems += 10; got.gems = 10; s.energy = Math.max(s.energy, this.energyMax()); }
    if (it.chest) Object.assign(got, this.storeChest(it.chest));
    this.emit('purchased', { item: it, got });
    for (const b of got.blocks) if (b.t) this.discover(b.t);
    return got;
  }
  storeChest(kind) {
    const s = this.s, mega = kind === 'mega';
    const gold = Math.max(2000 * s.level, Math.round(this.gps() * (mega ? 300 : 60)));
    const gems = mega ? 25 : 5, bricks = mega ? 40 : 8;
    s.gold += gold; s.gems += gems; s.bricks += bricks;
    const blocks = [];
    for (let k = 0; k < (mega ? 6 : 3); k++) {
      const t = Math.min(s.maxTier, this.dropTier() + (mega ? 2 : 1) + (this.rand() < 0.5 ? 1 : 0));
      const cell = this.randomEmpty();
      if (cell < 0) { this.addInv('b' + t); blocks.push({ stored: true, t }); continue; }
      s.board[cell] = { t };
      blocks.push({ cell, t });
    }
    if (mega) { this.addInv('m:iron', 2); this.addInv('m:string', 3); }
    return { gold, gems, bricks, blocks };
  }

  serialize(now) {
    this.s.lastSeen = now;
    return JSON.stringify(this.s);
  }
}
