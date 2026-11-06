// Generates the home-screen icons for Ezra's Mine (mine/icons/*.png) from the
// game's own procedural pixel art — a pickaxe striking a gold-ore block.
//   node scripts/make-mine-icons.mjs
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { TILE_PAINTERS, ICONS, PICK_COLORS } from '../mine/js/art.js';

const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'mine', 'icons');
fs.mkdirSync(OUT, { recursive: true });

// --- a tiny pretend 2D context, just enough for the art painters ---
function parseColor(s) {
  if (s.startsWith('#')) { const n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]; }
  const m = s.match(/rgba?\(([^)]+)\)/);
  const p = m[1].split(',').map(Number);
  return [p[0], p[1], p[2], p.length > 3 ? Math.round(p[3] * 255) : 255];
}
function fakeCtx(w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  let fill = [0, 0, 0, 255];
  return {
    data, w, h,
    set fillStyle(s) { fill = parseColor(s); },
    fillRect(x, y, ww, hh) {
      for (let yy = Math.max(0, y); yy < Math.min(h, y + hh); yy++) for (let xx = Math.max(0, x); xx < Math.min(w, x + ww); xx++) {
        const i = (yy * w + xx) * 4, a = fill[3] / 255;
        data[i] = data[i] * (1 - a) + fill[0] * a; data[i + 1] = data[i + 1] * (1 - a) + fill[1] * a; data[i + 2] = data[i + 2] * (1 - a) + fill[2] * a;
        data[i + 3] = Math.max(data[i + 3], fill[3]);
      }
    },
    getImageData() { return { data: new Uint8ClampedArray(data) }; },
    putImageData(img) { data.set(img.data); },
  };
}
const PAL = { k: 0x1e1a24, b: 0x8a5a2e, B: 0x5e3b1c };
function sprite(rows, recolor) {
  const c = fakeCtx(16, 16);
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const col = recolor[ch] ?? PAL[ch];
    if (col === undefined) return;
    c.fillStyle = `rgb(${(col >> 16) & 255},${(col >> 8) & 255},${col & 255})`; c.fillRect(x, y, 1, 1);
  }));
  return c;
}

function render(size) {
  const out = Buffer.alloc(size * size * 4);
  const tile = fakeCtx(16, 16); TILE_PAINTERS.gold_ore(tile);
  const [main, dark] = PICK_COLORS[5]; // the diamond pickaxe
  const pick = sprite(ICONS.pickaxe, { l: 0xd7fbf5, s: main, S: dark });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, i = (y * size + x) * 4;
    // warm cave background with a glow behind the block
    const g = Math.max(0, 1 - Math.hypot(u - 0.5, v - 0.56) / 0.55);
    let c = [43 + 120 * g * g, 29 + 70 * g * g, 46 + 30 * g * g, 255];
    // the block (centre, ~58%)
    const bx0 = 0.17, by0 = 0.27, bs = 0.58;
    if (u >= bx0 && u < bx0 + bs && v >= by0 && v < by0 + bs) {
      const tx = Math.floor((u - bx0) / bs * 16), ty = Math.floor((v - by0) / bs * 16), j = (ty * 16 + tx) * 4;
      c = [tile.data[j], tile.data[j + 1], tile.data[j + 2], 255];
    }
    // the pickaxe (top-right, overlapping)
    const px0 = 0.42, py0 = 0.06, ps = 0.52;
    if (u >= px0 && u < px0 + ps && v >= py0 && v < py0 + ps) {
      const tx = Math.floor((u - px0) / ps * 16), ty = Math.floor((v - py0) / ps * 16), j = (ty * 16 + tx) * 4;
      if (pick.data[j + 3] > 0) c = [pick.data[j], pick.data[j + 1], pick.data[j + 2], 255];
    }
    out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = 255;
  }
  return out;
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) { raw[y * (1 + size * 4)] = 0; rgba.copy(raw, y * (1 + size * 4) + 1, y * size * 4, (y + 1) * size * 4); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  fs.writeFileSync(path.join(OUT, name), png(size, render(size)));
  console.log('wrote', name);
}
