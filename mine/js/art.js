// Procedural 16px pixel art for Ezra's Mine: block tiles and UI icons.
// Everything is drawn in code (no image files), in the same chunky 16px
// style as Ezra's Blocks. Results are cached as crisp, pre-scaled data URLs
// so the DOM can show them with plain <img> tags.

const T = 16;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rgb(hex, f = 1) {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

function px(ctx, x, y, color, w = 1, h = 1) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }

function noise(ctx, base, variance, seed) {
  const r = rng(seed);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(ctx, x, y, rgb(base, 1 - variance / 2 + r() * variance));
}

// Soft bevel: lighter top-left edge, darker bottom-right edge (reads as a block).
function bevel(ctx, light = 1.18, dark = 0.72) {
  const img = ctx.getImageData(0, 0, T, T);
  const d = img.data;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    let f = 1;
    if (x === 0 || y === 0) f = light;
    else if (x === T - 1 || y === T - 1) f = dark;
    if (f !== 1) {
      const i = (y * T + x) * 4;
      d[i] = Math.min(255, d[i] * f); d[i + 1] = Math.min(255, d[i + 1] * f); d[i + 2] = Math.min(255, d[i + 2] * f);
    }
  }
  ctx.putImageData(img, 0, 0);
}

// Little clusters of ore "flecks" in a host rock.
function flecks(ctx, colors, count, seed, size = 2) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const x = 1 + Math.floor(r() * (T - size - 1)), y = 1 + Math.floor(r() * (T - size - 1));
    const c = colors[Math.floor(r() * colors.length)];
    px(ctx, x, y, rgb(c), size, size);
    // a highlight pixel + a shadow pixel make each fleck look faceted
    px(ctx, x, y, rgb(c, 1.3));
    px(ctx, x + size - 1, y + size - 1, rgb(c, 0.7));
    if (r() < 0.5) px(ctx, x + size, y + Math.floor(r() * size), rgb(c, 0.85));
  }
}

function sparkles(ctx, color, count, seed) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const x = 2 + Math.floor(r() * 12), y = 2 + Math.floor(r() * 12);
    px(ctx, x, y, color); px(ctx, x - 1, y, color); px(ctx, x + 1, y, color); px(ctx, x, y - 1, color); px(ctx, x, y + 1, color);
  }
}

// ---------------------------------------------------------------------------
// Block tiles. Each painter draws a 16x16 tile into ctx.
// ---------------------------------------------------------------------------
const STONE = 0x8f8f97;

export const TILE_PAINTERS = {
  dirt(ctx) {
    noise(ctx, 0x8a6240, 0.28, 3);
    const r = rng(31); for (let i = 0; i < 7; i++) px(ctx, Math.floor(r() * 15), Math.floor(r() * 15), rgb(0x5e4128), 2, 1);
    bevel(ctx);
  },
  sand(ctx) {
    noise(ctx, 0xe4d6a0, 0.16, 5);
    const r = rng(51); for (let i = 0; i < 8; i++) px(ctx, Math.floor(r() * 16), Math.floor(r() * 16), rgb(0xc7b47a));
    bevel(ctx);
  },
  gravel(ctx) { // warm, sandy-brown pebbles
    noise(ctx, 0xa08a6a, 0.22, 45);
    const r = rng(451);
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(r() * 14), y = Math.floor(r() * 14), c = [0x6e5a44, 0xc9b28a, 0x857058][Math.floor(r() * 3)];
      px(ctx, x, y, rgb(c), 2, 2); px(ctx, x, y, rgb(c, 1.2));
    }
    bevel(ctx);
  },
  stone(ctx) { // smooth, pale blue-grey
    noise(ctx, 0xa9adb8, 0.08, 4);
    const r = rng(41); for (let i = 0; i < 4; i++) { const x = Math.floor(r() * 11), y = 2 + Math.floor(r() * 12); px(ctx, x, y, rgb(0x8a8e99), 4 + Math.floor(r() * 2), 1); }
    bevel(ctx, 1.15, 0.75);
  },
  cobble(ctx) { // dark mortar with chunky rounded stones
    noise(ctx, 0x4a4a52, 0.15, 40);
    const stones = [[1, 1, 5, 4], [7, 1, 4, 3], [12, 1, 3, 5], [1, 6, 3, 4], [5, 5, 5, 5], [11, 7, 4, 4], [1, 11, 5, 4], [7, 11, 3, 4], [11, 12, 4, 3]];
    const r = rng(401);
    for (const [x, y, w, h] of stones) {
      const base = [0x8e8e96, 0x9a9aa2, 0x828289][Math.floor(r() * 3)];
      px(ctx, x, y, rgb(base), w, h);
      px(ctx, x, y, rgb(base, 1.18), w, 1); px(ctx, x, y + h - 1, rgb(base, 0.78), w, 1);
    }
    bevel(ctx);
  },
  mossy(ctx) {
    TILE_PAINTERS.cobble(ctx);
    const r = rng(77);
    for (let i = 0; i < 30; i++) { const y = Math.floor(Math.pow(r(), 1.6) * 16); px(ctx, Math.floor(r() * 16), y, rgb(r() < 0.5 ? 0x4f9a3a : 0x6abe4f)); }
  },
  coal(ctx) { noise(ctx, STONE, 0.16, 60); flecks(ctx, [0x2a2a2e, 0x3a3a40], 6, 601); bevel(ctx); },
  copper(ctx) { noise(ctx, STONE, 0.16, 61); flecks(ctx, [0xd9824a, 0xb8642f, 0x5fb89a], 6, 611); bevel(ctx); },
  iron(ctx) { noise(ctx, STONE, 0.16, 62); flecks(ctx, [0xe0b49a, 0xc9967c], 6, 621); bevel(ctx); },
  gold_ore(ctx) { noise(ctx, STONE, 0.16, 63); flecks(ctx, [0xf6d23c, 0xffe680], 7, 631); bevel(ctx); },
  ruby(ctx) { noise(ctx, 0x7d7a86, 0.16, 64); flecks(ctx, [0xe0304a, 0xff6070], 6, 641); bevel(ctx); },
  sapphire(ctx) { noise(ctx, 0x7d7a86, 0.16, 65); flecks(ctx, [0x3a6ff0, 0x7aa8ff], 6, 651); bevel(ctx); },
  amethyst(ctx) {
    noise(ctx, 0x6e4aa8, 0.2, 66);
    const r = rng(661);
    for (let i = 0; i < 6; i++) { const x = 1 + Math.floor(r() * 13), y = 2 + Math.floor(r() * 12); px(ctx, x, y - 2, rgb(0xd8b8ff), 1, 3); px(ctx, x + 1, y - 1, rgb(0xb58cf0), 1, 3); }
    bevel(ctx);
  },
  emerald(ctx) { noise(ctx, 0x7d7a86, 0.16, 67); flecks(ctx, [0x2fd06a, 0x8cf5a8], 6, 671); bevel(ctx); },
  diamond_ore(ctx) { noise(ctx, 0x6f6f78, 0.16, 68); flecks(ctx, [0x59e6d8, 0xc8fff8], 7, 681); bevel(ctx); },
  gold_block(ctx) {
    noise(ctx, 0xf2c63a, 0.08, 48);
    px(ctx, 1, 1, rgb(0xfff0a0), 6, 1); px(ctx, 1, 1, rgb(0xfff0a0), 1, 6);
    px(ctx, 3, 3, rgb(0xfff6c8), 2, 1);
    for (let y = 5; y < 16; y += 5) px(ctx, 0, y, rgb(0xd9a520), 16, 1);
    sparkles(ctx, rgb(0xfffbe0), 2, 480);
    bevel(ctx, 1.2, 0.75);
  },
  diamond_block(ctx) {
    noise(ctx, 0x59d6c8, 0.1, 49);
    for (let i = 0; i < 16; i++) { px(ctx, i, i, rgb(0x8ff0e4)); px(ctx, 15 - i, i, rgb(0x3fb8aa)); }
    sparkles(ctx, rgb(0xeafffc), 2, 491);
    bevel(ctx, 1.25, 0.72);
  },
  glow(ctx) {
    noise(ctx, 0xe8c24a, 0.14, 51);
    const r = rng(510); for (let i = 0; i < 9; i++) px(ctx, Math.floor(r() * 14), Math.floor(r() * 14), rgb(0xfff4c0), 2, 2);
    bevel(ctx, 1.15, 0.8);
  },
  obsidian(ctx) {
    noise(ctx, 0x241a33, 0.2, 54);
    const r = rng(540); for (let i = 0; i < 8; i++) px(ctx, Math.floor(r() * 16), Math.floor(r() * 16), rgb(0x6a52a0));
    bevel(ctx, 1.4, 0.7);
  },
  rainbow(ctx) {
    const bands = [0xe84a4a, 0xf2913a, 0xf7d934, 0x59bf4d, 0x4da6e6, 0x8a5ad9];
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const b = bands[Math.floor(((x + y) / 32) * bands.length) % bands.length];
      px(ctx, x, y, rgb(b, 0.92 + ((x * 7 + y * 13) % 5) * 0.03));
    }
    sparkles(ctx, '#ffffff', 2, 99);
    bevel(ctx, 1.2, 0.75);
  },
  star(ctx) {
    noise(ctx, 0x22265a, 0.18, 88);
    const r = rng(881); for (let i = 0; i < 10; i++) px(ctx, Math.floor(r() * 16), Math.floor(r() * 16), rgb(0xbfc8ff));
    // a big friendly star in the middle
    const S = ['.......#........', '......###.......', '......###.......', '#############...', '.###########....',
      '..#########.....', '..####.####.....', '.###.....###....', '##.........##...'];
    for (let y = 0; y < S.length; y++) for (let x = 0; x < S[y].length; x++) if (S[y][x] === '#') px(ctx, x + 2, y + 4, rgb(0xffd84a, y < 3 ? 1.15 : 1));
    bevel(ctx, 1.3, 0.7);
  },
  planks(ctx) {
    noise(ctx, 0xc99a5b, 0.12, 9);
    for (let y = 4; y < T; y += 5) px(ctx, 0, y, rgb(0x8a6a3a), T, 1);
    bevel(ctx);
  },
  log(ctx) {
    noise(ctx, 0x9c7142, 0.18, 6);
    const r = rng(66); for (let x = 0; x < T; x++) if (r() < 0.35) px(ctx, x, 0, rgb(0x6f4e2c), 1, T);
    bevel(ctx);
  },
  brick(ctx) {
    noise(ctx, 0xb05a44, 0.1, 12);
    for (let y = 0; y < T; y += 4) px(ctx, 0, y, rgb(0xe7d9c9), T, 1);
    for (let y = 0; y < T; y += 4) for (let x = (y % 8 === 0 ? 4 : 0); x < T; x += 8) px(ctx, x, y, rgb(0xe7d9c9), 1, 4);
    bevel(ctx);
  },
  // An empty slot: soft, slightly sunken stone-coloured square.
  empty(ctx) {
    noise(ctx, 0xd9d4dc, 0.05, 7);
    bevel(ctx, 0.85, 1.08);
  },
  // Mystery block (for collection-book silhouettes).
  mystery(ctx) {
    noise(ctx, 0x4a4652, 0.08, 13);
    const Q = ['..####..', '.##..##.', '.....##.', '....##..', '...##...', '...##...', '........', '...##...'];
    for (let y = 0; y < Q.length; y++) for (let x = 0; x < 8; x++) if (Q[y][x] === '#') px(ctx, x + 4, y + 4, rgb(0x9c98a8));
    bevel(ctx);
  },
};

// ---------------------------------------------------------------------------
// Icons: hand-authored 16x16 pixel sprites. Each char maps to a colour.
// ---------------------------------------------------------------------------
const PAL = {
  '.': null,
  k: 0x1e1a24, // outline
  w: 0xffffff, W: 0xf3eee6,
  s: 0x8f8f97, S: 0x6a6a72, l: 0xb9b9c2, // stone
  b: 0x8a5a2e, B: 0x5e3b1c, t: 0xc99a5b, // wood
  y: 0xf6c935, Y: 0xffe680, o: 0xd99a1e, // gold
  r: 0xe0403a, R: 0xa82626, p: 0xff8a7a, // red
  g: 0x4fbf4a, G: 0x2f8a35, e: 0x9be08a, // green
  c: 0x59d6e8, C: 0x2f9fb8, // cyan
  u: 0x5a7ff0, U: 0x3550b8, // blue
  v: 0x9a6ae0, V: 0x6a40b0, // violet
  f: 0xff9a30, F: 0xffd060, // fire
  n: 0x3a3a42, // dark grey
  h: 0xf2c8a0, // skin/hay
};

export const ICONS = {
  coin: [
    '................',
    '.....kkkkkk.....',
    '...kkyyyyyykk...',
    '..kyyYYYYYYyok..',
    '..kyYYyyyyYyok..',
    '.kyYYy.oo.yYyok.',
    '.kyYy.yYYo.yyok.',
    '.kyYy.yYyo.yyok.',
    '.kyYy.yYyo.yyok.',
    '.kyYy.yYyo.yyok.',
    '.kyYYy.oo.yyyok.',
    '..kyyyyyyyyyok..',
    '..kyoyyyyyyook..',
    '...kkooooookk...',
    '.....kkkkkk.....',
    '................',
  ],
  brick: [
    '................',
    '................',
    '................',
    '..kkkkkkkkkkkk..',
    '.kprrrrrrrrrrrk.',
    '.kprrrrrrrrrrRk.',
    '.kWWWWWWWWWWWWk.',
    '.krrrrWrrrrrrRk.',
    '.krrrrWrrrrrrRk.',
    '.kWWWWWWWWWWWWk.',
    '.kprrrrrrWrrrRk.',
    '.kRRRRRRRWRRRRk.',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
    '................',
  ],
  gem: [
    '................',
    '................',
    '....kkkkkkkk....',
    '...kcwwccccCk...',
    '..kcwccccccCCk..',
    '.kkkkkkkkkkkkkk.',
    '.kccwcccccccCCk.',
    '..kcwccccccCCk..',
    '...kcwcccccCk...',
    '....kcccccCk....',
    '.....kcccCk.....',
    '......kcCk......',
    '.......kk.......',
    '................',
    '................',
    '................',
  ],
  star: [
    '................',
    '.......kk.......',
    '......kYYk......',
    '......kYyk......',
    '.....kYyyyk.....',
    'kkkkkkYyyyykkkkk',
    'kYYYYYyyyyyyyyok',
    '.kyyyyyyyyyyyok.',
    '..kyyyyyyyyyok..',
    '...kyyyyyyyok...',
    '...kyyyyyyyyk...',
    '..kyyyyokyyyyk..',
    '..kyyyok.kyyyk..',
    '.kyyook...koyyk.',
    '.kkkk......kkkk.',
    '................',
  ],
  pickaxe: [
    '................',
    '...kkkkkkkk.....',
    '..kllllllllkk...',
    '.klsssssssslk...',
    '.kskkkkkkksssk..',
    '.kk......kbkssk.',
    '........kbk.ksk.',
    '.......kbk...kk.',
    '......kbk.......',
    '.....kbk........',
    '....kbk.........',
    '...kbk..........',
    '..kbk...........',
    '.kBk............',
    '.kk.............',
    '................',
  ],
  furnace: [
    'kkkkkkkkkkkkkkkk',
    'klllllllllllllSk',
    'klsssssssssssSSk',
    'klskkkkkkkkkksSk',
    'klsknnnnnnnnksSk',
    'klskkkkkkkkkksSk',
    'klsssssssssssSSk',
    'klsskkkkkkkkssSk',
    'klsknfFfFffnksSk',
    'klskfFFYFFFfksSk',
    'klskFYYwYYFFksSk',
    'klsskkkkkkkkssSk',
    'klssssssssssssSk',
    'kSSSSSSSSSSSSSSk',
    'kkkkkkkkkkkkkkkk',
    '................',
  ],
  chest: [
    '................',
    '................',
    '..kkkkkkkkkkkk..',
    '.ktttttttttttbk.',
    '.ktbbbbbbbbbbbk.',
    '.ktbbbbbbbbbbbk.',
    '.kkkkkkyykkkkkk.',
    '.ktttttyotttttk.',
    '.ktbbbbkkbbbbbk.',
    '.ktbbbbbbbbbbbk.',
    '.ktbbbbbbbbbbbk.',
    '.ktbbbbbbbbbbbk.',
    '.kBBBBBBBBBBBBk.',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
  ],
  boom: [ // the Boom Block: a round pink boom-ball with a star and a sparkly fuse
    '...........F.F..',
    '..........FwF...',
    '.........kkF.F..',
    '........kk......',
    '.....kkkkkk.....',
    '...kkppppppkk...',
    '..kppwppppppRk..',
    '..kpwppppppppk..',
    '.kpppppYpppppRk.',
    '.kppppYYYppppRk.',
    '.kppYYYYYYYppRk.',
    '.kpppYYYYYppRRk.',
    '..kppYpppYpRRk..',
    '..kRppppppRRRk..',
    '...kkRRRRRRkk...',
    '.....kkkkkk.....',
  ],
  house: [
    '................',
    '.......kk.......',
    '......krrk......',
    '.....krrrrk.....',
    '....krrrrrrk....',
    '...krrrrrrrrk...',
    '..kRRRRRRRRRRk..',
    '...kttttttttk...',
    '...ktkkkttkkk...',
    '...ktkckttkck...',
    '...ktkkktbbbk...',
    '...kttttkbBbk...',
    '...kttttkbybk...',
    '...kttttkbbbk...',
    '..gggggggggggg..',
    '................',
  ],
  book: [
    '................',
    '..kkkkkkkkkkk...',
    '.kuuuuuuuuuuuk..',
    '.kuUUUUUUUUUuk..',
    '.kuUkkkkkkkUuk..',
    '.kuUkYyyyykUuk..',
    '.kuUkkkkkkkUuk..',
    '.kuUUUUUUUUUuk..',
    '.kuUUUUUUUUUuk..',
    '.kuUUUUUUUUUuk..',
    '.kuUUUUUUUUUuk..',
    '.kuuuuuuuuuuuk..',
    '.kWWWWWWWWWWWWk.',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................',
  ],
  hammer: [
    '................',
    '..kkkkkkkk......',
    '.kllllllllk.....',
    '.klsssssssk.....',
    '.kSSSSSSSSk.....',
    '..kkkkbkkk......',
    '......bk........',
    '......bbk.......',
    '.......bk.......',
    '.......bbk......',
    '........bk......',
    '........bbk.....',
    '.........bk.....',
    '.........bBk....',
    '..........kk....',
    '................',
  ],
  sparkle: [
    '................',
    '.......kk.......',
    '.......kYk......',
    '......kYYk......',
    '......kYYk......',
    '.kkkkkYYYYkkkk..',
    '.kYYYYYwYYYYYk..',
    '..kkkkYYYYkkkk..',
    '......kYYk......',
    '......kYYk......',
    '.......kYk......',
    '.......kk.......',
    '................',
    '..k.........k...',
    '.kYk.......kYk..',
    '..k.........k...',
  ],
  lock: [
    '................',
    '.....kkkkkk.....',
    '....kllllllk....',
    '...kl.kkkk.lk...',
    '...kl.k..k.lk...',
    '...kl.k..k.lk...',
    '..kkkkkkkkkkkk..',
    '..kyYYYYYYYYok..',
    '..kyyyykkyyyok..',
    '..kyyyykkyyyok..',
    '..kyyyyykyyyok..',
    '..kyyyyyyyyyok..',
    '..kooooooooook..',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
  ],
  heart: [
    '................',
    '................',
    '..kkkk....kkkk..',
    '.kprrrk..krrrrk.',
    'kpwprrrkkrrrrrRk',
    'kpprrrrrrrrrrrRk',
    'krrrrrrrrrrrrrRk',
    'krrrrrrrrrrrrrRk',
    '.krrrrrrrrrrrRk.',
    '..krrrrrrrrrRk..',
    '...krrrrrrrRk...',
    '....krrrrrRk....',
    '.....krrrRk.....',
    '......krRk......',
    '.......kk.......',
    '................',
  ],
  gear: [
    '................',
    '......kkkk......',
    '...kk.kllk.kk...',
    '..klkkkllkkklk..',
    '..kllllllllllk..',
    '...kllskkslllk..',
    '.kkllsk..ksllkk.',
    '.klllk....klllk.',
    '.klllk....klllk.',
    '.kkllsk..ksllkk.',
    '...kllskkslllk..',
    '..kllllllllllk..',
    '..klkkkllkkklk..',
    '...kk.kllk.kk...',
    '......kkkk......',
    '................',
  ],
  mole: [ // Digby, the friendly helper mole (original character)
    '.....kkkkkk.....',
    '....kyyyyyyk....',
    '...kyyYwYyyyk...',
    '..kkkkkkkkkkkk..',
    '..kbbbbbbbbbbk..',
    '.kbbkbbbbbbkbbk.',
    '.kbbbbbbbbbbbbk.',
    '.kbbbbbppbbbbbk.',
    '.kbphbbppbbhpbk.',
    '.kbbbbbbbbbbbbk.',
    '..kbbbbkkbbbbk..',
    '.khhkbbbbbbkhhk.',
    '.khhkbbbbbbkhhk.',
    '..kkkbbbbbbkkk..',
    '....kkkkkkkk....',
    '................',
  ],
  bar: [ // a metal bar from the furnace (recoloured per metal)
    '................',
    '................',
    '................',
    '................',
    '................',
    '....kkkkkkkkk...',
    '...kYYYYYYYYYk..',
    '..kYyyyyyyyyyok.',
    '.kyyyyyyyyyyyook',
    '.koooooooooooook',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  bolt: [
    '................',
    '.........kkkk...',
    '........kYYk....',
    '.......kYyk.....',
    '......kYyk......',
    '.....kYyykkkk...',
    '....kYyyyyyyk...',
    '...kkkkyyyyk....',
    '......kyyok.....',
    '.....kyyok......',
    '....kyok........',
    '...kyok.........',
    '..kok...........',
    '..kk............',
    '................',
    '................',
  ],
  cart: [ // a mine cart full of blocks (the block shop)
    '................',
    '................',
    '...kkkkkkkkkk...',
    '...krrkllkggk...',
    '...kRRkSSkGGk...',
    '.kkkkkkkkkkkkkk.',
    '.knnnnnnnnnnnnk.',
    '..knnsnnnnsnnk..',
    '..knnnnnnnnnnk..',
    '...knnnnnnnnk...',
    '...kkkkkkkkkk...',
    '..kSSk....kSSk..',
    '..kSSk....kSSk..',
    '...kk......kk...',
    '................',
    '................',
  ],
  shelf: [ // the Block Book shelf
    '................',
    '.kkkkkkkkkkkkkk.',
    '.kttttttttttttk.',
    '.ktrruuggyyvvtk.',
    '.ktrruuggyyvvtk.',
    '.ktrruuggyyvvtk.',
    '.kttttttttttttk.',
    '.kBBBBBBBBBBBBk.',
    '.ktuuyyrrvvggtk.',
    '.ktuuyyrrvvggtk.',
    '.ktuuyyrrvvggtk.',
    '.kttttttttttttk.',
    '.kBBBBBBBBBBBBk.',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................',
  ],
};

// Metal bar colours [main, light, dark] for each furnace product.
export const BAR_COLORS = {
  copper: [0xd9824a, 0xf0a878, 0xa85a2a],
  iron: [0xd8d8e0, 0xf6f6fa, 0x9a9aa6],
  gold: [0xf6c935, 0xffe680, 0xd99a1e],
  ruby: [0xe0304a, 0xff7a8a, 0xa01a30],
};
export function barURL(id, size = 96) {
  const [m, l, d] = BAR_COLORS[id] || BAR_COLORS.iron;
  return iconURL('bar', size, { y: m, Y: l, o: d });
}

// Purple "star gems" — deliberately not emerald green.
export function gemURL(size = 96) { return iconURL('gem', size, { c: 0xc28cff, C: 0x8a4ae0 }); }

// A building for the village scene: house sprite with its own roof/wall colours.
export function buildingURL(roof, wall, size = 96) {
  const dark = ((roof >> 1) & 0x7f7f7f);
  return iconURL('house', size, { r: roof, R: dark, t: wall });
}

// Pickaxe head colours for each pickaxe level (wood -> rainbow).
// One entry per pickaxe in data.js PICKAXES:
// wood, stone, copper, iron, gold, diamond, amethyst, star.
export const PICK_COLORS = [
  [0xc99a5b, 0x8a6a3a], [0xb9b9c2, 0x6a6a72], [0xe08a50, 0xa85a2a], [0xe6e6ee, 0x9a9aa6],
  [0xf6c935, 0xd99a1e], [0x59d6e8, 0x2f9fb8], [0x9a6ae0, 0x6a40b0], [0xfff4c0, 0xe8c24a],
];

function drawSprite(ctx, rows, recolor) {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      let c = recolor && recolor[ch] !== undefined ? recolor[ch] : PAL[ch];
      if (c === null || c === undefined) continue;
      px(ctx, x, y, rgb(c));
    }
  }
}

const cache = new Map();

function makeCanvas(n) {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  return c;
}

// Scale a 16x16 canvas up with nearest-neighbour so it stays crisp anywhere.
function scaleUp(src, size) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, size, size);
  return c;
}

export function tileCanvas(kind) {
  const key = 'tc:' + kind;
  if (cache.has(key)) return cache.get(key);
  const c = makeCanvas(T);
  const painter = TILE_PAINTERS[kind] || TILE_PAINTERS.mystery;
  painter(c.getContext('2d', { willReadFrequently: true }));
  cache.set(key, c);
  return c;
}

// Data URL of a block tile, pre-scaled (default 96px) for crisp <img> display.
export function tileURL(kind, size = 96) {
  const key = 't:' + kind + ':' + size;
  if (!cache.has(key)) cache.set(key, scaleUp(tileCanvas(kind), size).toDataURL());
  return cache.get(key);
}

// Data URL of an icon. `recolor` maps palette chars to new hex colours (used
// for the pickaxe's material colour).
export function iconURL(name, size = 96, recolor) {
  const key = 'i:' + name + ':' + size + ':' + (recolor ? JSON.stringify(recolor) : '');
  if (!cache.has(key)) {
    const c = makeCanvas(T);
    drawSprite(c.getContext('2d'), ICONS[name] || ICONS.star, recolor);
    cache.set(key, scaleUp(c, size).toDataURL());
  }
  return cache.get(key);
}

export function pickaxeURL(level, size = 96) {
  const [main, dark] = PICK_COLORS[Math.min(level, PICK_COLORS.length - 1)];
  return iconURL('pickaxe', size, { l: main, s: main, S: dark });
}

// Crack overlay for the mine block: stage 0 (none) .. 4 (about to break).
export function crackURL(stage, size = 96) {
  const key = 'crack:' + stage + ':' + size;
  if (cache.has(key)) return cache.get(key);
  const c = makeCanvas(T);
  const ctx = c.getContext('2d');
  const r = rng(77);
  const col = 'rgba(20,14,24,0.85)';
  const lines = Math.min(stage * 2, 8);
  for (let l = 0; l < lines; l++) {
    let x = 7 + Math.floor(r() * 3), y = 7 + Math.floor(r() * 3);
    const dx = r() < 0.5 ? -1 : 1, dy = r() < 0.5 ? -1 : 1;
    const len = 3 + stage + Math.floor(r() * 3);
    for (let k = 0; k < len; k++) {
      px(ctx, x, y, col);
      if (r() < 0.6) x += dx; else y += dy;
      if (x < 0 || y < 0 || x > 15 || y > 15) break;
    }
  }
  cache.set(key, scaleUp(c, size).toDataURL());
  return cache.get(key);
}

// A small average colour for a tile (used for particle bursts).
export function tileColors(kind) {
  const key = 'col:' + kind;
  if (cache.has(key)) return cache.get(key);
  const ctx = tileCanvas(kind).getContext('2d', { willReadFrequently: true });
  const d = ctx.getImageData(0, 0, T, T).data;
  const out = [];
  for (let i = 0; i < 6; i++) {
    const p = ((3 + i * 2) * T + (2 + i * 2)) * 4;
    out.push(`rgb(${d[p]},${d[p + 1]},${d[p + 2]})`);
  }
  cache.set(key, out);
  return out;
}

// ---------------------------------------------------------------------------
// Adventure art: materials, weapons/armor, crafting items, the five friendly
// monsters, Pip the guide and the dress-up hero. All original 16px sprites in
// the same chunky outlined style as the icons above.
// ---------------------------------------------------------------------------

// [main, dark] for each crafting material (tool heads, blades, armor).
export const MAT_COLORS = {
  wood: [0xc99a5b, 0x8a6a3a],
  stone: [0xb9b9c2, 0x6a6a72],
  iron: [0xe6e6ee, 0x9a9aa6],
  gold: [0xf6c935, 0xd99a1e],
  diamond: [0x59d6e8, 0x2f9fb8],
};

function mixHex(a, b, t) {
  const ch = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

// Four shades of a material: L(ight), M(ain), N (mid) and D(ark).
function matShades(mat) {
  const [m, d] = MAT_COLORS[mat] || MAT_COLORS.iron;
  return { L: mixHex(m, 0xffffff, 0.5), M: m, N: mixHex(m, d, 0.5), D: d };
}

// Extra palette colours for the new sprites. L/M/N/D are "material" slots
// (iron by default) that the URL helpers below recolour.
Object.assign(PAL, matShades('iron'), {
  a: 0xc8782e, A: 0x8f4f1c, // rusty orange (Grumble's helmet)
  z: 0xa8bc94, Z: 0x75896a, // grey-green skin (Grumble)
  q: 0x7a5c9e, Q: 0x4f3a6e, j: 0xa58cc8, // fuzzy purple (Webby)
  m: 0xf08a7a, // rosy nose / cheeks
  H: 0xd9a27a, // skin shadow
  i: 0xcdc9d6, I: 0x9d99a8, // soft greys (beard, string)
  x: 0xb8f4fb, // pale cyan (diamond facets)
  O: 0xf0601e, P: 0xc8341e, X: 0x7a2418, // lava orange / red / crust
  J: 0xdcc2ff, // pale violet glow
});

Object.assign(ICONS, {
  sword: [
    '.............kkk',
    '............kLMk',
    '...........kLMDk',
    '..........kLMDk.',
    '.........kLMDk..',
    '........kLMDk...',
    '....k..kLMDk....',
    '...ktkkLMDk.....',
    '...kBtLMDk......',
    '....kBtkk.......',
    '...ktBBtk.......',
    '.kktbkkBtk......',
    'kLNbk..kk.......',
    'kNDk............',
    '.kk.............',
    '................',
  ],
  helmet: [
    '................',
    '................',
    '.....kkkkkk.....',
    '...kkLLMMMMkk...',
    '..kLLMMMMMMMNk..',
    '..kLMMMMMMMMNk..',
    '.kLMMMMMMMMMMNk.',
    '.kMMMMMMMMMMMNk.',
    '.kDLDDDDDDDDLDk.',
    '.kMNkkkkkkkkMDk.',
    '.kMNk......kMDk.',
    '.kMNk......kMDk.',
    '.kNDk......kNDk.',
    '..kk........kk..',
    '................',
    '................',
  ],
  chestplate: [
    '................',
    '.kkkkk....kkkkk.',
    'kLLMMNk..kMMMNDk',
    'kLMMMMNkkNMMMMDk',
    'kLMMMMMMMMMMMMDk',
    'kkkLMMMMMMMMNkkk',
    '..kLMMMMMMMMNk..',
    '..kLMMMMMMMMNk..',
    '..kDDDDDDDDDDk..',
    '..kLMMMMMMMMNk..',
    '..kLMMMMMMMMNk..',
    '..kDDDDDDDDDDk..',
    '..kLMMMMMMMMNk..',
    '..kNNNNNNNNNNk..',
    '..kkkkkkkkkkkk..',
    '................',
  ],
  leggings: [
    '................',
    '................',
    '..kkkkkkkkkkkk..',
    '..kLLMMMMMMMNk..',
    '..kDDDDLDDDDDk..',
    '..kLMMMMMMMMNk..',
    '..kLMMMkkMMMNk..',
    '..kLMMNkkLMMNk..',
    '..kLMMNkkLMMNk..',
    '..kLMMNkkLMMNk..',
    '..kLMMNkkLMMNk..',
    '..kLMMNkkLMMNk..',
    '..kDDDDkkDDDDk..',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
  ],
  boots: [
    '................',
    '................',
    '................',
    '................',
    '.kkkkk...kkkkk..',
    '.kLLMk...kLLMk..',
    '.kDDDk...kDDDk..',
    '.kLMNk...kLMNk..',
    '.kLMNk...kLMNk..',
    '.kLMMkk..kLMMkk.',
    '.kLMMMNk.kLMMMNk',
    '.kDDDDDk.kDDDDDk',
    '.kkkkkkk.kkkkkkk',
    '................',
    '................',
    '................',
  ],
  stick: [
    '................',
    '............kk..',
    '...........ktbk.',
    '..........ktbk..',
    '.........ktbk...',
    '........ktBk....',
    '.......ktbkkk...',
    '......ktbkgek...',
    '.....ktbk.kk....',
    '....ktbk........',
    '...kBbk.........',
    '..ktbk..........',
    '.ktbk...........',
    'ktbk............',
    '.kk.............',
    '................',
  ],
  string: [
    '................',
    '................',
    '.....kkkkk......',
    '...kkwwwWikk....',
    '..kwwiwwwiWik...',
    '..kwiwwwiWWik...',
    '.kwwwwwiWWWWik..',
    '.kwiwwiWWWiWik..',
    '.kiwwiWWWiWWIk..',
    '.kWWiWWWiWWIIk..',
    '..kiWWWiWWIIk...',
    '..kWWWiWWIIIkk..',
    '...kkIIIIIkkWWk.',
    '.....kkkkk..kkWk',
    '..............kk',
    '................',
  ],
  bow: [
    '................',
    '....kkk.........',
    '....kWtkk.......',
    '....kW.ktkk.....',
    '....kW...ktk....',
    '....kW....ktk...',
    '....kW....ktbk..',
    '....kW.....kbk..',
    '....kW....kBBBk.',
    '....kW....kBBBk.',
    '....kW.....kbk..',
    '....kW....ktbk..',
    '....kW....ktk...',
    '....kW...ktk....',
    '....kW.ktkk.....',
    '....kkkkk.......',
  ],
  orb: [
    '............k...',
    '...........kwk..',
    '..........kwYwk.',
    '.....kkkkkkkwk..',
    '...kkJJvvvvkk...',
    '..kJwwJvvvvvVk..',
    '..kJwJvvvvvvVk..',
    '.kJvvvvJJvvvVVk.',
    '.kvvvvJwJJvvVVk.',
    '.kvvvvJJJJvvVVk.',
    '.kvvvvvJJvvVVVk.',
    '..kvvvvvvvvVVk..',
    '..kVvvvvvVVVVk..',
    '...kkVVVVVVkk...',
    '.....kkkkkk.....',
    '................',
  ],
  diamond: [
    '................',
    '................',
    '................',
    '....kkkkkkkk....',
    '...kxwxxcxxcCk..',
    '..kxwxxcxcxxcCk.',
    '.kkkkkkkkkkkkkk.',
    '..kcxccccccCCk..',
    '...kcxcccccCk...',
    '....kcxcccCk....',
    '.....kcxcCk.....',
    '......kcCk......',
    '.......kk.......',
    '................',
    '................',
    '................',
  ],
  uparrow: [
    '................',
    '.......kk.......',
    '......kegk......',
    '.....keegGk.....',
    '....keeggGGk....',
    '...keeegggGGk...',
    '..keeeggggGGGk..',
    '.keeegggggGGGGk.',
    '.kkkkeeggGGkkkk.',
    '....keeggGGk....',
    '....keeggGGk....',
    '....keeggGGk....',
    '....keeggGGk....',
    '....kGGGGGGk....',
    '....kkkkkkkk....',
    '................',
  ],
  gloop: [
    '................',
    '................',
    '...kkkkkkkkkk...',
    '..kweeeeeeeegk..',
    '.kwewweeeewwgGk.',
    '.kewwkkggwwwwGk.',
    '.kewwkkggwkkwGk.',
    '.kggwwggggkkgGk.',
    '.kgmggggggggmGk.',
    '.kggkkkkkkkkGGk.',
    '.kggkRRRRRRkGGk.',
    '.kggGkRppRkGGGk.',
    '.kGGGGkppkGGGGk.',
    '.kGGGGGkkGGGGGk.',
    '..kGkkkkkkkkGk..',
    '...k........k...',
  ],
  grumble: [
    '................',
    '.....kkkkkk.....',
    '...kkAakYYkakk..',
    '..kAAakkYkaaak..',
    '..kaaaakkaaaAk..',
    '.kAAAAAAAAAAAAk.',
    '..kzZZZzzZZZzk..',
    'kzkzkkkzzkkkzkzk',
    'kzkzwkwZZwkwzkzk',
    '.kkzzzzZZzzzzkk.',
    '..kzzkkkkkkzzk..',
    '..kzkzzwzzzkzk..',
    '.kukkzzzzzzkkuk.',
    'kuuukkkkkkkkUuuk',
    'kuuzuuuUuuzuuUuk',
    'kkzkkkkkkkkkzkkk',
  ],
  webby: [
    '......k..k......',
    '......kkkk......',
    '....kkjjqqkk....',
    '...kjjqqqqqqk...',
    'k..kwwwqqwwwk..k',
    '.qqkwkwqqwkwkqq.',
    '...kwkwqqwkwk...',
    'kqqkwwwqqwwwkqqk',
    '...kmqkqqkqmk...',
    '.qqkqqqkkqqqkqq.',
    'k..kQqqqqqqQk..k',
    '....kQQQQQQk....',
    '...q.kkkkkk.q...',
    '..k..........k..',
    '................',
    '................',
  ],
  rocky: [
    '......ege.......',
    '.....kkgkkk.....',
    '....kgeggegk....',
    '...kgggGggGGk...',
    '...klgGslgGSk...',
    '...klsssslsSk...',
    '.kkknYnssnYnkkk.',
    'klsknYnssnYnksSk',
    'kgsklssssssgkgSk',
    'ksSklksssskGkSSk',
    '.kkklskkkksSkkk.',
    '...kSgGsssSSk...',
    '....kSSSSSSk....',
    '...kSSk..kSSk...',
    '...kkkk..kkkk...',
    '................',
  ],
  magma: [
    '.........kk.....',
    '..kk....kYk..k..',
    '.kYk.....k..kFk.',
    '..k.kkkkkk...k..',
    '...kFYYFFffk....',
    '..kFYYFffffOk...',
    '.kFYwkffffkfOk..',
    '.kFfkkfffkfkOk..',
    'kffffffffffffOk.',
    'kfkfffkkkkkfkOOk',
    'kffkkkpppkkkfOPk',
    'kfOOfkkkkkfOOPPk',
    '.kOOOOOOOOOOPPk.',
    '.kPPXPPPPPXPPPk.',
    '..kkkkkkkkkkkk..',
    '................',
  ],
  pip: [
    '......kkkk......',
    '....kkyFFykk....',
    '...kyyFwwFyyk...',
    '..kyYyyFFyyyok..',
    '..kyyyyyyyyyok..',
    '.kooooooooooook.',
    '..khWWWhhWWWhk..',
    '..khikhhhhkihk..',
    '.kHmhhhmmhhhmHk.',
    '.kWWWWmmmmWWWWk.',
    '.kWWWWkppkWWWWk.',
    '.kiWWWWWWWWWWik.',
    'kuukWWWWWWWWkuuk',
    'kuyukiWWWWikuyuk',
    'kuuuukkiikkuuuUk',
    'kkkkkkkkkkkkkkkk',
  ],
});

const ARMOR = ['helmet', 'chestplate', 'leggings', 'boots'];

// A sword whose blade is the given material ('wood'..'diamond').
export function swordURL(mat, size = 96) { return iconURL('sword', size, matShades(mat)); }

// The pickaxe icon with its head in the given material.
export function pickURL(mat, size = 96) {
  const s = matShades(mat);
  return iconURL('pickaxe', size, { l: s.L, s: s.M, S: s.D });
}

// One armor piece ('helmet' | 'chestplate' | 'leggings' | 'boots') in a material.
export function armorURL(piece, mat, size = 96) {
  return iconURL(ARMOR.includes(piece) ? piece : 'chestplate', size, matShades(mat));
}

// Crafting materials and special items.
export function itemURL(id, size = 96) {
  switch (id) {
    case 'planks': return tileURL('planks', size);
    case 'iron': return barURL('iron', size);
    case 'gold': return barURL('gold', size);
    case 'stick': case 'string': case 'bow': case 'orb': case 'diamond': return iconURL(id, size);
    default: return tileURL('mystery', size);
  }
}

// Bright green emeralds: the game's special currency.
export function emeraldURL(size = 96) { return iconURL('gem', size, { c: 0x2fd06a, C: 0x1a8a44, w: 0xc8ffd8 }); }

const MONSTERS = ['gloop', 'grumble', 'webby', 'rocky', 'magma'];
// The five friendly-goofy monsters.
export function monsterURL(id, size = 96) { return MONSTERS.includes(id) ? iconURL(id, size) : tileURL('mystery', size); }

// Pip, the old miner who shows the way.
export function guideURL(size = 96) { return iconURL('pip', size); }

// ---------------------------------------------------------------------------
// The hero: a full-body kid miner (16 wide x 24 tall) dressed in whatever gear
// Ezra has equipped. Every part has its own letters, so armor recolours only
// its own piece and tools/back items never clash with the body:
//   body  k outline, H/J hair, h skin, E eyes, r blush, m mouth,
//         T/Q/t shirt (main/light/dark), b belt, P/p trousers, O/o shoes
//   helmet 1-4, chest seam N, knee L, ninja band R, royal trim Y
//   held weapon 5/6/7 (light/main/dark), back pickaxe x/y/z
//   wood c/d/e, bow string S, orb g/v/V + glint w
// ---------------------------------------------------------------------------
const HERO_BODY = [
  '................',
  '....kkkkkkkk....',
  '...kHHHHHHHHk...',
  '...kHHHHHHHJk...',
  '...kHHHhHHhHk...',
  '...kHhhhhhhJk...',
  '...khhEhhEhhk...',
  '...khhEhhEhhk...',
  '...khrhmmhrhk...',
  '....kkkkkkkk....',
  '..kTTTTTTTTTTk..',
  '..kTkQTTTTtkTk..',
  '..kTkQTTTTtkTk..',
  '..khkQTTTTtkhk..',
  '..khkTTTTTtkhk..',
  '..kkkbbbbbbkkk..',
  '....kPPPPPpk....',
  '....kPPPPPpk....',
  '....kPPkkPpk....',
  '....kPPkkPpk....',
  '....kPpkkPpk....',
  '...kOOOkkOOOk...',
  '...koookkoook...',
  '...kkkkkkkkkk...',
];

// Helmet drawn over the hair ('.' = leave the body pixel alone).
const HERO_HELMET = [
  '....kkkkkkkk....',
  '...k11222222k...',
  '..k1122222223k..',
  '..k1222222223k..',
  '..k4414444144k..',
  '..k2k......k3k..',
  '..k4k......k4k..',
  '..kkk......kkk..',
];

// Sword in the right hand (stamp's top-left sits at x=12, y=4).
const HERO_SWORD = [
  '..k.',
  '.k5k',
  '.k5k',
  '.k6k',
  '.k6k',
  '.k6k',
  '.k7k',
  '.ddd',
  '.kck',
  'hhck',
  'kkck',
  '.k7k',
  '..k.',
];

// Pickaxe in the right hand when there's no sword (top-left at x=11, y=4).
const HERO_PICK_HAND = [
  '.kkk.',
  'k556k',
  '6kck7',
  'kkckk',
  '.kck.',
  '.kck.',
  '.kck.',
  '.kck.',
  '.kck.',
  'hhck.',
  '.kck.',
  '.kck.',
  '.kdk.',
  '..k..',
];

// With a sword in hand, the pickaxe stands beside the kid's right foot.
const HERO_PICK_REST = [
  '.kkk.',
  'kxxyk',
  'ykdkz',
  'kkdkk',
  '.kdk.',
  '.kdk.',
  '..k..',
];

const HERO_SKINS = {
  classic: { H: 0x6b4423, J: 0x4a2d16, T: 0x4a7fe0, Q: 0x7aa8ff, t: 0x3058b0, b: 0x5e3b1c, P: 0x3a3f5c, p: 0x262a40, O: 0x7a4a24, o: 0x4e2e14 },
  explorer: { H: 0x8a5a2e, J: 0x5e3b1c, T: 0x4fa84a, Q: 0x8cd07a, t: 0x2f7a35, b: 0x6b4423, P: 0xc8b07a, p: 0x9a8452, O: 0x6b4423, o: 0x4a2d16 },
  ninja: { H: 0x24222c, J: 0x121118, T: 0x34323e, Q: 0x55526a, t: 0x1c1b22, b: 0xe0403a, P: 0x34323e, p: 0x1c1b22, O: 0x24222c, o: 0x121118 },
  royal: { H: 0xe0b040, J: 0xb08420, T: 0x8a4ae0, Q: 0xb58cf0, t: 0x5e2ea8, b: 0xf6c935, P: 0x4a3070, p: 0x2e1c4a, O: 0x7a4a24, o: 0x4e2e14 },
};
const HERO_BASE = {
  k: 0x1e1a24, h: 0xf2c8a0, E: 0x1e1a24, r: 0xf4a090, m: 0xa0503c,
  R: 0xe0403a, Y: 0xf6c935, c: 0x8a5a2e, d: 0x5e3b1c, e: 0xc99a5b, S: 0xf3eee6,
  g: 0xdcc2ff, v: 0x9a6ae0, V: 0x6a40b0, w: 0xffffff,
};

// Paint a small sprite (array of strings) into a char grid at (ox, oy).
function stamp(grid, rows, ox, oy) {
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
    const ch = rows[y][x], gx = x + ox, gy = y + oy;
    if (ch !== '.' && gx >= 0 && gx < 16 && gy >= 0 && gy < 24) grid[gy][gx] = ch;
  }
}

// gear = { helmet, chest, legs, boots, sword, pick, bow, orb, skin }
// Armor/tool values are 'wood'|'stone'|'iron'|'gold'|'diamond' or null;
// bow/orb are booleans; skin is 'classic'|'explorer'|'ninja'|'royal'.
// Returns a PNG data URL `size` wide and size*1.5 tall.
export function heroURL(gear = {}, size = 192) {
  const g = gear || {};
  const key = 'hero:' + JSON.stringify(g) + ':' + size;
  if (cache.has(key)) return cache.get(key);
  const col = Object.assign({}, HERO_BASE, HERO_SKINS[g.skin] || HERO_SKINS.classic);
  const shade = (mat) => (mat ? matShades(mat) : null); // unknown names fall back to iron
  const grid = Array.from({ length: 24 }, () => Array(16).fill('.'));

  // Holding something in the right hand? Nudge the kid 1px left to make room.
  const held = g.sword || g.pick;
  const bx = held ? -1 : 0;

  // --- worn on the back (drawn first; the body covers most of it)
  if (g.bow) {
    stamp(grid, [
      '..k.',
      '.kek',
      'kek.',
      'ek..',
      'ek..',
      'dk..',
      'dk..',
      'ek..',
      'ekS.',
      'ekS.',
      'ekS.',
      'kekS',
      '.kek',
      '..k.',
    ], 0, 8);
  }
  const restPick = !!(g.pick && g.sword);

  // --- the kid
  stamp(grid, HERO_BODY, bx, 0);
  if (g.skin === 'ninja' && !g.helmet) stamp(grid, ['...kRRRRRRRRkR', '............kR'], bx, 4);
  if (g.skin === 'royal' && !g.chest) stamp(grid, ['...YYYYYYYYYY...'], bx, 10);
  if (g.helmet) stamp(grid, HERO_HELMET, bx, 0);
  if (g.chest) stamp(grid, ['.....NNNNNN.....'], bx, 12);
  if (g.legs) stamp(grid, ['.....L...L......'], bx, 18);
  if (g.boots) stamp(grid, ['.....OO..OO.....'], bx, 20);

  // --- held in the right hand
  if (g.sword) stamp(grid, HERO_SWORD, 12, 4);
  else if (g.pick) stamp(grid, HERO_PICK_HAND, 11, 4);
  if (restPick) stamp(grid, HERO_PICK_REST, 11, 17);
  if (g.orb) {
    if (held) { stamp(grid, ['.kk.', 'kgvk', 'kvVk', '.kk.'], 12, 0); stamp(grid, ['w'], 11, 0); }
    else { stamp(grid, ['.kk.', 'kgvk', 'kvVk', '.kk.'], 12, 6); stamp(grid, ['w'], 15, 5); }
  }

  // --- colours: armor recolours just its own piece
  const hs = shade(g.helmet), cs = shade(g.chest), ls = shade(g.legs), bs = shade(g.boots);
  if (hs) Object.assign(col, { 1: hs.L, 2: hs.M, 3: hs.N, 4: hs.D });
  if (cs) Object.assign(col, { T: cs.M, Q: cs.L, t: cs.D, N: cs.N });
  if (ls) Object.assign(col, { P: ls.M, p: ls.D, L: ls.L });
  if (bs) Object.assign(col, { O: bs.M, o: bs.D });
  const ws = shade(g.sword || g.pick);
  if (ws) Object.assign(col, { 5: ws.L, 6: ws.M, 7: ws.D });
  if (restPick) { const ps = shade(g.pick); Object.assign(col, { x: ps.L, y: ps.M, z: ps.D }); }

  const src = document.createElement('canvas');
  src.width = 16; src.height = 24;
  const ctx = src.getContext('2d');
  for (let y = 0; y < 24; y++) for (let x = 0; x < 16; x++) {
    const c = col[grid[y][x]];
    if (c !== undefined) px(ctx, x, y, rgb(c));
  }
  const out = document.createElement('canvas');
  out.width = size; out.height = Math.round(size * 1.5);
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = false;
  octx.drawImage(src, 0, 0, out.width, out.height);
  cache.set(key, out.toDataURL());
  return cache.get(key);
}
