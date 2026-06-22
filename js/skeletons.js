// Night-time skeletons: rarer than zombies/spiders, tougher to defeat, and more
// rewarding (extra 💎). They shuffle toward you, bonk at melee range, and — the
// new twist — draw a bow and loose a slow arrow from a short distance for half a
// heart. Still cartoony and gentle: flying or climbing up dodges them, and a
// Diamond Sword makes short work of them. Built like the other humanoid mobs.

import { GLMesh, getUV, TILE } from './gfx.js';
import { mat4 } from './math.js';
import { SX, SZ } from './world.js';

const SHADE = { top: 1.0, bottom: 0.55, pz: 0.85, nz: 0.70, px: 0.80, nx: 0.65 };
const BONE = [0.90, 0.89, 0.82], BONE_D = [0.74, 0.73, 0.66], DARK = [0.10, 0.10, 0.12], WOOD = [0.45, 0.30, 0.15];

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

function buildSkeleton(A) {
  addBox(A, 0.08, 0.22, 0, 0.055, 0.22, 0.06, BONE);    // thin legs
  addBox(A, -0.08, 0.22, 0, 0.055, 0.22, 0.06, BONE);
  addBox(A, 0, 0.66, 0, 0.15, 0.26, 0.09, BONE_D);      // ribcage
  addBox(A, 0.24, 0.78, -0.10, 0.05, 0.06, 0.18, BONE); // right arm forward (holds the bow)
  addBox(A, -0.23, 0.70, 0, 0.05, 0.20, 0.06, BONE);    // left arm at side
  addBox(A, 0, 1.06, 0, 0.16, 0.17, 0.16, BONE);        // skull
  addBox(A, 0.07, 1.05, -0.162, 0.045, 0.05, 0.01, DARK); // eye sockets
  addBox(A, -0.07, 1.05, -0.162, 0.045, 0.05, 0.01, DARK);
  addBox(A, 0, 0.95, -0.162, 0.05, 0.02, 0.01, DARK);   // nose
  addBox(A, 0.31, 0.78, -0.20, 0.02, 0.15, 0.02, WOOD); // a simple bow
}

function makeMesh(gl) {
  const A = { pos: [], uv: [], col: [], light: [], idx: [] };
  buildSkeleton(A);
  const mesh = new GLMesh(gl);
  mesh.setAttrib('aPos', new Float32Array(A.pos), 3);
  mesh.setAttrib('aUV', new Float32Array(A.uv), 2);
  mesh.setAttrib('aColor', new Float32Array(A.col), 3);
  mesh.setAttrib('aLight', new Float32Array(A.light), 1);
  mesh.setIndex(new Uint16Array(A.idx));
  return mesh;
}

const SPEED = 1.25;          // a bit slower — they like to keep their distance
const ATTACK_RANGE = 1.5;
const ATTACK_VRANGE = 2.0;
const ATTACK_CD = 1.1;
const SHOOT_MIN = 3.0, SHOOT_MAX = 9.0, SHOOT_VRANGE = 3.0;
const SHOOT_CD = 2.8, AIM_TIME = 0.6;
const SPAWN_RING = [10, 18];
const PICK_RADIUS = 1.0;
const HP = 4;                // tougher: four bare-hand taps (two sword hits)
const CAP = 2;               // rare — only a couple at a time

class Skeleton {
  constructor(mesh, x, y, z) {
    this.mesh = mesh;
    this.pos = [x, y, z];
    this.yaw = Math.random() * Math.PI * 2;
    this.targetYaw = this.yaw;
    this.hp = HP;
    this.atk = 0; this.shoot = 1 + Math.random() * SHOOT_CD;
    this.aimT = 0; this.aiming = false;
    this.lunge = 0; this.hurt = 0;
    this.t = Math.random() * 10;
    this.state = 'chase'; this.scale = 1;
    this.rattle = 2 + Math.random() * 5;
  }
}

export class Skeletons {
  constructor(gl, world) {
    this.gl = gl;
    this.world = world;
    this.mesh = makeMesh(gl);
    this.list = [];
    this.spawnTimer = 6;
    this.onEvent = null;     // (type, pos) => void   types: 'hit' | 'shoot' | 'rattle'
    this._m = mat4.create();
  }

  groundY(x, z) { return this.world.heightAt(Math.floor(x), Math.floor(z)) + 1; }
  emit(type, pos) { if (this.onEvent) this.onEvent(type, pos); }

  trySpawn(player) {
    if (this.list.length >= CAP) return;
    for (let tries = 0; tries < 24; tries++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = SPAWN_RING[0] + Math.random() * (SPAWN_RING[1] - SPAWN_RING[0]);
      const x = player.pos[0] + Math.cos(ang) * dist, z = player.pos[2] + Math.sin(ang) * dist;
      if (x < 3 || x > SX - 3 || z < 3 || z > SZ - 3) continue;
      const gy = this.groundY(x, z);
      if (gy < 1) continue;
      this.list.push(new Skeleton(this.mesh, x, gy, z));
      return;
    }
  }

  turnToward(a, tx, tz) { a.targetYaw = Math.atan2(-(tx - a.pos[0]), -(tz - a.pos[2])); }

  update(dt, player, active) {
    if (active) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) { this.spawnTimer = 9 + Math.random() * 6; this.trySpawn(player); }   // rarer than zombies
    }
    for (let k = this.list.length - 1; k >= 0; k--) {
      const a = this.list[k];
      a.t += dt;
      if (a.lunge > 0) a.lunge = Math.max(0, a.lunge - dt * 3);
      if (a.hurt > 0) a.hurt = Math.max(0, a.hurt - dt * 4);

      if (a.state === 'poof' || !active) {
        a.state = 'poof'; a.scale -= dt * 3.0;
        if (a.scale <= 0) this.list.splice(k, 1);
        continue;
      }

      const dx = player.pos[0] - a.pos[0], dz = player.pos[2] - a.pos[2];
      const dy = player.pos[1] - a.pos[1];
      const d = Math.hypot(dx, dz);
      this.turnToward(a, player.pos[0], player.pos[2]);

      a.atk -= dt; a.shoot -= dt; a.rattle -= dt;
      if (a.rattle <= 0) { a.rattle = 4 + Math.random() * 5; this.emit('rattle', [a.pos[0], a.pos[1] + 1.3, a.pos[2]]); }

      if (a.aiming) {                       // drawing the bow — stand and aim, then loose
        a.aimT -= dt;
        if (a.aimT <= 0) {
          a.aiming = false; a.shoot = SHOOT_CD; a.lunge = 1;
          if (d <= SHOOT_MAX + 1.5 && Math.abs(dy) <= SHOOT_VRANGE + 0.6) this.emit('shoot', [a.pos[0], a.pos[1] + 1.0, a.pos[2]]);
        }
      } else if (d <= ATTACK_RANGE && Math.abs(dy) <= ATTACK_VRANGE) {
        if (a.atk <= 0) { a.atk = ATTACK_CD; a.lunge = 1; this.emit('hit', [a.pos[0], a.pos[1] + 1.0, a.pos[2]]); }
      } else if (a.shoot <= 0 && d >= SHOOT_MIN && d <= SHOOT_MAX && Math.abs(dy) <= SHOOT_VRANGE) {
        a.aiming = true; a.aimT = AIM_TIME;   // telegraph: a moment to dodge (fly up!)
      } else {
        this.step(a, dt);
      }

      let dd = a.targetYaw - a.yaw;
      while (dd > Math.PI) dd -= Math.PI * 2;
      while (dd < -Math.PI) dd += Math.PI * 2;
      a.yaw += Math.max(-4 * dt, Math.min(4 * dt, dd));
    }
  }

  step(a, dt) {
    const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
    const nx = a.pos[0] + fx * SPEED * dt, nz = a.pos[2] + fz * SPEED * dt;
    const gy = this.groundY(nx, nz);
    const inBounds = nx > 2 && nx < SX - 2 && nz > 2 && nz < SZ - 2;
    if (inBounds && gy >= 1 && Math.abs(gy - a.pos[1]) <= 1.2) {
      a.pos[0] = nx; a.pos[2] = nz; a.pos[1] += (gy - a.pos[1]) * Math.min(1, dt * 10);
    } else {
      a.targetYaw = a.yaw + (Math.random() < 0.5 ? 1 : -1) * (1 + Math.random());
    }
  }

  pickRay(origin, dir) {
    let best = null, bestT = Infinity;
    for (const a of this.list) {
      if (a.state === 'poof') continue;
      const cx = a.pos[0] - origin[0], cy = (a.pos[1] + 0.7) - origin[1], cz = a.pos[2] - origin[2];
      const tca = cx * dir[0] + cy * dir[1] + cz * dir[2];
      if (tca < 0) continue;
      if ((cx * cx + cy * cy + cz * cz) - tca * tca > PICK_RADIUS * PICK_RADIUS) continue;
      if (tca < bestT) { bestT = tca; best = a; }
    }
    return best;
  }

  bonk(a, dmg) {
    a.hurt = 1; a.hp -= (dmg || 1);
    if (a.hp <= 0) { a.state = 'poof'; return true; }
    return false;
  }

  draw(prog) {
    const gl = this.gl;
    for (const a of this.list) {
      const shuffle = Math.sin(a.t * 6) * 0.02;
      let yaw = a.yaw, sx = 1, sy = 1, sz = 1, lift = 0;
      if (a.state === 'poof') { const s = Math.max(0, a.scale); sx = sy = sz = s; yaw += (1 - s) * 6; lift = (1 - s) * 0.5; }
      else {
        if (a.aiming) { sz = 1.05; lift = 0.02; }            // braced to shoot
        if (a.lunge > 0) { sz = 1 + Math.sin(a.lunge * Math.PI) * 0.12; }
        if (a.hurt > 0) { sx = 1 + a.hurt * 0.18; sy = 1 - a.hurt * 0.12; }
      }
      mat4.model(this._m, a.pos[0], a.pos[1] + shuffle + lift, a.pos[2], yaw, sx, sy, sz);
      gl.uniformMatrix4fv(prog.u.uModel, false, this._m);
      a.mesh.draw(prog);
    }
  }
}
