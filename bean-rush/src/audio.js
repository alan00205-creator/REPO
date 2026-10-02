// Synthesised sound effects and a small step-sequencer for the music. No audio files.

const NOTE = (n) => {
  // 'C5', 'F#4', 'Bb3' → frequency
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(n);
  if (!m) return 0;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const midi = base + (parseInt(m[3], 10) + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
};

// Songs: 16 steps per bar. Each track lists one string per bar (space separated, '.' = rest,
// '-' = hold). Chords are given per bar.
const SONGS = {
  lobby: {
    bpm: 108,
    chords: [['F3', 'A3', 'C4'], ['G3', 'B3', 'D4'], ['E3', 'G3', 'B3'], ['A3', 'C4', 'E4']],
    bass: ['F2', 'G2', 'E2', 'A2'],
    lead: [
      'C5 . A4 . C5 . F5 . E5 . C5 . A4 . . .',
      'D5 . B4 . D5 . G5 . F5 . D5 . B4 . . .',
      'B4 . G4 . B4 . E5 . D5 . B4 . G4 . . .',
      'C5 . A4 . E5 . A5 . G5 . E5 . C5 . . .',
    ],
    drums: 'k . h . s . h . k . h k s . h .',
    leadWave: 'sine',
    soft: true,
  },
  race: {
    bpm: 132,
    chords: [['C4', 'E4', 'G4'], ['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4']],
    bass: ['C2', 'A1', 'F1', 'G1'],
    lead: [
      'E5 . G5 . C6 . G5 . A5 . G5 . E5 . . .',
      'C5 . E5 . A5 . E5 . G5 . E5 . C5 . . .',
      'F5 . A5 . C6 . A5 . D6 . C6 . A5 . G5 .',
      'G5 . B5 . D6 . B5 . G5 . F5 . D5 . . .',
      'E5 E5 G5 . C6 . D6 . E6 . D6 . C6 . . .',
      'A5 . C6 . E6 . C6 . B5 . A5 . E5 . . .',
      'F5 . A5 . C6 . F6 . E6 . D6 . C6 . A5 .',
      'G5 . . B5 D6 . . B5 G5 . A5 . B5 . . .',
    ],
    drums: 'k . h . s . h k k . h . s . h h',
    leadWave: 'square',
  },
  final: {
    bpm: 142,
    chords: [['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['C4', 'E4', 'G4'], ['G3', 'B3', 'D4']],
    bass: ['A1', 'F1', 'C2', 'G1'],
    lead: [
      'A5 . . E5 A5 . C6 . B5 . A5 . E5 . . .',
      'F5 . . C5 F5 . A5 . G5 . F5 . C5 . . .',
      'E5 . . G5 C6 . E6 . D6 . C6 . G5 . . .',
      'D5 . . G5 B5 . D6 . C6 . B5 . G5 . A5 .',
    ],
    drums: 'k h k h s h k h k h k h s h s s',
    leadWave: 'sawtooth',
    drive: true,
  },
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.6;
    this.sfxVol = 0.8;
    this.song = null;
    this.want = null;
    this.step = 0;
    this.nextT = 0;
    this.timer = null;
    this.muted = false;
    this.lastPlay = {};
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = 0.9;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(c.destination);
      this.musicBus = c.createGain();
      this.sfxBus = c.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.applyVol();
      // noise buffer
      const len = c.sampleRate;
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.timer = setInterval(() => this.tick(), 25);
      if (this.want) this.music(this.want);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolumes(music, sfx) {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.applyVol();
  }

  applyVol() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.muted ? 0 : this.musicVol * 0.32, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.muted ? 0 : this.sfxVol * 0.9, t, 0.05);
  }

  suspend(on) {
    if (!this.ctx) return;
    if (on) this.ctx.suspend(); else this.ctx.resume();
  }

  // ---- primitives -------------------------------------------------------------
  env(g, t, a, peak, d, end = 0.0001) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(end, t + a + d);
  }

  osc(type, f0, f1, t, dur, peak, bus, a = 0.005) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this.env(g, t, a, peak, dur);
    o.connect(g).connect(bus || this.sfxBus);
    o.start(t);
    o.stop(t + a + dur + 0.05);
    return o;
  }

  noiseHit(t, dur, peak, type, f0, f1, q = 1, bus) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = 1;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    this.env(g, t, 0.004, peak, dur);
    s.connect(f).connect(g).connect(bus || this.sfxBus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  // ---- effects ----------------------------------------------------------------
  play(name, o = {}) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx;
    const t = c.currentTime + 0.005;
    // light rate limiting so crowds don't turn into noise
    const gap = { tile: 0.04, land: 0.03, jump: 0.02, bonk: 0.05, drop: 0.12, thump: 0.15, boing: 0.06 }[name] || 0;
    if (gap && this.lastPlay[name] && t - this.lastPlay[name] < gap) return;
    this.lastPlay[name] = t;
    const v = o.vol ?? 1;
    const p = o.pitch ?? 1;
    switch (name) {
      case 'jump':
        this.osc('triangle', 330 * p, 720 * p, t, 0.13, 0.32 * v);
        this.osc('sine', 660 * p, 1100 * p, t, 0.08, 0.08 * v);
        break;
      case 'land':
        this.noiseHit(t, 0.07, 0.22 * v, 'lowpass', 700, 200);
        this.osc('sine', 150, 60, t, 0.1, 0.25 * v);
        break;
      case 'dive':
        this.noiseHit(t, 0.24, 0.22 * v, 'bandpass', 1800, 500, 1.2);
        this.osc('triangle', 520 * p, 260 * p, t, 0.18, 0.12 * v);
        break;
      case 'bonk':
        this.osc('square', 700 * p, 180 * p, t, 0.09, 0.14 * v);
        this.osc('sine', 260 * p, 140 * p, t + 0.02, 0.35, 0.3 * v);
        this.noiseHit(t, 0.05, 0.2 * v, 'highpass', 2500, 0);
        break;
      case 'boing': {
        const o1 = this.osc('sine', 180, 520, t, 0.3, 0.3 * v);
        const lfo = c.createOscillator(); const lg = c.createGain();
        lfo.frequency.value = 28; lg.gain.value = 40;
        lfo.connect(lg).connect(o1.frequency); lfo.start(t); lfo.stop(t + 0.4);
        break;
      }
      case 'doorBreak':
        this.noiseHit(t, 0.3, 0.35 * v, 'lowpass', 2400, 300);
        for (let i = 0; i < 4; i++) this.osc('square', 220 - i * 30, 120, t + i * 0.035, 0.05, 0.08 * v);
        break;
      case 'thud':
        this.osc('sine', 110, 55, t, 0.18, 0.4 * v);
        this.noiseHit(t, 0.08, 0.15 * v, 'lowpass', 500, 150);
        break;
      case 'splash':
        this.noiseHit(t, 0.45, 0.32 * v, 'lowpass', 2600, 250, 2);
        for (let i = 0; i < 4; i++) this.osc('sine', 280 + Math.random() * 200, 900 + Math.random() * 500, t + 0.08 + i * 0.07, 0.07, 0.12 * v);
        break;
      case 'tile':
        this.osc('triangle', 1250 * p, 900 * p, t, 0.05, 0.05 * v);
        break;
      case 'tileFall':
        this.noiseHit(t, 0.12, 0.05 * v, 'bandpass', 900, 300, 2);
        break;
      case 'crack':
        for (let i = 0; i < 6; i++) this.noiseHit(t + i * 0.05, 0.04, 0.18 * v, 'highpass', 1800, 0);
        break;
      case 'fall':
        this.noiseHit(t, 0.6, 0.25 * v, 'lowpass', 900, 120);
        this.osc('sine', 300, 60, t, 0.6, 0.15 * v);
        break;
      case 'drop':
        this.osc('sine', 240, 110, t, 0.16, 0.14 * v);
        break;
      case 'thump':
        this.osc('sine', 90, 50, t, 0.14, 0.18 * v);
        break;
      case 'beep':
        this.osc('square', 660, 660, t, 0.14, 0.12 * v);
        this.osc('sine', 1320, 1320, t, 0.12, 0.06 * v);
        break;
      case 'go':
        for (const f of [523, 659, 784, 1046]) this.osc('square', f, f, t, 0.45, 0.07 * v, null, 0.01);
        this.cheer(t, 1.2, 0.5 * v);
        break;
      case 'whistle': {
        const o1 = this.osc('sine', 2300, 2300, t, 0.7, 0.18 * v, null, 0.02);
        const lfo = c.createOscillator(); const lg = c.createGain();
        lfo.frequency.value = 32; lg.gain.value = 120;
        lfo.connect(lg).connect(o1.frequency); lfo.start(t); lfo.stop(t + 0.8);
        break;
      }
      case 'qualify': {
        const seq = [523, 659, 784, 1046, 1318];
        seq.forEach((f, i) => {
          this.osc('square', f, f, t + i * 0.075, 0.16, 0.08 * v);
          this.osc('triangle', f, f, t + i * 0.075, 0.22, 0.12 * v);
        });
        this.cheer(t + 0.1, 1.6, 0.6 * v);
        break;
      }
      case 'eliminated': {
        const seq = [392, 370, 349, 330];
        seq.forEach((f, i) => {
          const dur = i === 3 ? 0.9 : 0.3;
          const o1 = this.osc('sawtooth', f, f * (i === 3 ? 0.97 : 1), t + i * 0.32, dur, 0.1 * v, null, 0.03);
          if (i === 3) {
            const lfo = c.createOscillator(); const lg = c.createGain();
            lfo.frequency.value = 6; lg.gain.value = 8;
            lfo.connect(lg).connect(o1.frequency); lfo.start(t + 0.96); lfo.stop(t + 2);
          }
        });
        break;
      }
      case 'crown': {
        const seq = [523, 659, 784, 1046, 784, 1046, 1318, 1568];
        seq.forEach((f, i) => {
          this.osc('square', f, f, t + i * 0.1, 0.22, 0.07 * v);
          this.osc('triangle', f / 2, f / 2, t + i * 0.1, 0.25, 0.12 * v);
        });
        this.cheer(t, 3, 0.8 * v);
        break;
      }
      case 'click':
        this.osc('triangle', 880, 1200, t, 0.05, 0.12 * v);
        break;
      case 'back':
        this.osc('triangle', 700, 420, t, 0.07, 0.12 * v);
        break;
      case 'coin':
        this.osc('square', 1320, 1320, t, 0.07, 0.06 * v);
        this.osc('square', 1760, 1760, t + 0.07, 0.18, 0.06 * v);
        break;
      case 'buy':
        [784, 988, 1175, 1568].forEach((f, i) => this.osc('triangle', f, f, t + i * 0.06, 0.15, 0.13 * v));
        break;
      case 'deny':
        this.osc('square', 200, 160, t, 0.18, 0.08 * v);
        break;
      case 'chime':
        [1046, 1318].forEach((f, i) => this.osc('sine', f, f, t + i * 0.09, 0.3, 0.13 * v));
        break;
      case 'tick':
        this.osc('sine', 1500, 1500, t, 0.03, 0.06 * v);
        break;
      case 'whoosh':
        this.noiseHit(t, 0.35, 0.12 * v, 'bandpass', 400, 2400, 1);
        break;
      case 'cheer':
        this.cheer(t, 1.6, 0.6 * v);
        break;
      case 'aww':
        this.osc('sawtooth', 300, 220, t, 0.9, 0.04 * v, null, 0.15);
        this.noiseHit(t, 0.9, 0.08 * v, 'bandpass', 700, 400, 1);
        break;
    }
  }

  cheer(t, dur, peak) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1500;
    f.Q.value = 0.7;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12 * peak, t + 0.15);
    g.gain.setValueAtTime(0.12 * peak, t + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 7;
    lg.gain.value = 0.04 * peak;
    lfo.connect(lg).connect(g.gain);
    s.connect(f).connect(g).connect(this.sfxBus);
    s.start(t);
    s.stop(t + dur + 0.1);
    lfo.start(t);
    lfo.stop(t + dur + 0.1);
  }

  // ---- music ------------------------------------------------------------------
  music(name) {
    this.want = name;
    if (!this.ctx) return;
    if (this.song && this.song.name === name) return;
    if (!name) { this.song = null; return; }
    const s = SONGS[name];
    this.song = {
      name, ...s,
      leadP: s.lead.map((b) => b.split(' ')),
      drumP: s.drums.split(' '),
    };
    this.step = 0;
    this.nextT = this.ctx.currentTime + 0.1;
  }

  tick() {
    if (!this.ctx || !this.song || this.ctx.state !== 'running') return;
    const s = this.song;
    const spb = 60 / s.bpm / 4; // seconds per 16th
    const ahead = this.ctx.currentTime + 0.14;
    while (this.nextT < ahead) {
      this.playStep(s, this.step, this.nextT, spb);
      this.nextT += spb;
      this.step++;
    }
  }

  playStep(s, step, t, spb) {
    const bar = Math.floor(step / 16);
    const i = step % 16;
    const ci = bar % s.chords.length;
    const bus = this.musicBus;
    // drums
    const d = s.drumP[i];
    if (d === 'k') { this.osc('sine', 150, 45, t, 0.16, 0.7, bus); }
    else if (d === 's') { this.noiseHit(t, 0.12, 0.32, 'bandpass', 1800, 900, 0.8, bus); this.osc('triangle', 220, 160, t, 0.06, 0.12, bus); }
    else if (d === 'h' && !s.soft) this.noiseHit(t, 0.035, 0.12, 'highpass', 7000, 0, 1, bus);
    else if (d === 'h') this.noiseHit(t, 0.03, 0.06, 'highpass', 8000, 0, 1, bus);
    // bass
    const bf = NOTE(s.bass[ci]);
    const bassHit = s.drive ? i % 2 === 0 : [0, 3, 6, 8, 11, 14].includes(i);
    if (bassHit) {
      const f = s.drive && i % 4 === 2 ? bf * 2 : bf;
      this.osc(s.soft ? 'sine' : 'triangle', f, f, t, spb * 1.6, s.soft ? 0.32 : 0.42, bus, 0.004);
    }
    // chord stabs on the off-beats
    if ((s.soft ? [0, 8] : [2, 6, 10, 14]).includes(i)) {
      for (const n of s.chords[ci]) {
        const f = NOTE(n);
        this.osc(s.soft ? 'triangle' : 'square', f, f, t, s.soft ? spb * 6 : spb * 0.9, s.soft ? 0.05 : 0.035, bus, 0.004);
      }
    }
    // lead
    const lp = s.leadP[bar % s.leadP.length];
    const n = lp[i];
    if (n && n !== '.' && n !== '-') {
      let len = 1;
      while (lp[i + len] === '-') len++;
      const f = NOTE(n);
      const wave = s.leadWave;
      this.osc(wave, f, f, t, spb * (len + 0.6), wave === 'sine' ? 0.16 : wave === 'sawtooth' ? 0.045 : 0.06, bus, 0.006);
      if (wave === 'sine') this.osc('sine', f * 2, f * 2, t, spb * 0.8, 0.03, bus, 0.002);
    }
  }
}
