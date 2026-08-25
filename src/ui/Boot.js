import { clamp } from '../lib/math.js';

/**
 * Boot — the first eight seconds, and the only time the site asks for patience.
 *
 * The sequence is fixed by the brief: black, then KAMLENDU // DATA PLANE, then
 * ARCHIVE INITIALIZATION, then YEAR: BEFORE DIGITAL STORAGE. It is doing real
 * work behind the veil — the first scene is compiling its geometry and the
 * fonts are landing — so the wait is honest rather than theatrical.
 *
 * It can always be skipped, it never blocks for longer than its own timeline,
 * and if anything at all goes wrong upstream it removes itself. A boot screen
 * that can trap a visitor is a bug, not a mood.
 */
export class Boot {
  constructor(caps) {
    this.caps = caps;
    this.el = document.getElementById('boot');
    this.bar = document.getElementById('bootBar');
    this.skip = document.getElementById('bootSkip');
    this.lines = [...document.querySelectorAll('.boot-line')];

    this.t = 0;
    this.done = false;
    this.assetsReady = false;
    this.duration = caps.reduced ? 1.1 : 3.9;

    document.body.classList.add('is-booting');

    this.skip?.addEventListener('click', () => this.finish());
    this._onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') this.finish();
    };
    addEventListener('keydown', this._onKey);

    // Hard ceiling. If the scene never reports ready, the visitor still gets in.
    this._guard = setTimeout(() => this.finish(), 9000);
  }

  /** Called by the app once the first scene has been built and rendered once. */
  ready() {
    this.assetsReady = true;
  }

  update(dt) {
    if (this.done) return;
    this.t += dt;

    const p = clamp(this.t / this.duration);
    if (this.bar) this.bar.style.transform = `scaleX(${p.toFixed(3)})`;

    // Lines land on thirds of the sequence.
    for (let i = 0; i < this.lines.length; i++) {
      const at = 0.1 + i * 0.26;
      this.lines[i].classList.toggle('on', p >= at);
    }

    if (p >= 1 && this.assetsReady) this.finish();
  }

  finish() {
    if (this.done) return;
    this.done = true;
    clearTimeout(this._guard);
    removeEventListener('keydown', this._onKey);

    for (const l of this.lines) l.classList.add('on');
    this.el?.classList.add('done');
    document.body.classList.remove('is-booting');

    // Remove from the tree so it can never intercept a pointer again.
    setTimeout(() => this.el?.remove(), 900);
    this.onDone?.();
  }
}
