// The game rules for Ezra's Mine, with no screen code at all (so it can be
// tested and balance-simulated in Node). The UI calls these methods and
// listens to events (game.on = (type, data) => ...) to animate things.

import {
  TIERS, MAX_TIER, COLS, ROWS, openCells, xpNeeded, mergeXP, MINE_XP,
  PICKAXES, PICK_RECIPES, UPGRADES, INGOTS, BUILDINGS, shopPrice, POWERS,
  chestEvery, QUESTS, offlineCapSecs, OFFLINE_RATE, caveFor, DROP_GAP, depthNeed,
  SPARK_FULL, RUSH_FULL, RUSH_SECS, wellEvery,
} from './data.js';

export const SAVE_KEY = 'ezramine.save.v1';
export const N_CELLS = COLS * ROWS;

// Cells unlock from the middle outwards so the open area always looks tidy.
export const UNLOCK_ORDER = (() => {
  const cx = (COLS - 1) / 2, cy = (ROWS - 1) / 2 + 0.3;
  const idx = [...Array(N_CELLS).keys()];
  return idx.sort((a, b) => {
    const da = Math.hypot(a % COLS - cx, Math.floor(a / COLS) - cy);
    const db = Math.hypot(b % COLS - cx, Math.floor(b / COLS) - cy);
    return da - db || a - b;
  });
})();

export function freshState() {
  return {
    v: 1,
    gold: 0, bricks: 0, gems: 0,
    level: 1, xp: 0,
    board: Array(N_CELLS).fill(null),   // null | { t: tier } | { chest: 1 } | { boom: 1 }
    mineHp: PICKAXES[0].taps,
    pick: 0,
    up: { depth: 0, helper: 0, lucky: 0 },
    village: {},
    store: {},                          // 'b<tier>' -> count, 'i:<ingot>' -> count
    furnace: [],                        // queue of { k: 'b<tier>', left, total }
    maxTier: 1,
    seen: { 1: 1 },                     // tiers discovered
    stats: { taps: 0, merges: 0, mined: 0, chests: 0, smelts: 0, stored: 0, supers: 0, rushes: 0, booms: 0 },
    spark: 0,                           // fills as you mine -> Super Swing
    rush: 0,                            // fills as you merge -> Gold Rush
    wellN: 0,                           // merges counted toward the next well gem
    won: 0,
    booms: 0,                           // Boom Blocks kept in the chest
    quest: 0,                           // index of the first quest not yet claimed
    claimed: {},                        // quest index -> 1
    boostLeft: 0,
    chestT: 0,
    helperT: 0,
    lastSeen: 0,
    sound: true,
  };
}

export class Game {
  constructor(state, opts = {}) {
    this.s = Object.assign(freshState(), state || {});
    // Merge nested objects defensively (older saves may miss keys).
    const f = freshState();
    this.s.up = Object.assign(f.up, this.s.up || {});
    this.s.stats = Object.assign(f.stats, this.s.stats || {});
    if (!Array.isArray(this.s.board) || this.s.board.length !== N_CELLS) {
      const old = Array.isArray(this.s.board) ? this.s.board : [];
      this.s.board = Array(N_CELLS).fill(null).map((_, i) => old[i] || null);
    }
    // Older saves kept Boom Blocks as store.boom — move them to their own counter.
    if (this.s.store && this.s.store.boom) { this.s.booms = (this.s.booms || 0) + this.s.store.boom; delete this.s.store.boom; }
    for (const k of Object.keys(this.s.store || {})) if (!/^(b\d+|i:\w+)$/.test(k) || !(this.s.store[k] > 0)) delete this.s.store[k];
    if (typeof this.s.booms !== 'number' || !(this.s.booms >= 0)) this.s.booms = 0;
    this.rand = opts.rand || Math.random;
    this.on = opts.on || (() => {});
  }

  emit(type, data) { try { this.on(type, data); } catch (e) { console.error(e); } }

  // ---------------------------------------------------------------- derived
  get pickaxe() { return PICKAXES[this.s.pick]; }
  villageLv(id) { return this.s.village[id] || 0; }
  goldMult() {
    return (1 + 0.1 * this.villageLv('hut')) * (1 + 0.25 * this.villageLv('castle')) * (this.s.boostLeft > 0 ? 2 : 1);
  }
  isOpen(i) { return UNLOCK_ORDER.indexOf(i) < openCells(this.s.level); }
  unlockLevel(i) { // level at which cell i opens
    const rank = UNLOCK_ORDER.indexOf(i);
    for (let lv = 1; lv < 200; lv++) if (rank < openCells(lv)) return lv;
    return 999;
  }
  baseGps() {
    let g = 0;
    for (const c of this.s.board) if (c && c.t) g += TIERS[c.t].gps;
    return g;
  }
  gps() { return this.baseGps() * this.goldMult(); }
  emptyCells() {
    const out = [];
    for (let i = 0; i < N_CELLS; i++) if (!this.s.board[i] && this.isOpen(i)) out.push(i);
    return out;
  }
  // Tier the mine block drops: grows with "Dig Deeper", but always stays
  // DROP_GAP below your best block so there's always merging to do.
  dropTier() {
    return Math.max(1, Math.min(1 + this.s.up.depth, this.s.maxTier - DROP_GAP));
  }
  // Tiers of blocks kept in the chest (only 'b<number>' keys).
  storedTiers() {
    return Object.keys(this.s.store).filter((k) => /^b\d+$/.test(k) && this.s.store[k] > 0).map((k) => Number(k.slice(1)));
  }
  storedBlocks() {
    let n = 0;
    for (const t of this.storedTiers()) n += this.s.store['b' + t];
    return n;
  }
  helperInterval() { return UPGRADES.helper.interval(this.s.up.helper); }

  // Where a new block of tier t should land: the empty square closest to a
  // twin (so little fingers only drag a short way), otherwise the one closest
  // to the middle of the board. Returns -1 if the board is full.
  placeFor(t) {
    const empty = this.emptyCells();
    if (!empty.length) return -1;
    const xy = (i) => [i % COLS, Math.floor(i / COLS)];
    const twins = [];
    if (t) this.s.board.forEach((c, i) => { if (c && c.t === t) twins.push(xy(i)); });
    const cx = (COLS - 1) / 2, cy = (ROWS - 1) / 2;
    let best = -1, bestD = Infinity;
    for (const i of empty) {
      const [x, y] = xy(i);
      let d = twins.length ? Math.min(...twins.map(([a, b]) => Math.abs(a - x) + Math.abs(b - y))) : Math.abs(x - cx) + Math.abs(y - cy);
      d += UNLOCK_ORDER.indexOf(i) * 1e-3; // stable tie-break
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  // A leftover block with no twin on the board, smaller than what the mine
  // drops — the mine sends it a buddy so it can merge up (lowest first).
  lonelyTier() {
    const count = {};
    for (const c of this.s.board) if (c && c.t) count[c.t] = (count[c.t] || 0) + 1;
    const d = this.dropTier();
    for (let t = 1; t < d; t++) if (count[t] === 1) return t;
    return 0;
  }
  cave() { return caveFor(this.s.maxTier); }

  // ------------------------------------------------------------- the mine
  // One tap on the big block. Returns what happened (for the UI).
  // Tapping ALWAYS works: if the board is full, new blocks hop into the
  // storage chest instead, so nothing is ever lost or blocked.
  tapMine(auto = false) {
    const s = this.s;
    if (auto && !this.emptyCells().length) return { full: true }; // the mole waits politely
    if (!auto) s.stats.taps++;
    s.mineHp -= 1;
    this.emit('hit', { auto, hp: s.mineHp, max: this.pickaxe.taps });
    if (s.mineHp > 0) return { hit: true };
    // Block breaks!
    s.mineHp = this.pickaxe.taps;
    s.stats.mined++;
    this.addXP(MINE_XP);
    const superSwing = s.spark >= SPARK_FULL;
    if (superSwing) { s.spark = 0; s.stats.supers++; } else s.spark++;
    const tiers = [];
    if (s.chestT >= chestEvery(this.villageLv('tower')) && s.level >= 2 && !s.board.some((c) => c && c.chest) && this.emptyCells().length) {
      s.chestT = 0;
      tiers.push('chest');
    }
    const n = superSwing ? 2 : (this.rand() < this.pickaxe.double ? 2 : 1);
    for (let k = 0; k < n; k++) {
      const buddy = !superSwing && k === 0 ? this.lonelyTier() : 0;
      if (buddy) { tiers.push(buddy); continue; }
      let t = this.dropTier() + (superSwing ? 1 : 0);
      if (this.rand() < UPGRADES.lucky.chance(s.up.lucky)) t++;
      tiers.push(Math.min(t, s.maxTier));
    }
    const drops = [];
    for (const t of tiers) {
      const empty = this.emptyCells();
      if (t === 'chest') {
        if (!empty.length) continue; // the chest just waits for next time
        const cell = this.placeFor(0);
        s.board[cell] = { chest: 1 };
        drops.push({ cell, chest: true });
        continue;
      }
      if (!empty.length) {
        const k = 'b' + t;
        s.store[k] = (s.store[k] || 0) + 1;
        drops.push({ stored: true, t });
        continue;
      }
      const cell = this.placeFor(t);
      s.board[cell] = { t };
      drops.push({ cell, t });
    }
    this.emit('break', { auto, drops, superSwing });
    for (const d of drops) if (d.t) this.discover(d.t);
    return { broke: true, drops, superSwing };
  }

  // ------------------------------------------------------------ the board
  // Drag cell a onto cell b: merge (same block), move (empty), or swap.
  drop(a, b) {
    const s = this.s, A = s.board[a], B = s.board[b];
    if (a === b || !A || A.chest || !this.isOpen(b)) return { none: true };
    if (!B) { s.board[b] = A; s.board[a] = null; this.emit('move', { a, b }); return { moved: true }; }
    if (B.chest) return { none: true };
    if (A.boom && B.t) return this.boomOn(a, b);
    if (B.boom && A.t) { s.board[a] = B; s.board[b] = A; this.emit('swap', { a, b }); return { swapped: true }; }
    if (A.t && A.t === B.t) return this.merge(a, b);
    s.board[a] = B; s.board[b] = A;
    this.emit('swap', { a, b });
    return { swapped: true };
  }

  canMerge(a, b) {
    const A = this.s.board[a], B = this.s.board[b];
    return !!(A && B && A.t && A.t === B.t && A.t < MAX_TIER && a !== b);
  }

  merge(a, b) {
    const s = this.s;
    if (!this.canMerge(a, b)) {
      this.emit('deny', { reason: 'max' });
      return { none: true };
    }
    const t = s.board[b].t + 1;
    s.board[a] = null;
    s.board[b] = { t };
    s.stats.merges++;
    if (s.rush < RUSH_FULL) s.rush++;
    const xp = mergeXP(t);
    let gem = 0;
    const every = wellEvery(this.villageLv('well'));
    if (every) { s.wellN++; if (s.wellN >= every) { s.wellN = 0; gem = 1; s.gems += 1; } }
    this.emit('merge', { a, b, t, xp, gem });
    this.discover(t);
    this.addXP(xp);
    return { merged: true, t };
  }

  discover(t) {
    const s = this.s;
    if (s.seen[t]) return;
    s.seen[t] = 1;
    const oldCave = caveFor(s.maxTier);
    if (t > s.maxTier) s.maxTier = t;
    if (t >= 3) s.gems += 1; // every new block found gives a gem
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
      const reward = Math.max(50, Math.round(this.baseGps() * 30));
      s.gold += reward;
      s.gems += 1;
      this.emit('levelup', { level: s.level, newCells: openCells(s.level) - before, reward, gems: 1 });
    }
  }

  // Tap a treasure chest on the board.
  openChest(i) {
    const s = this.s, c = s.board[i];
    if (!c || !c.chest) return null;
    s.board[i] = null;
    s.stats.chests++;
    const gold = Math.max(100, Math.round(this.baseGps() * this.goldMult() * 45));
    const bricks = 2 + Math.floor(this.rand() * 4) + Math.floor(s.level / 3);
    const gems = this.rand() < 0.15 ? 1 : 0;
    s.gold += gold; s.bricks += bricks; s.gems += gems;
    const blocks = [];
    const nb = 2 + (this.rand() < 0.4 ? 1 : 0);
    const boom = this.rand() < 0.25;
    for (let k = 0; k < nb + (boom ? 1 : 0); k++) {
      const empty = this.emptyCells();
      const isBoom = boom && k === nb;
      const t = Math.min(s.maxTier, this.dropTier() + 1 + (this.rand() < 0.3 ? 1 : 0));
      if (!empty.length) {
        if (!isBoom) { s.store['b' + t] = (s.store['b' + t] || 0) + 1; blocks.push({ stored: true, t }); }
        else { s.booms++; blocks.push({ stored: true, boom: true }); }
        continue;
      }
      const cell = k === 0 ? i : this.placeFor(isBoom ? 0 : t);
      if (isBoom) { s.board[cell] = { boom: 1 }; blocks.push({ cell, boom: true }); continue; }
      s.board[cell] = { t };
      blocks.push({ cell, t });
    }
    this.emit('chest', { i, gold, bricks, gems, blocks });
    for (const b of blocks) if (b.t) this.discover(b.t);
    return { gold, bricks, gems, blocks };
  }

  // ------------------------------------------------- storage chest & furnace
  storeBlock(i) {
    const s = this.s, c = s.board[i];
    if (!c || !(c.t || c.boom)) return false;
    if (c.boom) s.booms++;
    else s.store['b' + c.t] = (s.store['b' + c.t] || 0) + 1;
    s.board[i] = null;
    s.stats.stored++;
    this.emit('store', { i, t: c.t, boom: !!c.boom });
    return true;
  }

  // Put a stored block (or a Boom Block, t === 'boom') back on the board.
  unstore(t) {
    const s = this.s, isBoom = t === 'boom', k = 'b' + t;
    if (isBoom ? !s.booms : !s.store[k]) return -1;
    const empty = this.emptyCells();
    if (!empty.length) { this.emit('deny', { reason: 'full' }); return -1; }
    const cell = this.placeFor(isBoom ? 0 : t);
    if (isBoom) s.booms--;
    else { s.store[k]--; if (!s.store[k]) delete s.store[k]; }
    s.board[cell] = t === 'boom' ? { boom: 1 } : { t };
    this.emit('unstore', { cell, t });
    return cell;
  }

  furnaceSlots() { return 3; }
  smeltSecs(t) {
    const base = 2 + t * 0.6;
    return Math.max(1, base * Math.pow(0.82, this.villageLv('forge')));
  }
  smeltResult(t) {
    for (const id in INGOTS) if (INGOTS[id].from === t) return { ingot: id, bricks: INGOTS[id].bricks };
    return { bricks: Math.max(1, Math.round(Math.pow(1.35, t - 1))) };
  }
  // Your two best kinds of block are too precious to melt.
  canSmelt(t) { return !!t && t < this.s.maxTier - 1; }
  // Put a block from the board into the furnace.
  smeltFromBoard(i) {
    const s = this.s, c = s.board[i];
    if (!c || !c.t) return false;
    if (!this.canSmelt(c.t)) { this.emit('deny', { reason: 'precious', i }); return false; }
    if (s.furnace.length >= this.furnaceSlots()) { this.emit('deny', { reason: 'furnace' }); return false; }
    s.board[i] = null;
    const secs = this.smeltSecs(c.t);
    s.furnace.push({ t: c.t, left: secs, total: secs });
    this.emit('smeltStart', { i, t: c.t });
    return true;
  }
  smeltFromStore(t) {
    const s = this.s, k = 'b' + t;
    if (!s.store[k]) return false;
    if (!this.canSmelt(t)) { this.emit('deny', { reason: 'precious' }); return false; }
    if (s.furnace.length >= this.furnaceSlots()) { this.emit('deny', { reason: 'furnace' }); return false; }
    s.store[k]--; if (!s.store[k]) delete s.store[k];
    const secs = this.smeltSecs(t);
    s.furnace.push({ t, left: secs, total: secs });
    this.emit('smeltStart', { t });
    return true;
  }

  // Changed your mind? Take a block back out of the furnace (to the board,
  // or the chest if the board is full).
  unsmelt(k) {
    const s = this.s, f = s.furnace[k];
    if (!f) return -1;
    s.furnace.splice(k, 1);
    const cell = this.placeFor(f.t);
    if (cell >= 0) s.board[cell] = { t: f.t };
    else s.store['b' + f.t] = (s.store['b' + f.t] || 0) + 1;
    this.emit('unsmelt', { t: f.t, cell });
    return cell;
  }

  // ---------------------------------------------------------- spending
  // How many of an ingredient you have: bars live in the chest; blocks count
  // whether they're in the chest OR on the board (friendlier for little kids).
  have(k) {
    let n = this.s.store[k] || 0;
    if (k[0] === 'b') { const t = Number(k.slice(1)); for (const c of this.s.board) if (c && c.t === t) n++; }
    return n;
  }
  // Use up ingredients: from the chest first, then from the board.
  spend(k, n) {
    const s = this.s;
    const fromStore = Math.min(n, s.store[k] || 0);
    if (fromStore) { s.store[k] -= fromStore; if (!s.store[k]) delete s.store[k]; }
    let left = n - fromStore;
    if (left > 0 && k[0] === 'b') {
      const t = Number(k.slice(1));
      for (let i = 0; i < N_CELLS && left > 0; i++) if (s.board[i] && s.board[i].t === t) { s.board[i] = null; left--; }
    }
  }
  canAffordNeed(need) {
    for (const k in need) if (this.have(k) < need[k]) return false;
    return true;
  }
  craftPickaxe() {
    const s = this.s, next = s.pick + 1, r = PICK_RECIPES[next];
    if (!r) return false;
    if (s.gold < r.gold || !this.canAffordNeed(r.need)) { this.emit('deny', { reason: 'cost' }); return false; }
    s.gold -= r.gold;
    for (const k in r.need) this.spend(k, r.need[k]);
    s.pick = next;
    s.mineHp = Math.min(s.mineHp, PICKAXES[next].taps);
    this.emit('pickaxe', { pick: next });
    return true;
  }

  // Dig Deeper only helps once your best block is far enough ahead.
  depthUseful() { return depthNeed(this.s.up.depth) <= MAX_TIER && this.s.maxTier >= depthNeed(this.s.up.depth); }
  depthMaxed() { return this.s.up.depth >= UPGRADES.depth.max || depthNeed(this.s.up.depth) > MAX_TIER; }
  upgradeCost(id) { return UPGRADES[id].cost(this.s.up[id]); }
  canUpgrade(id) {
    const u = UPGRADES[id], lv = this.s.up[id];
    if (lv >= u.max) return false;
    if (id === 'depth' && !this.depthUseful()) return false;
    return this.s.gold >= u.cost(lv);
  }
  upgrade(id) {
    if (!this.canUpgrade(id)) { this.emit('deny', { reason: 'cost' }); return false; }
    this.s.gold -= this.upgradeCost(id);
    this.s.up[id]++;
    this.emit('upgrade', { id, lv: this.s.up[id] });
    return true;
  }

  buildingCost(b) { return b.cost(this.villageLv(b.id)); }
  canBuild(b) {
    return this.villageLv(b.id) < b.max && this.s.level >= (b.unlock || 1) && this.s.bricks >= this.buildingCost(b);
  }
  build(id) {
    const b = BUILDINGS.find((x) => x.id === id);
    if (!b || !this.canBuild(b)) { this.emit('deny', { reason: 'cost' }); return false; }
    this.s.bricks -= this.buildingCost(b);
    this.s.village[id] = this.villageLv(id) + 1;
    this.emit('build', { id, lv: this.s.village[id] });
    return true;
  }
  buildingsBuilt() { return BUILDINGS.filter((b) => this.villageLv(b.id) > 0).length; }

  shopTiers() {
    const top = Math.max(1, this.s.maxTier - DROP_GAP);
    const out = [];
    for (let t = 1; t <= top; t++) out.push(t);
    return out;
  }
  buyBlock(t) {
    const s = this.s;
    if (t > Math.max(1, s.maxTier - DROP_GAP)) return -1;
    const price = shopPrice(t);
    const empty = this.emptyCells();
    if (!empty.length) { this.emit('deny', { reason: 'full' }); return -1; }
    if (s.gold < price) { this.emit('deny', { reason: 'cost' }); return -1; }
    s.gold -= price;
    const cell = this.placeFor(t);
    s.board[cell] = { t };
    this.emit('buy', { cell, t, price });
    return cell;
  }

  usePower(id) {
    const s = this.s, p = POWERS[id];
    if (!p || s.gems < p.gems) { this.emit('deny', { reason: 'gems' }); return false; }
    if (id === 'magic' && !this.mergeablePairs().length) { this.emit('deny', { reason: 'nopairs' }); return false; }
    if (id === 'boom' && !this.emptyCells().length) { this.emit('deny', { reason: 'full' }); return false; }
    s.gems -= p.gems;
    if (id === 'magic') this.magicMerge();
    if (id === 'boom') {
      const e = this.emptyCells();
      const cell = this.placeFor(0);
      s.board[cell] = { boom: 1 };
      this.emit('buy', { cell, boom: true });
    }
    return true;
  }

  // A Boom Block dropped on a block makes it one step bigger. It works on
  // small and middle blocks (the same ones the shop sells) — perfect for a
  // leftover block that has no twin.
  boomMax() { return Math.max(1, this.s.maxTier - DROP_GAP); }
  canBoom(t) { return !!t && t <= this.boomMax() && t < MAX_TIER; }
  boomOn(a, b) {
    const s = this.s, B = s.board[b];
    if (!B || !this.canBoom(B.t)) { this.emit('deny', { reason: 'toobig', i: b }); return { none: true }; }
    s.board[a] = null;
    s.board[b] = { t: B.t + 1 };
    s.stats.booms++;
    this.emit('boom', { a, b, t: B.t + 1 });
    this.discover(B.t + 1);
    return { boomed: true };
  }

  // The Gold Rush jar: full after RUSH_FULL merges, tap for double gold.
  rushReady() { return this.s.rush >= RUSH_FULL; }
  startRush() {
    const s = this.s;
    if (!this.rushReady()) { this.emit('deny', { reason: 'rush' }); return false; }
    s.rush = 0;
    s.boostLeft += RUSH_SECS;
    s.stats.rushes++;
    this.emit('rush', { secs: s.boostLeft });
    return true;
  }

  // All pairs that could merge right now (for hints and Magic Merge).
  mergeablePairs() {
    const byTier = {};
    this.s.board.forEach((c, i) => { if (c && c.t && c.t < MAX_TIER) (byTier[c.t] = byTier[c.t] || []).push(i); });
    const pairs = [];
    for (const t in byTier) { const l = byTier[t]; for (let k = 0; k + 1 < l.length; k += 2) pairs.push([l[k], l[k + 1]]); }
    return pairs;
  }

  magicMerge() {
    const steps = [];
    for (let guard = 0; guard < 100; guard++) {
      const pairs = this.mergeablePairs();
      if (!pairs.length) break;
      // merge the smallest blocks first so chains cascade upwards
      pairs.sort((p, q) => this.s.board[p[0]].t - this.s.board[q[0]].t);
      const [a, b] = pairs[0];
      steps.push([a, b]);
      this.merge(a, b);
    }
    this.emit('magic', { steps });
  }

  // ------------------------------------------------------------- quests
  questMetric(q) {
    const s = this.s;
    switch (q.metric) {
      case 'tier': return s.maxTier;
      case 'level': return s.level;
      case 'pick': return s.pick;
      case 'helper': return s.up.helper;
      case 'build': return this.buildingsBuilt();
      case 'castle': return this.villageLv('castle');
      case 'hut': return this.villageLv('hut');
      default: return s.stats[q.metric] || 0;
    }
  }
  activeQuests() {
    const out = [];
    for (let i = 0; i < QUESTS.length && out.length < 3; i++) {
      if (this.s.claimed[i]) continue;
      out.push({ i, q: QUESTS[i], have: Math.min(QUESTS[i].n, this.questMetric(QUESTS[i])), ready: this.questMetric(QUESTS[i]) >= QUESTS[i].n });
    }
    return out;
  }
  readyQuests() { return this.activeQuests().filter((a) => a.ready).length; }
  claimQuest(i) {
    const q = QUESTS[i];
    if (!q || this.s.claimed[i] || this.questMetric(q) < q.n) return false;
    this.s.claimed[i] = 1;
    const r = q.reward;
    this.s.gold += r.gold || 0; this.s.bricks += r.bricks || 0; this.s.gems += r.gems || 0;
    this.emit('quest', { i, reward: r });
    return true;
  }

  // ---------------------------------------------------------------- time
  tick(dt) {
    const s = this.s;
    if (dt <= 0) return;
    s.gold += this.gps() * dt;
    s.chestT += dt;
    if (s.boostLeft > 0) s.boostLeft = Math.max(0, s.boostLeft - dt);
    // the mole helper
    const iv = this.helperInterval();
    if (iv > 0) {
      s.helperT += dt;
      if (s.helperT >= iv) {
        s.helperT = Math.min(s.helperT - iv, iv);
        this.tapMine(true);
      }
    }
    // the furnace works on the first item in the queue
    if (s.furnace.length) {
      const f = s.furnace[0];
      f.left -= dt;
      if (f.left <= 0) {
        s.furnace.shift();
        s.stats.smelts++;
        const r = this.smeltResult(f.t);
        r.bricks = Math.round(r.bricks * (1 + 0.25 * this.villageLv('bakery')));
        s.bricks += r.bricks;
        if (r.ingot) { const k = 'i:' + r.ingot; s.store[k] = (s.store[k] || 0) + 1; }
        this.emit('smelted', { t: f.t, ingot: r.ingot, bricks: r.bricks });
      }
    }
  }

  // Gold earned while the app was closed (capped, never pressures you).
  applyOffline(now) {
    const s = this.s;
    if (!s.lastSeen) { s.lastSeen = now; return 0; }
    const away = Math.max(0, (now - s.lastSeen) / 1000);
    s.lastSeen = now;
    if (away < 300) return 0;
    const secs = Math.min(away, offlineCapSecs());
    const g = OFFLINE_RATE * this.baseGps() * (1 + 0.1 * this.villageLv('hut')) * (1 + 0.25 * this.villageLv('castle')) * secs;
    s.gold += g;
    return g;
  }

  serialize(now) {
    this.s.lastSeen = now;
    return JSON.stringify(this.s);
  }
}
