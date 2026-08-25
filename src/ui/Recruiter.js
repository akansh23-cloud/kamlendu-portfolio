/**
 * Recruiter mode.
 *
 * The honest reason this exists: a recruiter with forty tabs open does not owe
 * anyone twelve eras of scroll to find out whether Kamlendu has worked with
 * Iceberg. The uncomfortable version of that fact is that the most impressive
 * thing on the page is also the thing most likely to make someone leave.
 *
 * So the toggle shortens the journey rather than replacing it: every chapter
 * collapses toward a single screen, the film grain goes, the camera damping
 * tightens so scrolling lands immediately instead of gliding, and the visitor
 * is dropped at the present-day chapter. The world stays. Nothing is hidden,
 * nothing is swapped for a plain-text résumé, and one press puts it all back.
 */
export class Recruiter {
  constructor({ content, timeline, caps, onChange }) {
    this.content = content;
    this.timeline = timeline;
    this.caps = caps;
    this.onChange = onChange;
    this.btn = document.getElementById('btnRecruiter');
    this.on = false;

    try {
      this.on = localStorage.getItem('kk.recruiter') === '1';
    } catch { /* private mode: default off */ }

    this.btn?.addEventListener('click', () => this.toggle());
    if (this.on) this.apply(false);
  }

  toggle() {
    this.on = !this.on;
    this.apply(true);
  }

  apply(jump) {
    document.body.classList.toggle('recruiter', this.on);
    this.btn?.setAttribute('aria-pressed', String(this.on));
    if (this.btn) this.btn.textContent = this.on ? 'Full journey' : 'Recruiter mode';

    this.content?.setRecruiter(this.on);
    // Section heights just changed under the timeline; it must re-measure
    // before the next sample or the 3D and the words will disagree.
    requestAnimationFrame(() => this.timeline.measure());

    try {
      localStorage.setItem('kk.recruiter', this.on ? '1' : '0');
    } catch { /* ignore */ }

    if (jump && this.on) {
      requestAnimationFrame(() => this.timeline.goTo('profile'));
    }

    this.onChange?.(this.on);
  }
}
