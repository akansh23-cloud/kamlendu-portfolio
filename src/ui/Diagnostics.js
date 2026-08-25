/**
 * Diagnostics — the panel that made this project debuggable.
 *
 * Thirteen scenes sharing one camera, one light rig and one character means
 * that when something looks wrong there are at least four plausible culprits.
 * This overlay answers, in one glance: which act is live, what the transition
 * director thinks it is morphing between, how much of the incoming scene is
 * showing, and what the device has quietly decided about quality.
 *
 * Hidden by default. Press D (or add ?debug to the URL).
 */
export class Diagnostics {
  constructor(app) {
    this.app = app;
    this.el = document.getElementById('diag');
    this.frames = 0;
    this.acc = 0;
    this.fps = 0;
    this.visible = new URLSearchParams(location.search).has('debug');
    if (this.el) this.el.hidden = !this.visible;

    addEventListener('keydown', (e) => {
      // Never steal the key while the visitor is typing in the palette.
      if (e.target instanceof HTMLInputElement) return;
      if (e.key.toLowerCase() === 'd' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        this.visible = !this.visible;
        if (this.el) this.el.hidden = !this.visible;
      }
    });
  }

  update(dt) {
    if (!this.visible || !this.el) return;
    this.frames++;
    this.acc += dt;
    if (this.acc < 0.4) return;

    this.fps = this.frames / this.acc;
    this.frames = 0;
    this.acc = 0;

    const a = this.app;
    const t = a.timeline;
    const caps = a.caps;
    const from = a.currentScene?.key || '—';
    const to = a.incomingScene?.key || '—';

    this.el.textContent = [
      `FPS      ${this.fps.toFixed(0)}`,
      `TIER     ${caps.tier}  DPR ${caps.dpr.toFixed(2)}/${caps.maxDpr}  SHADOW ${caps.shadows ? 'on' : 'off'}`,
      `CHAPTER  ${String(t.chapterIndex + 1).padStart(2, '0')} ${t.chapter?.id}  local ${t.chapterLocal.toFixed(3)}`,
      `ACT      ${t.actIndex}  ${t.act?.scene}  local ${t.smoothActLocal.toFixed(3)}`,
      `MORPH    ${from} → ${to}  blend ${a.blend.toFixed(3)}`,
      `         ${a.director.describe(from, to)}`,
      `LIVE     ${[...a.live.keys()].join(', ') || '—'}`,
      `DRAWS    ${a.renderer.info.render.calls}  TRI ${a.renderer.info.render.triangles}`,
    ].join('\n');
  }
}
