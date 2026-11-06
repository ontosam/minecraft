// Tiny WebAudio synth for Ezra's Mine — every sound is generated in code
// (no audio files). Must be resumed on a user gesture (iOS autoplay policy).

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
  }

  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  tone(freq, dur, type = 'sine', gain = 0.16, slideTo = 0, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.03);
  }

  // Short filtered noise burst — the "crunch" of stone.
  crunch(dur = 0.08, freq = 900, gain = 0.22, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  // Major-scale note n steps above C5 (for rising merge chimes).
  note(n) {
    const scale = [0, 2, 4, 5, 7, 9, 11];
    const oct = Math.floor(n / 7), s = scale[((n % 7) + 7) % 7];
    return 523.25 * Math.pow(2, oct + s / 12);
  }

  play(name, arg = 0) {
    switch (name) {
      case 'hit': // pickaxe tap on the mine block
        this.crunch(0.07, 700 + Math.random() * 500, 0.25);
        this.tone(200 + Math.random() * 40, 0.05, 'square', 0.04);
        break;
      case 'break': // mine block shatters
        this.crunch(0.18, 500, 0.3);
        this.crunch(0.12, 1400, 0.15, 0.03);
        this.tone(330, 0.12, 'triangle', 0.12, 660, 0.02);
        break;
      case 'drop': // a new block lands on the board
        this.tone(440, 0.09, 'triangle', 0.12, 300);
        break;
      case 'merge': { // rising chime — higher tiers sing higher
        const n = Math.min(arg, 20);
        this.tone(this.note(n), 0.14, 'triangle', 0.16);
        this.tone(this.note(n + 2), 0.14, 'triangle', 0.14, 0, 0.06);
        this.tone(this.note(n + 4), 0.22, 'sine', 0.14, 0, 0.12);
        break;
      }
      case 'new': // first time ever making this block
        [0, 2, 4, 7, 9, 11, 14].forEach((s, i) => this.tone(this.note(s + 4), 0.18, 'triangle', 0.13, 0, i * 0.07));
        break;
      case 'coin':
        this.tone(1320, 0.06, 'square', 0.05);
        this.tone(1760, 0.12, 'square', 0.05, 0, 0.05);
        break;
      case 'buy':
        this.tone(660, 0.08, 'triangle', 0.14);
        this.tone(990, 0.16, 'triangle', 0.14, 0, 0.07);
        break;
      case 'levelup':
        [0, 4, 7, 12, 16].forEach((s, i) => this.tone(523.25 * Math.pow(2, s / 12), 0.25, 'triangle', 0.14, 0, i * 0.09));
        this.tone(1046.5, 0.5, 'sine', 0.1, 0, 0.45);
        break;
      case 'chest':
        this.crunch(0.1, 300, 0.2);
        [7, 9, 11, 14].forEach((s, i) => this.tone(this.note(s), 0.16, 'sine', 0.13, 0, 0.1 + i * 0.06));
        break;
      case 'boom':
        this.crunch(0.45, 160, 0.45);
        this.crunch(0.3, 500, 0.2, 0.05);
        this.tone(110, 0.4, 'sine', 0.25, 40);
        break;
      case 'pick': this.tone(520, 0.05, 'sine', 0.1, 640); break;
      case 'swap': this.tone(380, 0.07, 'sine', 0.1, 420); break;
      case 'store': this.tone(500, 0.08, 'triangle', 0.12, 260); break;
      case 'deny': this.tone(150, 0.14, 'square', 0.07); break;
      case 'open': this.tone(600, 0.07, 'sine', 0.1, 800); break;
      case 'close': this.tone(700, 0.07, 'sine', 0.08, 500); break;
      case 'done': // quest complete
        [0, 4, 7, 12].forEach((s, i) => this.tone(659.25 * Math.pow(2, s / 12), 0.2, 'triangle', 0.13, 0, i * 0.08));
        break;
      case 'smelt': this.crunch(0.25, 220, 0.12); this.tone(300, 0.2, 'sine', 0.06, 380); break;
      case 'craft': this.crunch(0.06, 1200, 0.18); this.tone(880, 0.1, 'triangle', 0.1, 0, 0.06); break;
    }
  }
}
