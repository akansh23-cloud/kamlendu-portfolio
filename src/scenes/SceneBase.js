import * as THREE from 'three';
import { disposeObject } from '../lib/gfx.js';
import { rng } from '../lib/math.js';
import { DEFAULT_LIGHTING } from '../app/Environment.js';

/**
 * SceneBase — the contract every era implements.
 *
 * A scene owns geometry and nothing else. It does not own the camera (it
 * describes one), it does not own the character (it directs one), and it does
 * not own the lights (it declares what the era should feel like). That split is
 * what keeps thirteen environments from turning into thirteen private engines.
 *
 * Lifecycle: ensureBuilt → onEnter → update(…)* → onExit → dispose
 * Scenes are built lazily when the timeline gets close and disposed when it is
 * far away, so a phone only ever holds two or three eras in memory at once.
 */
export class SceneBase {
  static key = 'scene';

  constructor(ctx) {
    this.ctx = ctx;
    this.caps = ctx.caps;
    this.key = this.constructor.key;

    this.group = new THREE.Group();
    this.group.name = this.key;
    this.group.visible = false;
    this.group.matrixAutoUpdate = true;

    this.built = false;
    this.lights = [];
    this._fade = [];
    this._opacity = -1;
    this.rand = rng(this.key.length * 7919 + 13);

    /** Era light rig. Scenes override this in build() or as a class field. */
    this.lighting = { ...DEFAULT_LIGHTING };
  }

  // ------------------------------------------------------------- lifecycle

  ensureBuilt() {
    if (this.built) return;
    this.build();
    this.collectFadeables();
    this.built = true;
  }

  build() {}
  onEnter() {}
  onExit() {}

  /** @param {{local:number,t:number,dt:number,actions:object,controller:object,rig:object}} s */
  update(s) {}

  /** Write the camera pose for this point in the scene's own timeline. */
  camera(local, out) {
    out.set(0, 1.6, 6, 0, 1.2, 0, 42);
  }

  /** Direct the guide. Called every frame while this scene is on screen. */
  choreograph(local, ctl) {}

  dispose() {
    if (!this.built) return;
    disposeObject(this.group);
    this.group.clear();
    this.lights.length = 0;
    this._fade.length = 0;
    this.built = false;
    this._opacity = -1;
  }

  // ---------------------------------------------------------------- helpers

  add(...objs) {
    this.group.add(...objs);
    return objs[0];
  }

  /** Scene-local lights, capped by the device budget. Extras are dropped. */
  addLight(light) {
    if (this.lights.length >= this.caps.lightBudget) return null;
    this.lights.push(light);
    this.group.add(light);
    return light;
  }

  /** Counts that scale with the device, never below a floor that keeps the idea legible. */
  count(base, floor = 3) {
    return Math.max(floor, Math.round(base * this.caps.density));
  }

  seg(base, floor = 6) {
    return Math.max(floor, Math.round(base * this.caps.detail));
  }

  collectFadeables() {
    this._fade.length = 0;
    this.group.traverse((o) => {
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        this._fade.push({ m, base: m.opacity ?? 1, wasTransparent: !!m.transparent });
      }
    });
  }

  /**
   * Cross-dissolve support. Transparency is switched back off at full opacity
   * so the scene renders with correct depth sorting for 90% of its life and
   * only pays the transparent-sorting cost during the short morph window.
   */
  setOpacity(v) {
    if (Math.abs(v - this._opacity) < 0.004) return;
    this._opacity = v;
    this.group.visible = v > 0.004;
    const solid = v > 0.995;
    for (const f of this._fade) {
      f.m.opacity = f.base * v;
      const wantTransparent = f.wasTransparent || !solid;
      if (f.m.transparent !== wantTransparent) {
        f.m.transparent = wantTransparent;
        f.m.needsUpdate = true;
      }
    }
  }
}
