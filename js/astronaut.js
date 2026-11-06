// Captain Nova — a friendly astronaut who gives Space World a face and a job.
// She stands on the moon near the launch pad, turns to greet you, and floats a
// little (low gravity!). Tap her to get a fun space mission ("mine 3 crystals",
// "race the rings"); finish it for 💎. The mission logic lives in main.js — this
// module just spawns/draws her + the tap pick, mirroring villagers.js.

import { GLMesh, getUV, TILE } from './gfx.js';
import { mat4 } from './math.js';

const SHADE = { top: 1.0, bottom: 0.55, pz: 0.85, nz: 0.70, px: 0.80, nx: 0.65 };
// A puffy white spacesuit with a golden visor, a grey life-support pack, blue
// trim and a little red antenna light — instantly reads as "astronaut".
const SUIT = [0.92, 0.94, 0.98], SUIT_SH = [0.78, 0.80, 0.86];
const HELMET = [0.95, 0.96, 1.0], VISOR = [0.96, 0.80, 0.26];
const PACK = [0.60, 0.64, 0.72], GLOVE = [0.80, 0.82, 0.88], BOOT = [0.52, 0.55, 0.62];
const ACCENT = [0.30, 0.55, 1.0], BADGE = [1.0, 0.82, 0.25], TIP = [1.0, 0.30, 0.30];

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

function buildAstronaut(A) {
  // legs + chunky moon boots
  addBox(A, 0.11, 0.14, 0, 0.09, 0.15, 0.10, SUIT);
  addBox(A, -0.11, 0.14, 0, 0.09, 0.15, 0.10, SUIT);
  addBox(A, 0.11, 0.02, -0.02, 0.10, 0.05, 0.13, BOOT);
  addBox(A, -0.11, 0.02, -0.02, 0.10, 0.05, 0.13, BOOT);
  // puffy suit torso + a darker belt
  addBox(A, 0, 0.56, 0, 0.24, 0.30, 0.18, SUIT);
  addBox(A, 0, 0.30, 0, 0.25, 0.05, 0.19, SUIT_SH);
  // life-support backpack (+z = behind)
  addBox(A, 0, 0.58, 0.21, 0.17, 0.26, 0.10, PACK);
  // chest control panel + a gold mission badge (front -z)
  addBox(A, 0, 0.60, -0.185, 0.10, 0.08, 0.02, ACCENT);
  addBox(A, -0.05, 0.60, -0.20, 0.025, 0.025, 0.01, TIP, true);
  addBox(A, 0.04, 0.62, -0.20, 0.02, 0.02, 0.01, [0.4, 1, 0.5], true);
  addBox(A, 0.13, 0.74, -0.185, 0.045, 0.045, 0.01, BADGE);
  // arms at the sides + gloves
  addBox(A, 0.30, 0.56, 0, 0.07, 0.24, 0.10, SUIT);
  addBox(A, -0.30, 0.56, 0, 0.07, 0.24, 0.10, SUIT);
  addBox(A, 0.30, 0.28, 0, 0.075, 0.08, 0.10, GLOVE);
  addBox(A, -0.30, 0.28, 0, 0.075, 0.08, 0.10, GLOVE);
  // big round helmet + glowing golden visor (front)
  addBox(A, 0, 1.04, 0, 0.20, 0.20, 0.20, HELMET);
  addBox(A, 0, 1.05, -0.18, 0.15, 0.11, 0.05, VISOR, true);
  // antenna with a blinking red tip
  addBox(A, 0.13, 1.30, 0.02, 0.018, 0.08, 0.018, SUIT_SH);
  addBox(A, 0.13, 1.40, 0.02, 0.035, 0.035, 0.035, TIP, true);
}

function makeMesh(gl, build) {
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

const PICK_RADIUS = 1.2;

class Astronaut {
  constructor(mesh, x, y, z) {
    this.mesh = mesh;
    this.pos = [x, y, z];
    this.yaw = Math.PI;          // start facing the spawn (-z)
    this.targetYaw = this.yaw;
    this.t = Math.random() * 10;
    this.timer = 2 + Math.random() * 3;
    this.mission = null;         // set by main.js: { metric, target, base, reward, icon, label }
  }
}

export class Astronauts {
  constructor(gl, world) {
    this.gl = gl;
    this.world = world;
    this.mesh = makeMesh(gl, buildAstronaut);
    this.list = [];
    this._m = mat4.create();
  }

  groundY(x, z) { return this.world.heightAt(Math.floor(x), Math.floor(z)) + 1; }

  // One astronaut, standing a few steps from the launch-pad spawn so she's easy
  // to spot the moment you arrive (but never right on top of you).
  spawn() {
    this.list = [];
    const sp = this.world.spawn;
    const x = sp[0] + 3.5, z = sp[2] + 2.5;
    const gy = this.groundY(x, z);
    this.list.push(new Astronaut(this.mesh, x, gy < 1 ? sp[1] : gy, z));
  }

  update(dt, player) {
    for (const a of this.list) {
      a.t += dt;
      const pdx = player.pos[0] - a.pos[0], pdz = player.pos[2] - a.pos[2];
      const pd = Math.hypot(pdx, pdz);
      if (pd < 7) {                       // turn to greet a nearby player
        a.targetYaw = Math.atan2(-pdx, -pdz);
      } else {
        a.timer -= dt;
        if (a.timer <= 0) { a.timer = 2 + Math.random() * 4; a.targetYaw = Math.random() * Math.PI * 2; }
      }
      let d = a.targetYaw - a.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      a.yaw += Math.max(-3 * dt, Math.min(3 * dt, d));
      const gy = this.groundY(a.pos[0], a.pos[2]);
      if (gy >= 1) a.pos[1] += (gy - a.pos[1]) * Math.min(1, dt * 6);
    }
  }

  pickRay(origin, dir) {
    let best = null, bestT = Infinity;
    for (const a of this.list) {
      const cx = a.pos[0] - origin[0], cy = (a.pos[1] + 0.9) - origin[1], cz = a.pos[2] - origin[2];
      const tca = cx * dir[0] + cy * dir[1] + cz * dir[2];
      if (tca < 0) continue;
      const d2 = (cx * cx + cy * cy + cz * cz) - tca * tca;
      if (d2 > PICK_RADIUS * PICK_RADIUS) continue;
      if (tca < bestT) { bestT = tca; best = a; }
    }
    return best;
  }

  draw(prog) {
    const gl = this.gl;
    for (const a of this.list) {
      const bob = Math.sin(a.t * 1.6) * 0.05;   // gentle low-gravity float
      mat4.model(this._m, a.pos[0], a.pos[1] + bob, a.pos[2], a.yaw, 1, 1, 1);
      gl.uniformMatrix4fv(prog.u.uModel, false, this._m);
      a.mesh.draw(prog);
    }
  }
}
