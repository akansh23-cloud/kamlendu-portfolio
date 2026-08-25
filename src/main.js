import './styles/main.css';
import { App } from './app/App.js';

/**
 * main.js — the entry point, and nothing more.
 *
 * The one judgement call here is the try/catch. A portfolio that throws during
 * start-up and leaves a black screen is worse than no portfolio at all, so if
 * anything in the world fails to construct, the boot overlay and the canvas are
 * torn down and the written story — which is the actual content — is handed
 * back to the visitor intact. Failure degrades to a readable page, never to a
 * blank one.
 */

function markReducedMotion() {
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  const apply = () => document.body.classList.toggle('reduced', mq.matches);
  apply();
  mq.addEventListener?.('change', apply);
}

function start() {
  markReducedMotion();
  try {
    window.__dataPlane = new App();
  } catch (err) {
    console.error('[data-plane] failed to start', err);
    document.getElementById('boot')?.remove();
    document.getElementById('stage')?.remove();
    document.body.classList.remove('is-booting');
    document.body.classList.add('no-webgl');

    // If the story never got built, build it now without the 3D layer so the
    // page is still the thing it is supposed to be: a readable portfolio.
    if (!document.getElementById('story')?.childElementCount) {
      import('./ui/Content.js')
        .then(({ Content }) => new Content({}).build())
        .catch(() => {});
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
