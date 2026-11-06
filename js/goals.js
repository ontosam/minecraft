// A gentle progression system: bite-size goals that unlock a star each, track
// progress, and save automatically — so there's always a next thing to do.

export const GOAL_DEFS = [
  { id: 'explore', icon: '🚶', title: 'Explorer', desc: 'Walk around and explore', metric: 'dist', target: 60 },
  { id: 'friend', icon: '🐾', title: 'Animal friend', desc: 'Pet an animal', metric: 'pet', target: 1 },
  { id: 'builder', icon: '🧱', title: 'Builder', desc: 'Place 12 blocks', metric: 'place', target: 12 },
  { id: 'rainbow', icon: '🌈', title: 'Mix it up', desc: 'Build with 4 different blocks', metric: 'variety', target: 4 },
  { id: 'digger', icon: '⛏️', title: 'Digger', desc: 'Dig 8 blocks', metric: 'dig', target: 8 },
  { id: 'treasure', icon: '💎', title: 'Treasure hunter', desc: 'Dig up hidden gold or diamond', metric: 'treasure', target: 1 },
  { id: 'fly', icon: '🕊️', title: 'Take off!', desc: 'Tap Fly and soar up high', metric: 'fly', target: 1 },
  { id: 'splash', icon: '💦', title: 'Big splash!', desc: 'Make a soft landing in water', metric: 'splash', target: 1 },
  { id: 'bounce', icon: '🟢', title: 'Boing!', desc: 'Bounce on a slime block', metric: 'bounce', target: 1 },
  { id: 'ride', icon: '🐴', title: 'Giddy up!', desc: 'Ride your very own pony', metric: 'ride', target: 1 },
  { id: 'fish', icon: '🎣', title: 'Gone fishing!', desc: 'Catch something at the water', metric: 'fish', target: 1 },
  { id: 'angler', icon: '🐟', title: 'Master angler', desc: 'Catch 12 things by fishing', metric: 'fish', target: 12 },
  { id: 'helper', icon: '🧑‍🌾', title: 'Village helper', desc: 'Finish 3 villager quests', metric: 'quest', target: 3 },
  { id: 'gardener', icon: '🌱', title: 'Green thumb', desc: 'Plant a sapling and grow a tree', metric: 'plant', target: 1 },
  { id: 'mathwhiz', icon: '🍗', title: 'Math whiz', desc: 'Answer 5 of Steve\'s math questions', metric: 'math', target: 5 },
  { id: 'numbermaster', icon: '🧮', title: 'Number master', desc: 'Answer 20 math questions', metric: 'math', target: 20 },
  { id: 'snacker', icon: '🍎', title: 'Snack time', desc: 'Eat 3 snacks from Steve', metric: 'snack', target: 3 },
  { id: 'defend', icon: '🛡️', title: 'Protect your house!', desc: 'Bonk a creeper to save your blocks', metric: 'defend', target: 1 },
  { id: 'pets', icon: '💞', title: 'Best friends', desc: 'Pet 5 animals', metric: 'pet', target: 5 },
  { id: 'architect', icon: '🏠', title: 'Architect', desc: 'Place 30 blocks', metric: 'place', target: 30 },
  { id: 'guard', icon: '🦸', title: 'Block hero', desc: 'Bonk 5 creepers', metric: 'defend', target: 5 },
  { id: 'treasure5', icon: '💰', title: 'Treasure chest', desc: 'Find 5 hidden treasures', metric: 'treasure', target: 5 },
  { id: 'portal', icon: '🌀', title: 'Find the portal', desc: 'Step into the Nether portal', metric: 'nether', target: 1 },
  { id: 'traveler', icon: '🔥', title: 'World hopper', desc: 'Make a portal and travel somewhere', metric: 'travel', target: 1 },
  { id: 'boom', icon: '💥', title: 'Demolition!', desc: 'Blow up some TNT', metric: 'boom', target: 1 },
  { id: 'night', icon: '🌙', title: 'Brave at night', desc: 'Turn on night-time', metric: 'night', target: 1 },
  { id: 'zombie', icon: '🧟', title: 'Zombie bonker', desc: 'Bonk a night zombie', metric: 'zombie', target: 1 },
  { id: 'spider', icon: '🕷️', title: 'Spider shoo-er', desc: 'Shoo away a night spider', metric: 'spider', target: 1 },
  { id: 'warrior', icon: '⚔️', title: 'Monster masher', desc: 'Defeat 5 night creatures', metric: 'monster', target: 5 },
  { id: 'skeleton', icon: '💀', title: 'Skeleton slayer', desc: 'Defeat 2 tough skeletons', metric: 'skeleton', target: 2 },
  { id: 'diamond', icon: '💎', title: 'Diamond miner', desc: 'Mine 5 diamonds', metric: 'diamond', target: 5 },
  { id: 'builder2', icon: '🏗️', title: 'Master builder', desc: 'Place 75 blocks', metric: 'place', target: 75 },
  { id: 'decorator', icon: '🎨', title: 'Decorator', desc: 'Build with 8 different blocks', metric: 'variety', target: 8 },
  { id: 'doormaker', icon: '🚪', title: 'Door maker', desc: 'Build a door for your house', metric: 'doors', target: 1 },
  { id: 'lever', icon: '🎚️', title: 'Lever flipper', desc: 'Place and flip a lever', metric: 'lever', target: 1 },
  { id: 'lamp', icon: '💡', title: 'Light it up!', desc: 'Power up a redstone lamp', metric: 'lamp', target: 1 },
  { id: 'meetghast', icon: '👻', title: 'Meet a ghast', desc: 'Find a friendly ghast', metric: 'ghast', target: 1 },
  { id: 'meetblaze', icon: '🔥', title: 'Meet a blaze', desc: 'Find a friendly blaze', metric: 'blaze', target: 1 },
  { id: 'explorer2', icon: '🗺️', title: 'Adventurer', desc: 'Walk a long way (250)', metric: 'dist', target: 250 },
  { id: 'shopper', icon: '🛍️', title: 'Treasure shopper', desc: 'Buy 3 things from the shop', metric: 'bought', target: 3 },
  { id: 'diamond2', icon: '💠', title: 'Diamond king', desc: 'Mine 15 diamonds', metric: 'diamond', target: 15 },
  { id: 'marathon', icon: '🏃', title: 'Marathon', desc: 'Walk really far (500)', metric: 'dist', target: 500 },
  { id: 'crystals', icon: '🔮', title: 'Crystal popper', desc: 'Pop 3 End crystals', metric: 'crystal', target: 3 },
  { id: 'dragontamer', icon: '🐉', title: 'Dragon tamer', desc: 'Tame the friendly End dragon', metric: 'dragon', target: 1 },
  { id: 'storyteller', icon: '📖', title: 'Adventurer', desc: 'Finish 5 adventure chapters with friends', metric: 'story', target: 5 },
  { id: 'sleeper', icon: '🛏️', title: 'Sweet dreams', desc: 'Sleep in a bed you built', metric: 'sleep', target: 1 },
  { id: 'funpark', icon: '🎡', title: 'Fun park!', desc: 'Ride a ride at the Secret World', metric: 'funride', target: 1 },
  { id: 'thrills', icon: '🎢', title: 'Thrill seeker', desc: 'Go on 8 fun-park rides', metric: 'funride', target: 8 },
  { id: 'treats', icon: '🍿', title: 'Sweet tooth', desc: 'Buy 4 treats from the Popcorn stand', metric: 'treat', target: 4 },
  { id: 'astronaut', icon: '🚀', title: 'Astronaut', desc: 'Blast off to Space World!', metric: 'space', target: 1 },
  { id: 'rover', icon: '🛸', title: 'Space driver', desc: 'Drive the Space Rover on the moon', metric: 'rover', target: 1 },
  { id: 'blackhole', icon: '🕳️', title: 'Black hole!', desc: 'Fall into a hidden space black hole', metric: 'blackhole', target: 1 },
  { id: 'spacegem', icon: '🔷', title: 'Space miner', desc: 'Mine 6 glowing space crystals', metric: 'spacegem', target: 6 },
  { id: 'dragonfly', icon: '🐉', title: 'Dragon rider', desc: 'Fly on your very own dragon', metric: 'dragonfly', target: 1 },
  { id: 'rocketfly', icon: '🚀', title: 'Rocket pilot', desc: 'Launch the rocket and blast off!', metric: 'rocketfly', target: 1 },
  { id: 'spacerace', icon: '🏁', title: 'Space racer', desc: 'Finish the space ring race', metric: 'spacerace', target: 1 },
  { id: 'spacebuddy', icon: '🧑‍🚀', title: "Nova's helper", desc: 'Finish 3 missions for Captain Nova', metric: 'spacemission', target: 3 },
  { id: 'puzzler', icon: '🧩', title: 'Puzzle solver', desc: 'Solve 3 color puzzles', metric: 'puzzle', target: 3 },
  { id: 'gather', icon: '🪵', title: 'Gather materials', desc: 'Collect 10 materials by mining', metric: 'gather', target: 10 },
  { id: 'toolsmith', icon: '⛏️', title: 'Toolsmith', desc: 'Craft your first pickaxe', metric: 'craft', target: 1 },
  { id: 'pickmaster', icon: '💠', title: 'Master miner', desc: 'Craft the shiny Diamond Pickaxe', metric: 'craftdia', target: 1 },
  { id: 'smelter', icon: '🔥', title: 'Smelter', desc: 'Smelt 3 iron bars in the furnace', metric: 'smelt', target: 3 },
  { id: 'armored', icon: '🛡️', title: 'Suit up!', desc: 'Forge a suit of armor', metric: 'suit', target: 1 },
  { id: 'deepdig', icon: '🕳️', title: 'Into the deep', desc: 'Dig down to the bottom of a cave', metric: 'wentdeep', target: 1 },
  { id: 'champion', icon: '🏆', title: 'Champion of the Deep', desc: 'Claim the legendary Relic in the Deep Vault', metric: 'champion', target: 1 },
  { id: 'torchbearer', icon: '🔦', title: 'Torch bearer', desc: 'Light up a dark cave with 3 torches', metric: 'torch', target: 3 },
  { id: 'axemaker', icon: '🪓', title: 'Lumberjack', desc: 'Craft an Axe to chop wood fast', metric: 'craftaxe', target: 1 },
  { id: 'shovelmaker', icon: '🥄', title: 'Dig dig dig', desc: 'Craft a Shovel to dig dirt fast', metric: 'craftshovel', target: 1 },
  { id: 'mastertool', icon: '🛠️', title: 'Master Toolsmith', desc: 'Forge a full set of Diamond tools', metric: 'mastertool', target: 1 },
  { id: 'dreamchaser', icon: '🌙', title: 'Dream Chaser', desc: "Finish Mateo's Dream Adventure in Lego World", metric: 'dream', target: 1 },
  { id: 'dreammaster', icon: '🏆', title: 'Dream Master', desc: 'Finish 5 Dream Adventures', metric: 'dream', target: 5 },
  { id: 'nightmarechaser', icon: '👑', title: 'King catcher', desc: 'Catch the Nightmare King 3 times', metric: 'dreamnm', target: 3 },
];

const KEY = 'ezrablocks.goals.v1';

export class Goals {
  constructor() {
    this.counts = { dist: 0, pet: 0, place: 0, dig: 0, defend: 0, treasure: 0, nether: 0, ghast: 0, blaze: 0, fly: 0, splash: 0, travel: 0, boom: 0, night: 0, zombie: 0, diamond: 0, doors: 0, bought: 0, spider: 0, lamp: 0, monster: 0, lever: 0, bounce: 0, ride: 0, fish: 0, quest: 0, plant: 0, math: 0, snack: 0, skeleton: 0, crystal: 0, dragon: 0, story: 0, sleep: 0, funride: 0, treat: 0, space: 0, rover: 0, blackhole: 0, spacegem: 0, dragonfly: 0, rocketfly: 0, spacerace: 0, spacemission: 0, puzzle: 0, gather: 0, craft: 0, craftdia: 0, smelt: 0, suit: 0, wentdeep: 0, champion: 0, torch: 0, craftaxe: 0, craftshovel: 0, mastertool: 0, dream: 0, dreamnm: 0 };
    this.usedTypes = new Set();
    this.done = {};
    this.stars = 0;
    this.gems = 0;            // 💎 spendable currency (mined + earned from goals)
    this.items = { wood: 0, stone: 0, coal: 0, iron: 0, ingot: 0 };  // materials (mined) + smelted iron bars
    this.tools = { pick: 0, axe: 0, shovel: 0, armor: 0 }; // each 0=bare→4=diamond; armor 0/1/2
    this.unlocks = {};        // shop unlocks: { pet, heart, megatnt }
    this.tips = {};           // which one-time friendly hint blurbs have been shown
    this.adv = null;          // adventure story state: { i: chapter, base: counter baseline }
    this.friends = {};        // friendship hearts earned with each buddy
    this.onComplete = null;   // (def) => void
    this._lastSave = 0;
    this.load();
  }

  metricValue(m) { return m === 'variety' ? this.usedTypes.size : this.counts[m]; }
  progress(g) { return Math.min(g.target, Math.floor(this.metricValue(g.metric))); }

  check() {
    let changed = false;
    for (const g of GOAL_DEFS) {
      if (!this.done[g.id] && this.metricValue(g.metric) >= g.target) {
        this.done[g.id] = true;
        this.stars++;
        this.gems += 2;            // every goal also pays out a couple of 💎
        changed = true;
        if (this.onComplete) this.onComplete(g);
      }
    }
    if (changed) this.save(); // completions always persist immediately
  }

  onMove(d) { this.counts.dist += d; this.check(); this.maybeSave(); }
  onPet() { this.counts.pet++; this.check(); this.save(); }
  onBuild(id) { this.counts.place++; this.usedTypes.add(id); this.check(); this.save(); }
  // A whole structure placed at once (the one-tap Big Builds) — count every block.
  onBuildMany(id, n) { this.counts.place += Math.max(0, n | 0); if (id != null) this.usedTypes.add(id); this.check(); this.save(); }
  onDig() { this.counts.dig++; this.check(); this.save(); }
  onDefend() { this.counts.defend++; this.check(); this.save(); }
  bump(metric) { if (metric in this.counts) { this.counts[metric]++; this.check(); this.save(); } }

  // Crafting materials (collected by mining) + the tool ladder.
  addItem(k, n = 1) { if (k in this.items) { this.items[k] += n; this.counts.gather += n; this.check(); this.save(); } }
  itemCount(k) { return this.items[k] || 0; }
  canAfford(cost) { for (const k in cost) { if (k === 'gems') { if (this.gems < cost[k]) return false; } else if ((this.items[k] || 0) < cost[k]) return false; } return true; }
  spendItems(cost) {
    if (!this.canAfford(cost)) return false;
    for (const k in cost) { if (k === 'gems') this.gems -= cost[k]; else this.items[k] -= cost[k]; }
    this.save(); return true;
  }
  pickTier() { return this.tools.pick || 0; }
  setPickTier(t) { this.setToolTier('pick', t); }
  // Tool tiers (pick / axe / shovel), each 0=bare → 4=diamond. Crafting any tool
  // counts toward Toolsmith; a diamond of each = Master Toolsmith.
  toolTier(kind) { return this.tools[kind] || 0; }
  setToolTier(kind, t) {
    if (t <= (this.tools[kind] || 0)) return;
    this.tools[kind] = t;
    this.counts.craft++;
    if (kind === 'pick' && t >= 4) this.counts.craftdia++;
    if (kind === 'axe' && t >= 1) this.counts.craftaxe = 1;
    if (kind === 'shovel' && t >= 1) this.counts.craftshovel = 1;
    if ((this.tools.pick || 0) >= 4 && (this.tools.axe || 0) >= 4 && (this.tools.shovel || 0) >= 4) this.counts.mastertool = 1;
    this.check(); this.save();
  }
  armorTier() { return this.tools.armor || 0; }
  setArmor(t) { if (t > (this.tools.armor || 0)) { this.tools.armor = t; this.counts.suit++; this.check(); this.save(); } }
  // Smelt one raw iron into a bar, burning a coal as fuel. Returns false if short.
  smeltIron() { if ((this.items.iron || 0) < 1 || (this.items.coal || 0) < 1) return false; this.items.iron--; this.items.coal--; this.items.ingot = (this.items.ingot || 0) + 1; this.counts.smelt++; this.check(); this.save(); return true; }

  // 💎 currency + shop unlocks.
  addGems(n) { this.gems += n; this.save(); }
  spend(n) { if (this.gems >= n) { this.gems -= n; this.save(); return true; } return false; }
  hasUnlock(id) { return !!this.unlocks[id]; }
  setUnlock(id) { this.unlocks[id] = true; this.save(); }
  seenTip(id) { return !!this.tips[id]; }
  markTip(id) { this.tips[id] = true; this.save(); }

  maybeSave() { if (Date.now() - this._lastSave > 1500) this.save(); }
  save() {
    this._lastSave = Date.now();
    try {
      localStorage.setItem(KEY, JSON.stringify({
        c: this.counts, t: [...this.usedTypes], d: this.done, s: this.stars, g: this.gems, it: this.items, tl: this.tools, u: this.unlocks, p: this.tips, adv: this.adv, fr: this.friends,
      }));
    } catch (e) { /* ignore */ }
  }
  load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY));
      if (o) {
        this.counts = Object.assign(this.counts, o.c || {});
        this.usedTypes = new Set(o.t || []);
        this.done = o.d || {};
        this.stars = o.s || 0;
        this.gems = o.g || 0;
        this.items = Object.assign(this.items, o.it || {});
        this.tools = Object.assign(this.tools, o.tl || {});
        this.unlocks = o.u || {};
        this.tips = o.p || {};
        this.adv = o.adv || null;
        this.friends = o.fr || {};
      }
    } catch (e) { /* ignore */ }
  }
}
