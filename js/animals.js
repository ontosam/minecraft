// Friendly blocky animals: built from little boxes, wander gently, and can be
// petted (happy hop + hearts) — a petted animal follows the player as a pet.

import { GLMesh, getUV, TILE } from './gfx.js';
import { mat4 } from './math.js';
import { SX, SZ } from './world.js';

const SHADE = { top: 1.0, bottom: 0.55, pz: 0.85, nz: 0.70, px: 0.80, nx: 0.65 };

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

function legs(A, hx, hy, hz, dx, dz, color) {
  addBox(A, dx, hy, dz, hx, hy, hz, color);
  addBox(A, -dx, hy, dz, hx, hy, hz, color);
  addBox(A, dx, hy, -dz, hx, hy, hz, color);
  addBox(A, -dx, hy, -dz, hx, hy, hz, color);
}

const SPECIES = {
  pig(A) {
    addBox(A, 0, 0.42, 0, 0.28, 0.22, 0.42, [0.96, 0.62, 0.72]);
    addBox(A, 0, 0.46, -0.5, 0.22, 0.20, 0.16, [0.97, 0.66, 0.76]);
    addBox(A, 0, 0.40, -0.68, 0.10, 0.08, 0.05, [0.82, 0.44, 0.52]);
    addBox(A, 0.12, 0.66, -0.46, 0.06, 0.06, 0.03, [0.97, 0.66, 0.76]);
    addBox(A, -0.12, 0.66, -0.46, 0.06, 0.06, 0.03, [0.97, 0.66, 0.76]);
    legs(A, 0.08, 0.14, 0.08, 0.16, 0.26, [0.85, 0.5, 0.58]);
  },
  sheep(A) {
    addBox(A, 0, 0.50, 0, 0.32, 0.28, 0.42, [0.95, 0.95, 0.93]);
    addBox(A, 0, 0.52, -0.5, 0.18, 0.17, 0.16, [0.86, 0.81, 0.76]);
    addBox(A, 0.2, 0.56, -0.46, 0.04, 0.04, 0.06, [0.86, 0.81, 0.76]);
    addBox(A, -0.2, 0.56, -0.46, 0.04, 0.04, 0.06, [0.86, 0.81, 0.76]);
    legs(A, 0.07, 0.14, 0.07, 0.18, 0.24, [0.32, 0.30, 0.32]);
  },
  cow(A) {
    addBox(A, 0, 0.50, 0, 0.32, 0.26, 0.46, [0.96, 0.96, 0.97]);
    addBox(A, 0, 0.52, -0.56, 0.20, 0.20, 0.18, [0.5, 0.33, 0.2]);
    addBox(A, 0, 0.46, -0.74, 0.14, 0.10, 0.05, [0.9, 0.8, 0.78]);
    addBox(A, 0.14, 0.74, -0.5, 0.04, 0.06, 0.04, [0.95, 0.95, 0.9]);
    addBox(A, -0.14, 0.74, -0.5, 0.04, 0.06, 0.04, [0.95, 0.95, 0.9]);
    legs(A, 0.08, 0.16, 0.08, 0.2, 0.3, [0.5, 0.33, 0.2]);
  },
  chick(A) {
    addBox(A, 0, 0.30, 0, 0.16, 0.16, 0.20, [0.98, 0.92, 0.5]);
    addBox(A, 0, 0.46, -0.16, 0.13, 0.13, 0.12, [0.98, 0.92, 0.5]);
    addBox(A, 0, 0.44, -0.30, 0.05, 0.04, 0.05, [0.95, 0.6, 0.15]);
    addBox(A, 0.17, 0.30, 0, 0.03, 0.12, 0.14, [0.95, 0.88, 0.45]);
    addBox(A, -0.17, 0.30, 0, 0.03, 0.12, 0.14, [0.95, 0.88, 0.45]);
    addBox(A, 0.07, 0.09, 0, 0.03, 0.09, 0.03, [0.95, 0.6, 0.15]);
    addBox(A, -0.07, 0.09, 0, 0.03, 0.09, 0.03, [0.95, 0.6, 0.15]);
    addBox(A, 0, 0.40, 0.2, 0.05, 0.10, 0.06, [0.95, 0.88, 0.45]);
  },
  cat(A) {
    addBox(A, 0, 0.32, 0.05, 0.16, 0.15, 0.34, [0.95, 0.62, 0.28]);
    addBox(A, 0, 0.42, -0.34, 0.17, 0.16, 0.15, [0.95, 0.62, 0.28]);
    addBox(A, 0.11, 0.60, -0.34, 0.05, 0.07, 0.04, [0.9, 0.55, 0.22]);
    addBox(A, -0.11, 0.60, -0.34, 0.05, 0.07, 0.04, [0.9, 0.55, 0.22]);
    addBox(A, 0, 0.36, -0.5, 0.08, 0.06, 0.05, [0.98, 0.95, 0.9]);
    addBox(A, 0, 0.52, 0.42, 0.05, 0.05, 0.16, [0.95, 0.62, 0.28]);
    legs(A, 0.06, 0.12, 0.06, 0.10, 0.20, [0.9, 0.55, 0.22]);
  },
  horse(A) {
    const body = [0.52, 0.36, 0.22], dark = [0.30, 0.19, 0.10], mane = [0.22, 0.14, 0.07];
    addBox(A, 0, 0.68, 0.04, 0.26, 0.22, 0.50, body);      // body
    addBox(A, 0, 0.92, -0.42, 0.13, 0.22, 0.15, body);     // neck
    addBox(A, 0, 1.06, -0.58, 0.12, 0.13, 0.20, body);     // head
    addBox(A, 0, 1.00, -0.74, 0.09, 0.09, 0.08, dark);     // snout
    addBox(A, 0.08, 1.22, -0.52, 0.04, 0.07, 0.03, body);  // ears
    addBox(A, -0.08, 1.22, -0.52, 0.04, 0.07, 0.03, body);
    addBox(A, 0, 1.06, -0.40, 0.05, 0.13, 0.10, mane);     // mane
    addBox(A, 0, 1.18, -0.50, 0.05, 0.07, 0.06, mane);
    addBox(A, 0, 0.74, 0.54, 0.05, 0.20, 0.06, mane);      // tail
    legs(A, 0.07, 0.30, 0.08, 0.18, 0.34, dark);           // four long legs
  },
  ant(A) {
    const dark = [0.16, 0.12, 0.10], dk2 = [0.24, 0.17, 0.13];
    addBox(A, 0, 0.18, -0.24, 0.11, 0.10, 0.11, dk2);    // head
    addBox(A, 0, 0.18, -0.02, 0.12, 0.10, 0.12, dark);   // thorax
    addBox(A, 0, 0.18, 0.26, 0.15, 0.13, 0.18, dark);    // abdomen
    addBox(A, 0.06, 0.32, -0.32, 0.02, 0.06, 0.02, dark);  // antenna R
    addBox(A, -0.06, 0.32, -0.32, 0.02, 0.06, 0.02, dark); // antenna L
    for (const dz of [-0.10, 0.04, 0.16]) {              // six little legs
      addBox(A, 0.15, 0.07, dz, 0.04, 0.07, 0.03, dark);
      addBox(A, -0.15, 0.07, dz, 0.04, 0.07, 0.03, dark);
    }
  },
};

const KINDS = ['pig', 'sheep', 'cow', 'chick', 'pig', 'cat'];

function makeMesh(gl, species) {
  const A = { pos: [], uv: [], col: [], light: [], idx: [] };
  SPECIES[species](A);
  const mesh = new GLMesh(gl);
  mesh.setAttrib('aPos', new Float32Array(A.pos), 3);
  mesh.setAttrib('aUV', new Float32Array(A.uv), 2);
  mesh.setAttrib('aColor', new Float32Array(A.col), 3);
  mesh.setAttrib('aLight', new Float32Array(A.light), 1);
  mesh.setIndex(new Uint16Array(A.idx));
  return mesh;
}

class Animal {
  constructor(species, mesh, x, y, z) {
    this.species = species;
    this.mesh = mesh;
    this.pos = [x, y, z];
    this.yaw = Math.random() * Math.PI * 2;
    this.targetYaw = this.yaw;
    this.timer = 1 + Math.random() * 3;
    this.walking = true;
    this.speed = species === 'chick' ? 1.1 : 1.5;
    this.t = Math.random() * 10;
    this.hop = 0;
    this.follower = false;
  }
}

export class Animals {
  constructor(gl, world, kinds) {
    this.gl = gl;
    this.world = world;
    this.kinds = kinds || KINDS;   // which species this group spawns
    this.meshes = {};
    for (const k of Object.keys(SPECIES)) this.meshes[k] = makeMesh(gl, k);
    this.list = [];
    this._m = mat4.create();
  }

  groundY(x, z) { return this.world.heightAt(Math.floor(x), Math.floor(z)) + 1; }

  spawn(count) {
    for (let i = 0; i < count; i++) {
      const kind = this.kinds[Math.floor(Math.random() * this.kinds.length)];
      let x, z, gy, tries = 0;
      do {
        x = 4 + Math.random() * (SX - 8);
        z = 4 + Math.random() * (SZ - 8);
        gy = this.groundY(x, z);
      } while (gy < 1 && tries++ < 20);
      this.list.push(new Animal(kind, this.meshes[kind], x, gy, z));
    }
  }

  turnToward(a, tx, tz) { a.targetYaw = Math.atan2(-(tx - a.pos[0]), -(tz - a.pos[2])); }

  update(dt, player) {
    for (const a of this.list) {
      if (a.ridden) continue;     // a pony you're riding is steered by the player
      a.t += dt;
      if (a.hop > 0) a.hop = Math.max(0, a.hop - dt * 2.5);

      const pdx = player.pos[0] - a.pos[0], pdz = player.pos[2] - a.pos[2];
      const pd = Math.hypot(pdx, pdz);

      a.timer -= dt;
      if (a.follower && pd > 2.2) {
        this.turnToward(a, player.pos[0], player.pos[2]);
        a.walking = true;
      } else if (a.follower && pd < 1.6) {
        a.walking = false;
      } else if (a.timer <= 0) {
        a.timer = 1.5 + Math.random() * 3;
        a.walking = Math.random() < 0.7;
        if (a.walking) a.targetYaw = Math.random() * Math.PI * 2;
      }

      // Smoothly turn toward target heading.
      let d = a.targetYaw - a.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      a.yaw += Math.max(-3 * dt, Math.min(3 * dt, d));

      if (a.walking) {
        const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
        const nx = a.pos[0] + fx * a.speed * dt;
        const nz = a.pos[2] + fz * a.speed * dt;
        const gy = this.groundY(nx, nz);
        const inBounds = nx > 2 && nx < SX - 2 && nz > 2 && nz < SZ - 2;
        if (inBounds && gy >= 1 && Math.abs(gy - a.pos[1]) <= 1.2) {
          a.pos[0] = nx; a.pos[2] = nz; a.pos[1] += (gy - a.pos[1]) * Math.min(1, dt * 10);
        } else {
          a.targetYaw = a.yaw + (Math.random() < 0.5 ? 1 : -1) * (1 + Math.random());
        }
      }
    }
  }

  // Spawn a permanent pet (a cat) that follows the player — bought in the shop.
  spawnPet(x, z) {
    const a = new Animal('cat', this.meshes['cat'], x, this.groundY(x, z), z);
    a.follower = true; a.isPet = true;
    this.list.push(a);
    return a;
  }

  // Spawn the rideable pony (bought in the shop). It follows you when you're not
  // riding it; hop on with the 🐴 button.
  spawnPony(x, z) {
    const a = new Animal('horse', this.meshes['horse'], x, this.groundY(x, z), z);
    a.follower = true; a.isPony = true; a.speed = 2.0;
    this.list.push(a);
    return a;
  }

  // Pet the closest animal within reach. Returns its head position for hearts.
  petNearest(player) {
    let best = null, bestD = 3.2;
    for (const a of this.list) {
      const d = Math.hypot(player.pos[0] - a.pos[0], player.pos[2] - a.pos[2]);
      if (d < bestD) { bestD = d; best = a; }
    }
    if (!best) return null;
    best.hop = 1;
    best.follower = true;
    return [best.pos[0], best.pos[1] + 0.9, best.pos[2]];
  }

  draw(prog) {
    const gl = this.gl;
    for (const a of this.list) {
      const bob = (a.walking ? Math.sin(a.t * 8) * 0.03 : Math.sin(a.t * 2) * 0.015)
        + Math.sin((1 - a.hop) * Math.PI) * 0.28 * (a.hop > 0 ? 1 : 0);
      mat4.model(this._m, a.pos[0], a.pos[1] + bob, a.pos[2], a.yaw, 1, 1, 1);
      gl.uniformMatrix4fv(prog.u.uModel, false, this._m);
      a.mesh.draw(prog);
    }
  }
}
