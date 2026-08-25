import { chapters, profile, projects, experience, PROJECT_KINDS } from '../data/portfolio.js';
import { chapterHeight } from '../timeline/Timeline.js';
import { gameMeta } from '../games/registry.js';

/**
 * Content — the words, built from data, never hard-coded in the HTML.
 *
 * Everything a visitor reads comes from src/data/portfolio.js. That is not
 * tidiness for its own sake: it is what makes the content rule enforceable.
 * There is exactly one file to audit for invented facts, and if a fact is
 * missing there (linkedin, tenure, the resume PDF) the element that would have
 * displayed it is not rendered at all. Nothing is filled in with a guess and
 * nothing renders as an empty box.
 */

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

/** Titles carry two authored marks: \n for a hard break, <…> for outlined text. */
function title(raw) {
  return esc(raw)
    .replace(/&lt;([^&]*?)&gt;/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

export class Content {
  constructor({ onAction, onProject, onGame, progress, recruiter } = {}) {
    this.root = document.getElementById('story');
    this.onAction = onAction;
    this.onProject = onProject;
    this.onGame = onGame;
    this.progress = progress;
    this.recruiter = !!recruiter;
    this.sections = [];
    this._repaints = [];
  }

  build() {
    const frag = document.createDocumentFragment();

    chapters.forEach((ch, i) => {
      const sec = document.createElement('section');
      sec.className = `chapter ${ch.side || 'left'}`;
      sec.id = `chapter-${i}`;
      sec.dataset.id = ch.id;
      sec.dataset.scene = ch.scene;
      sec.style.minHeight = chapterHeight(ch.span || 1, this.recruiter);

      const copy = document.createElement('div');
      copy.className = 'copy';

      const heading = i === 0 ? 'h1' : 'h2';
      copy.innerHTML =
        `<div class="eyebrow"><s></s>${esc(ch.eyebrow)}</div>` +
        `<${heading}>${title(ch.title)}</${heading}>` +
        `<p>${esc(ch.body)}</p>`;

      if (ch.chips?.length) {
        copy.insertAdjacentHTML(
          'beforeend',
          `<div class="chips">${ch.chips.map((c) => `<span>${esc(c)}</span>`).join('')}</div>`
        );
      }

      if (ch.kind === 'profile') this._profileBlock(copy);
      if (ch.kind === 'work') this._workBlock(copy);
      if (ch.kind === 'contact') this._contactBlock(copy);

      // Era interactions. Always optional, never load-bearing: the story is
      // complete for someone who never presses a single one of them.
      if (ch.action || ch.game) {
        const wrap = document.createElement('div');
        wrap.className = 'actions';

        if (ch.action) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'action';
          btn.dataset.action = ch.action.id;
          btn.textContent = ch.action.label;
          btn.addEventListener('click', () => {
            this.onAction?.(ch.action.id);
            btn.dataset.firing = 'true';
            setTimeout(() => { btn.dataset.firing = 'false'; }, 900);
          });
          wrap.appendChild(btn);
        }

        if (ch.game) this._gameButton(wrap, ch);
        copy.appendChild(wrap);
      }

      sec.appendChild(copy);
      frag.appendChild(sec);
      this.sections.push(sec);
    });

    this.root.appendChild(frag);
    this._observe();
    return this.sections;
  }

  // ------------------------------------------------------------------ blocks

  /**
   * The era exercise entry point. It is styled as a secondary control on
   * purpose — the chapter's own interaction stays the primary one, and the
   * game reads as an offer rather than as the thing you are supposed to do.
   */
  _gameButton(wrap, ch) {
    const meta = gameMeta(ch.game);
    if (!meta) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'action play';
    btn.dataset.game = ch.game;
    btn.addEventListener('click', () => this.onGame?.(ch.game));
    wrap.appendChild(btn);

    const paint = () => {
      const rec = this.progress?.get(ch.game);
      btn.innerHTML =
        `<span class="play-mark" aria-hidden="true">▶</span>` +
        `<span>${esc(meta.discipline)}</span>` +
        (rec ? `<i class="play-rank">${esc(rec.rank)}</i>` : `<i class="play-rank new">EXERCISE</i>`);
      btn.setAttribute(
        'aria-label',
        rec
          ? `Play the ${meta.title} exercise again. Best rank ${rec.rank}, ${rec.score} points.`
          : `Play the ${meta.title} exercise for this era. Optional.`
      );
    };
    paint();
    this._repaints.push(paint);
  }

  _profileBlock(copy) {
    // The summary goes first and is the only paragraph on this page written to
    // be read in isolation — it is what gets skimmed, quoted and pasted.
    if (profile.summary) {
      copy.insertAdjacentHTML('beforeend', `<p class="lede">${esc(profile.summary)}</p>`);
    }

    const facts = [
      ['ROLE', profile.role],
      ['EMPLOYER', profile.employer],
      ['BASED', profile.location],
      // Rendered only if the source supplies it. See NEEDS_SOURCE in the data.
      profile.tenure ? ['TENURE', profile.tenure] : null,
    ].filter(Boolean);

    copy.insertAdjacentHTML(
      'beforeend',
      `<div class="facts">${facts
        .map(([k, v]) => `<div class="fact"><b>${esc(v)}</b><span>${esc(k)}</span></div>`)
        .join('')}</div>`
    );

    // Grouped stack. A recruiter scanning for one keyword finds it faster in a
    // labelled group than in an undifferentiated wall of chips.
    if (profile.stack?.length) {
      copy.insertAdjacentHTML(
        'beforeend',
        `<div class="stack">${profile.stack
          .map((g) =>
            `<div class="stack-group">` +
              `<h4>${esc(g.group)}</h4>` +
              `<div class="chips">${g.items.map((i) => `<span>${esc(i)}</span>`).join('')}</div>` +
            `</div>`
          )
          .join('')}</div>`
      );
    }

    // Certifications appear only when named. "Multiple AWS certifications" is
    // known; which ones is not, and naming a plausible set would be inventing.
    if (profile.certifications?.length) {
      copy.insertAdjacentHTML(
        'beforeend',
        `<div class="certs"><h4>CERTIFICATIONS</h4>` +
          `<div class="chips">${profile.certifications.map((c) => `<span>${esc(c)}</span>`).join('')}</div></div>`
      );
    }

    this._experienceBlock(copy);
    this._principlesBlock(copy);
  }

  _experienceBlock(copy) {
    if (!experience?.length) return;
    copy.insertAdjacentHTML(
      'beforeend',
      `<div class="xp">${experience
        .map((x) =>
          `<article class="xp-item">` +
            `<header>` +
              `<b>${esc(x.role)}</b>` +
              `<span>${esc(x.org)}${x.place ? ` · ${esc(x.place)}` : ''}</span>` +
              (x.period ? `<i>${esc(x.period)}</i>` : '') +
            `</header>` +
            (x.summary ? `<p>${esc(x.summary)}</p>` : '') +
            (x.work?.length ? `<ul>${x.work.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : '') +
          `</article>`
        )
        .join('')}</div>`
    );
  }

  /**
   * How he builds, stated as commitments.
   *
   * This is the section that actually separates one engineer from another.
   * Everyone lists Spark; far fewer will tell you, unprompted, where they
   * refuse to put a model and what their systems do when a check cannot be
   * completed.
   */
  _principlesBlock(copy) {
    if (!profile.principles?.length) return;
    copy.insertAdjacentHTML(
      'beforeend',
      `<div class="principles">` +
        `<h4>HOW I BUILD</h4>` +
        profile.principles
          .map((p) => `<div class="principle"><b>${esc(p.title)}</b><p>${esc(p.body)}</p></div>`)
          .join('') +
      `</div>`
    );
  }

  _workBlock(copy) {
    // Grouped, because "built at work" and "built at night" are different
    // claims and running them together weakens both.
    for (const kind of PROJECT_KINDS) {
      const items = projects.filter((p) => (p.kind || 'work') === kind.key);
      if (!items.length) continue;

      const head = document.createElement('div');
      head.className = 'work-head';
      head.innerHTML = `<h4>${esc(kind.label)}</h4>` + (kind.note ? `<span>${esc(kind.note)}</span>` : '');
      copy.appendChild(head);

      const wrap = document.createElement('div');
      wrap.className = 'work';
      for (const p of items) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'work-item';
        btn.dataset.project = p.id;
        btn.innerHTML =
          `<b>${esc(p.name)}</b>` +
          `<i>${esc(p.tag)}</i>` +
          `<span>${esc(p.blurb)}</span>` +
          (p.stack?.length
            ? `<em>${p.stack.slice(0, 4).map(esc).join(' · ')}</em>`
            : '');
        btn.setAttribute('aria-label', `${p.name} — ${p.tag}. Open case study.`);
        btn.addEventListener('click', () => this.onProject?.(p.id, 'open'));
        btn.addEventListener('pointerenter', () => this.onProject?.(p.id, 'hover'));
        btn.addEventListener('pointerleave', () => this.onProject?.(null, 'hover'));
        btn.addEventListener('focus', () => this.onProject?.(p.id, 'hover'));
        btn.addEventListener('blur', () => this.onProject?.(null, 'hover'));
        wrap.appendChild(btn);
      }
      copy.appendChild(wrap);
    }
  }

  _contactBlock(copy) {
    const wrap = document.createElement('div');
    wrap.className = 'actions';

    const mail = document.createElement('a');
    mail.className = 'action';
    mail.href = `mailto:${profile.email}`;
    mail.textContent = profile.email;
    wrap.appendChild(mail);

    // Both of these appear only when the data file supplies a real value.
    if (profile.github) {
      const gh = document.createElement('a');
      gh.className = 'action ghost';
      gh.href = profile.github;
      gh.target = '_blank';
      gh.rel = 'noopener noreferrer';
      gh.textContent = 'GitHub';
      wrap.appendChild(gh);
    }

    if (profile.linkedin) {
      const li = document.createElement('a');
      li.className = 'action ghost';
      li.href = profile.linkedin;
      li.target = '_blank';
      li.rel = 'noopener noreferrer';
      li.textContent = 'LinkedIn';
      wrap.appendChild(li);
    }

    if (profile.resume) {
      const cv = document.createElement('a');
      cv.className = 'action ghost';
      cv.href = profile.resume;
      cv.setAttribute('download', '');
      cv.textContent = 'Résumé (PDF)';
      // If the file was never dropped into /public the link is removed rather
      // than left to 404 in front of a recruiter.
      fetch(profile.resume, { method: 'HEAD' })
        .then((r) => { if (!r.ok) cv.remove(); })
        .catch(() => cv.remove());
      wrap.appendChild(cv);
    }

    copy.appendChild(wrap);

    copy.insertAdjacentHTML(
      'beforeend',
      `<div class="skills">${profile.skills.map((s) => `<span>${esc(s)}</span>`).join('')}</div>`
    );

    this._recordBlock(copy);
  }

  /**
   * The operator record — the thread that turns six minigames into part of the
   * journey rather than six distractions hanging off it. It only appears once
   * the visitor has actually played something, because an empty scoreboard on
   * a portfolio is just a demand.
   */
  _recordBlock(copy) {
    if (!this.progress) return;

    const wrap = document.createElement('div');
    wrap.className = 'record';
    copy.appendChild(wrap);

    const paint = () => {
      const standing = this.progress.standing();
      if (!standing) { wrap.hidden = true; return; }
      wrap.hidden = false;
      wrap.innerHTML =
        `<div class="record-head">` +
          `<span>OPERATOR RECORD</span>` +
          `<b>${esc(standing.title)}</b>` +
          `<i>${standing.played} / ${standing.total} DISCIPLINES</i>` +
        `</div>` +
        `<div class="record-grid">` +
          this.progress.rows().map((r) =>
            `<button type="button" class="record-cell" data-game="${esc(r.id)}" data-played="${r.played}">` +
              `<b>${esc(r.discipline)}</b>` +
              `<span>${esc(r.rank)}</span>` +
              `<i>${r.played ? r.score : '—'}</i>` +
            `</button>`
          ).join('') +
        `</div>`;

      for (const cell of wrap.querySelectorAll('.record-cell')) {
        cell.addEventListener('click', () => this.onGame?.(cell.dataset.game));
      }
    };

    paint();
    this._repaints.push(paint);
  }

  // ----------------------------------------------------------------- reveal

  _observe() {
    if (!('IntersectionObserver' in window)) {
      for (const s of this.sections) s.querySelector('.copy')?.classList.add('on');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) e.target.classList.add('on');
        }
      },
      { rootMargin: '-12% 0px -22% 0px' }
    );
    for (const s of this.sections) io.observe(s.querySelector('.copy'));
    this.io = io;
  }

  /** Re-paints every element that reflects the operator record. */
  refreshRecord() {
    for (const fn of this._repaints) {
      try { fn(); } catch { /* one bad tile must not break the page */ }
    }
  }

  /** Recruiter mode changes every section's height; the timeline remeasures. */
  setRecruiter(on) {
    this.recruiter = on;
    chapters.forEach((ch, i) => {
      this.sections[i].style.minHeight = chapterHeight(ch.span || 1, on);
    });
  }
}
