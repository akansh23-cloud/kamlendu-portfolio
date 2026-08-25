import { MiniGame } from './MiniGame.js';
import { panel, label, text, button, rr, glow, hexA } from './gfx2d.js';

/**
 * SEEK — the magnetic tape era.
 *
 * The concept this game exists to make you feel: on sequential media, distance
 * is time. There is no random access. You cannot jump to record 60; you have to
 * physically wind past 1 through 59 to get there.
 *
 * So the game is a scheduling problem, and it is the same one that disk
 * schedulers solve. Requests arrive at scattered positions with deadlines. The
 * obvious strategy — always serve the nearest request — feels great for about
 * twenty seconds and then loses, because while you are picking off a cluster at
 * one end, everything at the other end expires. The strategy that actually
 * works is SCAN: sweep in one direction, serve everything you pass, turn round
 * at the end. Nobody is told this. The tape teaches it.
 *
 * The head has mass. Reversing costs you, which is exactly why sweeping wins.
 */

const LENGTH = 100;

export class SeekGame extends MiniGame {
  static id = 'seek';
  static title = 'SEEK';
  static chapter = 'magnetic-tape';
  static objective =
    'Serve read requests before they expire. The head has to travel — there is no jumping. Watch what happens when you keep chasing the nearest one.';
  static hint = 'Tap the tape to wind toward it · ← → to shuttle · 3 expiries ends the run';
  static duration = 75;
  static ranks = [0, 1700, 3050, 4640];

  constructor(ctx) {
    super(ctx);
    this.head = 50;
    this.vel = 0;
    this.target = null;
    this.dir = 0;

    this.requests = [];
    this.served = 0;
    this.expired = 0;
    this.travelled = 0;
    this.spawnT = 0;
    this.spawnGap = 2.1;
    this.wave = 0;
    this.nextId = 1;
  }

  layout() {
    const pad = this.portrait ? 14 : 26;
    this.tape = this.portrait
      ? { x: pad + 26, y: 120, w: this.W - pad * 2 - 40, h: this.H - 250 }
      : { x: pad + 40, y: 150, w: this.W - pad * 2 - 80, h: 120 };

    this.clearZones();
    this.zone('tape', this.tape.x - 20, this.tape.y - 20, this.tape.w + 40, this.tape.h + 40);

    const by = this.portrait ? this.H - 54 : this.H - 62;
    const bw = this.portrait ? (this.W - pad * 2 - 12) / 2 : 130;
    this.leftBtn = { x: pad, y: by, w: bw, h: 36 };
    this.rightBtn = { x: this.portrait ? pad + bw + 12 : this.W - pad - bw, y: by, w: bw, h: 36 };
    this.zone('left', this.leftBtn.x, this.leftBtn.y, this.leftBtn.w, this.leftBtn.h);
    this.zone('right', this.rightBtn.x, this.rightBtn.y, this.rightBtn.w, this.rightBtn.h);
  }

  /** Position on tape (0…LENGTH) → pixel along the tape's long axis. */
  posToPx(p) {
    const f = p / LENGTH;
    return this.portrait
      ? { x: this.tape.x + this.tape.w / 2, y: this.tape.y + f * this.tape.h }
      : { x: this.tape.x + f * this.tape.w, y: this.tape.y + this.tape.h / 2 };
  }

  pxToPos(x, y) {
    const f = this.portrait
      ? (y - this.tape.y) / this.tape.h
      : (x - this.tape.x) / this.tape.w;
    return this.clamp(f) * LENGTH;
  }

  start() {
    for (let i = 0; i < 4; i++) this.spawn();
  }

  spawn() {
    // Deliberately biased into clusters at the two ends. That is the trap: a
    // greedy head gets comfortable in one cluster and the other one dies.
    const r = this.rand();
    const pos = r < 0.38
      ? this.rand() * 22
      : r < 0.76
        ? LENGTH - this.rand() * 22
        : 22 + this.rand() * 56;

    this.requests.push({
      id: this.nextId++,
      pos,
      life: 15 - Math.min(6, this.wave * 0.8),
      max: 15 - Math.min(6, this.wave * 0.8),
      born: 0,
    });
  }

  update(dt) {
    this.updateToasts(dt);
    this.time -= dt;
    if (this.time <= 0) { this.finish('survived'); return; }

    // ------------------------------------------------------------ the head
    // A reel has inertia. Acceleration is limited and reversing has to bleed
    // off the existing velocity first, which is what makes sweeping efficient.
    const maxV = 26 * this.pace;
    let want = this.dir;
    if (this.target !== null) {
      const d = this.target - this.head;
      want = Math.abs(d) < 0.6 ? 0 : Math.sign(d);
      if (Math.abs(d) < 8) want *= Math.abs(d) / 8;
    }
    const accel = 42 * this.pace;
    this.vel += (want * maxV - this.vel) * Math.min(1, dt * (accel / maxV));

    const before = this.head;
    this.head = this.clamp(this.head + this.vel * dt, 0, LENGTH);
    if (this.head <= 0 || this.head >= LENGTH) this.vel *= 0.2;
    this.travelled += Math.abs(this.head - before);

    // ------------------------------------------------------------ requests
    for (let i = this.requests.length - 1; i >= 0; i--) {
      const r = this.requests[i];
      r.life -= dt;
      r.born += dt;

      // Served by passing over it. You do not stop, you do not click it — the
      // head reads what goes under it, which is what a tape head does.
      if (Math.abs(r.pos - this.head) < 1.2) {
        const urgency = 1 - r.life / r.max;
        const pts = Math.round(90 + urgency * 90);
        this.score += pts;
        this.served++;
        const px = this.posToPx(r.pos);
        this.toast(`READ +${pts}`, px.x, px.y - 22, 'good');
        this.requests.splice(i, 1);
        continue;
      }

      if (r.life <= 0) {
        if (this.over) { this.requests.splice(i, 1); continue; }
        this.expired++;
        this.score = Math.max(0, this.score - 120);
        const px = this.posToPx(r.pos);
        this.toast('EXPIRED', px.x, px.y - 22, 'bad');
        this.bump(0.7);
        this.requests.splice(i, 1);
        if (this.expired >= 3) this.finish('failed');
      }
    }

    // Pressure ramps by shortening deadlines and tightening the spawn gap.
    this.spawnT += dt;
    this.wave = Math.floor((SeekGame.duration - this.time) / 15);
    const gap = Math.max(0.9, this.spawnGap - this.wave * 0.22) / this.pace;
    if (this.spawnT > gap && this.requests.length < 12) {
      this.spawnT = 0;
      this.spawn();
    }
  }

  pointer(x, y, type) {
    const z = this.zoneAt(x, y);
    if (type === 'down') {
      if (z?.id === 'left') { this.dir = -1; this.target = null; return; }
      if (z?.id === 'right') { this.dir = 1; this.target = null; return; }
    }
    if (type === 'up' && (z?.id === 'left' || z?.id === 'right')) { this.dir = 0; return; }
    if (type === 'up') this.dir = 0;

    if (type === 'down' && z?.id === 'tape') {
      this.target = this.pxToPos(x, y);
      this.dir = 0;
    }
  }

  key(code, down) {
    if (code === 'ArrowLeft' || code === 'KeyA') { this.dir = down ? -1 : 0; this.target = null; }
    if (code === 'ArrowRight' || code === 'KeyD') { this.dir = down ? 1 : 0; this.target = null; }
  }

  meters() {
    const nearest = this.requests.reduce((m, r) => Math.min(m, r.life), 99);
    return [
      { label: 'EXPIRIES', value: this.clamp(this.expired / 3), danger: this.expired >= 2, text: `${Math.min(3, this.expired)} / 3` },
      { label: 'PENDING', value: Math.min(1, this.requests.length / 12), text: `${this.requests.length}` },
      { label: 'NEXT DEADLINE', value: this.requests.length ? this.clamp(nearest / 12) : 1, danger: nearest < 4 },
    ];
  }

  summary() {
    const perRecord = this.served ? (this.travelled / this.served).toFixed(1) : '—';
    return [
      ['RECORDS SERVED', `${this.served}`],
      ['EXPIRED', `${this.expired}`],
      ['TAPE TRAVELLED', `${Math.round(this.travelled)} units`],
      ['COST PER RECORD', `${perRecord} units`],
      this.expired >= 3
        ? ['VERDICT', 'Queue starved at one end of the reel']
        : ['VERDICT', this.travelled / Math.max(1, this.served) < 30 ? 'Efficient sweep' : 'A lot of winding for that'],
    ];
  }

  // -------------------------------------------------------------------- draw

  draw(g) {
    const t = this.theme;
    const pad = this.portrait ? 14 : 26;

    label(g, t, 'SEQUENTIAL ACCESS', pad, pad + 20, { size: 12, weight: 600, color: t.era });
    text(g, t, 'The head reads whatever passes under it. Distance is time.', pad, pad + 40, {
      size: 11, color: t.dim,
    });

    this.drawTape(g);

    button(g, t, this.leftBtn.x, this.leftBtn.y, this.leftBtn.w, this.leftBtn.h,
      this.portrait ? '▲ REWIND' : '◀ REWIND', { active: this.vel < -2 });
    button(g, t, this.rightBtn.x, this.rightBtn.y, this.rightBtn.w, this.rightBtn.h,
      this.portrait ? '▼ WIND' : 'WIND ▶', { active: this.vel > 2 });

    this.drawToasts(g);
  }

  drawTape(g) {
    const t = this.theme;
    const tp = this.tape;

    panel(g, t, tp.x - 20, tp.y - 20, tp.w + 40, tp.h + 40);

    // The ribbon.
    g.save();
    if (this.portrait) {
      rr(g, tp.x - 16, tp.y, 32, tp.h, 4);
    } else {
      rr(g, tp.x, tp.y - 16, tp.w, 32, 4);
    }
    g.fillStyle = 'rgba(255,255,255,0.035)';
    g.fill();
    g.strokeStyle = t.line;
    g.stroke();
    g.restore();

    // Position ticks every ten records, so travel is legible as distance.
    for (let p = 0; p <= LENGTH; p += 10) {
      const px = this.posToPx(p);
      g.save();
      g.globalAlpha = 0.3;
      g.strokeStyle = t.fg;
      g.beginPath();
      if (this.portrait) {
        g.moveTo(px.x - 22, px.y);
        g.lineTo(px.x - 16, px.y);
      } else {
        g.moveTo(px.x, px.y - 22);
        g.lineTo(px.x, px.y - 16);
      }
      g.stroke();
      g.restore();
      label(g, t, String(p), this.portrait ? px.x - 28 : px.x, this.portrait ? px.y + 4 : px.y - 28, {
        size: 8, align: this.portrait ? 'right' : 'center', color: t.dim,
      });
    }

    // Pending requests.
    for (const r of this.requests) {
      const px = this.posToPx(r.pos);
      const urgency = 1 - this.clamp(r.life / r.max);
      const col = urgency > 0.7 ? t.bad : urgency > 0.42 ? t.warn : t.era;
      const size = 9 + urgency * 3;

      glow(g, t, px.x, px.y, 22, col, 0.16 + urgency * 0.2);

      g.save();
      g.translate(px.x, px.y);
      g.rotate(Math.PI / 4);
      g.fillStyle = hexA(col, 0.9);
      g.fillRect(-size / 2, -size / 2, size, size);
      g.restore();

      // Deadline ring — a request you can still reach in time reads as calm.
      const rr2 = 15;
      g.save();
      g.strokeStyle = hexA(col, 0.85);
      g.lineWidth = 2;
      g.beginPath();
      g.arc(px.x, px.y, rr2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.clamp(r.life / r.max));
      g.stroke();
      g.restore();
    }

    // The head.
    const hp = this.posToPx(this.head);
    glow(g, t, hp.x, hp.y, 40, t.era, 0.3);
    g.save();
    g.strokeStyle = t.era;
    g.lineWidth = 2;
    g.beginPath();
    if (this.portrait) {
      g.moveTo(tp.x - 30, hp.y);
      g.lineTo(tp.x + 30, hp.y);
    } else {
      g.moveTo(hp.x, tp.y - 30);
      g.lineTo(hp.x, tp.y + 30);
    }
    g.stroke();
    g.fillStyle = t.era;
    rr(g, hp.x - 7, hp.y - 7, 14, 14, 3);
    g.fill();
    g.restore();

    // Velocity readout — the physical fact the whole game is built on.
    const spd = Math.abs(this.vel);
    label(g, t, `HEAD ${this.head.toFixed(0).padStart(3, '0')}`,
      this.portrait ? this.W / 2 : tp.x + tp.w / 2, tp.y + tp.h + 34,
      { size: 10, weight: 600, align: 'center', color: t.fg });
    label(g, t, spd > 1 ? `${this.vel > 0 ? 'WINDING' : 'REWINDING'} ${spd.toFixed(0)}` : 'STOPPED',
      this.portrait ? this.W / 2 : tp.x + tp.w / 2, tp.y + tp.h + 50,
      { size: 9, align: 'center', color: spd > 1 ? t.era : t.dim });
  }
}
