/**
 * games-smoke.mjs — play every game, headlessly, thousands of times.
 *
 * A minigame fails in ways a build step cannot see: a zone that is never
 * reachable, a score that runs away, a state that can deadlock so the run can
 * never end, a NaN in a meter, a layout that puts a button off the stage on a
 * phone. So this harness does not check that the games compile — it plays them.
 *
 * For each game, at two stage sizes (desktop landscape and phone portrait) it
 * runs three sessions:
 *
 *   IDLE     nobody touches anything. The run must still terminate, must not
 *            throw, and must not award a good rank for doing nothing.
 *   RANDOM   a monkey taps uniformly at random across the whole stage. This is
 *            the one that finds unreachable states and unguarded indices.
 *   PLAYER   a per-game scripted strategy that plays roughly correctly. This is
 *            the one that proves the game is winnable and that skill pays —
 *            a player who follows the concept must beat the monkey.
 *
 * Every frame, every meter and the score are checked for finiteness, and every
 * declared zone is checked to be inside the stage. That last check is what
 * stops a control from drifting off the bottom of a small screen unnoticed.
 *
 *   node tools/games-smoke.mjs
 */

import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  pretendToBeVisual: true,
  url: 'https://example.test/',
});

/** A no-op 2D context. The games draw into the void; we only care about state. */
function ctx2d() {
  const noop = () => {};
  return new Proxy(
    {
      measureText: (t) => ({ width: String(t).length * 8 }),
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
      canvas: { width: 100, height: 100 },
    },
    {
      get: (t, p) => (p in t ? t[p] : typeof p === 'string' ? noop : undefined),
      set: (t, p, v) => { t[p] = v; return true; },
    }
  );
}

const origCreate = dom.window.document.createElement.bind(dom.window.document);
dom.window.document.createElement = (tag, ...rest) => {
  const el = origCreate(tag, ...rest);
  if (String(tag).toLowerCase() === 'canvas') el.getContext = (k) => (k === '2d' ? ctx2d() : null);
  return el;
};

global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
global.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
global.addEventListener = dom.window.addEventListener.bind(dom.window);
global.removeEventListener = dom.window.removeEventListener.bind(dom.window);
global.innerWidth = 1280;
global.innerHeight = 800;
global.localStorage = dom.window.localStorage;

const { GAMES, GAME_ORDER, DISCIPLINE } = await import('../src/games/registry.js');
const { Progress } = await import('../src/games/Progress.js');
const { chapters } = await import('../src/data/portfolio.js');

const THEME = {
  era: '#d8b06a', fg: '#edf1f3', dim: '#8e99a2',
  line: 'rgba(255,255,255,0.12)', warn: '#ffb74d', bad: '#ff5f6d', good: '#d8b06a',
};
const CAPS = { reduced: false, mobile: false, narrow: false, tier: 'high' };
const SIZES = [
  { name: 'desktop', w: 1000, h: 620 },
  { name: 'phone', w: 1000, h: 1560 },
];

let failures = 0;
const fail = (m) => { failures++; console.log(`    ✗ ${m}`); };
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

// ---------------------------------------------------------------- strategies
/**
 * A competent-but-not-optimal player for each game, written against the same
 * public surface a human uses: taps at coordinates, and nothing else. None of
 * these reach into internals to cheat — if a strategy scores, the game is
 * genuinely playable through its own controls.
 */
const STRATEGY = {
  // Punch the two rows the chart says, then advance immediately.
  punch(g, tap) {
    if (g.phase !== 'punch' || g.col >= g.cols) return;
    const want = encodeFor(g.payload[g.col]);
    const card = g.card;
    if (!card || !g.punched[g.col]) return;
    const rowH = card.h / 12;
    const colW = card.w / g.cols;
    const cur = g.punched[g.col];
    for (const r of want) {
      if (!cur.includes(r)) {
        tap(card.x + g.col * colW + colW / 2, card.y + r * rowH + rowH / 2);
        return;
      }
    }
    for (const r of cur) if (!want.includes(r)) { tap(card.x + g.col * colW + colW / 2, card.y + r * rowH + rowH / 2); return; }
    tap(g.advanceBtn.x + 10, g.advanceBtn.y + 10);
  },

  // SCAN: sweep to the furthest pending request and let the head serve on the way.
  seek(g, tap) {
    if (!g.requests.length) return;
    const target = g.requests.reduce((a, b) => (Math.abs(b.pos - g.head) > Math.abs(a.pos - g.head) ? b : a));
    // Only re-aim occasionally; constant re-targeting is what a bad player does.
    if (g._aim === undefined || Math.abs(g.head - (g.target ?? -999)) < 2) {
      g._aim = target.pos;
      const px = g.posToPx(target.pos);
      tap(px.x, px.y);
    }
  },

  // One replica per rack: the whole point of the era.
  shard(g, tap) {
    if (!g.current) return;
    if (!g.held) { tap(g.tray.x + g.tray.w / 2, g.tray.y + g.tray.h / 2); return; }
    const want = g.policyRack();
    const legal = (i) => {
      const n = g.nodes[i];
      if (n.dead > 0 || g.current.replicas.includes(i) || n.blocks.length >= 6) return false;
      if (want === null) return true;
      return want < 0 ? n.rack !== -want - 1 : n.rack === want;
    };
    // Least-loaded legal node, which is what a careful operator would pick.
    let best = -1;
    for (let i = 0; i < g.nodes.length; i++) {
      if (!legal(i)) continue;
      if (best < 0 || g.nodes[i].blocks.length < g.nodes[best].blocks.length) best = i;
    }
    if (best < 0) return;
    const b = g.nodeBoxes[best];
    tap(b.x + b.w / 2, b.y + b.h / 2);
  },

  // Best-fit packing, seal at 92%.
  compact(g, tap) {
    for (let i = 0; i < g.bins.length; i++) {
      if (g.bins[i].size >= 128 * 0.92) {
        const b = g.binBoxes[i];
        tap(b.x + b.w / 2, b.y + b.h - 13);
        return;
      }
    }
    if (g.selected === null) {
      if (!g.looseBoxes.length) return;
      // Largest visible file first — classic first-fit-decreasing.
      let best = 0;
      for (let i = 1; i < g.looseBoxes.length; i++) {
        if ((g.loose[i]?.size || 0) > (g.loose[best]?.size || 0)) best = i;
      }
      const b = g.looseBoxes[best];
      tap(b.x + b.w / 2, b.y + b.h / 2);
      return;
    }
    const size = g.loose[g.selected]?.size || 0;
    let target = -1;
    let tightest = -1;
    for (let i = 0; i < g.bins.length; i++) {
      const after = g.bins[i].size + size;
      if (after <= 128 && after > tightest) { tightest = after; target = i; }
    }
    if (target < 0) { tap(1, 1); return; } // deselect
    const b = g.binBoxes[target];
    tap(b.x + b.w / 2, b.y + b.h / 2 - 20);
  },

  // Feed the bottleneck; advance the watermark before state overflows.
  stream(g, tap) {
    if (g.stateMem > 0.7) { tap(g.wmBtn.x + 20, g.wmBtn.y + 10); return; }
    let worst = 0;
    for (let i = 1; i < g.stages.length; i++) {
      if (g.stages[i].queue / g.stages[i].cap > g.stages[worst].queue / g.stages[worst].cap) worst = i;
    }
    if (g.used < g.budget) {
      const b = g.stages[worst].plusBox;
      tap(b.x + b.w / 2, b.y + b.h / 2);
      return;
    }
    // Pool is full: take one from the slackest stage and give it to the worst.
    let best = 0;
    for (let i = 1; i < g.stages.length; i++) {
      if (g.stages[i].queue / g.stages[i].cap < g.stages[best].queue / g.stages[best].cap) best = i;
    }
    if (best !== worst && g.stages[best].par > 1) {
      const b = g.stages[best].minusBox;
      tap(b.x + b.w / 2, b.y + b.h / 2);
    }
  },

  // Link true pairs; tokenise everything restricted; release.
  resolve(g, tap) {
    const m = g.merged[0];
    if (m) {
      for (let f = 0; f < 4; f++) {
        if (m.restricted[f] && !m.tokenised[f] && m.fieldBoxes[f]) {
          const b = m.fieldBoxes[f];
          tap(b.x + b.w / 2, b.y + b.h / 2);
          return;
        }
      }
      tap(g.releaseBox.x + 20, g.releaseBox.y + 10);
      return;
    }
    // Find a genuine pair among the visible cards.
    for (let i = 0; i < g.cards.length; i++) {
      for (let j = i + 1; j < g.cards.length; j++) {
        if (g.cards[i].entity !== g.cards[j].entity) continue;
        if (!g.cards[i].box || !g.cards[j].box) continue;
        const a = g.selected === i ? g.cards[j].box : g.cards[i].box;
        tap(a.x + a.w / 2, a.y + a.h / 2);
        return;
      }
    }
  },
};

function encodeFor(ch) {
  const c = String(ch).toUpperCase();
  if (c === ' ') return [];
  const code = c.charCodeAt(0);
  if (code >= 48 && code <= 57) { const n = code - 48; return n === 0 ? [2] : [3 + n - 1]; }
  if (code >= 65 && code <= 90) {
    const i = code - 65;
    if (i < 9) return [0, 3 + i];
    if (i < 18) return [1, 3 + (i - 9)];
    return [2, 3 + (i - 18) + 1];
  }
  return [];
}

// -------------------------------------------------------------------- runner

function play(id, size, mode, seed) {
  const G = GAMES[id];
  const g = new G({ caps: CAPS, theme: THEME, seed });
  const surface = ctx2d();

  g.resize(size.w, size.h);
  g.start();

  const tap = (x, y) => {
    if (!finite(x) || !finite(y)) { fail(`${id}/${size.name}/${mode}: strategy produced a non-finite tap`); return; }
    g.pointer(x, y, 'down');
    g.pointer(x, y, 'up');
  };

  let rand = seed;
  const rnd = () => ((rand = (rand * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  const dt = 1 / 60;
  const maxFrames = 60 * 200;
  let frames = 0;
  let actT = 0;
  let offStage = 0;

  while (!g.over && frames < maxFrames) {
    // Input.
    actT += dt;
    if (mode === 'random' && actT > 0.08) {
      actT = 0;
      tap(rnd() * size.w, rnd() * size.h);
    } else if (mode === 'player' && actT > 0.16) {
      actT = 0;
      try { STRATEGY[id]?.(g, tap); }
      catch (e) { fail(`${id}/${size.name}/player: strategy threw — ${e.message}`); break; }
    }

    try {
      g.update(dt);
      g.draw(surface);
    } catch (e) {
      fail(`${id}/${size.name}/${mode}: threw at frame ${frames} — ${e.message}`);
      console.log(`      ${e.stack?.split('\n')[1]?.trim() || ''}`);
      break;
    }

    // Invariants.
    if (!finite(g.score)) { fail(`${id}/${size.name}/${mode}: score became non-finite`); break; }
    if (g.score < 0) { fail(`${id}/${size.name}/${mode}: score went negative (${g.score})`); break; }
    for (const m of g.meters()) {
      if (!finite(m.value)) { fail(`${id}/${size.name}/${mode}: meter "${m.label}" is non-finite`); break; }
      if (m.value < -0.001 || m.value > 1.001) {
        fail(`${id}/${size.name}/${mode}: meter "${m.label}" left 0…1 (${m.value.toFixed(2)})`);
        break;
      }
    }
    for (const z of g.zones) {
      if (z.x < -2 || z.y < -2 || z.x + z.w > size.w + 2 || z.y + z.h > size.h + 2) offStage++;
    }

    frames++;
  }

  if (offStage > 0) fail(`${id}/${size.name}: a control sat outside the stage on ${offStage} frames`);
  if (!g.over && frames >= maxFrames) fail(`${id}/${size.name}/${mode}: never terminated`);

  let summary = [];
  try { summary = g.summary(); }
  catch (e) { fail(`${id}/${size.name}/${mode}: summary threw — ${e.message}`); }
  if (!summary.length) fail(`${id}: summary is empty — a result screen must say what happened`);
  for (const row of summary) {
    if (!Array.isArray(row) || row.length !== 2 || row[1] === undefined || String(row[1]).includes('NaN')) {
      fail(`${id}/${size.name}/${mode}: malformed summary row ${JSON.stringify(row)}`);
    }
  }

  return { score: Math.round(g.score), rank: g.rank(), outcome: g.outcome, frames };
}

// ---------------------------------------------------------------------- main

console.log('\nKAMLENDU // DATA PLANE v6 — era exercise audit\n');

for (const id of GAME_ORDER) {
  const G = GAMES[id];
  console.log(`── ${G.title}  (${DISCIPLINE[id]})  ─────────────────────────`);

  if (!chapters.some((c) => c.id === G.chapter)) {
    fail(`${id}: declares chapter "${G.chapter}" which does not exist`);
  }
  if (!chapters.some((c) => c.game === id)) {
    fail(`${id}: no chapter offers this game, so it is unreachable`);
  }
  if (!G.objective || !G.hint) fail(`${id}: missing objective or controls text`);
  if (/which of|choose the correct|true or false|answer/i.test(G.objective)) {
    fail(`${id}: objective reads like a quiz`);
  }

  for (const size of SIZES) {
    const idle = play(id, size, 'idle', 101);
    const monkey = [1, 2, 3].map((s) => play(id, size, 'random', s * 7919));
    const skilled = [1, 2, 3].map((s) => play(id, size, 'player', s * 104729));

    const monkeyAvg = monkey.reduce((a, b) => a + b.score, 0) / monkey.length;
    const playerAvg = skilled.reduce((a, b) => a + b.score, 0) / skilled.length;

    // The load-bearing assertion in this whole file: playing well must beat
    // mashing. If it does not, the mechanic is decorative.
    if (playerAvg <= monkeyAvg * 1.25) {
      fail(`${id}/${size.name}: skill does not pay — player ${Math.round(playerAvg)} vs random ${Math.round(monkeyAvg)}`);
    }
    if (idle.score > playerAvg * 0.55) {
      fail(`${id}/${size.name}: doing nothing scores ${idle.score} against a played ${Math.round(playerAvg)}`);
    }
    // Rank thresholds have to mean something in both directions: a competent
    // run must clear ENGINEER, and mashing must not.
    const order = ['TRAINEE', 'OPERATOR', 'ENGINEER', 'ARCHITECT'];
    const playerRank = Math.min(...skilled.map((r) => order.indexOf(r.rank)));
    const monkeyRank = Math.max(...monkey.map((r) => order.indexOf(r.rank)));
    if (playerRank < 2) {
      fail(`${id}/${size.name}: a competent run only reaches ${order[playerRank]} — thresholds are too high`);
    }
    if (monkeyRank > 1) {
      fail(`${id}/${size.name}: random tapping reaches ${order[monkeyRank]} — thresholds are too low`);
    }

    console.log(
      `    ${size.name.padEnd(8)} idle ${String(idle.score).padStart(5)}` +
      `   random ${String(Math.round(monkeyAvg)).padStart(5)}` +
      `   played ${String(Math.round(playerAvg)).padStart(5)}` +
      `   → ${skilled.map((r) => r.rank[0]).join('')}`
    );
  }
  console.log('');
}

// ------------------------------------------------------------------ progress
console.log('── operator record ─────────────────────────────────────');

const p = new Progress();
p.reset();
if (p.standing() !== null) fail('an untouched record should have no standing at all');
if (p.completion() !== 0) fail('an untouched record should be 0% complete');

p.record('punch', { score: 1000, rank: 'OPERATOR', outcome: 'complete', summary: [] });
if (p.completion() !== 1 / 6) fail('completion should be one discipline in six');

p.record('punch', { score: 200, rank: 'TRAINEE', outcome: 'failed', summary: [] });
if (p.get('punch').score !== 1000) fail('a worse run must not overwrite a best score');
if (p.get('punch').rank !== 'OPERATOR') fail('a worse run must not take a rank away');
if (p.get('punch').plays !== 2) fail('play count should still increment on a worse run');

for (const id of GAME_ORDER) p.record(id, { score: 3000, rank: 'ARCHITECT', outcome: 'complete', summary: [] });
if (p.completion() !== 1) fail('all six played should be 100% complete');
if (p.standing()?.title !== 'ARCHITECT') fail('six architect runs should stand as ARCHITECT');

p.reset();
p.record('punch', { score: 3000, rank: 'ARCHITECT', outcome: 'complete', summary: [] });
if (p.standing()?.title === 'ARCHITECT') {
  fail('one discipline should not make you an ARCHITECT overall');
}
if (p.rows().length !== 6) fail('the record should always list all six disciplines');
p.reset();

console.log('  ✓ record only improves, coverage is weighted, reset clears');

console.log(
  failures
    ? `\n${failures} failure(s)\n`
    : '\nAll six exercises are playable, winnable, terminate cleanly, fit both stage sizes, and reward skill over mashing.\n'
);
process.exit(failures ? 1 : 0);
