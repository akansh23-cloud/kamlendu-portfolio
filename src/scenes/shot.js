import { clamp, smoothstep, inv, lerp } from '../lib/math.js';

/**
 * shot.js — scenes describe camera moves as keyframes, not as maths.
 *
 * A shot is a list of poses pinned to points in the scene's local timeline.
 * Interpolation is eased by default, which is what turns a scroll position into
 * a dolly rather than a slider. Scroll is always the clock (section 44); this
 * file just decides what the clock is pointing at.
 */

function pair(keys, local) {
  const t = clamp(local);
  if (t <= keys[0].at) return [keys[0], keys[0], 0];
  const last = keys[keys.length - 1];
  if (t >= last.at) return [last, last, 0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t >= a.at && t <= b.at) {
      const raw = inv(a.at, b.at, t);
      return [a, b, b.linear ? raw : smoothstep(raw)];
    }
  }
  return [last, last, 0];
}

/** Writes an interpolated camera pose into `out` (a CamState). */
export function shot(keys, local, out) {
  const [a, b, k] = pair(keys, local);
  out.set(
    lerp(a.pos[0], b.pos[0], k),
    lerp(a.pos[1], b.pos[1], k),
    lerp(a.pos[2], b.pos[2], k),
    lerp(a.target[0], b.target[0], k),
    lerp(a.target[1], b.target[1], k),
    lerp(a.target[2], b.target[2], k),
    lerp(a.fov ?? 42, b.fov ?? 42, k),
    lerp(a.roll ?? 0, b.roll ?? 0, k)
  );
  return out;
}

/** Interpolated position + facing for the character along a walked path. */
export function pathAt(keys, local) {
  const [a, b, k] = pair(keys, local);
  return {
    x: lerp(a.pos[0], b.pos[0], k),
    y: lerp(a.pos[1] ?? 0, b.pos[1] ?? 0, k),
    z: lerp(a.pos[2], b.pos[2], k),
    ry: lerpAngle(a.ry ?? 0, b.ry ?? 0, k),
  };
}

export function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** Interpolates any single named numeric field across keyframes. */
export function valueAt(keys, local, field = 'v') {
  const [a, b, k] = pair(keys, local);
  return lerp(a[field] ?? 0, b[field] ?? 0, k);
}
