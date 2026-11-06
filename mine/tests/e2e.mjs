// End-to-end checks for Ezra's Mine in headless Chromium, using real touch
// input where it matters. Start the server first:
//   PORT=8123 node scripts/serve.mjs &
//   node mine/tests/e2e.mjs [baseUrl] [screenshotDir]
import { launch } from './cdp.mjs';
import fs from 'node:fs';

const BASE = process.argv[2] || 'http://127.0.0.1:8123/mine/';
const SHOTS = process.argv[3] || '/tmp/claude-0/mine-shots';
fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) { passes++; console.log('  ✓', msg); } else { fails++; console.log('  ✗ FAIL:', msg); } };

const p = await launch({ width: 820, height: 1180, touch: true, mobile: true });
const E = (js) => p.eval(js);
const J = async (js) => JSON.parse(await E(`JSON.stringify(${js})`));
const center = (sel) => J(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return {x: r.left + r.width/2, y: r.top + r.height/2}; })()`);
const cell = (i) => J(`__mine.cellCenter(${i})`);
const dismiss = async () => { for (let k = 0; k < 12; k++) { const open = await E(`!document.getElementById('celebrate').classList.contains('hidden')`); if (!open) return; const c = await center('#cel-ok'); await p.tap(c.x, c.y); await p.sleep(120); } };
const setBoard = (arr) => E(`(() => { const g = __mine.game; g.s.board = ${JSON.stringify(arr)}.concat(Array(30).fill(null)).slice(0,30); __mine.renderBoard(); })()`);
const openIdx = () => J(`[...Array(30).keys()].filter(i => __mine.game.isOpen(i))`);

console.log('1. Fresh start');
await p.goto(BASE);
await E('localStorage.clear()');
await p.goto(BASE);
await p.sleep(500);
ok(await E(`!!window.__mine`), 'game boots and exposes __mine');
ok(await E(`getComputedStyle(document.getElementById('error-overlay')).display === 'none'`), 'no error overlay');
const opens = await openIdx();
ok(opens.length === 9, 'starts with 9 open squares (got ' + opens.length + ')');

console.log('2. Tap the mine block (real touch)');
const mine = await center('#mine');
for (let k = 0; k < 12; k++) await p.tap(mine.x, mine.y, 30);
await p.sleep(700);
let st = await J(`__mine.game.s`);
const blocks = st.board.map((c, i) => c && c.t ? i : -1).filter((i) => i >= 0);
ok(blocks.length === 2, `12 taps with a 6-tap pickaxe → 2 blocks (got ${blocks.length})`);
ok(st.stats.taps === 12, 'tap counter = 12');

console.log('3. Drag one block onto its twin (real touch drag)');
const a = await cell(blocks[0]), b = await cell(blocks[1]);
await p.drag(a.x, a.y, b.x, b.y, 14, 16);
await p.sleep(500);
st = await J(`__mine.game.s`);
ok(st.board[blocks[1]] && st.board[blocks[1]].t === 2 && !st.board[blocks[0]], 'merged into Gravel at the target square');
ok(st.seen[2] === 1, 'Gravel discovered');
ok(await E(`!document.getElementById('celebrate').classList.contains('hidden')`), 'NEW BLOCK celebration shown');
await p.shot(SHOTS + '/03-newblock.png');
await dismiss();
ok(await E(`document.getElementById('celebrate').classList.contains('hidden')`), 'celebration dismissed by tapping Yay');

console.log('4. Tap-tap merge');
await setBoard([null, null, null, null, null, null, null, null, null, null, null, null, { t: 2 }, { t: 2 }]);
const opens2 = await openIdx();
await setBoard((() => { const arr = Array(30).fill(null); arr[opens2[0]] = { t: 2 }; arr[opens2[1]] = { t: 2 }; return arr; })());
let c0 = await cell(opens2[0]), c1 = await cell(opens2[1]);
await p.tap(c0.x, c0.y); await p.sleep(150);
ok(await E(`document.querySelectorAll('.cell.match').length === 1`), 'tapping a block makes its twin glow');
await p.tap(c1.x, c1.y); await p.sleep(600);
st = await J(`__mine.game.s`);
ok(st.board[opens2[1]] && st.board[opens2[1]].t === 3, 'tap-tap merged into Stone');
await dismiss();

console.log('5. Chest: drag a block onto the chest, then tap it back');
await setBoard((() => { const arr = Array(30).fill(null); arr[opens2[0]] = { t: 3 }; return arr; })());
c0 = await cell(opens2[0]);
const chest = await J(`__mine.station('chest')`);
await p.drag(c0.x, c0.y, chest.x, chest.y, 16, 16);
await p.sleep(500);
st = await J(`__mine.game.s`);
ok(st.store.b3 === 1 && !st.board[opens2[0]], 'block stored in chest');
await p.tap(chest.x, chest.y); await p.sleep(300);
ok(await E(`document.getElementById('panel-title').textContent`) === 'My Chest', 'chest panel opens');
await p.shot(SHOTS + '/05-chest.png');
const item = await center('#panel-body .item');
await p.tap(item.x, item.y); await p.sleep(300);
st = await J(`__mine.game.s`);
ok(!st.store.b3 && st.board.some((c) => c && c.t === 3), 'tapping it puts it back on the board');
const close = await center('#panel-close');
await p.tap(close.x, close.y); await p.sleep(200);
ok(await E(`document.getElementById('panel').classList.contains('hidden')`), 'panel closes');

console.log('6. Workshop: craft the Stone Pickaxe (uses blocks on the board)');
await E(`(() => { const g = __mine.game; g.s.level = 5; g.s.gold = 1000; g.s.board = Array(30).fill(null); const o = [...Array(30).keys()].filter(i => g.isOpen(i)); g.s.board[o[0]] = {t:3}; g.s.board[o[1]] = {t:3}; g.s.board[o[2]] = {t:1}; __mine.renderBoard(); })()`);
await p.sleep(200);
const ws = await J(`__mine.station('workshop')`);
await p.tap(ws.x, ws.y); await p.sleep(300);
await p.shot(SHOTS + '/06-workshop.png');
const craft = await J(`(() => { const b = [...document.querySelectorAll('#panel-body .buy')].find(b => b.textContent.includes('Craft')); const r = b.getBoundingClientRect(); return {x: r.left + r.width/2, y: r.top + r.height/2, dis: b.classList.contains('off')}; })()`);
ok(!craft.dis, 'Craft button enabled with 2 Stone + 100 gold');
await p.tap(craft.x, craft.y); await p.sleep(300);
st = await J(`__mine.game.s`);
ok(st.pick === 1 && st.gold < 1000 && !st.board.some((c) => c && c.t === 3), `Stone Pickaxe crafted, stones and gold used (pick ${st.pick}, gold ${Math.round(st.gold)})`);
ok(await E(`[...document.querySelectorAll('.cell')].every((e, i) => { const c = __mine.game.s.board[i]; const has = !!e.querySelector('.blk'); return has === !!(c && c.t); })`), 'board drawing matches state after crafting (no ghost blocks)');
await dismiss();
await E(`__mine.closePanel()`);

console.log('7. Furnace: drag a block in, it melts into bricks');
await E(`(() => { const g = __mine.game; const o = [...Array(30).keys()].filter(i => g.isOpen(i)); g.s.board = Array(30).fill(null); g.s.board[o[0]] = {t:7}; g.s.maxTier = 9; g.s.seen = {1:1,2:1,3:1,4:1,5:1,6:1,7:1,8:1,9:1}; __mine.renderBoard(); })()`);
const fo = await openIdx();
c0 = await cell(fo[0]);
const furn = await J(`__mine.station('furnace')`);
await p.drag(c0.x, c0.y, furn.x, furn.y, 16, 16);
await p.sleep(300);
st = await J(`__mine.game.s`);
ok(st.furnace.length === 1 && st.furnace[0].t === 7, 'copper ore is melting');
await E(`__mine.speed(40)`); await p.sleep(600); await E(`__mine.speed(1)`);
st = await J(`__mine.game.s`);
ok(st.furnace.length === 0 && st.store['i:copper'] === 1 && st.bricks >= 3, 'made a copper bar + bricks');

console.log('8. Village: build the Miner\'s Hut');
await E(`__mine.game.s.bricks = 50`);
const vil = await J(`__mine.station('village')`);
await p.tap(vil.x, vil.y); await p.sleep(300);
await p.shot(SHOTS + '/08-village.png');
const bb = await center('#panel-body .row .buy');
await p.tap(bb.x, bb.y); await p.sleep(300);
st = await J(`__mine.game.s`);
ok(st.village.hut === 1 && st.bricks === 40, 'hut built for 10 bricks');
await E(`__mine.closePanel()`);

console.log('9. Quests: collect a finished quest');
const qs = await J(`__mine.station('quests')`);
await p.tap(qs.x, qs.y); await p.sleep(300);
await p.shot(SHOTS + '/09-quests.png');
const before = await J(`Object.keys(__mine.game.s.claimed).length`);
const coll = await J(`(() => { const b = [...document.querySelectorAll('#panel-body .buy')].find(b => b.textContent.includes('Collect')); if (!b) return null; const r = b.getBoundingClientRect(); return {x: r.left + r.width/2, y: r.top + r.height/2}; })()`);
ok(!!coll, 'a Collect button is shown');
if (coll) { await p.tap(coll.x, coll.y); await p.sleep(300); }
ok((await J(`Object.keys(__mine.game.s.claimed).length`)) === before + 1, 'quest reward collected');
await E(`__mine.closePanel()`);

console.log('10. Gold Rush jar');
await E(`__mine.game.s.rush = 25`); await p.sleep(200);
const rush = await center('#btn-rush');
await p.tap(rush.x, rush.y); await p.sleep(200);
ok((await J(`__mine.game.s.boostLeft`)) > 50, 'Gold Rush started (double gold)');

console.log('11. Board full → new blocks go to the chest (never blocked)');
await E(`(() => { const g = __mine.game; g.s.level = 1; g.s.board = Array(30).fill(null); [...Array(30).keys()].filter(i => g.isOpen(i)).forEach((i, k) => g.s.board[i] = {t: 1 + (k % 9)}); g.s.store = {}; g.s.mineHp = 1; g.s.maxTier = 9; __mine.renderBoard(); })()`);
await p.tap(mine.x, mine.y); await p.sleep(500);
st = await J(`__mine.game.s`);
ok(Object.keys(st.store).some((k) => k[0] === 'b'), 'mined block hopped into the chest');

console.log('12. Boom Block: works on small blocks, not on the biggest');
await E(`(() => { const g = __mine.game; g.s.maxTier = 10; g.s.board = Array(30).fill(null); const o = [...Array(30).keys()].filter(i => g.isOpen(i)); g.s.board[o[0]] = {boom:1}; g.s.board[o[1]] = {t:3}; g.s.board[o[2]] = {t:10}; __mine.renderBoard(); })()`);
const bo = await openIdx();
c0 = await cell(bo[0]); c1 = await cell(bo[1]);
const c2 = await cell(bo[2]);
await p.drag(c0.x, c0.y, c2.x, c2.y, 14, 16); await p.sleep(300);
st = await J(`__mine.game.s`);
ok(st.board[bo[2]].t === 10 && st.board[bo[0]] && st.board[bo[0]].boom, 'boom refused on the biggest block');
await p.drag(c0.x, c0.y, c1.x, c1.y, 14, 16); await p.sleep(400);
st = await J(`__mine.game.s`);
ok(st.board[bo[1]].t === 4 && !st.board[bo[0]], 'boom made Stone into Cobblestone');
await dismiss();

console.log('13. Save + reload keeps progress; offline gold on return');
await E(`(() => { const g = __mine.game; g.s.level = 7; g.s.gold = 5000; g.s.board = Array(30).fill(null); const o = [...Array(30).keys()].filter(i => g.isOpen(i)); g.s.board[o[0]] = {t:8}; __mine.save(); const sv = JSON.parse(localStorage.getItem('ezramine.save.v1')); sv.lastSeen = Date.now() - 3600e3; localStorage.setItem('ezramine.save.v1', JSON.stringify(sv)); __mine.noSave(); })()`);
await p.goto(BASE); await p.sleep(600);
st = await J(`__mine.game.s`);
ok(st.level === 7 && st.board.some((c) => c && c.t === 8), 'level and board restored after reload');
ok(st.gold > 5000 + 780 * 0.5 * 3000, `gold earned while away, at half speed (${Math.round(st.gold)})`);
ok(await E(`document.getElementById('cel-title').textContent === 'Welcome back!'`), 'Welcome back card shown');
await p.shot(SHOTS + '/13-welcome.png');
await dismiss();

console.log('14. Grown-ups corner gate');
const gear = await center('#btn-settings');
await p.tap(gear.x, gear.y); await p.sleep(300);
const hold = await center('.gate button');
// a two-finger tap must NOT open it
await p.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: hold.x, y: hold.y, id: 1 }, { x: hold.x + 20, y: hold.y, id: 2 }] });
await p.sleep(100);
await p.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await p.sleep(3300);
ok(await E(`document.querySelector('.gate input') === null && document.querySelector('#panel-body .toggle') === null`), 'two-finger tap does not open the gate');
await p.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: hold.x, y: hold.y, id: 1 }] });
await p.sleep(3300);
await p.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await p.sleep(500);
ok(await E(`document.querySelector('.gate input.sum') !== null`), 'holding 3s asks a sum written in words');
const ans = await E(`(() => { const t = document.querySelector('#panel-body .section').textContent; const w = {four:4,five:5,six:6,seven:7,eight:8,nine:9}; const m = t.match(/(\\w+) plus (\\w+)/); return w[m[1]] + w[m[2]]; })()`);
await E(`(() => { const i = document.querySelector('.gate input.sum'); i.value = '${'${ans}'}'; })()`.replace('${ans}', ans));
const okb = await center('.gate .buy');
await p.tap(okb.x, okb.y); await p.sleep(300);
ok(await E(`document.querySelector('#panel-body .toggle') !== null`), 'right answer opens the grown-ups settings');
await p.shot(SHOTS + '/14-parent.png');
await E(`__mine.closePanel()`);

console.log('15a. Review fixes');
// Boom Block in the chest must not crash the Chest or Furnace panels
await E(`(() => { const g = __mine.game; g.s.level = 8; g.s.maxTier = 9; g.s.board = Array(30).fill(null); const o = [...Array(30).keys()].filter(i => g.isOpen(i)); g.s.board[o[0]] = {boom:1}; g.s.board[o[1]] = {t:2}; g.s.store = {}; g.s.booms = 0; __mine.renderBoard(); })()`);
const ro = await openIdx();
c0 = await cell(ro[0]);
await p.drag(c0.x, c0.y, chest.x, chest.y, 16, 16); await p.sleep(400);
ok((await J(`__mine.game.s.booms`)) === 1, 'Boom Block stored in the chest');
await E(`__mine.openPanel('chest')`); await p.sleep(200);
await E(`__mine.closePanel(); __mine.openPanel('furnace')`); await p.sleep(200);
await E(`__mine.closePanel()`);
ok(await E(`getComputedStyle(document.getElementById('error-overlay')).display === 'none'`), 'chest + furnace panels open fine with a stored Boom Block');
// Furnace refuses your best blocks; Take out works
await E(`(() => { const g = __mine.game; g.s.maxTier = 9; g.s.board = Array(30).fill(null); const o = [...Array(30).keys()].filter(i => g.isOpen(i)); g.s.board[o[0]] = {t:9}; g.s.board[o[1]] = {t:3}; g.s.furnace = []; __mine.renderBoard(); })()`);
c0 = await cell(ro[0]); c1 = await cell(ro[1]);
await p.drag(c0.x, c0.y, furn.x, furn.y, 16, 16); await p.sleep(300);
st = await J(`__mine.game.s`);
ok(st.board[ro[0]] && st.board[ro[0]].t === 9 && st.furnace.length === 0, 'furnace refuses your best block');
await p.drag(c1.x, c1.y, furn.x, furn.y, 16, 16); await p.sleep(300);
ok((await J(`__mine.game.s.furnace.length`)) === 1, 'small block goes into the furnace');
await E(`__mine.openPanel('furnace')`); await p.sleep(500);
const tko = await J(`(() => { const b = [...document.querySelectorAll('#panel-body .buy')].find(b => b.textContent.includes('Take out')); const r = b.getBoundingClientRect(); return {x: r.left + r.width/2, y: r.top + r.height/2}; })()`);
await p.tap(tko.x, tko.y); await p.sleep(300);
st = await J(`__mine.game.s`);
ok(st.furnace.length === 0 && st.board.some((c) => c && c.t === 3), 'Take out puts the block back on the board');
await E(`__mine.closePanel()`);
// double-tap on a station leaves the panel open
await p.sleep(500);
const wsb = await J(`__mine.station('workshop')`);
await p.tap(wsb.x, wsb.y, 40); await p.sleep(80); await p.tap(wsb.x, wsb.y, 40); await p.sleep(400);
ok(await E(`!document.getElementById('panel').classList.contains('hidden')`), 'double-tapping a station keeps its panel open');
// a grey button still answers
const grey = await J(`(() => { const b = document.querySelector('#panel-body .buy.off'); if (!b) return null; const r = b.getBoundingClientRect(); return {x: r.left + r.width/2, y: r.top + r.height/2}; })()`);
if (grey) { await p.tap(grey.x, grey.y); await p.sleep(200); ok(await E(`document.getElementById('toast').classList.contains('show')`), 'tapping a grey button explains why'); }
await E(`__mine.closePanel()`);

console.log('15c. Pretend store + game card');
await E(`(() => { __mine.dismiss(); __mine.closePanel(); const g = __mine.game, s = g.s; s.gems = 1; s.purchases = []; s.cardSpent = 0; s.iap = {}; s.settings.cardLimit = 0; s.settings.energy = true; s.energy = 30; })()`);
await p.sleep(300);
const typeCard = async (num) => { for (const d of num) { const k = await J(`(() => { const b = [...document.querySelectorAll('#co-pad button')].find(b => b.textContent === '${d}'); const r = b.getBoundingClientRect(); return {x: r.left + r.width/2, y: r.top + r.height/2}; })()`); await p.tap(k.x, k.y, 15); } };
await p.sleep(200);
const gp = await center('#pill-gems');
await p.tap(gp.x, gp.y); await p.sleep(400);
ok(await E(`document.getElementById('panel-title').textContent === 'Gem Store'`), 'tapping the gems + opens the Gem Store');
let pr = await center('#panel-body .row .price');
await p.tap(pr.x, pr.y); await p.sleep(400);
ok(await E(`!document.getElementById('checkout').classList.contains('hidden')`), 'tapping a price opens checkout');
await typeCard('4111');
await p.sleep(200);
ok((await J(`__mine.game.s.gems`)) === 1 && (await E(`document.getElementById('co-msg').textContent`)).includes('not your game card'), 'a real-looking card is caught after 4 numbers (no gems)');
ok((await J(`__mine.checkout().digits`)) === 0, 'the wrong numbers are wiped');
let buy = await center('#co-buy');
await typeCard('0000000012345678');
await p.tap(buy.x, buy.y); await p.sleep(400);
ok(await E(`document.getElementById('checkout').classList.contains('busy')`), 'shows Processing…');
await p.sleep(1800);
ok((await J(`__mine.game.s.gems`)) === 21, 'a 0000 game card buys 20 gems');
const hist = await J(`__mine.game.s.purchases`);
ok(hist.length === 1 && hist[0].last4 === '5678' && !JSON.stringify(await J('__mine.game.s')).includes('000000001234'), 'only the last 4 digits are kept');
await p.sleep(1400);
ok(await E(`document.getElementById('checkout').classList.contains('hidden')`), 'checkout closes after the purchase');
ok((await E(`document.getElementById('co-digits').textContent`)) === '', 'no card number left on the page after closing');
// card limit
await E(`(() => { __mine.game.s.settings.cardLimit = 10; __mine.game.s.cardSpent = 9.5; })()`);
await E(`__mine.openCheckout('gems20')`); await p.sleep(450);
await typeCard('0000111122223333');
buy = await center('#co-buy');
await p.tap(buy.x, buy.y); await p.sleep(300);
ok((await E(`document.getElementById('co-msg').textContent`)).includes('not enough money'), 'the grown-ups card limit declines politely');
await E(`(() => { const c = document.getElementById('co-close'); c.click(); __mine.game.s.settings.cardLimit = 0; })()`);
await E(`__mine.closePanel()`); await p.sleep(200);
// out of energy -> refill through checkout
await E(`(() => { __mine.dismiss(); __mine.game.s.energy = 0; __mine.game.s.mineHp = 3; })()`); await p.sleep(200);
await p.tap(mine.x, mine.y); await p.sleep(600);
ok(await E(`document.getElementById('cel-title').textContent === 'OUT OF ENERGY!'`), 'out of energy shows the refill prompt');
ok((await J(`__mine.game.s.mineHp`)) === 3, 'a tap with no energy does nothing to the block');
await p.sleep(450);
const refill = await center('#cel-ok');
await p.tap(refill.x, refill.y); await p.sleep(500);
ok(await E(`!document.getElementById('checkout').classList.contains('hidden')`), 'Refill opens checkout');
await typeCard('0000000000000001');
buy = await center('#co-buy');
await p.tap(buy.x, buy.y); await p.sleep(2200);
ok((await J(`__mine.game.s.energy`)) >= 60, 'energy refilled after the pretend purchase');
await p.sleep(1300);
// refill refused when energy is already full
await E(`__mine.openCheckout('energy')`); await p.sleep(300);
ok(await E(`document.getElementById('checkout').classList.contains('hidden')`), 'no refill checkout when energy is already full');
// Esc on the out-of-energy card just closes it (never opens checkout)
await E(`(() => { __mine.dismiss(); __mine.game.s.energy = 0; })()`); await p.sleep(1700);
await p.tap(mine.x, mine.y); await p.sleep(500);
await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
await p.sleep(300);
ok(await E(`document.getElementById('checkout').classList.contains('hidden') && document.getElementById('cel-title').textContent === 'OUT OF ENERGY!'`), 'Space does not press Refill on the energy card');
await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await p.sleep(300);
ok(await E(`document.getElementById('checkout').classList.contains('hidden') && document.getElementById('celebrate').classList.contains('hidden')`), 'Esc closes the energy card without opening checkout');
// Digby digs for free: a minute of helper work leaves energy alone
await E(`(() => { const g = __mine.game; g.s.energy = 5; g.s.energyT = 0; g.s.up.helper = 12; g.s.board = Array(30).fill(null); __mine.renderBoard(); for (let k = 0; k < 600; k++) g.tick(0.1); })()`);
ok((await J(`__mine.game.s.energy`)) >= 5 && (await J(`__mine.game.s.stats.mined`)) > 0, 'Digby the mole does not use up energy');
await E(`(() => { __mine.game.s.up.helper = 0; __mine.dismiss(); })()`);
// pass, unlimited, mystery chest (rules only)
await E(`(() => { const g = __mine.game; g.grant('pass', '0001', Date.now()); g.grant('unlimited', '0001', Date.now()); g.grant('mystery', '0001', Date.now()); __mine.dismiss(); })()`);
await p.sleep(300);
ok(await E(`document.getElementById('btn-pass').classList.contains('owned')`), 'Super Miner Pass shows the gold badge');
ok(!(await E(`__mine.game.energyOn()`)) && (await E(`document.getElementById('energy-num').textContent`)) === '∞', 'Unlimited Energy shows ∞');
ok((await J(`__mine.game.s.purchases.length`)) === 5, 'purchase history has every pretend purchase');
await E(`__mine.openPanel('parent')`); await p.sleep(200);
await E(`__mine.closePanel()`);

console.log('15d. Start over keeps the grown-ups settings');
await E(`(() => { __mine.noSave(); localStorage.removeItem('ezramine.save.v1'); localStorage.setItem('ezramine.save.v1.keep', JSON.stringify({ settings: { sound: true, speak: true, nums: true, rest: 30, energy: false, cardLimit: 25 }, cardSpent: 3.5, purchases: [{ id: 'gems20', name: 'Handful of Gems', price: 0.99, t: 1, last4: '1111' }] })); })()`);
await p.goto(BASE); await p.sleep(600);
st = await J(`__mine.game.s`);
ok(st.level === 1 && st.settings.cardLimit === 25 && st.settings.energy === false && st.purchases.length === 1 && !(await E(`localStorage.getItem('ezramine.save.v1.keep')`)), 'a fresh game keeps the card limit, energy setting and history');
await E(`__mine.dismiss()`);

console.log('15. Every panel renders');
for (const id of ['workshop', 'furnace', 'shop', 'village', 'quests', 'book', 'chest', 'store']) {
  await E(`__mine.openPanel('${id}')`); await p.sleep(150);
  ok(await E(`document.getElementById('panel-body').children.length > 0`), `${id} panel has content`);
  await p.shot(`${SHOTS}/15-${id}.png`);
  await E(`__mine.closePanel()`);
}

console.log('15b. Break reminder ignores the keyboard; narrow window keeps the board on screen');
await E(`(() => { __mine.dismiss(); __mine.game.s.settings.rest = 0.02; })()`);
await p.sleep(2500);
ok(await E(`document.getElementById('cel-title').textContent === 'Great mining today!'`), 'break reminder appears');
await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
await p.sleep(300);
ok(await E(`!document.getElementById('celebrate').classList.contains('hidden') && document.getElementById('cel-title').textContent === 'Great mining today!'`), 'Space does not dismiss the break card');
await E(`(() => { __mine.game.s.settings.rest = 30; __mine.dismiss(); })()`);
await p.viewport(320, 1180);
await E(`window.dispatchEvent(new Event('resize'))`); await p.sleep(400);
ok(await E(`(() => { const b = document.getElementById('board').getBoundingClientRect(); return b.right <= innerWidth + 1 && b.left >= -1; })()`), 'board fits after the window gets narrow');
await p.viewport(820, 1180);
await E(`window.dispatchEvent(new Event('resize'))`); await p.sleep(300);

const errs = p.logs.filter((l) => /EXCEPTION|error/i.test(l) && !/favicon/.test(l));
ok(errs.length === 0, 'no console errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
await p.close();

console.log('\n16. Layout on many screens');
const SIZES = [[768, 1024, 'ipad-mini-p'], [820, 1180, 'ipad-air-p'], [1024, 1366, 'ipad-pro-p'], [1180, 820, 'ipad-air-l'], [1366, 1024, 'ipad-pro-l'], [1280, 720, 'laptop', false], [1440, 900, 'laptop-big', false], [390, 844, 'phone-p'], [844, 390, 'phone-l']];
for (const [w, h, name, touch = true] of SIZES) {
  const q = await launch({ width: w, height: h, touch, mobile: touch });
  await q.goto(BASE);
  await q.eval(`(() => { const g = __mine.game; g.s.level = 30; g.s.maxTier = 12; g.s.board = Array(30).fill(null).map((_, i) => ({t: 1 + (i % 12)})); __mine.layout(); __mine.renderBoard(); __mine.dismiss(); })()`);
  await q.sleep(300);
  const L = JSON.parse(await q.eval(`JSON.stringify((() => {
    const R = (e) => e.getBoundingClientRect();
    const vw = innerWidth, vh = innerHeight;
    const inView = (r) => r.left >= -1 && r.top >= -1 && r.right <= vw + 1 && r.bottom <= vh + 1;
    const board = R(document.getElementById('board'));
    const items = [...document.querySelectorAll('.station'), document.getElementById('mine'), document.getElementById('hud'), ...document.querySelectorAll('.pill'), document.getElementById('btn-rush')];
    const out = items.filter(e => !inView(R(e))).map(e => e.id || e.className);
    const overlap = [...document.querySelectorAll('.station'), document.getElementById('mine')].filter(e => { const r = R(e); return !(r.right <= board.left || r.left >= board.right || r.bottom <= board.top || r.top >= board.bottom); }).map(e => e.dataset.id || e.id);
    const cell = R(document.querySelector('.cell')).width;
    return { out, overlap, cell, boardIn: inView(board), hudOverBoard: R(document.getElementById('hud')).bottom > board.top + 2 };
  })())`));
  ok(L.out.length === 0, `${name}: everything on screen` + (L.out.length ? ' (off: ' + L.out.join(',') + ')' : ''));
  ok(L.overlap.length === 0, `${name}: dock doesn't cover the board` + (L.overlap.length ? ' (' + L.overlap.join(',') + ')' : ''));
  ok(L.cell >= 44, `${name}: squares are finger-sized (${L.cell}px)`);
  ok(L.boardIn && !L.hudOverBoard, `${name}: board fully visible`);
  await q.shot(`${SHOTS}/16-${name}.png`);
  await q.close();
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
