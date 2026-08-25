import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { shot, pathAt } from './shot.js';
import { crystal, halo, glowSprite } from './props.js';
import { emissive, lineMaterial, labelSprite, pointCloud } from '../lib/gfx.js';
import { clamp, ramp, lerp, easeOut, TAU } from '../lib/math.js';
import { M4, Q, E, V, V2, COL } from '../lib/scratch.js';

const SMALL = new THREE.Color('#7c6ad0');
const MERGED = new THREE.Color('#cbb9ff');

/**
 * SCENE 9 — LAKEHOUSE
 *
 * The most beautiful room in the building, and the one that describes actual
 * day-to-day work. A table is a stack of metadata planes with a crystal of
 * data underneath it, and around the edges are the small files every real lake
 * accumulates.
 *
 * "Run compaction" is not decoration: the fragments vibrate, the metadata layer
 * lights, small files merge into fewer larger ones, and the table settles into
 * a new stable state. No numbers are claimed, because none were sourced.
 */
export class LakehouseScene extends SceneBase {
  static key = 'lakehouse';

  constructor(ctx) {
    super(ctx);
    this.lighting = {
      bg: '#08061a',
      fog: '#0c0a22',
      fogDensity: 0.03,
      ambient: { color: '#453a72', intensity: 0.6 },
      hemi: { sky: '#8a7ad4', ground: '#0a0818', intensity: 0.6 },
      key: { color: '#d8ccff', intensity: 1.5, pos: [3.5, 5, 3.5] },
      rim: { color: '#a18aff', intensity: 1.8, pos: [-4, 3, -4] },
      fill: { color: '#2a2150', intensity: 0.6, pos: [0, 1.5, 6] },
      exposure: 1.02,
    };

    this.shotKeys = [
      { at: 0.00, pos: [0.9, 2.1, 3.2], target: [-0.4, 2.3, -4.2], fov: 44 },
      { at: 0.24, pos: [2.4, 1.9, 2.0], target: [0.0, 1.9, -2.4], fov: 46 },
      { at: 0.50, pos: [3.0, 2.4, -0.6], target: [0.0, 2.1, -2.6], fov: 44 },
      { at: 0.74, pos: [1.4, 2.0, -0.2], target: [0.0, 2.2, -2.8], fov: 40 },
      { at: 1.00, pos: [0.3, 1.9, 0.6], target: [0.0, 2.0, -3.4], fov: 36 },
    ];

    this.walkKeys = [
      { at: 0.00, pos: [-0.5, 0, 1.6], ry: Math.PI },
      { at: 0.55, pos: [0.55, 0, -0.5], ry: 3.35 },
      { at: 1.00, pos: [0.7, 0, -0.9], ry: 3.35 },
    ];

    this.compaction = 0;
  }

  build() {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: '#0a0818', roughness: 0.35, metalness: 0.7 })
    );
    floor.rotation.x = -Math.PI / 2;
    this.add(floor);

    // -------------------------------------------------------- the structure
    this.crystal = crystal(1.6, this.caps.detail, '#a18aff');
    this.crystal.position.set(0, 2.2, -2.8);
    this.add(this.crystal);

    const inner = crystal(0.85, this.caps.detail, '#e0d4ff');
    inner.position.copy(this.crystal.position);
    this.add(inner);
    this.inner = inner;

    // Metadata planes: the snapshot layers stacked above the data.
    this.layers = [];
    const layerCount = Math.max(3, Math.round(6 * this.caps.detail));
    for (let i = 0; i < layerCount; i++) {
      const r = 2.5 - i * 0.22;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r * 0.55, r, this.seg(48, 18)),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color('#a18aff'),
          transparent: true,
          opacity: 0.1,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 3.9 + i * 0.24, -2.8);
      this.add(ring);
      this.layers.push(ring);
    }

    const label = labelSprite('SNAPSHOT LAYERS', '#cbb9ff', 0.6);
    label.position.set(0, 5.6, -2.8);
    label.material.opacity = 0.45;
    this.add(label);
    this.metaLabel = label;

    // -------------------------------------------------------- fragmentation
    // Small files: many, uneven, scattered. This is the problem being solved.
    this.fragCount = this.count(150, 48);
    this.frags = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.16, 0.16, 0.16),
      emissive('#7c6ad0', 1.5, { transparent: true, opacity: 0.95 }),
      this.fragCount
    );
    this.frags.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fragData = [];
    // Targets: a smaller set of optimised files the fragments merge into.
    this.targetCount = Math.max(5, Math.round(this.fragCount / 9));
    this.targets = [];
    for (let i = 0; i < this.targetCount; i++) {
      const a = (i / this.targetCount) * TAU;
      this.targets.push(new THREE.Vector3(Math.cos(a) * 1.85, 1.5 + (i % 3) * 0.5, -2.8 + Math.sin(a) * 1.85));
    }
    for (let i = 0; i < this.fragCount; i++) {
      const a = this.rand() * TAU;
      const r = 2.6 + this.rand() * 3.6;
      this.fragData.push({
        home: new THREE.Vector3(Math.cos(a) * r, 0.5 + this.rand() * 3.4, -2.8 + Math.sin(a) * r * 0.7),
        target: i % this.targetCount,
        size: 0.5 + this.rand() * 0.7,
        spin: (this.rand() - 0.5) * 1.4,
        seed: this.rand() * TAU,
      });
    }
    this.add(this.frags);

    // The optimised files that result.
    this.merged = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.42, 0.42, 0.42),
      emissive('#cbb9ff', 1.8, { transparent: true, opacity: 0 }),
      this.targetCount
    );
    this.merged.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.add(this.merged);

    // Lineage from the fragments up into the metadata layer.
    const pts = [];
    for (const tgt of this.targets) {
      pts.push(tgt.x, tgt.y, tgt.z, 0, 3.9, -2.8);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    this.lineage = new THREE.LineSegments(g, lineMaterial('#a18aff', 0.12));
    this.add(this.lineage);

    this.commit = halo('#e6dcff', 2.6, 0);
    this.commit.rotation.x = Math.PI / 2;
    this.commit.position.set(0, 2.2, -2.8);
    this.add(this.commit);

    this.core = glowSprite('#cbb9ff', 3.4, 0.22);
    this.core.position.set(0, 2.2, -2.8);
    this.add(this.core);

    const motes = [];
    const n = this.count(200, 50);
    for (let i = 0; i < n; i++) motes.push((this.rand() - 0.5) * 26, this.rand() * 9, -2.8 + (this.rand() - 0.5) * 22);
    this.motes = pointCloud(motes, { color: '#b9a8ff', size: 0.03, opacity: 0.34 });
    this.add(this.motes);

    const l = this.addLight(new THREE.PointLight('#b9a8ff', 7, 12, 2));
    if (l) l.position.set(0, 2.6, -2.4);
  }

  camera(local, out) {
    return shot(this.shotKeys, local, out);
  }

  choreograph(local, ctl) {
    ctl.costume('modern');
    const p = pathAt(this.walkKeys, local);
    ctl.place(p.x, 0, p.z, p.ry);
    if (this.compaction > 0.02 && this.compaction < 0.99) {
      ctl.play('activate', { fade: 0.5 });
    } else if (local > 0.6) {
      ctl.play('observe', { fade: 0.7 });
    } else {
      ctl.auto();
    }
    ctl.lookAt(0, 2.4, -2.8, 0.8);
  }

  update({ local, t, dt, actions, rig }) {
    this.compaction = clamp(this.compaction + (actions.compact ? dt * 0.5 : 0));
    const c = this.compaction;
    const reveal = ramp(local, 0.05, 0.4);

    // Vibration while the job runs, stillness once it has settled.
    const running = c > 0.01 && c < 1 ? Math.sin(t * 26) * 0.02 : 0;

    for (let i = 0; i < this.fragCount; i++) {
      const f = this.fragData[i];
      const tgt = this.targets[f.target];
      const k = easeOut(clamp(c * 1.5 - (i / this.fragCount) * 0.4));

      V.copy(f.home);
      V.y += Math.sin(t * 0.6 + f.seed) * 0.1;
      V.lerp(tgt, k);
      V.x += running * Math.sin(f.seed * 5) * (1 - k);
      V.z += running * Math.cos(f.seed * 3) * (1 - k);

      E.set(t * f.spin * 0.4, t * f.spin * 0.3 + f.seed, 0);
      Q.setFromEuler(E);
      V2.setScalar(Math.max(0.0001, reveal * f.size * (1 - k)));
      M4.compose(V, Q, V2);
      this.frags.setMatrixAt(i, M4);
      COL.copy(SMALL).lerp(MERGED, k);
      this.frags.setColorAt(i, COL);
    }
    this.frags.instanceMatrix.needsUpdate = true;
    if (this.frags.instanceColor) this.frags.instanceColor.needsUpdate = true;

    // The optimised files appear as the fragments disappear into them.
    for (let i = 0; i < this.targetCount; i++) {
      const tgt = this.targets[i];
      const k = clamp(c * 1.6 - i * 0.05);
      V.copy(tgt);
      V.y += Math.sin(t * 0.5 + i) * 0.06;
      E.set(t * 0.2, t * 0.24 + i, 0);
      Q.setFromEuler(E);
      V2.setScalar(Math.max(0.0001, k * 1.05));
      M4.compose(V, Q, V2);
      this.merged.setMatrixAt(i, M4);
    }
    this.merged.instanceMatrix.needsUpdate = true;
    this.merged.material.opacity = clamp(c * 1.4) * 0.95;

    // Metadata reacts before the data does — the commit is the last step.
    for (let i = 0; i < this.layers.length; i++) {
      const r = this.layers[i];
      r.rotation.z = t * 0.08 * (i % 2 ? 1 : -1);
      r.material.opacity = reveal * (0.08 + c * 0.24 + Math.sin(t * 1.4 + i) * 0.02);
      r.position.y = 3.9 + i * 0.24 + Math.sin(t * 0.5 + i * 0.6) * 0.03;
    }
    this.metaLabel.material.opacity = 0.3 + c * 0.5;

    this.crystal.rotation.y = t * 0.08;
    this.crystal.scale.setScalar(reveal * lerp(1, 1.08, c));
    this.inner.rotation.y = -t * 0.14;
    this.inner.rotation.x = t * 0.05;
    this.inner.scale.setScalar(reveal * (1 + Math.sin(t * 1.2) * 0.02));
    this.core.material.opacity = 0.18 + c * 0.22;
    this.lineage.material.opacity = 0.06 + c * 0.26;

    // A single commit ring when compaction lands.
    const settle = clamp((c - 0.86) / 0.14);
    this.commit.material.opacity = Math.sin(settle * Math.PI) * 0.55;
    this.commit.scale.setScalar(lerp(0.3, 1.5, settle));
    if (settle > 0.02 && settle < 0.4 && rig) rig.addShake(0.006);

    if (this.motes) this.motes.rotation.y = t * 0.008;
  }
}
