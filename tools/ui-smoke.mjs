/**
 * ui-smoke.mjs — exercise everything that is not the renderer.
 *
 * jsdom has no layout engine, and this project's timeline is deliberately built
 * on real layout (offsetTop / offsetHeight) rather than on a synthetic scroll
 * length. So the harness supplies a plausible layout: each chapter is given a
 * height derived from its authored `span`, stacked in order. That is enough to
 * genuinely exercise the scroll → chapter → act → local-progress mapping, the
 * act merging that makes the last three chapters share one scene, and every
 * piece of interface that reads from it.
 *
 *   node tools/ui-smoke.mjs
 */

import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const dom = new JSDOM(html, { pretendToBeVisual: true, url: 'https://example.test/' });

global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
global.HTMLInputElement = dom.window.HTMLInputElement;
global.HTMLElement = dom.window.HTMLElement;
global.innerWidth = 1440;
global.innerHeight = 900;
global.scrollY = 0;
global.addEventListener = dom.window.addEventListener.bind(dom.window);
global.removeEventListener = dom.window.removeEventListener.bind(dom.window);
global.requestAnimationFrame = (cb) => cb(0);
global.cancelAnimationFrame = () => {};
global.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
dom.window.matchMedia = global.matchMedia;
global.fetch = async () => ({ ok: true });
global.scrollTo = (opts) => { global.scrollY = typeof opts === 'number' ? opts : opts.top; };
global.history = dom.window.history;
global.location = dom.window.location;
global.localStorage = dom.window.localStorage;

const { Content } = await import('../src/ui/Content.js');
const { Timeline } = await import('../src/timeline/Timeline.js');
const { Hud } = await import('../src/ui/Hud.js');
const { Dock } = await import('../src/ui/Dock.js');
const { CommandPalette } = await import('../src/ui/CommandPalette.js');
const { Portal } = await import('../src/ui/Portal.js');
const { Recruiter } = await import('../src/ui/Recruiter.js');
const { Actions } = await import('../src/app/Actions.js');
const { Progress } = await import('../src/games/Progress.js');
const { GAME_ORDER } = await import('../src/games/registry.js');
const { chapters, projects, profile, experience, PROJECT_KINDS } = await import('../src/data/portfolio.js');

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else { failures++; console.log(`  ✗ ${msg}`); }
};

const caps = { reduced: false, mobile: false, narrow: false, tier: 'high' };

console.log('\nKAMLENDU // DATA PLANE v6 — interface & timeline audit\n');
console.log('── content ─────────────────────────────────────────────');

const fired = [];
const opened = [];
const launched = [];
const progress = new Progress();
progress.reset();
const content = new Content({
  onAction: (id) => fired.push(id),
  onProject: (id, mode) => opened.push(`${id}:${mode}`),
  onGame: (id) => launched.push(id),
  progress,
});
const sections = content.build();

ok(sections.length === chapters.length, `${sections.length} chapter sections rendered`);
ok(
  sections.every((s) => s.querySelector('.copy h1, .copy h2') && s.querySelector('.copy p')),
  'every chapter has a heading and body copy'
);
ok(
  document.querySelectorAll('.copy em').length >= chapters.length,
  'outlined title fragments parsed from the <…> marks'
);
ok(document.querySelectorAll('.work-item').length === projects.length, `${projects.length} project entries in the work chapter`);
ok(
  document.querySelectorAll('.work-head').length === PROJECT_KINDS.filter((k) => projects.some((p) => p.kind === k.key)).length,
  'projects are grouped by kind — day job and independent work are separated'
);
ok(!!document.querySelector('.copy .lede'), 'the profile summary renders as the lede');
ok(document.querySelectorAll('.stack-group').length === profile.stack.length, `${profile.stack.length} labelled skill groups`);
ok(document.querySelectorAll('.principle').length === profile.principles.length, `${profile.principles.length} engineering principles rendered`);
ok(document.querySelectorAll('.xp-item').length === experience.length, 'experience block renders');
ok(!document.querySelector('.certs'), 'no certifications block while none are named (NEEDS_SOURCE)');
ok(!document.querySelector('.xp-item header i'), 'no tenure rendered while the period is blank');
ok(!!document.querySelector('a[href^="mailto:"]'), 'contact chapter exposes a mailto link');
ok(document.querySelectorAll('.action[data-action]').length === chapters.filter((c) => c.action).length, 'one interaction button per authored era action');
ok(document.querySelectorAll('.action.play').length === GAME_ORDER.length, `${GAME_ORDER.length} era exercises offered from their own chapters`);
ok(
  [...document.querySelectorAll('.action.play')].every((b) => chapters.some((c) => c.game === b.dataset.game)),
  'every play button maps to a chapter that declares that game'
);
ok(document.querySelector('.record')?.hidden === true, 'the operator record stays hidden until something has been played');

// The content rule made testable: nothing renders for a fact the data omits.
ok(!document.querySelector('a[href*="linkedin"]'), 'no LinkedIn CTA while the data leaves it blank (NEEDS_SOURCE)');
ok(![...document.querySelectorAll('.fact span')].some((s) => s.textContent === 'TENURE'), 'no tenure tile while the data leaves it blank (NEEDS_SOURCE)');

// ------------------------------------------------------- synthetic layout
console.log('\n── timeline ────────────────────────────────────────────');

function layout() {
  let y = 0;
  for (let i = 0; i < sections.length; i++) {
    const h = Math.round(900 * 1.18 * (chapters[i].span || 1));
    Object.defineProperty(sections[i], 'offsetTop', { value: y, configurable: true });
    Object.defineProperty(sections[i], 'offsetHeight', { value: h, configurable: true });
    y += h;
  }
  Object.defineProperty(document.body, 'scrollHeight', { value: y, configurable: true });
  return y;
}
const docH = layout();

const timeline = new Timeline(caps);
timeline.attach(sections);

ok(timeline.acts.length === 13, `15 chapters merged into ${timeline.acts.length} acts (profile/work/contact share one scene)`);
ok(timeline.acts[timeline.acts.length - 1].chapters.length === 3, 'the finale act spans exactly three chapters');

// Walk the entire document and assert the mapping never breaks.
let monotonic = true;
let prevOverall = -1;
let localOutOfRange = false;
const visited = new Set();
for (let i = 0; i <= 400; i++) {
  global.scrollY = Math.round((i / 400) * (docH - innerHeight));
  timeline.sample(1 / 60);
  if (timeline.overall < prevOverall - 1e-6) monotonic = false;
  prevOverall = timeline.overall;
  if (timeline.chapterLocal < 0 || timeline.chapterLocal > 1) localOutOfRange = true;
  if (timeline.actLocal < 0 || timeline.actLocal > 1) localOutOfRange = true;
  visited.add(timeline.chapterIndex);
}
ok(monotonic, 'overall progress is monotonic across the whole document');
ok(!localOutOfRange, 'chapter and act local progress stay inside 0…1 everywhere');
ok(visited.size === chapters.length, `every one of the ${chapters.length} chapters is reachable by scrolling`);

// The finale act must advance continuously rather than restarting per chapter.
const finale = timeline.acts[timeline.acts.length - 1];
const samples = [];
for (let i = 0; i <= 30; i++) {
  global.scrollY = finale.top + (finale.height * i) / 30 - innerHeight * 0.5;
  timeline.sample(1 / 60);
  samples.push(timeline.actLocal);
}
ok(
  samples.every((v, i) => i === 0 || v >= samples[i - 1] - 1e-6),
  'the finale scene receives one continuous progress across its three chapters'
);

// Lazy-load window.
global.scrollY = Math.round(docH * 0.5);
timeline.sample(1 / 60);
ok(timeline.window(1).size <= 3, `only ${timeline.window(1).size} scenes are held in memory at mid-journey`);

ok(timeline.goTo('choron') === true, 'goTo resolves a chapter by id');
ok(timeline.goTo('lakehouse') === true, 'goTo resolves a chapter by scene key');
ok(timeline.goTo('not-a-real-chapter') === false, 'goTo rejects an unknown target instead of scrolling somewhere random');

// ---------------------------------------------------------------- interface
console.log('\n── interface ───────────────────────────────────────────');

const hud = new Hud(timeline);
const dock = new Dock(timeline);
ok(document.querySelectorAll('.strata-layer').length === chapters.length, `strata rail drew ${chapters.length} layers`);

const heights = [...document.querySelectorAll('.strata-layer')].map((e) => parseFloat(e.style.height));
ok(Math.abs(heights.reduce((a, b) => a + b, 0) - 100) < 0.5, 'strata layer thicknesses sum to 100% of the rail');
ok(new Set(heights).size > 1, 'layer thickness genuinely varies with each chapter’s span');

let threw = null;
try {
  for (let i = 0; i <= 60; i++) {
    global.scrollY = Math.round((i / 60) * (docH - innerHeight));
    timeline.sample(1 / 60);
    hud.update();
    dock.update();
  }
} catch (e) { threw = e; }
ok(!threw, `hud and dock survive a full scroll${threw ? ` — ${threw.message}` : ''}`);
ok(/^#[0-9a-f]{6}$/i.test(document.documentElement.style.getPropertyValue('--era')), 'the --era variable is being written with a live colour');

const portal = new Portal({ timeline, onHighlight: () => {} });
portal.show('choron', 'open');
ok(portal.open && document.getElementById('portal').hidden === false, 'project portal opens');
ok(document.getElementById('portalBody').textContent.includes('CHORON'), 'portal renders the selected project');
portal.close();
portal.show('attestic', 'open');
const pdText = document.getElementById('portalBody').textContent;
ok(/THE PROBLEM/.test(pdText) && /THE APPROACH/.test(pdText) && /HOW IT WORKS/.test(pdText),
  'the portal renders a full case study, not a card');
ok(/BUILT WITH/.test(pdText), 'the case study lists the stack');
portal.close();
ok(!portal.open && document.getElementById('portal').hidden === true, 'project portal closes');

const palette = new CommandPalette({ timeline, onProject: () => {}, onRecruiter: () => {} });
palette.toggle(true);
ok(palette.open && document.getElementById('paletteList').children.length > 0, 'command palette opens and lists targets');
palette._filter('iceberg');
ok(palette.filtered.length > 0 && palette.filtered.length < palette.items.length, `filtering "iceberg" narrows to ${palette.filtered.length} result(s)`);
palette._filter('zzzzz');
ok(palette.filtered.length === 0, 'a query with no match narrows to nothing rather than everything');
palette.toggle(false);
ok(!palette.open, 'command palette closes');

const recruiter = new Recruiter({ content, timeline, caps });
const fullHeight = sections[0].style.minHeight;
recruiter.toggle();
ok(document.body.classList.contains('recruiter'), 'recruiter mode applies to the document');
ok(sections[0].style.minHeight !== fullHeight, 'recruiter mode genuinely shortens every chapter');
recruiter.toggle();
ok(sections[0].style.minHeight === fullHeight, 'turning recruiter mode off restores the full journey');

// ------------------------------------------------------------------ actions
console.log('\n── actions ─────────────────────────────────────────────');

const actions = new Actions({});
actions.trigger('migrate');
ok(actions.migrate === true && actions.seq.migrate === 1, 'triggering an action sets its boolean and bumps its sequence');
for (let i = 0; i < 60 * 4; i++) actions.update(1 / 60);
ok(actions.migrate === false, 'the hold window expires on its own');
actions.trigger('burst');
actions.trigger('burst');
ok(actions.seq.burst === 2, 'repeated triggers of a one-shot action are individually observable');
ok(actions.trigger('nonsense') === false, 'an unknown action id is rejected');

for (const c of chapters) {
  if (c.action) {
    const a = new Actions({});
    if (!a.trigger(c.action.id)) { failures++; console.log(`  ✗ chapter "${c.id}" declares action "${c.action.id}" which the bus does not implement`); }
  }
}
ok(true, 'every authored era action is implemented by the bus');

document.querySelector('.action[data-action]')?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
ok(fired.length === 1, 'clicking an era action button reaches the app');
document.querySelector('.work-item')?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
ok(opened.some((s) => s.endsWith(':open')), 'clicking a project entry reaches the app');

document.querySelector('.action.play')?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
ok(launched.length === 1, 'clicking an era exercise reaches the app');

progress.record('stream', { score: 3000, rank: 'ENGINEER', outcome: 'survived', summary: [] });
content.refreshRecord();
ok(document.querySelector('.record')?.hidden === false, 'the operator record appears once a discipline is played');
ok(document.querySelectorAll('.record-cell').length === GAME_ORDER.length, 'the record lists every discipline, played or not');
ok(
  document.querySelector('.record-cell[data-game="stream"]')?.dataset.played === 'true',
  'the played discipline is marked in the record'
);
ok(
  document.querySelector('.action.play[data-game="stream"]')?.textContent.includes('ENGINEER'),
  'the play button reports the earned rank after a run'
);
progress.reset();

console.log(failures ? `\n${failures} failure(s)\n` : '\nInterface, timeline and action wiring all behave.\n');
process.exit(failures ? 1 : 0);
