// Ezra's character: a friendly blocky kid, built from boxes, with arms and
// legs that swing while walking. Drawn with the world shader (per-part model
// matrices) so it shares the same lighting/fog as everything else.

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

const SKIN = [0.97, 0.80, 0.67], SHIRT = [0.30, 0.62, 0.88], PANTS = [0.33, 0.36, 0.55];
const SHOE = [0.25, 0.22, 0.24], HAIR = [0.34, 0.22, 0.13], EYE = [0.16, 0.13, 0.12];
const GOLD = [0.98, 0.82, 0.20], GEM = [0.88, 0.20, 0.32];

// A little golden crown (shop reward) that sits on top of the head. Built with
// its base centred on the local origin so it can be parked on the head mount.
function buildCrown(A) {
  // A square band ring around the head.
  addBox(A, -0.24, 0, -0.24, 0.24, 0.12, -0.18, GOLD);   // front
  addBox(A, -0.24, 0, 0.18, 0.24, 0.12, 0.24, GOLD);     // back
  addBox(A, -0.24, 0, -0.24, -0.18, 0.12, 0.24, GOLD);   // left
  addBox(A, 0.18, 0, -0.24, 0.24, 0.12, 0.24, GOLD);     // right
  // Five points on top (four corners + a taller one at the front).
  addBox(A, -0.24, 0.12, -0.24, -0.16, 0.22, -0.16, GOLD);
  addBox(A, 0.16, 0.12, -0.24, 0.24, 0.22, -0.16, GOLD);
  addBox(A, -0.24, 0.12, 0.16, -0.16, 0.22, 0.24, GOLD);
  addBox(A, 0.16, 0.12, 0.16, 0.24, 0.22, 0.24, GOLD);
  addBox(A, -0.04, 0.12, -0.24, 0.04, 0.27, -0.16, GOLD);
  addBox(A, -0.035, 0.04, -0.245, 0.035, 0.10, -0.225, GEM); // a red jewel up front
}

export class Character {
  constructor(gl) {
    this.gl = gl;
    // Each part is built with its pivot (rotation point) at the local origin.
    this.leg = mesh(gl, (A) => { addBox(A, -0.09, -0.7, -0.1, 0.09, 0, 0.1, PANTS); addBox(A, -0.09, -0.7, -0.11, 0.09, -0.56, 0.12, SHOE); });
    this.arm = mesh(gl, (A) => { addBox(A, -0.07, -0.55, -0.09, 0.07, 0, 0.09, SHIRT); addBox(A, -0.07, -0.55, -0.09, 0.07, -0.42, 0.09, SKIN); });
    this.body = mesh(gl, (A) => addBox(A, -0.18, 0, -0.11, 0.18, 0.55, 0.11, SHIRT));
    this.head = mesh(gl, (A) => {
      addBox(A, -0.2, 0, -0.2, 0.2, 0.4, 0.2, SKIN);
      addBox(A, -0.21, 0.34, -0.21, 0.21, 0.46, 0.21, HAIR);          // hair cap
      addBox(A, 0.04, 0.2, -0.215, 0.12, 0.28, -0.2, EYE);            // eyes (front = -z)
      addBox(A, -0.12, 0.2, -0.215, -0.04, 0.28, -0.2, EYE);
    });
    this.crown = mesh(gl, buildCrown);
    this.wearCrown = false;        // toggled when the Golden Crown is bought
    this.parts = [
      { m: this.leg, mount: [-0.1, 0.7, 0], dir: 1, swing: true },
      { m: this.leg, mount: [0.1, 0.7, 0], dir: -1, swing: true },
      { m: this.arm, mount: [-0.26, 1.2, 0], dir: -1, swing: true },
      { m: this.arm, mount: [0.26, 1.2, 0], dir: 1, swing: true, action: true },
      { m: this.body, mount: [0, 0.7, 0], dir: 0, swing: false },
      { m: this.head, mount: [0, 1.25, 0], dir: 0, swing: false },
    ];
    this._P = mat4.create(); this._T = mat4.create(); this._R = mat4.create();
    this._L = mat4.create(); this._M = mat4.create();
  }

  draw(prog, x, y, z, yaw, phase, amt, act) {
    const gl = this.gl;
    mat4.model(this._P, x, y, z, yaw, 1, 1, 1);
    if (act > 0) { // lean the whole body forward so the action reads from behind
      mat4.rotateX(this._R, -0.32 * Math.sin(act * Math.PI));
      mat4.multiply(this._P, this._P, this._R);
    }
    const chop = act > 0 ? -1.8 * Math.sin(act * Math.PI) : 0; // forward arm swing
    for (const p of this.parts) {
      let swing = p.swing ? Math.sin(phase) * 0.5 * amt * p.dir : 0;
      if (p.action && act > 0) swing = chop;
      mat4.translate(this._T, p.mount[0], p.mount[1], p.mount[2]);
      mat4.rotateX(this._R, swing);
      mat4.multiply(this._L, this._T, this._R);
      mat4.multiply(this._M, this._P, this._L);
      gl.uniformMatrix4fv(prog.u.uModel, false, this._M);
      p.m.draw(prog);
    }
    if (this.wearCrown) { // perched on top of the head (rides the body's lean)
      mat4.translate(this._T, 0, 1.66, 0);
      mat4.multiply(this._M, this._P, this._T);
      gl.uniformMatrix4fv(prog.u.uModel, false, this._M);
      this.crown.draw(prog);
    }
  }
}
