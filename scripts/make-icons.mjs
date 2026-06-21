// Generates the PWA / home-screen icons as PNGs, with no image libraries.
// A cheery scene: sky, clouds, a sun, and a friendly grass block.
// Run with:  node scripts/make-icons.mjs
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'icons');

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 4)] = 0; // no filter
    rgba.copy(raw, y * (1 + size * 4) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const lerp = (a, b, t) => a + (b - a) * t;
function mix(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]; }

function color(u, v) {
  // Sky gradient
  let c = mix([170, 222, 255], [206, 236, 255], v);

  // Sun (top-right)
  if (Math.hypot(u - 0.80, v - 0.17) < 0.085) c = [255, 214, 92];

  // Clouds (soft white blobs)
  const cloud = (cu, cv, r) => Math.hypot((u - cu), (v - cv) * 1.7) < r;
  if (cloud(0.28, 0.20, 0.10) || cloud(0.38, 0.22, 0.08) || cloud(0.20, 0.23, 0.07)) c = [250, 252, 255];

  // Grass block (front face)
  const bx0 = 0.22, bx1 = 0.78, by0 = 0.34, by1 = 0.86;
  if (u > bx0 && u < bx1 && v > by0 && v < by1) {
    const o = 0.028;
    const edge = (u < bx0 + o || u > bx1 - o || v < by0 + o || v > by1 - o);
    if (edge) {
      c = [58, 44, 32];
    } else {
      const grassBand = by0 + 0.17;
      if (v < grassBand) {
        c = v < by0 + 0.06 ? [122, 206, 92] : [106, 190, 79];
      } else {
        const band = Math.floor((v - grassBand) * 40) % 6 === 0;
        c = band ? [120, 86, 56] : [138, 98, 64];
      }
      // Fake side shading on the right portion.
      if (u > bx0 + 0.62 * (bx1 - bx0)) c = c.map((x) => x * 0.86);
    }
  }
  return c;
}

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = color((x + 0.5) / size, (y + 0.5) / size);
      const i = (y * size + x) * 4;
      rgba[i] = Math.max(0, Math.min(255, Math.round(r)));
      rgba[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
      rgba[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
      rgba[i + 3] = 255;
    }
  }
  return encodePNG(size, rgba);
}

fs.mkdirSync(OUT, { recursive: true });
const jobs = [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]];
for (const [name, size] of jobs) {
  fs.writeFileSync(path.join(OUT, name), render(size));
  console.log('wrote', name, size + 'x' + size);
}
