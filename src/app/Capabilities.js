/**
 * Capabilities — decides what this device is allowed to render.
 *
 * The rule from the brief (section 26): mobile is a first-class platform, not a
 * shrunken desktop. Quality drops, but the character and the primary geometry
 * of every era survive on every tier. Nothing is ever silently replaced by text.
 */

export function detectWebGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) return { ok: false, version: 0 };
    const version = c.getContext('webgl2') ? 2 : 1;
    return { ok: true, version };
  } catch {
    return { ok: false, version: 0 };
  }
}

export function createCapabilities() {
  const gl = detectWebGL();
  const coarse = matchMedia('(pointer: coarse)').matches;
  const narrow = innerWidth < 860;
  const mobile = coarse && narrow;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const mem = navigator.deviceMemory || (mobile ? 4 : 8);
  const cores = navigator.hardwareConcurrency || (mobile ? 4 : 8);

  let tier = 'high';
  if (mobile) tier = mem <= 3 || cores <= 4 ? 'low' : 'mid';
  else if (mem <= 4 || cores <= 4) tier = 'mid';
  if (gl.version === 1) tier = tier === 'high' ? 'mid' : 'low';

  const caps = {
    webgl: gl.ok,
    webglVersion: gl.version,
    mobile,
    narrow,
    reduced,
    tier,
    /** Multiplier applied to every particle and instance count in every scene. */
    density: tier === 'high' ? 1 : tier === 'mid' ? 0.55 : 0.32,
    /** Real shadow maps only where there is headroom for them. */
    shadows: tier === 'high' && !reduced,
    /** Extra dynamic lights a scene may add on top of the shared era rig. */
    lightBudget: tier === 'high' ? 4 : tier === 'mid' ? 2 : 1,
    /** Geometry subdivision multiplier. */
    detail: tier === 'high' ? 1 : tier === 'mid' ? 0.7 : 0.5,
    dpr: 1,
    maxDpr: 1,
    battery: null,
  };

  caps.maxDpr = tier === 'high' ? 2 : tier === 'mid' ? 1.6 : 1.25;
  caps.dpr = Math.min(devicePixelRatio || 1, caps.maxDpr);

  // Battery is advisory only — a low battery quietly costs you resolution and
  // some particles, never the scene itself.
  if (navigator.getBattery) {
    navigator.getBattery().then((b) => {
      caps.battery = b.level;
      const apply = () => {
        if (b.level < 0.2 && !b.charging) {
          caps.maxDpr = Math.min(caps.maxDpr, 1.15);
          caps.density *= 0.65;
          caps.onDowngrade?.('battery');
        }
      };
      apply();
      b.addEventListener('levelchange', apply);
      b.addEventListener('chargingchange', apply);
    }).catch(() => {});
  }

  // A device can rotate from phone-narrow to tablet-wide; recompute the parts
  // that depend on viewport without ever upgrading the tier mid-session.
  addEventListener('resize', () => {
    caps.narrow = innerWidth < 860;
    caps.mobile = coarse && caps.narrow;
  }, { passive: true });

  return caps;
}

/**
 * Watches frame cost and walks the device pixel ratio down when a device cannot
 * hold the target. Recovers slowly once there is headroom again, so a single
 * expensive transition does not permanently degrade the page.
 */
export class AdaptiveQuality {
  constructor(caps, onChange) {
    this.caps = caps;
    this.onChange = onChange;
    this.samples = [];
    this.cooldown = 2;
    this.floor = caps.mobile ? 0.75 : 1;
  }

  update(dt) {
    if (this.cooldown > 0) {
      this.cooldown -= dt;
      return;
    }
    this.samples.push(dt);
    if (this.samples.length < 60) return;

    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    this.samples.length = 0;
    const fps = 1 / avg;

    if (fps < 42 && this.caps.dpr > this.floor) {
      this.caps.dpr = Math.max(this.floor, this.caps.dpr - 0.2);
      this.onChange?.(this.caps.dpr, fps);
      this.cooldown = 2.5;
    } else if (fps > 57 && this.caps.dpr < this.caps.maxDpr) {
      this.caps.dpr = Math.min(this.caps.maxDpr, this.caps.dpr + 0.1);
      this.onChange?.(this.caps.dpr, fps);
      this.cooldown = 4;
    }
  }
}
