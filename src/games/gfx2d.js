/**
 * gfx2d.js — the drawing vocabulary the six games share.
 *
 * Everything here takes the era's theme, so a game does not choose a single
 * colour anywhere in its own code. Play the punch-card game and the panel is
 * burnt orange; play the lakehouse one and the same panel is violet, because
 * the theme is handed down from the chapter you opened it from. That is what
 * keeps six different mechanics feeling like six instruments on one machine
 * rather than six different websites.
 */

export const MONO = '"IBM Plex Mono", ui-monospace, monospace';

export function font(size, weight = 500) {
  return `${weight} ${size}px ${MONO}`;
}

export function rr(g, x, y, w, h, r = 4) {
  const k = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + k, y);
  g.arcTo(x + w, y, x + w, y + h, k);
  g.arcTo(x + w, y + h, x, y + h, k);
  g.arcTo(x, y + h, x, y, k);
  g.arcTo(x, y, x + w, y, k);
  g.closePath();
}

/** The base surface: a dark instrument plate with a hairline edge. */
export function panel(g, t, x, y, w, h, opts = {}) {
  const {
    fill = 'rgba(255,255,255,0.022)',
    stroke = t.line,
    radius = 5,
    accent = false,
    glowAmt = 0,
  } = opts;

  g.save();
  if (glowAmt > 0) {
    g.shadowColor = t.era;
    g.shadowBlur = 22 * glowAmt;
  }
  rr(g, x, y, w, h, radius);
  g.fillStyle = fill;
  g.fill();
  g.shadowBlur = 0;
  g.lineWidth = 1;
  g.strokeStyle = accent ? t.era : stroke;
  g.stroke();
  g.restore();

  if (accent) {
    g.save();
    g.globalAlpha = 0.85;
    g.fillStyle = t.era;
    g.fillRect(x, y, w, 2);
    g.restore();
  }
}

export function label(g, t, text, x, y, opts = {}) {
  const {
    size = 10,
    weight = 500,
    color = t.dim,
    align = 'left',
    baseline = 'alphabetic',
    track = 0.12,
    alpha = 1,
  } = opts;

  g.save();
  g.globalAlpha = alpha;
  g.font = font(size, weight);
  g.fillStyle = color;
  g.textAlign = 'left';
  g.textBaseline = baseline;

  const str = String(text);
  const sp = size * track;
  let total = 0;
  for (const ch of str) total += g.measureText(ch).width + sp;
  total -= sp;

  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  for (const ch of str) {
    g.fillText(ch, cx, y);
    cx += g.measureText(ch).width + sp;
  }
  g.restore();
  return total;
}

/** Plain proportional-ish text for body copy, no letter tracking. */
export function text(g, t, str, x, y, opts = {}) {
  const { size = 11, weight = 400, color = t.dim, align = 'left', alpha = 1 } = opts;
  g.save();
  g.globalAlpha = alpha;
  g.font = font(size, weight);
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'alphabetic';
  g.fillText(str, x, y);
  g.restore();
}

/** A tappable control. Returns nothing; games register the zone separately. */
export function button(g, t, x, y, w, h, str, opts = {}) {
  const { active = false, disabled = false, danger = false, size = 10 } = opts;
  const tint = danger ? t.bad : t.era;

  g.save();
  rr(g, x, y, w, h, 4);
  g.fillStyle = disabled
    ? 'rgba(255,255,255,0.02)'
    : active
      ? tint
      : 'rgba(255,255,255,0.045)';
  g.fill();
  g.lineWidth = 1;
  g.strokeStyle = disabled ? t.line : tint;
  g.globalAlpha = disabled ? 0.35 : 1;
  g.stroke();
  g.restore();

  label(g, t, str, x + w / 2, y + h / 2 + size * 0.36, {
    size,
    weight: 600,
    align: 'center',
    color: active ? '#05080c' : disabled ? t.dim : t.fg,
    alpha: disabled ? 0.5 : 1,
  });
}

/** Horizontal gauge. `danger` flips it to the warning colour above `warnAt`. */
export function bar(g, t, x, y, w, h, v, opts = {}) {
  const { color = t.era, back = 'rgba(255,255,255,0.07)', warnAt = 2, radius = 2 } = opts;
  rr(g, x, y, w, h, radius);
  g.fillStyle = back;
  g.fill();
  const f = Math.max(0, Math.min(1, v));
  if (f > 0.001) {
    rr(g, x, y, Math.max(2, w * f), h, radius);
    g.fillStyle = v >= warnAt ? t.bad : color;
    g.fill();
  }
}

/** A soft additive bloom, used sparingly — it is the only "effect" in here. */
export function glow(g, t, x, y, r, color = t.era, alpha = 0.4) {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, hexA(color, alpha));
  grad.addColorStop(1, hexA(color, 0));
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = grad;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
}

export function hexA(hex, a) {
  const h = String(hex).replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(n.slice(0, 2), 16);
  const gg = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${gg}, ${b}, ${a})`;
}

/** Faint reference grid. Gives the games a sense of being instrument surfaces. */
export function grid(g, t, x, y, w, h, step = 40, alpha = 0.05) {
  g.save();
  g.globalAlpha = alpha;
  g.strokeStyle = t.fg;
  g.lineWidth = 1;
  g.beginPath();
  for (let gx = x; gx <= x + w; gx += step) {
    g.moveTo(Math.round(gx) + 0.5, y);
    g.lineTo(Math.round(gx) + 0.5, y + h);
  }
  for (let gy = y; gy <= y + h; gy += step) {
    g.moveTo(x, Math.round(gy) + 0.5);
    g.lineTo(x + w, Math.round(gy) + 0.5);
  }
  g.stroke();
  g.restore();
}

/** Dashed connector used by the resolve and shard games. */
export function link(g, color, x1, y1, x2, y2, opts = {}) {
  const { width = 2, dash = null, alpha = 1 } = opts;
  g.save();
  g.globalAlpha = alpha;
  g.strokeStyle = color;
  g.lineWidth = width;
  if (dash) g.setLineDash(dash);
  g.beginPath();
  g.moveTo(x1, y1);
  const mx = (x1 + x2) / 2;
  g.bezierCurveTo(mx, y1, mx, y2, x2, y2);
  g.stroke();
  g.restore();
}
