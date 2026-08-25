import { clamp, rng, lerp } from '../lib/math.js';

/**
 * MiniGame — the contract every era game implements.
 *
 * Design rules these games are held to, because a portfolio full of bad
 * minigames is worse than a portfolio with none:
 *
 *   1. NO QUIZZES. Not one multiple-choice question anywhere. Every game is a
 *      mechanic you operate under pressure, and the data-engineering concept is
 *      something you feel through the mechanic rather than something you get
 *      asked about. If a game could be replaced by a form, it was cut.
 *
 *   2. THE CONCEPT IS THE DIFFICULTY. Sequential access is hard because the
 *      head has to travel. Bin-packing is hard because sealing early wastes
 *      space and sealing late costs queries. Nothing is made difficult by
 *      arbitrary timers laid on top of an easy task.
 *
 *   3. TAP-ONLY IS ALWAYS ENOUGH. No game requires a drag, a hover, a
 *      right-click or a keyboard. Every one is fully playable with single taps,
 *      because half the people who see this will be on a phone.
 *
 *   4. LOSING IS INFORMATIVE. Every result screen says what actually went
 *      wrong in the language of the era — cards misread, records expired,
 *      blocks lost, lag unbounded — not just a number.
 *
 * Layout is written in fractions of a virtual stage whose aspect follows the
 * container, so the same code lays out on a 1400px desktop panel and a 390px
 * phone without either being a squashed version of the other.
 */
export class MiniGame {
  /** Overridden as static fields by each game. */
  static id = 'game';
  static title = 'GAME';
  static chapter = '';
  static objective = '';
  static hint = '';
  static duration = 60;
  static ranks = [0, 1, 2, 3];

  constructor(ctx) {
    this.ctx = ctx;
    this.caps = ctx.caps;
    this.theme = ctx.theme;
    this.reduced = !!ctx.caps.reduced;
    this.rand = rng(ctx.seed || 1337);

    this.W = 1000;
    this.H = 620;
    this.portrait = false;

    this.score = 0;
    this.time = this.constructor.duration;
    this.over = false;
    this.outcome = 'complete';

    this.zones = [];
    this._pulse = 0;
    this.shake = 0;
    this.toasts = [];
  }

  // ------------------------------------------------------------- lifecycle

  /** Called once the stage size is known, and again on every resize. */
  resize(w, h) {
    this.W = w;
    this.H = h;
    this.portrait = h > w * 1.05;
    this.layout();
  }

  layout() {}
  start() {}
  update(dt) {}
  draw(g) {}

  /** type: 'down' | 'move' | 'up'. Coordinates are already in stage space. */
  pointer(x, y, type) {}
  key(code, down) {}

  /** Meters shown in the footer. Kept in the DOM so they are readable text. */
  meters() {
    return [];
  }

  /** Lines shown on the result card. Say what happened, in the era's language. */
  summary() {
    return [];
  }

  // ---------------------------------------------------------------- helpers

  /**
   * Interactive regions are declared once per layout and hit-tested on tap.
   * Games never do their own coordinate maths, which is most of why each one
   * fits in a few hundred lines.
   */
  zone(id, x, y, w, h, data = null) {
    const z = { id, x, y, w, h, data };
    this.zones.push(z);
    return z;
  }

  clearZones() {
    this.zones.length = 0;
  }

  zoneAt(x, y) {
    // Last registered wins, so anything drawn on top is also hit first.
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return z;
    }
    return null;
  }

  /** Floating feedback text. The only place a game explains itself mid-play. */
  toast(text, x, y, kind = 'good') {
    this.toasts.push({ text, x, y, kind, life: 1 });
  }

  updateToasts(dt) {
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i];
      t.life -= dt * 1.3;
      t.y -= dt * 26;
      if (t.life <= 0) this.toasts.splice(i, 1);
    }
    this.shake = Math.max(0, this.shake - dt * 3);
    this._pulse += dt;
  }

  drawToasts(g) {
    for (const t of this.toasts) {
      g.save();
      g.globalAlpha = clamp(t.life) * 0.95;
      g.fillStyle =
        t.kind === 'bad' ? this.theme.bad : t.kind === 'warn' ? this.theme.warn : this.theme.era;
      g.font = '600 15px "IBM Plex Mono", monospace';
      g.textAlign = 'center';
      g.fillText(t.text, t.x, t.y);
      g.restore();
    }
  }

  /** Pace scaling. Reduced motion slows everything rather than removing it. */
  get pace() {
    return this.reduced ? 0.62 : 1;
  }

  bump(v = 0.6) {
    if (!this.reduced) this.shake = Math.min(1, this.shake + v);
  }

  finish(outcome = 'complete') {
    if (this.over) return;
    this.over = true;
    this.outcome = outcome;
  }

  /** TRAINEE / OPERATOR / ENGINEER / ARCHITECT, from the game's own thresholds. */
  rank() {
    const t = this.constructor.ranks;
    const names = ['TRAINEE', 'OPERATOR', 'ENGINEER', 'ARCHITECT'];
    let r = 0;
    for (let i = 0; i < t.length; i++) if (this.score >= t[i]) r = i;
    return names[Math.min(names.length - 1, r)];
  }

  lerp = lerp;
  clamp = clamp;
}
