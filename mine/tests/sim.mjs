// Balance simulator (v2): a robot "kid" plays Ezra's Mine for hours of game
// time — mining, opening chests, merging, crafting gear, smelting, fighting
// monsters, building the village — and reports when things happen.
//   node mine/tests/sim.mjs [hours] [secsPerTap] [secsPerMerge]
//   ENERGY=1   play with the energy limit on (and never buy refills)
//   BOOST=1    buy "Block level +2" boosters with coins when affordable
//   V=1        verbose (every craft/build)
import { Game } from '../js/game.js';
import { TIERS, RECIPES, BUILDINGS, SMELT, GEAR, MATS } from '../js/data.js';

const HOURS = Number(process.argv[2] || 12);
const TAP = Number(process.argv[3] || 0.67);      // a 6-year-old taps ~1.5/s
const MERGE = Number(process.argv[4] || 1.8);
const VERBOSE = !!process.env.V;
let seed = 12345;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const g = new Game(null, { rand });
const s = g.s;
s.settings = { energy: !!process.env.ENERGY };
const fmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n) + '';
const mm = (t) => `${Math.floor(t / 3600)}h${String(Math.floor(t / 60) % 60).padStart(2, '0')}m`;
const log = [];
let T = 0;
g.on = (type, d) => {
  if (type === 'discover') log.push(`${mm(T)}  NEW ${d.t} ${TIERS[d.t].name}  (lvl ${s.level}, gps ${fmt(g.gps())}, gold ${fmt(s.gold)}, pick ${s.equip.pick || '-'}, sword ${s.equip.sword || '-'})`);
  if (type === 'levelup' && d.level % 5 === 0) log.push(`${mm(T)}  level ${d.level}`);
  if (type === 'villageOpen') log.push(`${mm(T)}  VILLAGE OPEN`);
  if (VERBOSE && type === 'craft') log.push(`${mm(T)}    craft ${d.recipe.id}`);
  if (VERBOSE && type === 'build') log.push(`${mm(T)}    build ${d.id} ${d.lv}`);
  if (VERBOSE && type === 'kill') log.push(`${mm(T)}    kill ${d.id}`);
};
const DT = 0.1;
let busy = 0, waitE = 0;
const matRank = { wood: 1, stone: 2, iron: 3, gold: 4, diamond: 5 };
const better = (slot, mat) => !s.equip[slot] || (GEAR[s.equip[slot]].mat && matRank[mat] > matRank[GEAR[s.equip[slot]].mat]);
// Put a board block of tier t into the chest (for crafting).
const stash = (t, n) => { for (let k = 0; k < n; k++) { const i = s.board.findIndex((c) => c && !c.chest && c.t === t); if (i < 0) return false; g.storeBlock(i); } return true; };
function tryCraft(id) {
  const rec = RECIPES.find((r) => r.id === id);
  if (!g.canFill(rec)) return false;
  g.fillRecipe(id); g.craft();
  const out = rec.out;
  if (out.startsWith('g:')) g.equip(out.slice(2));
  return true;
}
function think() {
  // wood: keep logs flowing into planks/sticks while we still need wood gear
  const wantSword = better('sword', 'wood'), wantPick = better('pick', 'wood');
  if ((wantSword || wantPick) && g.have('m:planks') < 7) { if (g.have('b2') || stash(2, 1)) tryCraft('planks'); }
  if ((wantSword || wantPick) && g.have('m:stick') < 2 && g.have('m:planks') >= 2) tryCraft('stick');
  if (wantSword) tryCraft('wood_sword');
  if (wantPick) tryCraft('wood_pick');
  // higher tiers: stone, iron, gold, diamond tools (and armor from iron up)
  const sticksFor = (n) => { while (g.have('m:stick') < n) { if (g.have('m:planks') < 2) { if (!(g.have('b2') || stash(2, 1))) return false; tryCraft('planks'); } if (!tryCraft('stick')) return false; } return true; };
  for (const m of ['stone', 'iron', 'gold', 'diamond']) {
    for (const slot of ['pick', 'sword']) {
      if (!better(slot, m)) continue;
      const need = slot === 'pick' ? 3 : 2;
      if (m === 'stone') { if (g.have('b3') < need && !stash(3, need - g.have('b3'))) continue; }
      else if (g.have('m:' + m) < need) continue;
      if (!sticksFor(slot === 'pick' ? 2 : 1)) continue;
      tryCraft(m + '_' + slot);
    }
    if (m !== 'stone') for (const p of ['helmet', 'chest', 'legs', 'boots']) if (better(p, m)) tryCraft(m + '_' + p);
  }
  // smelt ores for bars (needs coal)
  for (const t of [12, 7, 6]) {
    if (s.furnace.length >= 3) break;
    const i = s.board.findIndex((c) => c && !c.chest && c.t === t);
    const hasCoal = g.have('b4') || s.board.some((c) => c && !c.chest && c.t === 4);
    if (i >= 0 && hasCoal && s.maxTier > t + 1) g.smeltFromBoard(i);
  }
  // the Mine Shaft first (it's what makes the mine give bigger blocks)
  const shaft = BUILDINGS.find((b) => b.id === 'shaft');
  while (g.canBuild(shaft)) g.build('shaft');
  if (!g.buildingGate(shaft) && s.bricks < g.buildingCost(shaft)) { /* save up */ } else for (const b of BUILDINGS) while (g.canBuild(b)) g.build(b.id);
  if (process.env.BOOST && s.boosts.block <= 0 && s.gold > g.boosterPrice() * 2) g.buyBooster('block');
  for (const tab of ['t', 'a', 'h']) for (const x of g.questList(tab)) if (x.ready && !x.done) g.claim(tab, x.i);
}
let thinkT = 0, waited = 0;
while (T < HOURS * 3600) {
  T += DT;
  g.tick(DT);
  thinkT += DT;
  if (thinkT > 10) { thinkT = 0; think(); }
  busy -= DT;
  while (busy <= 0) {
    if (s.monster) { g.tapMine(); busy += TAP; continue; }
    const ci = s.board.findIndex((c) => c && c.chest);
    if (ci >= 0) { g.openChest(ci); busy += TAP; continue; }
    const pairs = [];
    const by = {};
    s.board.forEach((c, i) => { if (c && !c.chest && c.t < 18) (by[c.t] = by[c.t] || []).push(i); });
    for (const t in by) if (by[t].length >= 2) pairs.push([by[t][0], by[t][1], Number(t)]);
    if (pairs.length) { pairs.sort((a, b) => b[2] - a[2]); g.drop(pairs[0][0], pairs[0][1]); busy += MERGE; continue; }
    const r = g.tapMine();
    if (r.noEnergy) { waited += 1; busy += 1; continue; }
    busy += TAP;
  }
}
console.log(log.join('\n'));
console.log(`\nAfter ${HOURS}h (tap ${TAP}s, merge ${MERGE}s${process.env.ENERGY ? ', energy ON' : ''}${process.env.BOOST ? ', boosters' : ''}): level ${s.level}, maxTier ${s.maxTier}, gold ${fmt(s.gold)}, gps ${fmt(g.gps())}, bricks ${s.bricks}, gems ${s.gems}`);
console.log(`equip ${JSON.stringify(s.equip)}  village ${JSON.stringify(s.village)}  kills ${s.stats.kills} crafts ${s.stats.crafts} mined ${s.stats.mined} merges ${s.stats.merges}  waited for energy ${Math.round(waited / 60)} min`);
