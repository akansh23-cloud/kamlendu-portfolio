import { MiniGame } from './MiniGame.js';
import { panel, label, text, bar, rr, glow, hexA } from './gfx2d.js';

/**
 * SHARD — the distributed era.
 *
 * Replication factor three, rack awareness, and a chaos monkey. The rule the
 * game refuses to state and instead makes you discover: three copies on three
 * different nodes is not safety if all three nodes are in the same rack,
 * because the thing that fails is usually the rack — a switch, a PDU, a
 * breaker — and not one machine at a time.
 *
 * So a placement that looks perfectly balanced can lose data on the first
 * outage, and the first time that happens is the moment the concept lands.
 * After that you start splitting racks without being told to, which is the
 * entire lesson of HDFS block placement.
 *
 * Everything is tap-to-select then tap-to-place. No dragging, ever.
 */

const RACKS = 3;
const PER_RACK = 3;
const RF = 3;
const CAPACITY = 6;

export class ShardGame extends MiniGame {
  static id = 'shard';
  static title = 'SHARD';
  static chapter = 'distributed';
  static objective =
    'Place three replicas of every block under the real placement policy: first anywhere, second on a different rack, third alongside the second. Then survive the outages.';
  static hint = 'Tap the tray to claim · legal nodes glow · a refused write costs a backoff';
  static duration = 80;
  static ranks = [0, 2400, 4100, 6200];

  constructor(ctx) {
    super(ctx);

    this.nodes = [];
    for (let r = 0; r < RACKS; r++) {
      for (let n = 0; n < PER_RACK; n++) {
        this.nodes.push({ rack: r, index: this.nodes.length, blocks: [], dead: 0, heat: 0 });
      }
    }

    this.blocks = [];         // committed blocks: { id, replicas:[nodeIdx], lost }
    this.current = null;      // the block being placed
    this.nextId = 1;
    this.placed = 0;
    this.lost = 0;
    this.underReplicated = 0;

    this.chaosT = 0;
    this.chaosGap = 13;
    this.warning = null;      // { rack, t } — telegraphed outage
    this.blockT = 0;
    this.wave = 0;
    this.cooldown = 0;
    this.rejects = 0;
    this.held = false;
    this.pending = 0;
  }

  layout() {
    const pad = this.portrait ? 14 : 26;
    const top = pad + 62;
    const trayH = this.portrait ? 96 : 110;

    this.tray = { x: pad, y: this.H - pad - trayH, w: this.W - pad * 2, h: trayH };

    const gridY = top + 8;
    const gridH = this.tray.y - gridY - 16;
    const gridW = this.W - pad * 2;

    this.rackBoxes = [];
    this.nodeBoxes = [];

    // Racks are columns on a wide screen and rows on a phone, because the
    // "these three are in the same rack" reading has to survive both.
    for (let r = 0; r < RACKS; r++) {
      const box = this.portrait
        ? { x: pad, y: gridY + (gridH / RACKS) * r + 4, w: gridW, h: gridH / RACKS - 8 }
        : { x: pad + (gridW / RACKS) * r + 6, y: gridY, w: gridW / RACKS - 12, h: gridH };
      this.rackBoxes.push(box);

      for (let n = 0; n < PER_RACK; n++) {
        const nb = this.portrait
          ? { x: box.x + 12 + ((box.w - 24) / PER_RACK) * n + 4, y: box.y + 26, w: (box.w - 24) / PER_RACK - 8, h: box.h - 36 }
          : { x: box.x + 10, y: box.y + 30 + ((box.h - 40) / PER_RACK) * n + 4, w: box.w - 20, h: (box.h - 40) / PER_RACK - 8 };
        this.nodeBoxes.push(nb);
      }
    }

    this.rebuildZones();
  }

  rebuildZones() {
    this.clearZones();
    for (let i = 0; i < this.nodeBoxes.length; i++) {
      const b = this.nodeBoxes[i];
      this.zone(`node-${i}`, b.x, b.y, b.w, b.h, { node: i });
    }
    // Claiming the block off the write queue before placing it is one extra
    // tap for a person who is paying attention and a wall for one who is not:
    // you cannot place a block you have not taken, so tapping nodes at random
    // achieves nothing at all.
    this.zone('claim', this.tray.x, this.tray.y, this.tray.w, this.tray.h);
  }

  start() {
    this.newBlock();
    this.pending = 0.2;
  }

  /**
   * Blocks arrive on the write pipeline's clock, not on yours.
   *
   * This is the line that makes the game about placement quality rather than
   * tapping speed. Without it the fastest strategy is to spray the cluster and
   * let volume outrun the mistakes — which is both bad play and, worse, a game
   * that rewards it. With a bounded ingest rate everybody places roughly the
   * same number of blocks and the only variable left is where they go.
   */
  newBlock() {
    this.current = null;
    this.held = false;
    this.pending = 0.75;
    this.blockT = 0;
    this.blockRejects = 0;
  }

  /** Which rack the next replica must land in, or null if any will do. */
  policyRack() {
    const r = this.current?.replicas || [];
    if (r.length === 0) return null;                       // first: anywhere
    if (r.length === 1) return -this.nodes[r[0]].rack - 1;  // second: not this one
    return this.nodes[r[1]].rack;                          // third: with the second
  }

  /** Human-readable instruction for the tray. */
  policyHint() {
    const r = this.current?.replicas || [];
    if (!this.held) return 'CLAIM THE BLOCK';
    if (r.length === 0) return 'REPLICA 1 — ANY NODE WITH ROOM';
    if (r.length === 1) return `REPLICA 2 — ANY RACK EXCEPT ${this.nodes[r[0]].rack + 1}`;
    return `REPLICA 3 — RACK ${this.nodes[r[1]].rack + 1}, DIFFERENT NODE`;
  }

  /** Live count of blocks that no longer have a surviving copy anywhere. */
  audit() {
    let lost = 0;
    let under = 0;
    for (const b of this.blocks) {
      const alive = b.replicas.filter((i) => this.nodes[i].dead <= 0).length;
      if (alive === 0) lost++;
      else if (alive < 2) under++;
    }
    return { lost, under };
  }

  update(dt) {
    this.updateToasts(dt);
    this.time -= dt;
    if (this.time <= 0) { this.finish('survived'); return; }

    this.blockT += dt;

    if (this.pending > 0) {
      this.pending -= dt * this.pace;
      if (this.pending <= 0) {
        this.pending = 0;
        this.current = { id: this.nextId++, replicas: [] };
        this.blockT = 0;
      }
    }

    this.cooldown = Math.max(0, this.cooldown - dt);
    this.trayHeat = Math.max(0, (this.trayHeat || 0) - dt * 2);

    for (const n of this.nodes) {
      if (n.dead > 0) {
        n.dead -= dt;
        if (n.dead <= 0) {
          n.dead = 0;
          // The disks come back with the node. An outage here is a switch or a
          // breaker, not a wipe — and modelling it as a wipe quietly punished
          // players who had followed the placement policy exactly.
        }
      }
      n.heat = Math.max(0, n.heat - dt * 2);
    }

    // -------------------------------------------------------------- chaos
    this.chaosT += dt;
    this.wave = Math.floor((ShardGame.duration - this.time) / 20);
    const gap = Math.max(7, this.chaosGap - this.wave * 1.6) / this.pace;

    const recovering = this.nodes.some((n) => n.dead > 0);
    if (!this.warning && !recovering && this.chaosT > gap - 4) {
      // Outages are telegraphed. Reacting to a warning is the interesting
      // decision; being killed with no notice is just noise.
      const wholeRack = this.rand() < 0.42 + this.wave * 0.08;
      this.warning = {
        rack: wholeRack ? Math.floor(this.rand() * RACKS) : -1,
        node: wholeRack ? -1 : Math.floor(this.rand() * this.nodes.length),
        t: 4,
      };
    }

    if (this.warning) {
      this.warning.t -= dt;
      if (this.warning.t <= 0) {
        const killed = this.warning.rack >= 0
          ? this.nodes.filter((n) => n.rack === this.warning.rack)
          : [this.nodes[this.warning.node]];
        for (const n of killed) n.dead = 9;

        const before = this.audit();
        const newlyLost = before.lost - this.lost;
        if (newlyLost > 0) {
          this.lost = before.lost;
          this.score = Math.max(0, this.score - 460 * newlyLost);
          this.toast(`DATA LOSS ×${newlyLost}`, this.W / 2, this.H * 0.4, 'bad');
          this.bump(1);
        } else {
          // Surviving an outage with nothing on the cluster is not a survival.
          const atStake = this.blocks.filter((b) =>
            b.replicas.some((i) => killed.includes(this.nodes[i]))
          ).length;
          if (atStake === 0) { this.warning = null; this.chaosT = 0; return; }
          this.score += Math.round(60 + 46 * Math.min(4, atStake));
          this.toast(
            this.warning.rack >= 0
              ? `RACK ${this.warning.rack + 1} DOWN · ${atStake} BLOCKS UNHARMED`
              : `NODE DOWN · ${atStake} BLOCKS UNHARMED`,
            this.W / 2, this.H * 0.4, 'good'
          );
        }
        this.warning = null;
        this.chaosT = 0;
      }
    }
  }

  /**
   * A rejected placement costs a retry backoff.
   *
   * This is the line that stops the game rewarding someone who just taps
   * everywhere: a placement onto a dead node, a full node, or one that already
   * holds this block is refused and the writer backs off for a moment. A person
   * who is reading the cluster never triggers it. A person who is spraying is
   * in backoff more often than not — which is also, accurately, what happens to
   * a client that keeps asking for placements the namenode will not honour.
   */
  reject(nodeIdx, msg, cost = 1.5) {
    this.cooldown = cost;
    this.rejects++;
    this.blockRejects = (this.blockRejects || 0) + 1;
    const b = this.nodeBoxes[nodeIdx];
    this.toast(msg, b.x + b.w / 2, b.y + 12, 'warn');
  }

  place(nodeIdx) {
    if (!this.current) return;
    if (this.cooldown > 0) return;

    if (!this.held) { this.reject(nodeIdx, 'CLAIM THE BLOCK', 0.45); return; }

    const node = this.nodes[nodeIdx];
    if (node.dead > 0) { this.reject(nodeIdx, 'NODE DOWN'); return; }
    if (this.current.replicas.includes(nodeIdx)) { this.reject(nodeIdx, 'ALREADY HERE'); return; }
    if (node.blocks.length >= CAPACITY) { this.reject(nodeIdx, 'NODE FULL'); return; }

    // The placement policy is refused, not merely scored down. This is the
    // real HDFS default and it is stricter than "spread them about":
    //
    //   replica 1  anywhere with room
    //   replica 2  a DIFFERENT rack from the first
    //   replica 3  the SAME rack as the second, a different node
    //
    // The reason is not symmetry, it is bandwidth. Two copies on one remote
    // rack survive that rack's switch dying no worse than one copy would, and
    // they cost a single cross-rack write instead of two. Guessing does not
    // find this shape, which is exactly why the game refuses the guess.
    const want = this.policyRack();
    const ok = want === null
      ? true
      : want < 0 ? node.rack !== (-want - 1) : node.rack === want;
    if (!ok) {
      this.reject(nodeIdx, this.current.replicas.length === 1 ? 'MUST CROSS RACKS' : 'SAME RACK AS #2');
      return;
    }

    this.current.replicas.push(nodeIdx);
    node.blocks.push(this.current.id);
    node.heat = 1;

    if (this.current.replicas.length >= RF) {
      const racks = new Set(this.current.replicas.map((i) => this.nodes[i].rack));
      // The scoring is the only hint the game gives, and it gives it after the
      // fact: spreading racks simply pays more.
      // Every completed block now conforms by construction, so the score
      // rewards doing it without wasting writes rather than re-testing shape.
      const clean = this.blockRejects === 0;
      const pts = clean ? 300 : Math.max(90, 300 - this.blockRejects * 70);
      this.score = Math.max(0, this.score + pts);
      this.placed++;
      this.toast(
        clean ? `POLICY CLEAN +${pts}` : `${racks.size} RACKS · ${this.blockRejects} RETRIES +${pts}`,
        this.W / 2, this.H * 0.32,
        clean ? 'good' : 'warn'
      );
      this.blocks.push(this.current);
      this.newBlock();
    }
  }

  pointer(x, y, type) {
    if (type !== 'down') return;
    const z = this.zoneAt(x, y);
    if (z?.id === 'claim') {
      if (this.current && !this.held) { this.held = true; this.trayHeat = 1; }
      return;
    }
    if (z?.data?.node !== undefined) this.place(z.data.node);
  }

  meters() {
    const a = this.audit();
    const cap = this.nodes.reduce((s, n) => s + n.blocks.length, 0) / (this.nodes.length * CAPACITY);
    return [
      { label: 'BLOCKS LIVE', value: Math.min(1, this.blocks.length / 14), text: `${this.blocks.length - this.lost}` },
      { label: 'CLUSTER FULL', value: this.clamp(cap), danger: cap > 0.82 },
      { label: 'AT RISK', value: Math.min(1, a.under / 4), danger: a.under > 0, text: `${a.under}` },
      { label: 'WRITER', value: 1 - this.clamp(this.cooldown / 1.5), danger: this.cooldown > 0, text: this.cooldown > 0 ? 'BACKOFF' : this.held ? 'HOLDING' : 'QUEUED' },
    ];
  }

  summary() {
    const a = this.audit();
    const spread = this.blocks.length
      ? this.blocks.filter((b) => new Set(b.replicas.map((i) => this.nodes[i].rack)).size >= 2).length /
        this.blocks.length
      : 0;
    return [
      ['BLOCKS PLACED', `${this.placed}`],
      ['BLOCKS LOST', `${this.lost}`],
      ['RACK-SPREAD', `${Math.round(spread * 100)}%`],
      ['CLEAN PLACEMENTS', `${this.placed ? Math.round((1 - Math.min(1, this.rejects / (this.placed * 3))) * 100) : 0}%`],
      ['STILL AT RISK', `${a.under}`],
      ['REJECTED WRITES', `${this.rejects}`],
      this.lost === 0
        ? ['VERDICT', 'Every outage was survivable. That is what the policy buys.']
        : ['VERDICT', 'Replicas sat in one failure domain'],
    ];
  }

  // -------------------------------------------------------------------- draw

  draw(g) {
    const t = this.theme;
    const pad = this.portrait ? 14 : 26;

    label(g, t, 'BLOCK PLACEMENT', pad, pad + 20, { size: 12, weight: 600, color: t.era });
    text(g, t, `Replication factor ${RF} · a copy is only a copy if it fails separately`, pad, pad + 40, {
      size: 11, color: t.dim,
    });

    for (let r = 0; r < RACKS; r++) this.drawRack(g, r);
    this.drawTray(g);

    if (this.warning) {
      const which = this.warning.rack >= 0 ? `RACK ${this.warning.rack + 1}` : `NODE ${this.warning.node + 1}`;
      const flash = Math.sin(this._pulse * 12) > 0;
      label(g, t, `⚠ ${which} FAILING IN ${Math.ceil(this.warning.t)}`, this.W / 2, pad + 22, {
        size: 12, weight: 600, align: 'center', color: flash ? t.bad : t.warn,
      });
    }

    this.drawToasts(g);
  }

  drawRack(g, r) {
    const t = this.theme;
    const box = this.rackBoxes[r];
    const warned = this.warning?.rack === r;
    const dead = this.nodes.filter((n) => n.rack === r).every((n) => n.dead > 0);

    panel(g, t, box.x, box.y, box.w, box.h, {
      stroke: warned ? t.bad : dead ? hexA(t.bad, 0.4) : t.line,
      fill: dead ? 'rgba(255,80,90,0.03)' : 'rgba(255,255,255,0.015)',
    });
    label(g, t, `RACK ${r + 1}`, box.x + 12, box.y + 18, {
      size: 9, weight: 600, color: warned ? t.bad : t.dim,
    });

    for (let n = 0; n < PER_RACK; n++) {
      const idx = r * PER_RACK + n;
      this.drawNode(g, idx);
    }
  }

  drawNode(g, idx) {
    const t = this.theme;
    const b = this.nodeBoxes[idx];
    const node = this.nodes[idx];
    const isDead = node.dead > 0;
    const holdsCurrent = this.current?.replicas.includes(idx);
    const want = this.policyRack();
    const legal =
      this.held && !isDead && !holdsCurrent && node.blocks.length < CAPACITY &&
      (want === null ? true : want < 0 ? node.rack !== -want - 1 : node.rack === want);

    panel(g, t, b.x, b.y, b.w, b.h, {
      stroke: isDead ? hexA(t.bad, 0.6) : holdsCurrent ? t.era : legal ? hexA(t.era, 0.55) : t.line,
      fill: isDead ? 'rgba(255,80,90,0.05)' : 'rgba(255,255,255,0.03)',
      accent: holdsCurrent,
    });

    if (legal) glow(g, t, b.x + b.w / 2, b.y + b.h / 2, b.w * 0.55, t.era, 0.09);
    if (node.heat > 0) glow(g, t, b.x + b.w / 2, b.y + b.h / 2, b.w * 0.6, t.era, node.heat * 0.18);

    label(g, t, `N${idx + 1}`, b.x + 8, b.y + 15, {
      size: 8, weight: 600, color: isDead ? t.bad : t.dim,
    });

    if (isDead) {
      label(g, t, 'DOWN', b.x + b.w / 2, b.y + b.h / 2 + 4, {
        size: 10, weight: 600, align: 'center', color: t.bad,
      });
      return;
    }

    // Stored blocks as a small stack of chips — capacity is visible, not a number.
    const cols = 3;
    const cw = (b.w - 20) / cols;
    const ch = 7;
    for (let i = 0; i < node.blocks.length; i++) {
      const cx = b.x + 10 + (i % cols) * cw;
      const cy = b.y + b.h - 12 - Math.floor(i / cols) * (ch + 3);
      const isCur = this.current && node.blocks[i] === this.current.id;
      g.save();
      rr(g, cx, cy - ch, cw - 3, ch, 1.5);
      g.fillStyle = isCur ? t.era : hexA(t.era, 0.4);
      g.fill();
      g.restore();
    }

    bar(g, t, b.x + 8, b.y + b.h - 5, b.w - 16, 2, node.blocks.length / CAPACITY, {
      warnAt: node.blocks.length >= CAPACITY ? 0 : 2,
    });
  }

  drawTray(g) {
    const t = this.theme;
    const tr = this.tray;
    panel(g, t, tr.x, tr.y, tr.w, tr.h, {
      accent: true,
      stroke: this.held ? t.era : hexA(t.era, 0.45),
      fill: this.held ? hexA(t.era, 0.05) : 'rgba(255,255,255,0.02)',
      glowAmt: this.held ? 0 : 0.35 + Math.sin(this._pulse * 3) * 0.2,
    });
    if (this.trayHeat > 0) glow(g, t, tr.x + tr.w / 2, tr.y + tr.h / 2, tr.w * 0.4, t.era, this.trayHeat * 0.18);

    const backoff = this.cooldown > 0;
    const heading = backoff
      ? 'WRITER BACKOFF'
      : this.pending > 0
        ? 'WAITING FOR NEXT BLOCK'
        : this.policyHint();
    label(g, t, heading, tr.x + 14, tr.y + 22, {
      size: 9, weight: 600, color: backoff ? t.warn : this.held ? t.era : t.fg,
    });
    if (backoff) bar(g, t, tr.x + 140, tr.y + 17, 90, 4, 1 - this.cooldown / 1.5, { color: t.warn });

    if (!this.current) {
      bar(g, t, tr.x + 14, tr.y + tr.h / 2, tr.w - 28, 4, 1 - this.pending / 0.75);
      return;
    }

    label(g, t, `BLK-${String(this.current.id).padStart(4, '0')}`, tr.x + 14, tr.y + 48, {
      size: 18, weight: 600, color: t.fg,
    });

    // Replica slots. Three empty boxes is a clearer instruction than a sentence.
    const sx = this.portrait ? tr.x + 14 : tr.x + 200;
    const sy = this.portrait ? tr.y + 62 : tr.y + 32;
    for (let i = 0; i < RF; i++) {
      const x = sx + i * 46;
      const filled = i < this.current.replicas.length;
      g.save();
      rr(g, x, sy, 38, 30, 3);
      g.fillStyle = filled ? hexA(t.era, 0.28) : 'rgba(255,255,255,0.03)';
      g.fill();
      g.strokeStyle = filled ? t.era : t.line;
      if (!filled) g.setLineDash([3, 3]);
      g.stroke();
      g.restore();
      if (filled) {
        const ni = this.current.replicas[i];
        label(g, t, `N${ni + 1}`, x + 19, sy + 19, { size: 9, weight: 600, align: 'center', color: t.fg });
      }
    }

    const want = this.policyRack();
    const msg = want === null
      ? 'ANY RACK'
      : want < 0 ? `NOT RACK ${-want}` : `RACK ${want + 1}`;
    label(g, t, msg, this.portrait ? tr.x + tr.w - 14 : sx + RF * 46 + 16,
      this.portrait ? tr.y + 22 : sy + 19,
      { size: 10, weight: 600, align: this.portrait ? 'right' : 'left', color: t.era });
  }
}
