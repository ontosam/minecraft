// Night-time zombies (the "real-er challenge"). They come out when it's night,
// shuffle toward the player, and bonk a heart off when they reach you (harder
// than the gentle creepers). Tap one twice to defeat it (a harmless poof). They
// fade away at sunrise. Still non-gory and cartoony — just with real stakes.

import { GLMesh, getUV, TILE } from './gfx.js';
import { mat4 } from './math.js';
import { SX, SZ } from './world.js';

const SHADE = { top: 1.0, bottom: 0.55, pz: 0.85, nz: 0.70, px: 0.80, nx: 0.65 };
const SKIN = [0.42, 0.62, 0.40], DSKIN = [0.30, 0.46, 0.30];
const SHIRT = [0.27, 0.36, 0.52], PANTS = [0.26, 0.29, 0.36], FACE = [0.08, 0.12, 0.08];

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

// A blocky zombie with arms reaching forward (-z). Cartoony, not scary.
function buildZombie(A) {
  addBox(A, 0.10, 0.22, 0, 0.09, 0.22, 0.10, PANTS);   // legs
  addBox(A, -0.10, 0.22, 0, 0.09, 0.22, 0.10, PANTS);
  addBox(A, 0, 0.66, 0, 0.20, 0.26, 0.12, SHIRT);      // body
  addBox(A, 0.27, 0.74, -0.18, 0.07, 0.07, 0.22, SKIN); // arms reaching out front
  addBox(A, -0.27, 0.74, -0.18, 0.07, 0.07, 0.22, SKIN);
  addBox(A, 0, 1.06, 0, 0.18, 0.18, 0.18, SKIN);       // head
  addBox(A, 0, 1.16, -0.10, 0.10, 0.05, 0.10, DSKIN);  // mossy hair patch
  addBox(A, 0.08, 1.07, -0.182, 0.045, 0.05, 0.01, FACE); // eyes
  addBox(A, -0.08, 1.07, -0.182, 0.045, 0.05, 0.01, FACE);
  addBox(A, 0, 0.95, -0.182, 0.06, 0.02, 0.01, FACE);  // mouth
}

function makeMesh(gl) {
  const A = { pos: [], uv: [], col: [], light: [], idx: [] };
  buildZombie(A);
  const mesh = new GLMesh(gl);
  mesh.setAttrib('aPos', new Float32Array(A.pos), 3);
  mesh.setAttrib('aUV', new Float32Array(A.uv), 2);
  mesh.setAttrib('aColor', new Float32Array(A.col), 3);
  mesh.setAttrib('aLight', new Float32Array(A.light), 1);
  mesh.setIndex(new Uint16Array(A.idx));
  return mesh;
}

const SPEED = 1.5;          // a bit quicker than creepers — they come for you
const ATTACK_RANGE = 1.5;
const ATTACK_VRANGE = 2.0;  // must be at roughly your height to reach you (so
                            // flying or towering up is a real escape)
const ATTACK_CD = 1.1;      // seconds between bonks
const SPAWN_RING = [10, 18];
const PICK_RADIUS = 1.0;
const HP = 3;               // a bit tougher now — three bare-hand taps (or one sword hit)

class Zombie {
  constructor(mesh, x, y, z) {
    this.mesh = mesh;
    this.pos = [x, y, z];
    this.yaw = Math.random() * Math.PI * 2;
    this.targetYaw = this.yaw;
    this.hp = HP;
    this.atk = 0;            // attack cooldown
    this.lunge = 0;          // brief forward lunge animation
    this.hurt = 0;           // brief squash when bonked
    this.t = Math.random() * 10;
    this.state = 'chase';    // 'chase' | 'poof'
    this.scale = 1;
    this.groan = 1 + Math.random() * 4;
  }
}

export class Zombies {
  constructor(gl, world) {
    this.gl = gl;
    this.world = world;
    this.mesh = makeMesh(gl);
    this.list = [];
    this.spawnTimer = 2;
    this.onEvent = null;     // (type, pos) => void   types: 'hit' | 'groan' | 'poof'
    this._m = mat4.create();
  }

  groundY(x, z) { return this.world.heightAt(Math.floor(x), Math.floor(z)) + 1; }
  emit(type, pos) { if (this.onEvent) this.onEvent(type, pos); }

  trySpawn(player) {
    if (this.list.length >= 4) return;
    for (let tries = 0; tries < 24; tries++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = SPAWN_RING[0] + Math.random() * (SPAWN_RING[1] - SPAWN_RING[0]);
      const x = player.pos[0] + Math.cos(ang) * dist;
      const z = player.pos[2] + Math.sin(ang) * dist;
      if (x < 3 || x > SX - 3 || z < 3 || z > SZ - 3) continue;
      const gy = this.groundY(x, z);
      if (gy < 1) continue;
      this.list.push(new Zombie(this.mesh, x, gy, z));
      return;
    }
  }

  turnToward(a, tx, tz) { a.targetYaw = Math.atan2(-(tx - a.pos[0]), -(tz - a.pos[2])); }

  // active = is it night (and are we in their world)? When false they fade away.
  update(dt, player, active) {
    if (active) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) { this.spawnTimer = 4.5 + Math.random() * 3; this.trySpawn(player); }
    }

    for (let k = this.list.length - 1; k >= 0; k--) {
      const a = this.list[k];
      a.t += dt;
      if (a.lunge > 0) a.lunge = Math.max(0, a.lunge - dt * 3);
      if (a.hurt > 0) a.hurt = Math.max(0, a.hurt - dt * 4);

      if (a.state === 'poof' || !active) {
        a.state = 'poof';
        a.scale -= dt * 3.0;
        if (a.scale <= 0) this.list.splice(k, 1);
        continue;
      }

      const dx = player.pos[0] - a.pos[0], dz = player.pos[2] - a.pos[2];
      const dy = player.pos[1] - a.pos[1];
      const d = Math.hypot(dx, dz);
      this.turnToward(a, player.pos[0], player.pos[2]);

      a.atk -= dt;
      a.groan -= dt;
      if (a.groan <= 0) { a.groan = 4 + Math.random() * 5; this.emit('groan', [a.pos[0], a.pos[1] + 1.3, a.pos[2]]); }

      // Only bonk if it's actually next to you *and* near your height — a zombie
      // can't reach up to hit you when you've flown or climbed away.
      if (d <= ATTACK_RANGE && Math.abs(dy) <= ATTACK_VRANGE) {
        if (a.atk <= 0) { a.atk = ATTACK_CD; a.lunge = 1; this.emit('hit', [a.pos[0], a.pos[1] + 1, a.pos[2]]); }
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

  // Tap-to-bonk: ray vs. each zombie's bounding sphere; nearest wins.
  pickRay(origin, dir) {
    let best = null, bestT = Infinity;
    for (const a of this.list) {
      if (a.state === 'poof') continue;
      const cx = a.pos[0] - origin[0], cy = (a.pos[1] + 0.7) - origin[1], cz = a.pos[2] - origin[2];
      const tca = cx * dir[0] + cy * dir[1] + cz * dir[2];
      if (tca < 0) continue;
      const d2 = (cx * cx + cy * cy + cz * cz) - tca * tca;
      if (d2 > PICK_RADIUS * PICK_RADIUS) continue;
      if (tca < bestT) { bestT = tca; best = a; }
    }
    return best;
  }

  // Bonk a zombie (dmg = how hard, e.g. the sword hits harder). Returns true if
  // this defeated it (for a star/poof).
  bonk(a, dmg) {
    a.hurt = 1;
    a.hp -= (dmg || 1);
    if (a.hp <= 0) { a.state = 'poof'; return true; }
    return false;
  }

  draw(prog) {
    const gl = this.gl;
    for (const a of this.list) {
      let bob = Math.sin(a.t * 6) * 0.03;
      let yaw = a.yaw, sx = 1, sy = 1, sz = 1, lift = 0;
      if (a.state === 'poof') {
        const s = Math.max(0, a.scale);
        sx = sy = sz = s; yaw += (1 - s) * 6; lift = (1 - s) * 0.5;
      } else {
        if (a.lunge > 0) { const l = Math.sin(a.lunge * Math.PI); lift = l * 0.08; sz = 1 + l * 0.12; }
        if (a.hurt > 0) { const h = a.hurt; sx = 1 + h * 0.15; sy = 1 - h * 0.12; sz = 1 + h * 0.15; }
      }
      mat4.model(this._m, a.pos[0], a.pos[1] + bob + lift, a.pos[2], yaw, sx, sy, sz);
      gl.uniformMatrix4fv(prog.u.uModel, false, this._m);
      a.mesh.draw(prog);
    }
  }
}
