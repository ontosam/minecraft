// The voxel world: storage, gentle terrain, chunk meshing with baked
// ambient-occlusion lighting, ray picking for build/dig, and save/load.

import { GLMesh, getUV, TILE } from './gfx.js';

export const SX = 64, SY = 32, SZ = 64;   // world size in blocks
export const CHUNK = 16;                   // chunk footprint (CHUNK x CHUNK x SY)
const CXN = SX / CHUNK, CZN = SZ / CHUNK;  // chunks per axis
// The beach lagoon (overworld): centre, radius, and water surface height.
const BEACH = { x: 18, z: 44, r: 10, waterY: 4 };

// Block ids
export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, LOG: 5, LEAVES: 6,
  PLANKS: 7, WATER: 8, BEDROCK: 9, BRICK: 10, GLASS: 11,
  RED: 12, ORANGE: 13, YELLOW: 14, GREEN: 15, CYAN: 16,
  BLUE: 17, PURPLE: 18, PINK: 19, WHITE: 20, BLACK: 21,
  COBBLE: 22, STONE_BRICK: 23, SNOW: 24, ICE: 25, GRAVEL: 26,
  BIRCH_LOG: 27, BIRCH_PLANKS: 28, DARK_PLANKS: 29, GOLD: 30,
  DIAMOND: 31, BOOKSHELF: 32, GLOWSTONE: 33, PUMPKIN: 34, OBSIDIAN: 35,
  NETHERRACK: 36, PORTAL: 37, LAVA: 38,
  DOOR: 39, DOOR_OPEN: 40, TNT: 41, RAINBOW: 42,
  LEVER: 43, LEVER_ON: 44, REDSTONE: 45, REDLAMP: 46, REDLAMP_ON: 47, SLIME: 48,
  SAPLING: 49, MEGA_TNT: 50, SANDSTONE: 51, END_STONE: 52,
  BED_FOOT: 53, BED_HEAD: 54, BARRIER: 55, LANTERN: 56,
  IRON_BLOCK: 57, GOLD_BLOCK: 58, DIAMOND_BLOCK: 59, EMERALD_BLOCK: 60, LAPIS_BLOCK: 61,
  REDSTONE_BLOCK: 62, COAL_BLOCK: 63, AMETHYST: 64,
  DEEPSLATE: 65, GRANITE: 66, ANDESITE: 67, DIORITE: 68, QUARTZ: 69, PRISMARINE: 70, SEA_LANTERN: 71,
  MOSS: 72, MUSHROOM_RED: 73, MUSHROOM_BROWN: 74, CACTUS: 75, MUD: 76,
  NETHER_BRICK: 77, MAGMA: 78,
  MELON: 79, HAY: 80, NOTE_BLOCK: 81, SPONGE: 82,
  LEGO_RED: 83, LEGO_ORANGE: 84, LEGO_YELLOW: 85, LEGO_GREEN: 86, LEGO_BLUE: 87, LEGO_CYAN: 88,
  LEGO_PURPLE: 89, LEGO_PINK: 90, LEGO_WHITE: 91, LEGO_BLACK: 92, LEGO_BROWN: 93, LEGO_LIME: 94,
};

const W = [1, 1, 1]; // white tint for textured blocks
function colored(tile, tint, ui) { return { tiles: { top: tile, side: tile, bottom: tile }, tint, ui }; }
// A textured block tinted a colour (e.g. Lego bricks: neutral studded tiles × tint).
function tinted(top, side, bottom, tint, ui) { return { tiles: { top, side, bottom }, tint, ui }; }
function nat(tile, ui) { return { tiles: { top: tile, side: tile, bottom: tile }, tint: W, ui }; }
function nat3(top, side, bottom, ui) { return { tiles: { top, side, bottom }, tint: W, ui }; }

// Block definitions: which atlas tiles to use per face, a tint colour, and a
// swatch colour for the on-screen palette.
export const BLOCKS = {
  [B.GRASS]: { tiles: { top: TILE.GRASS_TOP, side: TILE.GRASS_SIDE, bottom: TILE.DIRT }, tint: W, ui: '#6abe4f' },
  [B.DIRT]: { tiles: { top: TILE.DIRT, side: TILE.DIRT, bottom: TILE.DIRT }, tint: W, ui: '#8a6240' },
  [B.STONE]: { tiles: { top: TILE.STONE, side: TILE.STONE, bottom: TILE.STONE }, tint: W, ui: '#8f8f97' },
  [B.SAND]: { tiles: { top: TILE.SAND, side: TILE.SAND, bottom: TILE.SAND }, tint: W, ui: '#e4d6a0' },
  [B.LOG]: { tiles: { top: TILE.LOG_TOP, side: TILE.LOG_SIDE, bottom: TILE.LOG_TOP }, tint: W, ui: '#9c7142' },
  [B.LEAVES]: { tiles: { top: TILE.LEAVES, side: TILE.LEAVES, bottom: TILE.LEAVES }, tint: W, ui: '#4f9a3a', seethrough: true },
  [B.PLANKS]: { tiles: { top: TILE.PLANKS, side: TILE.PLANKS, bottom: TILE.PLANKS }, tint: W, ui: '#c99a5b' },
  [B.WATER]: { tiles: { top: TILE.WATER, side: TILE.WATER, bottom: TILE.WATER }, tint: W, ui: '#3a86d6', passable: true },
  [B.BEDROCK]: { tiles: { top: TILE.BEDROCK, side: TILE.BEDROCK, bottom: TILE.BEDROCK }, tint: W, ui: '#4a4a52', indestructible: true },
  [B.BRICK]: { tiles: { top: TILE.BRICK, side: TILE.BRICK, bottom: TILE.BRICK }, tint: W, ui: '#b05a44' },
  [B.GLASS]: { tiles: { top: TILE.GLASS, side: TILE.GLASS, bottom: TILE.GLASS }, tint: W, ui: '#bfe6f2', seethrough: true },
  [B.RED]: colored(TILE.NEUTRAL, [0.85, 0.22, 0.22], '#d83838'),
  [B.ORANGE]: colored(TILE.NEUTRAL, [0.95, 0.55, 0.15], '#f28c26'),
  [B.YELLOW]: colored(TILE.NEUTRAL, [0.97, 0.85, 0.2], '#f7d934'),
  [B.GREEN]: colored(TILE.NEUTRAL, [0.35, 0.75, 0.3], '#59bf4d'),
  [B.CYAN]: colored(TILE.NEUTRAL, [0.3, 0.8, 0.85], '#4dccd9'),
  [B.BLUE]: colored(TILE.NEUTRAL, [0.25, 0.45, 0.9], '#4073e6'),
  [B.PURPLE]: colored(TILE.NEUTRAL, [0.6, 0.35, 0.85], '#9959d9'),
  [B.PINK]: colored(TILE.NEUTRAL, [0.95, 0.55, 0.75], '#f28cbf'),
  [B.WHITE]: colored(TILE.NEUTRAL, [0.96, 0.96, 0.97], '#f5f5f7'),
  [B.BLACK]: colored(TILE.NEUTRAL, [0.2, 0.2, 0.24], '#2e2e36'),

  [B.COBBLE]: nat(TILE.COBBLE, '#8a8a90'),
  [B.STONE_BRICK]: nat(TILE.STONE_BRICK, '#9a9aa1'),
  [B.SNOW]: nat(TILE.SNOW, '#eef3fb'),
  [B.ICE]: nat(TILE.ICE, '#a9d6ee'),
  [B.GRAVEL]: nat(TILE.GRAVEL, '#847f7a'),
  [B.BIRCH_LOG]: nat3(TILE.LOG_TOP, TILE.BIRCH_LOG, TILE.LOG_TOP, '#e7e2d4'),
  [B.BIRCH_PLANKS]: nat(TILE.BIRCH_PLANKS, '#dacca0'),
  [B.DARK_PLANKS]: nat(TILE.DARK_PLANKS, '#4f3a22'),
  [B.GOLD]: nat(TILE.GOLD, '#f2c63a'),
  [B.DIAMOND]: nat(TILE.DIAMOND, '#59d6c8'),
  [B.BOOKSHELF]: nat3(TILE.PLANKS, TILE.BOOKSHELF, TILE.PLANKS, '#9a6b3a'),
  [B.GLOWSTONE]: nat(TILE.GLOWSTONE, '#e8c24a'),
  [B.PUMPKIN]: nat3(TILE.PUMPKIN_TOP, TILE.PUMPKIN_SIDE, TILE.PUMPKIN_TOP, '#e07b1e'),
  [B.OBSIDIAN]: nat(TILE.OBSIDIAN, '#241a33'),
  [B.NETHERRACK]: nat(TILE.NETHERRACK, '#7a2e2e'),
  [B.LAVA]: nat(TILE.LAVA, '#e8702a'),
  // The portal swirl: you walk *through* it (passable) and it can't be dug, so
  // the gateway can't be accidentally destroyed and leave anyone stuck.
  [B.PORTAL]: { tiles: { top: TILE.NETHER_PORTAL, side: TILE.NETHER_PORTAL, bottom: TILE.NETHER_PORTAL }, tint: W, ui: '#9959d9', indestructible: true, passable: true },
  [B.DOOR]: nat(TILE.DOOR, '#8a5a2a'),
  [B.DOOR_OPEN]: { tiles: { top: TILE.DOOR_OPEN, side: TILE.DOOR_OPEN, bottom: TILE.DOOR_OPEN }, tint: W, ui: '#5e3c1c', passable: true },
  [B.TNT]: nat3(TILE.TNT_TOP, TILE.TNT_SIDE, TILE.TNT_TOP, '#c0392b'),
  [B.RAINBOW]: nat(TILE.RAINBOW, '#ff66cc'),
  [B.LEVER]: nat(TILE.LEVER, '#8a8a90'),
  [B.LEVER_ON]: nat(TILE.LEVER_ON, '#b8544c'),
  [B.REDSTONE]: nat(TILE.REDSTONE, '#a8362c'),
  [B.REDLAMP]: nat(TILE.REDLAMP, '#7a6038'),
  [B.REDLAMP_ON]: nat(TILE.REDLAMP_ON, '#f2c24a'),
  [B.SLIME]: nat(TILE.SLIME, '#6fcf6a'),
  // A sapling is a walk-through plant that grows into a tree after a while.
  [B.SAPLING]: { tiles: { top: TILE.SAPLING, side: TILE.SAPLING, bottom: TILE.SAPLING }, tint: W, ui: '#5bbf3a', passable: true },
  [B.MEGA_TNT]: nat3(TILE.MEGA_TNT_TOP, TILE.MEGA_TNT_SIDE, TILE.MEGA_TNT_TOP, '#8e1b12'),
  [B.SANDSTONE]: nat(TILE.SANDSTONE, '#e6d8a8'),
  [B.END_STONE]: nat(TILE.END_STONE, '#e6e6b0'),
  [B.BED_FOOT]: nat3(TILE.BED_FOOT, TILE.BED_SIDE, TILE.PLANKS, '#c23a3a'),
  [B.BED_HEAD]: nat3(TILE.BED_HEAD, TILE.BED_SIDE, TILE.PLANKS, '#e2dccb'),
  [B.BARRIER]: { tiles: { top: TILE.BARRIER, side: TILE.BARRIER, bottom: TILE.BARRIER }, tint: W, ui: '#7be6f0', seethrough: true },
  [B.LANTERN]: nat(TILE.LANTERN, '#ffe07a'),
  // Recognizable Minecraft-style blocks (lots of building variety).
  [B.IRON_BLOCK]: nat(TILE.IRON_BLOCK, '#d8d8de'),
  [B.GOLD_BLOCK]: nat(TILE.GOLD_BLOCK, '#f2c63a'),
  [B.DIAMOND_BLOCK]: nat(TILE.DIAMOND_BLOCK, '#57d6c8'),
  [B.EMERALD_BLOCK]: nat(TILE.EMERALD_BLOCK, '#36c463'),
  [B.LAPIS_BLOCK]: nat(TILE.LAPIS_BLOCK, '#274bbf'),
  [B.REDSTONE_BLOCK]: nat(TILE.REDSTONE_BLOCK, '#b01818'),
  [B.COAL_BLOCK]: nat(TILE.COAL_BLOCK, '#24232a'),
  [B.AMETHYST]: nat(TILE.AMETHYST, '#9b59d0'),
  [B.DEEPSLATE]: nat(TILE.DEEPSLATE, '#3a3a42'),
  [B.GRANITE]: nat(TILE.GRANITE, '#a56b53'),
  [B.ANDESITE]: nat(TILE.ANDESITE, '#8f8f95'),
  [B.DIORITE]: nat(TILE.DIORITE, '#dcdce0'),
  [B.QUARTZ]: nat(TILE.QUARTZ, '#eee9dd'),
  [B.PRISMARINE]: nat(TILE.PRISMARINE, '#3f8f86'),
  [B.SEA_LANTERN]: nat(TILE.SEA_LANTERN, '#cfeee6'),
  [B.MOSS]: nat(TILE.MOSS, '#5a8f3a'),
  [B.MUSHROOM_RED]: nat(TILE.MUSHROOM_RED, '#c23a32'),
  [B.MUSHROOM_BROWN]: nat(TILE.MUSHROOM_BROWN, '#8a6a4a'),
  [B.CACTUS]: nat3(TILE.CACTUS_TOP, TILE.CACTUS_SIDE, TILE.CACTUS_TOP, '#4f9a3a'),
  [B.MUD]: nat(TILE.MUD, '#4a3a30'),
  [B.NETHER_BRICK]: nat(TILE.NETHER_BRICK, '#3a1c22'),
  [B.MAGMA]: nat(TILE.MAGMA, '#a85a2a'),
  [B.MELON]: nat3(TILE.MELON_TOP, TILE.MELON_SIDE, TILE.MELON_TOP, '#3f7a2e'),
  [B.HAY]: nat3(TILE.HAY_TOP, TILE.HAY_SIDE, TILE.HAY_TOP, '#d8b23a'),
  [B.NOTE_BLOCK]: nat(TILE.NOTE_BLOCK, '#8a5a30'),
  [B.SPONGE]: nat(TILE.SPONGE, '#d8c24a'),
  // Lego bricks — vivid studded blocks (one neutral tile set, tinted per colour).
  [B.LEGO_RED]: tinted(TILE.LEGO_TOP, TILE.LEGO_SIDE, TILE.LEGO_SIDE, [0.86, 0.16, 0.16], '#d62828'),
  [B.LEGO_ORANGE]: tinted(TILE.LEGO_TOP, TILE.LEGO_SIDE, TILE.LEGO_SIDE, [0.95, 0.55, 0.12], '#f28c1e'),
  [B.LEGO_YELLOW]: tinted(TILE.LEGO_TOP, TILE.LEGO_SIDE, TILE.LEGO_SIDE, [0.98, 0.82, 0.18], '#f7d22e'),
  [B.LEGO_GREEN]: tinted(TILE.LEGO_TOP, TILE.LEGO_SIDE, TILE.LEGO_SIDE, [0.30, 0.66, 0.28], '#3fa83f'),
  [B.LEGO_BLUE]: tinted(TILE.LEGO_TOP, TILE.LEGO_SIDE, TILE.LEGO_SIDE, [0.18, 0.40, 0.82], '#2e66d6'),
  [B.LEGO_CYAN]: tinted(TILE.LEGO_TOP, TILE.LEGO_SIDE, TILE.LEGO_SIDE, [0.20, 0.72, 0.80], '#33bccd'),
  [B.LEGO_PURPLE]: tinted(TILE.LEGO_TOP, TILE.LEGO_SIDE, TILE.LEGO_SIDE, [0.55, 0.30, 0.78], '#9050d0'),
  [B.LEGO_PINK]: tinted(TILE.LEGO_TOP, TILE.LEGO_SIDE, TILE.LEGO_SIDE, [0.95, 0.55, 0.74], '#f28cbf'),
  [B.LEGO_WHITE]: tinted(TILE.LEGO_TOP, TILE.LEGO_SIDE, TILE.LEGO_SIDE, [0.96, 0.96, 0.97], '#f5f5f7'),
  [B.LEGO_BLACK]: tinted(TILE.LEGO_TOP, TILE.LEGO_SIDE, TILE.LEGO_SIDE, [0.20, 0.20, 0.23], '#33333a'),
  [B.LEGO_BROWN]: tinted(TILE.LEGO_TOP, TILE.LEGO_SIDE, TILE.LEGO_SIDE, [0.55, 0.36, 0.20], '#8a5a32'),
  [B.LEGO_LIME]: tinted(TILE.LEGO_TOP, TILE.LEGO_SIDE, TILE.LEGO_SIDE, [0.55, 0.80, 0.25], '#8ccc40'),
};

// Build blocks grouped into categories for the pop-up picker.
export const CATEGORIES = [
  { name: 'Nature', blocks: [B.GRASS, B.DIRT, B.SAND, B.GRAVEL, B.SNOW, B.MOSS, B.MUD, B.SAPLING, B.LOG, B.BIRCH_LOG, B.LEAVES, B.CACTUS, B.MUSHROOM_RED, B.MUSHROOM_BROWN] },
  { name: 'Water 🪣', blocks: [B.WATER] },
  { name: 'House 🏠', blocks: [B.DOOR, B.BED_FOOT, B.GLASS, B.LANTERN, B.PLANKS, B.BRICK] },
  { name: 'Boom 💥', blocks: [B.TNT] },
  // Tap a lever → it powers redstone wire → wired-up lamps light up.
  { name: 'Redstone ⚙️', blocks: [B.LEVER, B.REDSTONE, B.REDLAMP] },
  { name: 'Stone 🪨', blocks: [B.STONE, B.COBBLE, B.STONE_BRICK, B.DEEPSLATE, B.GRANITE, B.ANDESITE, B.DIORITE, B.QUARTZ, B.PRISMARINE, B.SANDSTONE, B.END_STONE, B.BRICK, B.OBSIDIAN] },
  { name: 'Shiny 💎', blocks: [B.IRON_BLOCK, B.GOLD_BLOCK, B.DIAMOND_BLOCK, B.EMERALD_BLOCK, B.LAPIS_BLOCK, B.REDSTONE_BLOCK, B.COAL_BLOCK, B.AMETHYST, B.GOLD, B.DIAMOND, B.ICE] },
  { name: 'Wood', blocks: [B.PLANKS, B.BIRCH_PLANKS, B.DARK_PLANKS, B.BOOKSHELF] },
  { name: 'Decor 🪑', blocks: [B.MELON, B.HAY, B.NOTE_BLOCK, B.SPONGE, B.PUMPKIN, B.GLOWSTONE, B.SEA_LANTERN] },
  { name: 'Fun', blocks: [B.PUMPKIN, B.SLIME, B.BARRIER] },
  // Shown in the picker only after it's bought in the 💎 shop.
  { name: 'Special ✨', blocks: [B.RAINBOW], locked: 'rainbow' },
  // Shown only once the Mega TNT upgrade is bought in the 💎 shop.
  { name: 'Mega 💣', blocks: [B.MEGA_TNT], locked: 'megatnt' },
  // Unlocked by buying Lego World in the 💎 shop.
  { name: 'Lego 🧱', blocks: [B.LEGO_RED, B.LEGO_ORANGE, B.LEGO_YELLOW, B.LEGO_LIME, B.LEGO_GREEN, B.LEGO_CYAN, B.LEGO_BLUE, B.LEGO_PURPLE, B.LEGO_PINK, B.LEGO_WHITE, B.LEGO_BLACK, B.LEGO_BROWN], locked: 'legoworld' },
  { name: 'Nether 🔥', blocks: [B.NETHERRACK, B.NETHER_BRICK, B.MAGMA, B.LAVA] },
  { name: 'Colours', blocks: [B.RED, B.ORANGE, B.YELLOW, B.GREEN, B.CYAN, B.BLUE, B.PURPLE, B.PINK, B.WHITE, B.BLACK] },
];

// Flat list (first entry is the default selected block).
export const PALETTE = CATEGORIES.flatMap((c) => c.blocks);

// CCW, outward-facing quads. Each vertex: position offset (o) and uv selector.
const FACES = [
  { n: [0, 1, 0], shade: 1.00, slot: 'top', v: [{ o: [0, 1, 1], uv: [0, 1] }, { o: [1, 1, 1], uv: [1, 1] }, { o: [1, 1, 0], uv: [1, 0] }, { o: [0, 1, 0], uv: [0, 0] }] },
  { n: [0, -1, 0], shade: 0.50, slot: 'bottom', v: [{ o: [0, 0, 0], uv: [0, 0] }, { o: [1, 0, 0], uv: [1, 0] }, { o: [1, 0, 1], uv: [1, 1] }, { o: [0, 0, 1], uv: [0, 1] }] },
  { n: [0, 0, -1], shade: 0.70, slot: 'side', v: [{ o: [1, 0, 0], uv: [1, 0] }, { o: [0, 0, 0], uv: [0, 0] }, { o: [0, 1, 0], uv: [0, 1] }, { o: [1, 1, 0], uv: [1, 1] }] },
  { n: [0, 0, 1], shade: 0.85, slot: 'side', v: [{ o: [0, 0, 1], uv: [0, 0] }, { o: [1, 0, 1], uv: [1, 0] }, { o: [1, 1, 1], uv: [1, 1] }, { o: [0, 1, 1], uv: [0, 1] }] },
  { n: [-1, 0, 0], shade: 0.65, slot: 'side', v: [{ o: [0, 0, 0], uv: [0, 0] }, { o: [0, 0, 1], uv: [1, 0] }, { o: [0, 1, 1], uv: [1, 1] }, { o: [0, 1, 0], uv: [0, 1] }] },
  { n: [1, 0, 0], shade: 0.80, slot: 'side', v: [{ o: [1, 0, 1], uv: [0, 0] }, { o: [1, 0, 0], uv: [1, 0] }, { o: [1, 1, 0], uv: [1, 1] }, { o: [1, 1, 1], uv: [0, 1] }] },
];
const AO_LEVEL = [0.5, 0.7, 0.85, 1.0];

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class World {
  constructor(gl) {
    this.gl = gl;
    this.data = new Uint8Array(SX * SY * SZ);
    this.meshes = new Array(CXN * CZN).fill(null);
    this.dirty = new Set();
    this.placed = new Set();  // packed indices of blocks the *player* placed
    this.spawn = [SX / 2 + 0.5, 12, SZ / 2 + 0.5];
    this.portals = [];        // gateways: { f:[ox,oy,oz], dest, a:[x,y,z], active }
  }

  idx(x, y, z) { return x + z * SX + y * SX * SZ; }

  get(x, y, z) {
    if (y < 0 || y >= SY || x < 0 || x >= SX || z < 0 || z >= SZ) return B.AIR;
    return this.data[this.idx(x, y, z)];
  }

  // For meshing: out-of-bounds sides/bottom count as opaque so we don't draw
  // the outer shell of the world; above the world is open sky.
  opaqueAt(x, y, z) {
    if (y >= SY) return false;
    if (y < 0) return true;
    if (x < 0 || x >= SX || z < 0 || z >= SZ) return true;
    const id = this.data[this.idx(x, y, z)];
    if (id === B.AIR) return false;
    const def = BLOCKS[id];
    return !(def && def.seethrough);     // glass/leaves don't hide what's behind them
  }

  // For physics: borders act as walls. Passable blocks (the portal swirl) are
  // walk-through so the player can step into the gateway.
  solidAt(x, y, z) {
    if (y < 0) return true;
    if (y >= SY) return false;
    if (x < 0 || x >= SX || z < 0 || z >= SZ) return true;
    const id = this.data[this.idx(x, y, z)];
    if (id === B.AIR) return false;
    const def = BLOCKS[id];
    return !(def && def.passable);
  }

  heightAt(x, z) {
    if (x < 0 || x >= SX || z < 0 || z >= SZ) return -1;
    for (let y = SY - 1; y >= 0; y--) if (this.data[this.idx(x, y, z)] !== B.AIR) return y;
    return -1;
  }

  chunkIndex(cx, cz) { return cx + cz * CXN; }

  markDirty(x, z) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const cx = Math.floor((x + dx) / CHUNK), cz = Math.floor((z + dz) / CHUNK);
      if (cx >= 0 && cx < CXN && cz >= 0 && cz < CZN) this.dirty.add(this.chunkIndex(cx, cz));
    }
  }

  set(x, y, z, id) {
    if (y < 0 || y >= SY || x < 0 || x >= SX || z < 0 || z >= SZ) return;
    this.data[this.idx(x, y, z)] = id;
    this.markDirty(x, z);
  }

  generate() {
    const rand = mulberry32(1337);
    this.data.fill(B.AIR);
    this.placed = new Set();
    this.portals = [];
    // Gentle rolling hills of grass.
    for (let x = 0; x < SX; x++) {
      for (let z = 0; z < SZ; z++) {
        let h = 6 + 1.6 * Math.sin(x * 0.18) + 1.6 * Math.cos(z * 0.16)
          + 1.3 * Math.sin((x + z) * 0.09);
        h = Math.max(3, Math.min(13, Math.round(h)));
        for (let y = 0; y <= h; y++) {
          let id;
          if (y === 0) id = B.BEDROCK;
          else if (y === h) id = B.GRASS;
          else if (y >= h - 2) id = B.DIRT;
          else id = B.STONE;
          this.data[this.idx(x, y, z)] = id;
        }
      }
    }

    // A big sandy beach lagoon to fly over and splash into.
    this.carveBeach();

    // Scatter friendly little trees on grass, away from the beach.
    let trees = 0;
    for (let attempt = 0; attempt < 400 && trees < 16; attempt++) {
      const x = 4 + Math.floor(rand() * (SX - 8));
      const z = 4 + Math.floor(rand() * (SZ - 8));
      const h = this.heightAt(x, z);
      if (this.data[this.idx(x, h, z)] !== B.GRASS) continue;
      if (Math.hypot(x - BEACH.x, z - BEACH.z) < BEACH.r + 3) continue;
      this.placeTree(x, h + 1, z, rand);
      trees++;
    }

    // Hidden treasure to discover by digging: pockets of gold + diamond, kept
    // down in the stone layer so they feel like a real find.
    for (let i = 0; i < 34; i++) {
      const id = rand() < 0.6 ? B.GOLD : B.DIAMOND;
      const x = 2 + Math.floor(rand() * (SX - 4)), z = 2 + Math.floor(rand() * (SZ - 4));
      const surf = this.heightAt(x, z);
      if (surf < 5) continue;
      const cy = 1 + Math.floor(rand() * (surf - 3));   // within the stone band
      const n = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < n; k++) {
        const bx = x + Math.floor(rand() * 2), by = cy + Math.floor(rand() * 2), bz = z + Math.floor(rand() * 2);
        if (this.get(bx, by, bz) === B.STONE) this.data[this.idx(bx, by, bz)] = id;
      }
    }

    // Spawn on solid ground in the middle.
    const sh = this.heightAt(Math.floor(this.spawn[0]), Math.floor(this.spawn[2]));
    this.spawn[1] = sh + 2;
  }

  // Carve a gentle sandy lagoon: a bowl of water rimmed by a sand beach. Used
  // both for fresh worlds and (safely) to add a beach to older saved worlds.
  carveBeach() {
    const { x: bx, z: bz, r: br, waterY } = BEACH;
    const x0 = Math.max(1, bx - br - 3), x1 = Math.min(SX - 2, bx + br + 3);
    const z0 = Math.max(1, bz - br - 3), z1 = Math.min(SZ - 2, bz + br + 3);
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const d = Math.hypot(x - bx, z - bz);
        if (d >= br + 2.5) continue;
        const top = this.heightAt(x, z);
        const floor = Math.max(1, Math.min(top, (waterY - 3) + Math.round((d / br) * 3)));
        for (let y = floor + 1; y < SY; y++) {
          if (this.data[this.idx(x, y, z)] !== B.AIR) this.data[this.idx(x, y, z)] = B.AIR;
        }
        this.data[this.idx(x, floor, z)] = B.SAND;        // sandy bottom + beach
        for (let y = floor + 1; y <= waterY; y++) this.data[this.idx(x, y, z)] = B.WATER;
        this.markDirty(x, z);
      }
    }
  }

  // Add the beach to a loaded world only if the player hasn't built in that
  // spot — so we never disturb anything Ezra made.
  carveBeachIfClear() {
    const { x: bx, z: bz, r: br } = BEACH;
    for (const key of this.placed) {
      const col = key % (SX * SZ);
      const px = col % SX, pz = Math.floor(col / SX);
      if (Math.hypot(px - bx, pz - bz) < br + 3) return false;
    }
    this.carveBeach();
    return true;
  }

  placeTree(x, y, z, rand) {
    const th = 4 + Math.floor(rand() * 2);
    for (let i = 0; i < th; i++) this.data[this.idx(x, y + i, z)] = B.LOG;
    const top = y + th;
    for (let dy = -2; dy <= 0; dy++) {
      const r = dy === 0 ? 1 : 2;
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (dx === 0 && dz === 0 && dy < 0) continue;
        if (Math.abs(dx) === r && Math.abs(dz) === r && rand() < 0.5) continue;
        const lx = x + dx, ly = top + dy, lz = z + dz;
        if (lx < 0 || lx >= SX || lz < 0 || lz >= SZ || ly >= SY) continue;
        if (this.data[this.idx(lx, ly, lz)] === B.AIR) this.data[this.idx(lx, ly, lz)] = B.LEAVES;
      }
    }
    this.data[this.idx(x, top + 1, z)] = B.LEAVES;
  }

  // A reddish Nether world: netherrack ground with scattered glowstone (light)
  // and small lava patches (glow). Open-topped and bright so it's never gloomy.
  generateNether() {
    this.data.fill(B.AIR);
    this.placed = new Set();
    const rand = mulberry32(4242);
    for (let x = 0; x < SX; x++) {
      for (let z = 0; z < SZ; z++) {
        let h = 5 + Math.round(1.5 * Math.sin(x * 0.2) + 1.5 * Math.cos(z * 0.18) + 1.2 * Math.sin((x + z) * 0.1));
        h = Math.max(3, Math.min(11, h));
        for (let y = 0; y <= h; y++) this.data[this.idx(x, y, z)] = (y === 0) ? B.BEDROCK : B.NETHERRACK;
      }
    }
    for (let i = 0; i < 60; i++) {
      const x = 3 + Math.floor(rand() * (SX - 6)), z = 3 + Math.floor(rand() * (SZ - 6));
      const h = this.heightAt(x, z);
      if (rand() < 0.5) this.data[this.idx(x, h + 1, z)] = B.GLOWSTONE;
      else this.data[this.idx(x, h, z)] = B.LAVA;
    }
    // A little buried treasure down here too.
    for (let i = 0; i < 14; i++) {
      const id = rand() < 0.6 ? B.GOLD : B.DIAMOND;
      const x = 2 + Math.floor(rand() * (SX - 4)), z = 2 + Math.floor(rand() * (SZ - 4));
      const surf = this.heightAt(x, z);
      if (surf < 3) continue;
      const cy = 1 + Math.floor(rand() * (surf - 1));
      if (this.get(x, cy, z) === B.NETHERRACK) this.data[this.idx(x, cy, z)] = id;
    }
    this.spawn = [SX / 2 + 0.5, 12, SZ / 2 + 0.5];
    this.spawn[1] = this.heightAt(Math.floor(this.spawn[0]), Math.floor(this.spawn[2])) + 2;
  }

  // A shiny Gold World: golden hills over sand, glowstone lamps + diamond
  // outcrops, and loads of buried treasure to dig up.
  generateGold() {
    this.data.fill(B.AIR);
    this.placed = new Set();
    this.portals = [];
    const rand = mulberry32(7777);
    for (let x = 0; x < SX; x++) {
      for (let z = 0; z < SZ; z++) {
        let h = 6 + Math.round(1.4 * Math.sin(x * 0.16) + 1.4 * Math.cos(z * 0.15) + 1.1 * Math.sin((x + z) * 0.08));
        h = Math.max(3, Math.min(12, h));
        for (let y = 0; y <= h; y++) {
          let id;
          if (y === 0) id = B.BEDROCK;
          else if (y === h) id = B.GOLD;
          else if (y >= h - 2) id = B.SAND;
          else id = B.STONE;
          this.data[this.idx(x, y, z)] = id;
        }
      }
    }
    for (let i = 0; i < 70; i++) {                 // glowstone lamps + diamond outcrops
      const x = 2 + Math.floor(rand() * (SX - 4)), z = 2 + Math.floor(rand() * (SZ - 4));
      const h = this.heightAt(x, z);
      this.data[this.idx(x, h + 1, z)] = rand() < 0.5 ? B.GLOWSTONE : B.DIAMOND;
    }
    for (let i = 0; i < 60; i++) {                 // lots of buried treasure
      const id = rand() < 0.5 ? B.GOLD : B.DIAMOND;
      const x = 2 + Math.floor(rand() * (SX - 4)), z = 2 + Math.floor(rand() * (SZ - 4));
      const surf = this.heightAt(x, z);
      if (surf < 4) continue;
      const cy = 1 + Math.floor(rand() * (surf - 2));
      if (this.get(x, cy, z) === B.STONE) this.data[this.idx(x, cy, z)] = id;
    }
    this.spawn = [SX / 2 + 0.5, 12, SZ / 2 + 0.5];
    this.spawn[1] = this.heightAt(Math.floor(this.spawn[0]), Math.floor(this.spawn[2])) + 2;
  }

  // A cosy Ant World: brown dirt + gravel ground with little dirt anthills and
  // tunnel mouths — home to friendly ants you can pet.
  generateAnt() {
    this.data.fill(B.AIR);
    this.placed = new Set();
    this.portals = [];
    const rand = mulberry32(5151);
    for (let x = 0; x < SX; x++) {
      for (let z = 0; z < SZ; z++) {
        let h = 6 + Math.round(1.2 * Math.sin(x * 0.14) + 1.2 * Math.cos(z * 0.13));
        h = Math.max(4, Math.min(11, h));
        for (let y = 0; y <= h; y++) {
          let id;
          if (y === 0) id = B.BEDROCK;
          else if (y === h) id = rand() < 0.2 ? B.SAND : B.DIRT;
          else if (y >= h - 3) id = B.DIRT;
          else id = rand() < 0.3 ? B.GRAVEL : B.STONE;
          this.data[this.idx(x, y, z)] = id;
        }
      }
    }
    for (let i = 0; i < 16; i++) {                 // little dirt anthills with a hole on top
      const x = 4 + Math.floor(rand() * (SX - 8)), z = 4 + Math.floor(rand() * (SZ - 8));
      const h = this.heightAt(x, z);
      const r = 1 + Math.floor(rand() * 2);
      for (let dy = 1; dy <= r + 1; dy++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) + Math.abs(dz) > (r + 1 - dy) + 1) continue;
        const lx = x + dx, lz = z + dz;
        if (lx > 0 && lx < SX && lz > 0 && lz < SZ) this.data[this.idx(lx, h + dy, lz)] = B.DIRT;
      }
      this.data[this.idx(x, h + 1, z)] = B.AIR;     // tunnel mouth
    }
    for (let i = 0; i < 18; i++) {                 // a little treasure underground
      const id = rand() < 0.6 ? B.GOLD : B.DIAMOND;
      const x = 2 + Math.floor(rand() * (SX - 4)), z = 2 + Math.floor(rand() * (SZ - 4));
      const surf = this.heightAt(x, z);
      if (surf < 4) continue;
      const cy = 1 + Math.floor(rand() * (surf - 2));
      if (this.get(x, cy, z) === B.STONE) this.data[this.idx(x, cy, z)] = id;
    }
    this.spawn = [SX / 2 + 0.5, 12, SZ / 2 + 0.5];
    this.spawn[1] = this.heightAt(Math.floor(this.spawn[0]), Math.floor(this.spawn[2])) + 2;
  }

  // A rocky TNT World: piles of TNT and stone towers, just waiting to be blown up.
  generateTnt() {
    this.data.fill(B.AIR);
    this.placed = new Set();
    this.portals = [];
    const rand = mulberry32(9090);
    for (let x = 0; x < SX; x++) {
      for (let z = 0; z < SZ; z++) {
        let h = 5 + Math.round(1.0 * Math.sin(x * 0.15) + 1.0 * Math.cos(z * 0.14));
        h = Math.max(3, Math.min(9, h));
        for (let y = 0; y <= h; y++) this.data[this.idx(x, y, z)] = (y === 0) ? B.BEDROCK : B.STONE;
      }
    }
    for (let i = 0; i < 44; i++) {                  // scattered TNT piles
      const x = 3 + Math.floor(rand() * (SX - 6)), z = 3 + Math.floor(rand() * (SZ - 6));
      const h = this.heightAt(x, z), pile = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < pile; k++) this.data[this.idx(x, h + 1 + k, z)] = B.TNT;
    }
    for (let i = 0; i < 22; i++) {                  // stone towers (with a little TNT inside)
      const x = 3 + Math.floor(rand() * (SX - 6)), z = 3 + Math.floor(rand() * (SZ - 6));
      const h = this.heightAt(x, z), th = 2 + Math.floor(rand() * 4);
      for (let k = 1; k <= th; k++) this.data[this.idx(x, h + k, z)] = (rand() < 0.3) ? B.TNT : B.STONE;
    }
    this.spawn = [SX / 2 + 0.5, 12, SZ / 2 + 0.5];
    this.spawn[1] = this.heightAt(Math.floor(this.spawn[0]), Math.floor(this.spawn[2])) + 2;
  }

  // A dreamy Sky World: grassy islands floating in a bright sky, with trees,
  // glowstone lanterns, buried treasure, and soft clouds. Made for flying.
  generateSky() {
    this.data.fill(B.AIR);
    this.placed = new Set();
    this.portals = [];
    const rand = mulberry32(2024);
    const cxC = Math.floor(SX / 2), czC = Math.floor(SZ / 2);
    // Build one floating island: a grassy disc that narrows as it goes down.
    const island = (cx, cz, r, ty) => {
      for (let dy = 0; dy < 6; dy++) {
        const rr = r - dy * 1.2;
        const y = ty - dy;
        if (rr < 0.6 || y < 1) break;
        for (let x = Math.max(1, Math.floor(cx - rr)); x <= Math.min(SX - 2, Math.ceil(cx + rr)); x++) {
          for (let z = Math.max(1, Math.floor(cz - rr)); z <= Math.min(SZ - 2, Math.ceil(cz + rr)); z++) {
            if (Math.hypot(x - cx, z - cz) > rr) continue;
            this.data[this.idx(x, y, z)] = dy === 0 ? B.GRASS : (dy <= 2 ? B.DIRT : B.STONE);
          }
        }
      }
    };
    // A big central island so spawn + the home portal sit on solid ground.
    island(cxC, czC, 8, 10);
    for (let i = 0; i < 16; i++) {
      const cx = 6 + Math.floor(rand() * (SX - 12)), cz = 6 + Math.floor(rand() * (SZ - 12));
      if (Math.hypot(cx - cxC, cz - czC) < 12) continue;        // keep the centre clear
      island(cx, cz, 3 + Math.floor(rand() * 4), 7 + Math.floor(rand() * 9));
    }
    // Friendly trees on the grassy tops.
    let trees = 0;
    for (let attempt = 0; attempt < 300 && trees < 10; attempt++) {
      const x = 3 + Math.floor(rand() * (SX - 6)), z = 3 + Math.floor(rand() * (SZ - 6));
      const h = this.heightAt(x, z);
      if (h > 0 && this.get(x, h, z) === B.GRASS) { this.placeTree(x, h + 1, z, rand); trees++; }
    }
    // Glowstone lanterns + a little buried treasure to dig up.
    for (let i = 0; i < 40; i++) {
      const x = 2 + Math.floor(rand() * (SX - 4)), z = 2 + Math.floor(rand() * (SZ - 4));
      const h = this.heightAt(x, z);
      if (h < 1) continue;
      if (rand() < 0.4) this.data[this.idx(x, h + 1, z)] = B.GLOWSTONE;
      else { const cy = Math.max(1, h - 1 - Math.floor(rand() * 2)); const cur = this.get(x, cy, z); if (cur === B.STONE || cur === B.DIRT) this.data[this.idx(x, cy, z)] = rand() < 0.5 ? B.GOLD : B.DIAMOND; }
    }
    // Soft clouds drifting up high (kept clear of the centre/spawn).
    for (let i = 0; i < 26; i++) {
      const x = 2 + Math.floor(rand() * (SX - 4)), z = 2 + Math.floor(rand() * (SZ - 4)), y = 16 + Math.floor(rand() * 4);
      if (Math.hypot(x - cxC, z - czC) < 12) continue;
      this.data[this.idx(x, y, z)] = B.SNOW;
      if (x + 1 < SX) this.data[this.idx(x + 1, y, z)] = B.SNOW;
      if (z + 1 < SZ) this.data[this.idx(x, y, z + 1)] = B.SNOW;
    }
    this.spawn = [cxC + 0.5, 12, czC + 0.5];
    this.spawn[1] = this.heightAt(cxC, czC) + 2;
  }

  // The End: a pale End-stone island floating in a dark sky, ringed by obsidian
  // pillars topped with glowing End Crystals — home to the friendly dragon.
  // The crystal spots are stored so the Dragon manager can put a crystal on each.
  generateEnd() {
    const rand = mulberry32(7777);
    this.data.fill(B.AIR);
    this.placed = new Set();
    this.portals = [];
    this.crystalSpots = [];
    const cxC = Math.floor(SX / 2), czC = Math.floor(SZ / 2), top = 9;
    // One big flat-topped End-stone island in the middle.
    for (let dy = 0; dy < 7; dy++) {
      const rr = 16 - dy * 1.6, y = top - dy;
      if (rr < 1 || y < 1) break;
      for (let x = Math.max(1, Math.floor(cxC - rr)); x <= Math.min(SX - 2, Math.ceil(cxC + rr)); x++)
        for (let z = Math.max(1, Math.floor(czC - rr)); z <= Math.min(SZ - 2, Math.ceil(czC + rr)); z++)
          if (Math.hypot(x - cxC, z - czC) <= rr) this.data[this.idx(x, y, z)] = B.END_STONE;
    }
    // A ring of obsidian pillars, each topped with an End Crystal.
    const pillars = 6, ringR = 12;
    for (let i = 0; i < pillars; i++) {
      const a = (i / pillars) * Math.PI * 2;
      const px = Math.round(cxC + Math.cos(a) * ringR), pz = Math.round(czC + Math.sin(a) * ringR);
      const ph = top + 4 + (i % 3);                    // varied pillar heights
      for (let y = top + 1; y <= ph; y++) this.data[this.idx(px, y, pz)] = B.OBSIDIAN;
      this.crystalSpots.push([px, ph + 2, pz]);        // crystal floats just above the pillar
    }
    this.spawn = [cxC + 0.5, top + 2, czC + 0.5];
  }

  // Lego World: a big flat green Lego baseplate (studded) under a bright sky —
  // a clean Lego table to build vivid brick creations on.
  generateLego() {
    this.data.fill(B.AIR);
    this.placed = new Set();
    this.portals = [];
    const base = 6;
    for (let x = 0; x < SX; x++) for (let z = 0; z < SZ; z++) {
      this.data[this.idx(x, 0, z)] = B.BEDROCK;
      for (let y = 1; y < base; y++) this.data[this.idx(x, y, z)] = B.LEGO_GREEN;
      this.data[this.idx(x, base, z)] = B.LEGO_GREEN;     // studded top = the baseplate
    }
    // A few cheerful sample brick stacks to spark ideas (not added to `placed`).
    const stacks = [[16, 16, B.LEGO_RED], [22, 18, B.LEGO_BLUE], [44, 40, B.LEGO_YELLOW], [40, 22, B.LEGO_PURPLE], [20, 44, B.LEGO_CYAN]];
    for (const [x, z, id] of stacks) for (let y = 1; y <= 3; y++) this.data[this.idx(x, base + y, z)] = id;
    this.spawn = [SX / 2 + 0.5, base + 2, SZ / 2 + 0.5];
  }

  // Boom! Clear destructible blocks within radius r of (cx,cy,cz). Returns the
  // positions of any *other* TNT caught in the blast (for chain reactions).
  explode(cx, cy, cz, r) {
    const chain = [], r2 = r * r;
    const y0 = Math.max(1, Math.floor(cy - r)), y1 = Math.min(SY - 1, Math.floor(cy + r));
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(SX - 1, Math.floor(cx + r));
    const z0 = Math.max(0, Math.floor(cz - r)), z1 = Math.min(SZ - 1, Math.floor(cz + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, dz = z + 0.5 - cz;
      if (dx * dx + dy * dy + dz * dz > r2) continue;
      const id = this.get(x, y, z);
      if (id === B.AIR) continue;
      const def = BLOCKS[id];
      if (def && def.indestructible) continue;       // bedrock + portal survive
      if (this.isPortalBlock(x, y, z)) continue;     // portal frames survive blasts
      if (id === B.TNT || id === B.MEGA_TNT) { chain.push([x, y, z]); continue; }
      this.set(x, y, z, B.AIR);
      this.placed.delete(this.idx(x, y, z));
    }
    return chain;
  }

  // Build a portal: an obsidian frame on a small pad with a step in front. The
  // swirl interior is filled only when `active` (so it can be a locked reward).
  // `dest` is the world key this gateway leads to; returns the portal record.
  addPortal(ox, oz, groundBlock, dest, active) {
    let oy = 1;
    for (let dx = 0; dx < 4; dx++) oy = Math.max(oy, this.heightAt(ox + dx, oz) + 1, this.heightAt(ox + dx, oz + 1) + 1);
    for (let dx = 0; dx < 4; dx++) {
      for (let yy = this.heightAt(ox + dx, oz) + 1; yy < oy; yy++) this.set(ox + dx, yy, oz, groundBlock);
      for (let yy = this.heightAt(ox + dx, oz + 1) + 1; yy < oy; yy++) this.set(ox + dx, yy, oz + 1, groundBlock);
      for (let dy = 0; dy < 5; dy++) {
        const edge = (dx === 0 || dx === 3 || dy === 0 || dy === 4);
        if (edge) this.set(ox + dx, oy + dy, oz, B.OBSIDIAN);
      }
    }
    const portal = { f: [ox, oy, oz], dest, a: [ox + 1.5, oy, oz + 1.5], active: false };
    this.portals.push(portal);
    this.setPortalActive(portal, !!active);
    return portal;
  }

  // Fill (or clear) one portal's swirl — used to open a gateway once it's earned.
  setPortalActive(portal, active) {
    if (!portal) return;
    const [ox, oy, oz] = portal.f;
    for (let dx = 1; dx < 3; dx++) for (let dy = 1; dy < 4; dy++) this.set(ox + dx, oy + dy, oz, active ? B.PORTAL : B.AIR);
    portal.active = !!active;
  }

  // Which active portal's swirl is at this block? (for stepping through). Works
  // for any portal — the built obsidian frames and the auto ones — by finding the
  // nearest active portal whenever you're standing in a PORTAL swirl block.
  portalAt(x, y, z) {
    if (this.get(x, y, z) !== B.PORTAL) return null;
    let best = null, bd = Infinity;
    for (const p of this.portals) {
      if (!p.active) continue;
      const dx = x - p.a[0], dy = y - p.a[1], dz = z - p.a[2], d = dx * dx + dy * dy + dz * dz;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  // Minecraft-style: is (x,y,z) an air cell inside a complete obsidian frame
  // (a closed vertical rectangle)? Returns the interior air cells, or null.
  findFrame(x, y, z) {
    if (this.get(x, y, z) !== B.AIR) return null;
    for (const ax of [0, 1]) {               // 0 = frame in the XY plane, 1 = ZY plane
      const cells = [], seen = new Set(), stack = [[x, y, z]];
      let ok = true;
      while (stack.length) {
        const [cx, cy, cz] = stack.pop();
        const k = cx + ',' + cy + ',' + cz;
        if (seen.has(k)) continue; seen.add(k);
        if (cx < 0 || cx >= SX || cy < 0 || cy >= SY || cz < 0 || cz >= SZ) { ok = false; break; }
        const id = this.get(cx, cy, cz);
        if (id === B.OBSIDIAN) continue;       // frame wall — bounds the flood
        if (id !== B.AIR) { ok = false; break; }   // leaky / not a clean frame
        cells.push([cx, cy, cz]);
        if (cells.length > 30) { ok = false; break; }  // open or too big
        stack.push([cx, cy + 1, cz], [cx, cy - 1, cz]);
        if (ax === 0) stack.push([cx + 1, cy, cz], [cx - 1, cy, cz]);
        else stack.push([cx, cy, cz + 1], [cx, cy, cz - 1]);
      }
      if (ok && cells.length >= 2 && cells.length <= 30) return cells;
    }
    return null;
  }

  // Light a found frame: fill its interior with the portal swirl + register the
  // gateway leading to `dest`. Returns the portal.
  lightFrame(cells, dest) {
    let minX = 1e9, minY = 1e9, minZ = 1e9;
    for (const c of cells) { this.set(c[0], c[1], c[2], B.PORTAL); minX = Math.min(minX, c[0]); minY = Math.min(minY, c[1]); minZ = Math.min(minZ, c[2]); }
    const bottom = cells.slice().sort((a, b) => a[1] - b[1])[0];
    const portal = { f: [minX - 1, minY - 1, minZ], dest, a: [bottom[0] + 0.5, bottom[1], bottom[2] + 0.5], active: true };
    this.portals.push(portal);
    return portal;
  }

  // Is this block part of any portal (frame or swirl)? Such blocks are protected
  // from digging and explosions, so a gateway can never be accidentally lost.
  isPortalBlock(x, y, z) {
    for (const p of this.portals) {
      const [ox, oy, oz] = p.f;
      if (z === oz && x >= ox && x <= ox + 3 && y >= oy && y <= oy + 4) return true;
    }
    return false;
  }

  // Redstone! Flip a lever (LEVER_ON) → power spreads through REDSTONE wire to
  // any touching lamp, which lights up (REDLAMP → REDLAMP_ON). Recomputed from
  // scratch whenever a lever/wire/lamp changes. Returns how many lamps are lit.
  updateRedstone() {
    const leverOn = [], lamps = [];
    for (let i = 0; i < this.data.length; i++) {
      const id = this.data[i];
      if (id === B.LEVER_ON) leverOn.push(i);
      else if (id === B.REDLAMP || id === B.REDLAMP_ON) lamps.push(i);
    }
    if (!lamps.length) return 0;                 // nothing to light → done fast
    // Flood power through connected redstone wire (6-neighbour).
    const powered = new Set(), q = [];
    const N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    const xyz = (i) => [i % SX, Math.floor(i / (SX * SZ)), Math.floor(i / SX) % SZ];
    const feedWire = (x, y, z) => {
      if (this.get(x, y, z) !== B.REDSTONE) return;
      const k = this.idx(x, y, z);
      if (!powered.has(k)) { powered.add(k); q.push([x, y, z]); }
    };
    for (const li of leverOn) { const [x, y, z] = xyz(li); for (const [dx, dy, dz] of N) feedWire(x + dx, y + dy, z + dz); }
    while (q.length) { const [x, y, z] = q.pop(); for (const [dx, dy, dz] of N) feedWire(x + dx, y + dy, z + dz); }
    // A lamp lights if it touches an on-lever or a powered wire.
    let lit = 0;
    for (const li of lamps) {
      const [x, y, z] = xyz(li);
      let on = false;
      for (const [dx, dy, dz] of N) {
        const nx = x + dx, ny = y + dy, nz = z + dz, nid = this.get(nx, ny, nz);
        if (nid === B.LEVER_ON || (nid === B.REDSTONE && powered.has(this.idx(nx, ny, nz)))) { on = true; break; }
      }
      const want = on ? B.REDLAMP_ON : B.REDLAMP;
      if (this.data[li] !== want) this.set(x, y, z, want);
      if (on) lit++;
    }
    return lit;
  }

  markAllDirty() { for (let i = 0; i < this.meshes.length; i++) this.dirty.add(i); }

  // Ambient occlusion for one face vertex (classic voxel AO).
  vertexAO(px, py, pz, n, o) {
    const cx = px + n[0], cy = py + n[1], cz = pz + n[2];
    // The two axes lying in the face plane (where the normal component is 0).
    const ax = [], sgn = [];
    for (let k = 0; k < 3; k++) if (n[k] === 0) { ax.push(k); sgn.push(o[k] * 2 - 1); }
    const cell = (i0, i1) => {
      const p = [cx, cy, cz];
      if (i0 !== null) p[ax[0]] += sgn[0] * i0;
      if (i1 !== null) p[ax[1]] += sgn[1] * i1;
      return this.opaqueAt(p[0], p[1], p[2]) ? 1 : 0;
    };
    const s1 = cell(1, 0), s2 = cell(0, 1), cor = cell(1, 1);
    const ao = (s1 && s2) ? 0 : 3 - (s1 + s2 + cor);
    return AO_LEVEL[ao];
  }

  buildChunkArrays(cx, cz) {
    const pos = [], uv = [], col = [], light = [], idxArr = [];
    const x0 = cx * CHUNK, z0 = cz * CHUNK;
    let base = 0;
    outer:
    for (let x = x0; x < x0 + CHUNK; x++) {
      for (let z = z0; z < z0 + CHUNK; z++) {
        for (let y = 0; y < SY; y++) {
          const id = this.data[this.idx(x, y, z)];
          if (id === B.AIR) continue;
          // Stay within 16-bit index range (one mesh per chunk).
          if (base + 24 > 0xffff) break outer;
          const def = BLOCKS[id];
          for (const f of FACES) {
            const nx = x + f.n[0], ny = y + f.n[1], nz = z + f.n[2];
            if (this.opaqueAt(nx, ny, nz)) continue;
            // Don't draw the face between two of the same see-through block (so a
            // glass or leaf wall stays clean instead of double-faced).
            if (def.seethrough && this.get(nx, ny, nz) === id) continue;
            const tile = def.tiles[f.slot];
            const r = getUV(tile);
            const t = def.tint;
            for (const vert of f.v) {
              pos.push(x + vert.o[0], y + vert.o[1], z + vert.o[2]);
              uv.push(vert.uv[0] ? r.u1 : r.u0, vert.uv[1] ? r.v1 : r.v0);
              col.push(t[0], t[1], t[2]);
              light.push(f.shade * this.vertexAO(x, y, z, f.n, vert.o));
            }
            idxArr.push(base, base + 1, base + 2, base, base + 2, base + 3);
            base += 4;
          }
        }
      }
    }
    return { pos, uv, col, light, idxArr };
  }

  rebuildChunk(ci) {
    const cx = ci % CXN, cz = Math.floor(ci / CXN);
    const a = this.buildChunkArrays(cx, cz);
    let mesh = this.meshes[ci];
    if (!mesh) mesh = this.meshes[ci] = new GLMesh(this.gl);
    mesh.setAttrib('aPos', new Float32Array(a.pos), 3);
    mesh.setAttrib('aUV', new Float32Array(a.uv), 2);
    mesh.setAttrib('aColor', new Float32Array(a.col), 3);
    mesh.setAttrib('aLight', new Float32Array(a.light), 1);
    mesh.setIndex(new Uint16Array(a.idxArr));
  }

  rebuildAll() { for (let i = 0; i < this.meshes.length; i++) this.rebuildChunk(i); }

  flushDirty(limit) {
    let n = 0;
    for (const ci of this.dirty) {
      this.rebuildChunk(ci);
      this.dirty.delete(ci);
      if (++n >= (limit || 999)) break;
    }
  }

  draw(prog) {
    for (const m of this.meshes) if (m) m.draw(prog);
  }

  // Voxel ray march (Amanatides & Woo). Returns the hit block and the empty
  // cell in front of it (where a new block would be placed), or null.
  raycast(origin, dir, maxDist) {
    let x = Math.floor(origin[0]), y = Math.floor(origin[1]), z = Math.floor(origin[2]);
    const step = [Math.sign(dir[0]), Math.sign(dir[1]), Math.sign(dir[2])];
    const inv = [dir[0] !== 0 ? 1 / Math.abs(dir[0]) : Infinity,
    dir[1] !== 0 ? 1 / Math.abs(dir[1]) : Infinity,
    dir[2] !== 0 ? 1 / Math.abs(dir[2]) : Infinity];
    const dist = (i, c) => step[i] > 0 ? (c + 1 - origin[i]) : (origin[i] - c);
    let tMax = [dist(0, x) * inv[0], dist(1, y) * inv[1], dist(2, z) * inv[2]];
    let nx = 0, ny = 0, nz = 0, t = 0;
    for (let i = 0; i < 256; i++) {
      if (this.get(x, y, z) !== B.AIR && (x >= 0 && x < SX && y >= 0 && y < SY && z >= 0 && z < SZ)) {
        return { block: [x, y, z], place: [x + nx, y + ny, z + nz] };
      }
      if (tMax[0] < tMax[1] && tMax[0] < tMax[2]) {
        x += step[0]; t = tMax[0]; tMax[0] += inv[0]; nx = -step[0]; ny = 0; nz = 0;
      } else if (tMax[1] < tMax[2]) {
        y += step[1]; t = tMax[1]; tMax[1] += inv[1]; nx = 0; ny = -step[1]; nz = 0;
      } else {
        z += step[2]; t = tMax[2]; tMax[2] += inv[2]; nx = 0; ny = 0; nz = -step[2];
      }
      if (t > maxDist) return null;
    }
    return null;
  }

  // --- Save / load (raw bytes, base64 into localStorage) ---
  serialize() {
    return { v: 2, w: bytesToBase64(this.data), p: [...this.placed], portals: this.portals, cs: this.crystalSpots || null };
  }
  loadFrom(obj) {
    if (!obj || !obj.w) return false;
    const bytes = base64ToBytes(obj.w);
    if (bytes.length !== this.data.length) return false;
    this.data.set(bytes);
    this.placed = new Set(obj.p || []);
    // v2 saves carry a portal list; older saves get their portals re-added by
    // the caller (the swirl blocks themselves live in the saved bytes).
    this.portals = (obj.portals || []).map((p) => ({ f: p.f.slice(), dest: p.dest, a: p.a.slice(), active: !!p.active }));
    if (obj.cs) this.crystalSpots = obj.cs.map((c) => c.slice());   // End-world crystal pillars
    return true;
  }
}

function bytesToBase64(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}
function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
