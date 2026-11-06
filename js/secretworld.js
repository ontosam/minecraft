// The Secret World: a bright, dazzling fun park you VISIT to spend diamonds on
// rides. It's the "treat yourself" hub — you EARN 💎 by working in the other
// worlds (mining, math, build challenges, fishing) and SPLURGE here. Nothing
// here ever pays diamonds; the reward for a ride is pure fun + a ⭐ trophy.
//
// Built like the other creature/prop managers (see nethermobs.js): little box
// meshes drawn with the world shader. The headline is a real, vertically
// turning Ferris wheel; plus drifting hot-air balloons, a spinning carousel,
// friends having fun, fireworks and lights.

import { GLMesh, getUV, TILE } from './gfx.js';
import { mat4 } from './math.js';
import { Character, charById, CHARACTERS } from './character.js';
import { SX, SZ } from './world.js';

const SHADE = { top: 1.0, bottom: 0.6, pz: 0.9, nz: 0.74, px: 0.84, nx: 0.7 };

// Append a coloured box to an accumulator (pos/uv/col/light/idx).
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

function meshFrom(gl, build) {
  const A = { pos: [], uv: [], col: [], light: [], idx: [] };
  build(A);
  const m = new GLMesh(gl);
  m.setAttrib('aPos', new Float32Array(A.pos), 3);
  m.setAttrib('aUV', new Float32Array(A.uv), 2);
  m.setAttrib('aColor', new Float32Array(A.col), 3);
  m.setAttrib('aLight', new Float32Array(A.light), 1);
  m.setIndex(new Uint16Array(A.idx));
  return m;
}

// Festive palette.
const PAL = [[0.92, 0.24, 0.30], [0.98, 0.62, 0.16], [0.98, 0.84, 0.24], [0.36, 0.78, 0.36],
  [0.28, 0.56, 0.92], [0.66, 0.40, 0.86], [0.96, 0.50, 0.74]];
const WHITE = [0.96, 0.96, 0.98], DARK = [0.30, 0.26, 0.34], BROWN = [0.55, 0.36, 0.20];

const WHEEL = { N: 8, R: 5.4 };          // gondolas, radius

// --- Ride definitions (cost in 💎; reward is fun + a ⭐, never diamonds) ---
export const ATTRACTIONS = [
  { id: 'ferris', icon: '🎡', name: 'Ferris Wheel', cost: 3, metric: 'ferris', dur: 11 },
  { id: 'balloon', icon: '🎈', name: 'Balloon Ride', cost: 2, metric: 'balloon', dur: 10 },
  { id: 'carousel', icon: '🎠', name: 'Carousel', cost: 2, metric: 'carousel', dur: 9 },
];

// --- Stands: little booths you tap (or walk up to) for a menu. The Ticket booth
// is the easy way onto the rides; plus a Popcorn stand and a Gift Shop. ---
export const STANDS = [
  { id: 'tickets', icon: '🎟️', name: 'Ride Tickets', label: 'Ride Tickets!', color: [0.92, 0.24, 0.30] },
  { id: 'popcorn', icon: '🍿', name: 'Popcorn Stand', label: 'Popcorn!', color: [0.98, 0.82, 0.24] },
  { id: 'shop', icon: '🛍️', name: 'Gift Shop', label: 'Gift Shop!', color: [0.36, 0.78, 0.36] },
];

// Wheel structure (spokes + rim) built in the Y-Z plane so it spins about X
// (a real upright Ferris wheel). Gondolas are drawn separately so they stay
// level and can carry upright riders.
function buildWheel(A) {
  addBox(A, 0, 0, 0, 0.45, 0.55, 0.55, DARK);                 // hub
  for (let i = 0; i < WHEEL.N; i++) {
    const a = (i / WHEEL.N) * Math.PI * 2;
    const cy = Math.cos(a), sz = Math.sin(a);
    // spoke: a thin bar from hub out to the rim
    const A2 = { pos: A.pos, uv: A.uv, col: A.col, light: A.light, idx: A.idx };
    spokeBox(A2, cy * WHEEL.R / 2, sz * WHEEL.R / 2, a, WHEEL.R / 2, PAL[i % PAL.length]);
    // rim chunk at this spoke's tip
    addBox(A, 0, cy * WHEEL.R, sz * WHEEL.R, 0.5, 0.3, 0.3, WHITE);
    // a little light bulb on the rim (glows)
    addBox(A, 0.55, cy * WHEEL.R, sz * WHEEL.R, 0.12, 0.12, 0.12, PAL[i % PAL.length], true);
  }
}
// A spoke is a long thin box rotated in the Y-Z plane; emit it as a few segments
// so we don't need a rotation matrix per spoke (keeps it one static mesh).
function spokeBox(A, my, mz, ang, half, color) {
  const steps = 6;
  for (let s = 0; s < steps; s++) {
    const t = (s + 0.5) / steps;            // 0..1 along the spoke
    const y = Math.cos(ang) * WHEEL.R * t, z = Math.sin(ang) * WHEEL.R * t;
    addBox(A, 0, y, z, 0.16, 0.16, 0.16, color);
  }
}

// One gondola (a little open car) — drawn upright at each rim point.
function buildGondola(A) {
  addBox(A, 0, -0.05, 0, 0.42, 0.06, 0.42, WHITE);   // floor
  addBox(A, 0, 0.18, -0.4, 0.42, 0.24, 0.05, WHITE);  // back
  addBox(A, -0.4, 0.18, 0, 0.05, 0.24, 0.42, WHITE);  // sides
  addBox(A, 0.4, 0.18, 0, 0.05, 0.24, 0.42, WHITE);
  addBox(A, 0, 0.5, 0, 0.06, 0.2, 0.06, DARK);         // hanger
}
function buildLeg(A) {
  // A simple A-frame leg from the ground up to the hub height.
  addBox(A, -2.2, 0, 0, 0.22, 0.1, 0.22, DARK);
  addBox(A, 2.2, 0, 0, 0.22, 0.1, 0.22, DARK);
  const h = 7;
  for (let s = 0; s < 10; s++) {
    const t = s / 9;
    addBox(A, -2.2 * (1 - t), t * h, 0, 0.16, 0.16, 0.16, [0.42, 0.40, 0.5]);
    addBox(A, 2.2 * (1 - t), t * h, 0, 0.16, 0.16, 0.16, [0.42, 0.40, 0.5]);
  }
}

function buildBalloon(color) {
  return (A) => {
    // canopy: a rounded teardrop of stacked boxes
    const rings = [[1.0, 1.6], [1.25, 1.0], [1.3, 0.3], [1.1, -0.3], [0.7, -0.9], [0.3, -1.4]];
    for (const [r, y] of rings) addBox(A, 0, y, 0, r, 0.35, r, color);
    // vertical stripes (a couple of accent panels)
    for (const sgn of [-1, 1]) for (const [r, y] of rings) addBox(A, sgn * r, y, 0, 0.04, 0.35, r * 0.5, WHITE);
    addBox(A, 0, -1.9, 0, 0.45, 0.35, 0.45, BROWN);   // basket
    for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]])
      addBox(A, dx, -1.5, dz, 0.03, 0.4, 0.03, DARK); // ropes
  };
}

function buildCarousel(A) {
  addBox(A, 0, 0.12, 0, 2.6, 0.14, 2.6, [0.95, 0.92, 0.98]);   // platform
  addBox(A, 0, 1.8, 0, 0.18, 1.6, 0.18, DARK);                 // centre pole
  // striped conical roof (stacked shrinking boxes)
  const roof = [[2.7, 2.6], [2.1, 3.0], [1.4, 3.3], [0.7, 3.55]];
  for (let i = 0; i < roof.length; i++) addBox(A, 0, roof[i][1], 0, roof[i][0], 0.18, roof[i][0], PAL[i % PAL.length], true);
  addBox(A, 0, 3.8, 0, 0.16, 0.3, 0.16, PAL[0], true);          // finial
  // a few seat-poles with little horses (boxes)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2, r = 1.9, x = Math.cos(a) * r, z = Math.sin(a) * r;
    addBox(A, x, 1.3, z, 0.06, 1.0, 0.06, [0.85, 0.85, 0.9]);   // pole
    addBox(A, x, 0.7, z, 0.34, 0.22, 0.16, PAL[i % PAL.length]); // horse body
    addBox(A, x + (Math.cos(a) * 0.3), 0.95, z + (Math.sin(a) * 0.3), 0.12, 0.18, 0.12, PAL[i % PAL.length]); // head
  }
}

function buildKiosk(color) {
  return (A) => {
    addBox(A, 0, 0.5, 0, 0.5, 0.5, 0.5, color);          // booth
    addBox(A, 0, 1.15, 0, 0.62, 0.18, 0.62, WHITE);       // striped awning
    addBox(A, 0, 1.5, 0, 0.05, 0.22, 0.05, color, true);  // sign post light
  };
}

// A shop booth: a counter, a back wall, posts, and a bright striped awning.
function buildBooth(color) {
  return (A) => {
    addBox(A, 0, 0.45, 0, 1.1, 0.45, 0.5, WHITE);          // counter
    addBox(A, 0, 0.7, -0.45, 1.1, 0.7, 0.08, color);        // back wall
    for (const sx of [-1.0, 1.0]) addBox(A, sx, 1.0, 0.4, 0.08, 1.0, 0.08, BROWN); // front posts
    addBox(A, 0, 1.7, 0, 1.25, 0.16, 0.7, color, true);     // glowing striped awning
    for (let i = -1; i <= 1; i++) addBox(A, i * 0.7, 1.72, 0.72, 0.18, 0.14, 0.04, i % 2 ? WHITE : color, true); // scallops
  };
}

class NPC {
  constructor(id, x, z) { this.id = id; this.pos = [x, 7, z]; this.yaw = Math.random() * 6.28; this.targetYaw = this.yaw; this.walk = Math.random() * 6; this.timer = 1 + Math.random() * 3; this.moving = true; this.seat = -1; }
}

export class SecretPark {
  constructor(gl, world) {
    this.gl = gl; this.world = world;
    this.wheelMesh = meshFrom(gl, buildWheel);
    this.gondolaMesh = meshFrom(gl, buildGondola);
    this.legMesh = meshFrom(gl, buildLeg);
    this.carouselMesh = meshFrom(gl, buildCarousel);
    this.balloonMeshes = PAL.slice(0, 5).map((c) => meshFrom(gl, buildBalloon(c)));
    this.kioskMeshes = { ferris: meshFrom(gl, buildKiosk(PAL[0])), balloon: meshFrom(gl, buildKiosk(PAL[4])), carousel: meshFrom(gl, buildKiosk(PAL[3])) };
    this.standMeshes = {};          // booth meshes for the ticket/popcorn/shop stands
    for (const s of STANDS) this.standMeshes[s.id] = meshFrom(gl, buildBooth(s.color));
    this.list = [];                 // NPC friends (this.list[i] — matches the shadow API)
    this.balloons = [];             // drifting ambient balloons
    this.kiosks = [];               // { id, pos, def }
    this.stands = [];               // { id, pos } — tappable ticket/popcorn/shop booths
    this.signs = [];                // { id, pos } — anchors for the floating signs
    this.onApproachTicket = null;   // called once when the player walks up to the ticket booth
    this.ticketArmed = true;
    // Lay the park out around the world centre so it sits near the spawn.
    const mx = SX / 2, mz = SZ / 2;
    this.wheel = { cx: mx - 14, cy: 14, cz: mz, R: WHEEL.R, angle: 0 };
    this.carousel = { cx: mx + 12, cy: 7, cz: mz - 8, angle: 0 };
    this.balloonPad = { cx: mx + 8, cy: 7, cz: mz + 12 };
    this.rideKind = null;           // set by main while a ride is running (pauses free-spin)
    this.rideBalloon = null;        // [x,y,z] of the balloon held above the player on a balloon ride
    this.fwTimer = 2.5;
    this.onFirework = null;         // (pos) => void
    this._m = mat4.create(); this._t = mat4.create(); this._r = mat4.create();
  }

  groundY(x, z) { return this.world.heightAt(Math.floor(x), Math.floor(z)) + 1; }

  populate() {
    const g = this.groundY(this.wheel.cx, this.wheel.cz);
    this.wheel.cy = g + 6.4; this.carousel.cy = g; this.balloonPad.cy = g;
    // Kiosks sit at the foot of each attraction (tap to ride).
    this.kiosks = [
      { id: 'ferris', pos: [this.wheel.cx + 3.5, g + 0.5, this.wheel.cz + 4.5], mesh: this.kioskMeshes.ferris },
      { id: 'carousel', pos: [this.carousel.cx + 3.4, g + 0.5, this.carousel.cz], mesh: this.kioskMeshes.carousel },
      { id: 'balloon', pos: [this.balloonPad.cx + 0.5, g + 0.5, this.balloonPad.cz + 3.2], mesh: this.kioskMeshes.balloon },
    ];
    // Anchor a big tappable "Ride!" sign over each ride so it's obvious + easy.
    this.signs = this.kiosks.map((k) => ({ id: k.id, pos: [k.pos[0], k.pos[1] + 2.5, k.pos[2]] }));
    // Ticket / Popcorn / Gift-shop booths in a tidy row near the spawn — the
    // Ticket booth is the easy, can't-miss way onto the rides.
    const mx = SX / 2, mz = SZ / 2;
    const sx = [mx - 6, mx, mx + 6];
    this.stands = STANDS.map((s, i) => ({ id: s.id, pos: [sx[i], g, mz + 6] }));
    for (const st of this.stands) this.signs.push({ id: st.id, pos: [st.pos[0], st.pos[1] + 2.7, st.pos[2]] });
    this.ticketArmed = true;
    // A few drifting balloons up in the sky for dazzle (spread across the world).
    this.balloons = [];
    for (let i = 0; i < 5; i++) this.balloons.push({ x: 10 + i * (SX - 20) / 5, y: g + 12 + (i % 3) * 3, z: 14 + (i * 17) % (SZ - 20), t: Math.random() * 6, mesh: this.balloonMeshes[i % this.balloonMeshes.length] });
    // Friends having fun: two ride the wheel (gondolas), the rest wander the plaza.
    this.list = [];
    const ids = CHARACTERS.map((c) => c.id).filter((id) => id !== 'ezra');
    const pick = () => ids[Math.floor(Math.random() * ids.length)];
    const riders = [pick(), pick()];
    for (let i = 0; i < riders.length; i++) { const n = new NPC(riders[i], 0, 0); n.seat = i === 0 ? 2 : 5; this.list.push(n); }
    const spots = [[mx - 4, mz - 6], [mx + 4, mz]];   // a couple of friends strolling (kept light for older iPads)
    for (const [x, z] of spots) { const n = new NPC(pick(), x, z); n.pos[1] = g; this.list.push(n); }
    this.chars = {};
    for (const n of this.list) { if (!this.chars[n.id]) { const c = new Character(this.gl); c.setCharacter(charById(n.id)); this.chars[n.id] = c; } }
  }

  gondolaAngle(i) { return this.wheel.angle + Math.PI + i * (Math.PI * 2 / WHEEL.N); }
  gondolaPos(i) { const a = this.gondolaAngle(i); return [this.wheel.cx, this.wheel.cy + Math.cos(a) * this.wheel.R, this.wheel.cz + Math.sin(a) * this.wheel.R]; }

  update(dt, player) {
    if (this.rideKind !== 'ferris') this.wheel.angle += dt * 0.42;     // free-spin unless a rider drives it
    if (this.rideKind !== 'carousel') this.carousel.angle += dt * 0.7;
    for (const b of this.balloons) { b.t += dt; b.y += Math.sin(b.t * 0.6) * dt * 0.5; b.x += Math.sin(b.t * 0.3) * dt * 0.4; }
    // Wandering plaza friends (seated riders stay put on the wheel).
    for (const n of this.list) {
      if (n.seat >= 0) continue;
      n.timer -= dt;
      if (n.timer <= 0) { n.timer = 2 + Math.random() * 3; n.moving = Math.random() < 0.7; if (n.moving) n.targetYaw = Math.random() * Math.PI * 2; }
      let d = n.targetYaw - n.yaw; while (d > Math.PI) d -= 6.283; while (d < -Math.PI) d += 6.283;
      n.yaw += Math.max(-2.5 * dt, Math.min(2.5 * dt, d));
      if (n.moving) {
        const nx = n.pos[0] - Math.sin(n.yaw) * 1.1 * dt, nz = n.pos[2] - Math.cos(n.yaw) * 1.1 * dt;
        if (nx > 6 && nx < SX - 6 && nz > 6 && nz < SZ - 6) { n.pos[0] = nx; n.pos[2] = nz; n.walk += dt * 6; n.pos[1] = this.groundY(nx, nz); }
        else n.targetYaw = n.yaw + Math.PI;
      }
    }
    // Walk up to the Ticket booth and the ride menu pops open (foolproof way onto
    // the rides). Re-arms once you step away, so it's never naggy.
    const tk = this.stands.find((s) => s.id === 'tickets');
    if (tk) {
      const dd = Math.hypot(player.pos[0] - tk.pos[0], player.pos[2] - tk.pos[2]);
      if (dd < 2.6 && this.ticketArmed) { this.ticketArmed = false; if (this.onApproachTicket) this.onApproachTicket(); }
      else if (dd > 4.5) this.ticketArmed = true;
    }
    // Fireworks for dazzle.
    this.fwTimer -= dt;
    if (this.fwTimer <= 0) {
      this.fwTimer = 2.4 + Math.random() * 2.6;
      if (this.onFirework) this.onFirework([12 + Math.random() * 40, this.wheel.cy + 4 + Math.random() * 6, 12 + Math.random() * 40]);
    }
  }

  // Tap a stand or a ride → return a descriptor { kind:'stand'|'ride', id } for
  // main to act on (open the right menu / start the ride).
  pickRay(o, d) {
    for (const s of this.stands) if (rayHitsSphere(o, d, s.pos[0], s.pos[1] + 0.9, s.pos[2], 2.0)) return { kind: 'stand', id: s.id };
    for (const k of this.kiosks) if (rayHitsSphere(o, d, k.pos[0], k.pos[1] + 0.6, k.pos[2], 1.6)) return { kind: 'ride', id: k.id };
    if (rayHitsSphere(o, d, this.wheel.cx, this.wheel.cy, this.wheel.cz, this.wheel.R + 1)) return { kind: 'ride', id: 'ferris' };
    if (rayHitsSphere(o, d, this.carousel.cx, this.carousel.cy + 2, this.carousel.cz, 3)) return { kind: 'ride', id: 'carousel' };
    if (rayHitsSphere(o, d, this.balloonPad.cx, this.balloonPad.cy + 1, this.balloonPad.cz, 2.2)) return { kind: 'ride', id: 'balloon' };
    return null;
  }

  draw(prog) {
    const gl = this.gl;
    // Ferris wheel: static legs, then the spinning structure (rotate about X).
    mat4.translate(this._t, this.wheel.cx, this.wheel.cy, this.wheel.cz);
    gl.uniformMatrix4fv(prog.u.uModel, false, this._t);
    this.legMesh.draw(prog);
    mat4.rotateX(this._r, this.wheel.angle);
    mat4.multiply(this._m, this._t, this._r);
    gl.uniformMatrix4fv(prog.u.uModel, false, this._m);
    this.wheelMesh.draw(prog);
    // Gondolas (upright) + any seated friends.
    for (let i = 0; i < WHEEL.N; i++) {
      const gp = this.gondolaPos(i);
      mat4.model(this._m, gp[0], gp[1], gp[2], 0, 1, 1, 1);
      gl.uniformMatrix4fv(prog.u.uModel, false, this._m);
      this.gondolaMesh.draw(prog);
    }
    for (const n of this.list) if (n.seat >= 0) { const gp = this.gondolaPos(n.seat); this.chars[n.id].draw(prog, gp[0], gp[1] + 0.1, gp[2], Math.PI, 0, 0, 0, true); }
    // Carousel (spins about Y).
    mat4.model(this._m, this.carousel.cx, this.carousel.cy, this.carousel.cz, this.carousel.angle, 1, 1, 1);
    gl.uniformMatrix4fv(prog.u.uModel, false, this._m);
    this.carouselMesh.draw(prog);
    // Drifting balloons (+ the ride balloon held above the player, if riding).
    for (const b of this.balloons) { mat4.model(this._m, b.x, b.y + Math.sin(b.t) * 0.3, b.z, 0, 1, 1, 1); gl.uniformMatrix4fv(prog.u.uModel, false, this._m); b.mesh.draw(prog); }
    if (this.rideBalloon) { mat4.model(this._m, this.rideBalloon[0], this.rideBalloon[1], this.rideBalloon[2], 0, 1.3, 1.3, 1.3); gl.uniformMatrix4fv(prog.u.uModel, false, this._m); this.balloonMeshes[0].draw(prog); }
    // Kiosks.
    for (const k of this.kiosks) { mat4.model(this._m, k.pos[0], k.pos[1], k.pos[2], 0, 1, 1, 1); gl.uniformMatrix4fv(prog.u.uModel, false, this._m); k.mesh.draw(prog); }
    // Stand booths (tickets / popcorn / gift shop).
    for (const s of this.stands) { mat4.model(this._m, s.pos[0], s.pos[1], s.pos[2], 0, 1, 1, 1); gl.uniformMatrix4fv(prog.u.uModel, false, this._m); this.standMeshes[s.id].draw(prog); }
    // Wandering plaza friends.
    for (const n of this.list) if (n.seat < 0) this.chars[n.id].draw(prog, n.pos[0], n.pos[1], n.pos[2], n.yaw, n.walk, n.moving ? 1 : 0, 0, false);
  }
}

// Local copy of the ray/sphere test (mirrors rayHitsSphere in main.js).
function rayHitsSphere(o, d, cx, cy, cz, r) {
  const ox = o[0] - cx, oy = o[1] - cy, oz = o[2] - cz;
  const b = ox * d[0] + oy * d[1] + oz * d[2];
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - c;
  if (disc < 0) return false;
  const t = -b - Math.sqrt(disc);
  return t > -r;
}
