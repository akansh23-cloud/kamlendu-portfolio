import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { shot, pathAt } from './shot.js';
import { groundPlane, tapeReel, glowSprite } from './props.js';
import { matte, metal, emissive } from '../lib/gfx.js';
import { ramp, lerp, TAU } from '../lib/math.js';
import { V } from '../lib/scratch.js';

/**
 * SCENE 4 — MAGNETIC TAPE
 *
 * The camera arrives through the punch hole and finds itself against the hub of
 * a reel, which is the same bright circle it just flew through. Then it pulls
 * back and the machine turns out to be three metres tall.
 *
 * Scale is the whole point of this era, so the guide is deliberately parked
 * beside the cabinet and never moves far: the reels read as enormous because a
 * person is standing under them.
 *
 * The ribbon is real geometry on a real path, and the reels respond to scroll
 * velocity — spin the wheel quickly and the machine spins up with you.
 */
export class MagneticTapeScene extends SceneBase {
  static key = 'tape';

  constructor(ctx) {
    super(ctx);
    this.lighting = {
      bg: '#070505',
      fog: '#0d0806',
      fogDensity: 0.048,
      ambient: { color: '#4a2f1c', intensity: 0.5 },
      hemi: { sky: '#7c4d2c', ground: '#0b0705', intensity: 0.45 },
      key: { color: '#ff9640', intensity: 2.4, pos: [3.2, 4.4, 3.2] },
      rim: { color: '#7fa9d8', intensity: 1.15, pos: [-4, 3.2, -3] },
      fill: { color: '#4a2510', intensity: 0.4, pos: [0, 2, 6] },
      exposure: 1,
    };

    this.shotKeys = [
      { at: 0.00, pos: [-1.6, 2.4, 0.72], target: [-1.6, 2.4, 0], fov: 14 },
      { at: 0.14, pos: [-1.5, 2.35, 2.4], target: [-1.2, 2.3, 0], fov: 30 },
      { at: 0.36, pos: [0.4, 2.2, 6.2], target: [0.0, 2.15, 0], fov: 44 },
      { at: 0.58, pos: [3.4, 1.35, 5.6], target: [-0.2, 1.9, 0], fov: 46 },
      { at: 0.80, pos: [1.6, 1.5, 3.6], target: [0.0, 1.62, 0], fov: 38 },
      { at: 1.00, pos: [0.1, 1.62, 1.35], target: [0.0, 1.62, -0.4], fov: 22 },
    ];

    this.walkKeys = [
      { at: 0.00, pos: [2.6, 0, 2.4], ry: -2.5 },
      { at: 0.40, pos: [1.35, 0, 2.05], ry: -2.9 },
      { at: 1.00, pos: [1.3, 0, 2.0], ry: -2.95 },
    ];

    this.spin = 0;
    this.spinVel = 0;
  }

  build() {
    const detail = this.caps.detail;
    this.add(groundPlane('#0e0a08', 60, 0.88));

    // ------------------------------------------------------------- cabinet
    const cab = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 4.0, 0.9), matte('#2c2622', 0.7, 0.35));
    body.position.y = 2.0;
    body.castShadow = this.caps.shadows;
    cab.add(body);

    const face = new THREE.Mesh(new THREE.BoxGeometry(4.3, 3.7, 0.06), matte('#3b332c', 0.6, 0.4));
    face.position.set(0, 2.05, 0.47);
    cab.add(face);

    const trim = new THREE.Mesh(new THREE.BoxGeometry(4.62, 0.1, 0.94), metal('#8a7f70', 0.4));
    trim.position.y = 3.98;
    cab.add(trim);

    // Panel of indicator lamps down the side of the cabinet.
    this.lamps = [];
    for (let i = 0; i < 10; i++) {
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.038, 10), emissive('#ffab5c', 1.2));
      l.position.set(-2.0 + (i % 2) * 0.2, 0.55 + Math.floor(i / 2) * 0.2, 0.51);
      cab.add(l);
      this.lamps.push(l);
    }
    cab.position.z = -0.55;
    this.add(cab);

    // --------------------------------------------------------------- reels
    this.reelL = tapeReel(1.15, detail, '#ff9a4d');
    this.reelR = tapeReel(1.15, detail, '#ff9a4d');
    this.reelL.position.set(-1.6, 2.4, 0);
    this.reelR.position.set(1.6, 2.4, 0);
    this.add(this.reelL, this.reelR);

    // Capstan and read head between them — the reason the tape dips.
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.22), metal('#9aa0a6', 0.3));
    head.position.set(0, 1.16, 0.06);
    this.add(head);
    const headGlow = glowSprite('#ffd39a', 0.5, 0.6);
    headGlow.position.set(0, 1.24, 0.2);
    this.add(headGlow);
    this.headGlow = headGlow;

    // -------------------------------------------------------------- ribbon
    // A real strip on a real path: down off the left reel, across the head,
    // back up onto the right reel.
    this.curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.6, 1.55, 0.1),
      new THREE.Vector3(-1.1, 1.32, 0.12),
      new THREE.Vector3(-0.35, 1.2, 0.14),
      new THREE.Vector3(0.35, 1.2, 0.14),
      new THREE.Vector3(1.1, 1.32, 0.12),
      new THREE.Vector3(1.6, 1.55, 0.1),
    ]);

    this.ribbonSegs = Math.max(24, Math.round(70 * detail));
    const geo = new THREE.PlaneGeometry(1, 0.09, this.ribbonSegs, 1);
    this.ribbonMat = new THREE.MeshStandardMaterial({
      color: '#1c1410',
      roughness: 0.62,
      metalness: 0.35,
      side: THREE.DoubleSide,
    });
    this.ribbon = new THREE.Mesh(geo, this.ribbonMat);
    this.ribbonPos = geo.attributes.position;
    this.add(this.ribbon);
    this._layoutRibbon(0);

    // -------------------------------------------------------------- pulses
    this.pulseCount = this.count(18, 6);
    this.pulses = [];
    for (let i = 0; i < this.pulseCount; i++) {
      const s = glowSprite('#ffd08a', 0.14, 0.9);
      this.add(s);
      this.pulses.push({ s, u: i / this.pulseCount });
    }

    // --------------------------------------------------- transition: the square
    // The ribbon's edge tightens into the outline of a floppy disk.
    const r = 0.42;
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * TAU;
      // Superellipse: circle at n=2, rounded square as n grows.
      const n = 5;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * r;
      const y = Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * r;
      pts.push(new THREE.Vector3(x, y, 0));
    }
    const sqGeo = new THREE.BufferGeometry().setFromPoints(pts);
    this.square = new THREE.Line(
      sqGeo,
      new THREE.LineBasicMaterial({ color: '#7ff0c0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.square.position.set(0, 1.62, -0.2);
    this.add(this.square);

    const lamp = this.addLight(new THREE.PointLight('#ffb066', 5, 9, 2));
    if (lamp) lamp.position.set(0, 2.2, 2.4);
  }

  _layoutRibbon(wobble) {
    const pos = this.ribbonPos;
    const segs = this.ribbonSegs;
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      this.curve.getPointAt(u, V);
      const w = Math.sin(u * 9 + wobble) * 0.012 * Math.sin(u * Math.PI);
      // Two vertices per column: top and bottom edge of the strip.
      pos.setXYZ(i, V.x, V.y + 0.045 + w, V.z);
      pos.setXYZ(i + segs + 1, V.x, V.y - 0.045 + w, V.z);
    }
    pos.needsUpdate = true;
    this.ribbon.geometry.computeVertexNormals();
  }

  camera(local, out) {
    return shot(this.shotKeys, local, out);
  }

  choreograph(local, ctl) {
    ctl.costume('operator');
    const p = pathAt(this.walkKeys, local);
    ctl.place(p.x, 0, p.z, p.ry);

    if (local < 0.42) {
      ctl.auto();
      ctl.lookAt(-1.6, 2.4, 0, 0.7);
    } else if (local < 0.74) {
      ctl.play('lookUp', { fade: 0.7 });
      ctl.lookAt(0, 2.6, -0.2, 0.85);
    } else {
      ctl.play('observe', { fade: 0.6 });
      ctl.lookAt(0, 1.4, 0.1, 0.8);
    }
  }

  update({ local, t, dt, speed = 0 }) {
    // Reels answer to scroll velocity as well as to their own idle rotation.
    const drive = 0.5 + ramp(local, 0.5, 1) * 5.5 + Math.min(3.5, speed * 26);
    this.spinVel = lerp(this.spinVel, drive, Math.min(1, dt * 3));
    this.spin += this.spinVel * dt;
    this.reelL.rotation.z = -this.spin;
    this.reelR.rotation.z = -this.spin * 1.06;

    // Tape unwinds from the left reel onto the right one.
    const wind = ramp(local, 0.1, 0.95);
    this.reelL.userData.wound.scale.set(lerp(1, 0.42, wind), 1, lerp(1, 0.42, wind));
    this.reelR.userData.wound.scale.set(lerp(0.42, 1, wind), 1, lerp(0.42, 1, wind));

    this._layoutRibbon(t * this.spinVel * 0.5);

    const glow = 0.5 + Math.sin(t * 4) * 0.15 + ramp(local, 0.4, 0.9) * 0.5;
    this.headGlow.material.opacity = glow;
    this.reelL.userData.rim.material.emissiveIntensity = 0.7 + this.spinVel * 0.12;
    this.reelR.userData.rim.material.emissiveIntensity = 0.7 + this.spinVel * 0.12;

    for (let i = 0; i < this.lamps.length; i++) {
      this.lamps[i].material.emissiveIntensity = 0.4 + (Math.sin(t * 5 + i * 2.1) > 0 ? 1.6 : 0.2);
    }

    // Light pulses running along the tape — the data actually moving.
    const flow = (t * (0.12 + this.spinVel * 0.03)) % 1;
    for (let i = 0; i < this.pulses.length; i++) {
      const p = this.pulses[i];
      const u = (p.u + flow) % 1;
      this.curve.getPointAt(u, V);
      p.s.position.copy(V);
      p.s.position.z += 0.05;
      p.s.material.opacity = 0.8 * Math.sin(u * Math.PI) * ramp(local, 0.12, 0.4);
    }

    // Exit: the reel circles give way to a square outline.
    const morph = ramp(local, 0.84, 1);
    this.square.material.opacity = morph * 0.95;
    this.square.scale.setScalar(lerp(2.4, 1, morph));
    this.square.rotation.z = lerp(0.7, 0, morph);
  }
}
