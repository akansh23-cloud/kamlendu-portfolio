import { GAMES, gameMeta } from './registry.js';
import { chapters } from '../data/portfolio.js';
import { clamp } from '../lib/math.js';

/**
 * GameHost — the shell the six games run inside.
 *
 * Three decisions worth defending.
 *
 * WHY A 2D CANVAS AND NOT THREE.JS. These games need crisp text, exact hit
 * targets and a readable layout on a 390px phone. Picking a 12-row punch card
 * with a raycaster, or rendering a lag meter as geometry, would be worse in
 * every way that matters and would have cost five times the code. The 3D world
 * stays live behind the panel and keeps reacting to what you do, which is the
 * part that actually needed to be three-dimensional.
 *
 * WHY THE SCROLL LOCK WORKS THIS WAY. The obvious approach — `overflow:hidden`
 * or `position:fixed` on the body — changes layout, and this project's entire
 * timeline is measured from real `offsetTop`. Locking that way would silently
 * re-measure every chapter the moment a game opened. Instead the host swallows
 * scroll input and pins the position back if anything slips through, so the
 * document never moves and never re-lays-out.
 *
 * WHY INTRO AND RESULTS ARE DOM, NOT CANVAS. They are text. Text belongs in the
 * document, where it can be read by a screen reader, selected, and styled by
 * the same stylesheet as everything else. Only the live gameplay is painted.
 */
export class GameHost {
  constructor({ caps, progress, onOpen, onClose, onEvent }) {
    this.caps = caps;
    this.progress = progress;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.onEvent = onEvent;

    this.game = null;
    this.meta = null;
    this.phase = 'idle'; // idle | intro | playing | over
    this.open = false;
    this.focus = 0;

    this._lockY = 0;
    this._dpr = 1;
    this._stage = { x: 0, y: 0, w: 1, h: 1, scale: 1 };
    this._keysDown = new Set();

    this.build();
    this.bind();
  }

  // ------------------------------------------------------------------- DOM

  build() {
    const el = document.createElement('div');
    el.id = 'gamelayer';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Era exercise');
    el.innerHTML = `
      <div class="game-shell">
        <header class="game-top">
          <div class="game-id">
            <b id="gameTitle">GAME</b>
            <span id="gameChapter"></span>
          </div>
          <div class="game-stats">
            <span class="game-stat"><i>SCORE</i><b id="gameScore">0</b></span>
            <span class="game-stat" id="gameTimeWrap"><i>TIME</i><b id="gameTime">—</b></span>
          </div>
          <button class="game-exit" id="gameExit" type="button">Exit <kbd>esc</kbd></button>
        </header>

        <div class="game-stage">
          <canvas id="gameCanvas"></canvas>

          <div class="game-card" id="gameIntro" hidden>
            <span class="game-kicker" id="introKicker"></span>
            <h2 id="introTitle"></h2>
            <p id="introObjective"></p>
            <div class="game-controls" id="introHint"></div>
            <div class="game-card-actions">
              <button class="action" id="introStart" type="button">Start</button>
              <button class="action ghost" id="introSkip" type="button">Back to the story</button>
            </div>
            <p class="game-note">Optional. Nothing in this portfolio is locked behind it.</p>
          </div>

          <div class="game-card" id="gameResult" hidden>
            <span class="game-kicker" id="resultKicker"></span>
            <h2 id="resultRank"></h2>
            <dl class="game-summary" id="resultSummary"></dl>
            <div class="game-card-actions">
              <button class="action" id="resultAgain" type="button">Run it again</button>
              <button class="action ghost" id="resultDone" type="button">Back to the story</button>
            </div>
          </div>
        </div>

        <footer class="game-foot">
          <div class="game-meters" id="gameMeters"></div>
          <p class="game-hint" id="gameHint"></p>
        </footer>
      </div>`;
    document.body.appendChild(el);

    this.el = el;
    this.canvas = el.querySelector('#gameCanvas');
    this.g = this.canvas.getContext('2d');
    this.introEl = el.querySelector('#gameIntro');
    this.resultEl = el.querySelector('#gameResult');
    this.metersEl = el.querySelector('#gameMeters');
    this.scoreEl = el.querySelector('#gameScore');
    this.timeEl = el.querySelector('#gameTime');
    this.timeWrap = el.querySelector('#gameTimeWrap');
    this.hintEl = el.querySelector('#gameHint');
  }

  bind() {
    const q = (s) => this.el.querySelector(s);

    q('#gameExit').addEventListener('click', () => this.close());
    q('#introSkip').addEventListener('click', () => this.close());
    q('#resultDone').addEventListener('click', () => this.close());
    q('#introStart').addEventListener('click', () => this.begin());
    q('#resultAgain').addEventListener('click', () => this.launch(this.meta.id, this.theme, true));

    // Pointer. Coordinates are converted into the game's virtual stage space
    // so no game ever deals with pixels, DPR or letterboxing.
    const toStage = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) - this._stage.x) / this._stage.scale,
        y: ((e.clientY - r.top) - this._stage.y) / this._stage.scale,
      };
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.phase !== 'playing') return;
      e.preventDefault();
      this.canvas.setPointerCapture?.(e.pointerId);
      const p = toStage(e);
      this.game?.pointer(p.x, p.y, 'down');
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.phase !== 'playing') return;
      const p = toStage(e);
      this.game?.pointer(p.x, p.y, 'move');
    });
    const up = (e) => {
      if (this.phase !== 'playing') return;
      const p = toStage(e);
      this.game?.pointer(p.x, p.y, 'up');
    };
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Keyboard.
    addEventListener('keydown', (e) => {
      if (!this.open) return;
      if (e.key === 'Escape') { e.preventDefault(); this.close(); return; }
      if (this.phase === 'intro' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        this.begin();
        return;
      }
      if (this.phase !== 'playing') return;
      // Everything that would scroll the page is swallowed while playing.
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
      }
      if (this._keysDown.has(e.code)) return;
      this._keysDown.add(e.code);
      this.game?.key(e.code, true);
    }, { passive: false });

    addEventListener('keyup', (e) => {
      if (!this.open) return;
      this._keysDown.delete(e.code);
      if (this.phase === 'playing') this.game?.key(e.code, false);
    });

    // Scroll suppression. The document must not move, and must not re-lay-out.
    const swallow = (e) => { if (this.open) e.preventDefault(); };
    addEventListener('wheel', swallow, { passive: false });
    addEventListener('touchmove', (e) => {
      if (this.open && !e.target.closest?.('.game-card')) e.preventDefault();
    }, { passive: false });
    addEventListener('scroll', () => {
      if (this.open && Math.abs(scrollY - this._lockY) > 1) scrollTo(0, this._lockY);
    }, { passive: true });

    addEventListener('resize', () => this.resize(), { passive: true });
  }

  // -------------------------------------------------------------- lifecycle

  /** Colour the whole shell with the era the game belongs to. */
  applyTheme(theme) {
    this.theme = theme;
    const s = this.el.style;
    s.setProperty('--game-era', theme.era);
    s.setProperty('--game-warn', theme.warn);
    s.setProperty('--game-bad', theme.bad);
  }

  launch(id, theme, replay = false) {
    const G = GAMES[id];
    if (!G) return false;

    this.meta = gameMeta(id);
    this.applyTheme(theme);

    const chapter = chapters.find((c) => c.id === G.chapter);
    this.el.querySelector('#gameTitle').textContent = G.title;
    this.el.querySelector('#gameChapter').textContent = chapter ? chapter.name : '';
    this.el.querySelector('#introKicker').textContent = `${this.meta.discipline} · ERA EXERCISE`;
    this.el.querySelector('#introTitle').textContent = G.title;
    this.el.querySelector('#introObjective').textContent = G.objective;

    const best = this.progress.get(id);
    this.el.querySelector('#introHint').innerHTML =
      `<span>${G.hint}</span>` +
      (best ? `<span class="game-best">BEST ${best.score} · ${best.rank}</span>` : '');

    this.hintEl.textContent = G.hint;

    this.game = new G({
      caps: this.caps,
      theme,
      seed: Math.floor(Math.random() * 1e9),
    });

    this.open = true;
    this._lockY = scrollY;
    this.el.hidden = false;
    document.body.classList.add('game-open');

    this.resultEl.hidden = true;
    this.introEl.hidden = replay;
    this.phase = replay ? 'playing' : 'intro';

    this.resize();
    if (replay) {
      this.game.resize(this.game.W, this.game.H);
      this.game.start();
    }

    this.onOpen?.(id, this.meta);
    requestAnimationFrame(() => {
      (replay ? this.canvas : this.el.querySelector('#introStart')).focus?.();
    });
    return true;
  }

  begin() {
    this.introEl.hidden = true;
    this.phase = 'playing';
    this.game.start();
    this.canvas.focus?.();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.phase = 'idle';
    this.game = null;
    this.el.hidden = true;
    document.body.classList.remove('game-open');
    this._keysDown.clear();
    // Put the visitor back exactly where the story was, to the pixel.
    scrollTo(0, this._lockY);
    this.onClose?.();
  }

  end() {
    const g = this.game;
    this.phase = 'over';

    const rank = g.rank();
    const score = Math.round(g.score);
    const summary = g.summary();
    const { improved } = this.progress.record(this.meta.id, {
      score, rank, outcome: g.outcome, summary,
    });

    this.el.querySelector('#resultKicker').textContent =
      `${this.meta.discipline} · ${improved ? 'NEW BEST' : `BEST ${this.progress.get(this.meta.id).score}`}`;
    this.el.querySelector('#resultRank').textContent = `${rank} · ${score}`;

    const dl = this.el.querySelector('#resultSummary');
    dl.innerHTML = summary
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
      .join('');

    this.resultEl.hidden = false;
    requestAnimationFrame(() => this.el.querySelector('#resultAgain').focus?.());
    this.onEvent?.('end', { id: this.meta.id, score, rank });
  }

  // ------------------------------------------------------------------ frame

  resize() {
    if (!this.open) return;
    const r = this.canvas.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;

    const dpr = Math.min(devicePixelRatio || 1, this.caps.mobile ? 2 : 2.5);
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this._dpr = dpr;

    // The virtual stage follows the container's aspect within sane bounds, so
    // the same layout code produces a wide desktop panel and a tall phone one.
    const aspect = r.width / r.height;
    const W = 1000;
    const H = clamp(Math.round(W / aspect), 560, 1700);
    const scale = Math.min(r.width / W, r.height / H);

    this._stage = {
      x: (r.width - W * scale) / 2,
      y: (r.height - H * scale) / 2,
      w: W,
      h: H,
      scale,
    };

    this.game?.resize(W, H);
  }

  /** Driven from the app's single animation loop — the games never own a RAF. */
  update(dt) {
    const want = this.open ? 1 : 0;
    this.focus += (want - this.focus) * Math.min(1, dt * 5);

    if (!this.open || !this.game) return;

    if (this.phase === 'playing') {
      this.game.update(dt);
      if (this.game.over) this.end();
    }

    this.render();
    this.renderHud();
  }

  render() {
    const g = this.g;
    const s = this._stage;
    const dpr = this._dpr;

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);

    g.save();
    g.translate(s.x, s.y);
    g.scale(s.scale, s.scale);

    // Screen shake lives here rather than in each game.
    const sh = this.game.shake;
    if (sh > 0.001) {
      g.translate(
        (Math.random() - 0.5) * sh * 7,
        (Math.random() - 0.5) * sh * 7
      );
    }

    g.beginPath();
    g.rect(-4, -4, s.w + 8, s.h + 8);
    g.clip();

    this.game.draw(g);
    g.restore();
  }

  renderHud() {
    const game = this.game;
    this.scoreEl.textContent = String(Math.round(game.score));

    if (game.constructor.duration > 0) {
      this.timeWrap.hidden = false;
      const t = Math.max(0, game.time);
      this.timeEl.textContent = `${t.toFixed(0)}s`;
      this.timeEl.classList.toggle('danger', t < 12);
    } else {
      this.timeWrap.hidden = true;
    }

    const meters = game.meters();
    // Rebuild only when the shape changes; otherwise just move the values, so
    // the footer is not thrashing the DOM sixty times a second.
    if (this._meterCount !== meters.length) {
      this._meterCount = meters.length;
      this.metersEl.innerHTML = meters
        .map((m) => `<div class="meter"><i>${m.label}</i><span class="meter-bar"><b></b></span><em></em></div>`)
        .join('');
      this._meterEls = [...this.metersEl.querySelectorAll('.meter')].map((el) => ({
        bar: el.querySelector('b'),
        val: el.querySelector('em'),
        root: el,
      }));
    }
    for (let i = 0; i < meters.length; i++) {
      const m = meters[i];
      const el = this._meterEls[i];
      if (!el) continue;
      el.bar.style.width = `${clamp(m.value) * 100}%`;
      el.val.textContent = m.text ?? `${Math.round(clamp(m.value) * 100)}%`;
      el.root.dataset.danger = m.danger ? 'true' : 'false';
    }
  }

  /**
   * A single number the 3D world can react to: how hard the visitor is working
   * right now. The app feeds it into the era's own interaction, so the scene
   * behind the panel visibly responds to the game being played in front of it.
   */
  intensity() {
    if (!this.open || this.phase !== 'playing' || !this.game) return 0;
    const m = this.game.meters();
    if (!m.length) return 0.3;
    return clamp(m.reduce((s, x) => Math.max(s, clamp(x.value)), 0));
  }
}
