// The Rocket: a rideable rocket-sled for Space World. Tap 🚀 to board, tap again
// to LAUNCH (a 3-2-1 countdown — he's in charge of the blast-off!), then fly fast
// through the asteroid field. Crash into an asteroid → harmless boom + back to the
// pad to try again (handled in main). Same flight physics as the dragon.
//
// Box-mesh style like rover.js / dragonmount.js. The kid sits on top facing -z
// (forward), with the nose ahead and the engine flames trailing behind (+z).

import { GLMesh, getUV, TILE } from './gfx.js';
import { mat4 } from './math.js';

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

const WHITE = [0.92, 0.93, 0.97], RED = [0.86, 0.20, 0.22], METAL = [0.6, 0.64, 0.74];
const GLASS = [0.45, 0.85, 0.95], FIN = [0.86, 0.20, 0.22];
const FLAME1 = [1.0, 0.78, 0.25], FLAME2 = [1.0, 0.45, 0.15];

export class RocketShip {
  constructor(gl) {
    this.gl = gl;
    this._m = mat4.create();
    // Body sits centered on the player; nose at -z (forward), engines at +z.
    this.body = meshFrom(gl, (A) => {
      addBox(A, 0, 0.34, 0.05, 0.26, 0.26, 0.82, WHITE);          // fuselage
      addBox(A, 0, 0.34, 0.55, 0.27, 0.27, 0.16, RED);            // a red band
      addBox(A, 0, 0.34, -0.6, 0.2, 0.2, 0.18, RED);              // forward band
      addBox(A, 0, 0.34, -0.86, 0.13, 0.13, 0.16, RED);           // nose cone
      addBox(A, 0, 0.34, -1.02, 0.06, 0.06, 0.08, RED);           // nose tip
      addBox(A, 0, 0.54, -0.2, 0.14, 0.1, 0.18, GLASS);           // cockpit window
      addBox(A, 0, 0.12, 0.9, 0.16, 0.16, 0.12, METAL);           // engine bell
      // tail fins (back): down, left, right
      addBox(A, 0, 0.06, 0.78, 0.05, 0.2, 0.22, FIN);
      addBox(A, -0.28, 0.3, 0.78, 0.16, 0.05, 0.22, FIN);
      addBox(A, 0.28, 0.3, 0.78, 0.16, 0.05, 0.22, FIN);
    });
    // Engine flames (glowing) — a separate mesh so we can stretch/show them when
    // boosting. Built trailing out the back (+z), centered near the engine bell.
    this.flame = meshFrom(gl, (A) => {
      addBox(A, 0, 0.12, 1.15, 0.12, 0.12, 0.18, FLAME1, true);
      addBox(A, 0, 0.12, 1.4, 0.07, 0.07, 0.16, FLAME2, true);
    });
  }

  // Draw at (x,y,z) feet position, facing yaw. boost 0..1 stretches the flames.
  draw(prog, x, y, z, yaw, boost, t) {
    const gl = this.gl;
    const wob = Math.sin(t * 30) * 0.02 * (boost || 0);
    mat4.model(this._m, x, y + wob, z, yaw, 1, 1, 1);
    gl.uniformMatrix4fv(prog.u.uModel, false, this._m);
    this.body.draw(prog);
    if (boost > 0.05) {
      // flames flicker by scaling along z (length) with the boost + a wobble
      const fz = 0.6 + boost * 0.9 + Math.sin(t * 40) * 0.12;
      mat4.model(this._m, x, y + wob, z, yaw, 1, 1, fz);
      gl.uniformMatrix4fv(prog.u.uModel, false, this._m);
      this.flame.draw(prog);
    }
  }
}
