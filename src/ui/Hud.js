import { chapters } from '../data/portfolio.js';

/**
 * Hud — the strata rail and the era readout.
 *
 * The rail is the one piece of interface in this project that is not a
 * convention borrowed from somewhere else. It is a stratigraphic core sample:
 * fifteen layers stacked oldest-at-top, each drawn at a thickness proportional
 * to that chapter's share of the scroll, in that era's own colour. Deeper
 * history sits above you, the present is at the bottom, and the marker sinks
 * through it as you read. It navigates like a nav and reads like geology,
 * which is exactly what a timeline of storage media is.
 *
 * This class also owns `--era`: the CSS variable every other component tints
 * itself from. Writing it once per frame here is what makes the entire page
 * absorb each period of history instead of holding one fixed accent colour.
 */
export class Hud {
  constructor(timeline) {
    this.timeline = timeline;
    this.list = document.getElementById('strataList');
    this.year = document.getElementById('strataYear');

    this.roIndex = document.getElementById('roIndex');
    this.roTag = document.getElementById('roTag');
    this.roName = document.getElementById('roName');
    this.roProg = document.getElementById('roProg');
    this.roMedium = document.getElementById('roMedium');

    this.rootStyle = document.documentElement.style;
    this._era = '';
    this._active = -1;

    this.build();
  }

  build() {
    if (!this.list) return;
    const total = chapters.reduce((s, c) => s + (c.span || 1), 0);

    chapters.forEach((ch, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'strata-layer';
      b.dataset.index = String(i);
      b.style.setProperty('--layer', ch.color);
      // Thickness is the chapter's real share of the journey, not a fixed tick.
      b.style.height = `${((ch.span || 1) / total * 100).toFixed(2)}%`;
      b.setAttribute('aria-label', `${ch.name} — ${ch.year}`);
      b.innerHTML = `<span class="num">${String(i + 1).padStart(2, '0')}</span><span class="core"></span>`;
      b.addEventListener('click', () => this.timeline.goTo(i));
      li.appendChild(b);
      this.list.appendChild(li);
    });

    this.layers = [...this.list.querySelectorAll('.strata-layer')];
  }

  update() {
    const t = this.timeline;
    const ch = t.chapter;
    if (!ch) return;

    // ---------------------------------------------------------- era colour
    const hex = `#${t.eraColor.getHexString()}`;
    if (hex !== this._era) {
      this._era = hex;
      this.rootStyle.setProperty('--era', hex);
      const c = t.eraColor;
      this.rootStyle.setProperty(
        '--era-soft',
        `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, 0.16)`
      );
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', hex);
    }

    // ---------------------------------------------------------- the readout
    if (this._active !== t.chapterIndex) {
      this._active = t.chapterIndex;
      if (this.roTag) this.roTag.textContent = ch.tag;
      if (this.roName) this.roName.textContent = ch.name;
      if (this.roMedium) this.roMedium.textContent = ch.medium;
      if (this.roIndex) {
        this.roIndex.textContent = `${String(t.chapterIndex + 1).padStart(2, '0')} / ${String(chapters.length).padStart(2, '0')}`;
      }
      if (this.year) this.year.textContent = ch.year;

      this.layers?.forEach((el, i) => {
        el.classList.toggle('on', i === t.chapterIndex);
        el.classList.toggle('past', i < t.chapterIndex);
      });
    }

    if (this.roProg) this.roProg.style.transform = `scaleX(${t.chapterLocal.toFixed(3)})`;
  }
}
