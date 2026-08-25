import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { shot, pathAt } from './shot.js';
import { sheet, groundPlane, glowSprite } from './props.js';
import { matte, metal, emissive, pointCloud } from '../lib/gfx.js';
import { clamp, ramp, lerp } from '../lib/math.js';
import { M4, Q, E, V, V2 } from '../lib/scratch.js';

/**
 * SCENE 1 — WRITTEN MEMORY
 *
 * The first frame has to say one thing without a word of copy:
 * human + paper + writing = information being stored.
 *
 * So there is no symbolism here. There is a desk, a lamp, a sheet, and a hand
 * moving across it leaving ink behind. Only once the page is full does the ink
 * lift off the paper and become the first data particles in the journey.
 */
export class WrittenMemoryScene extends SceneBase {
  static key = 'writtenMemory';

  constructor(ctx) {
    super(ctx);
    this.lighting = {
      bg: '#06070a',
      fog: '#0a0805',
      fogDensity: 0.085,
      ambient: { color: '#3a2c1d', intensity: 0.55 },
      hemi: { sky: '#5c452c', ground: '#0d0906', intensity: 0.45 },
      key: { color: '#ffb964', intensity: 3.1, pos: [1.5, 2.1, 1.3] },
      rim: { color: '#5b7ba8', intensity: 0.55, pos: [-2.6, 2.4, -2.2] },
      fill: { color: '#2a1f14', intensity: 0.35, pos: [0, 1.4, 4] },
      exposure: 1.05,
    };

    this.shotKeys = [
      { at: 0.00, pos: [3.6, 2.5, 5.4], target: [0.2, 1.0, -0.2], fov: 30 },
      { at: 0.16, pos: [2.0, 1.62, 2.5], target: [0.05, 1.02, -0.2], fov: 38 },
      { at: 0.46, pos: [1.05, 1.46, 1.62], target: [0.02, 0.99, -0.06], fov: 35 },
      { at: 0.66, pos: [0.72, 1.34, 1.24], target: [0.0, 0.96, 0.0], fov: 33 },
      { at: 0.84, pos: [1.5, 1.55, 2.1], target: [0.35, 1.05, 0.1], fov: 40 },
      { at: 1.00, pos: [3.1, 1.78, 2.9], target: [1.9, 1.05, 0.35], fov: 44 },
    ];

    this.walkKeys = [
      { at: 0.00, pos: [0, 0, -0.62], ry: 0 },
      { at: 0.80, pos: [0, 0, -0.62], ry: 0 },
      { at: 0.88, pos: [0.5, 0, -0.5], ry: 1.15 },
      { at: 1.00, pos: [2.4, 0, -0.15], ry: 1.45 },
    ];
  }

  build() {
    const detail = this.caps.detail;

    this.add(groundPlane('#100b07', 40, 0.98));

    const wall = new THREE.Mesh(new THREE.PlaneGeometry(24, 9), matte('#0c0906', 1));
    wall.position.set(0, 4.5, -4.2);
    this.add(wall);

    // ------------------------------------------------------------- the desk
    const desk = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.86), matte('#4a3222', 0.82));
    top.rotation.x = -0.2;
    top.position.set(0, 0.95, 0.06);
    top.castShadow = this.caps.shadows;
    top.receiveShadow = true;
    desk.add(top);

    const lip = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.035, 0.05), matte('#3b2819', 0.85));
    lip.position.set(0, 0.87, 0.47);
    desk.add(lip);

    const legGeo = new THREE.BoxGeometry(0.07, 0.9, 0.07);
    const legMat = matte('#3a2718', 0.88);
    for (const [x, z] of [[-0.66, 0.34], [0.66, 0.34], [-0.66, -0.3], [0.66, -0.3]]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(x, 0.45, z);
      leg.castShadow = this.caps.shadows;
      desk.add(leg);
    }
    this.add(desk);

    // ------------------------------------------------------------ the sheet
    this.page = sheet(0.52, 0.68);
    this.page.rotation.set(-Math.PI / 2 - 0.2, 0, 0);
    this.page.position.set(0.0, 0.985, 0.1);
    this.add(this.page);

    // A second sheet that the finished page stacks onto.
    this.stack = sheet(0.52, 0.68);
    this.stack.rotation.set(-Math.PI / 2 - 0.2, 0, 0.06);
    this.stack.position.set(0.62, 0.982, 0.02);
    this.stack.scale.setScalar(0.001);
    this.add(this.stack);

    // ------------------------------------------------------------- the ink
    // Written as four lines of marks. Each mark is one instance, revealed in
    // order, so the page genuinely fills up as the hand moves.
    this.strokeCount = this.count(120, 40);
    const strokeGeo = new THREE.BoxGeometry(0.011, 0.0025, 0.006);
    this.inkMat = matte('#1a1208', 0.9);
    this.inkMat.emissive = new THREE.Color('#d8b06a');
    this.inkMat.emissiveIntensity = 0;
    this.ink = new THREE.InstancedMesh(strokeGeo, this.inkMat, this.strokeCount);
    this.ink.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.add(this.ink);

    this.strokes = [];
    const lines = 4;
    const per = Math.floor(this.strokeCount / lines);
    for (let i = 0; i < this.strokeCount; i++) {
      const li = Math.floor(i / per);
      const u = (i % per) / (per - 1);
      const x = -0.19 + u * 0.38 + Math.sin(u * 24 + li) * 0.004;
      const z = -0.17 + li * 0.1 + Math.sin(u * 30 + li * 2) * 0.012;
      this.strokes.push({
        x,
        z,
        rot: Math.sin(u * 18 + li * 3) * 0.6,
        drift: new THREE.Vector3((this.rand() - 0.5) * 0.9, 0.4 + this.rand() * 0.9, (this.rand() - 0.5) * 0.7),
      });
    }

    // ------------------------------------------------------------- the lamp
    const lamp = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.03, 0.2, 10), metal('#8a6f45', 0.4));
    stem.position.y = 0.1;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, 0.06, 12), metal('#a8874f', 0.35));
    cup.position.y = 0.22;
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 10), emissive('#ffcf86', 3.4));
    flame.scale.set(0.7, 1.6, 0.7);
    flame.position.y = 0.28;
    lamp.add(stem, cup, flame);
    lamp.position.set(0.56, 0.96, 0.2);
    this.add(lamp);
    this.flame = flame;

    const halo = glowSprite('#ffb964', 1.5, 0.5);
    halo.position.copy(lamp.position).add(new THREE.Vector3(0, 0.28, 0));
    this.add(halo);
    this.halo = halo;

    this.lampLight = this.addLight(new THREE.PointLight('#ffb463', 4.2, 6.5, 1.9));
    if (this.lampLight) this.lampLight.position.set(0.56, 1.26, 0.2);

    // ---------------------------------------------------------- the inkwell
    const well = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.07, 12), matte('#1b1a20', 0.6, 0.3));
    well.position.set(-0.52, 0.98, 0.22);
    this.add(well);

    // --------------------------------------------------------------- dust
    const n = this.count(160, 40);
    const pts = [];
    for (let i = 0; i < n; i++) {
      pts.push((this.rand() - 0.5) * 5, this.rand() * 2.8, (this.rand() - 0.5) * 4 - 0.5);
    }
    this.dust = pointCloud(pts, { color: '#ffc98a', size: 0.017, opacity: 0.5 });
    this.add(this.dust);

    // ---------------------------------------------------------------- pen
    this.pen = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.008, 0.17, 8), matte('#2a1f16', 0.7));
    const nib = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.03, 8), metal('#c9b489', 0.3));
    nib.position.y = -0.1;
    nib.rotation.x = Math.PI;
    shaft.position.y = 0.0;
    this.pen.add(shaft, nib);
    this.pen.rotation.set(0.5, 0, 0.25);
  }

  onEnter() {
    // The pen is parented to the hand itself, so it is carried by the animation
    // rather than animated alongside it.
    this.ctx.human.anchors.handR.add(this.pen);
  }

  onExit() {
    this.pen.removeFromParent();
  }

  camera(local, out) {
    return shot(this.shotKeys, local, out);
  }

  choreograph(local, ctl) {
    ctl.costume('scribe');
    const p = pathAt(this.walkKeys, local);
    ctl.place(p.x, 0, p.z, p.ry);

    if (local < 0.78) {
      // Writing progress feeds the clip so the hand sweeps and returns per line.
      const w = ramp(local, 0.12, 0.66) * 4;
      ctl.play('write', { param: w, fade: 0.6 });
      ctl.lookAt(0, 1.0, 0.1, 0.5);
      this.pen.visible = true;
    } else {
      ctl.play(null);
      ctl.auto();
      ctl.lookAt(4, 1.5, 0.4, ramp(local, 0.8, 0.95) * 0.8);
      this.pen.visible = local < 0.85;
    }
  }

  update({ local, t, dt }) {
    // Flame flicker — the only light source that matters in this room.
    const flick = 0.85 + Math.sin(t * 11.3) * 0.08 + Math.sin(t * 27.1) * 0.05;
    this.flame.material.emissiveIntensity = 3.4 * flick;
    this.flame.scale.x = 0.7 * (0.94 + flick * 0.08);
    this.halo.material.opacity = 0.42 * flick;
    if (this.lampLight) this.lampLight.intensity = 4.2 * flick;

    // Ink: written, then lifted.
    const written = ramp(local, 0.12, 0.66);
    const lift = ramp(local, 0.64, 0.92);
    this.inkMat.emissiveIntensity = lift * 1.6;

    const m = M4;
    const q = Q;
    const pos = V;
    const scl = V2;
    const e = E;

    for (let i = 0; i < this.strokeCount; i++) {
      const s = this.strokes[i];
      const appear = clamp((written * this.strokeCount - i) / 3);
      const rise = lift * clamp((i / this.strokeCount) * 1.4 + 0.15);

      pos.set(
        s.x + s.drift.x * rise * 0.9,
        0.99 + rise * rise * 1.5 + Math.sin(t * 1.6 + i) * 0.01 * rise,
        s.z + 0.1 + s.drift.z * rise * 0.8
      );
      // Pinned flat to the page while written; tumbling once it is airborne.
      e.set(-Math.PI / 2 - 0.2 + rise * s.drift.y * 2.4, s.rot * (1 - rise) + rise * t * 0.6, rise * 1.4);
      q.setFromEuler(e);
      const size = appear * lerp(1, 0.62, rise);
      scl.setScalar(Math.max(0.0001, size));
      m.compose(pos, q, scl);
      this.ink.setMatrixAt(i, m);
    }
    this.ink.instanceMatrix.needsUpdate = true;

    // The finished page stacks as the guide stands up.
    const stack = ramp(local, 0.78, 0.94);
    this.stack.scale.setScalar(Math.max(0.001, stack));
    this.page.material.opacity = 1;

    // Dust drifts slowly through the lamp light.
    if (this.dust) {
      this.dust.rotation.y = t * 0.012;
      this.dust.position.y = Math.sin(t * 0.2) * 0.04;
    }
  }
}
