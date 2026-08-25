import * as THREE from 'three';
import { chapters } from '../data/portfolio.js';
import { SCENES } from '../scenes/index.js';
import { clamp, damp, inv, lerp } from '../lib/math.js';

/**
 * Timeline — scroll is the only clock in this project.
 *
 * Two structures matter here.
 *
 * CHAPTERS are what the visitor reads: fifteen of them, each a DOM section.
 * ACTS are what the renderer draws: consecutive chapters that share a scene are
 * merged into one act, so the last three chapters (profile / work / contact)
 * play as a single continuous scene rather than three restarts of the same one.
 *
 * Progress is measured against real layout — each chapter's actual offsetTop
 * and offsetHeight — rather than against a synthetic scroll length. That means
 * the 3D and the words can never drift apart when a font loads late, a phone
 * chrome bar collapses, or recruiter mode shortens every section.
 */

const ANCHOR = 0.5; // chapter progress is read at the middle of the viewport

export class Timeline {
  constructor(caps) {
    this.caps = caps;
    this.chapters = chapters;

    // ------------------------------------------------------------ build acts
    this.acts = [];
    for (let i = 0; i < chapters.length; i++) {
      const key = chapters[i].scene;
      const last = this.acts[this.acts.length - 1];
      if (last && last.scene === key) {
        last.to = i;
        last.chapters.push(i);
      } else {
        this.acts.push({ scene: key, from: i, to: i, chapters: [i], index: this.acts.length });
      }
    }
    for (const a of this.acts) {
      if (!SCENES[a.scene]) console.warn(`[timeline] unknown scene "${a.scene}"`);
    }

    this.els = [];
    this.rects = [];

    this.chapterIndex = 0;
    this.chapterLocal = 0;
    this.actIndex = 0;
    this.actLocal = 0;
    this.smoothActLocal = 0;
    this.overall = 0;
    this.velocity = 0;

    this._lastScroll = 0;
    this._colorA = new THREE.Color(chapters[0].color);
    this._colorB = new THREE.Color(chapters[0].color);
    this.eraColor = new THREE.Color(chapters[0].color);

    this.onChapterChange = null;
    this._lastEmitted = -1;
  }

  /** Called once the story DOM exists, and again on every resize. */
  attach(els) {
    this.els = els;
    this.measure();
    let raf = 0;
    const remeasure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => this.measure());
    };
    addEventListener('resize', remeasure, { passive: true });
    addEventListener('orientationchange', remeasure, { passive: true });
    // Fonts change section heights; remeasure once they land.
    document.fonts?.ready?.then(remeasure).catch(() => {});
  }

  measure() {
    this.rects = this.els.map((el) => ({
      top: el.offsetTop,
      height: Math.max(1, el.offsetHeight),
    }));
    for (const a of this.acts) {
      const first = this.rects[a.from];
      const last = this.rects[a.to];
      if (!first || !last) continue;
      a.top = first.top;
      a.height = Math.max(1, last.top + last.height - first.top);
    }
    this.docHeight = Math.max(1, document.body.scrollHeight - innerHeight);
    this.sample(0, true);
  }

  /** Resolve scroll position into chapter + act coordinates. */
  sample(dt = 0, immediate = false) {
    if (!this.rects.length) return;

    const y = scrollY || 0;
    const read = y + innerHeight * ANCHOR;

    this.velocity = dt > 0 ? (y - this._lastScroll) / dt : 0;
    this._lastScroll = y;
    this.overall = clamp(y / this.docHeight);

    // ---------------------------------------------------------- the chapter
    let ci = 0;
    for (let i = 0; i < this.rects.length; i++) {
      if (read >= this.rects[i].top) ci = i;
    }
    const r = this.rects[ci];
    this.chapterIndex = ci;
    this.chapterLocal = clamp(inv(r.top, r.top + r.height, read));

    // -------------------------------------------------------------- the act
    let ai = 0;
    for (let i = 0; i < this.acts.length; i++) {
      if (ci >= this.acts[i].from) ai = i;
    }
    const act = this.acts[ai];
    this.actIndex = ai;
    this.act = act;
    this.actLocal = clamp(inv(act.top, act.top + act.height, read));

    // Damping is what turns a scroll position into a camera move rather than a
    // slider. Reduced motion gets a near-instant lambda so nothing glides.
    const l = this.caps.reduced ? 60 : 7.5;
    this.smoothActLocal = immediate
      ? this.actLocal
      : damp(this.smoothActLocal, this.actLocal, l, dt);

    // ------------------------------------------------------------- era colour
    // Colour crosses over in the last quarter of a chapter, which is roughly
    // where the eye starts looking for the next section anyway.
    const next = this.chapters[Math.min(this.chapters.length - 1, ci + 1)];
    const k = clamp(inv(0.72, 1, this.chapterLocal));
    this._colorA.set(this.chapters[ci].color);
    this._colorB.set(next.color);
    this.eraColor.copy(this._colorA).lerp(this._colorB, k);

    if (ci !== this._lastEmitted) {
      this._lastEmitted = ci;
      this.onChapterChange?.(ci, this.chapters[ci]);
    }
  }

  // ----------------------------------------------------------------- helpers

  get chapter() {
    return this.chapters[this.chapterIndex];
  }

  nextAct() {
    return this.acts[this.actIndex + 1] || null;
  }

  /** Which scenes should exist in memory right now. */
  window(radius = 1) {
    const keys = new Set();
    for (let i = this.actIndex - radius; i <= this.actIndex + radius; i++) {
      const a = this.acts[i];
      if (a) keys.add(a.scene);
    }
    return keys;
  }

  /** Absolute document position for the start of a chapter, in pixels. */
  offsetOf(index) {
    const r = this.rects[index];
    if (!r) return 0;
    return Math.max(0, r.top - innerHeight * (ANCHOR - 0.12));
  }

  /** Scroll to a chapter by array index or by id string. */
  goTo(indexOrId, behavior) {
    let i = indexOrId;
    if (typeof indexOrId === 'string') {
      i = this.chapters.findIndex((c) => c.id === indexOrId || c.scene === indexOrId);
    }
    if (i == null || i < 0) return false;
    const mode = behavior || (this.caps.reduced ? 'auto' : 'smooth');
    scrollTo({ top: this.offsetOf(i), behavior: mode });
    return true;
  }

  step(delta) {
    return this.goTo(clamp(this.chapterIndex + delta, 0, this.chapters.length - 1));
  }

  /**
   * Progress through the whole journey weighted by each chapter's span, used
   * by the strata rail so the layer thicknesses and the marker agree.
   */
  strataProgress() {
    const total = this.chapters.reduce((s, c) => s + (c.span || 1), 0);
    let acc = 0;
    for (let i = 0; i < this.chapterIndex; i++) acc += this.chapters[i].span || 1;
    acc += (this.chapters[this.chapterIndex].span || 1) * this.chapterLocal;
    return clamp(acc / total);
  }

  /** Blend factor from this chapter's own colour toward the next one. */
  colorMix() {
    return clamp(inv(0.72, 1, this.chapterLocal));
  }

  /** Approximate reading position for the readout bar. */
  readout() {
    return {
      index: this.chapterIndex,
      total: this.chapters.length,
      local: this.chapterLocal,
      chapter: this.chapter,
      color: `#${this.eraColor.getHexString()}`,
    };
  }
}

/** Chapter heights are authored by span, applied to the DOM at build time. */
export function chapterHeight(span, recruiter) {
  const base = recruiter ? 92 : 118;
  return `${Math.round(base * lerp(1, span, 0.85))}svh`;
}
