import * as THREE from 'three';
import { CLIPS } from './clips.js';
import { createPose, blendPose, copyPose } from './pose.js';
import { clamp, damp } from '../lib/math.js';

/**
 * CharacterController — the single place that knows how the guide moves.
 *
 * Scenes never touch bones. They say where the person should be and, at most,
 * which clip is appropriate; everything else — gait, crossfades, head aim,
 * costume drift — is decided here, exactly as section 43 of the brief requires.
 *
 * The detail worth knowing: the walk cycle is advanced by distance travelled,
 * not by a timer. Scroll is the only thing that moves the character through the
 * world, so scroll is the only thing that moves their legs. Stop scrolling
 * mid-corridor and they come to rest and breathe instead of marching in place.
 */

const STRIDE_CYCLE = 1.5; // metres of travel per full two-step cycle

export class CharacterController {
  constructor(human) {
    this.human = human;
    this.object = human.object3D;

    this.pos = new THREE.Vector3(0, 0, 0);
    this.targetPos = new THREE.Vector3(0, 0, 0);
    this.facing = 0;
    this.targetFacing = 0;

    this.speed = 0;
    this.stridePhase = 0;

    this.forced = null;
    this.forcedParam = 0;
    this.amp = 1;

    this.current = 'idle';
    this.previous = 'idle';
    this.fade = 1;
    this.fadeDur = 0.45;

    this.lookTarget = new THREE.Vector3();
    this.lookWeight = 0;

    this._a = createPose();
    this._b = createPose();
    this._out = createPose();
    this._tmp = new THREE.Vector3();
    this._prevPos = new THREE.Vector3();

    this.responsiveness = 5.5;
  }

  // ------------------------------------------------------------------- API

  /** Immediate placement, no easing. Used when a scene first takes over. */
  teleport(x, y, z, facing = this.targetFacing) {
    this.pos.set(x, y, z);
    this.targetPos.set(x, y, z);
    this._prevPos.copy(this.pos);
    this.facing = this.targetFacing = facing;
    this.speed = 0;
  }

  /** Where the guide should be. The controller eases toward it every frame. */
  place(x, y, z, facing) {
    this.targetPos.set(x, y, z);
    if (facing !== undefined) this.targetFacing = facing;
  }

  /** Force a clip. Pass null to hand gait selection back to the controller. */
  play(name, { param = 0, fade = 0.45, amp = 1 } = {}) {
    this.forcedParam = param;
    this.amp = amp;
    if (name === this.forced) return;
    this.forced = name;
    if (name) this.crossFade(name, fade);
  }

  auto() {
    this.forced = null;
  }

  crossFade(name, dur = 0.45) {
    if (name === this.current) return;
    this.previous = this.current;
    this.current = name;
    this.fadeDur = Math.max(0.06, dur);
    this.fade = 0;
  }

  /** Aim the head at a world point. Weight 0 releases it back to the clip. */
  lookAt(x, y, z, weight = 1) {
    this.lookTarget.set(x, y, z);
    this.lookWeight = weight;
  }

  costume(key) {
    this.human.setCostume(key);
  }

  setEraColor(c) {
    this.human.setEraColor(c);
  }

  // ---------------------------------------------------------------- update

  update(dt, t) {
    // A scene change can move the guide a long way; snap rather than sprint.
    if (this.pos.distanceToSquared(this.targetPos) > 400) {
      this.pos.copy(this.targetPos);
      this._prevPos.copy(this.pos);
    }

    this._prevPos.copy(this.pos);
    const l = this.responsiveness;
    this.pos.x = damp(this.pos.x, this.targetPos.x, l, dt);
    this.pos.y = damp(this.pos.y, this.targetPos.y, l, dt);
    this.pos.z = damp(this.pos.z, this.targetPos.z, l, dt);

    let delta = this.targetFacing - this.facing;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.facing = damp(this.facing, this.facing + delta, 4.2, dt);

    this.object.position.copy(this.pos);
    this.object.rotation.y = this.facing;

    // Travelled distance drives the gait.
    const moved = this._tmp.copy(this.pos).sub(this._prevPos).length();
    const instant = dt > 0 ? moved / dt : 0;
    this.speed = damp(this.speed, instant, 8, dt);
    this.stridePhase = (this.stridePhase + moved / STRIDE_CYCLE) % 1;

    // Clip selection.
    if (!this.forced) {
      const wants = this.speed > 0.14 ? 'walk' : 'idle';
      if (wants !== this.current) this.crossFade(wants, wants === 'walk' ? 0.28 : 0.5);
      this.amp = clamp(0.55 + this.speed * 0.55, 0.55, 1.35);
    }

    if (this.fade < 1) this.fade = Math.min(1, this.fade + dt / this.fadeDur);

    const ctx = {
      t,
      phase: this.stridePhase,
      speed: this.speed,
      amp: this.amp,
      param: this.forcedParam,
    };

    const prevFn = CLIPS[this.previous] || CLIPS.idle;
    const curFn = CLIPS[this.current] || CLIPS.idle;

    if (this.fade >= 1) {
      curFn(this._out, ctx);
    } else {
      prevFn(this._a, ctx);
      curFn(this._b, ctx);
      blendPose(this._a, this._b, this._ease(this.fade), this._out);
    }

    this._applyLook(this._out);
    this.human.update(dt, this._out);
    copyPose(this._out, this._a);
  }

  _ease(t) {
    return t * t * (3 - 2 * t);
  }

  /** Additive head aim layered on top of whatever clip is playing. */
  _applyLook(pose) {
    if (this.lookWeight <= 0.001) return;
    const dx = this.lookTarget.x - this.pos.x;
    const dz = this.lookTarget.z - this.pos.z;
    const dy = this.lookTarget.y - (this.pos.y + 1.6);
    const dist = Math.hypot(dx, dz) || 0.0001;

    let yaw = Math.atan2(dx, dz) - this.facing;
    while (yaw > Math.PI) yaw -= Math.PI * 2;
    while (yaw < -Math.PI) yaw += Math.PI * 2;
    const pitch = Math.atan2(dy, dist);

    const w = clamp(this.lookWeight);
    // Split the turn between neck and head so the whole body reads as aware.
    pose.j.neck.y += clamp(yaw, -0.9, 0.9) * 0.42 * w;
    pose.j.head.y += clamp(yaw, -0.9, 0.9) * 0.36 * w;
    pose.j.chest.y += clamp(yaw, -0.9, 0.9) * 0.16 * w;
    pose.j.neck.x += clamp(pitch, -0.7, 0.7) * 0.4 * w;
    pose.j.head.x += clamp(pitch, -0.7, 0.7) * 0.3 * w;
  }
}
