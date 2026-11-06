// The Ride-On Dragon: a friendly flying mount Ezra buys in the 💎 shop. Tap the
// 🐉 button to hop on and soar — hold Up to climb, let go to glide down gently
// (it reuses the same flight physics as the Fly button). Drawn as a little
// box-mesh dragon at the player's feet with flapping wings; the kid sits on top.
//
// Same box-mesh style as rover.js / secretworld.js. The body (head, neck, tail,
// legs) is one static mesh; each wing is its own mesh so it can flap (rotateZ).

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

// A friendly purple dragon (End-dragon vibes) with a lighter belly.
const BODY = [0.52, 0.30, 0.72], BELLY = [0.80, 0.62, 0.92], DARK = [0.18, 0.12, 0.26];
const HORN = [0.94, 0.92, 0.86], WING = [0.42, 0.22, 0.62], WEBB = [0.66, 0.40, 0.86];
const FIRE = [1.0, 0.55, 0.2];

export class DragonMount {
  constructor(gl) {
    this.gl = gl;
    this._b = mat4.create(); this._rz = mat4.create(); this._wl = mat4.create(); this._wr = mat4.create();
    // Body: torso (the saddle) forward to head, back to a tapering tail. Forward
    // is -z (the way the rider faces), so head is at -z, tail at +z.
    this.body = meshFrom(gl, (A) => {
      addBox(A, 0, 0.42, 0.15, 0.34, 0.27, 0.62, BODY);            // torso / saddle
      addBox(A, 0, 0.30, 0.15, 0.26, 0.14, 0.5, BELLY);           // belly
      // neck + head reaching up and forward
      addBox(A, 0, 0.58, -0.55, 0.18, 0.2, 0.26, BODY);            // neck
      addBox(A, 0, 0.72, -0.92, 0.22, 0.21, 0.26, BODY);          // head
      addBox(A, 0, 0.66, -1.18, 0.15, 0.13, 0.18, BODY);          // snout
      addBox(A, 0, 0.62, -1.30, 0.10, 0.05, 0.06, FIRE, true);    // a friendly little glow at the snout
      addBox(A, -0.10, 0.80, -0.92, 0.05, 0.06, 0.04, DARK);      // eyes
      addBox(A, 0.10, 0.80, -0.92, 0.05, 0.06, 0.04, DARK);
      addBox(A, -0.13, 0.96, -0.80, 0.04, 0.12, 0.04, HORN);      // horns
      addBox(A, 0.13, 0.96, -0.80, 0.04, 0.12, 0.04, HORN);
      // tail: a few tapering segments curving back
      addBox(A, 0, 0.44, 0.85, 0.16, 0.16, 0.3, BODY);
      addBox(A, 0, 0.5, 1.15, 0.11, 0.11, 0.28, BODY);
      addBox(A, 0, 0.56, 1.42, 0.07, 0.07, 0.24, BODY);
      addBox(A, 0, 0.6, 1.62, 0.12, 0.1, 0.06, WEBB);             // tail fin
      // little tucked legs
      addBox(A, -0.26, 0.16, 0.0, 0.1, 0.12, 0.14, DARK);
      addBox(A, 0.26, 0.16, 0.0, 0.1, 0.12, 0.14, DARK);
      // a small back ridge
      for (let i = 0; i < 4; i++) addBox(A, 0, 0.7 - i * 0.02, -0.2 + i * 0.28, 0.04, 0.09, 0.05, WEBB);
    });
    // Left wing: a flat membrane extending out to +x from a root near the body.
    this.wingL = meshFrom(gl, (A) => {
      addBox(A, 0.5, 0.6, 0.1, 0.5, 0.03, 0.42, WING);            // membrane
      addBox(A, 0.92, 0.6, 0.1, 0.12, 0.04, 0.5, WEBB);          // outer webbing
      addBox(A, 0.2, 0.62, 0.1, 0.06, 0.06, 0.06, DARK);         // shoulder joint
    });
    // Right wing: mirror, extending to -x.
    this.wingR = meshFrom(gl, (A) => {
      addBox(A, -0.5, 0.6, 0.1, 0.5, 0.03, 0.42, WING);
      addBox(A, -0.92, 0.6, 0.1, 0.12, 0.04, 0.5, WEBB);
      addBox(A, -0.2, 0.62, 0.1, 0.06, 0.06, 0.06, DARK);
    });
  }

  // Draw at the player's feet (x,y,z), facing yaw. Wings flap with t; they beat
  // faster while climbing/moving (drive=0..1).
  draw(prog, x, y, z, yaw, t, drive) {
    const gl = this.gl;
    mat4.model(this._b, x, y, z, yaw, 1, 1, 1);
    gl.uniformMatrix4fv(prog.u.uModel, false, this._b);
    this.body.draw(prog);
    const speed = 6 + (drive || 0) * 8;
    const a = Math.sin(t * speed) * 0.55 + 0.12;     // flap angle (up = positive)
    mat4.rotateZ(this._rz, a); mat4.multiply(this._wl, this._b, this._rz);
    gl.uniformMatrix4fv(prog.u.uModel, false, this._wl); this.wingL.draw(prog);
    mat4.rotateZ(this._rz, -a); mat4.multiply(this._wr, this._b, this._rz);
    gl.uniformMatrix4fv(prog.u.uModel, false, this._wr); this.wingR.draw(prog);
  }
}
