// All the game's content and numbers in one place: the block ladder, caves,
// upgrades, village buildings, recipes, and quests. Tweak balance here.

// --- The block ladder ------------------------------------------------------
// Two of the same block merge into the next one. Each block sitting on the
// board earns gold every second (gps). Each step earns ~2.5x the last, so a
// merge always increases income AND frees a square.
export const TIERS = [
  null, // tiers are 1-based
  { name: 'Dirt', art: 'dirt', gps: 1 },
  { name: 'Gravel', art: 'gravel', gps: 3 },
  { name: 'Stone', art: 'stone', gps: 8 },
  { name: 'Cobblestone', art: 'cobble', gps: 20 },
  { name: 'Mossy Stone', art: 'mossy', gps: 50 },
  { name: 'Coal', art: 'coal', gps: 125, ore: true },
  { name: 'Copper Ore', art: 'copper', gps: 310, ore: true },
  { name: 'Iron Ore', art: 'iron', gps: 780, ore: true },
  { name: 'Gold Ore', art: 'gold_ore', gps: 1950, ore: true },
  { name: 'Ruby Ore', art: 'ruby', gps: 4900, ore: true },
  { name: 'Sapphire Ore', art: 'sapphire', gps: 12200, ore: true },
  { name: 'Emerald Ore', art: 'emerald', gps: 30500, ore: true },
  { name: 'Amethyst', art: 'amethyst', gps: 76000, ore: true },
  { name: 'Diamond Ore', art: 'diamond_ore', gps: 190000, ore: true },
  { name: 'Gold Block', art: 'gold_block', gps: 475000 },
  { name: 'Diamond Block', art: 'diamond_block', gps: 1.19e6 },
  { name: 'Sunstone', art: 'glow', gps: 2.97e6 },
  { name: 'Obsidian', art: 'obsidian', gps: 7.4e6 },
  { name: 'Rainbow Block', art: 'rainbow', gps: 1.86e7 },
  { name: 'Star Block', art: 'star', gps: 4.65e7 },
];
export const MAX_TIER = TIERS.length - 1;
// New blocks from the mine always stay at least this many steps below your
// best block, so there is always merging to do.
export const DROP_GAP = 4;
// Your best block needed before "Dig Deeper" level k+1 can be bought. The gap
// widens slowly, so later blocks take longer to reach (gentle long game).
// (drop tier 2 needs your best block to be tier 8, tier 3 needs 10, tier 4
// needs 12 ... so the gap grows from 6 to 12 over the whole game.)
export function depthNeed(k) { return 2 * k + 8; }

// --- Caves: the backdrop changes as you discover deeper blocks --------------
export const CAVES = [
  { name: 'Dirt Den', from: 1, wall: 'dirt', glow: 'linear-gradient(to top, rgba(120,200,90,.25), rgba(0,0,0,0) 45%)', dim: 0.42 },
  { name: 'Stony Hollow', from: 4, wall: 'stone', glow: 'linear-gradient(to top, rgba(120,170,255,.22), rgba(0,0,0,0) 45%)', dim: 0.38 },
  { name: 'Ore Tunnels', from: 7, wall: 'cobble', glow: 'linear-gradient(to top, rgba(255,170,60,.28), rgba(0,0,0,0) 45%)', dim: 0.36 },
  { name: 'Gem Grotto', from: 10, wall: 'amethyst', glow: 'linear-gradient(to top, rgba(200,120,255,.3), rgba(0,0,0,0) 45%)', dim: 0.32 },
  { name: 'Lava Cavern', from: 14, wall: 'obsidian', glow: 'linear-gradient(to top, rgba(255,90,30,.45), rgba(0,0,0,0) 50%)', dim: 0.55 },
  { name: 'Star Cave', from: 18, wall: 'star', glow: 'linear-gradient(to top, rgba(120,140,255,.4), rgba(0,0,0,0) 50%)', dim: 0.45 },
];

export function caveFor(maxTier) {
  let c = CAVES[0];
  for (const cv of CAVES) if (maxTier >= cv.from) c = cv;
  return c;
}

// --- Board -----------------------------------------------------------------
export const COLS = 5, ROWS = 6;
export const START_CELLS = 9;          // open squares at level 1
// One more open square each level until the board is full.
export function openCells(level) { return Math.min(COLS * ROWS, START_CELLS + (level - 1)); }

// --- Levels ----------------------------------------------------------------
// XP comes from merging (more for bigger blocks) and from mining.
export function xpNeeded(level) { return Math.round(20 * Math.pow(level, 1.6)); }
export function mergeXP(newTier) { return 1 + Math.floor(newTier / 4); }
export const MINE_XP = 1;

// --- The mine block --------------------------------------------------------
// Pickaxe levels: taps per block, bonus chance to drop a second block.
export const PICKAXES = [
  { name: 'Wood Pickaxe', taps: 6, double: 0 },
  { name: 'Stone Pickaxe', taps: 4, double: 0 },
  { name: 'Copper Pickaxe', taps: 3, double: 0 },
  { name: 'Iron Pickaxe', taps: 3, double: 0.15 },
  { name: 'Gold Pickaxe', taps: 2, double: 0.15 },
  { name: 'Diamond Pickaxe', taps: 2, double: 0.3 },
  { name: 'Amethyst Pickaxe', taps: 1, double: 0.3 },
  { name: 'Star Pickaxe', taps: 1, double: 0.5 },
];

// What each pickaxe upgrade costs to craft in the Workshop.
// `need` = materials (from the storage chest / furnace), plus gold.
export const PICK_RECIPES = [
  null,
  { gold: 100, need: { 'b3': 2 } },                      // stone pickaxe: 2 Stone
  { gold: 15000, need: { 'i:copper': 3 } },             // copper: 3 copper ingots
  { gold: 600000, need: { 'i:iron': 4 } },
  { gold: 3e7, need: { 'i:gold': 5 } },
  { gold: 2e9, need: { 'b14': 1, 'i:gold': 5 } },
  { gold: 2e11, need: { 'b13': 2, 'i:ruby': 4 } },
  { gold: 3e13, need: { 'b20': 1 } },
];

// Prices are anchored to the block ladder: "K seconds of what one block of
// tier X earns". That keeps every purchase a few minutes of saving up,
// whatever stage of the game you're at.
const gpsOf = (t) => TIERS[Math.max(1, Math.min(MAX_TIER, Math.round(t)))].gps * Math.pow(2.5, Math.max(0, t - MAX_TIER));
const anchored = (tier, secs) => Math.round(gpsOf(tier) * secs / 10) * 10 || 10;

// --- Gold-bought upgrades (Workshop) ---------------------------------------
export const UPGRADES = {
  depth: { // the mine block drops bigger blocks
    name: 'Dig Deeper', desc: 'New blocks come out bigger', icon: 'pickaxe',
    max: 12, cost: (lv) => anchored(depthNeed(lv), 150),
    // can never drop within DROP_GAP tiers of your best block (keeps merging fun)
  },
  helper: { // a friendly mole who taps the mine block for you
    name: 'Mole Helper', desc: 'Digs the mine block for you', icon: 'mole',
    max: 12, cost: (lv) => anchored(2.5 + 1.25 * lv, 150),
    interval: (lv) => lv <= 0 ? 0 : 4 * Math.pow(0.88, lv - 1), // seconds between taps (4s -> ~1.0s)
  },
  lucky: { // chance a new block is one step bigger
    name: 'Lucky Dig', desc: 'Sometimes a bigger block pops out', icon: 'sparkle',
    max: 5, cost: (lv) => anchored(5 + 2.5 * lv, 200),
    chance: (lv) => lv * 0.05,
  },
};

// --- Reward meters (these only ever fill up; they never stop play) ---------
export const SPARK_FULL = 10;   // blocks broken to fill the spark bar -> Super Swing
export const RUSH_FULL = 25;    // merges to fill the Gold Rush jar
export const RUSH_SECS = 60;    // Gold Rush = double gold for this long

// --- Furnace: melt ore blocks into ingots (+ bricks for the village) -------
export const INGOTS = {
  copper: { name: 'Copper Ingot', color: 0xd9824a, from: 7, secs: 6, bricks: 3 },
  iron: { name: 'Iron Ingot', color: 0xd8d8e0, from: 8, secs: 8, bricks: 5 },
  gold: { name: 'Gold Ingot', color: 0xf6c935, from: 9, secs: 10, bricks: 8 },
  ruby: { name: 'Ruby Gem', color: 0xe0304a, from: 10, secs: 12, bricks: 12, gem: true },
};
// Coal can be burned for a big pile of bricks.
export const COAL_BRICKS = 2;

// --- Village: spend bricks on buildings that help ----------------------------
export const BUILDINGS = [
  { id: 'hut', name: "Miner's Hut", desc: 'All blocks make +10% gold', roof: 0xe0403a, wall: 0xc99a5b,
    cost: (lv) => Math.round(10 * Math.pow(2.2, lv)), max: 10 },
  { id: 'forge', name: 'Blacksmith', desc: 'Furnace melts faster', roof: 0x5a5a66, wall: 0x8f8f97,
    cost: (lv) => Math.round(20 * Math.pow(2.3, lv)), max: 6, unlock: 3 },
  { id: 'well', name: 'Wishing Well', desc: 'Merging gives gems more often', roof: 0x4a8ff0, wall: 0xb9b9c2,
    cost: (lv) => Math.round(30 * Math.pow(2.4, lv)), max: 8, unlock: 5 },
  { id: 'bakery', name: 'Bakery', desc: 'Earn longer while you’re away', roof: 0xf2913a, wall: 0xf3eee6,
    cost: (lv) => Math.round(25 * Math.pow(2.2, lv)), max: 6, unlock: 4 },
  { id: 'tower', name: 'Lookout Tower', desc: 'Treasure chests come more often', roof: 0x9a6ae0, wall: 0x9c7142,
    cost: (lv) => Math.round(40 * Math.pow(2.5, lv)), max: 5, unlock: 7 },
  { id: 'castle', name: 'Castle', desc: 'Everything makes +25% gold', roof: 0xffd23f, wall: 0xd9d4dc,
    cost: (lv) => Math.round(400 * Math.pow(3, lv)), max: 5, unlock: 12 },
];

// --- Shop: buy blocks with gold, and fun power-ups with gems ----------------
// You can buy blocks up to 3 steps below your best one.
export function shopPrice(tier) { return Math.round(TIERS[tier].gps * 40 * Math.pow(1.08, tier)); }

export const POWERS = {
  boom: { name: 'Boom Block', desc: 'Drag it onto a block to make it one step bigger', gems: 1 },
  magic: { name: 'Magic Merge', desc: 'Merges every pair on the board at once', gems: 3 },
};
// The Wishing Well gives a gem every N merges (a fixed count, no hidden odds).
export function wellEvery(lv) { return lv <= 0 ? 0 : Math.max(20, 70 - lv * 6); }

// --- Treasure chests --------------------------------------------------------
// Every so often (seconds of play), the next mined block is a treasure chest
// instead. Tap it to open. The Lookout Tower makes them come sooner.
export function chestEvery(towerLv) { return Math.max(45, 100 - towerLv * 11); }

// --- Quests -----------------------------------------------------------------
// Done in order; three are shown at a time. `metric` is a counter in state.
export const QUESTS = [
  { text: 'Tap the big block', metric: 'taps', n: 5, reward: { gold: 20 } },
  { text: 'Merge two blocks', metric: 'merges', n: 1, reward: { gold: 30 } },
  { text: 'Make Gravel', metric: 'tier', n: 2, reward: { gold: 50 } },
  { text: 'Merge 5 times', metric: 'merges', n: 5, reward: { gold: 80 } },
  { text: 'Make Stone', metric: 'tier', n: 3, reward: { gold: 150, bricks: 5 } },
  { text: 'Reach level 3', metric: 'level', n: 3, reward: { gems: 1 } },
  { text: 'Craft a Stone Pickaxe', metric: 'pick', n: 1, reward: { gold: 300 } },
  { text: 'Make Cobblestone', metric: 'tier', n: 4, reward: { gold: 400, bricks: 5 } },
  { text: 'Get a Mole Helper', metric: 'helper', n: 1, reward: { gold: 500 } },
  { text: 'Mine 50 blocks', metric: 'mined', n: 50, reward: { bricks: 10 } },
  { text: 'Build a Miner’s Hut', metric: 'build', n: 1, reward: { gems: 1 } },
  { text: 'Make Mossy Stone', metric: 'tier', n: 5, reward: { gold: 2000 } },
  { text: 'Open a treasure chest', metric: 'chests', n: 1, reward: { gold: 1500 } },
  { text: 'Make Coal', metric: 'tier', n: 6, reward: { bricks: 15 } },
  { text: 'Reach level 6', metric: 'level', n: 6, reward: { gems: 2 } },
  { text: 'Merge 50 times', metric: 'merges', n: 50, reward: { gold: 8000 } },
  { text: 'Make Copper Ore', metric: 'tier', n: 7, reward: { gold: 10000 } },
  { text: 'Melt something in the furnace', metric: 'smelts', n: 1, reward: { bricks: 20 } },
  { text: 'Craft a Copper Pickaxe', metric: 'pick', n: 2, reward: { gems: 2 } },
  { text: 'Make Iron Ore', metric: 'tier', n: 8, reward: { gold: 40000 } },
  { text: 'Village: build 3 buildings', metric: 'build', n: 3, reward: { gems: 2 } },
  { text: 'Reach level 10', metric: 'level', n: 10, reward: { bricks: 60 } },
  { text: 'Make Gold Ore', metric: 'tier', n: 9, reward: { gold: 200000 } },
  { text: 'Craft an Iron Pickaxe', metric: 'pick', n: 3, reward: { gems: 3 } },
  { text: 'Mine 500 blocks', metric: 'mined', n: 500, reward: { bricks: 100 } },
  { text: 'Make Ruby Ore', metric: 'tier', n: 10, reward: { gold: 1e6 } },
  { text: 'Open 10 treasure chests', metric: 'chests', n: 10, reward: { gems: 3 } },
  { text: 'Make Sapphire Ore', metric: 'tier', n: 11, reward: { gold: 3e6 } },
  { text: 'Reach level 15', metric: 'level', n: 15, reward: { bricks: 250 } },
  { text: 'Craft a Gold Pickaxe', metric: 'pick', n: 4, reward: { gems: 4 } },
  { text: 'Make Emerald Ore', metric: 'tier', n: 12, reward: { gold: 1e7 } },
  { text: 'Make Amethyst', metric: 'tier', n: 13, reward: { gems: 5 } },
  { text: 'Merge 1,000 times', metric: 'merges', n: 1000, reward: { bricks: 500 } },
  { text: 'Make Diamond Ore', metric: 'tier', n: 14, reward: { gold: 1e8 } },
  { text: 'Reach level 20', metric: 'level', n: 20, reward: { gems: 5 } },
  { text: 'Make a Gold Block', metric: 'tier', n: 15, reward: { gold: 5e8 } },
  { text: 'Make a Diamond Block', metric: 'tier', n: 16, reward: { gems: 6 } },
  { text: 'Build a Castle', metric: 'castle', n: 1, reward: { gems: 6 } },
  { text: 'Make Sunstone', metric: 'tier', n: 17, reward: { gold: 1e10 } },
  { text: 'Make Obsidian', metric: 'tier', n: 18, reward: { gems: 8 } },
  { text: 'Make a Rainbow Block', metric: 'tier', n: 19, reward: { gold: 1e11 } },
  { text: 'Make the Star Block!', metric: 'tier', n: 20, reward: { gems: 10 } },
];

// Offline earnings: blocks keep earning while you're away, up to a cap.
export function offlineCapSecs(bakeryLv) { return (60 + bakeryLv * 30) * 60; }
