// Friendly "protect your house" creepers. They wander in from a distance toward
// the blocks YOU placed, give a gentle "uh-oh" wobble, and slowly nibble a block
// now and then — but they never touch or harm the character, and any nibbled
// block is always rebuilt (after a moment, or instantly when you defend). Tap a
// creeper to make it *poof* harmlessly. Paced gently and ramps with stars.

import { GLMesh, getUV, TILE } from './gfx.js';
import { mat4 } from './math.js';
import { SX, SY, SZ, B } from './world.js';

const SHADE = { top: 1.0, bottom: 0.55, pz: 0.85, nz: 0.70, px: 0.80, nx: 0.65 };

// Cute creeper palette: a friendly green, soft dark face, rosy cheeks.
const GREEN = [0.46, 0.74, 0.40], DGREEN = [0.34, 0.58, 0.30];
const FOOT = [0.40, 0.64, 0.34], FACE = [0.14, 0.15, 0.17], CHEEK = [0.96, 0.62, 0.62];

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

// Classic creeper silhouette (tall, thin body; four stubby feet; cube head) but
// with a soft, friendly face instead of the scary frown. Front faces -z.
function buildCreeper(A) {
  // Four little feet.
  addBox(A, 0.12, 0.13, -0.14, 0.11, 0.13, 0.11, FOOT);
  addBox(A, -0.12, 0.13, -0.14, 0.11, 0.13, 0.11, FOOT);
  addBox(A, 0.12, 0.13, 0.16, 0.11, 0.13, 0.11, FOOT);
  addBox(A, -0.12, 0.13, 0.16, 0.11, 0.13, 0.11, FOOT);
  // Tall, thin body with a couple of darker patches (the mottled look).
  addBox(A, 0, 0.64, 0, 0.18, 0.38, 0.11, GREEN);
  addBox(A, 0.08, 0.78, -0.112, 0.07, 0.12, 0.005, DGREEN);
  addBox(A, -0.07, 0.48, -0.112, 0.06, 0.10, 0.005, DGREEN);
  addBox(A, 0.10, 0.40, 0.112, 0.06, 0.10, 0.005, DGREEN);
  // Head.
  addBox(A, 0, 1.26, 0, 0.24, 0.24, 0.24, GREEN);
  addBox(A, -0.12, 1.40, -0.242, 0.10, 0.07, 0.004, DGREEN);
  // Soft face: two big friendly eyes, rosy cheeks, a small calm mouth.
  addBox(A, 0.10, 1.30, -0.245, 0.055, 0.065, 0.02, FACE);
  addBox(A, -0.10, 1.30, -0.245, 0.055, 0.065, 0.02, FACE);
  addBox(A, 0.115, 1.305, -0.247, 0.018, 0.022, 0.01, [0.9, 0.95, 1.0]); // eye glints
  addBox(A, -0.085, 1.305, -0.247, 0.018, 0.022, 0.01, [0.9, 0.95, 1.0]);
  addBox(A, 0.16, 1.17, -0.244, 0.035, 0.025, 0.01, CHEEK);
  addBox(A, -0.16, 1.17, -0.244, 0.035, 0.025, 0.01, CHEEK);
  addBox(A, 0, 1.13, -0.245, 0.05, 0.022, 0.01, FACE); // small calm mouth
}

function makeMesh(gl) {
  const A = { pos: [], uv: [], col: [], light: [], idx: [] };
  buildCreeper(A);
  const mesh = new GLMesh(gl);
  mesh.setAttrib('aPos', new Float32Array(A.pos), 3);
  mesh.setAttrib('aUV', new Float32Array(A.uv), 2);
  mesh.setAttrib('aColor', new Float32Array(A.col), 3);
  mesh.setAttrib('aLight', new Float32Array(A.light), 1);
  mesh.setIndex(new Uint16Array(A.idx));
  return mesh;
}

// Pacing constants — deliberately slow and gentle.
const SEEK_SPEED = 1.05;       // slower than the animals
const ARRIVE = 1.35;           // how close before it starts nibbling
const NIBBLE_TIME = 5.0;       // seconds of wobbling before a block is chipped
const REBUILD_DELAY = 6.0;     // a chipped block comes back on its own after this
const TARGET_RANGE = 30;       // how far it will look for one of your blocks
const SPAWN_RING = [11, 17];   // it strolls in from this far away
const PICK_RADIUS = 0.95;      // tap forgiveness when bonking a creeper

class Creeper {
  constructor(mesh, x, y, z) {
    this.mesh = mesh;
    this.pos = [x, y, z];
    this.yaw = Math.random() * Math.PI * 2;
    this.targetYaw = this.yaw;
    this.state = 'seek';     // 'seek' | 'nibble' | 'poof'
    this.target = null;      // [x,y,z] of the block being approached
    this.nibble = 0;         // counts up while nibbling
    this.retarget = 0;       // cooldown before looking for a block again
    this.wanderTimer = 1 + Math.random() * 2;
    this.t = Math.random() * 10;
    this.scale = 1;          // shrinks to 0 during a poof
  }
}

export class Creepers {
  constructor(gl, world) {
    this.gl = gl;
    this.world = world;
    this.mesh = makeMesh(gl);
    this.list = [];
    this.rebuilds = [];      // { x, y, z, id, t } — blocks waiting to pop back
    this.spawnTimer = 12;    // first one takes a little while
    this.onEvent = null;     // (type, worldPos) => void   types: 'uhoh' | 'chip'
    this._m = mat4.create();
  }

  groundY(x, z) { return this.world.heightAt(Math.floor(x), Math.floor(z)) + 1; }
  key(x, y, z) { return this.world.idx(x, y, z); }

  // Unpack a packed voxel index back into [x, y, z].
  unkey(i) {
    const y = Math.floor(i / (SX * SZ));
    const rem = i - y * SX * SZ;
    return [rem % SX, y, Math.floor(rem / SX)];
  }

  emit(type, pos) { if (this.onEvent) this.onEvent(type, pos); }

  // --- Spawning, paced by how much has been built and by stars earned ---
  maxCount(stars) { return 1 + Math.min(2, Math.floor(stars / 4)); }
  spawnInterval(stars) { return Math.max(18, 40 - stars * 1.6); }

  trySpawn(player, stars) {
    // Nothing to protect yet? Then no creepers — keep a fresh world calm.
    if (this.world.placed.size < 3) return;
    if (this.list.length >= this.maxCount(stars)) return;
    for (let tries = 0; tries < 24; tries++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = SPAWN_RING[0] + Math.random() * (SPAWN_RING[1] - SPAWN_RING[0]);
      const x = player.pos[0] + Math.cos(ang) * dist;
      const z = player.pos[2] + Math.sin(ang) * dist;
      if (x < 3 || x > SX - 3 || z < 3 || z > SZ - 3) continue;
      const gy = this.groundY(x, z);
      if (gy < 1) continue;
      this.list.push(new Creeper(this.mesh, x, gy, z));
      return;
    }
  }

  // Find the nearest still-standing player block within range.
  findTarget(cx, cz) {
    let best = null, bestD = TARGET_RANGE * TARGET_RANGE;
    for (const i of this.world.placed) {
      const [x, y, z] = this.unkey(i);
      if (this.world.get(x, y, z) === B.AIR) continue;
      const dx = (x + 0.5) - cx, dz = (z + 0.5) - cz;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = [x, y, z]; }
    }
    return best;
  }

  turnToward(a, tx, tz) { a.targetYaw = Math.atan2(-(tx - a.pos[0]), -(tz - a.pos[2])); }

  chip(a) {
    const [x, y, z] = a.target;
    const id = this.world.get(x, y, z);
    if (id !== B.AIR) {
      this.world.set(x, y, z, B.AIR);
      this.world.placed.delete(this.key(x, y, z));
      this.rebuilds.push({ x, y, z, id, t: REBUILD_DELAY });
      this.emit('chip', [x + 0.5, y + 0.5, z + 0.5]);
    }
    a.target = null;
    a.state = 'seek';
    a.retarget = 1.2 + Math.random();
  }

  // Pop any chipped blocks back into place once their timer elapses (or if the
  // spot is no longer empty / no longer wanted, just drop it).
  processRebuilds(dt, all) {
    for (let k = this.rebuilds.length - 1; k >= 0; k--) {
      const r = this.rebuilds[k];
      r.t -= dt;
      if (all || r.t <= 0) {
        if (this.world.get(r.x, r.y, r.z) === B.AIR) {
          this.world.set(r.x, r.y, r.z, r.id);
          this.world.placed.add(this.key(r.x, r.y, r.z));
        }
        this.rebuilds.splice(k, 1);
      }
    }
  }

  update(dt, player, stars) {
    this.processRebuilds(dt, false);

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) { this.spawnTimer = this.spawnInterval(stars || 0); this.trySpawn(player, stars || 0); }

    const nibbleTime = Math.max(3.2, NIBBLE_TIME - (stars || 0) * 0.12);

    for (let k = this.list.length - 1; k >= 0; k--) {
      const a = this.list[k];
      a.t += dt;

      if (a.state === 'poof') {
        a.scale -= dt * 3.2;
        if (a.scale <= 0) this.list.splice(k, 1);
        continue;
      }

      // (Re)acquire a target block to head for.
      if (!a.target || this.world.get(a.target[0], a.target[1], a.target[2]) === B.AIR) {
        a.retarget -= dt;
        if (a.retarget <= 0) { a.target = this.findTarget(a.pos[0], a.pos[2]); a.retarget = 0.8; }
      }

      if (a.state === 'nibble') {
        a.nibble += dt;
        if (a.nibble >= nibbleTime) this.chip(a);
        // Keep facing the block while nibbling.
        if (a.target) this.turnToward(a, a.target[0] + 0.5, a.target[2] + 0.5);
      } else if (a.target) {
        // Seek: walk toward the block.
        this.turnToward(a, a.target[0] + 0.5, a.target[2] + 0.5);
        const dx = (a.target[0] + 0.5) - a.pos[0], dz = (a.target[2] + 0.5) - a.pos[2];
        if (Math.hypot(dx, dz) <= ARRIVE) {
          a.state = 'nibble'; a.nibble = 0;
          this.emit('uhoh', [a.pos[0], a.pos[1] + 1.4, a.pos[2]]);
        } else {
          this.step(a, dt);
        }
      } else {
        // No house in range — wander gently, glancing around for one.
        a.wanderTimer -= dt;
        if (a.wanderTimer <= 0) { a.wanderTimer = 2 + Math.random() * 3; a.targetYaw = Math.random() * Math.PI * 2; }
        this.step(a, dt);
      }

      // Smoothly rotate toward the heading.
      let d = a.targetYaw - a.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      a.yaw += Math.max(-3 * dt, Math.min(3 * dt, d));
    }
  }

  // Walk one step along the current heading, following the ground.
  step(a, dt) {
    const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
    const nx = a.pos[0] + fx * SEEK_SPEED * dt;
    const nz = a.pos[2] + fz * SEEK_SPEED * dt;
    const gy = this.groundY(nx, nz);
    const inBounds = nx > 2 && nx < SX - 2 && nz > 2 && nz < SZ - 2;
    if (inBounds && gy >= 1 && Math.abs(gy - a.pos[1]) <= 1.2) {
      a.pos[0] = nx; a.pos[2] = nz; a.pos[1] += (gy - a.pos[1]) * Math.min(1, dt * 10);
    } else {
      a.targetYaw = a.yaw + (Math.random() < 0.5 ? 1 : -1) * (1 + Math.random());
    }
  }

  // Tap-to-defend: ray vs. each creeper's bounding sphere; nearest wins.
  pickRay(origin, dir) {
    let best = null, bestT = Infinity;
    for (const a of this.list) {
      if (a.state === 'poof') continue;
      const cx = a.pos[0] - origin[0], cy = (a.pos[1] + 0.8) - origin[1], cz = a.pos[2] - origin[2];
      const tca = cx * dir[0] + cy * dir[1] + cz * dir[2];
      if (tca < 0) continue;
      const d2 = (cx * cx + cy * cy + cz * cz) - tca * tca;
      if (d2 > PICK_RADIUS * PICK_RADIUS) continue;
      if (tca < bestT) { bestT = tca; best = a; }
    }
    return best;
  }

  // Make a creeper poof: it shrinks away harmlessly and every chipped block is
  // rebuilt right now (the heroic save). Returns its head position for sparkles.
  defend(a) {
    a.state = 'poof';
    a.target = null;
    this.processRebuilds(0, true); // rebuild everything immediately
    return [a.pos[0], a.pos[1] + 1.1, a.pos[2]];
  }

  // Debug/testing helper: force one to appear right now near the player.
  spawnNow(player) {
    const ang = Math.random() * Math.PI * 2, dist = SPAWN_RING[0];
    let x = player.pos[0] + Math.cos(ang) * dist;
    let z = player.pos[2] + Math.sin(ang) * dist;
    x = Math.max(3, Math.min(SX - 3, x)); z = Math.max(3, Math.min(SZ - 3, z));
    const gy = this.groundY(x, z);
    this.list.push(new Creeper(this.mesh, x, gy < 1 ? player.pos[1] : gy, z));
    return this.list[this.list.length - 1];
  }

  draw(prog) {
    const gl = this.gl;
    for (const a of this.list) {
      const walking = a.state === 'seek';
      let bob = walking ? Math.sin(a.t * 7) * 0.025 : Math.sin(a.t * 2) * 0.012;
      let yaw = a.yaw, sx = 1, sy = 1, sz = 1, lift = 0;
      if (a.state === 'nibble') {                       // anxious "uh-oh" wiggle
        yaw += Math.sin(a.t * 13) * 0.18;
        const sq = Math.sin(a.t * 13) * 0.06;
        sx = 1 + sq; sz = 1 + sq; sy = 1 - sq;
        bob = Math.abs(Math.sin(a.t * 13)) * 0.05;
      } else if (a.state === 'poof') {                  // harmless shrink + spin
        const s = Math.max(0, a.scale);
        sx = sy = sz = s; yaw += (1 - s) * 6; lift = (1 - s) * 0.5;
      }
      mat4.model(this._m, a.pos[0], a.pos[1] + bob + lift, a.pos[2], yaw, sx, sy, sz);
      gl.uniformMatrix4fv(prog.u.uModel, false, this._m);
      a.mesh.draw(prog);
    }
  }
}
