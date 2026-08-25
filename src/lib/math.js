/** Small maths kit. Everything here is frame-rate independent where it matters. */

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, v) => (b - a === 0 ? 0 : (v - a) / (b - a));
export const mapRange = (v, a, b, c, d) => lerp(c, d, clamp(inv(a, b, v)));

export const smoothstep = (t) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};

export const smootherstep = (t) => {
  t = clamp(t);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t) => clamp(t) * clamp(t) * clamp(t);

/** Exponential smoothing that behaves identically at 30fps and 144fps. */
export const damp = (current, target, lambda, dt) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

/** A window: 0 outside [a,b], eased 0→1→0 inside, peaking at the centre. */
export const pulseWindow = (v, a, b) => {
  if (v <= a || v >= b) return 0;
  const t = inv(a, b, v);
  return Math.sin(t * Math.PI);
};

/** Eased ramp between two thresholds. */
export const ramp = (v, a, b) => smoothstep(inv(a, b, v));

/** Deterministic pseudo-random — same layout on every load and every device. */
export const rng = (seed = 1) => {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
};

export const TAU = Math.PI * 2;
