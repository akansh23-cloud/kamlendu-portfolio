import * as THREE from 'three';

import { createCapabilities, AdaptiveQuality } from './Capabilities.js';
import { createRenderer, Viewport } from './Renderer.js';
import { Environment } from './Environment.js';
import { CameraRig, CamState } from './CameraRig.js';
import { Actions } from './Actions.js';

import { HumanGuide } from '../character/HumanGuide.js';
import { CharacterController } from '../character/CharacterController.js';

import { SCENES } from '../scenes/index.js';
import { TransitionDirector } from '../transitions/TransitionDirector.js';
import { Timeline } from '../timeline/Timeline.js';

import { Boot } from '../ui/Boot.js';
import { Content } from '../ui/Content.js';
import { Hud } from '../ui/Hud.js';
import { Dock } from '../ui/Dock.js';
import { CommandPalette } from '../ui/CommandPalette.js';
import { Portal } from '../ui/Portal.js';
import { Recruiter } from '../ui/Recruiter.js';
import { Sound } from '../ui/Sound.js';
import { Diagnostics } from '../ui/Diagnostics.js';

import { GameHost } from '../games/GameHost.js';
import { Progress } from '../games/Progress.js';
import { GAMES, GAME_FOR_CHAPTER } from '../games/registry.js';

import { clamp, damp } from '../lib/math.js';


/**
 * App — the loop, and the only object that knows about all the others.
 *
 * Everything else in this project is deliberately ignorant: scenes do not know
 * the camera exists, the character does not know which era it is in, the
 * timeline does not know anything is being rendered at all. That separation is
 * what let thirteen environments get built without them turning into thirteen
 * private engines, and it means every one of those pieces can be reasoned about
 * on its own. The cost is that this file has to be the adult in the room.
 *
 * Frame order matters and is not arbitrary:
 *
 *   sample scroll → resolve act + morph → ensure scenes exist → blend lights →
 *   update scenes → direct the character → blend the camera → render
 *
 * Lights are blended before the scenes update so that a scene can read the
 * environment it is being lit by (CHORON lifts exposure with its resonance).
 * The character is directed after the scenes update so it reacts to the state
 * the era just computed, not the previous frame's.
 */
export class App {
  constructor() {
    this.caps = createCapabilities();

    // ---------------------------------------------- the honest failure path
    // No WebGL is not an excuse to show a blank page or, worse, to silently
    // replace the site with a text dump and pretend that was the plan.
    if (!this.caps.webgl) {
      this.degrade('This browser could not start WebGL, so the 3D journey is unavailable. Everything written below is the whole story.');
      this.bootDom();
      return;
    }

    this.canvas = document.getElementById('scene');
    this.renderer = createRenderer(this.canvas, this.caps);
    this.scene = new THREE.Scene();
    this.rig = new CameraRig(this.caps);
    this.viewport = new Viewport(this.renderer, this.rig.camera, this.caps);
    this.env = new Environment(this.scene, this.caps);

    this.adaptive = new AdaptiveQuality(this.caps, () => this.viewport.applyDpr());

    // ------------------------------------------------------------ character
    this.human = new HumanGuide(this.caps);
    this.controller = new CharacterController(this.human);
    this.scene.add(this.human.object3D);

    // ------------------------------------------------------------- systems
    this.progress = new Progress();
    this.director = new TransitionDirector(document.getElementById('veil'), this.caps);
    this.timeline = new Timeline(this.caps);
    this.actions = new Actions({ onFire: (id) => this.sound?.cue('action') });

    this.live = new Map();      // scene key → instance
    this.currentScene = null;
    this.incomingScene = null;
    this.blend = 0;
    this.morph = null;

    this.camA = new CamState();
    this.camB = new CamState();

    this.bootDom();

    // --------------------------------------------------------------- clock
    this.clock = new THREE.Clock();
    this.t = 0;
    this.running = true;
    this._raf = 0;

    document.addEventListener('visibilitychange', () => {
      // A hidden tab should cost nothing, and coming back should not fire a
      // one-second dt into every damping function on the page.
      this.running = !document.hidden;
      if (this.running) {
        this.clock.getDelta();
        this.loop();
      }
    });

    this.boot = new Boot(this.caps);
    this.loop();
  }

  // ------------------------------------------------------------------- DOM

  bootDom() {
    this.content = new Content({
      onAction: (id) => this.fire(id),
      onProject: (id, mode) => this.portal?.show(id, mode),
      onGame: (id) => this.playGame(id),
      progress: this.progress,
    });
    const sections = this.content.build();

    if (!this.caps.webgl) return;

    this.timeline.attach(sections);
    this.timeline.onChapterChange = (i) => {
      this.sound?.setEra(i);
      history.replaceState(null, '', `#${this.timeline.chapters[i].id}`);
    };

    this.hud = new Hud(this.timeline);
    this.dock = new Dock(this.timeline);
    this.portal = new Portal({
      timeline: this.timeline,
      onHighlight: (id) => {
        this.live.get('profile')?.setHighlight?.(id);
        if (id) this.sound?.cue('open');
      },
      onGame: (id) => this.playGame(id),
    });
    this.recruiter = new Recruiter({
      content: this.content,
      timeline: this.timeline,
      caps: this.caps,
    });
    this.palette = new CommandPalette({
      timeline: this.timeline,
      onProject: (id, mode) => this.portal.show(id, mode),
      onRecruiter: () => this.recruiter.toggle(),
      onGame: (id) => this.playGame(id),
    });
    this.sound = new Sound(this.caps);
    this.diag = new Diagnostics(this);

    // Deep link support: /#lakehouse lands in the lakehouse, not at the start.
    const hash = location.hash.replace('#', '');
    if (hash) requestAnimationFrame(() => this.timeline.goTo(hash, 'auto'));

    // -------------------------------------------------------------- games
    this.host = new GameHost({
      caps: this.caps,
      progress: this.progress,
      onOpen: () => this.sound?.cue('open'),
      onClose: () => {
        // The record changed, so every play button and the operator record
        // repaint — and the finale scene brightens by however much was earned.
        this.content.refreshRecord();
        this.live.get('profile')?.setCompletion?.(this.progress.completion());
      },
      onEvent: (kind) => { if (kind === 'end') this.sound?.cue('action'); },
    });
    this.progress.onChange(() => {
      this.live.get('profile')?.setCompletion?.(this.progress.completion());
    });

    addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (this.host?.open) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); this.timeline.step(1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); this.timeline.step(-1); }
      if (e.key.toLowerCase() === 'g') {
        const id = GAME_FOR_CHAPTER[this.timeline.chapter?.id];
        if (id) { e.preventDefault(); this.playGame(id); }
      }
    });
  }

  /** Used when WebGL is missing. The story stays; only the world goes. */
  degrade(message) {
    document.body.classList.add('no-webgl');
    document.getElementById('boot')?.remove();
    document.getElementById('stage')?.remove();
    const note = document.createElement('div');
    note.className = 'fallback-note';
    note.textContent = message;
    document.getElementById('topbar')?.insertAdjacentElement('afterend', note);
  }

  fire(id) {
    this.actions.trigger(id);
  }

  /**
   * Open an era exercise.
   *
   * If the visitor is not standing in the right chapter — they came from the
   * command palette or the operator record — the page scrolls there first and
   * the game opens once the world behind it is the correct era. Playing the
   * lakehouse exercise over a punch-card room would give the whole thing away
   * as an overlay that happens to be on the same page.
   */
  playGame(id) {
    const G = GAMES[id];
    if (!G || !this.host) return false;

    const chapterId = G.chapter;
    const index = this.timeline.chapters.findIndex((c) => c.id === chapterId);
    const already = this.timeline.chapter?.id === chapterId;

    const open = () => {
      const ch = this.timeline.chapters[index] || this.timeline.chapter;
      this.host.launch(id, this.theme(ch?.color || '#d8b06a'));
    };

    if (already || index < 0) { open(); return true; }

    this.timeline.goTo(index, this.caps.reduced ? 'auto' : 'smooth');
    // Give the smooth scroll a moment to land so the era behind the panel is
    // the right one before it fades up.
    setTimeout(open, this.caps.reduced ? 60 : 620);
    return true;
  }

  /** The palette the games paint themselves with, derived from the era. */
  theme(era) {
    return {
      era,
      fg: '#edf1f3',
      dim: '#8e99a2',
      line: 'rgba(255,255,255,0.12)',
      warn: '#ffb74d',
      bad: '#ff5f6d',
      good: era,
    };
  }

  // --------------------------------------------------------------- scenes

  ensureScene(key) {
    if (!key) return null;
    let s = this.live.get(key);
    if (!s) {
      const Cls = SCENES[key];
      if (!Cls) return null;
      // Scenes get the character in their context because some of them parent
      // a prop directly to a hand anchor — the scribe's pen is carried by the
      // animation rather than animated alongside it.
      s = new Cls({ caps: this.caps, human: this.human, controller: this.controller });
      s.ensureBuilt();
      this.scene.add(s.group);
      this.live.set(key, s);
      s.onEnter();
    }
    return s;
  }

  /**
   * Only the scenes near the reading position are allowed to exist. A phone
   * holds three eras of geometry at most, which is the difference between this
   * running at 60fps and it running out of memory somewhere around Hadoop.
   */
  prune() {
    const keep = this.timeline.window(1);
    keep.add(this.currentScene?.key);
    keep.add(this.incomingScene?.key);
    for (const [key, scene] of this.live) {
      if (keep.has(key)) continue;
      scene.onExit();
      this.scene.remove(scene.group);
      scene.dispose();
      this.live.delete(key);
    }
  }

  // ----------------------------------------------------------------- frame

  loop = () => {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this.loop);

    // A stall — a tab restore, a long GC — must not teleport anything.
    const dt = Math.min(0.05, this.clock.getDelta());
    this.t += dt;

    this.actions.update(dt);
    this.host?.update(dt);
    this.timeline.sample(dt);
    this.adaptive.update(dt);

    // --------------------------------------------------- games drive the world
    // The scene behind the panel is not a wallpaper. While an exercise is being
    // played, its pressure is pushed straight into that era's own interaction,
    // so the racks migrate while you are placing replicas and the packets surge
    // while your pipeline is backing up. It is the same action a visitor could
    // have fired by hand — the game is simply pressing it for them.
    if (this.host?.open) {
      this.gameHeat = this.host.intensity();
      this._gameTick = (this._gameTick || 0) + dt;
      if (this._gameTick > 1.1 && this.gameHeat > 0.42) {
        this._gameTick = 0;
        const linked = { shard: 'migrate', compact: 'compact', stream: 'burst', resolve: 'tokenise' };
        const id = linked[this.host.meta?.id];
        if (id) this.actions.trigger(id);
      }
    } else {
      this.gameHeat = damp(this.gameHeat || 0, 0, 4, dt);
    }

    // ------------------------------------------------------ act and morph
    const act = this.timeline.act;
    const next = this.timeline.nextAct();
    const localA = this.timeline.smoothActLocal;

    this.morph = next ? this.director.morphFor(act.scene, next.scene) : null;
    const tail = this.morph ? Math.max(0, localA - (1 - this.morph.width)) : 0;
    this.blend = this.morph ? this.director.blend(tail, this.morph) : 0;

    this.currentScene = this.ensureScene(act.scene);
    this.incomingScene = this.blend > 0.001 && next ? this.ensureScene(next.scene) : null;
    // Pre-build the next era a little before it is needed, so its first frame
    // is never the frame that also has to compile its geometry.
    if (!this.incomingScene && next && localA > 0.7) this.ensureScene(next.scene);
    this.prune();

    if (!this.currentScene) return;

    // ------------------------------------------------------------- lights
    const lightK = this.director.lightBlend(this.blend, this.morph);
    this.env.apply(
      this.currentScene.lighting,
      (this.incomingScene || this.currentScene).lighting,
      this.incomingScene ? lightK : 0
    );

    // ------------------------------------------------------------- scenes
    // Normalised, damped scroll speed. The tape reels spin up with it, which is
    // the one place in the journey where how fast you scroll is part of the
    // story rather than just how quickly you get through it.
    this.speed = damp(
      this.speed || 0,
      clamp(Math.abs(this.timeline.velocity) / 2400),
      6,
      dt
    );

    const frame = {
      t: this.t,
      dt,
      speed: this.speed,
      actions: this.actions,
      controller: this.controller,
      rig: this.rig,
      env: this.env,
    };

    this.currentScene.setOpacity(1 - this.blend * 0.92);
    this.currentScene.update({ ...frame, local: localA });

    if (this.incomingScene) {
      this.incomingScene.setOpacity(this.blend);
      // The arriving scene is held at the very start of its own timeline, so
      // its opening framing is what the outgoing shot dissolves into.
      this.incomingScene.update({ ...frame, local: 0 });
    }

    // ---------------------------------------------------------- character
    // Direction crosses over halfway through a morph, which is precisely when
    // the visitor's eye has committed to the new environment.
    const director = this.blend > 0.5 && this.incomingScene ? this.incomingScene : this.currentScene;
    const dirLocal = director === this.currentScene ? localA : 0;
    director.choreograph(dirLocal, this.controller);
    // The guide is the one operating the exercise, so they stop touring and
    // start working for as long as the panel is up.
    if (this.host?.open && this.host.phase === 'playing') {
      this.controller.play('activate', { param: 0.4 + this.gameHeat * 0.6, fade: 0.5 });
    }
    this.controller.setEraColor(this.timeline.eraColor);
    this.controller.update(dt, this.t);
    this.env.followShadow(this.controller.pos.x, this.controller.pos.z);

    // ------------------------------------------------------------- camera
    this.currentScene.camera(localA, this.camA);
    if (this.incomingScene) {
      this.incomingScene.camera(0, this.camB);
      this.camA.lerpTo(this.camB, this.blend);
    }
    this.rig.desired.copy(this.camA);
    // A small push-in behind the overlay. Enough that the world reads as being
    // leaned into rather than covered up; not enough to be a second animation
    // competing with the game for attention.
    const focus = this.host?.focus || 0;
    if (focus > 0.001) {
      this.rig.desired.fov -= focus * 5;
      this.rig.desired.pos.lerp(this.rig.desired.target, focus * 0.1);
    }
    this.rig.update(dt, this.t);

    // ------------------------------------------------------------- output
    this.director.update(this.blend, this.morph, dt, this.rig);
    if (this.host?.game?.shake > 0.4) this.rig.addShake(this.host.game.shake * 0.02);
    this.renderer.toneMappingExposure =
      (this.env.exposure || 1) * this.director.exposure(this.blend, this.morph);
    this.renderer.render(this.scene, this.rig.camera);

    // ----------------------------------------------------------------- ui
    this.hud?.update();
    this.dock?.update();
    this.diag?.update(dt);

    if (this.boot && !this.boot.done) {
      this.boot.ready();
      this.boot.update(dt);
      // Held on the opening pose for the whole boot, so the instant the veil
      // lifts the camera is already exactly where the first shot wants it
      // rather than gliding in from wherever the damping had reached.
      this.rig.snap();
    }
  };
}
