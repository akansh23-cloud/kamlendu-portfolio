import { chapters } from '../data/portfolio.js';

/**
 * Dock — the phone's version of the strata rail.
 *
 * A 15-layer core sample is a beautiful thing on a 1400px column and an
 * unusable thing on a 390px one, so the mobile build gets a different object
 * rather than a squashed copy of the same one: previous, next, where you are,
 * and how far through this era you have read. It lives in the glass panel band
 * at the bottom, which the camera rig already knows to keep the character out
 * of, so the two halves of the mobile layout never fight.
 */
export class Dock {
  constructor(timeline) {
    this.timeline = timeline;
    this.el = document.getElementById('dock');
    this.index = document.getElementById('dockIndex');
    this.name = document.getElementById('dockName');
    this.prog = document.getElementById('dockProg');
    this.prev = document.getElementById('dockPrev');
    this.next = document.getElementById('dockNext');
    this._active = -1;

    this.prev?.addEventListener('click', () => this.timeline.step(-1));
    this.next?.addEventListener('click', () => this.timeline.step(1));
  }

  update() {
    const t = this.timeline;
    if (this._active !== t.chapterIndex) {
      this._active = t.chapterIndex;
      const ch = t.chapter;
      if (this.index) {
        this.index.textContent = `${String(t.chapterIndex + 1).padStart(2, '0')} / ${String(chapters.length).padStart(2, '0')}`;
      }
      if (this.name) this.name.textContent = ch.name;
      if (this.prev) this.prev.disabled = t.chapterIndex === 0;
      if (this.next) this.next.disabled = t.chapterIndex === chapters.length - 1;
    }
    if (this.prog) this.prog.style.width = `${(t.chapterLocal * 100).toFixed(1)}%`;
  }
}
