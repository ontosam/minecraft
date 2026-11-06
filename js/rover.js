// The Space Rover: a little moon buggy Ezra buys in the 💎 shop and drives
// across Space World's wide moon surface. He hops on with the 🛸 button and
// taps it to pick a speed (🐢 → 🚗 → 🚀). Built as a small box mesh drawn with
// the world shader (same pattern as secretworld.js), positioned at the player's
// feet each frame; the kid is drawn sitting on top.

import { GLMesh, getUV, TILE } from './gfx.js';
import { mat4 } from './math.js';

const SHADE = { top: 1.0, bottom: 0.6, pz: 0.9, nz: 0.74, px: 0.84, nx: 0.7 };

// Append a coloured box (cx,cy,cz center; hx,hy,hz half-sizes) to accumulator A.
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

const BODY = [0.62, 0.66, 0.78], DARK = [0.16, 0.16, 0.2], TIRE = [0.12, 0.12, 0.14];
const GLASS = [0.45, 0.85, 0.95], PLASMA = [0.55, 0.85, 1.0], ACCENT = [0.95, 0.55, 0.15];

export class Rover {
  constructor(gl) {
    this.gl = gl;
    this._m = mat4.create();
    // A chunky open moon-buggy. Built centered on x/z with wheels resting near y=0
    // so it sits flush on the ground when drawn at the player's feet.
    this.mesh = meshFrom(gl, (A) => {
      // Four fat tires at the corners.
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        addBox(A, sx * 0.5, 0.24, sz * 0.62, 0.16, 0.24, 0.16, TIRE, false);
        addBox(A, sx * 0.5, 0.24, sz * 0.62, 0.18, 0.10, 0.18, DARK, false);   // hub
      }
      // Chassis / deck.
      addBox(A, 0, 0.46, 0, 0.5, 0.1, 0.74, BODY, false);
      addBox(A, 0, 0.4, 0, 0.42, 0.06, 0.64, DARK, false);                    // under-shadow
      // Seat back (the kid sits in front of it).
      addBox(A, 0, 0.74, 0.42, 0.34, 0.22, 0.1, BODY, false);
      // Front cowl + a glowing headlight bar.
      addBox(A, 0, 0.6, -0.66, 0.34, 0.14, 0.1, DARK, false);
      addBox(A, 0, 0.6, -0.74, 0.26, 0.07, 0.04, PLASMA, true);               // headlights (glow)
      // Side rails / fenders.
      addBox(A, -0.5, 0.58, 0, 0.06, 0.07, 0.6, ACCENT, false);
      addBox(A, 0.5, 0.58, 0, 0.06, 0.07, 0.6, ACCENT, false);
      // A little antenna with a glowing tip behind the seat.
      addBox(A, 0.26, 1.0, 0.46, 0.03, 0.22, 0.03, DARK, false);
      addBox(A, 0.26, 1.24, 0.46, 0.06, 0.06, 0.06, PLASMA, true);
    });
  }

  // Draw the rover at (x,y,z) feet position, facing yaw. A gentle bob/lean while
  // moving gives it a fun moon-buggy wobble.
  draw(prog, x, y, z, yaw, moveAmt, t) {
    const bob = moveAmt > 0.1 ? Math.sin(t * 14) * 0.04 * moveAmt : 0;
    mat4.model(this._m, x, y + bob, z, yaw, 1, 1, 1);
    this.gl.uniformMatrix4fv(prog.u.uModel, false, this._m);
    this.mesh.draw(prog);
  }
}
