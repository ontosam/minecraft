// The friendly End Dragon — the gentle "adventure boss". She glides in a big
// circle above the End island, ringed by glowing End Crystals on obsidian
// pillars. Tap the crystals to pop them (harmless poofs); once they're all gone
// the dragon is "tamed" — tap her for a big celebration and reward. Nothing ever
// harms the player. Built from little boxes and drawn with the world shader.

import { GLMesh, getUV, TILE } from './gfx.js';
import { mat4 } from './math.js';
import { SX, SZ } from './world.js';

const SHADE = { top: 1.0, bottom: 0.62, pz: 0.9, nz: 0.74, px: 0.84, nx: 0.7 };

function addBox(A, cx, cy, cz, hx, hy, hz, color, glow) {
  const x0 = cx - hx, x1 = cx + hx, y0 = cy - hy, y1 = cy + hy, z0 = cz - hz, z1 = cz + hz;
  const r = getUV(TILE.NEUTRAL);
  const faces = [
    { s: SHADE.top, v: [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]] },
    { s: SHADE.bottom, v: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]] },
    { s: SHADE.nz, v: [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]] },
    { s: SHADE.pz, v: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]] },
    { s: SHADE.nx, v: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]] },
    { s: SHADE.px, v: [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]] },
  ];
  const uvc = [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v1]];
  for (const f of faces) {
    const base = A.pos.length / 3;
    for (let i = 0; i < 4; i++) {
      A.pos.push(f.v[i][0], f.v[i][1], f.v[i][2]);
      A.uv.push(uvc[i][0], uvc[i][1]);
      A.col.push(color[0], color[1], color[2]);
      A.light.push(glow ? 1.0 : f.s);
    }
    A.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

// Friendly, clearly-visible purple (a dark dragon vanished against the End sky).
const BODY = [0.42, 0.30, 0.56], BODY_D = [0.30, 0.20, 0.42], WING = [0.56, 0.42, 0.70];
const EYE = [0.98, 0.40, 0.85], HORN = [0.92, 0.90, 0.98];
const CRYS = [0.78, 0.30, 0.88], CRYS_CORE = [1.0, 0.85, 1.0];

// A big, kindly dragon facing -z (her nose points "forward" like the other mobs).
function buildDragon(A) {
  addBox(A, 0, 0, 0.2, 0.55, 0.5, 1.5, BODY);            // long body
  addBox(A, 0, 0.5, 1.6, 0.35, 0.35, 0.5, BODY_D);       // hips
  // neck + head out the front
  addBox(A, 0, 0.35, -1.2, 0.3, 0.3, 0.5, BODY);
  addBox(A, 0, 0.5, -1.9, 0.42, 0.42, 0.45, BODY);       // head
  addBox(A, 0, 0.38, -2.35, 0.3, 0.22, 0.3, BODY_D);     // snout
  addBox(A, 0.22, 0.62, -1.95, 0.09, 0.1, 0.06, EYE, true);  // glowing eyes
  addBox(A, -0.22, 0.62, -1.95, 0.09, 0.1, 0.06, EYE, true);
  addBox(A, 0.18, 0.92, -1.85, 0.05, 0.18, 0.05, HORN);  // little horns
  addBox(A, -0.18, 0.92, -1.85, 0.05, 0.18, 0.05, HORN);
  // tail tapering out the back
  addBox(A, 0, 0.45, 2.3, 0.22, 0.22, 0.6, BODY);
  addBox(A, 0, 0.45, 3.0, 0.12, 0.12, 0.5, BODY_D);
  // big wings swept up to the sides (a gentle glide pose)
  addBox(A, 1.35, 0.7, 0.1, 0.95, 0.06, 0.8, WING);
  addBox(A, -1.35, 0.7, 0.1, 0.95, 0.06, 0.8, WING);
  addBox(A, 2.15, 1.0, 0.1, 0.5, 0.05, 0.55, WING);      // wingtips lifted
  addBox(A, -2.15, 1.0, 0.1, 0.5, 0.05, 0.55, WING);
}

// A floating End Crystal: a glowing magenta gem with a bright inner core.
function buildCrystal(A) {
  addBox(A, 0, 0, 0, 0.34, 0.34, 0.34, CRYS, true);
  addBox(A, 0, 0, 0, 0.16, 0.46, 0.16, CRYS_CORE, true);
  addBox(A, 0, 0, 0, 0.46, 0.16, 0.16, CRYS_CORE, true);
}

function meshFrom(gl, build) {
  const A = { pos: [], uv: [], col: [], light: [], idx: [] };
  build(A);
  const mesh = new GLMesh(gl);
  mesh.setAttrib('aPos', new Float32Array(A.pos), 3);
  mesh.setAttrib('aUV', new Float32Array(A.uv), 2);
  mesh.setAttrib('aColor', new Float32Array(A.col), 3);
  mesh.setAttrib('aLight', new Float32Array(A.light), 1);
  mesh.setIndex(new Uint16Array(A.idx));
  return mesh;
}

const RADIUS = 14;

export class Dragon {
  constructor(gl, world) {
    this.gl = gl;
    this.world = world;
    this.bodyMesh = meshFrom(gl, buildDragon);
    this.crystalMesh = meshFrom(gl, buildCrystal);
    this.crystals = [];
    this.dragon = null;
    this.tamed = false;
    this.tamedDone = false;
    this.onEvent = null;   // (type, pos) => void  — 'crystal' | 'tamed'
    this.onTame = null;    // () => void  — fired once when she's petted after taming
    this._m = mat4.create();
    this.cx = SX / 2; this.cz = SZ / 2;
  }

  populate() {
    const spots = this.world.crystalSpots || [];
    for (const s of spots) this.crystals.push({ pos: [s[0] + 0.5, s[1], s[2] + 0.5], alive: true, t: Math.random() * 6 });
    const baseY = this.world.heightAt(Math.floor(this.cx), Math.floor(this.cz)) + 11;
    this.dragon = { angle: 0, t: 0, yaw: 0, pos: [this.cx + RADIUS, baseY, this.cz] };
  }

  aliveCount() { return this.crystals.reduce((n, c) => n + (c.alive ? 1 : 0), 0); }

  update(dt, player) {
    for (const c of this.crystals) c.t += dt;
    const d = this.dragon;
    if (!d) return;
    d.t += dt;
    d.angle += dt * (this.tamed ? 0.22 : 0.5);            // glides slower once tamed
    const groundY = this.world.heightAt(Math.floor(this.cx), Math.floor(this.cz));
    const fly = groundY + (this.tamed ? 5 : 11);          // descends closer once tamed
    d.pos[0] = this.cx + Math.cos(d.angle) * RADIUS;
    d.pos[2] = this.cz + Math.sin(d.angle) * RADIUS;
    d.pos[1] = fly + Math.sin(d.t * 0.8) * 0.8;
    d.yaw = Math.PI - d.angle;                            // face along the circle
  }

  // Tap-test: glowing crystals first (you must pop them), then the dragon herself.
  pickRay(origin, dir) {
    let best = null, bestT = Infinity;
    for (const c of this.crystals) {
      if (!c.alive) continue;
      const ax = c.pos[0] - origin[0], ay = c.pos[1] - origin[1], az = c.pos[2] - origin[2];
      const tca = ax * dir[0] + ay * dir[1] + az * dir[2];
      if (tca < 0) continue;
      if (ax * ax + ay * ay + az * az - tca * tca > 0.9 * 0.9) continue;
      if (tca < bestT) { bestT = tca; best = c; }
    }
    if (best) return { kind: 'crystal', c: best };
    const d = this.dragon;
    if (d) {
      const ax = d.pos[0] - origin[0], ay = (d.pos[1] + 0.4) - origin[1], az = d.pos[2] - origin[2];
      const tca = ax * dir[0] + ay * dir[1] + az * dir[2];
      if (tca >= 0 && (ax * ax + ay * ay + az * az - tca * tca) <= 2.4 * 2.4) return { kind: 'dragon' };
    }
    return null;
  }

  popCrystal(c) {
    if (!c.alive) return;
    c.alive = false;
    if (this.onEvent) this.onEvent('crystal', c.pos.slice());
    if (this.aliveCount() === 0 && !this.tamed) {
      this.tamed = true;
      if (this.onEvent) this.onEvent('tamed', this.dragon ? this.dragon.pos.slice() : c.pos.slice());
    }
  }

  // Pet the tamed dragon for the big reward (only works once she's tamed).
  tame() {
    if (!this.tamed || this.tamedDone) return false;
    this.tamedDone = true;
    if (this.onTame) this.onTame();
    return true;
  }

  draw(prog) {
    const gl = this.gl;
    for (const c of this.crystals) {
      if (!c.alive) continue;
      const y = c.pos[1] + Math.sin(c.t * 2) * 0.18;
      mat4.model(this._m, c.pos[0], y, c.pos[2], c.t * 1.5, 1, 1, 1);
      gl.uniformMatrix4fv(prog.u.uModel, false, this._m);
      this.crystalMesh.draw(prog);
    }
    const d = this.dragon;
    if (d) {
      mat4.model(this._m, d.pos[0], d.pos[1], d.pos[2], d.yaw, 1, 1, 1);
      gl.uniformMatrix4fv(prog.u.uModel, false, this._m);
      this.bodyMesh.draw(prog);
    }
  }
}
