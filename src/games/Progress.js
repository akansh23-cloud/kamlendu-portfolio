import { GAME_ORDER, DISCIPLINE } from './registry.js';

const KEY = 'kk.operator.v1';

/**
 * Progress — the thread that makes the games part of the journey.
 *
 * Without this, six minigames are six distractions bolted onto a story. With
 * it, they accumulate into an operator record that the finale reads back, the
 * skill constellation lights up in proportion to, and the contact chapter
 * reports. Scrolling past an era you have completed feels different from
 * scrolling past one you have not, and that is the entire point.
 *
 * It is deliberately worthless as a gate: nothing anywhere in this site is
 * locked behind a game, no chapter requires one, and a visitor who plays none
 * of them sees the complete story. The record is a reward for engaging, not a
 * toll for arriving.
 *
 * Stored in localStorage, which fails silently in private browsing. That is
 * fine — the site simply forgets you, which is the correct failure mode for
 * something this unimportant.
 */
export class Progress {
  constructor() {
    this.data = { games: {}, version: 1 };
    this.load();
    this.listeners = new Set();
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.games) this.data = parsed;
      }
    } catch { /* private mode, corrupt value — start fresh */ }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch { /* ignore */ }
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit() {
    for (const fn of this.listeners) {
      try { fn(this); } catch { /* a listener must never break the record */ }
    }
  }

  get(id) {
    return this.data.games[id] || null;
  }

  /** Only ever improves a record; a bad run never takes a rank away. */
  record(id, { score, rank, outcome, summary }) {
    const prev = this.data.games[id];
    const best = Math.max(prev?.score || 0, Math.round(score));
    const improved = !prev || best > (prev.score || 0);

    this.data.games[id] = {
      score: best,
      rank: improved ? rank : prev.rank,
      outcome: improved ? outcome : prev.outcome,
      summary: improved ? summary : prev.summary,
      plays: (prev?.plays || 0) + 1,
      at: Date.now(),
    };
    this.save();
    this._emit();
    return { improved, best };
  }

  /** 0…1 — how much of the operator record has been filled in. */
  completion() {
    const played = GAME_ORDER.filter((id) => this.data.games[id]).length;
    return played / GAME_ORDER.length;
  }

  playedCount() {
    return GAME_ORDER.filter((id) => this.data.games[id]).length;
  }

  totalScore() {
    return GAME_ORDER.reduce((s, id) => s + (this.data.games[id]?.score || 0), 0);
  }

  /**
   * The overall standing shown in the finale. Deliberately conservative: you
   * cannot be an ARCHITECT on the strength of one good run at one discipline.
   */
  standing() {
    const played = this.playedCount();
    if (played === 0) return null;
    const order = ['TRAINEE', 'OPERATOR', 'ENGINEER', 'ARCHITECT'];
    const scores = GAME_ORDER
      .map((id) => this.data.games[id])
      .filter(Boolean)
      .map((g) => order.indexOf(g.rank));
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const coverage = played / GAME_ORDER.length;
    const idx = Math.floor(avg * coverage);
    return {
      title: order[Math.max(0, Math.min(order.length - 1, idx))],
      played,
      total: GAME_ORDER.length,
      score: this.totalScore(),
    };
  }

  /** Rows for the operator record table in the finale chapter. */
  rows() {
    return GAME_ORDER.map((id) => {
      const g = this.data.games[id];
      return {
        id,
        discipline: DISCIPLINE[id],
        played: !!g,
        rank: g?.rank || '—',
        score: g?.score || 0,
      };
    });
  }

  reset() {
    this.data = { games: {}, version: 1 };
    this.save();
    this._emit();
  }
}
