// The world registry — the scalable heart of the game.
//
// Each world is just a *recipe*: a name, a sky colour, how the ground is made
// (a generator method on World), and which friendly creatures live there.
// To add a brand-new world later you only do two small things:
//   1) write a `generateXyz()` method on World (in world.js), and
//   2) add one entry here.
// It then shows up everywhere automatically — the flint & steel "Where to?"
// menu, travel, the minimap, and the save file.

import { B } from './world.js';

export const WORLD_KINDS = {
  over: {
    name: 'Home', emoji: '🏡',
    sky: [0.62, 0.82, 0.96], fog: [38, 78],
    gen: 'generate', ground: B.DIRT,
    mobs: ['animals', 'creepers', 'zombies', 'spiders', 'skeletons', 'villagers'],
    home: true,                 // where flint & steel sends you with "Home"
  },
  nether: {
    name: 'The Nether', emoji: '🔥',
    sky: [0.32, 0.12, 0.13], fog: [26, 60],
    gen: 'generateNether', ground: B.NETHERRACK,
    mobs: ['nethermobs'],
    reward: true,               // earned via stars, not made with flint & steel
  },
  gold: {
    name: 'Gold World', emoji: '🪙',
    sky: [0.96, 0.84, 0.45], fog: [40, 82],
    gen: 'generateGold', ground: B.SAND,
    mobs: ['animals'],
    flint: true,                // appears in the flint & steel menu
  },
  ant: {
    name: 'Ant World', emoji: '🐜',
    sky: [0.55, 0.45, 0.32], fog: [30, 66],
    gen: 'generateAnt', ground: B.DIRT,
    mobs: ['ants'],
    flint: true,
  },
  tnt: {
    name: 'TNT World', emoji: '💥',
    sky: [0.55, 0.40, 0.34], fog: [34, 72],
    gen: 'generateTnt', ground: B.STONE,
    mobs: [],                   // a demolition playground — no creatures to hurt
    flint: true,
  },
  sky: {
    name: 'Sky World', emoji: '☁️',
    sky: [0.56, 0.78, 0.96], fog: [44, 96],
    gen: 'generateSky', ground: B.GRASS,
    mobs: ['animals'],
    flint: true,                // appears in the flint menu…
    locked: 'skyworld',         // …but only after it's bought in the 💎 shop
  },
  end: {
    name: 'The End', emoji: '🐉',
    sky: [0.17, 0.13, 0.26], fog: [40, 96],
    gen: 'generateEnd', ground: B.END_STONE,
    mobs: ['dragon'],
    flint: true,                // appears in the flint menu…
    locked: 'endworld',         // …after it's bought (the big adventure reward)
  },
  lego: {
    name: 'Lego World', emoji: '🧱',
    sky: [0.74, 0.90, 1.0], fog: [60, 120],
    gen: 'generateLego', ground: B.LEGO_GREEN,
    mobs: [],                   // a clean, calm Lego table to build on
    flint: true,
    locked: 'legoworld',        // the big-ticket 💎 reward (lots of diamonds!)
  },
  secret: {
    name: 'Secret World', emoji: '🎡',
    sky: [0.60, 0.80, 0.98], fog: [60, 130],
    gen: 'generateSecret', ground: B.QUARTZ,
    mobs: ['funpark'],          // the fun-park rides + friends having fun
    fun: true,                  // free to visit; you SPEND 💎 on rides here
  },
  build: {
    name: 'Build World', emoji: '🏗️',
    sky: [0.55, 0.78, 0.98], fog: [80, 200],
    gen: 'generateBuild', ground: B.GRASS,
    mobs: [],                   // a calm, wide-open flat plain just for building
  },
};

// Display order for menus/minimap.
export const WORLD_ORDER = ['over', 'nether', 'gold', 'ant', 'tnt', 'sky', 'end', 'lego', 'secret', 'build'];
