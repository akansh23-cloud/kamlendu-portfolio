import * as THREE from 'three';
import { damp, lerp, clamp } from '../lib/math.js';

/** A camera pose a scene wants at a given moment in its own timeline. */
export class CamState {
  constructor() {
    this.pos = new THREE.Vector3(0, 1.6, 5);
    this.target = new THREE.Vector3(0, 1.2, 0);
    this.fov = 42;
    this.roll = 0;
  }

  set(px, py, pz, tx, ty, tz, fov = 42, roll = 0) {
    this.pos.set(px, py, pz);
    this.target.set(tx, ty, tz);
    this.fov = fov;
    this.roll = roll;
    return this;
  }

  copy(o) {
    this.pos.copy(o.pos);
    this.target.copy(o.target);
    this.fov = o.fov;
    this.roll = o.roll;
    return this;
  }

  lerpTo(o, t) {
    this.pos.lerp(o.pos, t);
    this.target.lerp(o.target, t);
    this.fov = lerp(this.fov, o.fov, t);
    this.roll = lerp(this.roll, o.roll, t);
    return this;
  }
}

/**
 * CameraRig — scroll authors the shot, the rig makes it cinema.
 *
 * Scenes describe where the camera should be at a given point in their own
 * timeline. The rig smooths between those poses, blends across a transition,
 * adds a whisper of pointer parallax, and on a phone raises the subject into
 * the upper band of the screen so the character is never hidden behind the
 * text panel. Pointer never orbits — section 23 was explicit about that.
 */
export class CameraRig {
  constructor(caps) {
    this.caps = caps;
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 260);

    this.desired = new CamState();
    this.smooth = new CamState();
    this.scratch = new CamState();

    this.pointer = new THREE.Vector2();
    this.pointerSmooth = new THREE.Vector2();

    this.shake = 0;
    this.verticalBias = 0;

    this._up = new THREE.Vector3(0, 1, 0);
    this._tmp = new THREE.Vector3();
    this._look = new THREE.Vector3();

    this.smooth.copy(this.desired);
    this._bindPointer();
  }

  _bindPointer() {
    if (this.caps.mobile) return;
    addEventListener('pointermove', (e) => {
      this.pointer.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    }, { passive: true });
  }

  addShake(v) {
    this.shake = Math.min(1, this.shake + v);
  }

  update(dt, t) {
    const reduced = this.caps.reduced;

    // Framing: on a phone the story lives in the top 56% of the viewport, so
    // drop the look target and the subject rises into the visible band.
    this.verticalBias = this.caps.narrow ? 0.2 : 0;

    const l = reduced ? 24 : 4.6;
    this.smooth.pos.x = damp(this.smooth.pos.x, this.desired.pos.x, l, dt);
    this.smooth.pos.y = damp(this.smooth.pos.y, this.desired.pos.y, l, dt);
    this.smooth.pos.z = damp(this.smooth.pos.z, this.desired.pos.z, l, dt);
    this.smooth.target.x = damp(this.smooth.target.x, this.desired.target.x, l, dt);
    this.smooth.target.y = damp(this.smooth.target.y, this.desired.target.y, l, dt);
    this.smooth.target.z = damp(this.smooth.target.z, this.desired.target.z, l, dt);
    this.smooth.fov = damp(this.smooth.fov, this.desired.fov, l, dt);
    this.smooth.roll = damp(this.smooth.roll, this.desired.roll, l, dt);

    this.pointerSmooth.x = damp(this.pointerSmooth.x, reduced ? 0 : this.pointer.x, 2.6, dt);
    this.pointerSmooth.y = damp(this.pointerSmooth.y, reduced ? 0 : this.pointer.y, 2.6, dt);

    const cam = this.camera;
    cam.position.copy(this.smooth.pos);

    // Parallax is applied on the camera's own right/up axes so it reads the
    // same whatever direction the shot is facing.
    this._look.copy(this.smooth.target).sub(this.smooth.pos);
    const dist = this._look.length() || 1;
    this._tmp.copy(this._look).normalize().cross(this._up).normalize();
    const px = this.pointerSmooth.x * 0.16 * clamp(dist / 6, 0.4, 1.8);
    const py = -this.pointerSmooth.y * 0.1 * clamp(dist / 6, 0.4, 1.8);
    cam.position.addScaledVector(this._tmp, px);
    cam.position.y += py;

    if (this.shake > 0.001 && !reduced) {
      const s = this.shake * 0.05;
      cam.position.x += Math.sin(t * 41.3) * s;
      cam.position.y += Math.sin(t * 37.7 + 1.1) * s;
      this.shake = Math.max(0, this.shake - dt * 1.4);
    }

    this._look.copy(this.smooth.target);
    this._look.y -= this.verticalBias * dist * 0.17;
    cam.lookAt(this._look);

    if (Math.abs(this.smooth.roll) > 0.0001) cam.rotateZ(this.smooth.roll);

    if (Math.abs(cam.fov - this.smooth.fov) > 0.01) {
      cam.fov = this.smooth.fov;
      cam.updateProjectionMatrix();
    }
  }

  /** Used once at start-up and after a jump so the camera does not fly across. */
  snap() {
    this.smooth.copy(this.desired);
  }
}
