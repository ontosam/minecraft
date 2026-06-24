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
];

const KEY = 'ezrablocks.goals.v1';

export class Goals {
  constructor() {
    this.counts = { dist: 0, pet: 0, place: 0, dig: 0, defend: 0, treasure: 0, nether: 0, ghast: 0, blaze: 0, fly: 0, splash: 0, travel: 0, boom: 0, night: 0, zombie: 0, diamond: 0, doors: 0, bought: 0, spider: 0, lamp: 0, monster: 0, lever: 0, bounce: 0, ride: 0, fish: 0, quest: 0, plant: 0, math: 0, snack: 0, skeleton: 0, crystal: 0, dragon: 0, story: 0, sleep: 0, funride: 0, treat: 0, space: 0, rover: 0, blackhole: 0, spacegem: 0, dragonfly: 0, rocketfly: 0, spacerace: 0 };
    this.usedTypes = new Set();
    this.done = {};
    this.stars = 0;
    this.gems = 0;            // 💎 spendable currency (mined + earned from goals)
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
        c: this.counts, t: [...this.usedTypes], d: this.done, s: this.stars, g: this.gems, u: this.unlocks, p: this.tips, adv: this.adv, fr: this.friends,
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
        this.unlocks = o.u || {};
        this.tips = o.p || {};
        this.adv = o.adv || null;
        this.friends = o.fr || {};
      }
    } catch (e) { /* ignore */ }
  }
}
