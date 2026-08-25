import { MiniGame } from './MiniGame.js';
import { panel, label, text, bar, button, rr, glow, hexA, link } from './gfx2d.js';

/**
 * RESOLVE — the governance era.
 *
 * Two jobs, in the order they actually happen.
 *
 * FIRST, entity resolution. Records arrive from different source systems
 * describing the same person, and you have to decide which ones are the same
 * entity. The rule is deliberately fuzzy: three of four attributes matching is
 * a match, four is certain, two is a trap. Under time pressure you will link
 * something you should not have, and the precision meter will tell you, which
 * is exactly the false-positive problem every matching system has.
 *
 * SECOND, the boundary. A resolved identity cannot leave until its restricted
 * attributes are tokenised. Release one that still carries a raw restricted
 * field and it is a breach, and the run remembers it.
 *
 * On the content rule: no fake personal data appears anywhere in this game. A
 * record's attributes are abstract glyph codes, not invented names, emails or
 * account numbers. Inventing plausible-looking PII to make a governance demo
 * feel realistic would be both a content-rule violation and a genuinely bad
 * habit to model in a portfolio about data governance.
 */

const GLYPHS = ['◆', '▲', '●', '■', '◇', '△', '○', '□', '⬟', '✦'];
const SOURCES = ['CRM', 'CORE', 'WEB', 'MOBILE', 'BRANCH', 'PARTNER'];
const FIELDS = 4;

export class ResolveGame extends MiniGame {
  static id = 'resolve';
  static title = 'RESOLVE';
  static chapter = 'governance';
  static objective =
    'Link records that describe the same entity, then tokenise restricted fields before releasing them. Three of four attributes is a match. Two is not.';
  static hint = 'Tap two records to link · tap ⚿ fields to tokenise · tap RELEASE to send';
  static duration = 90;
  static ranks = [0, 2500, 4500, 6900];

  constructor(ctx) {
    super(ctx);
    this.cards = [];
    this.selected = null;
    this.nextEntity = 1;
    this.nextCard = 1;

    this.merged = [];       // resolved identities awaiting the boundary
    this.spawnT = 0;
    this.truePos = 0;
    this.falsePos = 0;
    this.missed = 0;
    this.released = 0;
    this.breaches = 0;
    this.wave = 0;
  }

  layout() {
    const pad = this.portrait ? 12 : 22;
    const top = pad + 64;
    const boundaryH = this.portrait ? 150 : 168;

    this.pool = { x: pad, y: top, w: this.W - pad * 2, h: this.H - top - boundaryH - pad - 8 };
    this.boundary = { x: pad, y: this.H - pad - boundaryH, w: this.W - pad * 2, h: boundaryH };

    this.cols = this.portrait ? 2 : 4;
    this.cardW = (this.pool.w - 20 - (this.cols - 1) * 10) / this.cols;
    this.cardH = this.portrait ? 84 : 92;

    this.rebuildZones();
  }

  rebuildZones() {
    this.clearZones();

    for (let i = 0; i < this.cards.length; i++) {
      const b = this.cardBox(i);
      if (!b) break;
      this.cards[i].box = b;
      this.zone(`card-${i}`, b.x, b.y, b.w, b.h, { card: i });
    }

    // Boundary: the head of the queue is the one you work on.
    const bd = this.boundary;
    const m = this.merged[0];
    if (m) {
      const fx = this.portrait ? bd.x + 14 : bd.x + 230;
      const fy = bd.y + (this.portrait ? 78 : 62);
      m.fieldBoxes = [];
      for (let f = 0; f < FIELDS; f++) {
        const box = { x: fx + f * 58, y: fy, w: 50, h: 46 };
        m.fieldBoxes.push(box);
        this.zone(`field-${f}`, box.x, box.y, box.w, box.h, { field: f });
      }
      this.releaseBox = {
        x: this.portrait ? bd.x + 14 : bd.x + bd.w - 180,
        y: this.portrait ? bd.y + bd.h - 40 : bd.y + bd.h - 46,
        w: this.portrait ? bd.w - 28 : 166,
        h: 34,
      };
      this.zone('release', this.releaseBox.x, this.releaseBox.y, this.releaseBox.w, this.releaseBox.h);
    }
  }

  cardBox(i) {
    const col = i % this.cols;
    const row = Math.floor(i / this.cols);
    const y = this.pool.y + 30 + row * (this.cardH + 10);
    if (y + this.cardH > this.pool.y + this.pool.h - 4) return null;
    return {
      x: this.pool.x + 10 + col * (this.cardW + 10),
      y,
      w: this.cardW,
      h: this.cardH,
    };
  }

  start() {
    for (let i = 0; i < 4; i++) this.spawnPair();
    this.rebuildZones();
  }

  /** Emits a pair from one entity, or a decoy that only shares two fields. */
  spawnPair() {
    const entity = this.nextEntity++;
    const base = Array.from({ length: FIELDS }, () => Math.floor(this.rand() * GLYPHS.length));
    const restricted = Array.from({ length: FIELDS }, () => this.rand() < 0.45);
    // Guarantee at least one restricted field, or the boundary is a no-op.
    if (!restricted.some(Boolean)) restricted[Math.floor(this.rand() * FIELDS)] = true;

    const makeCard = (attrs, ent) => ({
      id: this.nextCard++,
      entity: ent,
      attrs: [...attrs],
      restricted: [...restricted],
      source: SOURCES[Math.floor(this.rand() * SOURCES.length)],
      life: 26 - Math.min(10, this.wave * 2),
      max: 26 - Math.min(10, this.wave * 2),
      box: null,
      flash: 0,
    });

    this.cards.push(makeCard(base, entity));

    // The partner differs in exactly one attribute — 3 of 4 is a match.
    const variant = [...base];
    variant[Math.floor(this.rand() * FIELDS)] = Math.floor(this.rand() * GLYPHS.length);
    this.cards.push(makeCard(variant, entity));

    // A decoy that shares two attributes. Two is not a match; it is a trap.
    if (this.rand() < 0.55) {
      const decoy = [...base];
      const idx = [0, 1, 2, 3].sort(() => this.rand() - 0.5).slice(0, 2);
      for (const i of idx) decoy[i] = (decoy[i] + 1 + Math.floor(this.rand() * 8)) % GLYPHS.length;
      this.cards.push(makeCard(decoy, this.nextEntity++));
    }

    // Shuffle so the pair is never adjacent.
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  matchCount(a, b) {
    let n = 0;
    for (let i = 0; i < FIELDS; i++) if (a.attrs[i] === b.attrs[i]) n++;
    return n;
  }

  update(dt) {
    this.updateToasts(dt);
    this.time -= dt;
    if (this.time <= 0) { this.finish('survived'); return; }

    this.wave = Math.floor((ResolveGame.duration - this.time) / 22);

    let dirty = false;
    for (let i = this.cards.length - 1; i >= 0; i--) {
      const c = this.cards[i];
      c.life -= dt;
      c.flash = Math.max(0, c.flash - dt * 3);
      if (c.life <= 0) {
        // Only count a miss if its partner was actually sitting there.
        const hadPartner = this.cards.some((o) => o !== c && o.entity === c.entity);
        if (hadPartner) {
          this.missed++;
          this.score = Math.max(0, this.score - 90);
          this.toast('UNRESOLVED', c.box?.x + c.box?.w / 2 || this.W / 2, c.box?.y || this.H / 2, 'bad');
        }
        this.cards.splice(i, 1);
        if (this.selected === i) this.selected = null;
        dirty = true;
      }
    }

    this.spawnT += dt;
    const gap = Math.max(4.5, 9 - this.wave * 1.4) / this.pace;
    if (this.spawnT > gap && this.cards.length < this.cols * 3) {
      this.spawnT = 0;
      this.spawnPair();
      dirty = true;
    }

    if (dirty) { this.selected = null; this.rebuildZones(); }

    // Holding a queue at the boundary is itself a cost — governance is a
    // throughput problem too, not only a correctness one.
    if (this.merged.length > 3) this.score = Math.max(0, this.score - 14 * dt);
  }

  tryLink(i, j) {
    const a = this.cards[i];
    const b = this.cards[j];
    if (!a || !b) return;

    const n = this.matchCount(a, b);
    const same = a.entity === b.entity;

    if (same) {
      this.truePos++;
      const pts = 200 + (n === 4 ? 60 : 0);
      this.score += pts;
      this.toast(`MATCH ${n}/4 +${pts}`, (a.box.x + b.box.x) / 2 + a.box.w / 2, a.box.y, 'good');

      // The surviving identity keeps the union of restricted flags — a field
      // is restricted if any contributing source said it was.
      this.merged.push({
        id: `ENT-${String(a.entity).padStart(4, '0')}`,
        attrs: a.attrs,
        restricted: a.restricted.map((r, k) => r || b.restricted[k]),
        tokenised: new Array(FIELDS).fill(false),
        sources: [a.source, b.source],
        fieldBoxes: [],
      });

      const rm = [i, j].sort((x, y) => y - x);
      for (const k of rm) this.cards.splice(k, 1);
    } else {
      this.falsePos++;
      this.score = Math.max(0, this.score - 180);
      a.flash = 1;
      b.flash = 1;
      this.toast(`FALSE MATCH — ONLY ${n}/4`, (a.box.x + b.box.x) / 2 + a.box.w / 2, a.box.y, 'bad');
      this.bump(0.7);
    }

    this.selected = null;
    this.rebuildZones();
  }

  release() {
    const m = this.merged[0];
    if (!m) return;
    const leaking = m.restricted.some((r, i) => r && !m.tokenised[i]);

    if (leaking) {
      this.breaches++;
      this.score = Math.max(0, this.score - 420);
      this.toast('COMPLIANCE BREACH — RAW FIELD LEFT THE BOUNDARY', this.W / 2, this.boundary.y - 12, 'bad');
      this.bump(1);
    } else {
      const pts = 240;
      this.score += pts;
      this.released++;
      this.toast(`RELEASED +${pts}`, this.W / 2, this.boundary.y - 12, 'good');
    }
    this.merged.shift();
    this.rebuildZones();
  }

  pointer(x, y, type) {
    if (type !== 'down') return;
    const z = this.zoneAt(x, y);
    if (!z) { this.selected = null; return; }

    if (z.data?.card !== undefined) {
      const i = z.data.card;
      if (this.selected === null) this.selected = i;
      else if (this.selected === i) this.selected = null;
      else this.tryLink(this.selected, i);
      return;
    }
    if (z.data?.field !== undefined) {
      const m = this.merged[0];
      if (!m) return;
      const f = z.data.field;
      if (!m.restricted[f]) {
        this.toast('NOT RESTRICTED', m.fieldBoxes[f].x + 25, m.fieldBoxes[f].y - 6, 'warn');
        return;
      }
      m.tokenised[f] = !m.tokenised[f];
      return;
    }
    if (z.id === 'release') this.release();
  }

  meters() {
    const total = this.truePos + this.falsePos;
    const precision = total ? this.truePos / total : 1;
    const recall = this.truePos + this.missed ? this.truePos / (this.truePos + this.missed) : 1;
    return [
      { label: 'PRECISION', value: precision, danger: precision < 0.75, text: `${Math.round(precision * 100)}%` },
      { label: 'RECALL', value: recall, danger: recall < 0.7, text: `${Math.round(recall * 100)}%` },
      { label: 'BREACHES', value: Math.min(1, this.breaches / 3), danger: this.breaches > 0, text: `${this.breaches}` },
      { label: 'AT BOUNDARY', value: Math.min(1, this.merged.length / 4), danger: this.merged.length > 3, text: `${this.merged.length}` },
    ];
  }

  summary() {
    const total = this.truePos + this.falsePos;
    const precision = total ? Math.round((this.truePos / total) * 100) : 100;
    const recall = this.truePos + this.missed ? Math.round((this.truePos / (this.truePos + this.missed)) * 100) : 100;
    return [
      ['IDENTITIES RESOLVED', `${this.truePos}`],
      ['FALSE MATCHES', `${this.falsePos}`],
      ['MISSED', `${this.missed}`],
      ['PRECISION / RECALL', `${precision}% / ${recall}%`],
      ['RELEASED CLEAN', `${this.released}`],
      this.breaches > 0
        ? ['VERDICT', `${this.breaches} raw restricted field${this.breaches > 1 ? 's' : ''} crossed the boundary`]
        : ['VERDICT', 'Nothing left the boundary untokenised'],
    ];
  }

  // -------------------------------------------------------------------- draw

  draw(g) {
    const t = this.theme;
    const pad = this.portrait ? 12 : 22;

    label(g, t, 'IDENTITY RESOLUTION', pad, pad + 20, { size: 12, weight: 600, color: t.era });
    text(g, t, '3 of 4 attributes is a match · 2 is a different person', pad, pad + 40, {
      size: 11, color: t.dim,
    });

    panel(g, t, this.pool.x, this.pool.y, this.pool.w, this.pool.h);
    label(g, t, `INBOUND RECORDS · ${this.cards.length}`, this.pool.x + 12, this.pool.y + 20, {
      size: 9, weight: 600, color: t.era,
    });

    // The candidate link, drawn live while one card is held.
    if (this.selected !== null && this.cards[this.selected]?.box) {
      const a = this.cards[this.selected].box;
      glow(g, t, a.x + a.w / 2, a.y + a.h / 2, a.w * 0.8, t.era, 0.16);
    }

    for (let i = 0; i < this.cards.length; i++) this.drawCard(g, i);
    this.drawBoundary(g);
    this.drawToasts(g);
  }

  drawCard(g, i) {
    const t = this.theme;
    const c = this.cards[i];
    if (!c.box) return;
    const b = c.box;
    const sel = this.selected === i;
    const urgency = 1 - this.clamp(c.life / c.max);

    panel(g, t, b.x, b.y, b.w, b.h, {
      stroke: c.flash > 0 ? t.bad : sel ? t.era : urgency > 0.75 ? hexA(t.warn, 0.6) : t.line,
      fill: sel ? hexA(t.era, 0.1) : c.flash > 0 ? hexA(t.bad, 0.12) : 'rgba(255,255,255,0.028)',
      accent: sel,
    });

    label(g, t, c.source, b.x + 9, b.y + 17, { size: 8, weight: 600, color: t.dim });
    label(g, t, `#${String(c.id).padStart(3, '0')}`, b.x + b.w - 9, b.y + 17, {
      size: 8, align: 'right', color: t.dim,
    });

    // The four attributes. A restricted one carries a key mark, which is the
    // only thing that matters once it reaches the boundary.
    const gw = (b.w - 18) / FIELDS;
    for (let f = 0; f < FIELDS; f++) {
      const x = b.x + 9 + f * gw;
      const y = b.y + 30;
      g.save();
      g.font = `600 ${Math.min(20, gw * 0.8)}px "IBM Plex Mono", monospace`;
      g.fillStyle = t.fg;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(GLYPHS[c.attrs[f]], x + gw / 2, y + 12);
      g.restore();
      if (c.restricted[f]) {
        label(g, t, '⚿', x + gw / 2, y + 30, { size: 9, align: 'center', color: t.warn });
      }
    }

    bar(g, t, b.x + 9, b.y + b.h - 8, b.w - 18, 3, c.life / c.max, {
      color: urgency > 0.7 ? t.bad : urgency > 0.45 ? t.warn : t.era,
    });
  }

  drawBoundary(g) {
    const t = this.theme;
    const bd = this.boundary;
    const m = this.merged[0];
    const leaking = m ? m.restricted.some((r, i) => r && !m.tokenised[i]) : false;

    panel(g, t, bd.x, bd.y, bd.w, bd.h, {
      accent: true,
      stroke: leaking ? hexA(t.warn, 0.7) : t.era,
      fill: 'rgba(255,255,255,0.018)',
    });

    label(g, t, 'GOVERNANCE BOUNDARY', bd.x + 14, bd.y + 22, { size: 9, weight: 600, color: t.era });

    if (!m) {
      label(g, t, 'NO RESOLVED IDENTITY WAITING', bd.x + bd.w / 2, bd.y + bd.h / 2, {
        size: 10, align: 'center', color: t.dim,
      });
      return;
    }

    label(g, t, m.id, bd.x + 14, bd.y + (this.portrait ? 50 : 62), {
      size: this.portrait ? 15 : 20, weight: 600, color: t.fg,
    });
    label(g, t, m.sources.join(' + '), bd.x + 14, bd.y + (this.portrait ? 66 : 82), {
      size: 8, color: t.dim,
    });

    for (let f = 0; f < FIELDS; f++) {
      const box = m.fieldBoxes[f];
      if (!box) continue;
      const restricted = m.restricted[f];
      const tok = m.tokenised[f];

      g.save();
      rr(g, box.x, box.y, box.w, box.h, 3);
      g.fillStyle = tok ? hexA(t.era, 0.24) : restricted ? hexA(t.warn, 0.1) : 'rgba(255,255,255,0.03)';
      g.fill();
      g.strokeStyle = tok ? t.era : restricted ? t.warn : t.line;
      g.lineWidth = restricted && !tok ? 2 : 1;
      g.stroke();
      g.restore();

      g.save();
      g.font = '600 17px "IBM Plex Mono", monospace';
      g.fillStyle = tok ? t.era : t.fg;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      // A tokenised field keeps its shape and loses its value — which is the
      // whole distinction between tokenisation and deletion.
      g.fillText(tok ? '▒▒' : GLYPHS[m.attrs[f]], box.x + box.w / 2, box.y + box.h / 2 - 4);
      g.restore();

      label(g, t, tok ? 'TOKEN' : restricted ? 'RAW ⚿' : 'OPEN',
        box.x + box.w / 2, box.y + box.h - 7,
        { size: 7, align: 'center', color: tok ? t.era : restricted ? t.warn : t.dim });
    }

    button(g, t, this.releaseBox.x, this.releaseBox.y, this.releaseBox.w, this.releaseBox.h,
      leaking ? 'RELEASE — RAW FIELDS' : 'RELEASE',
      { danger: leaking, active: !leaking, size: 10 });

    if (this.merged.length > 1) {
      label(g, t, `+${this.merged.length - 1} QUEUED`, bd.x + bd.w - 14, bd.y + 22, {
        size: 9, align: 'right', color: this.merged.length > 3 ? t.warn : t.dim,
      });
    }
  }
}
