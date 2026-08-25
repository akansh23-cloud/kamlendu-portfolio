/**
 * Sound — off by default, synthesized, and never load-bearing.
 *
 * Three rules, in order of importance.
 *
 * 1. It starts silent. Audio that plays without being asked for is the fastest
 *    way to get a portfolio closed, and autoplay policy would block it anyway.
 * 2. It ships no files. Every sound here is generated with oscillators and
 *    filtered noise, so enabling audio costs zero bytes of download and cannot
 *    fail to load on a bad connection.
 * 3. It is era-aware. The drone's timbre is derived from what the era is made
 *    of — wood and paper are warm and low-passed, machinery is band-passed and
 *    metallic, the network eras are airy and detuned. It is a texture under the
 *    scroll, not a soundtrack with opinions.
 *
 * If the Web Audio API is missing or the context refuses to start, the toggle
 * removes itself and the site carries on exactly as before.
 */

/* index → { base Hz, filter type, cutoff, noise amount, detune } */
const ERA_VOICES = [
  { f: 78, type: 'lowpass', cut: 420, noise: 0.10, detune: 3 },   // written memory
  { f: 74, type: 'lowpass', cut: 500, noise: 0.13, detune: 4 },   // archive
  { f: 96, type: 'bandpass', cut: 780, noise: 0.20, detune: 9 },  // punch cards
  { f: 88, type: 'bandpass', cut: 640, noise: 0.30, detune: 6 },  // tape
  { f: 120, type: 'lowpass', cut: 1100, noise: 0.08, detune: 12 },// digital media
  { f: 62, type: 'lowpass', cut: 340, noise: 0.16, detune: 2 },   // enterprise
  { f: 70, type: 'bandpass', cut: 560, noise: 0.14, detune: 7 },  // distributed
  { f: 132, type: 'highpass', cut: 260, noise: 0.10, detune: 14 },// cloud
  { f: 110, type: 'lowpass', cut: 900, noise: 0.06, detune: 5 },  // lakehouse
  { f: 98, type: 'bandpass', cut: 820, noise: 0.12, detune: 11 }, // streaming
  { f: 146, type: 'bandpass', cut: 1200, noise: 0.05, detune: 18 },// choron
  { f: 104, type: 'lowpass', cut: 700, noise: 0.05, detune: 6 },  // governance
  { f: 116, type: 'lowpass', cut: 1000, noise: 0.04, detune: 8 }, // profile
  { f: 116, type: 'lowpass', cut: 1000, noise: 0.04, detune: 8 }, // work
  { f: 124, type: 'lowpass', cut: 1300, noise: 0.03, detune: 9 }, // contact
];

export class Sound {
  constructor(caps) {
    this.caps = caps;
    this.on = false;
    this.ctx = null;
    this.btn = document.getElementById('btnSound');

    if (!('AudioContext' in window || 'webkitAudioContext' in window)) {
      this.btn?.remove();
      return;
    }

    this.btn?.addEventListener('click', () => this.toggle());
  }

  toggle() {
    this.on = !this.on;
    this.btn?.setAttribute('aria-pressed', String(this.on));
    if (this.btn) this.btn.textContent = this.on ? 'Sound on' : 'Sound off';

    if (this.on) {
      this._ensure();
      this.ctx?.resume?.();
      if (this.master) {
        this.master.gain.cancelScheduledValues(this.ctx.currentTime);
        this.master.gain.setTargetAtTime(this.caps.mobile ? 0.1 : 0.14, this.ctx.currentTime, 0.6);
      }
    } else if (this.master) {
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    }
  }

  _ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    try {
      this.ctx = new AC();
    } catch {
      this.btn?.remove();
      this.on = false;
      return;
    }

    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 500;
    this.filter.Q.value = 0.8;
    this.filter.connect(this.master);

    // Two detuned saw voices an octave apart: enough body to feel like a room.
    this.oscA = ctx.createOscillator();
    this.oscA.type = 'sawtooth';
    this.oscB = ctx.createOscillator();
    this.oscB.type = 'sawtooth';

    this.gainA = ctx.createGain();
    this.gainA.gain.value = 0.22;
    this.gainB = ctx.createGain();
    this.gainB.gain.value = 0.11;

    this.oscA.connect(this.gainA).connect(this.filter);
    this.oscB.connect(this.gainB).connect(this.filter);
    this.oscA.start();
    this.oscB.start();

    // Filtered noise bed — this is what makes tape sound like tape.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    this.noise = ctx.createBufferSource();
    this.noise.buffer = buf;
    this.noise.loop = true;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0.05;
    this.noise.connect(this.noiseGain).connect(this.filter);
    this.noise.start();
  }

  /** Called on every chapter change so the room's timbre follows the story. */
  setEra(index) {
    if (!this.on || !this.ctx) return;
    const v = ERA_VOICES[Math.min(ERA_VOICES.length - 1, Math.max(0, index))];
    const now = this.ctx.currentTime;
    const glide = 1.4;
    this.oscA.frequency.setTargetAtTime(v.f, now, glide);
    this.oscB.frequency.setTargetAtTime(v.f * 2.006, now, glide);
    this.oscB.detune.setTargetAtTime(v.detune, now, glide);
    this.filter.type = v.type;
    this.filter.frequency.setTargetAtTime(v.cut, now, glide);
    this.noiseGain.gain.setTargetAtTime(v.noise * 0.16, now, glide);
    this.cue('turn');
  }

  /** Short transients for chapter turns and era interactions. */
  cue(kind = 'turn') {
    if (!this.on || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const map = {
      turn: { type: 'sine', f: 320, to: 180, dur: 0.3, peak: 0.06 },
      action: { type: 'triangle', f: 180, to: 520, dur: 0.5, peak: 0.1 },
      open: { type: 'sine', f: 520, to: 720, dur: 0.35, peak: 0.07 },
    };
    const m = map[kind] || map.turn;

    o.type = m.type;
    o.frequency.setValueAtTime(m.f, now);
    o.frequency.exponentialRampToValueAtTime(m.to, now + m.dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(m.peak, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + m.dur);

    o.connect(g).connect(this.master);
    o.start(now);
    o.stop(now + m.dur + 0.05);
  }
}
