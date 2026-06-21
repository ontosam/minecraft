// First-person player: gentle movement, auto-jump over 1-block steps, and
// forgiving AABB collision against the voxel world. No fall damage, no death.

const HALF = 0.3;       // half width
const HEIGHT = 1.7;     // body height
const EYE = 1.55;       // eye height above feet
const GRAVITY = 22;
const JUMP = 7.2;
const SPEED = 4.2;      // gentle walk speed
const EPS = 1e-3;

export class Player {
  constructor(world) {
    this.world = world;
    this.pos = world.spawn.slice();
    this.vel = [0, 0, 0];
    this.yaw = 0;
    this.pitch = -0.15;
    this.onGround = false;
    this.lookSens = 0.0042; // low sensitivity for small hands
  }

  goHome() {
    this.pos = this.world.spawn.slice();
    this.vel = [0, 0, 0];
    this.pitch = -0.15;
  }

  lookDir() {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    return [-Math.sin(this.yaw) * cp, sp, -Math.cos(this.yaw) * cp];
  }

  eye() { return [this.pos[0], this.pos[1] + EYE, this.pos[2]]; }

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

  update(dt, input) {
    // Look (from right-side drag).
    this.yaw -= input.lookDX * this.lookSens;
    this.pitch -= input.lookDY * this.lookSens;
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
    input.lookDX = 0; input.lookDY = 0;

    // Desired horizontal movement relative to facing.
    const fH = [-Math.sin(this.yaw), 0, -Math.cos(this.yaw)];
    const right = [Math.cos(this.yaw), 0, -Math.sin(this.yaw)];
    let wx = fH[0] * input.moveY + right[0] * input.moveX;
    let wz = fH[2] * input.moveY + right[2] * input.moveX;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }
    this.vel[0] = wx * SPEED;
    this.vel[2] = wz * SPEED;

    if (input.jump && this.onGround) { this.vel[1] = JUMP; this.onGround = false; }
    this.vel[1] -= GRAVITY * dt;
    if (this.vel[1] < -28) this.vel[1] = -28;

    const movingH = wl > 0.05;

    // X axis
    let nx = this.pos[0] + this.vel[0] * dt;
    if (this.boxHits(nx, this.pos[1], this.pos[2])) {
      nx = this.vel[0] > 0 ? Math.floor(nx + HALF) - HALF - EPS
        : Math.ceil(nx - HALF) + HALF + EPS;
      this.vel[0] = 0;
    }
    this.pos[0] = nx;

    // Z axis
    let nz = this.pos[2] + this.vel[2] * dt;
    if (this.boxHits(this.pos[0], this.pos[1], nz)) {
      nz = this.vel[2] > 0 ? Math.floor(nz + HALF) - HALF - EPS
        : Math.ceil(nz - HALF) + HALF + EPS;
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

    // Auto-jump: if a single-block step is right in front while walking, hop up.
    // We check the block ahead is solid but the one above it (and our headroom)
    // is clear, so we never bounce against taller walls.
    if (this.onGround && movingH) {
      const mag = Math.hypot(wx, wz); // intended direction (velocity may be zeroed by a wall)
      if (mag > 0.1) {
        const dx = wx / mag, dz = wz / mag;
        const ax = Math.floor(this.pos[0] + dx * (HALF + 0.25));
        const az = Math.floor(this.pos[2] + dz * (HALF + 0.25));
        const fy = Math.floor(this.pos[1] + 0.1);
        if (this.world.solidAt(ax, fy, az) && !this.world.solidAt(ax, fy + 1, az) &&
          !this.boxHits(this.pos[0], this.pos[1] + 1.05, this.pos[2])) {
          this.vel[1] = JUMP; // enough to clear a full 1-block step
          this.onGround = false;
        }
      }
    }

    // Safety net: never fall out of the world.
    if (this.pos[1] < -4) this.goHome();
  }
}
