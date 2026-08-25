import { TAU, clamp } from '../lib/math.js';
import { resetPose } from './pose.js';

/**
 * clips.js — the character's whole movement vocabulary.
 *
 * Convention: the rig faces +Z. A limb hangs down −Y from its joint, so a
 * positive X rotation swings it backwards and a negative X rotation swings it
 * forwards. `s` is +1 for the left side and −1 for the right, so one expression
 * can drive both arms symmetrically.
 *
 * Clips never touch world position — that belongs to the scene. They only
 * describe how the body is arranged, which is what lets any clip play in any
 * era without a scene knowing anything about anatomy.
 */

const breathe = (p, t, depth = 1) => {
  const b = Math.sin(t * 0.95) * 0.5 + 0.5;
  p.breath = b * depth;
  p.j.chest.x += -0.014 * b * depth;
  p.j.spine.x += 0.008 * b * depth;
  p.j.neck.x += 0.006 * b * depth;
};

/** Standing. Never perfectly still — weight drifts and the chest moves. */
export function idle(p, ctx) {
  resetPose(p);
  const t = ctx.t;
  const shift = Math.sin(t * 0.33);
  const drift = Math.sin(t * 0.21 + 1.4);

  p.sway = shift * 0.014;
  p.j.hips.y = shift * 0.035;
  p.j.hips.z = shift * 0.025;
  p.j.chest.y = -shift * 0.05;
  p.j.head.y = drift * 0.14;
  p.j.head.x = drift * 0.03;

  for (const s of [1, -1]) {
    const side = s > 0 ? 'L' : 'R';
    p.j[`shoulder${side}`].z = s * (0.10 + shift * 0.008 * s);
    p.j[`shoulder${side}`].x = 0.04 + drift * 0.02;
    p.j[`elbow${side}`].x = -0.22 - Math.abs(shift) * 0.05;
    p.j[`wrist${side}`].x = -0.08;
  }

  // The standing leg locks, the other stays soft.
  p.j.kneeL.x = 0.05 + Math.max(0, shift) * 0.12;
  p.j.kneeR.x = 0.05 + Math.max(0, -shift) * 0.12;
  p.j.thighL.x = shift * 0.03;
  p.j.thighR.x = -shift * 0.03;

  breathe(p, t, 1);
  return p;
}

/**
 * Walk. Amplitude scales with `ctx.amp` so the same cycle covers a relaxed
 * stroll through an archive and a deliberate stride through a transition.
 */
export function walk(p, ctx) {
  resetPose(p);
  const f = ctx.phase * TAU;
  const amp = ctx.amp ?? 1;
  const t = ctx.t;

  const swing = Math.sin(f);
  const swingB = Math.sin(f + Math.PI);

  p.j.thighL.x = -swing * 0.46 * amp;
  p.j.thighR.x = -swingB * 0.46 * amp;
  p.j.thighL.z = 0.03;
  p.j.thighR.z = -0.03;

  // Knees flex through the swing phase only — they never hyperextend.
  p.j.kneeL.x = 0.1 + Math.pow(clamp(Math.sin(f + 0.95)), 1.4) * 0.86 * amp;
  p.j.kneeR.x = 0.1 + Math.pow(clamp(Math.sin(f + 0.95 + Math.PI)), 1.4) * 0.86 * amp;

  p.j.ankleL.x = -0.12 - Math.sin(f + 0.4) * 0.2 * amp;
  p.j.ankleR.x = -0.12 - Math.sin(f + 0.4 + Math.PI) * 0.2 * amp;

  // Arms counter-swing against the legs.
  p.j.shoulderL.x = swing * 0.4 * amp;
  p.j.shoulderR.x = swingB * 0.4 * amp;
  p.j.shoulderL.z = 0.1;
  p.j.shoulderR.z = -0.1;
  p.j.elbowL.x = -0.3 - clamp(swing) * 0.3;
  p.j.elbowR.x = -0.3 - clamp(swingB) * 0.3;

  // Pelvis and ribcage rotate against each other — the detail that stops a
  // walk cycle reading as a puppet on rails.
  p.j.hips.y = swing * 0.1 * amp;
  p.j.chest.y = -swing * 0.14 * amp;
  p.j.hips.z = -swing * 0.04;
  p.j.chest.x = -0.07 * amp;
  p.j.neck.x = 0.04;
  p.j.head.y = -swing * 0.03;

  p.bobY = -0.03 * (1 - Math.cos(2 * f)) * 0.5 * amp;
  p.sway = swing * 0.018 * amp;
  p.lean = -0.03 * amp;

  breathe(p, t, 0.6);
  return p;
}

/**
 * Write. The origin of the entire portfolio, so it gets the most care: the body
 * leans over the desk, the head follows the nib, and the writing hand sweeps
 * across the page and returns at the end of each line.
 */
export function write(p, ctx) {
  resetPose(p);
  const t = ctx.t;
  const line = ctx.param ?? 0; // 0 → 1 across the page
  const across = (line % 1);
  const scratch = Math.sin(t * 13) * 0.012;

  p.j.hips.x = -0.1;
  p.j.spine.x = -0.14;
  p.j.chest.x = -0.2;
  p.j.chest.y = -0.16;
  p.j.neck.x = -0.24;
  p.j.head.x = -0.12;
  p.j.head.y = -0.1 + across * 0.12;

  // Writing arm.
  p.j.shoulderR.x = -0.98 + across * 0.06;
  p.j.shoulderR.z = -0.26;
  p.j.shoulderR.y = -0.34 + across * 0.5;
  p.j.elbowR.x = -0.92 - across * 0.14 + scratch;
  p.j.elbowR.y = 0.16;
  p.j.wristR.x = -0.22 + scratch * 2;
  p.j.wristR.z = -0.3;

  // Steadying arm, flat on the desk.
  p.j.shoulderL.x = -0.78;
  p.j.shoulderL.z = 0.3;
  p.j.shoulderL.y = 0.3;
  p.j.elbowL.x = -0.86;
  p.j.wristL.x = -0.2;

  p.j.thighL.x = 0.08;
  p.j.thighR.x = -0.08;
  p.j.kneeL.x = 0.08;
  p.j.kneeR.x = 0.12;
  p.lean = -0.06;

  breathe(p, t, 0.5);
  return p;
}

/** Standing and taking something in. Weight on one leg, one arm loosely folded. */
export function observe(p, ctx) {
  resetPose(p);
  const t = ctx.t;
  const drift = Math.sin(t * 0.26);

  p.j.hips.z = 0.05;
  p.j.hips.y = 0.08;
  p.j.chest.y = -0.12;
  p.j.neck.x = 0.08;
  p.j.head.y = 0.1 + drift * 0.16;
  p.j.head.x = 0.04;

  p.j.thighL.x = 0.04;
  p.j.thighR.x = -0.06;
  p.j.kneeL.x = 0.06;
  p.j.kneeR.x = 0.2;
  p.j.ankleR.x = -0.08;

  p.j.shoulderL.z = 0.16;
  p.j.shoulderL.x = -0.3;
  p.j.elbowL.x = -0.95;
  p.j.wristL.x = -0.15;

  p.j.shoulderR.z = -0.12;
  p.j.shoulderR.x = 0.06;
  p.j.elbowR.x = -0.28;

  p.sway = 0.02 + drift * 0.008;
  breathe(p, t, 1);
  return p;
}

/** Head and chest open upward — used when the world gets suddenly larger. */
export function lookUp(p, ctx) {
  resetPose(p);
  const t = ctx.t;
  p.j.neck.x = 0.34;
  p.j.head.x = 0.16;
  p.j.chest.x = 0.12;
  p.j.spine.x = 0.06;
  p.j.hips.x = 0.03;

  p.j.shoulderL.z = 0.2;
  p.j.shoulderR.z = -0.2;
  p.j.shoulderL.x = 0.16;
  p.j.shoulderR.x = 0.16;
  p.j.elbowL.x = -0.2;
  p.j.elbowR.x = -0.2;

  p.j.kneeL.x = 0.06;
  p.j.kneeR.x = 0.06;
  p.sway = Math.sin(t * 0.3) * 0.012;
  breathe(p, t, 1.1);
  return p;
}

/** Right arm out toward something the scene has placed in front of the body. */
export function reach(p, ctx) {
  resetPose(p);
  const t = ctx.t;
  const ext = ctx.param ?? 1;

  p.j.chest.y = -0.2 * ext;
  p.j.chest.x = -0.05;
  p.j.neck.y = 0.12 * ext;
  p.j.head.y = 0.08 * ext;

  p.j.shoulderR.x = -1.2 * ext;
  p.j.shoulderR.z = -0.18;
  p.j.elbowR.x = -0.3 + 0.1 * ext;
  p.j.wristR.x = -0.1;

  p.j.shoulderL.z = 0.14;
  p.j.shoulderL.x = 0.22;
  p.j.elbowL.x = -0.34;

  p.j.thighR.x = -0.1 * ext;
  p.j.kneeR.x = 0.14;
  p.j.kneeL.x = 0.08;
  p.lean = -0.04 * ext;

  breathe(p, t, 0.7);
  return p;
}

/** Hand held against a surface — a card slot, a console, a core. */
export function activate(p, ctx) {
  resetPose(p);
  const t = ctx.t;
  const press = Math.sin(t * 1.8) * 0.045;

  p.j.chest.y = -0.24;
  p.j.chest.x = -0.06;
  p.j.neck.y = 0.14;
  p.j.head.x = -0.04;

  p.j.shoulderR.x = -1.38 + press;
  p.j.shoulderR.z = -0.14;
  p.j.shoulderR.y = -0.12;
  p.j.elbowR.x = -0.42 - press;
  p.j.wristR.x = 0.12;

  p.j.shoulderL.z = 0.12;
  p.j.shoulderL.x = 0.1;
  p.j.elbowL.x = -0.42;

  p.j.thighL.x = 0.06;
  p.j.kneeL.x = 0.1;
  p.j.kneeR.x = 0.16;
  p.lean = -0.03;

  breathe(p, t, 0.6);
  return p;
}

export const CLIPS = { idle, walk, write, observe, lookUp, reach, activate };
