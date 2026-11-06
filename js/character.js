// Ezra's character: a friendly blocky kid, built from boxes, with arms and
// legs that swing while walking. Now *skinnable* — pick who you want to be
// (Ezra, Mama, Dada, friends, Cristiano, Steve, a hero…). Drawn with the world
// shader (per-part model matrices) so it shares the lighting/fog with everything.

import { GLMesh, getUV, TILE } from './gfx.js';
import { mat4 } from './math.js';

const SH = { top: 1.0, bottom: 0.55, pz: 0.85, nz: 0.70, px: 0.80, nx: 0.65 };

function addBox(A, x0, y0, z0, x1, y1, z1, color) {
  const r = getUV(TILE.NEUTRAL);
  const faces = [
    { s: SH.top, v: [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]] },
    { s: SH.bottom, v: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]] },
    { s: SH.nz, v: [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]] },
    { s: SH.pz, v: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]] },
    { s: SH.nx, v: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]] },
    { s: SH.px, v: [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]] },
  ];
  const uvc = [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v1]];
  for (const f of faces) {
    const base = A.pos.length / 3;
    for (let i = 0; i < 4; i++) {
      A.pos.push(f.v[i][0], f.v[i][1], f.v[i][2]);
      A.uv.push(uvc[i][0], uvc[i][1]);
      A.col.push(color[0], color[1], color[2]);
      A.light.push(f.s);
    }
    A.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

function mesh(gl, build) {
  const A = { pos: [], uv: [], col: [], light: [], idx: [] };
  build(A);
  const m = new GLMesh(gl);
  m.setAttrib('aPos', new Float32Array(A.pos), 3);
  m.setAttrib('aUV', new Float32Array(A.uv), 2);
  m.setAttrib('aColor', new Float32Array(A.col), 3);
  m.setAttrib('aLight', new Float32Array(A.light), 1);
  m.setIndex(new Uint16Array(A.idx));
  return m;
}

const EYE = [0.16, 0.13, 0.12];
const GOLD = [0.98, 0.82, 0.20], GEM = [0.88, 0.20, 0.32];
const STEEL = [0.55, 0.86, 0.95], GRIP = [0.32, 0.20, 0.12], GUARD = [0.86, 0.70, 0.28];

// --- Who you can be (blocky, friendly, recoloured — not photo likenesses) ---
export const CHARACTERS = [
  { id: 'ezra', name: 'Ezra', emoji: '🧒', skin: [0.97, 0.80, 0.67], shirt: [0.30, 0.62, 0.88], pants: [0.33, 0.36, 0.55], shoe: [0.25, 0.22, 0.24], hair: [0.34, 0.22, 0.13] },
  { id: 'chris', name: 'Chris', emoji: '👩', skin: [0.98, 0.82, 0.70], shirt: [0.82, 0.40, 0.62], pants: [0.40, 0.30, 0.50], shoe: [0.55, 0.32, 0.42], hair: [0.28, 0.16, 0.10], long: true },
  { id: 'vlad', name: 'Vlad', emoji: '👨', skin: [0.95, 0.76, 0.62], shirt: [0.24, 0.55, 0.38], pants: [0.28, 0.28, 0.34], shoe: [0.20, 0.18, 0.20], hair: [0.22, 0.15, 0.10], beard: true },
  { id: 'cora', name: 'Cora', emoji: '👧', skin: [0.99, 0.86, 0.74], shirt: [0.96, 0.82, 0.32], pants: [0.55, 0.35, 0.65], shoe: [0.92, 0.55, 0.62], hair: [0.85, 0.68, 0.32], long: true },
  { id: 'jovi', name: 'Jovi', emoji: '👧', skin: [0.86, 0.66, 0.50], shirt: [0.50, 0.35, 0.78], pants: [0.45, 0.30, 0.55], shoe: [0.30, 0.22, 0.35], hair: [0.16, 0.12, 0.10], long: true },
  { id: 'cristiano', name: 'Cristiano', emoji: '⚽', skin: [0.82, 0.62, 0.46], shirt: [0.86, 0.16, 0.16], pants: [0.95, 0.95, 0.96], shoe: [0.10, 0.10, 0.12], hair: [0.15, 0.12, 0.10], ball: true },
  { id: 'steve', name: 'Steve', emoji: '⛏️', skin: [0.78, 0.60, 0.46], shirt: [0.18, 0.66, 0.66], pants: [0.30, 0.32, 0.62], shoe: [0.40, 0.40, 0.45], hair: [0.30, 0.20, 0.12], beard: true },
  { id: 'hero', name: 'Super Hero', emoji: '🦸', skin: [0.97, 0.80, 0.67], shirt: [0.20, 0.42, 0.85], pants: [0.20, 0.25, 0.60], shoe: [0.75, 0.62, 0.20], hair: [0.20, 0.15, 0.10], cape: true, capeColor: [0.88, 0.18, 0.20] },
  // Ezra's real friends.
  { id: 'alex', name: 'Alex', emoji: '🧒', skin: [0.98, 0.82, 0.66], shirt: [0.32, 0.72, 0.42], pants: [0.34, 0.32, 0.45], shoe: [0.30, 0.25, 0.22], hair: [0.86, 0.50, 0.20], long: true },
  { id: 'chip', name: 'Chip', emoji: '🧒', skin: [0.86, 0.66, 0.50], shirt: [0.96, 0.80, 0.26], pants: [0.26, 0.40, 0.62], shoe: [0.30, 0.30, 0.34], hair: [0.26, 0.18, 0.10] },
  { id: 'milo', name: 'Milo', emoji: '🧒', skin: [0.95, 0.78, 0.62], shirt: [0.22, 0.62, 0.70], pants: [0.30, 0.28, 0.42], shoe: [0.22, 0.20, 0.24], hair: [0.14, 0.11, 0.09] },
  { id: 'brexin', name: 'Brexin', emoji: '🧒', skin: [0.70, 0.52, 0.38], shirt: [0.86, 0.30, 0.30], pants: [0.20, 0.20, 0.24], shoe: [0.30, 0.20, 0.20], hair: [0.10, 0.08, 0.07] },
];
// Older saves may still hold the previous ids — map them so a saved pick sticks.
const CHAR_ALIAS = { mama: 'chris', dada: 'vlad' };
export const charById = (id) => CHARACTERS.find((c) => c.id === (CHAR_ALIAS[id] || id)) || CHARACTERS[0];

// A little 2D "paper-doll" preview of a character (in their real colours) for
// the picker — clearer than an emoji, and cheap (plain canvas rects).
export function charPreview(def, size) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'), S = size;
  const col = (a) => 'rgb(' + Math.round(a[0] * 255) + ',' + Math.round(a[1] * 255) + ',' + Math.round(a[2] * 255) + ')';
  const R = (x0, y0, x1, y1, a) => { ctx.fillStyle = col(a); ctx.fillRect(Math.round(x0 * S), Math.round(y0 * S), Math.round((x1 - x0) * S), Math.round((y1 - y0) * S)); };
  if (def.cape) R(0.33, 0.40, 0.67, 0.80, def.capeColor || def.shirt);
  if (def.long) { R(0.30, 0.14, 0.37, 0.62, def.hair); R(0.63, 0.14, 0.70, 0.62, def.hair); }
  R(0.40, 0.66, 0.49, 0.90, def.pants); R(0.51, 0.66, 0.60, 0.90, def.pants);   // legs
  R(0.40, 0.88, 0.49, 0.95, def.shoe); R(0.51, 0.88, 0.60, 0.95, def.shoe);     // shoes
  R(0.27, 0.40, 0.36, 0.62, def.shirt); R(0.64, 0.40, 0.73, 0.62, def.shirt);   // arms
  R(0.27, 0.59, 0.36, 0.65, def.skin); R(0.64, 0.59, 0.73, 0.65, def.skin);     // hands
  R(0.36, 0.40, 0.64, 0.68, def.shirt);                                         // body
  R(0.34, 0.13, 0.66, 0.40, def.skin);                                          // head
  R(0.32, 0.09, 0.68, 0.20, def.hair);                                          // hair cap
  if (def.long) { R(0.32, 0.13, 0.37, 0.30, def.hair); R(0.63, 0.13, 0.68, 0.30, def.hair); }
  R(0.42, 0.25, 0.47, 0.30, EYE); R(0.53, 0.25, 0.58, 0.30, EYE);               // eyes
  if (def.beard) R(0.37, 0.33, 0.63, 0.42, def.hair);
  if (def.ball) { R(0.60, 0.82, 0.74, 0.96, [0.96, 0.96, 0.98]); R(0.63, 0.85, 0.69, 0.91, [0.1, 0.1, 0.12]); }
  return c;
}

function buildLeg(d) { return (A) => { addBox(A, -0.09, -0.7, -0.1, 0.09, 0, 0.1, d.pants); addBox(A, -0.09, -0.7, -0.11, 0.09, -0.56, 0.12, d.shoe); }; }
function buildArm(d) { return (A) => { addBox(A, -0.07, -0.55, -0.09, 0.07, 0, 0.09, d.shirt); addBox(A, -0.07, -0.55, -0.09, 0.07, -0.42, 0.09, d.skin); }; }
function buildBody(d) {
  return (A) => {
    addBox(A, -0.18, 0, -0.11, 0.18, 0.55, 0.11, d.shirt);
    if (d.cape) addBox(A, -0.16, -0.02, 0.11, 0.16, 0.52, 0.17, d.capeColor || d.shirt);   // cape down the back (+z)
  };
}
function buildHead(d) {
  return (A) => {
    addBox(A, -0.2, 0, -0.2, 0.2, 0.4, 0.2, d.skin);
    addBox(A, -0.21, 0.34, -0.21, 0.21, 0.46, 0.21, d.hair);              // hair cap
    if (d.long) {                                                         // long hair: back + sides
      addBox(A, -0.215, 0.0, 0.12, 0.215, 0.40, 0.22, d.hair);
      addBox(A, -0.225, 0.06, -0.2, -0.17, 0.40, 0.21, d.hair);
      addBox(A, 0.17, 0.06, -0.2, 0.225, 0.40, 0.21, d.hair);
    }
    addBox(A, 0.04, 0.2, -0.215, 0.12, 0.28, -0.2, EYE);                  // eyes (front = -z)
    addBox(A, -0.12, 0.2, -0.215, -0.04, 0.28, -0.2, EYE);
    if (d.beard) addBox(A, -0.16, 0.0, -0.205, 0.16, 0.15, -0.14, d.hair); // beard on the lower face
  };
}
// A generic blocky soccer ball (Cristiano carries one).
function buildBall(A) {
  addBox(A, -0.14, 0, -0.14, 0.14, 0.28, 0.14, [0.96, 0.96, 0.98]);
  addBox(A, -0.06, 0.20, -0.145, 0.06, 0.27, -0.05, [0.10, 0.10, 0.12]);
  addBox(A, -0.145, 0.06, -0.06, -0.07, 0.15, 0.06, [0.10, 0.10, 0.12]);
  addBox(A, 0.07, 0.06, -0.06, 0.145, 0.15, 0.06, [0.10, 0.10, 0.12]);
}

// A little diamond sword (shop reward) held in the action hand.
function buildSword(A) {
  addBox(A, -0.022, -0.022, 0.0, 0.022, 0.022, 0.17, GRIP);
  addBox(A, -0.10, -0.055, -0.02, 0.10, 0.055, 0.02, GUARD);
  addBox(A, -0.03, -0.06, -0.60, 0.03, 0.06, -0.02, STEEL);
  addBox(A, -0.014, -0.03, -0.68, 0.014, 0.03, -0.60, STEEL);
}
// A little pickaxe (crafted at the table). The head colour shows its tier:
// wood → stone → iron → diamond. Held in the action hand while digging.
function buildPick(head) {
  return (A) => {
    addBox(A, -0.022, -0.022, -0.46, 0.022, 0.022, 0.14, [0.45, 0.30, 0.16]);   // wooden handle
    addBox(A, -0.20, -0.028, -0.55, 0.20, 0.045, -0.45, head);                    // pick head bar
    addBox(A, -0.235, -0.018, -0.535, -0.18, 0.035, -0.47, head);                 // left tip
    addBox(A, 0.18, -0.018, -0.535, 0.235, 0.035, -0.47, head);                   // right tip
  };
}
// A little axe (crafted at the table) — a handle with a blade on one side.
function buildAxe(head) {
  return (A) => {
    addBox(A, -0.022, -0.022, -0.46, 0.022, 0.022, 0.14, [0.45, 0.30, 0.16]);   // handle
    addBox(A, 0.02, -0.06, -0.55, 0.16, 0.12, -0.43, head);                       // axe head block
    addBox(A, 0.13, -0.10, -0.57, 0.21, 0.15, -0.41, head);                       // blade edge
  };
}
// A little shovel (crafted at the table) — a handle with a flat scoop blade.
function buildShovel(head) {
  return (A) => {
    addBox(A, -0.022, -0.022, -0.40, 0.022, 0.022, 0.14, [0.45, 0.30, 0.16]);   // handle
    addBox(A, -0.085, -0.05, -0.58, 0.085, 0.05, -0.40, head);                    // scoop blade
  };
}
// Forged armor (crafted at the table): a chestplate over the torso + a helmet
// cap over the head. Colour = tier (iron grey, diamond cyan). Drawn over the
// body/head parts so it moves with the kid.
function buildChest(col) {
  return (A) => {
    addBox(A, -0.205, 0.02, -0.135, 0.205, 0.5, 0.135, col);          // chestplate shell
    addBox(A, -0.225, 0.36, -0.13, -0.15, 0.52, 0.13, col);           // left shoulder
    addBox(A, 0.15, 0.36, -0.13, 0.225, 0.52, 0.13, col);             // right shoulder
  };
}
function buildHelmet(col) {
  return (A) => {
    addBox(A, -0.225, 0.27, -0.225, 0.225, 0.46, 0.225, col);         // cap above the eyes
    addBox(A, -0.225, 0.12, 0.16, 0.225, 0.30, 0.225, col);           // back of the head
  };
}
// A little golden crown (shop reward) that sits on top of the head.
function buildCrown(A) {
  addBox(A, -0.24, 0, -0.24, 0.24, 0.12, -0.18, GOLD);
  addBox(A, -0.24, 0, 0.18, 0.24, 0.12, 0.24, GOLD);
  addBox(A, -0.24, 0, -0.24, -0.18, 0.12, 0.24, GOLD);
  addBox(A, 0.18, 0, -0.24, 0.24, 0.12, 0.24, GOLD);
  addBox(A, -0.24, 0.12, -0.24, -0.16, 0.22, -0.16, GOLD);
  addBox(A, 0.16, 0.12, -0.24, 0.24, 0.22, -0.16, GOLD);
  addBox(A, -0.24, 0.12, 0.16, -0.16, 0.22, 0.24, GOLD);
  addBox(A, 0.16, 0.12, 0.16, 0.24, 0.22, 0.24, GOLD);
  addBox(A, -0.04, 0.12, -0.24, 0.04, 0.27, -0.16, GOLD);
  addBox(A, -0.035, 0.04, -0.245, 0.035, 0.10, -0.225, GEM);
}

export class Character {
  constructor(gl) {
    this.gl = gl;
    this.def = CHARACTERS[0];
    this.legM = this.armM = this.bodyM = this.headM = null;
    this._buildParts();
    this.crown = mesh(gl, buildCrown); this.wearCrown = false;
    this.sword = mesh(gl, buildSword); this.holdSword = false;
    const TIER_COL = { wood: [0.55, 0.38, 0.20], stone: [0.56, 0.57, 0.62], iron: [0.86, 0.87, 0.92], diamond: [0.36, 0.86, 0.82] };
    const toolSet = (build) => ({ wood: mesh(gl, build(TIER_COL.wood)), stone: mesh(gl, build(TIER_COL.stone)), iron: mesh(gl, build(TIER_COL.iron)), diamond: mesh(gl, build(TIER_COL.diamond)) });
    this.picks = toolSet(buildPick);
    this.axes = toolSet(buildAxe);
    this.shovels = toolSet(buildShovel);
    this.holdPick = false;          // false, or a tier name ('wood'|'stone'|'iron'|'diamond')
    this.holdAxe = false;
    this.holdShovel = false;
    const IRON_A = [0.78, 0.79, 0.84], DIAMOND_A = [0.40, 0.85, 0.82];
    this.armorChest = [null, mesh(gl, buildChest(IRON_A)), mesh(gl, buildChest(DIAMOND_A))];
    this.armorHelm = [null, mesh(gl, buildHelmet(IRON_A)), mesh(gl, buildHelmet(DIAMOND_A))];
    this.armor = 0;                 // 0 = none, 1 = iron, 2 = diamond
    this.ball = mesh(gl, buildBall);
    this.parts = [
      { mount: [-0.1, 0.7, 0], dir: 1, swing: true, leg: true },
      { mount: [0.1, 0.7, 0], dir: -1, swing: true, leg: true },
      { mount: [-0.26, 1.2, 0], dir: -1, swing: true, armp: true },
      { mount: [0.26, 1.2, 0], dir: 1, swing: true, action: true, armp: true },
      { mount: [0, 0.7, 0], dir: 0, swing: false, body: true },
      { mount: [0, 1.25, 0], dir: 0, swing: false, head: true },
    ];
    this._assignParts();
    this._P = mat4.create(); this._T = mat4.create(); this._R = mat4.create();
    this._L = mat4.create(); this._M = mat4.create();
    this._T2 = mat4.create(); this._M2 = mat4.create();
  }

  _buildParts() {
    if (this.legM) { this.legM.dispose(); this.armM.dispose(); this.bodyM.dispose(); this.headM.dispose(); }
    this.legM = mesh(this.gl, buildLeg(this.def));
    this.armM = mesh(this.gl, buildArm(this.def));
    this.bodyM = mesh(this.gl, buildBody(this.def));
    this.headM = mesh(this.gl, buildHead(this.def));
  }
  _assignParts() {
    this.parts[0].m = this.legM; this.parts[1].m = this.legM;
    this.parts[2].m = this.armM; this.parts[3].m = this.armM;
    this.parts[4].m = this.bodyM; this.parts[5].m = this.headM;
  }
  setCharacter(def) { this.def = def || CHARACTERS[0]; this._buildParts(); this._assignParts(); }

  draw(prog, x, y, z, yaw, phase, amt, act, seated, lying) {
    const gl = this.gl;
    mat4.model(this._P, x, y + (lying ? 0.42 : 0), z, yaw, 1, 1, 1);
    if (lying) {
      // Tip the whole body flat onto its back so he's resting on the pillow.
      mat4.rotateX(this._R, Math.PI / 2);
      mat4.multiply(this._P, this._P, this._R);
    } else if (act > 0) {
      mat4.rotateX(this._R, -0.32 * Math.sin(act * Math.PI));
      mat4.multiply(this._P, this._P, this._R);
    }
    const chop = act > 0 ? -1.8 * Math.sin(act * Math.PI) : 0;
    for (const p of this.parts) {
      let swing = p.swing ? Math.sin(phase) * 0.5 * amt * p.dir : 0;
      if (p.action && act > 0) swing = chop;
      if (lying) swing = p.armp ? -0.25 : 0;   // arms slightly out, legs straight — relaxed
      else if (seated) {
        if (p.leg) swing = 1.3;
        else if (p.armp && !(p.action && act > 0)) swing = -0.45;
      }
      mat4.translate(this._T, p.mount[0], p.mount[1], p.mount[2]);
      mat4.rotateX(this._R, swing);
      mat4.multiply(this._L, this._T, this._R);
      mat4.multiply(this._M, this._P, this._L);
      gl.uniformMatrix4fv(prog.u.uModel, false, this._M);
      p.m.draw(prog);
      if (this.armor > 0 && p.body && this.armorChest[this.armor]) this.armorChest[this.armor].draw(prog);
      if (this.armor > 0 && p.head && this.armorHelm[this.armor]) this.armorHelm[this.armor].draw(prog);
      const heldTool = this.holdPick ? this.picks[this.holdPick]
        : this.holdAxe ? this.axes[this.holdAxe]
        : this.holdShovel ? this.shovels[this.holdShovel]
        : this.holdSword ? this.sword : null;
      if (p.action && heldTool) {
        mat4.translate(this._T2, 0, -0.46, -0.02);
        mat4.multiply(this._M2, this._M, this._T2);
        gl.uniformMatrix4fv(prog.u.uModel, false, this._M2);
        heldTool.draw(prog);
      }
    }
    if (this.def.ball && !seated) {        // a soccer ball resting beside you
      mat4.translate(this._T2, 0.46, 0, -0.14);
      mat4.multiply(this._M2, this._P, this._T2);
      gl.uniformMatrix4fv(prog.u.uModel, false, this._M2);
      this.ball.draw(prog);
    }
    if (this.wearCrown) {
      mat4.translate(this._T, 0, 1.66, 0);
      mat4.multiply(this._M, this._P, this._T);
      gl.uniformMatrix4fv(prog.u.uModel, false, this._M);
      this.crown.draw(prog);
    }
  }
}
