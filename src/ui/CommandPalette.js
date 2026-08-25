import { chapters, projects, quickJumps } from '../data/portfolio.js';
import { GAME_ORDER, GAMES, DISCIPLINE } from '../games/registry.js';

/**
 * CommandPalette — the escape hatch for people who do not want the cinema.
 *
 * A twelve-era scroll journey is a hostile interface for someone who opened
 * this tab to check one thing. ⌘K gets them to the answer in two keystrokes
 * without asking them to sit through the history of magnetic tape, and it
 * costs the story nothing, because everyone else never presses it.
 */
export class CommandPalette {
  constructor({ timeline, onProject, onRecruiter, onGame }) {
    this.timeline = timeline;
    this.onProject = onProject;
    this.onRecruiter = onRecruiter;
    this.onGame = onGame;

    this.el = document.getElementById('palette');
    this.input = document.getElementById('paletteInput');
    this.list = document.getElementById('paletteList');
    this.open = false;
    this.cursor = 0;

    this.items = this._catalogue();
    this.filtered = this.items;

    document.getElementById('btnPalette')?.addEventListener('click', () => this.toggle(true));

    addEventListener('keydown', (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.toggle(!this.open);
        return;
      }
      if (!this.open) return;
      if (e.key === 'Escape') { e.preventDefault(); this.toggle(false); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); this._move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this._move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); this._run(this.filtered[this.cursor]); }
    });

    this.input?.addEventListener('input', () => this._filter(this.input.value));
    this.el?.addEventListener('pointerdown', (e) => {
      if (e.target === this.el) this.toggle(false);
    });
  }

  _catalogue() {
    const items = [];

    for (let i = 0; i < chapters.length; i++) {
      const c = chapters[i];
      items.push({
        label: c.name,
        hint: c.year,
        keys: `${c.name} ${c.tag} ${c.medium} ${c.year} ${(c.chips || []).join(' ')}`.toLowerCase(),
        run: () => this.timeline.goTo(i),
      });
    }

    for (const p of projects) {
      items.push({
        label: p.name,
        hint: p.tag,
        keys: `${p.name} ${p.tag} ${p.blurb}`.toLowerCase(),
        run: () => this.onProject?.(p.id, 'open'),
      });
    }

    for (const q of quickJumps) {
      if (items.some((i) => i.label === q.label)) continue;
      items.push({
        label: q.label,
        hint: 'JUMP',
        keys: q.label.toLowerCase(),
        run: () => this.timeline.goTo(q.target),
      });
    }

    // The six era exercises are reachable from anywhere, not only from the
    // chapter that offers them — someone who wants to try the streaming one
    // should not have to scroll through ten eras of history to find it.
    for (const id of GAME_ORDER) {
      const G = GAMES[id];
      items.push({
        label: `PLAY · ${G.title}`,
        hint: DISCIPLINE[id],
        keys: `play game exercise ${id} ${G.title} ${DISCIPLINE[id]} ${G.chapter}`.toLowerCase(),
        run: () => this.onGame?.(id),
      });
    }

    items.push({
      label: 'RECRUITER MODE',
      hint: 'TOGGLE',
      keys: 'recruiter mode fast skip short summary hiring',
      run: () => this.onRecruiter?.(),
    });

    return items;
  }

  toggle(open) {
    this.open = open;
    if (!this.el) return;
    this.el.hidden = !open;
    document.body.classList.toggle('palette-open', open);
    if (open) {
      this.input.value = '';
      this._filter('');
      requestAnimationFrame(() => this.input?.focus());
    } else {
      this.input?.blur();
    }
  }

  _filter(q) {
    const term = q.trim().toLowerCase();
    this.filtered = term
      ? this.items.filter((i) => i.keys.includes(term))
      : this.items;
    this.cursor = 0;
    this._render();
  }

  _render() {
    if (!this.list) return;
    this.list.innerHTML = '';
    if (!this.filtered.length) {
      this.list.innerHTML = '<li aria-disabled="true">No match</li>';
      return;
    }
    this.filtered.forEach((item, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === this.cursor));
      li.dataset.on = String(i === this.cursor);
      li.innerHTML = `<span>${item.label}</span><em>${item.hint}</em>`;
      li.addEventListener('pointerenter', () => { this.cursor = i; this._render(); });
      li.addEventListener('click', () => this._run(item));
      this.list.appendChild(li);
    });
    this.list.children[this.cursor]?.scrollIntoView?.({ block: 'nearest' });
  }

  _move(d) {
    if (!this.filtered.length) return;
    this.cursor = (this.cursor + d + this.filtered.length) % this.filtered.length;
    this._render();
  }

  _run(item) {
    if (!item) return;
    this.toggle(false);
    item.run();
  }
}
