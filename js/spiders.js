// Night-time spiders: low, quick eight-leggers that skitter toward the player
// and give a small (half-heart) nibble. A bit tougher than a bare zombie to
// shoo away, but they barely hurt — built cute (big friendly eyes), not scary.
// Modelled on the zombie/creeper pattern: a list of movers + a shared mesh.

import { GLMesh, getUV, TILE } from './gfx.js';
import { mat4 } from './math.js';
import { SX, SZ } from './world.js';

const SHADE = { top: 1.0, bottom: 0.55, pz: 0.85, nz: 0.70, px: 0.80, nx: 0.65 };
const BODY = [0.22, 0.17, 0.27], LEG = [0.14, 0.11, 0.17];
const EYE = [0.96, 0.96, 0.99], PUPIL = [0.12, 0.10, 0.14];

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

function buildSpider(A) {
  addBox(A, 0, 0.26, 0.18, 0.22, 0.17, 0.22, BODY);   // round abdomen (back)
  addBox(A, 0, 0.24, -0.14, 0.15, 0.14, 0.15, BODY);  // head (front, -z)
  // Eight legs: a knee bar reaching out + a foot reaching down, both sides.
  for (const z of [-0.12, -0.02, 0.08, 0.18]) {
    for (const s of [1, -1]) {
      addBox(A, s * 0.25, 0.24, z, 0.10, 0.025, 0.03, LEG);  // knee out from body
      addBox(A, s * 0.34, 0.12, z, 0.03, 0.12, 0.03, LEG);   // foot down to ground
    }
  }
  // Big friendly eyes (white with little pupils) on the front of the head.
  addBox(A, 0.07, 0.30, -0.27, 0.055, 0.055, 0.02, EYE);
  addBox(A, -0.07, 0.30, -0.27, 0.055, 0.055, 0.02, EYE);
  addBox(A, 0.07, 0.30, -0.285, 0.025, 0.025, 0.01, PUPIL);
  addBox(A, -0.07, 0.30, -0.285, 0.025, 0.025, 0.01, PUPIL);
  addBox(A, 0.15, 0.33, -0.22, 0.03, 0.03, 0.02, EYE);   // two little side eyes
  addBox(A, -0.15, 0.33, -0.22, 0.03, 0.03, 0.02, EYE);
}

function makeMesh(gl) {
  const A = { pos: [], uv: [], col: [], light: [], idx: [] };
  buildSpider(A);
  const mesh = new GLMesh(gl);
  mesh.setAttrib('aPos', new Float32Array(A.pos), 3);
  mesh.setAttrib('aUV', new Float32Array(A.uv), 2);
  mesh.setAttrib('aColor', new Float32Array(A.col), 3);
  mesh.setAttrib('aLight', new Float32Array(A.light), 1);
  mesh.setIndex(new Uint16Array(A.idx));
  return mesh;
}

const SPEED = 2.3;          // quick skitterers
const ATTACK_RANGE = 1.4;
const ATTACK_VRANGE = 1.6;  // they're short, so flying/towering up escapes them
const ATTACK_CD = 1.0;
const SPAWN_RING = [9, 17];
const PICK_RADIUS = 1.05;
const HP = 2;               // two bare-hand taps (one sword hit)

class Spider {
  constructor(mesh, x, y, z) {
    this.mesh = mesh;
    this.pos = [x, y, z];
    this.yaw = Math.random() * Math.PI * 2;
    this.targetYaw = this.yaw;
    this.hp = HP;
    this.atk = 0;
    this.lunge = 0;
    this.hurt = 0;
    this.t = Math.random() * 10;
    this.state = 'chase';
    this.scale = 1;
    this.hiss = 2 + Math.random() * 5;
  }
}

export class Spiders {
  constructor(gl, world) {
    this.gl = gl;
    this.world = world;
    this.mesh = makeMesh(gl);
    this.list = [];
    this.spawnTimer = 4;
    this.onEvent = null;     // (type, pos) => void   types: 'hit' | 'hiss' | 'poof'
    this._m = mat4.create();
  }

  groundY(x, z) { return this.world.heightAt(Math.floor(x), Math.floor(z)) + 1; }
  emit(type, pos) { if (this.onEvent) this.onEvent(type, pos); }

  trySpawn(player) {
    if (this.list.length >= 3) return;
    for (let tries = 0; tries < 24; tries++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = SPAWN_RING[0] + Math.random() * (SPAWN_RING[1] - SPAWN_RING[0]);
      const x = player.pos[0] + Math.cos(ang) * dist;
      const z = player.pos[2] + Math.sin(ang) * dist;
      if (x < 3 || x > SX - 3 || z < 3 || z > SZ - 3) continue;
      const gy = this.groundY(x, z);
      if (gy < 1) continue;
      this.list.push(new Spider(this.mesh, x, gy, z));
      return;
    }
  }

  turnToward(a, tx, tz) { a.targetYaw = Math.atan2(-(tx - a.pos[0]), -(tz - a.pos[2])); }

  update(dt, player, active) {
    if (active) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) { this.spawnTimer = 6 + Math.random() * 4; this.trySpawn(player); }
    }
    for (let k = this.list.length - 1; k >= 0; k--) {
      const a = this.list[k];
      a.t += dt;
      if (a.lunge > 0) a.lunge = Math.max(0, a.lunge - dt * 4);
      if (a.hurt > 0) a.hurt = Math.max(0, a.hurt - dt * 4);

      if (a.state === 'poof' || !active) {
        a.state = 'poof';
        a.scale -= dt * 3.2;
        if (a.scale <= 0) this.list.splice(k, 1);
        continue;
      }

      const dx = player.pos[0] - a.pos[0], dz = player.pos[2] - a.pos[2];
      const dy = player.pos[1] - a.pos[1];
      const d = Math.hypot(dx, dz);
      this.turnToward(a, player.pos[0], player.pos[2]);

      a.atk -= dt;
      a.hiss -= dt;
      if (a.hiss <= 0) { a.hiss = 5 + Math.random() * 5; this.emit('hiss', [a.pos[0], a.pos[1] + 0.4, a.pos[2]]); }

      if (d <= ATTACK_RANGE && Math.abs(dy) <= ATTACK_VRANGE) {
        if (a.atk <= 0) { a.atk = ATTACK_CD; a.lunge = 1; this.emit('hit', [a.pos[0], a.pos[1] + 0.4, a.pos[2]]); }
      } else {
        this.step(a, dt);
      }

      let dd = a.targetYaw - a.yaw;
      while (dd > Math.PI) dd -= Math.PI * 2;
      while (dd < -Math.PI) dd += Math.PI * 2;
      a.yaw += Math.max(-6 * dt, Math.min(6 * dt, dd));
    }
  }

  step(a, dt) {
    const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
    const nx = a.pos[0] + fx * SPEED * dt;
    const nz = a.pos[2] + fz * SPEED * dt;
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
      const cx = a.pos[0] - origin[0], cy = (a.pos[1] + 0.3) - origin[1], cz = a.pos[2] - origin[2];
      const tca = cx * dir[0] + cy * dir[1] + cz * dir[2];
      if (tca < 0) continue;
      const d2 = (cx * cx + cy * cy + cz * cz) - tca * tca;
      if (d2 > PICK_RADIUS * PICK_RADIUS) continue;
      if (tca < bestT) { bestT = tca; best = a; }
    }
    return best;
  }

  bonk(a, dmg) {
    a.hurt = 1;
    a.hp -= (dmg || 1);
    if (a.hp <= 0) { a.state = 'poof'; return true; }
    return false;
  }

  draw(prog) {
    const gl = this.gl;
    for (const a of this.list) {
      const skitter = Math.sin(a.t * 14) * 0.02;
      let yaw = a.yaw, sx = 1, sy = 1, sz = 1, lift = 0;
      if (a.state === 'poof') {
        const s = Math.max(0, a.scale);
        sx = sy = sz = s; yaw += (1 - s) * 6; lift = (1 - s) * 0.4;
      } else {
        if (a.lunge > 0) { const l = Math.sin(a.lunge * Math.PI); lift = l * 0.06; sz = 1 + l * 0.1; }
        if (a.hurt > 0) { const h = a.hurt; sx = 1 + h * 0.18; sy = 1 - h * 0.12; sz = 1 + h * 0.18; }
      }
      mat4.model(this._m, a.pos[0], a.pos[1] + skitter + lift, a.pos[2], yaw, sx, sy, sz);
      gl.uniformMatrix4fv(prog.u.uModel, false, this._m);
      a.mesh.draw(prog);
    }
  }
}
