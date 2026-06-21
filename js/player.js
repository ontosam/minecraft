// Third-person player: moves relative to the camera, turns to face the way it
// walks, with gentle physics and auto-jump. Looking is handled by the camera.

import { B, SY } from './world.js';

const HALF = 0.28;      // half width (slim, so tight corners are easy to leave)
const HEIGHT = 1.7;     // body height
const GRAVITY = 22;
const JUMP = 7.2;
const SPEED = 3.7;      // gentle walk speed
const EPS = 1e-3;

// Flying (Ezra's wish): hold the button to rise, let go to drift gently down.
const FLY_RISE = 4.6;   // how fast you climb while holding the button
const FLY_SINK = 1.5;   // soft drift downward when you let go (the "soft landing")
// Water: a soft, splashy landing and gentle swimming.
const SWIM_UP = 3.2;    // swim up while holding the button in water
const WATER_SINK = 1.8; // slow, soft sink — this is what makes the landing gentle
const WATER_GRAV = 0.16;// gravity is almost cancelled in water
const WATER_FLOAT = 2.4;// gentle buoyancy back toward the surface

export class Player {
  constructor(world) {
    this.world = world;
    this.pos = world.spawn.slice();
    this.vel = [0, 0, 0];
    this.yaw = 0;          // facing (the way the character walks)
    this.onGround = false;
    this.moving = false;
    this.movingForward = false; // moving away from the camera (so it should trail)
    this.walkPhase = 0;    // drives the limb-swing animation
    this.moveAmt = 0;      // 0..1 eased "how much we're moving"
    this.flying = false;   // fly mode (toggled from the UI)
    this.inWater = false;  // currently standing/swimming in water
    this._wasInWater = false;
    this.onSplash = null;  // (pos) => void — fired the moment you enter water
  }

  goHome() {
    this.pos = this.world.spawn.slice();
    this.vel = [0, 0, 0];
  }

  // Is the body in water (feet or chest)? Drives swimming + the splash.
  inWaterAt(x, y, z) {
    return this.world.get(Math.floor(x), Math.floor(y + 0.2), Math.floor(z)) === B.WATER ||
      this.world.get(Math.floor(x), Math.floor(y + 0.9), Math.floor(z)) === B.WATER;
  }

  boxHits(x, y, z) {
    const w = this.world;
    const x0 = Math.floor(x - HALF), x1 = Math.floor(x + HALF);
    const y0 = Math.floor(y), y1 = Math.floor(y + HEIGHT - EPS);
    const z0 = Math.floor(z - HALF), z1 = Math.floor(z + HALF);
    for (let bx = x0; bx <= x1; bx++)
      for (let by = y0; by <= y1; by++)
        for (let bz = z0; bz <= z1; bz++)
          if (w.solidAt(bx, by, bz)) return true;
    return false;
  }

  // camYaw: the camera's horizontal angle; movement is relative to it.
  update(dt, input, camYaw) {
    const fwd = [-Math.sin(camYaw), 0, -Math.cos(camYaw)];
    const right = [Math.cos(camYaw), 0, -Math.sin(camYaw)];
    let wx = fwd[0] * input.moveY + right[0] * input.moveX;
    let wz = fwd[2] * input.moveY + right[2] * input.moveX;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }
    this.moving = wl > 0.05;
    this.vel[0] = wx * SPEED;
    this.vel[2] = wz * SPEED;

    // How forward-facing is the movement (relative to the camera)?
    const mag = Math.hypot(wx, wz);
    const cosF = mag > 0.001 ? (wx * fwd[0] + wz * fwd[2]) / mag : 0;
    this.movingForward = this.moving && cosF > 0.25;

    // Turn the character to face travel — but when backing up, keep facing
    // away from the camera (a natural backpedal) instead of spinning around.
    if (this.moving) {
      const target = cosF < -0.25 ? camYaw : Math.atan2(-wx, -wz);
      let d = target - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += Math.max(-12 * dt, Math.min(12 * dt, d));
    }

    // Vertical motion: flying, swimming, or normal gravity.
    this.inWater = this.inWaterAt(this.pos[0], this.pos[1], this.pos[2]);
    if (this.inWater && !this._wasInWater && this.onSplash) this.onSplash(this.pos.slice());
    if (this.flying) {
      if (input.jump) this.vel[1] = FLY_RISE;
      else this.vel[1] = -FLY_SINK;                  // let go → gentle, steady float down
      if (this.pos[1] > SY - 2 && this.vel[1] > 0) this.vel[1] = 0; // don't leave the sky
    } else if (this.inWater) {
      if (input.jump) this.vel[1] = SWIM_UP;
      else {
        this.vel[1] -= GRAVITY * WATER_GRAV * dt;
        this.vel[1] += WATER_FLOAT * dt;                 // buoyancy toward the surface
        if (this.vel[1] < -WATER_SINK) this.vel[1] = -WATER_SINK;
        if (this.vel[1] > 2.2) this.vel[1] = 2.2;
      }
    } else {
      if (input.jump && this.onGround) { this.vel[1] = JUMP; this.onGround = false; }
      this.vel[1] -= GRAVITY * dt;
      if (this.vel[1] < -28) this.vel[1] = -28;
    }

    // X axis
    let nx = this.pos[0] + this.vel[0] * dt;
    if (this.boxHits(nx, this.pos[1], this.pos[2])) {
      nx = this.vel[0] > 0 ? Math.floor(nx + HALF) - HALF - EPS : Math.ceil(nx - HALF) + HALF + EPS;
      this.vel[0] = 0;
    }
    this.pos[0] = nx;

    // Z axis
    let nz = this.pos[2] + this.vel[2] * dt;
    if (this.boxHits(this.pos[0], this.pos[1], nz)) {
      nz = this.vel[2] > 0 ? Math.floor(nz + HALF) - HALF - EPS : Math.ceil(nz - HALF) + HALF + EPS;
      this.vel[2] = 0;
    }
    this.pos[2] = nz;

    // Y axis
    let ny = this.pos[1] + this.vel[1] * dt;
    this.onGround = false;
    if (this.boxHits(this.pos[0], ny, this.pos[2])) {
      if (this.vel[1] <= 0) { ny = Math.floor(ny) + 1; this.onGround = true; }
      else { ny = Math.ceil(ny + HEIGHT) - HEIGHT - EPS; }
      this.vel[1] = 0;
    }
    this.pos[1] = ny;

    // Auto-jump a single-block step in the walking direction.
    if (this.onGround && this.moving && !this.flying && !this.inWater) {
      const mag = Math.hypot(wx, wz);
      const dx = wx / mag, dz = wz / mag;
      const ax = Math.floor(this.pos[0] + dx * (HALF + 0.25));
      const az = Math.floor(this.pos[2] + dz * (HALF + 0.25));
      const fy = Math.floor(this.pos[1] + 0.1);
      if (this.world.solidAt(ax, fy, az) && !this.world.solidAt(ax, fy + 1, az) &&
        !this.boxHits(this.pos[0], this.pos[1] + 1.05, this.pos[2])) {
        this.vel[1] = JUMP; this.onGround = false;
      }
    }

    // Walk animation + eased "moving" amount.
    this.walkPhase += dt * 9 * (this.moving ? 1 : 0);
    this.moveAmt += ((this.moving ? 1 : 0) - this.moveAmt) * Math.min(1, dt * 10);

    this._wasInWater = this.inWater;
    if (this.pos[1] < -4) this.goHome();
  }
}
