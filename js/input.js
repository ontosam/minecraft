// Cross-platform controls:
//   Touch (iPad): left half = floating thumb-stick to walk, right half = drag to look.
//   Mouse (laptop): drag anywhere to look; WASD / arrow keys to walk; Space to jump.
// Big action buttons (Build/Dig/Jump/Pet/Home) are wired up in main.js.

const STICK_R = 58; // px radius of the joystick

export class Controls {
  constructor(canvas) {
    this.canvas = canvas;
    this.moveX = 0; this.moveY = 0;
    this.lookDX = 0; this.lookDY = 0;
    this.jump = false;

    this.movePtr = null; this.moveOrigin = [0, 0];
    this.lookPtr = null; this.lookLast = [0, 0];
    this.keys = { fwd: false, back: false, left: false, right: false };
    // Quick-tap detection (tap to build/dig where you touch; drag to move/look).
    this.tapPending = false; this.tapX = 0; this.tapY = 0;
    this.aim = { active: false, x: 0, y: 0 }; // where to show the build/dig indicator
    this.moveT = 0; this.moveDragged = false;
    this.lookStart = [0, 0]; this.lookT = 0; this.lookDragged = false;

    this.base = document.getElementById('stick-base');
    this.knob = document.getElementById('stick-knob');

    const opt = { passive: false };
    canvas.addEventListener('pointerdown', (e) => this.onDown(e), opt);
    canvas.addEventListener('pointermove', (e) => this.onMove(e), opt);
    canvas.addEventListener('pointerup', (e) => this.onUp(e), opt);
    canvas.addEventListener('pointercancel', (e) => this.onUp(e), opt);
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
  }

  aimAt(x, y) { this.aim.active = true; this.aim.x = x; this.aim.y = y; }

  onDown(e) {
    e.preventDefault();
    const now = performance.now();
    this.aimAt(e.clientX, e.clientY); // pressing previews where you'll build/dig
    // A mouse (laptop) drags anywhere to look; movement is via the keyboard.
    if (e.pointerType === 'mouse') {
      if (this.lookPtr === null) {
        this.lookPtr = e.pointerId; this.lookLast = [e.clientX, e.clientY];
        this.lookStart = [e.clientX, e.clientY]; this.lookT = now; this.lookDragged = false;
      }
      return;
    }
    const leftSide = e.clientX < window.innerWidth / 2;
    if (leftSide && this.movePtr === null) {
      this.movePtr = e.pointerId; this.moveOrigin = [e.clientX, e.clientY];
      this.moveT = now; this.moveDragged = false;
    } else if (!leftSide && this.lookPtr === null) {
      this.lookPtr = e.pointerId; this.lookLast = [e.clientX, e.clientY];
      this.lookStart = [e.clientX, e.clientY]; this.lookT = now; this.lookDragged = false;
    }
  }

  onMove(e) {
    if (e.pointerId === this.movePtr) {
      e.preventDefault();
      let dx = e.clientX - this.moveOrigin[0];
      let dy = e.clientY - this.moveOrigin[1];
      if (Math.hypot(dx, dy) > 8) this.moveDragged = true;
      const len = Math.hypot(dx, dy);
      if (len > STICK_R) { dx = dx / len * STICK_R; dy = dy / len * STICK_R; }
      const dead = 0.16;
      let mx = dx / STICK_R, my = -dy / STICK_R;
      const m = Math.hypot(mx, my);
      if (m < dead) { mx = 0; my = 0; } else {
        const s = (m - dead) / (1 - dead) / m; // rescale past dead zone
        mx *= s; my *= s;
      }
      this.moveX = mx; this.moveY = my;
      if (this.moveDragged) { this.aim.active = false; this.showStick(this.moveOrigin[0], this.moveOrigin[1], this.moveOrigin[0] + dx, this.moveOrigin[1] + dy); }
      else this.aimAt(e.clientX, e.clientY);
    } else if (e.pointerId === this.lookPtr) {
      e.preventDefault();
      if (Math.hypot(e.clientX - this.lookStart[0], e.clientY - this.lookStart[1]) > 8) { this.lookDragged = true; this.aim.active = false; }
      else this.aimAt(e.clientX, e.clientY);
      this.lookDX += e.clientX - this.lookLast[0];
      this.lookDY += e.clientY - this.lookLast[1];
      this.lookLast = [e.clientX, e.clientY];
    } else if (e.pointerType === 'mouse') {
      this.aimAt(e.clientX, e.clientY); // hover preview on a laptop
    }
  }

  onUp(e) {
    const now = performance.now();
    const tap = (x, y) => { this.tapPending = true; this.tapX = x; this.tapY = y; };
    if (e.pointerId === this.movePtr) {
      if (!this.moveDragged && now - this.moveT < 300) tap(e.clientX, e.clientY);
      this.movePtr = null; this.moveX = 0; this.moveY = 0; this.hideStick();
      this.aim.active = false;
    } else if (e.pointerId === this.lookPtr) {
      if (!this.lookDragged && now - this.lookT < 300) tap(e.clientX, e.clientY);
      this.lookPtr = null;
      if (e.pointerType === 'mouse') this.aimAt(e.clientX, e.clientY); // keep hovering
      else this.aim.active = false;
    }
  }

  onKey(e, down) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': this.keys.fwd = down; break;
      case 'KeyS': case 'ArrowDown': this.keys.back = down; break;
      case 'KeyA': case 'ArrowLeft': this.keys.left = down; break;
      case 'KeyD': case 'ArrowRight': this.keys.right = down; break;
      case 'Space': this.jump = down; break;
      default: return;
    }
    e.preventDefault();
  }

  // Called once per game frame: when no touch joystick is active, drive
  // movement from the keyboard instead.
  frame() {
    if (this.movePtr === null) {
      this.moveY = (this.keys.fwd ? 1 : 0) - (this.keys.back ? 1 : 0);
      this.moveX = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    }
  }

  showStick(bx, by, kx, ky) {
    if (!this.base || !this.knob) return;
    this.base.style.display = 'block';
    this.knob.style.display = 'block';
    this.base.style.left = bx + 'px'; this.base.style.top = by + 'px';
    this.knob.style.left = kx + 'px'; this.knob.style.top = ky + 'px';
  }
  hideStick() {
    if (this.base) this.base.style.display = 'none';
    if (this.knob) this.knob.style.display = 'none';
  }
}
