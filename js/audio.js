// Gentle synthesized sound effects via WebAudio — no audio files required.
// Must be resumed on a user gesture (iOS autoplay policy).

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  blip(freq, dur, type, gain, slideTo) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain || 0.18, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(this.ctx.destination);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  play(name) {
    switch (name) {
      case 'place': this.blip(560, 0.12, 'triangle', 0.16, 720); break;
      case 'dig': this.blip(180, 0.14, 'sawtooth', 0.14, 110); break;
      case 'jump': this.blip(420, 0.14, 'sine', 0.12, 680); break;
      case 'deny': this.blip(120, 0.16, 'square', 0.1); break;
      case 'pet':
        this.blip(880, 0.12, 'sine', 0.14, 990);
        setTimeout(() => this.blip(1320, 0.16, 'sine', 0.13), 90);
        break;
      case 'uhoh': // gentle, sing-song "uh-oh" — playful tension, not scary
        this.blip(523, 0.16, 'sine', 0.10, 494);
        setTimeout(() => this.blip(392, 0.20, 'sine', 0.10, 370), 150);
        break;
      case 'poof': // soft harmless puff
        this.blip(620, 0.16, 'triangle', 0.12, 180);
        break;
      case 'portal': // gentle shimmer when stepping through a portal
        this.blip(330, 0.18, 'sine', 0.11, 660);
        setTimeout(() => this.blip(495, 0.22, 'sine', 0.10, 990), 110);
        break;
      case 'coo': // soft, friendly call when you meet a nether creature
        this.blip(300, 0.26, 'sine', 0.10, 250);
        break;
      case 'treasure': // cheerful little sparkle when you dig up gold/diamond
        this.blip(784, 0.10, 'triangle', 0.14, 1175);
        setTimeout(() => this.blip(1047, 0.12, 'triangle', 0.13, 1568), 80);
        setTimeout(() => this.blip(1319, 0.16, 'sine', 0.12), 170);
        break;
      case 'fly': // soft upward whoosh when flight is toggled on
        this.blip(360, 0.20, 'sine', 0.10, 760);
        break;
      case 'splash': // gentle watery plip for a soft landing
        this.blip(900, 0.09, 'sine', 0.10, 320);
        setTimeout(() => this.blip(520, 0.13, 'sine', 0.09, 220), 55);
        break;
      case 'door': // soft wooden click when a door opens/closes
        this.blip(280, 0.09, 'square', 0.07, 230);
        break;
      case 'fuse': // quick sizzle when TNT is lit
        this.blip(1000, 0.12, 'square', 0.05, 1300);
        break;
      case 'boom': // a low, rumbly (but friendly) explosion
        this.blip(110, 0.42, 'sawtooth', 0.22, 40);
        this.blip(70, 0.5, 'square', 0.18, 30);
        break;
      case 'hurt': // a quick "ow" when something gets you
        this.blip(330, 0.14, 'square', 0.12, 170);
        break;
      case 'groan': // low, slow zombie groan (more silly than scary)
        this.blip(150, 0.32, 'sawtooth', 0.07, 105);
        break;
      case 'hiss': // soft, short spider skitter/hiss (gentle, not creepy)
        this.blip(640, 0.10, 'sawtooth', 0.05, 880);
        break;
    }
  }
}
