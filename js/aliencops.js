// Friendly alien "space cops" that patrol the moon in Space World. They drift
// around peacefully — but if you drive the Space Rover at TOP speed (over the
// space speed limit!) and one is nearby, it flashes its siren and politely asks
// you to slow down (no harm, no chase-and-catch — it just eases you off the gas).
// Built as little UFO saucer meshes, same box-mesh style as secretworld.js.

import { GLMesh, getUV, TILE } from './gfx.js';
import { mat4 } from './math.js';
import { SX, SZ } from './world.js';

const SHADE = { top: 1.0, bottom: 0.6, pz: 0.9, nz: 0.74, px: 0.84, nx: 0.7 };

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
function meshFrom(gl, build) {
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

const METAL = [0.7, 0.72, 0.8], DARK = [0.16, 0.16, 0.2], DOME = [0.5, 0.92, 0.55];
const RED = [1.0, 0.25, 0.25], BLUE = [0.3, 0.55, 1.0];
const HOVER = 3.6;        // how high above the moon a cop floats
const SIREN_RANGE = 11;   // how close before it notices you speeding

export class AlienCops {
  constructor(gl, world) {
    this.gl = gl;
    this.world = world;
    this.list = [];
    this.onSiren = null;   // (pos) => void — fired when it asks you to slow down
    this.t = 0;
    this._m = mat4.create();
    // The saucer body + a dome; the flashing light is two tiny meshes we swap.
    this.body = meshFrom(gl, (A) => {
      addBox(A, 0, -0.16, 0, 0.42, 0.06, 0.42, METAL, true);   // glowing under-ring
      addBox(A, 0, 0, 0, 0.62, 0.13, 0.62, METAL, false);      // saucer disc
      addBox(A, 0, 0.04, 0, 0.5, 0.16, 0.5, DARK, false);      // rim shadow
      addBox(A, 0, 0.24, 0, 0.3, 0.18, 0.3, DOME, false);      // glass dome
      // Two friendly alien eyes peeking out the front of the dome.
      addBox(A, -0.12, 0.26, -0.28, 0.05, 0.06, 0.03, DARK, false);
      addBox(A, 0.12, 0.26, -0.28, 0.05, 0.06, 0.03, DARK, false);
      addBox(A, 0, 0.46, 0, 0.04, 0.08, 0.04, DARK, false);    // siren stalk
    });
    this.lightR = meshFrom(gl, (A) => addBox(A, 0, 0.56, 0, 0.1, 0.08, 0.1, RED, true));
    this.lightB = meshFrom(gl, (A) => addBox(A, 0, 0.56, 0, 0.1, 0.08, 0.1, BLUE, true));
  }

  populate(n = 2) {
    this.list = [];
    for (let i = 0; i < n; i++) {
      const x = 12 + Math.random() * (SX - 24);
      const z = 12 + Math.random() * (SZ - 24);
      this.list.push(this._spawn(x, z));
    }
  }
  _spawn(x, z) {
    const gy = Math.max(2, this.world.heightAt(Math.floor(x), Math.floor(z)));
    return {
      pos: [x, gy + HOVER, z], yaw: Math.random() * 6.28,
      tx: x, tz: z, retarget: 0, bob: Math.random() * 6.28,
      alert: 0, sirenCd: 0, state: 'idle',
    };
  }

  update(dt, player, roving, speedIdx) {
    this.t += dt;
    const overLimit = !!roving && speedIdx >= 3;
    for (const c of this.list) {
      c.bob += dt;
      c.sirenCd = Math.max(0, c.sirenCd - dt);
      c.alert = Math.max(0, c.alert - dt);
      const dx = player.pos[0] - c.pos[0], dz = player.pos[2] - c.pos[2];
      const dist = Math.hypot(dx, dz);
      // Speeding nearby → flash the siren and ask you to slow down.
      if (overLimit && dist < SIREN_RANGE) {
        c.alert = 1.6;
        if (c.sirenCd === 0) { c.sirenCd = 4; if (this.onSiren) this.onSiren(c.pos.slice()); }
      }
      // When alert, ease toward the player ("pulling you over"); else wander.
      let tx, tz;
      if (c.alert > 0) { tx = player.pos[0]; tz = player.pos[2]; }
      else {
        c.retarget -= dt;
        if (c.retarget <= 0) {
          c.tx = 8 + Math.random() * (SX - 16);
          c.tz = 8 + Math.random() * (SZ - 16);
          c.retarget = 4 + Math.random() * 4;
        }
        tx = c.tx; tz = c.tz;
      }
      const mx = tx - c.pos[0], mz = tz - c.pos[2], ml = Math.hypot(mx, mz);
      const spd = (c.alert > 0 ? 4.2 : 1.6) * dt;
      if (ml > 0.2) { c.pos[0] += (mx / ml) * spd; c.pos[2] += (mz / ml) * spd; c.yaw = Math.atan2(-mx, -mz); }
      // Ease the hover height to float over whatever's below.
      const gy = Math.max(2, this.world.heightAt(Math.floor(c.pos[0]), Math.floor(c.pos[2])));
      const want = gy + HOVER + Math.sin(c.bob * 1.6) * 0.25;
      c.pos[1] += (want - c.pos[1]) * Math.min(1, dt * 3);
    }
  }

  draw(prog) {
    const gl = this.gl;
    for (const c of this.list) {
      mat4.model(this._m, c.pos[0], c.pos[1], c.pos[2], c.yaw + this.t * 0.6, 1, 1, 1);
      gl.uniformMatrix4fv(prog.u.uModel, false, this._m);
      this.body.draw(prog);
      // Flashing siren light (red/blue) — fast while alert, slow idle blink.
      const fast = c.alert > 0;
      const on = Math.floor(this.t * (fast ? 8 : 2)) % 2 === 0;
      (on ? this.lightR : this.lightB).draw(prog);
    }
  }
}
