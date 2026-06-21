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
    }
  }
}
