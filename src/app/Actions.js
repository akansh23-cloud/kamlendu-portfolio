/**
 * Actions — the five era interactions, in one small object.
 *
 * Scenes read these two ways and both are supported deliberately:
 *
 *   actions.migrate      a plain boolean, true for the length of the action's
 *                        hold window. Scenes that accumulate progress (the
 *                        migration, the compaction) integrate against it, which
 *                        means a second press resumes rather than restarts.
 *
 *   actions.seq.burst    a counter that increments once per trigger, for the
 *                        scenes that need a true edge — an event burst is an
 *                        event, not a state, and holding a boolean for it would
 *                        make repeated presses do nothing.
 *
 * Hold windows are tuned per action so that one press produces one complete
 * gesture in the scene: long enough for the migration to actually finish,
 * short enough that a burst reads as a spike rather than a new baseline.
 */

const HOLD = {
  migrate: 3.6,   // scene integrates at ~0.42/s → one press completes the move
  compact: 2.8,   // scene integrates at ~0.50/s
  burst: 1.1,     // a spike, then decay
  pulse: 1.0,     // one resonance through the lattice
  tokenise: 2.6,  // scene integrates at ~0.45–0.55/s
};

export class Actions {
  constructor({ onFire } = {}) {
    this.onFire = onFire;
    this.seq = {};
    this._until = {};
    this._t = 0;

    for (const id of Object.keys(HOLD)) {
      this[id] = false;
      this.seq[id] = 0;
      this._until[id] = -1;
    }
  }

  trigger(id) {
    if (!(id in HOLD)) return false;
    this._until[id] = this._t + HOLD[id];
    this.seq[id]++;
    this[id] = true;
    this.onFire?.(id);
    return true;
  }

  update(dt) {
    this._t += dt;
    for (const id of Object.keys(HOLD)) {
      if (this[id] && this._t > this._until[id]) this[id] = false;
    }
  }

  /** How far through its hold window an action is, for UI feedback. */
  progress(id) {
    if (!this[id]) return 0;
    const remaining = this._until[id] - this._t;
    return Math.max(0, Math.min(1, 1 - remaining / HOLD[id]));
  }
}
