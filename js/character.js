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
  { id: 'mama', name: 'Mama', emoji: '👩', skin: [0.98, 0.82, 0.70], shirt: [0.82, 0.40, 0.62], pants: [0.40, 0.30, 0.50], shoe: [0.55, 0.32, 0.42], hair: [0.28, 0.16, 0.10], long: true },
  { id: 'dada', name: 'Dada', emoji: '👨', skin: [0.95, 0.76, 0.62], shirt: [0.24, 0.55, 0.38], pants: [0.28, 0.28, 0.34], shoe: [0.20, 0.18, 0.20], hair: [0.22, 0.15, 0.10], beard: true },
  { id: 'cora', name: 'Cora', emoji: '👧', skin: [0.99, 0.86, 0.74], shirt: [0.96, 0.82, 0.32], pants: [0.55, 0.35, 0.65], shoe: [0.92, 0.55, 0.62], hair: [0.85, 0.68, 0.32], long: true },
  { id: 'jovi', name: 'Jovi', emoji: '🧒', skin: [0.80, 0.60, 0.45], shirt: [0.85, 0.30, 0.30], pants: [0.30, 0.30, 0.40], shoe: [0.20, 0.20, 0.25], hair: [0.12, 0.10, 0.10] },
  { id: 'cristiano', name: 'Cristiano', emoji: '⚽', skin: [0.82, 0.62, 0.46], shirt: [0.86, 0.16, 0.16], pants: [0.95, 0.95, 0.96], shoe: [0.10, 0.10, 0.12], hair: [0.15, 0.12, 0.10], ball: true },
  { id: 'steve', name: 'Steve', emoji: '⛏️', skin: [0.78, 0.60, 0.46], shirt: [0.18, 0.66, 0.66], pants: [0.30, 0.32, 0.62], shoe: [0.40, 0.40, 0.45], hair: [0.30, 0.20, 0.12], beard: true },
  { id: 'hero', name: 'Super Hero', emoji: '🦸', skin: [0.97, 0.80, 0.67], shirt: [0.20, 0.42, 0.85], pants: [0.20, 0.25, 0.60], shoe: [0.75, 0.62, 0.20], hair: [0.20, 0.15, 0.10], cape: true, capeColor: [0.88, 0.18, 0.20] },
];
export const charById = (id) => CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];

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

  draw(prog, x, y, z, yaw, phase, amt, act, seated) {
    const gl = this.gl;
    mat4.model(this._P, x, y, z, yaw, 1, 1, 1);
    if (act > 0) {
      mat4.rotateX(this._R, -0.32 * Math.sin(act * Math.PI));
      mat4.multiply(this._P, this._P, this._R);
    }
    const chop = act > 0 ? -1.8 * Math.sin(act * Math.PI) : 0;
    for (const p of this.parts) {
      let swing = p.swing ? Math.sin(phase) * 0.5 * amt * p.dir : 0;
      if (p.action && act > 0) swing = chop;
      if (seated) {
        if (p.leg) swing = 1.3;
        else if (p.armp && !(p.action && act > 0)) swing = -0.45;
      }
      mat4.translate(this._T, p.mount[0], p.mount[1], p.mount[2]);
      mat4.rotateX(this._R, swing);
      mat4.multiply(this._L, this._T, this._R);
      mat4.multiply(this._M, this._P, this._L);
      gl.uniformMatrix4fv(prog.u.uModel, false, this._M);
      p.m.draw(prog);
      if (p.action && this.holdSword) {
        mat4.translate(this._T2, 0, -0.46, -0.02);
        mat4.multiply(this._M2, this._M, this._T2);
        gl.uniformMatrix4fv(prog.u.uModel, false, this._M2);
        this.sword.draw(prog);
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
