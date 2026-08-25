import { MiniGame } from './MiniGame.js';
import { panel, label, text, bar, button, rr, glow, hexA } from './gfx2d.js';

/**
 * KEYPUNCH — the punch card era.
 *
 * This is real Hollerith encoding, not a decorative approximation. A letter is
 * two punches: a zone row (12, 11 or 0) and a digit row (1–9). A digit is one
 * punch. That is genuinely how an IBM card stored a character, and it is why
 * the card has exactly twelve rows.
 *
 * The mechanic is the job: a carriage advances across the card and you punch
 * the current column before it passes. Operators were speed-typists and the
 * skill was holding the encoding in your hands rather than reading it off the
 * chart every time — so the chart is always visible, and the pressure comes
 * entirely from the carriage.
 *
 * The payoff is the reader. At the end the card is fed through and you see what
 * the machine read back. Get a column wrong and the machine does not tell you
 * you were wrong; it just reads a different letter, and your name comes out as
 * something else. That is the whole point of the era in one animation.
 */

const ROWS = ['12', '11', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** zone row index, digit row index — the actual IBM 029 layout. */
function encode(ch) {
  const c = ch.toUpperCase();
  if (c === ' ') return [];
  const code = c.charCodeAt(0);
  if (code >= 48 && code <= 57) {
    // 0 punches row '0' (index 2); 1–9 punch their own row (index 3 + n - 1).
    const n = code - 48;
    return n === 0 ? [2] : [3 + n - 1];
  }
  if (code >= 65 && code <= 90) {
    const i = code - 65;
    if (i < 9) return [0, 3 + i];            // A–I : zone 12 + digits 1–9
    if (i < 18) return [1, 3 + (i - 9)];     // J–R : zone 11 + digits 1–9
    return [2, 3 + (i - 18) + 1];            // S–Z : zone  0 + digits 2–9
  }
  return [];
}

/** The inverse, so the reader can honestly read back whatever you punched. */
function decode(rows) {
  const set = [...new Set(rows)].sort((a, b) => a - b);
  if (!set.length) return ' ';
  const zones = set.filter((r) => r <= 2);
  const digits = set.filter((r) => r >= 3);
  if (zones.length === 0 && digits.length === 1) return String(digits[0] - 3 + 1);
  if (zones.length === 1 && digits.length === 0) return zones[0] === 2 ? '0' : '?';
  if (zones.length !== 1 || digits.length !== 1) return '\u2588'; // over-punched
  const d = digits[0] - 3 + 1;
  if (zones[0] === 0) return d <= 9 ? String.fromCharCode(65 + d - 1) : '?';
  if (zones[0] === 1) return d <= 9 ? String.fromCharCode(65 + 9 + d - 1) : '?';
  return d >= 2 && d <= 9 ? String.fromCharCode(65 + 18 + d - 2) : '?';
}

const PAYLOADS = ['CUSTOMER 360', 'BATCH 7 LOAD', 'LEDGER 1954', 'INDEX KEY 42', 'TAPE VOL 3'];

export class PunchGame extends MiniGame {
  static id = 'punch';
  static title = 'KEYPUNCH';
  static chapter = 'punch-cards';
  static objective =
    'Encode the payload onto the card before the carriage passes each column. A letter is a zone punch plus a digit punch — the chart is on the left and it never goes away.';
  static hint = 'Tap rows to punch · SPACE or ADVANCE to move on early';
  static duration = 0; // ends when the card is full
  static ranks = [0, 900, 1620, 2460];

  constructor(ctx) {
    super(ctx);
    this.payload = PAYLOADS[Math.floor(this.rand() * PAYLOADS.length)];
    this.cols = this.payload.length;
    this.punched = Array.from({ length: this.cols }, () => []);
    this.col = 0;
    this.colTime = 0;
    this.colLimit = 3.4;
    this.streak = 0;
    this.best = 0;
    this.correct = 0;
    this.phase = 'punch';
    this.readT = 0;
    this.readIndex = 0;
    this.flash = 0;
  }

  layout() {
    const pad = this.portrait ? 14 : 22;
    const chartW = this.portrait ? this.W : Math.min(210, this.W * 0.22);

    if (this.portrait) {
      // Stacked: the card takes the top, the chart becomes a horizontal strip.
      this.card = { x: pad, y: pad + 74, w: this.W - pad * 2, h: this.H * 0.5 };
      this.chart = { x: pad, y: this.card.y + this.card.h + 12, w: this.W - pad * 2, h: this.H - (this.card.y + this.card.h) - pad - 46 };
    } else {
      this.chart = { x: pad, y: pad + 62, w: chartW, h: this.H - pad * 2 - 62 };
      this.card = { x: this.chart.x + chartW + 18, y: pad + 62, w: this.W - chartW - pad * 2 - 18, h: this.H - pad * 2 - 110 };
    }

    this.rebuildZones();
  }

  rebuildZones() {
    this.clearZones();
    const c = this.card;
    const rowH = c.h / ROWS.length;
    const colW = c.w / this.cols;

    // Only the live column is tappable. Punching ahead of the carriage was not
    // a thing an operator could do, and allowing it would remove all pressure.
    for (let r = 0; r < ROWS.length; r++) {
      this.zone(`row-${r}`, c.x + this.col * colW, c.y + r * rowH, colW, rowH, { row: r });
    }
    // A generous tap strip so a thumb can hit a row on a phone.
    if (this.portrait) {
      for (let r = 0; r < ROWS.length; r++) {
        this.zone(`wide-${r}`, c.x, c.y + r * rowH, c.w, rowH, { row: r });
      }
    }

    const by = this.portrait ? this.H - 40 : c.y + c.h + 18;
    this.advanceBtn = { x: this.W - (this.portrait ? 14 : 22) - 150, y: by, w: 150, h: 30 };
    this.zone('advance', this.advanceBtn.x, this.advanceBtn.y, this.advanceBtn.w, this.advanceBtn.h);
  }

  start() {
    this.colTime = 0;
  }

  update(dt) {
    this.updateToasts(dt);
    this.flash = Math.max(0, this.flash - dt * 4);

    if (this.phase === 'punch') {
      this.colTime += dt * this.pace;
      // The carriage speeds up as the card fills — the card itself is the timer.
      const limit = this.colLimit * (1 - (this.col / this.cols) * 0.42);
      if (this.colTime >= limit) this.advance(true);
      return;
    }

    // ------------------------------------------------------------ the reader
    this.readT += dt * this.pace;
    const step = 0.34;
    if (this.readIndex < this.cols && this.readT > step) {
      this.readT = 0;
      this.readIndex++;
    }
    // The run ends on the game's own clock, never on a timer the loop cannot
    // see. A setTimeout here would work in a browser and hang any headless
    // harness — and a game that can only terminate via the event loop is one
    // that can be left hanging by a backgrounded tab.
    if (this.readIndex >= this.cols) {
      this.holdT = (this.holdT || 0) + dt;
      if (this.holdT > 0.9) this.finish(this.correct === this.cols ? 'perfect' : 'complete');
    }
  }

  advance(timedOut) {
    const want = encode(this.payload[this.col]);
    const got = this.punched[this.col];
    const same =
      want.length === got.length && want.every((r) => got.includes(r));

    const c = this.card;
    const colW = c.w / this.cols;
    const tx = c.x + (this.col + 0.5) * colW;

    if (same) {
      this.correct++;
      this.streak++;
      this.best = Math.max(this.best, this.streak);
      // Finishing a column early is the entire skill, so that is what pays.
      const limit = this.colLimit * (1 - (this.col / this.cols) * 0.42);
      const speed = this.clamp(1 - this.colTime / limit);
      const points = Math.round(80 + speed * 120 + Math.min(this.streak, 8) * 15);
      this.score += points;
      this.toast(`+${points}`, tx, c.y - 8, 'good');
    } else {
      this.streak = 0;
      this.toast(timedOut ? 'CARRIAGE PASSED' : 'MISPUNCH', tx, c.y - 8, 'bad');
      this.bump(0.5);
    }
    this.flash = 1;

    this.col++;
    if (this.col >= this.cols) {
      this.phase = 'read';
      this.readT = 0;
      this.readIndex = 0;
      this.clearZones();
      return;
    }
    this.colTime = 0;
    this.rebuildZones();
  }

  pointer(x, y, type) {
    if (type !== 'down' || this.phase !== 'punch') return;
    const z = this.zoneAt(x, y);
    if (!z) return;
    if (z.id === 'advance') { this.advance(false); return; }

    const row = z.data.row;
    const cur = this.punched[this.col];
    const i = cur.indexOf(row);
    // A punched hole cannot be un-punched on a real card, but a chad that has
    // not been committed can be — so the toggle only works before you advance.
    if (i >= 0) cur.splice(i, 1);
    else cur.push(row);
  }

  key(code, down) {
    if (!down || this.phase !== 'punch') return;
    if (code === 'Space' || code === 'Enter') this.advance(false);
  }

  meters() {
    const limit = this.colLimit * (1 - (this.col / this.cols) * 0.42);
    return [
      { label: 'CARRIAGE', value: this.phase === 'punch' ? 1 - this.colTime / limit : 1, danger: this.colTime / limit > 0.7 },
      { label: 'CARD', value: this.col / this.cols },
      { label: 'STREAK', value: Math.min(1, this.streak / 8), text: `${this.streak}` },
    ];
  }

  summary() {
    const readBack = this.punched.map((rows) => decode(rows)).join('');
    return [
      ['COLUMNS CORRECT', `${this.correct} / ${this.cols}`],
      ['LONGEST STREAK', `${this.best}`],
      ['PUNCHED', this.payload],
      ['MACHINE READ', readBack],
      this.correct === this.cols
        ? ['VERDICT', 'Card accepted']
        : ['VERDICT', 'Card rejected downstream'],
    ];
  }

  // -------------------------------------------------------------------- draw

  draw(g) {
    const t = this.theme;
    const pad = this.portrait ? 14 : 22;

    label(g, t, this.phase === 'punch' ? 'PUNCH THE PAYLOAD' : 'FEEDING THE READER', pad, pad + 20, {
      size: 12, weight: 600, color: t.era,
    });
    text(g, t, this.phase === 'punch'
      ? 'Zone punch + digit punch = one character'
      : 'The machine reads exactly what is on the card',
      pad, pad + 40, { size: 11, color: t.dim });

    this.drawChart(g);
    this.drawCard(g);

    if (this.phase === 'punch') {
      button(g, t, this.advanceBtn.x, this.advanceBtn.y, this.advanceBtn.w, this.advanceBtn.h, 'ADVANCE ▸');
    }

    this.drawToasts(g);
  }

  drawChart(g) {
    const t = this.theme;
    const c = this.chart;
    panel(g, t, c.x, c.y, c.w, c.h);

    if (this.portrait) {
      // Compact strip: only the three zone rows, which is the part people forget.
      label(g, t, 'ZONE', c.x + 12, c.y + 20, { size: 9, color: t.dim });
      const items = [['12', 'A–I'], ['11', 'J–R'], ['0', 'S–Z  ·  0']];
      items.forEach(([row, span], i) => {
        const x = c.x + 12 + i * ((c.w - 24) / 3);
        label(g, t, row, x, c.y + 42, { size: 15, weight: 600, color: t.era });
        label(g, t, span, x + 34, c.y + 42, { size: 11, color: t.fg });
      });
      label(g, t, 'THEN PUNCH THE DIGIT ROW FOR ITS POSITION IN THAT BLOCK', c.x + 12, c.y + 64, {
        size: 8, color: t.dim,
      });
      return;
    }

    label(g, t, 'ENCODING', c.x + 12, c.y + 22, { size: 10, weight: 600, color: t.era });
    const rows = [
      ['ROW 12', 'A B C D E F G H I'],
      ['ROW 11', 'J K L M N O P Q R'],
      ['ROW 0', 'S T U V W X Y Z'],
      ['', ''],
      ['DIGIT', 'position in the block'],
      ['', ''],
      ['0–9', 'single punch, own row'],
      ['SPACE', 'no punch at all'],
    ];
    rows.forEach(([k, v], i) => {
      const y = c.y + 48 + i * 22;
      if (!k) return;
      label(g, t, k, c.x + 12, y, { size: 9, weight: 600, color: t.era });
      text(g, t, v, c.x + 12, y + 13, { size: 10, color: t.fg });
    });

    // Live worked example for the character currently under the carriage.
    if (this.phase === 'punch') {
      const ch = this.payload[this.col];
      const want = encode(ch);
      const y = c.y + c.h - 54;
      g.save();
      g.globalAlpha = 0.6;
      g.strokeStyle = this.theme.line;
      g.beginPath();
      g.moveTo(c.x + 12, y - 16);
      g.lineTo(c.x + c.w - 12, y - 16);
      g.stroke();
      g.restore();
      label(g, t, 'THIS COLUMN', c.x + 12, y, { size: 9, color: t.dim });
      label(g, t, ch === ' ' ? '␣' : ch, c.x + 12, y + 26, { size: 22, weight: 600, color: t.fg });
      label(g, t, want.length ? want.map((r) => ROWS[r]).join(' + ') : 'NO PUNCH', c.x + 52, y + 26, {
        size: 12, weight: 600, color: t.era,
      });
    }
  }

  drawCard(g) {
    const t = this.theme;
    const c = this.card;
    const rowH = c.h / ROWS.length;
    const colW = c.w / this.cols;

    // The card stock itself.
    g.save();
    rr(g, c.x, c.y, c.w, c.h, 3);
    g.fillStyle = 'rgba(240, 230, 200, 0.06)';
    g.fill();
    g.strokeStyle = hexA(t.era, 0.45);
    g.lineWidth = 1;
    g.stroke();
    g.restore();

    // Row guides and labels.
    for (let r = 0; r < ROWS.length; r++) {
      const y = c.y + r * rowH;
      g.save();
      g.globalAlpha = 0.16;
      g.strokeStyle = t.fg;
      g.beginPath();
      g.moveTo(c.x, Math.round(y) + 0.5);
      g.lineTo(c.x + c.w, Math.round(y) + 0.5);
      g.stroke();
      g.restore();
      label(g, t, ROWS[r], c.x - 6, y + rowH / 2 + 4, { size: 9, align: 'right', color: t.dim });
    }

    const holeR = Math.min(colW * 0.24, rowH * 0.3, 8);

    for (let col = 0; col < this.cols; col++) {
      const x = c.x + col * colW;
      const done = col < this.col;
      const live = col === this.col && this.phase === 'punch';

      // Reader beam.
      if (this.phase === 'read' && col === this.readIndex) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = hexA(t.era, 0.22);
        g.fillRect(x, c.y, colW, c.h);
        g.restore();
      }

      if (live) {
        g.save();
        g.fillStyle = hexA(t.era, 0.1 + Math.sin(this._pulse * 6) * 0.04);
        g.fillRect(x, c.y, colW, c.h);
        g.strokeStyle = t.era;
        g.lineWidth = 2;
        g.strokeRect(Math.round(x) + 1, c.y, Math.round(colW) - 2, c.h);
        g.restore();
      }

      // The character label along the top of the column.
      const shown = this.phase === 'read' && col < this.readIndex
        ? decode(this.punched[col])
        : this.payload[col];
      const wrongOnRead =
        this.phase === 'read' && col < this.readIndex && shown !== this.payload[col].toUpperCase();
      label(g, t, shown === ' ' ? '␣' : shown, x + colW / 2, c.y - 10, {
        size: 12,
        weight: 600,
        align: 'center',
        color: wrongOnRead ? t.bad : live ? t.era : done ? t.fg : t.dim,
        alpha: done || live || this.phase === 'read' ? 1 : 0.5,
      });

      // Punched holes.
      for (const r of this.punched[col]) {
        const cy = c.y + r * rowH + rowH / 2;
        const cx = x + colW / 2;
        g.save();
        g.fillStyle = '#05070a';
        rr(g, cx - holeR, cy - holeR * 1.15, holeR * 2, holeR * 2.3, holeR * 0.6);
        g.fill();
        g.strokeStyle = hexA(t.era, 0.7);
        g.lineWidth = 1;
        g.stroke();
        g.restore();
      }

      // Chad guides on the live column so a phone user can see where to tap.
      if (live) {
        for (let r = 0; r < ROWS.length; r++) {
          if (this.punched[col].includes(r)) continue;
          const cy = c.y + r * rowH + rowH / 2;
          g.save();
          g.globalAlpha = 0.25;
          g.strokeStyle = t.fg;
          g.setLineDash([2, 3]);
          rr(g, x + colW / 2 - holeR, cy - holeR * 1.15, holeR * 2, holeR * 2.3, holeR * 0.6);
          g.stroke();
          g.restore();
        }
      }
    }

    // Carriage position indicator.
    if (this.phase === 'punch') {
      const limit = this.colLimit * (1 - (this.col / this.cols) * 0.42);
      const p = this.clamp(this.colTime / limit);
      const x = c.x + this.col * colW;
      bar(g, t, x, c.y + c.h + 6, colW, 3, 1 - p, { warnAt: p > 0.75 ? -1 : 2 });
      if (p > 0.8) glow(g, t, x + colW / 2, c.y + c.h / 2, colW * 1.4, t.bad, 0.16);
    }

    if (this.flash > 0) {
      g.save();
      g.globalAlpha = this.flash * 0.12;
      g.fillStyle = t.fg;
      g.fillRect(c.x, c.y, c.w, c.h);
      g.restore();
    }
  }
}
