// Friendly Nether creatures: a big puffy GHAST that floats and coos, and a warm
// glowy BLAZE ringed by spinning rods. In real Minecraft these shoot fire — here
// they only drift around gently and are happy to be petted. Nothing ever harms
// the character. Built from little boxes and drawn with the world shader, like
// the animals.

import { GLMesh, getUV, TILE } from './gfx.js';
import { mat4 } from './math.js';

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
      A.light.push(glow ? 1.0 : f.s);   // glow parts ignore shading (always bright)
    }
    A.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

const GHOST = [0.93, 0.93, 0.96], GHOST_D = [0.82, 0.82, 0.88], TENT = [0.80, 0.80, 0.86];
const FACE = [0.16, 0.16, 0.2];
const EMBER = [0.98, 0.82, 0.26], EMBER2 = [0.96, 0.52, 0.14], CORE = [0.32, 0.24, 0.18];

const SPECIES = {
  // Big, puffy, friendly ghast with a calm face and nine dangling tentacles.
  ghast(A) {
    addBox(A, 0, 0, 0, 0.6, 0.6, 0.6, GHOST);
    // soft darker patches so the white body reads as 3D
    addBox(A, 0.3, 0.28, -0.605, 0.16, 0.14, 0.005, GHOST_D);
    addBox(A, -0.34, -0.1, -0.605, 0.12, 0.12, 0.005, GHOST_D);
    // calm sleepy face (front = -z): two eyes + a small mouth
    addBox(A, 0.22, 0.06, -0.61, 0.09, 0.05, 0.02, FACE);
    addBox(A, -0.22, 0.06, -0.61, 0.09, 0.05, 0.02, FACE);
    addBox(A, 0, -0.18, -0.61, 0.10, 0.04, 0.02, FACE);
    // nine tentacles hanging underneath (3x3), slightly varied lengths
    const xs = [-0.36, 0, 0.36], zs = [-0.36, 0, 0.36];
    let k = 0;
    for (const tx of xs) for (const tz of zs) {
      const len = 0.28 + (k % 3) * 0.10; k++;
      addBox(A, tx, -0.6 - len, tz, 0.08, len, 0.08, TENT);
    }
  },
};

// The blaze is two meshes: a calm core (faces the player) and a ring of glowing
// rods (spins). Returned separately so they can animate independently.
function buildBlazeCore(A) {
  addBox(A, 0, 0, 0, 0.26, 0.30, 0.26, CORE);
  addBox(A, 0.10, 0.06, -0.265, 0.05, 0.06, 0.02, EMBER);  // glowy eyes
  addBox(A, -0.10, 0.06, -0.265, 0.05, 0.06, 0.02, EMBER);
}
function buildBlazeRods(A) {
  // two rings of vertical rods around the core
  for (let ring = 0; ring < 2; ring++) {
    const n = 6, rad = 0.34, yc = ring === 0 ? 0.06 : -0.06;
    const off = ring === 0 ? 0 : Math.PI / 6;
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2;
      addBox(A, Math.cos(a) * rad, yc, Math.sin(a) * rad, 0.05, 0.30, 0.05, i % 2 ? EMBER : EMBER2, true);
    }
  }
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

const FLOAT = { ghast: 2.0, blaze: 1.5 };   // hover height above the ground (a
                                            // soft shadow below grounds them)
const SPEED = { ghast: 0.9, blaze: 1.2 };

class Mob {
  constructor(species, x, y, z) {
    this.species = species;
    this.pos = [x, y, z];
    this.yaw = Math.random() * Math.PI * 2;
    this.targetYaw = this.yaw;
    this.timer = 1 + Math.random() * 3;
    this.walking = true;
    this.t = Math.random() * 10;
    this.hop = 0;          // happy bob when petted
    this.met = false;      // has the player been close yet (for the goal)
  }
}

export class NetherMobs {
  constructor(gl, world) {
    this.gl = gl;
    this.world = world;
    this.ghastMesh = meshFrom(gl, SPECIES.ghast);
    this.coreMesh = meshFrom(gl, buildBlazeCore);
    this.rodMesh = meshFrom(gl, buildBlazeRods);
    this.list = [];
    this.onMeet = null;    // (species, headPos) => void  (first time player is near)
    this._m = mat4.create();
  }

  groundY(x, z) { return this.world.heightAt(Math.floor(x), Math.floor(z)) + 1; }
  bounds() { return [this.world.SX || 64, this.world.SZ || 64]; }

  spawn(species, x, z) {
    const gy = this.groundY(x, z);
    this.list.push(new Mob(species, x, gy + FLOAT[species], z));
    return this.list[this.list.length - 1];
  }

  // Scatter a few of each across the given world.
  populate(SX, SZ) {
    const spots = [[SX * 0.3, SZ * 0.35], [SX * 0.7, SZ * 0.6], [SX * 0.5, SZ * 0.75]];
    this.spawn('ghast', spots[0][0], spots[0][1]);
    this.spawn('ghast', spots[2][0], spots[2][1]);
    this.spawn('blaze', spots[1][0], spots[1][1]);
    this.spawn('blaze', SX * 0.4, SZ * 0.5);
  }

  turnToward(a, tx, tz) { a.targetYaw = Math.atan2(-(tx - a.pos[0]), -(tz - a.pos[2])); }

  update(dt, player, SX, SZ) {
    for (const a of this.list) {
      a.t += dt;
      if (a.hop > 0) a.hop = Math.max(0, a.hop - dt * 2);

      // First time the player drifts close: "met!" (drives the goals).
      const pd = Math.hypot(player.pos[0] - a.pos[0], player.pos[2] - a.pos[2]);
      if (!a.met && pd < 4.5) { a.met = true; if (this.onMeet) this.onMeet(a.species, [a.pos[0], a.pos[1] + 0.4, a.pos[2]]); }

      // Gentle wander.
      a.timer -= dt;
      if (a.timer <= 0) {
        a.timer = 2 + Math.random() * 3;
        a.walking = Math.random() < 0.75;
        if (a.walking) a.targetYaw = Math.random() * Math.PI * 2;
      }
      let d = a.targetYaw - a.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      a.yaw += Math.max(-2 * dt, Math.min(2 * dt, d));

      if (a.walking) {
        const sp = SPEED[a.species];
        const nx = a.pos[0] - Math.sin(a.yaw) * sp * dt;
        const nz = a.pos[2] - Math.cos(a.yaw) * sp * dt;
        if (nx > 2 && nx < SX - 2 && nz > 2 && nz < SZ - 2) { a.pos[0] = nx; a.pos[2] = nz; }
        else a.targetYaw = a.yaw + Math.PI * (0.5 + Math.random());
      }
      // Ease toward the hover height over whatever ground is below.
      const targetY = this.groundY(a.pos[0], a.pos[2]) + FLOAT[a.species];
      a.pos[1] += (targetY - a.pos[1]) * Math.min(1, dt * 1.5);
    }
  }

  // Pet the nearest floater within reach (happy bob + returns head pos for hearts).
  petNearest(player) {
    let best = null, bestD = 4.0;
    for (const a of this.list) {
      const d = Math.hypot(player.pos[0] - a.pos[0], player.pos[2] - a.pos[2]);
      if (d < bestD) { bestD = d; best = a; }
    }
    if (!best) return null;
    best.hop = 1;
    return [best.pos[0], best.pos[1] + 0.2, best.pos[2]];
  }

  draw(prog) {
    const gl = this.gl;
    for (const a of this.list) {
      const bob = Math.sin(a.t * 2) * 0.12 + Math.sin((1 - a.hop) * Math.PI) * 0.3 * (a.hop > 0 ? 1 : 0);
      const y = a.pos[1] + bob;
      if (a.species === 'ghast') {
        mat4.model(this._m, a.pos[0], y, a.pos[2], a.yaw, 1, 1, 1);
        gl.uniformMatrix4fv(prog.u.uModel, false, this._m);
        this.ghastMesh.draw(prog);
      } else {
        // core faces its heading; rods spin around it
        mat4.model(this._m, a.pos[0], y, a.pos[2], a.yaw, 1, 1, 1);
        gl.uniformMatrix4fv(prog.u.uModel, false, this._m);
        this.coreMesh.draw(prog);
        mat4.model(this._m, a.pos[0], y, a.pos[2], a.t * 1.6, 1, 1, 1);
        gl.uniformMatrix4fv(prog.u.uModel, false, this._m);
        this.rodMesh.draw(prog);
      }
    }
  }
}
