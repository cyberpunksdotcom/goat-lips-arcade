// Tiny synthesized sound effects (no audio files, nothing to license). Off by default.

type Sfx = 'toss' | 'pour' | 'serve' | 'refuse' | 'catch' | 'loss' | 'phase' | 'over';

export class Sound {
  private ctx: AudioContext | null = null;
  enabled = false;

  /** Must be called from a user gesture (iOS requires it). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      this.ctx = null;
    }
  }

  play(name: Sfx): void {
    if (!this.enabled || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    switch (name) {
      case 'toss':
        this.noise(t, 0.07, 2600, 900, 0.05);
        break;
      case 'pour':
        this.noise(t, 0.14, 1400, 500, 0.05);
        this.tone(t + 0.02, 'sine', 1700, 0.05, 0.04);
        break;
      case 'refuse':
        this.tone(t, 'square', 220, 0.09, 0.05);
        this.tone(t + 0.11, 'square', 196, 0.12, 0.05);
        break;
      case 'serve':
        this.tone(t, 'triangle', 880, 0.08, 0.12);
        this.tone(t + 0.07, 'triangle', 1320, 0.1, 0.1);
        break;
      case 'catch':
        this.tone(t, 'sine', 2200, 0.06, 0.08);
        break;
      case 'loss':
        this.tone(t, 'sawtooth', 180, 0.32, 0.08, 70);
        break;
      case 'phase':
        this.tone(t, 'sine', 660, 0.25, 0.08);
        this.tone(t + 0.05, 'sine', 990, 0.3, 0.06);
        break;
      case 'over':
        [523, 392, 262].forEach((f, i) => this.tone(t + i * 0.16, 'triangle', f, 0.22, 0.1));
        break;
    }
  }

  private tone(t: number, type: OscillatorType, freq: number, dur: number, vol: number, endFreq?: number): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(t: number, dur: number, from: number, to: number, vol: number): void {
    const c = this.ctx!;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
  }
}
