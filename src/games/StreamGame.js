import { MiniGame } from './MiniGame.js';
import { panel, label, text, bar, button, rr, glow, hexA } from './gfx2d.js';

/**
 * BACKPRESSURE — the streaming era.
 *
 * The one game here that is genuinely hard, because it models the two things
 * that actually make streaming systems difficult and refuses to let you solve
 * both at once.
 *
 * THE BOTTLENECK MOVES. You have a fixed pool of executors and four stages.
 * Adding capacity to a stage that is not the constraint does nothing at all —
 * the queue just builds one stage further along. The skill is reading where the
 * constraint is right now, which changes when load ramps and changes again when
 * a skew event doubles one stage's cost per event.
 *
 * THE WATERMARK IS A TRADE, NOT A SETTING. State grows while windows stay open
 * waiting for late events. Advance the watermark and you free memory and emit
 * results immediately, but every late event still in flight for those windows
 * is dropped and your accuracy falls. Wait, and accuracy holds but state
 * climbs, and if it overflows the job dies with everything in it.
 *
 * There is no configuration that makes both problems go away. That is the era.
 */

const STAGES = [
  { key: 'ingest', name: 'KAFKA', unit: 'PARTITIONS', rate: 34, cap: 46 },
  { key: 'transform', name: 'SPARK', unit: 'EXECUTORS', rate: 27, cap: 40 },
  { key: 'state', name: 'STATE', unit: 'SHARDS', rate: 30, cap: 44 },
  { key: 'sink', name: 'CUSTOMER 360', unit: 'WRITERS', rate: 38, cap: 52 },
];

export class StreamGame extends MiniGame {
  static id = 'stream';
  static title = 'BACKPRESSURE';
  static chapter = 'streaming';
  static objective =
    'Keep the pipeline alive as load ramps. Capacity is fixed, the bottleneck moves, and the watermark trades accuracy for memory.';
  static hint = '+ / − to move executors · WATERMARK closes windows · lag or state overflow ends the run';
  static duration = 100;
  static ranks = [0, 1250, 2300, 3600];

  constructor(ctx) {
    super(ctx);

    this.stages = STAGES.map((s, i) => ({
      ...s,
      par: i === 0 ? 2 : 1,
      queue: 0,
      out: 0,
      skew: 0,
      alarm: 0,
    }));

    this.budget = 8;
    this.load = 18;
    this.lost = 0;
    this.processed = 0;
    this.accuracy = 1;
    this.stateMem = 0.1;
    this.openWindows = 0;
    this.lateInFlight = 0;
    this.watermarkAge = 0;
    this.watermarks = 0;

    this.alarmT = 0;
    this.eventT = 6;
    this.event = null;
    this.peakThroughput = 0;
    this.history = new Array(90).fill(0);
    this.histT = 0;
  }

  get used() {
    return this.stages.reduce((s, x) => s + x.par, 0);
  }

  layout() {
    const pad = this.portrait ? 12 : 22;
    const top = pad + 62;
    const footer = 74;
    const h = this.H - top - pad - footer;

    this.cards = this.stages.map((_, i) => {
      const n = this.stages.length;
      return this.portrait
        ? { x: pad, y: top + (h / n) * i + 3, w: this.W - pad * 2, h: h / n - 6 }
        : { x: pad + ((this.W - pad * 2) / n) * i + 5, y: top, w: (this.W - pad * 2) / n - 10, h };
    });

    this.wmBtn = {
      x: pad,
      y: this.H - pad - 40,
      w: this.portrait ? this.W - pad * 2 : 220,
      h: 38,
    };

    this.rebuildZones();
  }

  rebuildZones() {
    this.clearZones();
    for (let i = 0; i < this.cards.length; i++) {
      const c = this.cards[i];
      const bw = this.portrait ? 46 : Math.min(52, c.w / 2 - 8);
      const by = c.y + c.h - 38;
      const minus = { x: c.x + 8, y: by, w: bw, h: 30 };
      const plus = { x: c.x + c.w - 8 - bw, y: by, w: bw, h: 30 };
      this.stages[i].minusBox = minus;
      this.stages[i].plusBox = plus;
      this.zone(`minus-${i}`, minus.x, minus.y, minus.w, minus.h, { minus: i });
      this.zone(`plus-${i}`, plus.x, plus.y, plus.w, plus.h, { plus: i });
    }
    this.zone('watermark', this.wmBtn.x, this.wmBtn.y, this.wmBtn.w, this.wmBtn.h);
  }

  start() {}

  update(dt) {
    this.updateToasts(dt);
    this.time -= dt;
    if (this.time <= 0) { this.finish('survived'); return; }

    const elapsed = StreamGame.duration - this.time;

    // ------------------------------------------------------------- the ramp
    // Load climbs steadily and the budget climbs more slowly, so a placement
    // that was correct thirty seconds ago is wrong now.
    this.load = 18 + elapsed * 0.62 + Math.sin(elapsed * 0.5) * 5;
    this.budget = 8 + Math.floor(elapsed / 22);

    // ------------------------------------------------------------- events
    this.eventT -= dt;
    if (this.event) {
      this.event.t -= dt;
      if (this.event.t <= 0) {
        if (this.event.kind === 'skew') this.stages[this.event.stage].skew = 0;
        this.event = null;
      }
    } else if (this.eventT <= 0) {
      this.eventT = (13 + this.rand() * 7) / this.pace;
      const roll = this.rand();
      if (roll < 0.4) {
        const i = 1 + Math.floor(this.rand() * 2);
        this.stages[i].skew = 1;
        this.event = { kind: 'skew', stage: i, t: 11 };
        this.toast(`SKEW ON ${this.stages[i].name}`, this.W / 2, this.H * 0.14, 'warn');
      } else if (roll < 0.74) {
        this.event = { kind: 'burst', t: 7 };
        this.toast('EVENT BURST', this.W / 2, this.H * 0.14, 'warn');
        this.bump(0.6);
      } else {
        const n = 40 + this.rand() * 70;
        this.lateInFlight += n;
        this.event = { kind: 'late', t: 9 };
        this.toast(`LATE ARRIVALS +${Math.round(n)}`, this.W / 2, this.H * 0.14, 'warn');
      }
    }

    const burst = this.event?.kind === 'burst' ? 2.2 : 1;
    let incoming = this.load * burst;

    // ------------------------------------------------------ the pipeline
    for (let i = 0; i < this.stages.length; i++) {
      const s = this.stages[i];
      // Skew halves effective throughput without touching parallelism, which
      // is exactly why throwing executors at a skewed stage barely helps.
      const capacity = s.par * s.rate * (s.skew ? 0.52 : 1);
      const available = incoming + s.queue / Math.max(dt, 0.0001);
      const out = Math.min(available, capacity);
      s.queue = Math.max(0, s.queue + (incoming - out) * dt);
      s.out = out;

      if (s.queue > s.cap) {
        const spill = s.queue - s.cap;
        s.queue = s.cap;
        this.lost += spill;
        s.alarm = 1;
      } else {
        s.alarm = Math.max(0, s.alarm - dt * 1.5);
      }

      incoming = out;
    }

    const throughput = this.stages[this.stages.length - 1].out;
    this.processed += throughput * dt;
    this.peakThroughput = Math.max(this.peakThroughput, throughput);

    this.histT += dt;
    if (this.histT > 0.12) {
      this.histT = 0;
      this.history.push(throughput);
      this.history.shift();
    }

    // ------------------------------------------------------- state & windows
    // Open windows accumulate with throughput and are only released by a
    // watermark. This is the memory half of the trade.
    this.watermarkAge += dt;
    this.openWindows += throughput * dt * 0.045;
    this.stateMem = this.clamp(this.openWindows / 140);

    if (this.lateInFlight > 0) {
      const settled = Math.min(this.lateInFlight, 26 * dt);
      this.lateInFlight -= settled;
      // Late events that arrive while their window is still open are counted,
      // which is the entire reason to wait before advancing.
      this.accuracy = Math.min(1, this.accuracy + settled * 0.0009);
    }

    if (this.stateMem >= 1) { this.finish('overflow'); return; }

    // ------------------------------------------------------------- scoring
    const healthy = this.stages.every((s) => s.queue < s.cap * 0.7);
    this.score += (healthy ? 42 : 12) * dt * this.accuracy;

    const anyAlarm = this.stages.some((s) => s.queue >= s.cap * 0.98);
    this.alarmT = anyAlarm ? this.alarmT + dt : Math.max(0, this.alarmT - dt * 1.5);
    if (this.alarmT > 6) this.finish('lag');
  }

  move(i, delta) {
    const s = this.stages[i];
    if (delta > 0) {
      if (this.used >= this.budget) {
        this.toast('NO SPARE CAPACITY', this.W / 2, this.H * 0.2, 'warn');
        return;
      }
      s.par++;
    } else {
      if (s.par <= 0) return;
      s.par--;
    }
  }

  advanceWatermark() {
    if (this.openWindows < 1) return;
    // Everything still in flight for those windows is now late-and-dropped.
    const dropped = this.lateInFlight;
    this.lateInFlight = 0;
    this.accuracy = Math.max(0.35, this.accuracy - dropped * 0.0016);

    const freed = this.openWindows;
    const held = Math.min(1, this.watermarkAge / 12);
    // Holding a watermark longer is worth more, right up until it isn't.
    const pts = Math.round(freed * 2.4 * (0.6 + held * 0.7) * this.accuracy);
    this.score += pts;
    this.watermarks++;

    this.openWindows = 0;
    this.watermarkAge = 0;
    this.toast(
      dropped > 0 ? `WATERMARK · ${Math.round(dropped)} LATE DROPPED +${pts}` : `WATERMARK +${pts}`,
      this.W / 2, this.H * 0.3, dropped > 30 ? 'warn' : 'good'
    );
    this.bump(0.4);
  }

  pointer(x, y, type) {
    if (type !== 'down') return;
    const z = this.zoneAt(x, y);
    if (!z) return;
    if (z.data?.plus !== undefined) this.move(z.data.plus, 1);
    else if (z.data?.minus !== undefined) this.move(z.data.minus, -1);
    else if (z.id === 'watermark') this.advanceWatermark();
  }

  key(code, down) {
    if (!down) return;
    if (code === 'KeyW' || code === 'Space') { this.advanceWatermark(); return; }
    const m = /^Digit([1-4])$/.exec(code);
    if (m) this.move(Number(m[1]) - 1, 1);
    const q = { KeyQ: 0, KeyE: 1, KeyR: 2, KeyT: 3 }[code];
    if (q !== undefined) this.move(q, -1);
  }

  meters() {
    const worst = this.stages.reduce((m, s) => Math.max(m, s.queue / s.cap), 0);
    return [
      { label: 'MAX LAG', value: worst, danger: worst > 0.75, text: `${Math.round(worst * 100)}%` },
      { label: 'STATE MEMORY', value: this.stateMem, danger: this.stateMem > 0.7 },
      { label: 'ACCURACY', value: this.accuracy, danger: this.accuracy < 0.7, text: `${Math.round(this.accuracy * 100)}%` },
      { label: 'EXECUTORS', value: this.used / this.budget, text: `${this.used} / ${this.budget}` },
    ];
  }

  summary() {
    const reason = {
      lag: 'Lag went unbounded — the constraint outran the pool',
      overflow: 'State overflowed — windows were held open too long',
      survived: 'Pipeline held for the full run',
      complete: 'Pipeline held for the full run',
    }[this.outcome];
    return [
      ['EVENTS PROCESSED', `${Math.round(this.processed)}`],
      ['PEAK THROUGHPUT', `${Math.round(this.peakThroughput)}/s`],
      ['EVENTS DROPPED', `${Math.round(this.lost)}`],
      ['WATERMARKS', `${this.watermarks}`],
      ['FINAL ACCURACY', `${Math.round(this.accuracy * 100)}%`],
      ['VERDICT', reason],
    ];
  }

  // -------------------------------------------------------------------- draw

  draw(g) {
    const t = this.theme;
    const pad = this.portrait ? 12 : 22;

    label(g, t, 'LIVE PIPELINE', pad, pad + 20, { size: 12, weight: 600, color: t.era });
    text(g, t, `Inbound ${Math.round(this.load * (this.event?.kind === 'burst' ? 2.2 : 1))}/s · pool ${this.used}/${this.budget}`,
      pad, pad + 40, { size: 11, color: t.dim });

    this.drawTrace(g, pad);

    for (let i = 0; i < this.stages.length; i++) this.drawStage(g, i);

    // Watermark control, priced by how long it has been held.
    const held = this.clamp(this.watermarkAge / 12);
    button(g, t, this.wmBtn.x, this.wmBtn.y, this.wmBtn.w, this.wmBtn.h,
      `ADVANCE WATERMARK · ${this.watermarkAge.toFixed(0)}s`,
      { active: this.stateMem > 0.72, danger: this.stateMem > 0.85, size: 11 });
    if (!this.portrait) {
      bar(g, t, this.wmBtn.x + this.wmBtn.w + 16, this.wmBtn.y + 12,
        this.W - this.wmBtn.x - this.wmBtn.w - pad - 16, 5, this.stateMem,
        { color: this.stateMem > 0.7 ? t.warn : t.era, warnAt: 0.92 });
      label(g, t,
        this.lateInFlight > 1 ? `${Math.round(this.lateInFlight)} LATE EVENTS STILL IN FLIGHT` : 'WINDOW HELD OPEN',
        this.wmBtn.x + this.wmBtn.w + 16, this.wmBtn.y + 34,
        { size: 9, color: this.lateInFlight > 1 ? t.warn : t.dim });
    }
  }

  drawTrace(g, pad) {
    const t = this.theme;
    const w = this.portrait ? this.W - pad * 2 : 240;
    const x = this.W - pad - w;
    const y = pad + 10;
    const h = 34;
    if (this.portrait) return; // no room; the meters carry it instead

    const max = Math.max(20, ...this.history);
    g.save();
    g.strokeStyle = hexA(t.era, 0.7);
    g.lineWidth = 1.5;
    g.beginPath();
    for (let i = 0; i < this.history.length; i++) {
      const px = x + (i / (this.history.length - 1)) * w;
      const py = y + h - (this.history[i] / max) * h;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.stroke();
    g.restore();
    label(g, t, 'THROUGHPUT', x, y - 2, { size: 8, color: t.dim });
  }

  drawStage(g, i) {
    const t = this.theme;
    const c = this.cards[i];
    const s = this.stages[i];
    const lag = this.clamp(s.queue / s.cap);
    const critical = lag > 0.9;
    const isBottleneck = this.stages.every((o) => o === s || o.queue / o.cap <= lag) && lag > 0.25;

    panel(g, t, c.x, c.y, c.w, c.h, {
      stroke: critical ? t.bad : isBottleneck ? t.warn : t.line,
      fill: critical ? hexA(t.bad, 0.05) : 'rgba(255,255,255,0.02)',
      accent: isBottleneck,
    });

    if (s.alarm > 0) glow(g, t, c.x + c.w / 2, c.y + c.h / 2, c.w * 0.7, t.bad, s.alarm * 0.22);

    label(g, t, s.name, c.x + 10, c.y + 20, {
      size: 10, weight: 600, color: critical ? t.bad : t.fg,
    });
    if (s.skew) {
      label(g, t, 'SKEW', c.x + c.w - 10, c.y + 20, {
        size: 9, weight: 600, align: 'right',
        color: Math.sin(this._pulse * 10) > 0 ? t.warn : hexA(t.warn, 0.4),
      });
    } else if (isBottleneck) {
      label(g, t, 'BOTTLENECK', c.x + c.w - 10, c.y + 20, { size: 8, weight: 600, align: 'right', color: t.warn });
    }

    // Parallelism as discrete pips — you can count capacity at a glance.
    const pipY = c.y + 36;
    const maxPips = 8;
    for (let p = 0; p < maxPips; p++) {
      const px = c.x + 10 + p * ((c.w - 20) / maxPips);
      const pw = (c.w - 20) / maxPips - 3;
      g.save();
      rr(g, px, pipY, Math.max(3, pw), 7, 1.5);
      g.fillStyle = p < s.par ? t.era : 'rgba(255,255,255,0.07)';
      g.fill();
      g.restore();
    }
    label(g, t, s.unit, c.x + 10, pipY + 22, { size: 8, color: t.dim });
    label(g, t, `${s.par}`, c.x + c.w - 10, pipY + 22, { size: 11, weight: 600, align: 'right', color: t.fg });

    // Queue depth — the number that actually matters.
    const qy = this.portrait ? c.y + c.h - 54 : c.y + c.h - 90;
    label(g, t, 'LAG', c.x + 10, qy - 6, { size: 8, color: critical ? t.bad : t.dim });
    bar(g, t, c.x + 10, qy, c.w - 20, 8, lag, {
      color: lag > 0.7 ? t.warn : t.era, warnAt: 0.95,
    });
    label(g, t, `${Math.round(s.out)}/s`, c.x + c.w - 10, qy + 24, {
      size: 10, weight: 600, align: 'right', color: t.fg,
    });

    button(g, t, s.minusBox.x, s.minusBox.y, s.minusBox.w, s.minusBox.h, '−',
      { disabled: s.par <= 0, size: 13 });
    button(g, t, s.plusBox.x, s.plusBox.y, s.plusBox.w, s.plusBox.h, '+',
      { disabled: this.used >= this.budget, size: 13 });
  }
}
