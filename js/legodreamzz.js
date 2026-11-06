// LEGO DREAMZzz Dream Adventure crew for Lego World (Ezra's request):
//  • Mateo   — a friendly boy inventor who gives a guided, staged dream quest.
//  • Z-Blob  — his squishy little blue blob sidekick; bounces along after you.
//  • Nightmare — a gentle grumpy blob you shoo away (the "challenge" bit).
//  • Dream Bricks — glowing bricks you collect (spin + bob, grabbed on proximity).
// The adventure/stage logic lives in main.js; this module just spawns, animates,
// draws, and ray-picks the crew — mirroring astronaut.js / animals.js.

import { GLMesh, getUV, TILE } from './gfx.js';
import { mat4 } from './math.js';

const SHADE = { top: 1.0, bottom: 0.55, pz: 0.85, nz: 0.70, px: 0.80, nx: 0.65 };

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

// --- Mateo: a blocky kid inventor. Brown hair, goggles on his forehead, a teal
// hoodie with an orange tee, jeans. Reads as "the DREAMZzz hero kid". ---
const SKIN = [0.86, 0.66, 0.48], HAIR = [0.30, 0.18, 0.10];
const HOODIE = [0.20, 0.62, 0.62], TEE = [0.95, 0.55, 0.18], JEANS = [0.24, 0.34, 0.55];
const GOGGLE = [0.20, 0.22, 0.26], LENS = [0.55, 0.85, 0.95], SHOE = [0.35, 0.30, 0.28];
function buildMateo(A) {
  addBox(A, 0.10, 0.14, 0, 0.08, 0.15, 0.09, JEANS);      // legs
  addBox(A, -0.10, 0.14, 0, 0.08, 0.15, 0.09, JEANS);
  addBox(A, 0.10, 0.02, -0.02, 0.09, 0.04, 0.12, SHOE);   // shoes
  addBox(A, -0.10, 0.02, -0.02, 0.09, 0.04, 0.12, SHOE);
  addBox(A, 0, 0.52, 0, 0.20, 0.24, 0.14, HOODIE);        // hoodie torso
  addBox(A, 0, 0.44, -0.145, 0.10, 0.15, 0.02, TEE);      // orange tee peeking out
  addBox(A, 0.25, 0.52, 0, 0.06, 0.22, 0.09, HOODIE);     // arms
  addBox(A, -0.25, 0.52, 0, 0.06, 0.22, 0.09, HOODIE);
  addBox(A, 0.25, 0.28, 0, 0.065, 0.06, 0.09, SKIN);      // hands
  addBox(A, -0.25, 0.28, 0, 0.065, 0.06, 0.09, SKIN);
  addBox(A, 0, 0.92, 0, 0.17, 0.17, 0.16, SKIN);          // head
  addBox(A, 0, 1.06, 0.01, 0.185, 0.06, 0.18, HAIR);      // hair cap
  addBox(A, 0, 0.98, -0.14, 0.16, 0.045, 0.03, GOGGLE);   // goggle strap on forehead
  addBox(A, -0.08, 0.99, -0.17, 0.045, 0.04, 0.02, LENS, true);  // goggle lenses
  addBox(A, 0.08, 0.99, -0.17, 0.045, 0.04, 0.02, LENS, true);
  addBox(A, -0.06, 0.90, -0.165, 0.022, 0.03, 0.02, [0.1, 0.1, 0.12]); // eyes
  addBox(A, 0.06, 0.90, -0.165, 0.022, 0.03, 0.02, [0.1, 0.1, 0.12]);
}

// --- Z-Blob: a squishy light-blue blob with big goofy eyes and a wide grin. ---
const BLOB = [0.32, 0.70, 0.96], BLOB_D = [0.24, 0.56, 0.82], EYEW = [1, 1, 1], PUP = [0.12, 0.12, 0.16];
function buildZBlob(A) {
  addBox(A, 0, 0.20, 0, 0.28, 0.20, 0.26, BLOB);          // wide squishy bottom
  addBox(A, 0, 0.44, 0, 0.20, 0.14, 0.18, BLOB);          // rounded top
  addBox(A, 0, 0.10, 0, 0.30, 0.06, 0.28, BLOB_D);        // base shadow band
  addBox(A, -0.10, 0.46, -0.15, 0.075, 0.085, 0.05, EYEW);  // eyes (front -z)
  addBox(A, 0.10, 0.46, -0.15, 0.075, 0.085, 0.05, EYEW);
  addBox(A, -0.10, 0.45, -0.19, 0.03, 0.04, 0.02, PUP);
  addBox(A, 0.10, 0.45, -0.19, 0.03, 0.04, 0.02, PUP);
  addBox(A, 0, 0.30, -0.245, 0.09, 0.028, 0.02, [0.10, 0.30, 0.45]);  // grin
  addBox(A, -0.29, 0.24, 0, 0.04, 0.07, 0.07, BLOB_D);    // stubby arms
  addBox(A, 0.29, 0.24, 0, 0.04, 0.07, 0.07, BLOB_D);
}

// --- Nightmare: a lumpy dark-purple blob with grumpy orange eyes + little horns.
// Cartoony and grumpy, never scary (rounded, silly, poofs when you tap it). ---
const NM = [0.42, 0.24, 0.55], NM_D = [0.30, 0.16, 0.42], NM_EYE = [1.0, 0.55, 0.15], NM_HORN = [0.20, 0.12, 0.28];
function buildNightmare(A) {
  addBox(A, 0, 0.26, 0, 0.30, 0.26, 0.28, NM);            // body
  addBox(A, 0, 0.50, 0, 0.18, 0.12, 0.16, NM);            // head lump
  addBox(A, 0, 0.08, 0, 0.32, 0.06, 0.30, NM_D);          // base
  addBox(A, -0.16, 0.66, 0.08, 0.045, 0.10, 0.045, NM_HORN);  // horns
  addBox(A, 0.16, 0.66, 0.08, 0.045, 0.10, 0.045, NM_HORN);
  addBox(A, -0.10, 0.50, -0.15, 0.06, 0.045, 0.04, NM_EYE, true);  // angry glowing eyes
  addBox(A, 0.10, 0.50, -0.15, 0.06, 0.045, 0.04, NM_EYE, true);
  addBox(A, -0.10, 0.55, -0.14, 0.07, 0.02, 0.03, NM_HORN);   // angry brows
  addBox(A, 0.10, 0.55, -0.14, 0.07, 0.02, 0.03, NM_HORN);
  addBox(A, 0, 0.34, -0.28, 0.10, 0.03, 0.02, [0.15, 0.08, 0.2]);  // frown
}

// --- The Nightmare KING: a big, grander grumpy blob with a gold crown, bigger
// horns and glowing eyes — the boss you chase down (still cartoony, never scary). ---
const KING = [0.36, 0.20, 0.50], KING_D = [0.26, 0.13, 0.38], KING_EYE = [1.0, 0.42, 0.14], CROWN = [1.0, 0.84, 0.28];
function buildKing(A) {
  addBox(A, 0, 0.44, 0, 0.46, 0.42, 0.42, KING);        // big body
  addBox(A, 0, 0.10, 0, 0.50, 0.10, 0.46, KING_D);      // base
  addBox(A, 0, 0.90, 0, 0.30, 0.22, 0.26, KING);        // head lump
  addBox(A, -0.28, 1.16, 0.12, 0.07, 0.16, 0.07, [0.2, 0.1, 0.28]);   // horns
  addBox(A, 0.28, 1.16, 0.12, 0.07, 0.16, 0.07, [0.2, 0.1, 0.28]);
  addBox(A, -0.15, 0.92, -0.24, 0.10, 0.07, 0.05, KING_EYE, true);    // glowing eyes
  addBox(A, 0.15, 0.92, -0.24, 0.10, 0.07, 0.05, KING_EYE, true);
  addBox(A, -0.15, 1.01, -0.22, 0.12, 0.03, 0.04, [0.15, 0.08, 0.2]); // brows
  addBox(A, 0.15, 1.01, -0.22, 0.12, 0.03, 0.04, [0.15, 0.08, 0.2]);
  addBox(A, 0, 0.72, -0.44, 0.17, 0.04, 0.02, [0.12, 0.06, 0.18]);    // frown
  addBox(A, 0, 1.14, 0, 0.31, 0.05, 0.29, CROWN);                     // crown band
  for (const dx of [-0.22, 0, 0.22]) addBox(A, dx, 1.22, 0, 0.05, 0.07, 0.05, CROWN);   // crown points
  addBox(A, -0.48, 0.46, 0, 0.07, 0.18, 0.11, KING_D);               // arms
  addBox(A, 0.48, 0.46, 0, 0.07, 0.18, 0.11, KING_D);
}

// --- Dream Brick: a glowing gold 2-stud brick to collect (spins + bobs). ---
const GOLD = [1.0, 0.84, 0.28], GOLD_T = [1.0, 0.95, 0.6];
function buildDreamBrick(A) {
  addBox(A, 0, 0.14, 0, 0.16, 0.10, 0.16, GOLD, true);         // brick body
  addBox(A, -0.08, 0.26, -0.08, 0.05, 0.03, 0.05, GOLD_T, true);  // 4 studs
  addBox(A, 0.08, 0.26, -0.08, 0.05, 0.03, 0.05, GOLD_T, true);
  addBox(A, -0.08, 0.26, 0.08, 0.05, 0.03, 0.05, GOLD_T, true);
  addBox(A, 0.08, 0.26, 0.08, 0.05, 0.03, 0.05, GOLD_T, true);
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

const MATEO_PICK = 1.2, ZBLOB_PICK = 1.0, NM_PICK = 1.1, KING_PICK = 1.7, BRICK_GRAB = 1.7;

export class DreamCrew {
  constructor(gl, world) {
    this.gl = gl;
    this.world = world;
    this.mateoMesh = makeMesh(gl, buildMateo);
    this.zblobMesh = makeMesh(gl, buildZBlob);
    this.nmMesh = makeMesh(gl, buildNightmare);
    this.kingMesh = makeMesh(gl, buildKing);
    this.brickMesh = makeMesh(gl, buildDreamBrick);
    this.mateo = null;
    this.zblob = null;       // { pos, yaw, t, ridden }
    this.king = null;        // the Nightmare King boss { pos, yaw, t, hp, maxHp, hurtT }
    this.nightmares = [];   // { pos, yaw, t, hp }
    this.bricks = [];       // { pos, t, got }
    this.t = 0;
    this._m = mat4.create();
    this.onEvent = null;    // (type, data)
  }

  groundY(x, z) { return this.world.heightAt(Math.floor(x), Math.floor(z)) + 1; }

  spawn() {
    const sp = this.world.spawn;
    const mx = sp[0] + 3, mz = sp[2] + 2;
    this.mateo = { pos: [mx, this.groundY(mx, mz), mz], yaw: Math.PI, targetYaw: Math.PI, t: Math.random() * 6 };
    const zx = mx + 1.2, zz = mz + 0.6;
    this.zblob = { pos: [zx, this.groundY(zx, zz), zz], yaw: 0, t: 0, ridden: false };
    this.king = null;
    this.nightmares = [];
    this.bricks = [];
  }

  // The Nightmare King appears for the boss chase — starts across the plaza and
  // FLEES from you (a fun chase); tap him hp times to shoo him for good.
  spawnKing(hp, player) {
    const sp = this.world.spawn;
    const a = Math.random() * Math.PI * 2, r = 14;
    const x = sp[0] + Math.cos(a) * r, z = sp[2] + Math.sin(a) * r;
    this.king = { pos: [x, this.groundY(x, z), z], yaw: 0, t: 0, hp, maxHp: hp, hurtT: 0 };
  }
  clearKing() { this.king = null; }
  bonkKing() {
    if (!this.king) return false;
    this.king.hp -= 1; this.king.hurtT = 0.35;
    if (this.king.hp <= 0) { this.king = null; return true; }
    return false;
  }

  // Scatter n glowing Dream Bricks around the baseplate for the collect stage.
  setBricks(n) {
    this.bricks = [];
    const sp = this.world.spawn;
    let seed = 0x1234 ^ n;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.6;
      const r = 7 + rnd() * 10;
      const x = Math.round(sp[0] + Math.cos(a) * r), z = Math.round(sp[2] + Math.sin(a) * r);
      const gy = this.groundY(x, z);
      this.bricks.push({ pos: [x + 0.5, (gy < 1 ? sp[1] : gy) + 0.4, z + 0.5], t: rnd() * 6, got: false });
    }
  }
  clearBricks() { this.bricks = []; }

  // Pop n Nightmares near the player for the shoo stage.
  spawnNightmares(n, player) {
    this.nightmares = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 4;
      const x = player.pos[0] + Math.cos(a) * r, z = player.pos[2] + Math.sin(a) * r;
      this.nightmares.push({ pos: [x, this.groundY(x, z), z], yaw: 0, t: Math.random() * 6, hp: 3 });
    }
  }
  clearNightmares() { this.nightmares = []; }

  update(dt, player) {
    this.t += dt;
    const turn = (e, tx, tz, rate) => {
      e.targetYaw = Math.atan2(-(tx - e.pos[0]), -(tz - e.pos[2]));
      let d = e.targetYaw - e.yaw;
      while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      e.yaw += Math.max(-rate * dt, Math.min(rate * dt, d));
    };
    // Mateo: stands, turns to greet a nearby player.
    if (this.mateo) {
      const a = this.mateo; a.t += dt;
      const pd = Math.hypot(player.pos[0] - a.pos[0], player.pos[2] - a.pos[2]);
      if (pd < 8) turn(a, player.pos[0], player.pos[2], 3);
      else { a.targetYaw += 0; }
      const gy = this.groundY(a.pos[0], a.pos[2]); if (gy >= 1) a.pos[1] += (gy - a.pos[1]) * Math.min(1, dt * 6);
    }
    // Z-Blob: hops along behind the player like an eager puppy (unless you're
    // riding him — then main.js draws him snapped to your feet).
    if (this.zblob && !this.zblob.ridden) {
      const z = this.zblob; z.t += dt;
      const behindX = player.pos[0] - Math.sin(player.yaw) * 1.4;
      const behindZ = player.pos[2] - Math.cos(player.yaw) * 1.4;
      const dx = behindX - z.pos[0], dz = behindZ - z.pos[2];
      const dist = Math.hypot(dx, dz);
      if (dist > 0.6) {
        const spd = Math.min(dist, 3.4) * dt;
        z.pos[0] += (dx / dist) * spd; z.pos[2] += (dz / dist) * spd;
        turn(z, player.pos[0], player.pos[2], 6);
        z.moving = true;
      } else z.moving = false;
      const gy = this.groundY(z.pos[0], z.pos[2]); if (gy >= 1) z.pos[1] += (gy - z.pos[1]) * Math.min(1, dt * 8);
    }
    // Nightmares: hop toward the player (slow, harmless — you tap them to shoo).
    for (const nm of this.nightmares) {
      nm.t += dt;
      const dx = player.pos[0] - nm.pos[0], dz = player.pos[2] - nm.pos[2];
      const dist = Math.hypot(dx, dz);
      if (dist > 1.6) { const spd = 1.6 * dt; nm.pos[0] += (dx / dist) * spd; nm.pos[2] += (dz / dist) * spd; }
      turn(nm, player.pos[0], player.pos[2], 3);
      const gy = this.groundY(nm.pos[0], nm.pos[2]); if (gy >= 1) nm.pos[1] += (gy - nm.pos[1]) * Math.min(1, dt * 6);
    }
    // The Nightmare King: FLEES from the player (a fun chase). Keeps his distance,
    // scampers away when you close in, and gently drifts when you back off. He
    // stays inside a friendly radius of spawn so a 6-yr-old can always corner him.
    if (this.king) {
      const k = this.king; k.t += dt;
      if (k.hurtT > 0) k.hurtT = Math.max(0, k.hurtT - dt);
      const sp = this.world.spawn;
      const dx = player.pos[0] - k.pos[0], dz = player.pos[2] - k.pos[2];
      const dist = Math.hypot(dx, dz) || 1;
      // Flee directly away from the player when close; speed up the nearer he is.
      const flee = dist < 9 ? (dist < 3 ? 4.2 : 3.2) : 0;
      if (flee > 0) {
        let ax = -dx / dist, az = -dz / dist;
        // Curve back toward spawn so he never runs off the baseplate edge.
        const sdx = sp[0] - k.pos[0], sdz = sp[2] - k.pos[2], sd = Math.hypot(sdx, sdz) || 1;
        if (sd > 16) { ax += (sdx / sd) * 1.3; az += (sdz / sd) * 1.3; }
        const an = Math.hypot(ax, az) || 1;
        const spd = (flee + Math.sin(k.t * 3) * 0.4) * dt;
        k.pos[0] += (ax / an) * spd; k.pos[2] += (az / an) * spd;
      }
      turn(k, player.pos[0], player.pos[2], 4);
      const gy = this.groundY(k.pos[0], k.pos[2]); if (gy >= 1) k.pos[1] += (gy - k.pos[1]) * Math.min(1, dt * 6);
    }
    // Dream Bricks: grabbed when you get close (no aiming — kid-friendly).
    for (const b of this.bricks) {
      if (b.got) continue; b.t += dt;
      const d = Math.hypot(player.pos[0] - b.pos[0], player.pos[2] - b.pos[2]);
      if (d < BRICK_GRAB) { b.got = true; if (this.onEvent) this.onEvent('brick', b.pos.slice()); }
    }
    this.bricks = this.bricks.filter((b) => !b.got);
  }

  // Ray-pick the crew for taps. Returns { kind:'mateo'|'zblob'|'nightmare', obj }.
  pickRay(origin, dir) {
    const test = (pos, yoff, r) => {
      const cx = pos[0] - origin[0], cy = (pos[1] + yoff) - origin[1], cz = pos[2] - origin[2];
      const tca = cx * dir[0] + cy * dir[1] + cz * dir[2];
      if (tca < 0) return Infinity;
      const d2 = (cx * cx + cy * cy + cz * cz) - tca * tca;
      return d2 > r * r ? Infinity : tca;
    };
    let best = null, bestT = Infinity;
    // The King is big — check him first with a generous radius so he's easy to tap.
    if (this.king) { const t = test(this.king.pos, 0.9, KING_PICK); if (t < bestT) { bestT = t; best = { kind: 'king', obj: this.king }; } }
    for (const nm of this.nightmares) { const t = test(nm.pos, 0.5, NM_PICK); if (t < bestT) { bestT = t; best = { kind: 'nightmare', obj: nm }; } }
    if (this.mateo) { const t = test(this.mateo.pos, 0.9, MATEO_PICK); if (t < bestT) { bestT = t; best = { kind: 'mateo', obj: this.mateo }; } }
    if (this.zblob) { const t = test(this.zblob.pos, 0.4, ZBLOB_PICK); if (t < bestT) { bestT = t; best = { kind: 'zblob', obj: this.zblob }; } }
    return best;
  }

  // Tap a nightmare: chip its hp; poof when it hits 0. Returns true if shooed.
  bonkNightmare(nm) {
    nm.hp -= 1;
    if (nm.hp <= 0) { this.nightmares = this.nightmares.filter((x) => x !== nm); return true; }
    return false;
  }

  draw(prog) {
    const gl = this.gl;
    if (this.mateo) {
      const bob = Math.sin(this.mateo.t * 2) * 0.03;
      mat4.model(this._m, this.mateo.pos[0], this.mateo.pos[1] + bob, this.mateo.pos[2], this.mateo.yaw, 1, 1, 1);
      gl.uniformMatrix4fv(prog.u.uModel, false, this._m); this.mateoMesh.draw(prog);
    }
    if (this.zblob && !this.zblob.ridden) {
      const hop = Math.abs(Math.sin(this.t * 6)) * (this.zblob.moving ? 0.18 : 0.06);
      const squish = 1 + Math.sin(this.t * 6) * 0.06;
      mat4.model(this._m, this.zblob.pos[0], this.zblob.pos[1] + hop, this.zblob.pos[2], this.zblob.yaw, 1, 1 / squish, 1);
      gl.uniformMatrix4fv(prog.u.uModel, false, this._m); this.zblobMesh.draw(prog);
    }
    if (this.king) {
      const k = this.king;
      const bob = Math.abs(Math.sin(k.t * 3.5)) * 0.16;
      // A quick squishy "ow!" flinch when tapped.
      const flinch = k.hurtT > 0 ? 1 + Math.sin(k.hurtT * 40) * 0.12 : 1;
      mat4.model(this._m, k.pos[0], k.pos[1] + bob, k.pos[2], k.yaw, flinch, 1 / flinch, flinch);
      gl.uniformMatrix4fv(prog.u.uModel, false, this._m); this.kingMesh.draw(prog);
    }
    for (const nm of this.nightmares) {
      const bob = Math.abs(Math.sin(nm.t * 4)) * 0.12;
      mat4.model(this._m, nm.pos[0], nm.pos[1] + bob, nm.pos[2], nm.yaw, 1, 1, 1);
      gl.uniformMatrix4fv(prog.u.uModel, false, this._m); this.nmMesh.draw(prog);
    }
    for (const b of this.bricks) {
      const bob = Math.sin(b.t * 3) * 0.12;
      mat4.model(this._m, b.pos[0], b.pos[1] + bob, b.pos[2], b.t * 1.6, 1, 1, 1);
      gl.uniformMatrix4fv(prog.u.uModel, false, this._m); this.brickMesh.draw(prog);
    }
  }

  // Draw the ridden Z-Blob big under the seated kid (main.js calls this from its
  // mount-draw pass, like the pony/rover). A springy squish sells the bounce.
  drawRiddenBlob(prog, x, y, z, yaw, moving) {
    const s = 1.55;
    const squish = 1 + Math.sin(this.t * 8) * (moving ? 0.12 : 0.05);
    mat4.model(this._m, x, y, z, yaw, s, (s / squish), s);
    this.gl.uniformMatrix4fv(prog.u.uModel, false, this._m);
    this.zblobMesh.draw(prog);
  }
}
