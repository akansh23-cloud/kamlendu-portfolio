/**
 * smoke.mjs — build and step every scene without a browser or a GPU.
 *
 * This does not replace looking at the thing. What it does catch, in about a
 * second, is the entire class of bug that is otherwise invisible until you
 * scroll to era nine on a phone: a mistyped property, a THREE API that does not
 * exist in this version, an instanced mesh indexed past its count, a NaN
 * leaking into a matrix. Every scene is constructed, built, stepped across its
 * whole local timeline, choreographed, asked for a camera, and disposed.
 *
 *   node tools/smoke.mjs
 */

import { JSDOM } from 'jsdom';

// ---------------------------------------------------------------- DOM shim
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  pretendToBeVisual: true,
});

/** A 2D context stub good enough for the runtime-generated canvas textures. */
function ctx2d() {
  const noop = () => {};
  return new Proxy(
    {
      canvas: null,
      measureText: (t) => ({ width: String(t).length * 22 }),
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
      createPattern: () => ({}),
      getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }),
      putImageData: noop,
    },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (typeof prop === 'string') return noop;
        return undefined;
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
    }
  );
}

const origCreate = dom.window.document.createElement.bind(dom.window.document);
dom.window.document.createElement = (tag, ...rest) => {
  const el = origCreate(tag, ...rest);
  if (String(tag).toLowerCase() === 'canvas') {
    el.getContext = (kind) => (kind === '2d' ? ctx2d() : null);
  }
  return el;
};

global.window = dom.window;
global.document = dom.window.document;
// Node 22 ships a read-only global `navigator`; it has to be redefined, not set.
Object.defineProperty(global, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
});
global.HTMLInputElement = dom.window.HTMLInputElement;
global.HTMLElement = dom.window.HTMLElement;
global.devicePixelRatio = 2;
global.innerWidth = 1440;
global.innerHeight = 900;
global.scrollY = 0;
global.addEventListener = dom.window.addEventListener.bind(dom.window);
global.removeEventListener = dom.window.removeEventListener.bind(dom.window);
global.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
global.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 0);
global.cancelAnimationFrame = clearTimeout;
dom.window.matchMedia = global.matchMedia;

// -------------------------------------------------------------- under test
const { SCENES } = await import('../src/scenes/index.js');
const { CamState } = await import('../src/app/CameraRig.js');
const { Actions } = await import('../src/app/Actions.js');
const { TransitionDirector } = await import('../src/transitions/TransitionDirector.js');
const { HumanGuide } = await import('../src/character/HumanGuide.js');
const { CharacterController } = await import('../src/character/CharacterController.js');
const { chapters } = await import('../src/data/portfolio.js');
const THREE = await import('three');

const TIERS = {
  high: { tier: 'high', density: 1, detail: 1, shadows: false, lightBudget: 4, mobile: false, narrow: false, reduced: false, dpr: 2, maxDpr: 2, webgl: true },
  low: { tier: 'low', density: 0.32, detail: 0.5, shadows: false, lightBudget: 1, mobile: true, narrow: true, reduced: false, dpr: 1.25, maxDpr: 1.25, webgl: true },
};

let failures = 0;
const fail = (msg) => { failures++; console.log(`  ✗ ${msg}`); };

function finite(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Walks every matrix in an InstancedMesh looking for NaN, the silent killer. */
function auditInstances(scene, label) {
  scene.group.traverse((o) => {
    if (!o.isInstancedMesh) return;
    const a = o.instanceMatrix.array;
    for (let i = 0; i < a.length; i++) {
      if (!Number.isFinite(a[i])) {
        fail(`${label}: NaN in instanceMatrix of ${o.geometry.type} (count ${o.count})`);
        return;
      }
    }
    if (o.instanceColor) {
      const c = o.instanceColor.array;
      for (let i = 0; i < c.length; i++) {
        if (!Number.isFinite(c[i])) {
          fail(`${label}: NaN in instanceColor (count ${o.count})`);
          return;
        }
      }
    }
  });
}

function countNodes(scene) {
  let n = 0;
  let tris = 0;
  scene.group.traverse((o) => {
    n++;
    const g = o.geometry;
    if (g?.index) tris += g.index.count / 3;
    else if (g?.attributes?.position) tris += g.attributes.position.count / 3;
  });
  return { n, tris: Math.round(tris) };
}

console.log('\nKAMLENDU // DATA PLANE v6 — headless scene audit\n');

for (const [tierName, caps] of Object.entries(TIERS)) {
  console.log(`── tier: ${tierName} ───────────────────────────────────────────`);

  const human = new HumanGuide(caps);
  const controller = new CharacterController(human);
  const ctx = { caps, human, controller };
  const actions = new Actions({});
  const cam = new CamState();

  for (const [key, Cls] of Object.entries(SCENES)) {
    let scene;
    try {
      scene = new Cls(ctx);
      scene.ensureBuilt();
      scene.onEnter();
    } catch (e) {
      fail(`${key}: build threw — ${e.message}`);
      continue;
    }

    const stats = countNodes(scene);
    let stepped = 0;

    try {
      // Step the whole local timeline, twice, with every interaction firing
      // partway through — the same path a visitor takes with a mouse.
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i <= 40; i++) {
          const local = i / 40;
          if (pass === 1 && i === 12) {
            for (const id of ['migrate', 'compact', 'burst', 'pulse', 'tokenise']) actions.trigger(id);
          }
          actions.update(1 / 60);
          scene.update({
            local,
            t: stepped / 60,
            dt: 1 / 60,
            speed: 0.4 + Math.sin(stepped * 0.11) * 0.4,
            actions,
            controller,
            rig: { addShake() {} },
            env: { exposure: 1 },
          });
          scene.choreograph(local, controller);
          controller.update(1 / 60, stepped / 60);
          scene.camera(local, cam);

          if (![cam.pos.x, cam.pos.y, cam.pos.z, cam.target.x, cam.target.y, cam.target.z, cam.fov].every(finite)) {
            fail(`${key}: non-finite camera pose at local ${local.toFixed(2)}`);
            break;
          }
          if (!finite(controller.pos.x) || !finite(controller.pos.y) || !finite(controller.pos.z)) {
            fail(`${key}: non-finite character position at local ${local.toFixed(2)}`);
            break;
          }
          stepped++;
        }
        scene.setOpacity(pass === 0 ? 0.5 : 1);
      }
    } catch (e) {
      fail(`${key}: update threw at step ${stepped} — ${e.message}`);
      console.log(`      ${e.stack?.split('\n')[1]?.trim() || ''}`);
    }

    auditInstances(scene, key);

    try {
      scene.onExit();
      scene.dispose();
      if (scene.group.children.length) fail(`${key}: dispose left ${scene.group.children.length} children attached`);
    } catch (e) {
      fail(`${key}: dispose threw — ${e.message}`);
    }

    console.log(`  ✓ ${key.padEnd(15)} objects ${String(stats.n).padStart(4)}   ~tris ${String(stats.tris).padStart(6)}`);
  }
  console.log('');
}

// -------------------------------------------------- transitions & content
console.log('── wiring ──────────────────────────────────────────────');

const director = new TransitionDirector(null, TIERS.high);
const seen = [];
for (let i = 0; i < chapters.length - 1; i++) {
  const a = chapters[i].scene;
  const b = chapters[i + 1].scene;
  if (a === b) continue;
  const m = director.morphFor(a, b);
  if (!m?.note) fail(`no authored morph for ${a} → ${b}`);
  else seen.push(`${a} → ${b}`);
  for (let k = 0; k <= 10; k++) {
    const v = director.blend((k / 10) * m.width, m);
    if (!finite(v) || v < 0 || v > 1) fail(`blend out of range for ${a}→${b}`);
  }
}
console.log(`  ✓ ${seen.length} authored transitions, all resolving`);

for (const c of chapters) {
  if (!SCENES[c.scene]) fail(`chapter "${c.id}" references unknown scene "${c.scene}"`);
  for (const f of ['name', 'tag', 'medium', 'year', 'color', 'eyebrow', 'title', 'body']) {
    if (!c[f]) fail(`chapter "${c.id}" is missing ${f}`);
  }
  if (!/^#[0-9a-f]{6}$/i.test(c.color)) fail(`chapter "${c.id}" has a malformed colour: ${c.color}`);
}
console.log(`  ✓ ${chapters.length} chapters, all fields present and scenes resolved`);

console.log(
  failures
    ? `\n${failures} failure(s)\n`
    : '\nAll scenes build, step across their full timeline, survive every interaction, and dispose cleanly.\n'
);
process.exit(failures ? 1 : 0);
