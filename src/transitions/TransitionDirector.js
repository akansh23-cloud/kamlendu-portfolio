import { clamp, smoothstep, lerp } from '../lib/math.js';

/**
 * TransitionDirector — the thirteen morphs, in one place.
 *
 * The brief lists a specific handoff between every pair of eras: ink becomes
 * archive, documents become punch cards, a punched hole becomes a reel, ribbon
 * becomes floppy, and so on. Two things make those handoffs work, and neither
 * of them is a fade to black:
 *
 *   1. Both scenes are authored at the world origin. Only one or two are ever
 *      visible, so an object leaving the outgoing scene and an object arriving
 *      in the incoming one occupy the same space on screen at the same moment.
 *      That is what turns a cross-dissolve into a morph.
 *
 *   2. Every scene's own exit is choreographed to *become* the next scene's
 *      entrance — the ink strokes lift as particles, the archive cards flatten,
 *      the reel's outline squares off toward a floppy. This director does not
 *      invent the morph; it controls the window in which the two halves of an
 *      already-authored morph overlap.
 *
 * Per-pair tuning lives in MORPHS. A punched hole becoming a tape reel is a
 * hard cut through a light source and wants a short, bright window; racks
 * becoming cluster topology is a re-reading of the same objects and wants a
 * long, soft one.
 */

const DEFAULT = { width: 0.16, veil: 0.35, curve: 'smooth', shake: 0 };

/**
 * width — share of a chapter's scroll spent overlapping the next scene
 * veil   — peak strength of the tinted bloom over the cut
 * curve  — 'smooth' | 'snap' (snap holds the outgoing scene, then swaps late)
 */
const MORPHS = {
  'writtenMemory>archive': { width: 0.18, veil: 0.3, note: 'ink strokes rise and become the archive\u2019s index cards' },
  'archive>punchCard': { width: 0.16, veil: 0.34, note: 'flattened records square off into perforated stock' },
  'punchCard>tape': { width: 0.13, veil: 0.62, curve: 'snap', note: 'the camera exits through a punched hole into the reel' },
  'tape>digitalMedia': { width: 0.15, veil: 0.38, note: 'the ribbon\u2019s outline contracts into a floppy shell' },
  'digitalMedia>enterprise': { width: 0.15, veil: 0.36, note: 'the floppy\u2019s inner disk lies down as a platter' },
  'enterprise>hadoop': { width: 0.2, veil: 0.26, note: 'the rack aisle is re-read as cluster topology' },
  'hadoop>cloud': { width: 0.18, veil: 0.42, note: 'nodes let go of the floor and the room dissolves' },
  'cloud>lakehouse': { width: 0.16, veil: 0.4, note: 'drifting objects crystallise into table structure' },
  'lakehouse>streaming': { width: 0.15, veil: 0.44, note: 'compacted fragments break into moving packets' },
  'streaming>choron': { width: 0.14, veil: 0.5, shake: 0.05, note: 'the pipeline curls into a closed lattice' },
  'choron>governance': { width: 0.16, veil: 0.4, note: 'the lattice resolves into identity and boundary' },
  'governance>profile': { width: 0.18, veil: 0.3, note: 'the governed record becomes the engineer\u2019s toolkit' },
};

export class TransitionDirector {
  constructor(veilEl, caps) {
    this.veilEl = veilEl;
    this.caps = caps;
    this.active = null;
    this.progress = 0;
    this._veil = 0;
  }

  /** Look up the authored morph between two scene keys. */
  morphFor(fromKey, toKey) {
    if (!fromKey || !toKey || fromKey === toKey) return null;
    return { ...DEFAULT, ...(MORPHS[`${fromKey}>${toKey}`] || {}) };
  }

  /**
   * Given the current chapter's local progress and the pair of scenes either
   * side of the cut, returns how much of the incoming scene should be showing.
   * 0 means "outgoing only"; 1 means "the swap is complete".
   */
  blend(localTail, morph) {
    if (!morph) return 0;
    const raw = clamp(localTail / morph.width);
    if (morph.curve === 'snap') {
      // Hold, then move fast. Reads as a cut with a wipe rather than a fade.
      return smoothstep(clamp((raw - 0.55) / 0.45));
    }
    return smoothstep(raw);
  }

  /**
   * Drives the DOM veil. The veil is tinted by the CSS `--era` variable, which
   * the timeline is already blending between the two eras' colours, so the
   * bloom over a cut is literally the mix of the two periods of history.
   */
  update(blendAmount, morph, dt, rig) {
    const want = morph ? Math.sin(clamp(blendAmount) * Math.PI) * morph.veil : 0;
    const scale = this.caps.reduced ? 0.3 : 1;
    this._veil += (want * scale - this._veil) * Math.min(1, dt * 9);
    if (this.veilEl) this.veilEl.style.opacity = this._veil.toFixed(3);

    if (morph?.shake && rig && !this.caps.reduced) {
      const peak = Math.sin(clamp(blendAmount) * Math.PI);
      if (peak > 0.2) rig.addShake(morph.shake * peak * dt * 6);
    }
  }

  /**
   * Exposure lift across a cut. A small, brief brightening sells a morph far
   * better than a longer dissolve does, and it costs nothing.
   */
  exposure(blendAmount, morph) {
    if (!morph) return 1;
    return 1 + Math.sin(clamp(blendAmount) * Math.PI) * morph.veil * 0.22;
  }

  /** Used by the diagnostics overlay so a developer can see what is authored. */
  describe(fromKey, toKey) {
    const m = this.morphFor(fromKey, toKey);
    return m?.note || '—';
  }

  /** Lighting blend factor. Lights lead the geometry slightly — the room
   *  changes colour just before its contents do, which reads as anticipation. */
  lightBlend(blendAmount, morph) {
    if (!morph) return 0;
    return clamp(lerp(blendAmount, smoothstep(clamp(blendAmount * 1.35)), 0.7));
  }
}
