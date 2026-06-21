// The voxel world: storage, gentle terrain, chunk meshing with baked
// ambient-occlusion lighting, ray picking for build/dig, and save/load.

import { GLMesh, getUV, TILE } from './gfx.js';

export const SX = 64, SY = 32, SZ = 64;   // world size in blocks
export const CHUNK = 16;                   // chunk footprint (CHUNK x CHUNK x SY)
const CXN = SX / CHUNK, CZN = SZ / CHUNK;  // chunks per axis

// Block ids
export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, LOG: 5, LEAVES: 6,
  PLANKS: 7, WATER: 8, BEDROCK: 9, BRICK: 10, GLASS: 11,
  RED: 12, ORANGE: 13, YELLOW: 14, GREEN: 15, CYAN: 16,
  BLUE: 17, PURPLE: 18, PINK: 19, WHITE: 20, BLACK: 21,
  COBBLE: 22, STONE_BRICK: 23, SNOW: 24, ICE: 25, GRAVEL: 26,
  BIRCH_LOG: 27, BIRCH_PLANKS: 28, DARK_PLANKS: 29, GOLD: 30,
  DIAMOND: 31, BOOKSHELF: 32, GLOWSTONE: 33, PUMPKIN: 34, OBSIDIAN: 35,
};

const W = [1, 1, 1]; // white tint for textured blocks
function colored(tile, tint, ui) { return { tiles: { top: tile, side: tile, bottom: tile }, tint, ui }; }
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
  [B.LEAVES]: { tiles: { top: TILE.LEAVES, side: TILE.LEAVES, bottom: TILE.LEAVES }, tint: W, ui: '#4f9a3a' },
  [B.PLANKS]: { tiles: { top: TILE.PLANKS, side: TILE.PLANKS, bottom: TILE.PLANKS }, tint: W, ui: '#c99a5b' },
  [B.WATER]: { tiles: { top: TILE.WATER, side: TILE.WATER, bottom: TILE.WATER }, tint: W, ui: '#3a86d6' },
  [B.BEDROCK]: { tiles: { top: TILE.BEDROCK, side: TILE.BEDROCK, bottom: TILE.BEDROCK }, tint: W, ui: '#4a4a52', indestructible: true },
  [B.BRICK]: { tiles: { top: TILE.BRICK, side: TILE.BRICK, bottom: TILE.BRICK }, tint: W, ui: '#b05a44' },
  [B.GLASS]: { tiles: { top: TILE.GLASS, side: TILE.GLASS, bottom: TILE.GLASS }, tint: W, ui: '#bfe6f2' },
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
};

// Build blocks grouped into categories for the pop-up picker.
export const CATEGORIES = [
  { name: 'Nature', blocks: [B.GRASS, B.DIRT, B.SAND, B.GRAVEL, B.SNOW, B.LOG, B.BIRCH_LOG, B.LEAVES] },
  { name: 'Stone', blocks: [B.STONE, B.COBBLE, B.STONE_BRICK, B.BRICK, B.OBSIDIAN, B.GLOWSTONE] },
  { name: 'Wood', blocks: [B.PLANKS, B.BIRCH_PLANKS, B.DARK_PLANKS, B.BOOKSHELF] },
  { name: 'Shiny', blocks: [B.GOLD, B.DIAMOND, B.ICE, B.GLASS] },
  { name: 'Fun', blocks: [B.PUMPKIN] },
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
    this.spawn = [SX / 2 + 0.5, 12, SZ / 2 + 0.5];
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
    return this.data[this.idx(x, y, z)] !== B.AIR;
  }

  // For physics: borders act as walls.
  solidAt(x, y, z) {
    if (y < 0) return true;
    if (y >= SY) return false;
    if (x < 0 || x >= SX || z < 0 || z >= SZ) return true;
    return this.data[this.idx(x, y, z)] !== B.AIR;
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
    const pondX = 16, pondZ = 44, pondR = 6, waterY = 4;
    for (let x = 0; x < SX; x++) {
      for (let z = 0; z < SZ; z++) {
        let h = 6 + 1.6 * Math.sin(x * 0.18) + 1.6 * Math.cos(z * 0.16)
          + 1.3 * Math.sin((x + z) * 0.09);
        h = Math.round(h);
        const dPond = Math.hypot(x - pondX, z - pondZ);
        const nearPond = dPond < pondR;
        if (nearPond) h = Math.min(h, waterY - 1 + Math.round((dPond / pondR) * 2));
        h = Math.max(3, Math.min(13, h));

        for (let y = 0; y <= h; y++) {
          let id;
          if (y === 0) id = B.BEDROCK;
          else if (y === h) id = nearPond && h <= waterY ? B.SAND : B.GRASS;
          else if (y >= h - 2) id = B.DIRT;
          else id = B.STONE;
          this.data[this.idx(x, y, z)] = id;
        }
        // Fill the pond bowl with water up to waterY; ring it with sand.
        if (dPond < pondR + 1.5) {
          for (let y = h + 1; y <= waterY; y++) this.data[this.idx(x, y, z)] = B.WATER;
          if (this.data[this.idx(x, h, z)] === B.GRASS && dPond < pondR + 1) this.data[this.idx(x, h, z)] = B.SAND;
        }
      }
    }

    // Scatter friendly little trees on grass, away from the pond.
    let trees = 0;
    for (let attempt = 0; attempt < 400 && trees < 16; attempt++) {
      const x = 4 + Math.floor(rand() * (SX - 8));
      const z = 4 + Math.floor(rand() * (SZ - 8));
      const h = this.heightAt(x, z);
      if (this.data[this.idx(x, h, z)] !== B.GRASS) continue;
      if (Math.hypot(x - pondX, z - pondZ) < pondR + 3) continue;
      this.placeTree(x, h + 1, z, rand);
      trees++;
    }

    // Spawn on solid ground in the middle.
    const sh = this.heightAt(Math.floor(this.spawn[0]), Math.floor(this.spawn[2]));
    this.spawn[1] = sh + 2;
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
            if (this.opaqueAt(x + f.n[0], y + f.n[1], z + f.n[2])) continue;
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
    return { v: 1, w: bytesToBase64(this.data) };
  }
  loadFrom(obj) {
    if (!obj || obj.v !== 1 || !obj.w) return false;
    const bytes = base64ToBytes(obj.w);
    if (bytes.length !== this.data.length) return false;
    this.data.set(bytes);
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
