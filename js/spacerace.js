// Space Race: a course of glowing rings floating among the asteroids in Space
// World. Fly through them in order (with the rocket, the dragon, or plain Fly) —
// the next ring pulses gold to show where to go. Finish the loop for a 💎 reward.
// Kid-friendly: generous ring openings + forgiving proximity detection, so a
// 6-year-old just has to fly *near* each ring, not thread a needle.
//
// Box-mesh style like rover.js / dragonmount.js. Each ring is a square hoop; we
// keep three coloured hoop meshes (gold = next, cyan = upcoming, dim = passed).

import { GLMesh, getUV, TILE } from './gfx.js';
import { mat4 } from './math.js';
import { SX, SZ } from './world.js';

function addBox(A, cx, cy, cz, hx, hy, hz, color) {
  const x0 = cx - hx, x1 = cx + hx, y0 = cy - hy, y1 = cy + hy, z0 = cz - hz, z1 = cz + hz;
  const r = getUV(TILE.NEUTRAL);
  const faces = [
    [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]],
    [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
    [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]],
    [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]],
    [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]],
    [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]],
  ];
  const uvc = [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v1]];
  for (const f of faces) {
    const base = A.pos.length / 3;
    for (let i = 0; i < 4; i++) {
      A.pos.push(f[i][0], f[i][1], f[i][2]);
      A.uv.push(uvc[i][0], uvc[i][1]);
      A.col.push(color[0], color[1], color[2]);
      A.light.push(1.0);                 // glowing — rings shine in the dark void
    }
    A.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}
function hoopMesh(gl, color) {
  const A = { pos: [], uv: [], col: [], light: [], idx: [] };
  const T = 0.28, R = 1.7;               // bar thickness, half-opening (≈3.4 wide)
  addBox(A, 0, R, 0, R + T, T, T, color);     // top bar
  addBox(A, 0, -R, 0, R + T, T, T, color);    // bottom bar
  addBox(A, -R, 0, 0, T, R, T, color);        // left bar
  addBox(A, R, 0, 0, T, R, T, color);         // right bar
  const m = new GLMesh(gl);
  m.setAttrib('aPos', new Float32Array(A.pos), 3);
  m.setAttrib('aUV', new Float32Array(A.uv), 2);
  m.setAttrib('aColor', new Float32Array(A.col), 3);
  m.setAttrib('aLight', new Float32Array(A.light), 1);
  m.setIndex(new Uint16Array(A.idx));
  return m;
}

const GOLD = [1.0, 0.82, 0.18], CYAN = [0.3, 0.82, 1.0], DIM = [0.32, 0.5, 0.42];
const HIT_R = 2.8;                       // forgiving fly-through radius

export class SpaceRace {
  constructor(gl) {
    this.gl = gl;
    this._m = mat4.create();
    this.gold = hoopMesh(gl, GOLD);
    this.cyan = hoopMesh(gl, CYAN);
    this.dim = hoopMesh(gl, DIM);
    this.onPass = null; this.onFinish = null;
    this.layout();
    this.reset();
  }
  // A loop of rings around the moon centre at flyable heights, ending near spawn.
  layout() {
    const cx = SX / 2, cz = SZ / 2;
    const ring = (dx, dz, y) => ({ pos: [cx + dx, y, cz + dz] });
    this.gates = [
      ring(-20, 2, 15), ring(-10, -20, 18), ring(14, -22, 20),
      ring(22, 4, 22), ring(10, 22, 18), ring(-14, 18, 16), ring(0, 0, 15),
    ];
    // each hoop faces toward the next gate (cosmetic; detection is proximity)
    for (let i = 0; i < this.gates.length; i++) {
      const a = this.gates[i].pos, b = this.gates[(i + 1) % this.gates.length].pos;
      this.gates[i].yaw = Math.atan2(b[0] - a[0], b[2] - a[2]);
    }
  }
  reset() { this.current = 0; this.finished = false; this.time = 0; this.started = false; }

  // active = the player is flying in Space World. Counts the next ring when near.
  update(dt, player, active) {
    if (!active || this.finished) return;
    if (this.started) this.time += dt;
    const g = this.gates[this.current]; if (!g) return;
    const dx = player.pos[0] - g.pos[0], dy = player.pos[1] - g.pos[1], dz = player.pos[2] - g.pos[2];
    if (dx * dx + dy * dy + dz * dz <= HIT_R * HIT_R) {
      this.started = true;
      this.current++;
      if (this.onPass) this.onPass(this.current, this.gates.length, g.pos);
      if (this.current >= this.gates.length) { this.finished = true; if (this.onFinish) this.onFinish(this.time); }
    }
  }
  nextGate() { return (!this.finished && this.gates[this.current]) ? this.gates[this.current].pos : null; }

  draw(prog, t) {
    const gl = this.gl;
    for (let i = 0; i < this.gates.length; i++) {
      const g = this.gates[i];
      const mesh = i < this.current ? this.dim : (i === this.current ? this.gold : this.cyan);
      const s = i === this.current ? 1 + Math.sin(t * 4) * 0.1 : 1;   // the next ring pulses
      mat4.model(this._m, g.pos[0], g.pos[1], g.pos[2], g.yaw, s, s, s);
      gl.uniformMatrix4fv(prog.u.uModel, false, this._m);
      mesh.draw(prog);
    }
  }
}
