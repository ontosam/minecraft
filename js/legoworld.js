// ───────────────────────────────────────────────────────────────────────────
// LEGO WORLD = "VEGAS" FUN HUB  —  SKELETON / NEXT-SESSION SCAFFOLD (NOT WIRED YET)
// ───────────────────────────────────────────────────────────────────────────
//
// This file is an intentional, un-imported skeleton so the next session can pick
// up the Lego-World build seamlessly. NOTHING imports it yet, so it has zero
// runtime effect until you wire it into main.js (see the checklist in CLAUDE.md
// → "Next session — Lego World = the Fun Hub").
//
// DESIGN (from the dad):
//   • Lego World is the "Vegas": a dazzling amusement park you VISIT to have fun.
//   • You can only SPEND diamonds here — never earn them. Diamonds are mined /
//     earned by working in the OTHER worlds. The grip is "work hard elsewhere →
//     splurge on fun here" (achievement-after-effort).
//   • Paid attractions: 🏎️ go-kart racing, ⛸️ ice skating, 🎈 hot-air-balloon
//     rides — each costs a few 💎 to play; the reward is FUN + a ⭐/trophy /
//     cosmetic, NOT diamonds (keeps Lego World a pure 💎 sink).
//   • Lots of dazzle: balloons drifting, fireworks, lights, a Ferris wheel.
//   • Other people (the friend roster) wander here HAVING FUN (skating, riding).
//   • Bigger / higher-res than other worlds (3-D Lego studs — see CLAUDE.md).
//
// Mirror the existing patterns:
//   • Mobs/NPCs: see js/nethermobs.js + the `buddy` Character in main.js (walking
//     friends). Reuse `Character` with `charById(...)` skins so "other people"
//     are the real roster (Alex/Chip/Milo/Brexin/etc.).
//   • Tap kiosks: see `rayHitsSphere` + the dragon/steve tap routing in main.js.
//   • Spend 💎: `goals.spend(n)` / `goals.gems` (js/goals.js). Rewards: `goals.bump`
//     a new metric (e.g. 'kart','skate','balloon') + new GOAL_DEFS (⭐), maybe a
//     trophy unlock — do NOT `addGems` here.
//   • Particles/sound: `spawnParticles` + `sound.note/blip` in main.js / audio.js.
//   • World gen: `World.generateLego()` already lays the studded baseplate; extend
//     it (or do prop placement in LegoPark.populate) to add the rides/structures.

// Each attraction is a "kiosk" you tap to pay & play.
export const ATTRACTIONS = [
  // { id:'kart',    icon:'🏎️', name:'Go-Kart Race', cost:3, metric:'kart' },
  // { id:'skate',   icon:'⛸️', name:'Ice Skating',  cost:2, metric:'skate' },
  // { id:'balloon', icon:'🎈', name:'Balloon Ride', cost:3, metric:'balloon' },
];

export class LegoPark {
  constructor(gl, world) {
    this.gl = gl;
    this.world = world;
    this.kiosks = [];    // { id, pos:[x,y,z], def }
    this.npcs = [];      // visiting friends having fun (Character + simple AI)
    this.props = [];     // balloons / karts / skaters to animate + draw
    this.onPlay = null;  // (attraction) => void  — main.js opens the "pay 💎?" prompt
    // TODO: build meshes for karts / balloons / a Ferris wheel (see nethermobs.js
    //       addBox + meshFrom for the box-mesh pattern).
  }

  // Lay out the park: kiosks, a kart track (ICE/baseplate loop), a skating rink
  // (B.ICE), balloon launch pads, a Ferris wheel, fireworks emitters. Spawn a few
  // friend NPCs already enjoying the rides.
  populate() {
    // TODO
  }

  // Animate balloons drifting up, karts looping the track, skaters gliding,
  // fireworks popping, NPCs moving between rides.
  update(dt, player) {
    // TODO
  }

  // Draw NPCs + moving props with the world shader (prog), like NetherMobs.draw.
  draw(prog) {
    // TODO
  }

  // Tap test: did the player tap an attraction kiosk? Return the attraction so
  // main.js can show a kid-friendly "Ride for 💎X?" prompt → goals.spend → ride.
  pickRay(origin, dir) {
    // TODO: ray/sphere against this.kiosks (see rayHitsSphere in main.js)
    return null;
  }

  // Run a paid ride once payment succeeded (animation + fun + reward ⭐/trophy).
  play(attraction, player) {
    // TODO
  }
}
