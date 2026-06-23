// WebGL setup, shader programs, procedural texture atlas, and mesh helpers.
// Targets WebGL1 (works on essentially every iPad) with no external libraries.

export const ATLAS = { tile: 16, perRow: 16, size: 256 }; // 16x16 grid of 16px tiles

// Tile indices in the atlas.
export const TILE = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3,
  SAND: 4, LOG_SIDE: 5, LOG_TOP: 6, LEAVES: 7,
  PLANKS: 8, WATER: 9, BEDROCK: 10, NEUTRAL: 11,
  BRICK: 12, GLASS: 13, COBBLE: 14, STONE_BRICK: 15,
  SNOW: 16, ICE: 17, GRAVEL: 18, BIRCH_PLANKS: 19,
  DARK_PLANKS: 20, GOLD: 21, DIAMOND: 22, BOOKSHELF: 23,
  GLOWSTONE: 24, PUMPKIN_SIDE: 25, PUMPKIN_TOP: 26, OBSIDIAN: 27,
  BIRCH_LOG: 28, NETHERRACK: 29, NETHER_PORTAL: 30, LAVA: 31,
  DOOR: 32, DOOR_OPEN: 33, TNT_SIDE: 34, TNT_TOP: 35,
  RAINBOW: 36, LEVER: 37, LEVER_ON: 38, REDSTONE: 39, REDLAMP: 40, REDLAMP_ON: 41,
  SLIME: 42, SAPLING: 43,
  MEGA_TNT_SIDE: 44, MEGA_TNT_TOP: 45, SANDSTONE: 46, END_STONE: 47,
  BED_FOOT: 48, BED_HEAD: 49, BED_SIDE: 50, BARRIER: 51, LANTERN: 52,
  IRON_BLOCK: 53, GOLD_BLOCK: 54, DIAMOND_BLOCK: 55, EMERALD_BLOCK: 56, LAPIS_BLOCK: 57,
  REDSTONE_BLOCK: 58, COAL_BLOCK: 59, AMETHYST: 60,
  DEEPSLATE: 61, GRANITE: 62, ANDESITE: 63, DIORITE: 64, QUARTZ: 65, PRISMARINE: 66, SEA_LANTERN: 67,
  MOSS: 68, MUSHROOM_RED: 69, MUSHROOM_BROWN: 70, CACTUS_TOP: 71, CACTUS_SIDE: 72, MUD: 73,
  NETHER_BRICK: 74, MAGMA: 75,
  MELON_TOP: 76, MELON_SIDE: 77, HAY_TOP: 78, HAY_SIDE: 79, NOTE_BLOCK: 80, SPONGE: 81,
  LEGO_TOP: 82, LEGO_SIDE: 83,
};

export function initGL(canvas) {
  const opts = { antialias: true, alpha: false, powerPreference: 'high-performance' };
  const gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
  if (!gl) throw new Error('This device does not support WebGL, so the 3D world can’t be drawn.');
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.frontFace(gl.CCW);
  return gl;
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('Shader error: ' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

export function makeProgram(gl, vsSrc, fsSrc, attribs, uniforms) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fsSrc));
  // Pin attribute locations to 0..n-1 so we can reliably clear stale arrays.
  attribs.forEach((name, i) => gl.bindAttribLocation(prog, i, name));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('Program link error: ' + gl.getProgramInfoLog(prog));
  }
  const a = {}, u = {};
  for (const name of attribs) a[name] = gl.getAttribLocation(prog, name);
  for (const name of uniforms) u[name] = gl.getUniformLocation(prog, name);
  return { program: prog, a, u };
}

// --- World shader: textured + per-vertex tint + baked light + fog ---
const WORLD_VS = `
attribute vec3 aPos;
attribute vec2 aUV;
attribute vec3 aColor;
attribute float aLight;
uniform mat4 uProj, uView, uModel;
varying vec2 vUV;
varying vec3 vColor;
varying float vLight;
varying float vDist;
void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vec4 viewPos = uView * world;
  gl_Position = uProj * viewPos;
  vUV = aUV;
  vColor = aColor;
  vLight = aLight;
  vDist = length(viewPos.xyz);
}`;

const WORLD_FS = `
precision mediump float;
varying vec2 vUV;
varying vec3 vColor;
varying float vLight;
varying float vDist;
uniform sampler2D uTex;
uniform vec3 uFogColor;
uniform float uFogNear, uFogFar, uAlpha, uDayLight;
void main() {
  vec4 tex = texture2D(uTex, vUV);
  if (tex.a < 0.5) discard;            // cutout transparency (glass, leaves)
  vec3 c = tex.rgb * vColor * vLight * uDayLight;
  float fog = clamp((vDist - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  c = mix(c, uFogColor, fog);
  gl_FragColor = vec4(c, uAlpha);
}`;

// --- Line shader: solid color (block highlight) ---
const LINE_VS = `
attribute vec3 aPos;
uniform mat4 uProj, uView, uModel;
void main() { gl_Position = uProj * uView * uModel * vec4(aPos, 1.0); }`;

const LINE_FS = `
precision mediump float;
uniform vec4 uColor;
void main() { gl_FragColor = uColor; }`;

export function makeWorldProgram(gl) {
  return makeProgram(gl, WORLD_VS, WORLD_FS,
    ['aPos', 'aUV', 'aColor', 'aLight'],
    ['uProj', 'uView', 'uModel', 'uTex', 'uFogColor', 'uFogNear', 'uFogFar', 'uAlpha', 'uDayLight']);
}

export function makeLineProgram(gl) {
  return makeProgram(gl, LINE_VS, LINE_FS,
    ['aPos'], ['uProj', 'uView', 'uModel', 'uColor']);
}

// UV rectangle for a tile, with a half-texel inset to avoid edge bleeding.
// flipY is enabled on upload, so canvas-top maps to the larger v.
export function getUV(tile) {
  const col = tile % ATLAS.perRow;
  const row = Math.floor(tile / ATLAS.perRow);
  const t = ATLAS.tile, S = ATLAS.size, e = 0.5 / S;
  const u0 = col * t / S + e;
  const u1 = (col + 1) * t / S - e;
  const v1 = 1 - (row * t / S) - e;       // canvas top
  const v0 = 1 - ((row + 1) * t / S) + e;  // canvas bottom
  return { u0, u1, v0, v1 };
}

// --- Procedural texture atlas drawn on a 2D canvas ---
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shade(hex, f) {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

function noise(ctx, ox, oy, base, variance, seed) {
  const r = rng(seed);
  for (let y = 0; y < ATLAS.tile; y++) {
    for (let x = 0; x < ATLAS.tile; x++) {
      const f = 1 - variance / 2 + r() * variance;
      ctx.fillStyle = shade(base, f);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

function buildAtlasCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = ATLAS.size;
  const ctx = c.getContext('2d');
  const T = ATLAS.tile;
  const at = (tile) => [(tile % ATLAS.perRow) * T, Math.floor(tile / ATLAS.perRow) * T];
  let p;

  p = at(TILE.GRASS_TOP); noise(ctx, p[0], p[1], 0x6abe4f, 0.28, 1);
  p = at(TILE.GRASS_SIDE);
  noise(ctx, p[0], p[1], 0x8a6240, 0.22, 2);               // dirt base
  const r2 = rng(22);
  for (let x = 0; x < T; x++) {                            // grassy overhang on top
    const h = 3 + Math.floor(r2() * 3);
    for (let y = 0; y < h; y++) { ctx.fillStyle = shade(0x6abe4f, 0.85 + r2() * 0.3); ctx.fillRect(p[0] + x, p[1] + y, 1, 1); }
  }
  p = at(TILE.DIRT); noise(ctx, p[0], p[1], 0x8a6240, 0.26, 3);
  p = at(TILE.STONE); noise(ctx, p[0], p[1], 0x8f8f97, 0.18, 4);
  p = at(TILE.SAND); noise(ctx, p[0], p[1], 0xe4d6a0, 0.16, 5);
  p = at(TILE.LOG_SIDE);
  noise(ctx, p[0], p[1], 0x9c7142, 0.18, 6);
  const r6 = rng(66);
  for (let x = 0; x < T; x++) if (r6() < 0.35) { ctx.fillStyle = shade(0x6f4e2c, 1); for (let y = 0; y < T; y++) ctx.fillRect(p[0] + x, p[1] + y, 1, 1); }
  p = at(TILE.LOG_TOP);
  noise(ctx, p[0], p[1], 0xc49a5e, 0.12, 7);
  ctx.fillStyle = shade(0x6f4e2c, 1);
  ctx.fillRect(p[0] + 6, p[1] + 6, 4, 4);
  p = at(TILE.LEAVES); noise(ctx, p[0], p[1], 0x4f9a3a, 0.34, 8);
  // Punch see-through gaps so leaves read as leafy (cutout, like Minecraft).
  { const r = rng(811); for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (r() < 0.22) ctx.clearRect(p[0] + x, p[1] + y, 1, 1); }
  p = at(TILE.PLANKS);
  noise(ctx, p[0], p[1], 0xc99a5b, 0.12, 9);
  ctx.fillStyle = shade(0x8a6a3a, 1);
  for (let y = 4; y < T; y += 5) ctx.fillRect(p[0], p[1] + y, T, 1);
  p = at(TILE.WATER); noise(ctx, p[0], p[1], 0x3a86d6, 0.12, 10);
  p = at(TILE.BEDROCK); noise(ctx, p[0], p[1], 0x4a4a52, 0.4, 11);
  p = at(TILE.NEUTRAL);
  // Light neutral tile with a soft bevel so tinting reads as a clean color.
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const edge = (x === 0 || y === 0) ? 1.12 : ((x === T - 1 || y === T - 1) ? 0.82 : 1);
    ctx.fillStyle = shade(0xdedede, edge);
    ctx.fillRect(p[0] + x, p[1] + y, 1, 1);
  }
  p = at(TILE.BRICK);
  noise(ctx, p[0], p[1], 0xb05a44, 0.1, 12);
  ctx.fillStyle = shade(0xe7d9c9, 1);
  for (let y = 0; y < T; y += 4) ctx.fillRect(p[0], p[1] + y, T, 1);
  for (let y = 0; y < T; y += 4) for (let x = (y % 8 === 0 ? 4 : 0); x < T; x += 8) ctx.fillRect(p[0] + x, p[1] + y, 1, 4);
  // Glass: a clear (transparent) pane with a light-blue frame + a corner shine,
  // so you can see through it like Minecraft.
  p = at(TILE.GLASS);
  ctx.clearRect(p[0], p[1], T, T);
  ctx.fillStyle = 'rgba(206,238,247,0.96)';
  for (let i = 0; i < T; i++) { ctx.fillRect(p[0] + i, p[1], 1, 2); ctx.fillRect(p[0] + i, p[1] + T - 2, 1, 2); ctx.fillRect(p[0], p[1] + i, 2, 1); ctx.fillRect(p[0] + T - 2, p[1] + i, 2, 1); }
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(p[0] + 4, p[1] + 4, 2, 6); ctx.fillRect(p[0] + 4, p[1] + 4, 5, 2);

  // --- extra building blocks ---
  // Cobblestone: lumpy grey stones
  p = at(TILE.COBBLE); noise(ctx, p[0], p[1], 0x8f8f96, 0.22, 40);
  { const r = rng(401); for (let i = 0; i < 10; i++) { const x = Math.floor(r() * 14), y = Math.floor(r() * 14); ctx.fillStyle = shade(r() < 0.5 ? 0x6d6d74 : 0xaeaeb6, 1); ctx.fillRect(p[0] + x, p[1] + y, 2 + Math.floor(r() * 2), 2 + Math.floor(r() * 2)); } }

  // Stone bricks
  p = at(TILE.STONE_BRICK); noise(ctx, p[0], p[1], 0x9a9aa1, 0.08, 42);
  ctx.fillStyle = shade(0x6a6a70, 1);
  for (let y = 0; y < T; y += 8) ctx.fillRect(p[0], p[1] + y, T, 1);
  for (let y = 0; y < T; y += 8) ctx.fillRect(p[0] + (y % 16 === 0 ? 8 : 0), p[1] + y, 1, 8);

  p = at(TILE.SNOW); noise(ctx, p[0], p[1], 0xeef3fb, 0.05, 43);

  p = at(TILE.ICE); noise(ctx, p[0], p[1], 0xa9d6ee, 0.07, 44);
  ctx.fillStyle = shade(0xcdeaf7, 1); for (let i = 0; i < T; i++) ctx.fillRect(p[0] + i, p[1] + ((i * 5) % T), 1, 1);

  p = at(TILE.GRAVEL); noise(ctx, p[0], p[1], 0x847f7a, 0.3, 45);

  p = at(TILE.BIRCH_PLANKS); noise(ctx, p[0], p[1], 0xdacca0, 0.08, 46);
  ctx.fillStyle = shade(0xb7a577, 1); for (let y = 0; y < T; y += 5) ctx.fillRect(p[0], p[1] + y, T, 1);

  p = at(TILE.DARK_PLANKS); noise(ctx, p[0], p[1], 0x4f3a22, 0.1, 47);
  ctx.fillStyle = shade(0x352616, 1); for (let y = 0; y < T; y += 5) ctx.fillRect(p[0], p[1] + y, T, 1);

  // Gold: bright with a highlight + sparkles
  p = at(TILE.GOLD); noise(ctx, p[0], p[1], 0xf2c63a, 0.08, 48);
  ctx.fillStyle = shade(0xfff0a0, 1); ctx.fillRect(p[0] + 1, p[1] + 1, 5, 1); ctx.fillRect(p[0] + 1, p[1] + 1, 1, 5);
  { const r = rng(480); for (let i = 0; i < 5; i++) ctx.fillRect(p[0] + Math.floor(r() * T), p[1] + Math.floor(r() * T), 1, 1); }

  // Diamond: teal with sparkles
  p = at(TILE.DIAMOND); noise(ctx, p[0], p[1], 0x59d6c8, 0.1, 49);
  ctx.fillStyle = shade(0xd7fbf5, 1); { const r = rng(491); for (let i = 0; i < 6; i++) ctx.fillRect(p[0] + Math.floor(r() * T), p[1] + Math.floor(r() * T), 1, 1); }

  // Bookshelf: planks top/bottom, colourful book spines in the middle
  p = at(TILE.BOOKSHELF); noise(ctx, p[0], p[1], 0xc99a5b, 0.1, 50);
  ctx.fillStyle = shade(0x8a6a3a, 1); ctx.fillRect(p[0], p[1], T, 3); ctx.fillRect(p[0], p[1] + T - 3, T, 3);
  { const cols = [0xc0392b, 0x2980b9, 0x27ae60, 0xe0b020, 0x8e44ad]; const r = rng(500); for (let x = 0; x < T; x += 2) { ctx.fillStyle = shade(cols[Math.floor(r() * cols.length)], 1); ctx.fillRect(p[0] + x, p[1] + 4, 1, 8); } }

  // Glowstone
  p = at(TILE.GLOWSTONE); noise(ctx, p[0], p[1], 0xe8c24a, 0.12, 51);
  { const r = rng(510); for (let i = 0; i < 8; i++) { ctx.fillStyle = shade(0xfff0b0, 1); ctx.fillRect(p[0] + Math.floor(r() * 14), p[1] + Math.floor(r() * 14), 2, 2); } }

  // Pumpkin side with a friendly carved face
  p = at(TILE.PUMPKIN_SIDE); noise(ctx, p[0], p[1], 0xe07b1e, 0.08, 52);
  ctx.fillStyle = shade(0xb35e12, 1); for (let x = 2; x < T; x += 4) ctx.fillRect(p[0] + x, p[1], 1, T);
  ctx.fillStyle = shade(0x3a2410, 1);
  ctx.fillRect(p[0] + 3, p[1] + 5, 3, 2); ctx.fillRect(p[0] + 10, p[1] + 5, 3, 2);
  ctx.fillRect(p[0] + 4, p[1] + 10, 8, 1); ctx.fillRect(p[0] + 4, p[1] + 9, 1, 1); ctx.fillRect(p[0] + 11, p[1] + 9, 1, 1);

  p = at(TILE.PUMPKIN_TOP); noise(ctx, p[0], p[1], 0xd9781e, 0.08, 53);
  ctx.fillStyle = shade(0x6e4a1e, 1); ctx.fillRect(p[0] + 6, p[1] + 6, 4, 4);

  p = at(TILE.OBSIDIAN); noise(ctx, p[0], p[1], 0x241a33, 0.18, 54);
  { const r = rng(540); for (let i = 0; i < 6; i++) { ctx.fillStyle = shade(0x5a4a7a, 1); ctx.fillRect(p[0] + Math.floor(r() * T), p[1] + Math.floor(r() * T), 1, 1); } }

  p = at(TILE.BIRCH_LOG); noise(ctx, p[0], p[1], 0xe7e2d4, 0.06, 55);
  ctx.fillStyle = shade(0x2a2a2a, 1); { const r = rng(550); for (let i = 0; i < 6; i++) ctx.fillRect(p[0] + Math.floor(r() * 13), p[1] + Math.floor(r() * 15), 2 + Math.floor(r() * 2), 1); }

  // --- Nether blocks ---
  p = at(TILE.NETHERRACK); noise(ctx, p[0], p[1], 0x7a2e2e, 0.3, 60);
  { const r = rng(601); for (let i = 0; i < 14; i++) { ctx.fillStyle = shade(0x4e1c1c, 1); ctx.fillRect(p[0] + Math.floor(r() * 15), p[1] + Math.floor(r() * 15), 1 + Math.floor(r() * 2), 1); } }

  p = at(TILE.NETHER_PORTAL); noise(ctx, p[0], p[1], 0x7a3fb0, 0.18, 62);
  { const r = rng(621); for (let i = 0; i < 12; i++) { ctx.fillStyle = shade(r() < 0.5 ? 0xc59cf0 : 0x4f2580, 1); ctx.fillRect(p[0] + Math.floor(r() * 14), p[1] + Math.floor(r() * 14), 2, 2); } }

  p = at(TILE.LAVA); noise(ctx, p[0], p[1], 0xe8702a, 0.16, 63);
  { const r = rng(631); for (let i = 0; i < 9; i++) { ctx.fillStyle = shade(0xffd45a, 1); ctx.fillRect(p[0] + Math.floor(r() * 14), p[1] + Math.floor(r() * 14), 2, 1); } }

  // --- Door (House kit) ---
  // Closed: a wooden door with two panels and a brass knob.
  p = at(TILE.DOOR); noise(ctx, p[0], p[1], 0x8a5a2a, 0.10, 70);
  ctx.fillStyle = shade(0x5e3c1c, 1);
  ctx.fillRect(p[0], p[1], T, 1); ctx.fillRect(p[0], p[1] + T - 1, T, 1);
  ctx.fillRect(p[0], p[1], 1, T); ctx.fillRect(p[0] + T - 1, p[1], 1, T);
  for (const oy of [2, 9]) { ctx.fillRect(p[0] + 3, p[1] + oy, T - 7, 1); ctx.fillRect(p[0] + 3, p[1] + oy + 4, T - 7, 1); ctx.fillRect(p[0] + 3, p[1] + oy, 1, 5); ctx.fillRect(p[0] + T - 5, p[1] + oy, 1, 5); }
  ctx.fillStyle = shade(0xf2c63a, 1); ctx.fillRect(p[0] + T - 6, p[1] + 8, 2, 2);
  // Open: the leaf swung aside, with a dark doorway you can see through.
  p = at(TILE.DOOR_OPEN); noise(ctx, p[0], p[1], 0x8a5a2a, 0.10, 71);
  ctx.fillStyle = shade(0x241a12, 1); ctx.fillRect(p[0] + 4, p[1] + 1, T - 5, T - 2);
  ctx.fillStyle = shade(0x5e3c1c, 1);
  ctx.fillRect(p[0], p[1], 4, 1); ctx.fillRect(p[0], p[1] + T - 1, 4, 1); ctx.fillRect(p[0] + 3, p[1], 1, T);
  ctx.fillRect(p[0] + T - 1, p[1], 1, T); ctx.fillRect(p[0], p[1], T, 1); ctx.fillRect(p[0], p[1] + T - 1, T, 1);

  // --- TNT (used by TNT World / the explosive block) ---
  p = at(TILE.TNT_SIDE); noise(ctx, p[0], p[1], 0xc0392b, 0.10, 72);
  ctx.fillStyle = shade(0xf2e6c0, 1); ctx.fillRect(p[0], p[1] + 6, T, 4);
  ctx.fillStyle = shade(0x3a2a12, 1);
  ctx.fillRect(p[0] + 2, p[1] + 7, 3, 2); ctx.fillRect(p[0] + 7, p[1] + 7, 2, 2); ctx.fillRect(p[0] + 11, p[1] + 7, 3, 2);
  p = at(TILE.TNT_TOP); noise(ctx, p[0], p[1], 0xc0392b, 0.10, 73);
  ctx.fillStyle = shade(0x7a2018, 1); for (let i = 0; i < T; i += 4) ctx.fillRect(p[0] + i, p[1], 1, T);
  ctx.fillStyle = shade(0x3a2a12, 1); ctx.fillRect(p[0] + 7, p[1] + 7, 2, 2);

  // --- Mega TNT (the 💎-shop block: a bigger, scarier-looking dynamite) ---
  // Darker, angrier red than normal TNT, a fatter band, a bold white "M", and
  // little spark dots so it clearly reads as the "mega" version Ezra bought.
  p = at(TILE.MEGA_TNT_SIDE); noise(ctx, p[0], p[1], 0x8e1b12, 0.12, 74);
  ctx.fillStyle = shade(0xf7efd0, 1); ctx.fillRect(p[0], p[1] + 5, T, 6);          // fat label band
  ctx.fillStyle = shade(0x8e1b12, 1);                                               // a chunky "M"
  ctx.fillRect(p[0] + 3, p[1] + 6, 1, 4); ctx.fillRect(p[0] + 12, p[1] + 6, 1, 4);
  ctx.fillRect(p[0] + 5, p[1] + 7, 1, 1); ctx.fillRect(p[0] + 10, p[1] + 7, 1, 1);
  ctx.fillRect(p[0] + 7, p[1] + 8, 2, 1);
  ctx.fillStyle = shade(0x3a2a12, 1);
  ctx.fillRect(p[0] + 1, p[1] + 1, 2, 2); ctx.fillRect(p[0] + 13, p[1] + 1, 2, 2);  // fuse roots
  ctx.fillStyle = shade(0xffd24a, 1); ctx.fillRect(p[0] + 1, p[1], 1, 1); ctx.fillRect(p[0] + 14, p[1], 1, 1); // sparks
  p = at(TILE.MEGA_TNT_TOP); noise(ctx, p[0], p[1], 0x8e1b12, 0.12, 75);
  ctx.fillStyle = shade(0x5a1009, 1); for (let i = 0; i < T; i += 4) ctx.fillRect(p[0] + i, p[1], 1, T);
  ctx.fillStyle = shade(0x3a2a12, 1); ctx.fillRect(p[0] + 6, p[1] + 6, 4, 4);
  ctx.fillStyle = shade(0xffd24a, 1); ctx.fillRect(p[0] + 7, p[1] + 7, 2, 2);       // glowing fuse top

  // --- Sandstone (desert building block: pale tan with soft layered bands) ---
  p = at(TILE.SANDSTONE); noise(ctx, p[0], p[1], 0xe6d8a8, 0.08, 76);
  ctx.fillStyle = shade(0xcab984, 1); ctx.fillRect(p[0], p[1] + 4, T, 1); ctx.fillRect(p[0], p[1] + 10, T, 1);
  ctx.fillStyle = shade(0xf2e8c4, 1); ctx.fillRect(p[0], p[1] + 5, T, 1); ctx.fillRect(p[0], p[1] + 11, T, 1);

  // --- Bed (cozy, blocky): a red blanket, a white pillow on the head ---
  p = at(TILE.BED_FOOT); noise(ctx, p[0], p[1], 0xc23a3a, 0.08, 80);
  ctx.fillStyle = shade(0x9c2a2a, 1); ctx.fillRect(p[0], p[1] + 7, T, 1);            // a blanket fold
  ctx.fillStyle = shade(0xe05a5a, 1); ctx.fillRect(p[0] + 2, p[1] + 2, T - 4, 3);    // soft highlight
  p = at(TILE.BED_HEAD); noise(ctx, p[0], p[1], 0xc23a3a, 0.08, 81);
  ctx.fillStyle = shade(0xf4f0e6, 1); ctx.fillRect(p[0] + 2, p[1] + 2, T - 4, 6);    // pillow
  ctx.fillStyle = shade(0xdcd6c4, 1); ctx.fillRect(p[0] + 2, p[1] + 7, T - 4, 1);
  p = at(TILE.BED_SIDE); noise(ctx, p[0], p[1], 0xc23a3a, 0.08, 82);
  ctx.fillStyle = shade(0x7a4a28, 1); ctx.fillRect(p[0], p[1] + T - 4, T, 4);        // wooden base
  ctx.fillStyle = shade(0x5a3618, 1); ctx.fillRect(p[0], p[1] + T - 1, T, 1);

  // --- Force Field / Barrier: mostly see-through with a faint cyan shimmer ---
  p = at(TILE.BARRIER); ctx.clearRect(p[0], p[1], T, T);
  ctx.fillStyle = 'rgba(110,230,240,0.85)';
  for (let i = 0; i < T; i++) { ctx.fillRect(p[0] + i, p[1], 1, 1); ctx.fillRect(p[0] + i, p[1] + T - 1, 1, 1); ctx.fillRect(p[0], p[1] + i, 1, 1); ctx.fillRect(p[0] + T - 1, p[1] + i, 1, 1); }
  for (let i = 2; i < T - 1; i += 4) { ctx.fillRect(p[0] + i, p[1] + i, 1, 1); ctx.fillRect(p[0] + (T - 1 - i), p[1] + i, 1, 1); }   // a faint sparkle cross

  // --- Lantern: a warm glowing light block (decoration) ---
  p = at(TILE.LANTERN); noise(ctx, p[0], p[1], 0x4a3a22, 0.12, 83);
  ctx.fillStyle = shade(0xffe07a, 1); ctx.fillRect(p[0] + 4, p[1] + 4, T - 8, T - 8);   // glowing core
  ctx.fillStyle = shade(0xfff4c2, 1); ctx.fillRect(p[0] + 6, p[1] + 6, 4, 4);
  ctx.fillStyle = shade(0x2a2018, 1); ctx.fillRect(p[0] + 3, p[1], T - 6, 2); ctx.fillRect(p[0] + 3, p[1] + T - 2, T - 6, 2);   // metal caps

  // --- End Stone (the pale, speckled ground of The End) ---
  p = at(TILE.END_STONE); noise(ctx, p[0], p[1], 0xe6e6b0, 0.06, 77);
  { const r = rng(960); for (let i = 0; i < 24; i++) { ctx.fillStyle = shade(i % 2 ? 0xcfcf86 : 0xf6f6d2, 1); ctx.fillRect(p[0] + Math.floor(r() * T), p[1] + Math.floor(r() * T), 1, 1); } }

  // --- Rainbow block (a sparkly shop reward) ---
  // Bright horizontal stripes of the rainbow, with a few twinkling sparkles.
  p = at(TILE.RAINBOW);
  { const bands = [0xe23b3b, 0xf08a2a, 0xf2d234, 0x4fbf4f, 0x3a86d6, 0x9959d9]; const r = rng(800);
    for (let y = 0; y < T; y++) {
      const col = bands[Math.min(bands.length - 1, Math.floor(y / T * bands.length))];
      for (let x = 0; x < T; x++) { ctx.fillStyle = shade(col, 0.9 + r() * 0.2); ctx.fillRect(p[0] + x, p[1] + y, 1, 1); }
    }
    for (let i = 0; i < 7; i++) { ctx.fillStyle = shade(0xffffff, 1); ctx.fillRect(p[0] + Math.floor(r() * T), p[1] + Math.floor(r() * T), 1, 1); }
  }

  // --- Redstone kit (lever / wire / lamp) ---
  // Lever OFF: stone block, handle leaning right with a pale knob.
  p = at(TILE.LEVER); noise(ctx, p[0], p[1], 0x8f8f97, 0.16, 90);
  ctx.fillStyle = shade(0x55555c, 1); ctx.fillRect(p[0] + 3, p[1] + 11, 10, 3);   // base plate
  ctx.fillStyle = shade(0x6b4a2a, 1); ctx.fillRect(p[0] + 9, p[1] + 4, 2, 8);      // handle
  ctx.fillStyle = shade(0xd0d0d6, 1); ctx.fillRect(p[0] + 8, p[1] + 3, 4, 3);      // pale knob (off)
  // Lever ON: handle leaning left with a bright red knob (powered).
  p = at(TILE.LEVER_ON); noise(ctx, p[0], p[1], 0x8f8f97, 0.16, 91);
  ctx.fillStyle = shade(0x55555c, 1); ctx.fillRect(p[0] + 3, p[1] + 11, 10, 3);
  ctx.fillStyle = shade(0x6b4a2a, 1); ctx.fillRect(p[0] + 5, p[1] + 4, 2, 8);
  ctx.fillStyle = shade(0xff3b30, 1); ctx.fillRect(p[0] + 4, p[1] + 3, 4, 3);      // red knob (on)
  // Redstone wire: dark block with a red dust cross.
  p = at(TILE.REDSTONE); noise(ctx, p[0], p[1], 0x2a2a30, 0.18, 92);
  ctx.fillStyle = shade(0xc0392b, 1); ctx.fillRect(p[0] + 7, p[1] + 1, 2, 14); ctx.fillRect(p[0] + 1, p[1] + 7, 14, 2);
  { const r = rng(920); for (let i = 0; i < 5; i++) { ctx.fillStyle = shade(0xe8625a, 1); ctx.fillRect(p[0] + Math.floor(r() * T), p[1] + Math.floor(r() * T), 1, 1); } }
  // Redstone lamp OFF: warm brown block with a dim grid.
  p = at(TILE.REDLAMP); noise(ctx, p[0], p[1], 0x7a6038, 0.12, 93);
  ctx.fillStyle = shade(0x4a3a20, 1); for (let i = 0; i < T; i += 5) { ctx.fillRect(p[0] + i, p[1], 1, T); ctx.fillRect(p[0], p[1] + i, T, 1); }
  // Redstone lamp ON: bright glowing orange-yellow.
  p = at(TILE.REDLAMP_ON); noise(ctx, p[0], p[1], 0xf2b53a, 0.12, 94);
  { const r = rng(940); for (let i = 0; i < 10; i++) { ctx.fillStyle = shade(0xfff0b0, 1); ctx.fillRect(p[0] + Math.floor(r() * 14), p[1] + Math.floor(r() * 14), 2, 2); } }

  // Bouncy slime block: jelly green with a soft highlight + inner blobs.
  p = at(TILE.SLIME); noise(ctx, p[0], p[1], 0x6fcf6a, 0.14, 95);
  ctx.fillStyle = shade(0x4aa849, 1); ctx.fillRect(p[0] + 3, p[1] + 3, 10, 10);   // inner gel square
  ctx.fillStyle = shade(0xbff0a8, 1); ctx.fillRect(p[0] + 2, p[1] + 2, 3, 1); ctx.fillRect(p[0] + 2, p[1] + 2, 1, 3); // shine

  // Sapling: a little green sprout in soil (grows into a tree over time).
  p = at(TILE.SAPLING); noise(ctx, p[0], p[1], 0x7a5a36, 0.18, 96);
  ctx.fillStyle = shade(0x3f7a2e, 1); ctx.fillRect(p[0] + 7, p[1] + 5, 2, 8);            // stem
  ctx.fillStyle = shade(0x5bbf3a, 1);
  ctx.fillRect(p[0] + 4, p[1] + 6, 3, 2); ctx.fillRect(p[0] + 9, p[1] + 6, 3, 2);        // side leaves
  ctx.fillRect(p[0] + 6, p[1] + 2, 4, 3);                                                // top bud

  // --- A big batch of recognizable Minecraft-style blocks (variety = the toy) ---
  // Small reusable styles keep this compact.
  const speckle = (tile, base, v, seed, d, l) => { const q = at(tile); noise(ctx, q[0], q[1], base, v, seed); const r = rng(seed * 7 + 3); for (let i = 0; i < 30; i++) { ctx.fillStyle = shade(i % 2 ? d : l, 1); ctx.fillRect(q[0] + (r() * T | 0), q[1] + (r() * T | 0), 1, 1); } };
  const metal = (tile, base, seed) => { const q = at(tile); noise(ctx, q[0], q[1], base, 0.05, seed); ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(q[0] + 2, q[1] + 2, T - 6, 1); ctx.fillRect(q[0] + 2, q[1] + 2, 1, T - 6); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(q[0] + 3, q[1] + T - 3, T - 5, 1); ctx.fillRect(q[0] + T - 3, q[1] + 3, 1, T - 5); };
  const gem = (tile, base, accent, seed) => { const q = at(tile); noise(ctx, q[0], q[1], base, 0.07, seed); ctx.fillStyle = shade(accent, 1); ctx.fillRect(q[0] + 5, q[1] + 3, 2, 2); ctx.fillRect(q[0] + 9, q[1] + 8, 2, 2); ctx.fillRect(q[0] + 4, q[1] + 10, 1, 1); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(q[0] + 3, q[1] + 3, 3, 1); };
  const glow = (tile, base, bright, seed) => { const q = at(tile); noise(ctx, q[0], q[1], base, 0.05, seed); const r = rng(seed); for (let i = 0; i < 16; i++) { ctx.fillStyle = shade(bright, 1); ctx.fillRect(q[0] + (r() * 14 | 0), q[1] + (r() * 14 | 0), 2, 2); } };
  const soft = (tile, base, seed) => { const q = at(tile); noise(ctx, q[0], q[1], base, 0.04, seed); };
  // Minerals
  metal(TILE.IRON_BLOCK, 0xd8d8de, 201); metal(TILE.GOLD_BLOCK, 0xf2c63a, 202);
  gem(TILE.DIAMOND_BLOCK, 0x57d6c8, 0xbff7f2, 203); gem(TILE.EMERALD_BLOCK, 0x36c463, 0xa9f0c0, 204);
  speckle(TILE.LAPIS_BLOCK, 0x274bbf, 0.12, 205, 0x16307f, 0x5b7be6);
  speckle(TILE.REDSTONE_BLOCK, 0xb01818, 0.12, 206, 0x7a0e0e, 0xe85a4a);
  speckle(TILE.COAL_BLOCK, 0x24232a, 0.14, 207, 0x111014, 0x4a4954);
  gem(TILE.AMETHYST, 0x9b59d0, 0xd9b8f5, 208);
  // Stone variants
  speckle(TILE.DEEPSLATE, 0x3a3a42, 0.10, 209, 0x24242a, 0x55555f);
  speckle(TILE.GRANITE, 0xa56b53, 0.12, 210, 0x7e4d3a, 0xc89077);
  speckle(TILE.ANDESITE, 0x8f8f95, 0.10, 211, 0x70707a, 0xb0b0b6);
  speckle(TILE.DIORITE, 0xdcdce0, 0.10, 212, 0xb4b4bc, 0xffffff);
  soft(TILE.QUARTZ, 0xeee9dd, 213); { const q = at(TILE.QUARTZ); ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(q[0], q[1] + 7, T, 1); }
  speckle(TILE.PRISMARINE, 0x3f8f86, 0.12, 214, 0x2c6a63, 0x67bdb2);
  glow(TILE.SEA_LANTERN, 0xcfeee6, 0xffffff, 215);
  // Nature
  speckle(TILE.MOSS, 0x5a8f3a, 0.16, 216, 0x3f6a26, 0x7fc257);
  { const q = at(TILE.MUSHROOM_RED); noise(ctx, q[0], q[1], 0xc23a32, 0.06, 217); ctx.fillStyle = shade(0xf4f0e6, 1); const r = rng(217); for (let i = 0; i < 7; i++) ctx.fillRect(q[0] + (r() * 13 | 0), q[1] + (r() * 13 | 0), 3, 3); }
  soft(TILE.MUSHROOM_BROWN, 0x8a6a4a, 218);
  { const q = at(TILE.CACTUS_TOP); noise(ctx, q[0], q[1], 0x4f9a3a, 0.10, 219); ctx.fillStyle = shade(0x3f7a2e, 1); ctx.fillRect(q[0] + 5, q[1] + 5, 6, 6); }
  { const q = at(TILE.CACTUS_SIDE); noise(ctx, q[0], q[1], 0x4f9a3a, 0.10, 220); ctx.fillStyle = shade(0x3f7a2e, 1); ctx.fillRect(q[0], q[1], 1, T); ctx.fillRect(q[0] + T - 1, q[1], 1, T); ctx.fillStyle = shade(0x6fc257, 1); for (let y = 2; y < T; y += 5) ctx.fillRect(q[0] + 7, q[1] + y, 2, 2); }
  speckle(TILE.MUD, 0x4a3a30, 0.10, 221, 0x352820, 0x604c3e);
  // Nether
  { const q = at(TILE.NETHER_BRICK); noise(ctx, q[0], q[1], 0x3a1c22, 0.08, 222); ctx.fillStyle = shade(0x200f14, 1); for (let y = 0; y < T; y += 4) ctx.fillRect(q[0], q[1] + y, T, 1); for (let y = 0; y < T; y += 8) ctx.fillRect(q[0] + 8, q[1] + y, 1, 4); for (let y = 4; y < T; y += 8) ctx.fillRect(q[0], q[1] + y, 1, 4); }
  { const q = at(TILE.MAGMA); noise(ctx, q[0], q[1], 0x3a1810, 0.10, 223); const r = rng(223); for (let i = 0; i < 10; i++) { ctx.fillStyle = shade(i % 2 ? 0xf08a2a : 0xf2d234, 1); ctx.fillRect(q[0] + (r() * 13 | 0), q[1] + (r() * 13 | 0), 3, 2); } }
  // Decor
  { const q = at(TILE.MELON_TOP); noise(ctx, q[0], q[1], 0x4f9a3a, 0.08, 224); ctx.fillStyle = shade(0x2f6a22, 1); for (let i = 2; i < T; i += 4) ctx.fillRect(q[0] + i, q[1], 1, T); }
  { const q = at(TILE.MELON_SIDE); noise(ctx, q[0], q[1], 0x3f7a2e, 0.08, 225); ctx.fillStyle = shade(0xc23a32, 1); ctx.fillRect(q[0] + 2, q[1] + 2, T - 4, T - 4); ctx.fillStyle = shade(0xe06a52, 1); for (let i = 3; i < T - 2; i += 3) ctx.fillRect(q[0] + i, q[1] + 3, 1, T - 6); }
  { const q = at(TILE.HAY_TOP); noise(ctx, q[0], q[1], 0xd8b23a, 0.08, 226); ctx.fillStyle = shade(0x9c7a1e, 1); ctx.strokeStyle = shade(0x9c7a1e, 1); ctx.fillRect(q[0] + 6, q[1] + 6, 4, 4); ctx.fillRect(q[0] + 2, q[1] + 2, 2, 2); ctx.fillRect(q[0] + T - 4, q[1] + 2, 2, 2); ctx.fillRect(q[0] + 2, q[1] + T - 4, 2, 2); ctx.fillRect(q[0] + T - 4, q[1] + T - 4, 2, 2); }
  { const q = at(TILE.HAY_SIDE); noise(ctx, q[0], q[1], 0xe0c04a, 0.08, 227); ctx.fillStyle = shade(0x9c7a1e, 1); ctx.fillRect(q[0], q[1] + 1, T, 1); ctx.fillRect(q[0], q[1] + T - 2, T, 1); ctx.fillStyle = shade(0xb08a24, 1); for (let x = 1; x < T; x += 3) ctx.fillRect(q[0] + x, q[1] + 3, 1, T - 6); }
  { const q = at(TILE.NOTE_BLOCK); noise(ctx, q[0], q[1], 0x8a5a30, 0.10, 228); ctx.fillStyle = shade(0x5a3a1c, 1); ctx.strokeRect(q[0] + 0.5, q[1] + 0.5, T - 1, T - 1); ctx.fillStyle = shade(0x2a2030, 1); ctx.fillRect(q[0] + 9, q[1] + 4, 2, 7); ctx.fillRect(q[0] + 5, q[1] + 9, 5, 3); }
  { const q = at(TILE.SPONGE); noise(ctx, q[0], q[1], 0xd8c24a, 0.10, 229); ctx.fillStyle = shade(0x9c8a2a, 1); const r = rng(229); for (let i = 0; i < 12; i++) ctx.fillRect(q[0] + (r() * 14 | 0), q[1] + (r() * 14 | 0), 2, 2); }

  // --- Lego bricks: drawn neutral (white/greys) so a per-colour tint makes
  // vivid bricks. Top = 2x2 glossy studs; side = a brick with a shiny top rim.
  { const q = at(TILE.LEGO_TOP); ctx.fillStyle = '#ededed'; ctx.fillRect(q[0], q[1], T, T);
    ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.fillRect(q[0], q[1] + T - 1, T, 1); ctx.fillRect(q[0] + T - 1, q[1], 1, T);
    const studs = [[4, 4], [12, 4], [4, 12], [12, 12]];
    for (const [sx, sy] of studs) {
      ctx.fillStyle = '#cfcfcf'; ctx.beginPath(); ctx.arc(q[0] + sx, q[1] + sy, 3.0, 0, 7); ctx.fill();          // stud base/shadow
      ctx.fillStyle = '#f6f6f6'; ctx.beginPath(); ctx.arc(q[0] + sx - 0.4, q[1] + sy - 0.4, 2.1, 0, 7); ctx.fill(); // stud top
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(q[0] + sx - 0.9, q[1] + sy - 0.9, 0.9, 0, 7); ctx.fill(); // hot spot
    }
  }
  { const q = at(TILE.LEGO_SIDE); ctx.fillStyle = '#e2e2e2'; ctx.fillRect(q[0], q[1], T, T);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(q[0], q[1], T, 2);                       // glossy top rim
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(q[0] + 2, q[1] + 3, 2, T - 5);  // soft left highlight
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(q[0], q[1] + T - 2, T, 2);    // bottom shade
  }

  return c;
}

let _atlasCanvas = null;

// A small canvas showing one atlas tile, scaled up crisply (for the UI picker).
// An optional tint [r,g,b] (0..1) multiplies the tile so colour blocks (which
// share the neutral tile + a tint) show their real colour in the menu.
export function blockPreview(tile, size, tint) {
  if (!_atlasCanvas) _atlasCanvas = buildAtlasCanvas();
  const t = ATLAS.tile;
  const col = tile % ATLAS.perRow, row = Math.floor(tile / ATLAS.perRow);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(_atlasCanvas, col * t, row * t, t, t, 0, 0, size, size);
  if (tint && (tint[0] !== 1 || tint[1] !== 1 || tint[2] !== 1)) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgb(' + Math.round(tint[0] * 255) + ',' + Math.round(tint[1] * 255) + ',' + Math.round(tint[2] * 255) + ')';
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';
    // keep transparent pixels transparent (multiply leaves them be on most browsers)
  }
  return c;
}

export function makeAtlasTexture(gl) {
  const canvas = _atlasCanvas || (_atlasCanvas = buildAtlasCanvas());
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

// A flat 1×1 dark quad laid in the ground plane — a soft blob shadow drawn
// under each creature (with uAlpha + blending) so they feel planted in the
// world instead of floating. Sample the NEUTRAL tile centre for a flat colour.
export function shadowMesh(gl) { return quadMesh(gl, [0, 0, 0]); }

// A flat 1×1 quad at y=0 in a solid colour — used for the blob shadow (black) and
// the green "build here" footprint preview. Drawn in a blended pass with uAlpha.
export function quadMesh(gl, color) {
  const r = getUV(TILE.NEUTRAL);
  const u = (r.u0 + r.u1) / 2, v = (r.v0 + r.v1) / 2;
  const verts = [[-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 0, -0.5], [-0.5, 0, -0.5]];
  const A = { pos: [], uv: [], col: [], light: [], idx: [] };
  for (const p of verts) { A.pos.push(p[0], p[1], p[2]); A.uv.push(u, v); A.col.push(color[0], color[1], color[2]); A.light.push(1); }
  A.idx.push(0, 1, 2, 0, 2, 3);
  const m = new GLMesh(gl);
  m.setAttrib('aPos', new Float32Array(A.pos), 3);
  m.setAttrib('aUV', new Float32Array(A.uv), 2);
  m.setAttrib('aColor', new Float32Array(A.col), 3);
  m.setAttrib('aLight', new Float32Array(A.light), 1);
  m.setIndex(new Uint16Array(A.idx));
  return m;
}

// A simple mesh: named float attribute buffers plus a uint16 index buffer.
export class GLMesh {
  constructor(gl) {
    this.gl = gl;
    this.attribs = {}; // name -> { buf, size }
    this.ibuf = null;
    this.count = 0;
  }
  setAttrib(name, data, size) {
    const gl = this.gl;
    let entry = this.attribs[name];
    if (!entry) { entry = this.attribs[name] = { buf: gl.createBuffer(), size }; }
    entry.size = size;
    gl.bindBuffer(gl.ARRAY_BUFFER, entry.buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  }
  setIndex(data) {
    const gl = this.gl;
    if (!this.ibuf) this.ibuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    this.count = data.length;
  }
  draw(prog, mode) {
    const gl = this.gl;
    if (!this.count) return;
    // Clear any attribute arrays a previous program/mesh left enabled.
    for (let i = 0; i < 4; i++) gl.disableVertexAttribArray(i);
    for (const name in prog.a) {
      const loc = prog.a[name];
      const entry = this.attribs[name];
      if (loc < 0 || !entry) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, entry.buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, entry.size, gl.FLOAT, false, 0, 0);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibuf);
    gl.drawElements(mode === undefined ? gl.TRIANGLES : mode, this.count, gl.UNSIGNED_SHORT, 0);
  }
  dispose() {
    const gl = this.gl;
    for (const name in this.attribs) gl.deleteBuffer(this.attribs[name].buf);
    if (this.ibuf) gl.deleteBuffer(this.ibuf);
    this.attribs = {}; this.ibuf = null; this.count = 0;
  }
}

// --- Helper meshes for build/dig guides ---
function pushBox(A, x0, y0, z0, x1, y1, z1, tTop, tSide, tBot, tint, flat) {
  const faces = [
    { s: 1.0, t: tTop, v: [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]] },
    { s: 0.5, t: tBot, v: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]] },
    { s: 0.7, t: tSide, v: [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]] },
    { s: 0.85, t: tSide, v: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]] },
    { s: 0.65, t: tSide, v: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]] },
    { s: 0.8, t: tSide, v: [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]] },
  ];
  for (const f of faces) {
    const r = getUV(f.t);
    const uvc = [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v1]];
    const base = A.pos.length / 3;
    for (let i = 0; i < 4; i++) {
      A.pos.push(f.v[i][0], f.v[i][1], f.v[i][2]);
      A.uv.push(uvc[i][0], uvc[i][1]);
      A.col.push(tint[0], tint[1], tint[2]);
      A.light.push(flat ? 1.0 : f.s);
    }
    A.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

function finishMesh(gl, A) {
  const m = new GLMesh(gl);
  m.setAttrib('aPos', new Float32Array(A.pos), 3);
  m.setAttrib('aUV', new Float32Array(A.uv), 2);
  m.setAttrib('aColor', new Float32Array(A.col), 3);
  m.setAttrib('aLight', new Float32Array(A.light), 1);
  m.setIndex(new Uint16Array(A.idx));
  return m;
}

// A unit cube (0..1) textured for a block — used as the translucent build ghost.
export function cubeMesh(gl, tiles, tint, flat) {
  const A = { pos: [], uv: [], col: [], light: [] , idx: [] };
  pushBox(A, 0, 0, 0, 1, 1, 1, tiles.top, tiles.side, tiles.bottom, tint, flat);
  return finishMesh(gl, A);
}

// A wireframe (12 beams); thickness and colour configurable. Used as a light
// outline indicator for where a block will be placed.
export function frameMesh(gl, t, tint) {
  const A = { pos: [], uv: [], col: [], light: [], idx: [] };
  t = t || 0.055; tint = tint || [0.05, 0.05, 0.08];
  const N = TILE.NEUTRAL;
  const beam = (x0, y0, z0, x1, y1, z1) => pushBox(A, x0, y0, z0, x1, y1, z1, N, N, N, tint, true);
  for (const Y of [0, 1]) for (const Z of [0, 1]) beam(0, Y - t, Z - t, 1, Y + t, Z + t);
  for (const X of [0, 1]) for (const Z of [0, 1]) beam(X - t, 0, Z - t, X + t, 1, Z + t);
  for (const X of [0, 1]) for (const Y of [0, 1]) beam(X - t, Y - t, 0, X + t, Y + t, 1);
  return finishMesh(gl, A);
}
