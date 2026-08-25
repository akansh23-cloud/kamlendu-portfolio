import { MiniGame } from './MiniGame.js';
import { panel, label, text, bar, button, rr, glow, hexA } from './gfx2d.js';

/**
 * COMPACT — the lakehouse era.
 *
 * The small files problem, played as bin packing against a clock.
 *
 * Small files land continuously. Every one of them costs a query planner a file
 * to open, so the longer they sit loose the more every read costs — and the
 * query cost meter is climbing the entire time you are thinking. You pack them
 * into 128 MB target files and commit.
 *
 * The tension is real and it is the actual operational tension: sealing a bin
 * early wastes space and burns a commit for very little; sealing late means the
 * loose pile keeps taxing every read while you wait for a file that fits. There
 * is no setting that makes both go away, which is why compaction is a
 * maintenance job somebody has to keep doing rather than a box you tick once.
 */

const TARGET = 128;

export class CompactionGame extends MiniGame {
  static id = 'compact';
  static title = 'COMPACT';
  static chapter = 'lakehouse';
  static objective =
    'Pack loose files into 128 MB targets and commit them. Every loose file taxes every read, and every commit costs a snapshot.';
  static hint = 'Tap a file, then tap a bin · tap SEAL to commit a bin';
  static duration = 85;
  static ranks = [0, 2900, 5300, 8100];

  constructor(ctx) {
    super(ctx);
    this.loose = [];
    this.bins = [
      { files: [], size: 0, seal: 0 },
      { files: [], size: 0, seal: 0 },
      { files: [], size: 0, seal: 0 },
    ];
    this.selected = null;
    this.nextId = 1;
    this.spawnT = 0;
    this.committed = 0;
    this.commits = 0;
    this.filesCompacted = 0;
    this.wasted = 0;
    this.queryCost = 1;
    this.peakCost = 1;
    this.wave = 0;
  }

  layout() {
    const pad = this.portrait ? 12 : 24;
    const top = pad + 66;
    const h = this.H - top - pad - 34;

    if (this.portrait) {
      this.loosePanel = { x: pad, y: top, w: this.W - pad * 2, h: h * 0.42 };
      this.binPanel = { x: pad, y: top + h * 0.42 + 10, w: this.W - pad * 2, h: h * 0.58 - 10 };
    } else {
      const lw = this.W * 0.34;
      this.loosePanel = { x: pad, y: top, w: lw, h };
      this.binPanel = { x: pad + lw + 16, y: top, w: this.W - lw - pad * 2 - 16, h };
    }

    this.binBoxes = this.bins.map((_, i) => {
      const bp = this.binPanel;
      return this.portrait
        ? { x: bp.x + 10 + ((bp.w - 20) / 3) * i + 4, y: bp.y + 30, w: (bp.w - 20) / 3 - 8, h: bp.h - 42 }
        : { x: bp.x + 14 + ((bp.w - 28) / 3) * i + 6, y: bp.y + 34, w: (bp.w - 28) / 3 - 12, h: bp.h - 46 };
    });

    this.rebuildZones();
  }

  rebuildZones() {
    this.clearZones();
    const lp = this.loosePanel;
    const cols = this.portrait ? 4 : 2;
    const cw = (lp.w - 20) / cols;
    const chh = 30;

    this.looseBoxes = [];
    for (let i = 0; i < this.loose.length; i++) {
      const x = lp.x + 10 + (i % cols) * cw;
      const y = lp.y + 32 + Math.floor(i / cols) * (chh + 5);
      if (y + chh > lp.y + lp.h - 4) break;
      const box = { x, y, w: cw - 5, h: chh };
      this.looseBoxes.push(box);
      this.zone(`file-${i}`, box.x, box.y, box.w, box.h, { file: i });
    }

    for (let i = 0; i < this.bins.length; i++) {
      const b = this.binBoxes[i];
      this.zone(`bin-${i}`, b.x, b.y, b.w, b.h - 30, { bin: i });
      this.zone(`seal-${i}`, b.x, b.y + b.h - 26, b.w, 26, { seal: i });
    }
  }

  start() {
    for (let i = 0; i < 6; i++) this.spawn();
    this.rebuildZones();
  }

  spawn() {
    // Heavily skewed small, exactly like a streaming ingest: lots of 2–15 MB
    // files and the occasional chunky one that ruins your packing.
    const r = this.rand();
    const size = r < 0.62
      ? 2 + Math.round(this.rand() * 13)
      : r < 0.9
        ? 16 + Math.round(this.rand() * 30)
        : 48 + Math.round(this.rand() * 42);
    this.loose.push({ id: this.nextId++, size, age: 0 });
  }

  update(dt) {
    this.updateToasts(dt);
    this.time -= dt;
    if (this.time <= 0) { this.finish('survived'); return; }

    for (const f of this.loose) f.age += dt;

    // Query cost is a function of how many files a planner has to open. It is
    // the pressure and it is also the score, so there is no separate timer.
    const looseCount = this.loose.length;
    const target = 1 + looseCount * 0.16 + this.committed * 0.03;
    this.queryCost += (target - this.queryCost) * Math.min(1, dt * 1.6);
    this.peakCost = Math.max(this.peakCost, this.queryCost);

    // Score ticks up while the table is healthy and down while it is not.
    this.score += (this.queryCost < 2.2 ? 34 : this.queryCost < 3.4 ? 8 : -26) * dt;
    this.score = Math.max(0, this.score);

    this.wave = Math.floor((CompactionGame.duration - this.time) / 20);
    this.spawnT += dt;
    const gap = Math.max(0.6, 1.9 - this.wave * 0.32) / this.pace;
    if (this.spawnT > gap) {
      this.spawnT = 0;
      if (this.loose.length < 40) this.spawn();
      this.rebuildZones();
    }

    for (const b of this.bins) b.seal = Math.max(0, b.seal - dt * 3);

    if (this.queryCost > 5.5) this.finish('failed');
  }

  addToBin(binIdx) {
    if (this.selected === null) return;
    const f = this.loose[this.selected];
    if (!f) { this.selected = null; return; }
    const bin = this.bins[binIdx];
    const box = this.binBoxes[binIdx];

    if (bin.size + f.size > TARGET) {
      this.toast('OVER TARGET', box.x + box.w / 2, box.y + 20, 'warn');
      return;
    }

    bin.files.push(f);
    bin.size += f.size;
    this.loose.splice(this.selected, 1);
    this.selected = null;
    this.rebuildZones();

    // Filling a bin to the brim is worth calling out — it is the good outcome.
    if (bin.size >= TARGET * 0.94) {
      this.toast('WELL PACKED', box.x + box.w / 2, box.y + 20, 'good');
    }
  }

  seal(binIdx) {
    const bin = this.bins[binIdx];
    const box = this.binBoxes[binIdx];
    if (!bin.files.length) return;

    const fill = bin.size / TARGET;
    const waste = TARGET - bin.size;

    // The trade-off, priced. A near-full commit is worth several times a lazy
    // one, and a commit of three tiny files is worth almost nothing.
    let pts = Math.round(bin.files.length * 26 + fill * fill * 420);
    if (fill < 0.4) pts = Math.round(pts * 0.35);

    this.score += pts;
    this.committed++;
    this.commits++;
    this.filesCompacted += bin.files.length;
    this.wasted += Math.max(0, waste);

    this.toast(
      `COMMIT ${bin.files.length} FILES · ${Math.round(fill * 100)}% +${pts}`,
      box.x + box.w / 2, box.y + box.h / 2, fill > 0.75 ? 'good' : 'warn'
    );
    bin.seal = 1;
    bin.files = [];
    bin.size = 0;
    this.bump(0.3);
  }

  pointer(x, y, type) {
    if (type !== 'down') return;
    const z = this.zoneAt(x, y);
    if (!z) { this.selected = null; return; }

    if (z.data?.file !== undefined) {
      this.selected = this.selected === z.data.file ? null : z.data.file;
      return;
    }
    if (z.data?.bin !== undefined) { this.addToBin(z.data.bin); return; }
    if (z.data?.seal !== undefined) { this.seal(z.data.seal); return; }
  }

  key(code, down) {
    if (!down) return;
    const n = { Digit1: 0, Digit2: 1, Digit3: 2 }[code];
    if (n !== undefined) {
      if (this.selected !== null) this.addToBin(n);
      else this.seal(n);
    }
  }

  meters() {
    return [
      { label: 'QUERY COST', value: this.clamp(this.queryCost / 5.5), danger: this.queryCost > 3.4, text: `${this.queryCost.toFixed(1)}×` },
      { label: 'LOOSE FILES', value: Math.min(1, this.loose.length / 40), danger: this.loose.length > 26, text: `${this.loose.length}` },
      { label: 'COMMITS', value: Math.min(1, this.commits / 20), text: `${this.commits}` },
    ];
  }

  summary() {
    const avg = this.commits ? Math.round((this.filesCompacted / this.commits)) : 0;
    const wastePct = this.commits ? Math.round((this.wasted / (this.commits * TARGET)) * 100) : 0;
    return [
      ['FILES COMPACTED', `${this.filesCompacted}`],
      ['SNAPSHOTS COMMITTED', `${this.commits}`],
      ['AVG FILES PER COMMIT', `${avg}`],
      ['SPACE WASTED', `${wastePct}%`],
      ['PEAK QUERY COST', `${this.peakCost.toFixed(1)}×`],
      this.outcome === 'failed'
        ? ['VERDICT', 'Small files buried the planner']
        : wastePct < 18
          ? ['VERDICT', 'Tight packing, few snapshots']
          : ['VERDICT', 'Committed too eagerly — lots of half-empty targets'],
    ];
  }

  // -------------------------------------------------------------------- draw

  draw(g) {
    const t = this.theme;
    const pad = this.portrait ? 12 : 24;

    label(g, t, 'TABLE MAINTENANCE', pad, pad + 20, { size: 12, weight: 600, color: t.era });
    text(g, t, `Target file size ${TARGET} MB · every loose file is a file the planner must open`,
      pad, pad + 40, { size: 11, color: t.dim });

    this.drawLoose(g);
    this.drawBins(g);
    this.drawToasts(g);
  }

  drawLoose(g) {
    const t = this.theme;
    const lp = this.loosePanel;
    const crowded = this.loose.length > 26;

    panel(g, t, lp.x, lp.y, lp.w, lp.h, {
      stroke: crowded ? hexA(t.bad, 0.5) : t.line,
    });
    label(g, t, `LOOSE FILES · ${this.loose.length}`, lp.x + 12, lp.y + 20, {
      size: 9, weight: 600, color: crowded ? t.bad : t.era,
    });

    for (let i = 0; i < this.looseBoxes.length; i++) {
      const b = this.looseBoxes[i];
      const f = this.loose[i];
      if (!f) continue;
      const sel = this.selected === i;
      const tiny = f.size < 16;

      g.save();
      rr(g, b.x, b.y, b.w, b.h, 3);
      g.fillStyle = sel ? hexA(t.era, 0.3) : 'rgba(255,255,255,0.04)';
      g.fill();
      g.strokeStyle = sel ? t.era : tiny ? hexA(t.warn, 0.4) : t.line;
      g.lineWidth = sel ? 2 : 1;
      g.stroke();
      g.restore();

      // The bar is the file's size relative to the target, so "this is tiny"
      // is something you see rather than something you compute.
      bar(g, t, b.x + 6, b.y + b.h - 8, b.w - 12, 3, f.size / TARGET, {
        color: tiny ? t.warn : t.era,
      });
      label(g, t, `${f.size}`, b.x + 7, b.y + 17, { size: 11, weight: 600, color: t.fg });
      label(g, t, 'MB', b.x + 7 + String(f.size).length * 8 + 4, b.y + 17, { size: 8, color: t.dim });
    }

    const hidden = this.loose.length - this.looseBoxes.length;
    if (hidden > 0) {
      label(g, t, `+${hidden} MORE OFF-PANEL`, lp.x + lp.w / 2, lp.y + lp.h - 8, {
        size: 9, weight: 600, align: 'center', color: t.bad,
      });
    }
  }

  drawBins(g) {
    const t = this.theme;
    const bp = this.binPanel;
    panel(g, t, bp.x, bp.y, bp.w, bp.h);
    label(g, t, 'COMPACTION TARGETS', bp.x + 12, bp.y + 20, { size: 9, weight: 600, color: t.era });

    for (let i = 0; i < this.bins.length; i++) {
      const b = this.binBoxes[i];
      const bin = this.bins[i];
      const fill = bin.size / TARGET;
      const armed = this.selected !== null && bin.size + (this.loose[this.selected]?.size || 0) <= TARGET;

      panel(g, t, b.x, b.y, b.w, b.h, {
        stroke: armed ? t.era : t.line,
        fill: armed ? hexA(t.era, 0.05) : 'rgba(255,255,255,0.02)',
      });

      if (bin.seal > 0) glow(g, t, b.x + b.w / 2, b.y + b.h / 2, b.w * 0.8, t.era, bin.seal * 0.3);

      // Stacked contents, drawn to scale from the bottom up.
      const innerH = b.h - 62;
      let y = b.y + b.h - 32;
      for (const f of bin.files) {
        const fh = Math.max(3, (f.size / TARGET) * innerH);
        y -= fh;
        g.save();
        rr(g, b.x + 8, y, b.w - 16, fh - 1.5, 2);
        g.fillStyle = hexA(t.era, 0.45);
        g.fill();
        g.restore();
      }

      // The target line: the thing you are trying to reach without crossing.
      g.save();
      g.setLineDash([4, 4]);
      g.strokeStyle = hexA(t.fg, 0.35);
      g.beginPath();
      g.moveTo(b.x + 4, b.y + b.h - 32 - innerH);
      g.lineTo(b.x + b.w - 4, b.y + b.h - 32 - innerH);
      g.stroke();
      g.restore();

      label(g, t, `${Math.round(bin.size)} / ${TARGET}`, b.x + b.w / 2, b.y + 18, {
        size: 10, weight: 600, align: 'center',
        color: fill > 0.94 ? t.era : fill > 0 ? t.fg : t.dim,
      });

      button(g, t, b.x, b.y + b.h - 26, b.w, 26,
        bin.files.length ? `SEAL ${Math.round(fill * 100)}%` : 'EMPTY',
        { disabled: !bin.files.length, active: fill > 0.94, size: 9 });
    }
  }
}
