// Balance simulator: a robot "kid" plays Ezra's Mine for hours of game time
// and reports when each block / level / pickaxe arrives.
//   node mine/tests/sim.mjs [hours] [tapsPerSec]
import { Game } from '../js/game.js';
import { TIERS, MAX_TIER, PICK_RECIPES, UPGRADES, BUILDINGS, xpNeeded, shopPrice } from '../js/data.js';

const HOURS = Number(process.argv[2] || 12);
const VERBOSE = !!process.env.V;
const TPS = Number(process.argv[3] || 2.5);     // taps per second while playing
let seed = 12345;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const g = new Game(null, { rand });
const s = g.s;
// ENERGY=1 plays with the energy limit on and never "buys" (the robot waits).
s.settings = { energy: !!process.env.ENERGY };
const fmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n) + '';
const mm = (t) => `${Math.floor(t / 3600)}h${String(Math.floor(t / 60) % 60).padStart(2, '0')}m`;
const log = [];
g.on = (type, d) => {
  if (type === 'discover') log.push(`${mm(T)}  NEW ${d.t} ${TIERS[d.t].name}  (lvl ${s.level}, gps ${fmt(g.gps())}, gold ${fmt(s.gold)})`);
  if (type === 'pickaxe') log.push(`${mm(T)}  PICKAXE ${d.pick}`);
  if (type === 'levelup' && d.level % 5 === 0) log.push(`${mm(T)}  level ${d.level}`);
  if (type === 'cave') log.push(`${mm(T)}  CAVE ${d.cave.name}`);
  if (type === 'upgrade' && VERBOSE) log.push(`${mm(T)}    up ${d.id} ${d.lv}`);
  if (type === 'build' && VERBOSE) log.push(`${mm(T)}    build ${d.id} ${d.lv}`);
};
let T = 0; const DT = 0.1;
let busy = 0, fullTime = 0, idleChecks = 0, fullPre = 0;
const TAP_COST = 1 / TPS, MERGE_COST = Number(process.argv[4] || 0.9);
const mergeAll = () => { let p; while ((p = g.mergeablePairs()).length) { p.sort((a, b) => s.board[a[0]].t - s.board[b[0]].t); g.merge(p[0][0], p[0][1]); } };
while (T < HOURS * 3600) {
  T += DT;
  g.tick(DT);
  // The kid has limited attention: each merge (drag) or tap takes time.
  busy -= DT;

  while (busy <= 0) {
    const ci = s.board.findIndex((c) => c && c.chest);
    const bi = s.board.findIndex((c) => c && c.boom);
    if (bi >= 0) { let hi = -1; s.board.forEach((c, i) => { if (c && c.t && g.canBoom(c.t) && (hi < 0 || c.t > s.board[hi].t)) hi = i; }); if (hi >= 0) { g.drop(bi, hi); busy += 1; continue; } else { g.storeBlock(bi); } }
    const p = g.mergeablePairs();
    if (ci >= 0) { g.openChest(ci); busy += 1.0; }
    else if (p.length) { p.sort((a, b) => s.board[b[0]].t - s.board[a[0]].t); g.merge(p[0][0], p[0][1]); busy += MERGE_COST; }
    else { const r = g.tapMine(false); if (r.full) { fullTime += TAP_COST; if (s.maxTier < 20) fullPre += TAP_COST; } busy += TAP_COST; }
  }
  // full board with no pairs: smelt the smallest block (furnace = outlet)
  if (!g.emptyCells().length && !g.mergeablePairs().length) {
    let lo = -1; s.board.forEach((c, i) => { if (c && c.t && (lo < 0 || c.t < s.board[lo].t)) lo = i; });
    if (lo >= 0 && !g.smeltFromBoard(lo)) g.storeBlock(lo);
  }
  if (process.env.DBG && Math.abs(T % 900) < DT) console.log(mm(T), 'board', s.board.map(c => c ? (c.t || 'C') : (c === null ? '.' : '?')).join(' '), 'drop', g.dropTier(), 'max', s.maxTier, 'store', JSON.stringify(s.store), 'furn', s.furnace.length, 'helper', g.helperInterval().toFixed(2), 'pick', s.pick);
  // every second: spend
  if (Math.abs(T % 1) < DT) {
    // smelt ores we need for the next pickaxe: store ore blocks of the right tier when we have 2+ of them
    const r = PICK_RECIPES[s.pick + 1];
    if (r) {
      for (const k in r.need) {
        if (g.have(k) >= r.need[k]) continue;
        if (k.startsWith('i:')) {
          const ing = k.slice(2), from = { copper: 7, iron: 8, gold: 9, ruby: 10 }[ing];
          const idx = s.board.findIndex((c) => c && c.t === from);
          if (idx >= 0 && s.furnace.length < 3) g.smeltFromBoard(idx);
        } else {
          const t = Number(k.slice(1)); const idx = s.board.findIndex((c) => c && c.t === t);
          if (idx >= 0) g.storeBlock(idx);
        }
      }
      g.craftPickaxe();
    }
    for (const id of ['helper', 'depth', 'lucky']) while (g.canUpgrade(id)) g.upgrade(id);
    for (const b of BUILDINGS) while (g.canBuild(b)) g.build(b.id);
    for (const a of g.activeQuests()) if (a.ready) g.claimQuest(a.i);
    if (g.rushReady()) g.startRush();
    if (s.gems >= 3 && g.mergeablePairs().length > 3) g.usePower('magic');
  }
}
console.log(log.join('\n'));
console.log(`\nAfter ${HOURS}h at ${TPS} taps/s: level ${s.level}, maxTier ${s.maxTier}, pick ${s.pick}, up ${JSON.stringify(s.up)}, village ${JSON.stringify(s.village)}`);
console.log(`gold ${fmt(s.gold)} gps ${fmt(g.gps())} bricks ${s.bricks} gems ${s.gems} quests claimed ${Object.keys(s.claimed).length}, full-board time ${Math.round(fullTime)}s (before star: ${Math.round(fullPre)}s), mined ${s.stats.mined}, merges ${s.stats.merges}, chests ${s.stats.chests}`);
console.log('xp per level 1..30:', [1,2,3,5,10,15,20,25,30].map(l=>l+':'+xpNeeded(l)).join(' '));
