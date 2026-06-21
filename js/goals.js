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
  { id: 'meetghast', icon: '👻', title: 'Meet a ghast', desc: 'Find a friendly ghast', metric: 'ghast', target: 1 },
  { id: 'meetblaze', icon: '🔥', title: 'Meet a blaze', desc: 'Find a friendly blaze', metric: 'blaze', target: 1 },
  { id: 'explorer2', icon: '🗺️', title: 'Adventurer', desc: 'Walk a long way (250)', metric: 'dist', target: 250 },
];

const KEY = 'ezrablocks.goals.v1';

export class Goals {
  constructor() {
    this.counts = { dist: 0, pet: 0, place: 0, dig: 0, defend: 0, treasure: 0, nether: 0, ghast: 0, blaze: 0, fly: 0, splash: 0, travel: 0, boom: 0, night: 0, zombie: 0 };
    this.usedTypes = new Set();
    this.done = {};
    this.stars = 0;
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
        changed = true;
        if (this.onComplete) this.onComplete(g);
      }
    }
    if (changed) this.save(); // completions always persist immediately
  }

  onMove(d) { this.counts.dist += d; this.check(); this.maybeSave(); }
  onPet() { this.counts.pet++; this.check(); this.save(); }
  onBuild(id) { this.counts.place++; this.usedTypes.add(id); this.check(); this.save(); }
  onDig() { this.counts.dig++; this.check(); this.save(); }
  onDefend() { this.counts.defend++; this.check(); this.save(); }
  bump(metric) { if (metric in this.counts) { this.counts[metric]++; this.check(); this.save(); } }

  maybeSave() { if (Date.now() - this._lastSave > 1500) this.save(); }
  save() {
    this._lastSave = Date.now();
    try {
      localStorage.setItem(KEY, JSON.stringify({
        c: this.counts, t: [...this.usedTypes], d: this.done, s: this.stars,
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
      }
    } catch (e) { /* ignore */ }
  }
}
