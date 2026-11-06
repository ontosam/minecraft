// Friendly villagers: calm townsfolk who stand near home and hand out little
// quests ("catch 3 fish", "mine 2 diamonds"). Tap one to talk. They turn to
// face you when you're near, bob gently, and never move far — easy to find.
// Quest logic lives in main.js; this module just spawns/draws them + picks.

import { GLMesh, getUV, TILE } from './gfx.js';
import { mat4 } from './math.js';
import { SX, SZ } from './world.js';

const SHADE = { top: 1.0, bottom: 0.55, pz: 0.85, nz: 0.70, px: 0.80, nx: 0.65 };
const ROBE = [0.46, 0.55, 0.42], TRIM = [0.30, 0.25, 0.18];
const SKIN = [0.85, 0.66, 0.50], NOSE = [0.80, 0.60, 0.45];
const BROW = [0.32, 0.22, 0.13], EYE = [0.16, 0.13, 0.12];
// A second, friendlier robe colour so the two villagers look a little different.
const ROBE2 = [0.62, 0.45, 0.55], TRIM2 = [0.36, 0.26, 0.32];

function addBox(A, cx, cy, cz, hx, hy, hz, color) {
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
      A.light.push(f.s);
    }
    A.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

function buildVillager(robe, trim) {
  return (A) => {
    addBox(A, 0, 0.50, 0, 0.20, 0.42, 0.15, robe);        // long robe body
    addBox(A, 0, 0.12, 0, 0.21, 0.10, 0.16, trim);        // robe hem
    addBox(A, 0.22, 0.58, 0, 0.05, 0.24, 0.08, robe);     // arms at the sides
    addBox(A, -0.22, 0.58, 0, 0.05, 0.24, 0.08, robe);
    addBox(A, 0.22, 0.32, 0, 0.045, 0.06, 0.07, SKIN);    // hands
    addBox(A, -0.22, 0.32, 0, 0.045, 0.06, 0.07, SKIN);
    addBox(A, 0, 1.06, 0, 0.16, 0.17, 0.16, SKIN);        // head
    addBox(A, 0, 1.20, -0.02, 0.165, 0.05, 0.155, BROW);  // brow/hair band
    addBox(A, 0, 1.02, -0.18, 0.045, 0.07, 0.06, NOSE);   // big friendly nose (front -z)
    addBox(A, 0.08, 1.08, -0.165, 0.03, 0.04, 0.01, EYE); // eyes
    addBox(A, -0.08, 1.08, -0.165, 0.03, 0.04, 0.01, EYE);
  };
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

const PICK_RADIUS = 1.1;

class Villager {
  constructor(mesh, x, y, z) {
    this.mesh = mesh;
    this.pos = [x, y, z];
    this.yaw = Math.random() * Math.PI * 2;
    this.targetYaw = this.yaw;
    this.t = Math.random() * 10;
    this.timer = 2 + Math.random() * 3;
    this.quest = null;        // set by main.js: { metric, target, base, reward, icon, label }
  }
}

export class Villagers {
  constructor(gl, world) {
    this.gl = gl;
    this.world = world;
    this.meshes = [makeMesh(gl, buildVillager(ROBE, TRIM)), makeMesh(gl, buildVillager(ROBE2, TRIM2))];
    this.list = [];
    this._m = mat4.create();
  }

  groundY(x, z) { return this.world.heightAt(Math.floor(x), Math.floor(z)) + 1; }

  // Spawn a couple of villagers in a little gathering near the home spawn.
  spawn(count) {
    const spawn = this.world.spawn;
    const n = count || 2;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      let x = spawn[0] + Math.cos(ang) * 3.5, z = spawn[2] + Math.sin(ang) * 3.5;
      x = Math.max(3, Math.min(SX - 3, x)); z = Math.max(3, Math.min(SZ - 3, z));
      const gy = this.groundY(x, z);
      const v = new Villager(this.meshes[i % this.meshes.length], x, gy < 1 ? spawn[1] : gy, z);
      this.list.push(v);
    }
  }

  update(dt, player) {
    for (const a of this.list) {
      a.t += dt;
      const pdx = player.pos[0] - a.pos[0], pdz = player.pos[2] - a.pos[2];
      const pd = Math.hypot(pdx, pdz);
      if (pd < 6) {                       // turn to face a nearby player (friendly)
        a.targetYaw = Math.atan2(-pdx, -pdz);
      } else {
        a.timer -= dt;
        if (a.timer <= 0) { a.timer = 2 + Math.random() * 4; a.targetYaw = Math.random() * Math.PI * 2; }
      }
      let d = a.targetYaw - a.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      a.yaw += Math.max(-3 * dt, Math.min(3 * dt, d));
      // keep them sitting on the ground if terrain around them changed
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
      const bob = Math.sin(a.t * 2) * 0.02;
      mat4.model(this._m, a.pos[0], a.pos[1] + bob, a.pos[2], a.yaw, 1, 1, 1);
      gl.uniformMatrix4fv(prog.u.uModel, false, this._m);
      a.mesh.draw(prog);
    }
  }
}
