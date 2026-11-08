// All of Ezra's Mine's content and numbers in one place: the block ladder,
// crafting recipes, gear, monsters, quests, village, boosters and the pretend
// store. Tweak balance here. (v2: plays like the merge-craft-fight mining
// games Ezra loves — chests from the mine, a 3x3 workbench, gear slots,
// friendly monsters — with our own names, art and wording.)

// --- The block ladder ------------------------------------------------------
// Two of the same block merge into the next one. Early blocks are crafting
// materials and earn nothing; from Coal up, blocks on the board earn gold
// every second (gps), ~2.7x more each step.
export const TIERS = [
  null, // tiers are 1-based
  { name: 'Dirt', art: 'dirt', gps: 0 },
  { name: 'Log', art: 'log', gps: 0 },
  { name: 'Cobblestone', art: 'cobble', gps: 0 },
  { name: 'Coal', art: 'coal', gps: 5 },
  { name: 'Copper Ore', art: 'copper', gps: 15 },
  { name: 'Iron Ore', art: 'iron', gps: 40 },
  { name: 'Gold Ore', art: 'gold_ore', gps: 110 },
  { name: 'Ruby Ore', art: 'ruby', gps: 300 },
  { name: 'Sapphire Ore', art: 'sapphire', gps: 800 },
  { name: 'Emerald Ore', art: 'emerald', gps: 2200 },
  { name: 'Amethyst', art: 'amethyst', gps: 6000 },
  { name: 'Diamond Ore', art: 'diamond_ore', gps: 16000 },
  { name: 'Gold Block', art: 'gold_block', gps: 44000 },
  { name: 'Diamond Block', art: 'diamond_block', gps: 120000 },
  { name: 'Sunstone', art: 'glow', gps: 320000 },
  { name: 'Obsidian', art: 'obsidian', gps: 870000 },
  { name: 'Rainbow Block', art: 'rainbow', gps: 2.4e6 },
  { name: 'Star Block', art: 'star', gps: 6.4e6 },
];
export const MAX_TIER = TIERS.length - 1;
export const T = { DIRT: 1, LOG: 2, COBBLE: 3, COAL: 4, COPPER: 5, IRON: 6, GOLD: 7, RUBY: 8, SAPPHIRE: 9, EMERALD: 10, AMETHYST: 11, DIAMOND: 12 };

// A block's "value" in coins (for the block shop and achievement rewards).
export function blockValue(t) { return Math.round(250 * Math.pow(2.2, t - 1)); }

// --- Caves: the backdrop changes as you discover deeper blocks --------------
export const CAVES = [
  { name: 'Dirt Den', from: 1, wall: 'dirt', glow: 'linear-gradient(to top, rgba(120,200,90,.25), rgba(0,0,0,0) 45%)', dim: 0.42 },
  { name: 'Woodland Hollow', from: 2, wall: 'log', glow: 'linear-gradient(to top, rgba(160,220,120,.22), rgba(0,0,0,0) 45%)', dim: 0.45 },
  { name: 'Stony Hollow', from: 3, wall: 'stone', glow: 'linear-gradient(to top, rgba(120,170,255,.22), rgba(0,0,0,0) 45%)', dim: 0.38 },
  { name: 'Ore Tunnels', from: 5, wall: 'cobble', glow: 'linear-gradient(to top, rgba(255,170,60,.28), rgba(0,0,0,0) 45%)', dim: 0.36 },
  { name: 'Gem Grotto', from: 8, wall: 'amethyst', glow: 'linear-gradient(to top, rgba(200,120,255,.3), rgba(0,0,0,0) 45%)', dim: 0.32 },
  { name: 'Lava Cavern', from: 12, wall: 'obsidian', glow: 'linear-gradient(to top, rgba(255,90,30,.45), rgba(0,0,0,0) 50%)', dim: 0.55 },
  { name: 'Star Cave', from: 16, wall: 'star', glow: 'linear-gradient(to top, rgba(120,140,255,.4), rgba(0,0,0,0) 50%)', dim: 0.45 },
];
export function caveFor(maxTier) {
  let c = CAVES[0];
  for (const cv of CAVES) if (maxTier >= cv.from) c = cv;
  return c;
}

// --- Board -----------------------------------------------------------------
// Starts tiny (3x2) and grows with levels up to 4x5.
export const COLS = 4, ROWS = 5;
export const START_CELLS = 6;
export function openCells(level) { return Math.min(COLS * ROWS, START_CELLS + (level - 1)); }

// --- Levels ----------------------------------------------------------------
// 40 points for level 1 … 635 for level 10.
export function xpNeeded(level) { return Math.round(40 * Math.pow(level, 1.2)); }
export const MERGE_XP = 2;
export function levelReward(level) { return 1000 * level; }

// --- Materials & gear ------------------------------------------------------
// Inventory keys: 'b<tier>' = a block, 'm:<id>' = a material, 'g:<id>' = gear.
export const MATERIALS = {
  planks: { name: 'Planks' },
  stick: { name: 'Stick' },
  string: { name: 'String' },
  iron: { name: 'Iron Bar' },
  gold: { name: 'Gold Bar' },
  diamond: { name: 'Diamond' },
  tnt: { name: 'TNT' },
};
export const MATS = ['wood', 'stone', 'iron', 'gold', 'diamond'];
export const MAT_NAME = { wood: 'Wooden', stone: 'Stone', iron: 'Iron', gold: 'Gold', diamond: 'Diamond' };

// Equipment slots on the hero screen.
export const SLOTS = ['helmet', 'chest', 'legs', 'boots', 'sword', 'pick', 'bow', 'orb'];
export const SLOT_NAME = { helmet: 'Helmet', chest: 'Chestplate', legs: 'Leggings', boots: 'Boots', sword: 'Sword', pick: 'Pickaxe', bow: 'Bow', orb: 'Magic Orb' };

// Swords: attack. Pickaxes: taps per block + how much bigger new blocks come.
export const SWORD_ATK = { none: 3, wood: 5, stone: 7, iron: 10, gold: 14, diamond: 20 };
export const PICK_TAPS = { none: 10, wood: 9, stone: 8, iron: 6, gold: 5, diamond: 4 };
export const PICK_DROP = { none: 0, wood: 0, stone: 0, iron: 1, gold: 1, diamond: 2 };
// Armor points per piece (iron x1, gold x2, diamond x3). Armor = more energy.
const ARMOR_BASE = { helmet: 1, chest: 3, legs: 2, boots: 1 };
const ARMOR_MULT = { iron: 1, gold: 2, diamond: 3 };
export function armorPoints(piece, mat) { return (ARMOR_BASE[piece] || 0) * (ARMOR_MULT[mat] || 0); }
export const BOW_ATK = 3;
export const ORB_GOLD = 1.25;

// Every gear item: id -> { slot, mat }.
export const GEAR = {};
for (const m of MATS) { GEAR[m + '_sword'] = { slot: 'sword', mat: m }; GEAR[m + '_pick'] = { slot: 'pick', mat: m }; }
for (const m of ['iron', 'gold', 'diamond']) for (const p of ['helmet', 'chest', 'legs', 'boots']) GEAR[m + '_' + p] = { slot: p, mat: m };
GEAR.bow = { slot: 'bow' };
GEAR.orb = { slot: 'orb' };
export function gearName(id) {
  const g = GEAR[id];
  if (!g) return id;
  if (id === 'bow') return 'Bow';
  if (id === 'orb') return 'Magic Orb';
  return `${MAT_NAME[g.mat]} ${SLOT_NAME[g.slot]}`;
}

// --- Workbench recipes (3x3) -----------------------------------------------
// Patterns are rows of letters; the pattern can sit anywhere in the grid.
// `key` maps letters to inventory keys. `out` is what you get.
const MAT_KEY = { wood: 'm:planks', stone: 'b3', iron: 'm:iron', gold: 'm:gold', diamond: 'm:diamond' };
export const RECIPES = [
  { id: 'planks', name: 'Planks', pattern: ['L'], key: { L: 'b2' }, out: 'm:planks', n: 4 },
  { id: 'stick', name: 'Stick', pattern: ['P', 'P'], key: { P: 'm:planks' }, out: 'm:stick', n: 1 },
];
for (const m of MATS) {
  RECIPES.push({ id: m + '_sword', name: gearName(m + '_sword'), pattern: ['M', 'M', 'S'], key: { M: MAT_KEY[m], S: 'm:stick' }, out: 'g:' + m + '_sword', n: 1 });
  RECIPES.push({ id: m + '_pick', name: gearName(m + '_pick'), pattern: ['MMM', ' S ', ' S '], key: { M: MAT_KEY[m], S: 'm:stick' }, out: 'g:' + m + '_pick', n: 1 });
}
for (const m of ['iron', 'gold', 'diamond']) {
  const K = { M: MAT_KEY[m] };
  RECIPES.push({ id: m + '_helmet', name: gearName(m + '_helmet'), pattern: ['MMM', 'M M'], key: K, out: 'g:' + m + '_helmet', n: 1 });
  RECIPES.push({ id: m + '_chest', name: gearName(m + '_chest'), pattern: ['M M', 'MMM', 'MMM'], key: K, out: 'g:' + m + '_chest', n: 1 });
  RECIPES.push({ id: m + '_legs', name: gearName(m + '_legs'), pattern: ['MMM', 'M M', 'M M'], key: K, out: 'g:' + m + '_legs', n: 1 });
  RECIPES.push({ id: m + '_boots', name: gearName(m + '_boots'), pattern: ['M M', 'M M'], key: K, out: 'g:' + m + '_boots', n: 1 });
}
RECIPES.push({ id: 'bow', name: 'Bow', pattern: [' SX', 'S X', ' SX'], key: { S: 'm:stick', X: 'm:string' }, out: 'g:bow', n: 1 });
RECIPES.push({ id: 'orb', name: 'Magic Orb', pattern: [' G ', 'GAG', ' G '], key: { G: 'm:gold', A: 'b11' }, out: 'g:orb', n: 1 });

// --- Furnace: ore + 1 Coal -> a bar --------------------------------------------
export const SMELT = {
  6: { out: 'm:iron', secs: 6 },
  7: { out: 'm:gold', secs: 8 },
  12: { out: 'm:diamond', secs: 12 },
};
export const FUEL_TIER = 4; // Coal

// --- Monsters (they never attack; tap them to chase them off) ----------------
export const MONSTERS = {
  gloop: { name: 'Gloop', hp: 30, coins: 1000, xp: 4, unlock: 1 },
  grumble: { name: 'Grumble', hp: 50, coins: 3000, xp: 6, unlock: 1 },
  webby: { name: 'Webby', hp: 80, coins: 4000, xp: 8, unlock: 3 },
  rocky: { name: 'Rocky', hp: 160, coins: 8000, xp: 12, unlock: 6 },
  magma: { name: 'Magma Max', hp: 400, coins: 20000, xp: 25, unlock: 10 },
  // The spooky visitor: never random — it only comes after its knock-knock warning.
  grinner: { name: 'the Grinner', hp: 350, coins: 30000, xp: 30, unlock: 999, boss: true },
};
// TNT: one tap blows up this many blocks at once (no energy), or blasts a monster.
export const TNT_BLOCKS = 6;
export const TNT_MONSTER = 0.5; // ...for half its health (at least 8 hits' worth)
// The Grinner: first knocks after ~8 min of play (level 3+), then every ~18 min.
// After the warning it comes into the mine; chase it off in time or it floats away.
export const GRINNER = { firstAfter: 8 * 60, every: 18 * 60, warnSecs: 120, staySecs: 180, minLevel: 3 };
export function monsterHp(id, level) { return Math.round(MONSTERS[id].hp * (1 + 0.25 * (level - 1))); }
export function monsterCoins(id, level) { return Math.round(MONSTERS[id].coins * (1 + 0.35 * (level - 1))); }
// A monster wanders into the mine every so many broken blocks.
export const MONSTER_EVERY = [12, 18];

// --- Boosters (bought with coins in the Shop) --------------------------------
export const BOOSTERS = {
  damage: { name: 'Damage x2', desc: 'Hit monsters twice as hard', secs: 180 },
  gold: { name: 'Gold x2', desc: 'Double gold from your blocks', secs: 180 },
  block: { name: 'Block level +2', desc: 'New blocks come out 2 steps bigger', secs: 180 },
};
export function boosterPrice(gps, level) { return Math.max(1000, Math.round((gps * 120 + 800 * level) / 100) * 100); }

// --- Village (opens after 29 merges; bricks come from merging) ---------------
export const VILLAGE_MERGES = 29;
export const DROP_GAP = 3;
// The Mine Shaft makes new blocks bigger; each level needs a deeper best block.
export function shaftNeed(k) { return 2 * k + 6; }
export const BUILDINGS = [
  { id: 'shaft', name: 'Mine Shaft', desc: 'New blocks come out one step bigger', roof: 0x5a5a66, wall: 0x9c7142,
    cost: (lv) => Math.round(30 * Math.pow(2.3, lv)), max: 6 },
  { id: 'hut', name: "Miner's Hut", desc: 'All blocks make +10% gold', roof: 0xe0403a, wall: 0xc99a5b,
    cost: (lv) => Math.round(20 * Math.pow(2.0, lv)), max: 10 },
  { id: 'forge', name: 'Blacksmith', desc: 'The furnace works faster', roof: 0x3a3a42, wall: 0x8f8f97,
    cost: (lv) => Math.round(25 * Math.pow(2.2, lv)), max: 5 },
  { id: 'well', name: 'Wishing Well', desc: 'Merging finds emeralds more often', roof: 0x4a8ff0, wall: 0xb9b9c2,
    cost: (lv) => Math.round(30 * Math.pow(2.3, lv)), max: 8 },
  { id: 'bakery', name: 'Bakery', desc: 'Energy comes back faster', roof: 0xf2913a, wall: 0xf3eee6,
    cost: (lv) => Math.round(25 * Math.pow(2.2, lv)), max: 6 },
  { id: 'yard', name: 'Training Yard', desc: '+2 attack against monsters', roof: 0x4fbf4a, wall: 0xb27a45,
    cost: (lv) => Math.round(40 * Math.pow(2.4, lv)), max: 5 },
  { id: 'castle', name: 'Castle', desc: 'Everything makes +25% gold', roof: 0xffd23f, wall: 0xd9d4dc,
    cost: (lv) => Math.round(300 * Math.pow(2.8, lv)), max: 5, unlock: 12 },
];
export function wellEvery(lv) { return lv <= 0 ? 0 : Math.max(20, 70 - lv * 6); }

// --- Treasure chests (golden, every couple of minutes of play) ---------------
export function treasureEvery() { return 120; }

// --- Quests: three tabs ------------------------------------------------------
// Tasks are done in order (three shown at a time). `metric` is a counter.
export const TASKS = [
  { text: 'Tap the big block', metric: 'taps', n: 5, reward: { gold: 1000 } },
  { text: 'Open a chest', metric: 'opened', n: 1, reward: { gold: 1000 } },
  { text: 'Merge two blocks', metric: 'merges', n: 1, reward: { gold: 1000 } },
  { text: 'Make a Log', metric: 'tier', n: 2, reward: { gold: 1000 } },
  { text: 'Craft Planks', metric: 'craft:planks', n: 1, reward: { gold: 1000 } },
  { text: 'Craft a Stick', metric: 'craft:stick', n: 1, reward: { gold: 1000 } },
  { text: 'Craft a Wooden Sword', metric: 'craft:wood_sword', n: 1, reward: { gold: 2000 } },
  { text: 'Put on a sword', metric: 'equip:sword', n: 1, reward: { gold: 1000 } },
  { text: 'Chase off a monster', metric: 'kills', n: 1, reward: { gold: 2000 } },
  { text: 'Put on a pickaxe', metric: 'equip:pick', n: 1, reward: { gold: 1000 } },
  { text: 'Make Cobblestone', metric: 'tier', n: 3, reward: { gold: 2000, bricks: 5 } },
  { text: 'Craft a Wooden Pickaxe', metric: 'craft:wood_pick', n: 1, reward: { gold: 2000 } },
  { text: 'Reach level 3', metric: 'level', n: 3, reward: { gems: 1 } },
  { text: 'Make Coal', metric: 'tier', n: 4, reward: { gold: 3000 } },
  { text: 'Merge 29 times', metric: 'merges', n: 29, reward: { gems: 3 } },
  { text: 'Build in the village', metric: 'builds', n: 1, reward: { gold: 3000 } },
  { text: 'Chase off 5 monsters', metric: 'kills', n: 5, reward: { gold: 5000 } },
  { text: 'Craft a Stone Sword', metric: 'craft:stone_sword', n: 1, reward: { gold: 3000 } },
  { text: 'Make Iron Ore', metric: 'tier', n: 6, reward: { gold: 5000 } },
  { text: 'Melt an Iron Bar', metric: 'smelts', n: 1, reward: { gold: 5000 } },
  { text: 'Craft an Iron Pickaxe', metric: 'craft:iron_pick', n: 1, reward: { gold: 10000 } },
  { text: 'Reach level 6', metric: 'level', n: 6, reward: { gems: 2 } },
  { text: 'Make Gold Ore', metric: 'tier', n: 7, reward: { gold: 10000 } },
  { text: 'Craft iron armor', metric: 'armorCrafted', n: 1, reward: { gold: 10000 } },
  { text: 'Wear 4 pieces of armor', metric: 'armorWorn', n: 4, reward: { gold: 20000 } },
  { text: 'Make Ruby Ore', metric: 'tier', n: 8, reward: { gold: 20000 } },
  { text: 'Craft a Bow', metric: 'craft:bow', n: 1, reward: { gold: 20000 } },
  { text: 'Reach level 10', metric: 'level', n: 10, reward: { gems: 3 } },
  { text: 'Make Emerald Ore', metric: 'tier', n: 10, reward: { gold: 50000 } },
  { text: 'Craft a Gold Sword', metric: 'craft:gold_sword', n: 1, reward: { gold: 50000 } },
  { text: 'Make Amethyst', metric: 'tier', n: 11, reward: { gold: 100000 } },
  { text: 'Craft a Magic Orb', metric: 'craft:orb', n: 1, reward: { gold: 100000 } },
  { text: 'Make Diamond Ore', metric: 'tier', n: 12, reward: { gold: 200000 } },
  { text: 'Craft a Diamond Pickaxe', metric: 'craft:diamond_pick', n: 1, reward: { gold: 500000 } },
  { text: 'Make a Gold Block', metric: 'tier', n: 13, reward: { gold: 1e6 } },
  { text: 'Make a Diamond Block', metric: 'tier', n: 14, reward: { gold: 3e6 } },
  { text: 'Reach level 20', metric: 'level', n: 20, reward: { gems: 5 } },
  { text: 'Make Sunstone', metric: 'tier', n: 15, reward: { gold: 1e7 } },
  { text: 'Make Obsidian', metric: 'tier', n: 16, reward: { gold: 3e7 } },
  { text: 'Make a Rainbow Block', metric: 'tier', n: 17, reward: { gold: 1e8 } },
  { text: 'Make the Star Block!', metric: 'tier', n: 18, reward: { gems: 10 } },
];
// Achievements: reach every block, plus a few milestones.
export const ACHIEVEMENTS = [];
for (let t = 2; t <= MAX_TIER; t++) ACHIEVEMENTS.push({ id: 'tier' + t, text: `Reach ${TIERS[t].name}`, metric: 'tier', n: t, reward: { gold: Math.max(1000, blockValue(t) * 2) }, art: t });
for (const [n, g] of [[10, 2000], [50, 5000], [200, 20000], [1000, 100000]]) ACHIEVEMENTS.push({ id: 'merge' + n, text: `Merge ${n} times`, metric: 'merges', n, reward: { gold: g } });
for (const [n, g] of [[5, 3000], [25, 15000], [100, 60000]]) ACHIEVEMENTS.push({ id: 'craft' + n, text: `Craft ${n} things`, metric: 'crafts', n, reward: { gold: g } });
for (const [n, g] of [[25, 3000], [100, 15000], [500, 80000]]) ACHIEVEMENTS.push({ id: 'chest' + n, text: `Open ${n} chests`, metric: 'opened', n, reward: { gold: g } });
// Monster Hunt.
export const HUNT = [
  { text: 'First monster', metric: 'kills', n: 1, reward: { gold: 2000 } },
  { text: 'Chase off 5 monsters', metric: 'kills', n: 5, reward: { gold: 5000 } },
  { text: 'Chase off 15 monsters', metric: 'kills', n: 15, reward: { gold: 15000, gems: 1 } },
  { text: 'Chase off 30 monsters', metric: 'kills', n: 30, reward: { gold: 40000 } },
  { text: 'Chase off 60 monsters', metric: 'kills', n: 60, reward: { gold: 100000, gems: 2 } },
  { text: 'Chase off 100 monsters', metric: 'kills', n: 100, reward: { gold: 250000 } },
  { text: 'Chase off 200 monsters', metric: 'kills', n: 200, reward: { gold: 1e6, gems: 5 } },
  { text: 'Meet Webby', metric: 'kill:webby', n: 1, reward: { gold: 5000 } },
  { text: 'Meet Rocky', metric: 'kill:rocky', n: 1, reward: { gold: 15000 } },
  { text: 'Beat Magma Max', metric: 'kill:magma', n: 1, reward: { gold: 50000, gems: 3 } },
  { text: 'Chase off the Grinner', metric: 'kill:grinner', n: 1, reward: { gold: 60000, gems: 5 } },
];

// Offline earnings: blocks keep earning (half speed) while away, up to 12 h.
export const OFFLINE_RATE = 0.5;
export function offlineCapSecs() { return 12 * 3600; }

// --- Hero skins (looks only, bought with emeralds) ---------------------------
export const SKINS = [
  { id: 'classic', name: 'Classic', gems: 0 },
  { id: 'explorer', name: 'Explorer', gems: 10 },
  { id: 'ninja', name: 'Ninja', gems: 25 },
  { id: 'royal', name: 'Royal', gems: 50 },
];

// --- Pretend store ----------------------------------------------------------
// Everything here is make-believe: prices are shown in pretend dollars and the
// checkout only accepts a toy "game card" whose number starts with 0000.
// Nothing is ever charged, saved or sent anywhere.
export const CARD_PREFIX = '0000';
export const CARD_DIGITS = 16;

// Energy: every block you break uses 1. It refills by itself over time
// (grown-ups can switch it off). Armor adds to the maximum.
export const ENERGY = { max: 60, regenSecs: 12, passMax: 90, passRegenSecs: 8, gemRefill: 5, perArmor: 2 };

export const STORE_TABS = [
  { id: 'gems', name: 'Emeralds' },
  { id: 'craft', name: '💎 Crafting' },
  { id: 'energy', name: 'Energy' },
  { id: 'boost', name: 'Boosts' },
  { id: 'chests', name: 'Chests' },
  { id: 'pass', name: 'Pass' },
];
export const STORE = [
  { id: 'gems20', tab: 'gems', name: 'Handful of Emeralds', gems: 20, price: 0.99 },
  { id: 'gems120', tab: 'gems', name: 'Bag of Emeralds', gems: 120, price: 4.99, tag: 'POPULAR' },
  { id: 'gems300', tab: 'gems', name: 'Chest of Emeralds', gems: 300, price: 9.99, tag: 'BEST VALUE' },
  { id: 'gems800', tab: 'gems', name: 'Mountain of Emeralds', gems: 800, price: 19.99, tag: 'MEGA' },
  { id: 'bricks200', tab: 'gems', name: 'Pile of Bricks', bricks: 200, price: 1.99 },
  { id: 'energy', tab: 'energy', name: 'Energy Refill', refill: true, price: 0.99 },
  { id: 'unlimited', tab: 'energy', name: 'Unlimited Energy', unlimited: true, price: 9.99, once: true, tag: 'FOREVER' },
  { id: 'rush5', tab: 'boost', name: 'Gold x2', rush: 300, price: 0.99 },
  { id: 'rush30', tab: 'boost', name: 'Mega Gold x2', rush: 1800, price: 2.99, tag: '30 MIN' },
  { id: 'mystery', tab: 'chests', name: 'Mystery Chest', chest: 'small', price: 0.99 },
  { id: 'mega', tab: 'chests', name: 'Mega Chest', chest: 'mega', price: 4.99, tag: 'RARE' },
  { id: 'pass', tab: 'pass', name: 'Super Miner Pass', pass: true, price: 4.99, once: true },
];
export function storeItem(id) { return STORE.find((x) => x.id === id); }

// --- Premium Shop "💎 Crafting" tab: material packs bought with EMERALDS -----
// (Like the genre game: diamonds come in a ×5 card, plus bars and a big chest.)
export const CRAFT_PACKS = [
  { id: 'craftsman', name: 'Craftsman Chest', gems: 40, big: true,
    items: { 'm:diamond': 3, 'm:gold': 3, 'm:iron': 5, 'm:string': 3, 'm:planks': 8, 'm:stick': 4 } },
  { id: 'tnt3', name: 'TNT', gems: 15, items: { 'm:tnt': 3 }, what: 'Tap TNT by your mine block: BOOM! It digs 6 blocks at once, or blasts a monster.' },
  { id: 'diamond5', name: 'Diamond', gems: 20, items: { 'm:diamond': 5 } },
  { id: 'gold5', name: 'Gold Bar', gems: 10, items: { 'm:gold': 5 } },
  { id: 'iron5', name: 'Iron Bar', gems: 6, items: { 'm:iron': 5 } },
  { id: 'string5', name: 'String', gems: 4, items: { 'm:string': 5 } },
  { id: 'stick5', name: 'Stick', gems: 2, items: { 'm:stick': 5 } },
];

// --- Shop: crafting materials (the "💎 Diamonds" tab) ----------------------
// Diamonds make the best gear, so they cost emeralds; bars and string cost coins.
export const MAT_SHOP = [
  { k: 'm:diamond', gems: 4 },
  { k: 'm:gold', gold: Math.round(blockValue(7) * 1.5) },
  { k: 'm:iron', gold: Math.round(blockValue(6) * 1.5) },
  { k: 'm:string', gold: blockValue(5) },
];
