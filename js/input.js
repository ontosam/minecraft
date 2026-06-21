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

  onDown(e) {
    e.preventDefault();
    // A mouse (laptop) drags anywhere to look; movement is via the keyboard.
    if (e.pointerType === 'mouse') {
      if (this.lookPtr === null) { this.lookPtr = e.pointerId; this.lookLast = [e.clientX, e.clientY]; }
      return;
    }
    const leftSide = e.clientX < window.innerWidth / 2;
    if (leftSide && this.movePtr === null) {
      this.movePtr = e.pointerId;
      this.moveOrigin = [e.clientX, e.clientY];
      this.showStick(e.clientX, e.clientY, e.clientX, e.clientY);
    } else if (!leftSide && this.lookPtr === null) {
      this.lookPtr = e.pointerId;
      this.lookLast = [e.clientX, e.clientY];
    }
  }

  onMove(e) {
    if (e.pointerId === this.movePtr) {
      e.preventDefault();
      let dx = e.clientX - this.moveOrigin[0];
      let dy = e.clientY - this.moveOrigin[1];
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
      this.showStick(this.moveOrigin[0], this.moveOrigin[1], this.moveOrigin[0] + dx, this.moveOrigin[1] + dy);
    } else if (e.pointerId === this.lookPtr) {
      e.preventDefault();
      this.lookDX += e.clientX - this.lookLast[0];
      this.lookDY += e.clientY - this.lookLast[1];
      this.lookLast = [e.clientX, e.clientY];
    }
  }

  onUp(e) {
    if (e.pointerId === this.movePtr) {
      this.movePtr = null; this.moveX = 0; this.moveY = 0;
      this.hideStick();
    } else if (e.pointerId === this.lookPtr) {
      this.lookPtr = null;
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
