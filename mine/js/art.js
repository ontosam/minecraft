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
