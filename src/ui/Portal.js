import { projects, chapters } from '../data/portfolio.js';
import { GAME_FOR_CHAPTER, gameMeta } from '../games/registry.js';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

/**
 * Portal — opening a project steps the camera back into the era it belongs to.
 *
 * This is the one place where a DOM panel and the 3D world are deliberately
 * coupled. Selecting CHORON does not just open a card; it tints the interface
 * with CHORON's colour and lights that project's frame in the finale scene, so
 * the visitor can see the thing they selected standing in the world behind the
 * panel. The alternative — a modal floating over an unrelated scene — would
 * quietly admit the 3D was decoration.
 */
export class Portal {
  constructor({ timeline, onHighlight, onGame }) {
    this.timeline = timeline;
    this.onHighlight = onHighlight;
    this.onGame = onGame;
    this.el = document.getElementById('portal');
    this.body = document.getElementById('portalBody');
    this.closeBtn = document.getElementById('portalClose');
    this.open = false;
    this.current = null;
    this._restoreFocus = null;

    this.closeBtn?.addEventListener('click', () => this.close());
    this.el?.addEventListener('pointerdown', (e) => {
      if (e.target === this.el) this.close();
    });
    addEventListener('keydown', (e) => {
      if (this.open && e.key === 'Escape') { e.preventDefault(); this.close(); }
    });
  }

  /** mode: 'open' shows the panel, 'hover' only lights the 3D frame. */
  show(id, mode = 'open') {
    if (mode === 'hover') {
      if (!this.open) this.onHighlight?.(id);
      return;
    }
    const p = projects.find((x) => x.id === id);
    if (!p || !this.el) return;

    this._restoreFocus = document.activeElement;
    this.current = id;
    this.open = true;
    this.onHighlight?.(id);

    const era = chapters.find((c) => c.scene === p.scene);
    if (era) document.documentElement.style.setProperty('--era', era.color);

    // A case study, not a card. Problem first, because the problem is the part
    // that shows judgement — anyone can list what they built, far fewer can
    // say clearly why it needed building.
    const section = (label, html) =>
      html ? `<section class="pd-block"><h3>${label}</h3>${html}</section>` : '';

    const gameId = era ? GAME_FOR_CHAPTER[era.id] : null;
    const game = gameId ? gameMeta(gameId) : null;

    this.body.innerHTML =
      `<div class="pd-head">` +
        `<span class="tag">${esc(p.tag)}</span>` +
        (p.status ? `<span class="pd-status" data-kind="${esc(p.kind || '')}">${esc(p.status)}</span>` : '') +
      `</div>` +
      `<h2>${esc(p.name)}</h2>` +
      `<p class="pd-lede">${esc(p.blurb)}</p>` +
      section('THE PROBLEM', p.problem ? `<p>${esc(p.problem)}</p>` : '') +
      section('THE APPROACH', p.approach ? `<p>${esc(p.approach)}</p>` : '') +
      section('HOW IT WORKS',
        p.architecture?.length
          ? `<ul>${p.architecture.map((pt) => `<li>${esc(pt)}</li>`).join('')}</ul>`
          : '') +
      section('BUILT WITH',
        p.stack?.length
          ? `<div class="chips">${p.stack.map((t) => `<span>${esc(t)}</span>`).join('')}</div>`
          : '') +
      `<div class="actions">` +
        (era ? `<button type="button" class="action ghost" data-goto="${esc(era.id)}">Visit ${esc(era.name)}</button>` : '') +
        (game ? `<button type="button" class="action ghost" data-play="${esc(gameId)}">Try the ${esc(game.title)} exercise</button>` : '') +
      `</div>`;

    this.body.querySelector('[data-goto]')?.addEventListener('click', (e) => {
      const target = e.currentTarget.dataset.goto;
      this.close();
      this.timeline.goTo(target);
    });
    this.body.querySelector('[data-play]')?.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.play;
      this.close();
      this.onGame?.(id);
    });

    this.el.hidden = false;
    document.body.classList.add('portal-open');
    requestAnimationFrame(() => this.closeBtn?.focus());
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.current = null;
    this.el.hidden = true;
    document.body.classList.remove('portal-open');
    this.onHighlight?.(null);
    this._restoreFocus?.focus?.();
  }
}
