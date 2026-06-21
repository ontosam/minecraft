// WebGL setup, shader programs, procedural texture atlas, and mesh helpers.
// Targets WebGL1 (works on essentially every iPad) with no external libraries.

export const ATLAS = { tile: 16, perRow: 4, size: 64 }; // 4x4 grid of 16px tiles

// Tile indices in the atlas.
export const TILE = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3,
  SAND: 4, LOG_SIDE: 5, LOG_TOP: 6, LEAVES: 7,
  PLANKS: 8, WATER: 9, BEDROCK: 10, NEUTRAL: 11,
  BRICK: 12, GLASS: 13,
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
uniform float uFogNear, uFogFar;
void main() {
  vec4 tex = texture2D(uTex, vUV);
  vec3 c = tex.rgb * vColor * vLight;
  float fog = clamp((vDist - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  c = mix(c, uFogColor, fog);
  gl_FragColor = vec4(c, 1.0);
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
    ['uProj', 'uView', 'uModel', 'uTex', 'uFogColor', 'uFogNear', 'uFogFar']);
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
  p = at(TILE.GLASS);
  noise(ctx, p[0], p[1], 0xbfe6f2, 0.06, 13);
  ctx.fillStyle = shade(0x9fd0e0, 1);
  ctx.strokeRect && (ctx.fillRect(p[0], p[1], T, 1), ctx.fillRect(p[0], p[1] + T - 1, T, 1), ctx.fillRect(p[0], p[1], 1, T), ctx.fillRect(p[0] + T - 1, p[1], 1, T));

  return c;
}

export function makeAtlasTexture(gl) {
  const canvas = buildAtlasCanvas();
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
