import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { shot, pathAt } from './shot.js';
import { halo, glowSprite } from './props.js';
import { emissive, lineMaterial, pointCloud } from '../lib/gfx.js';
import { clamp, ramp, lerp, TAU } from '../lib/math.js';
import { M4, Q, E, V, V2, COL } from '../lib/scratch.js';

const WHITE_HOT = new THREE.Color('#ffd9f6');

/**
 * SCENE 11 — CHORON
 *
 * Streaming was directional: everything went one way, fast. CHORON is the
 * opposite shape — spatial, concentric, rhythmic. The guide stops walking for
 * the first time in six eras and stands still in the middle of a chamber that
 * keeps time around them.
 *
 * Content note, and it matters: no implementation detail is depicted here. The
 * brief was explicit that CHORON must stay conceptual unless real architecture
 * was supplied in the source, and it was not. So this scene renders a feeling —
 * orchestration, resonance, a system that keeps its own time — and the copy
 * says plainly that it is a concept. Nothing on screen claims to be a diagram.
 */
export class ChoronScene extends SceneBase {
  static key = 'choron';

  constructor(ctx) {
    super(ctx);
    this.lighting = {
      bg: '#07051a',
      fog: '#0a0722',
      fogDensity: 0.034,
      ambient: { color: '#3b2a63', intensity: 0.6 },
      hemi: { sky: '#7b5fc8', ground: '#08061a', intensity: 0.55 },
      key: { color: '#c8a8ff', intensity: 1.2, pos: [2.5, 5, 3] },
      rim: { color: '#ff6fd8', intensity: 1.7, pos: [-4, 2.6, -4] },
      fill: { color: '#2a1b52', intensity: 0.6, pos: [0, 1.4, 5] },
      exposure: 1,
    };

    this.shotKeys = [
      { at: 0.00, pos: [0.4, 1.9, 7.4], target: [0.0, 2.0, 0.0], fov: 46 },
      { at: 0.24, pos: [3.6, 2.2, 4.4], target: [0.0, 2.1, 0.0], fov: 44 },
      { at: 0.50, pos: [1.2, 1.7, 3.0], target: [0.0, 2.2, 0.0], fov: 42 },
      { at: 0.76, pos: [-2.2, 2.6, 3.4], target: [0.0, 2.2, 0.0], fov: 45 },
      { at: 1.00, pos: [0.2, 3.2, 5.0], target: [0.0, 2.0, -0.6], fov: 48 },
    ];

    this.walkKeys = [
      { at: 0.00, pos: [0.2, 0, 3.6], ry: Math.PI },
      { at: 0.34, pos: [0.05, 0, 1.5], ry: Math.PI },
      { at: 1.00, pos: [0.05, 0, 1.4], ry: Math.PI },
    ];

    this.pulse = 0;
    this.wave = -1;
  }

  build() {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(14, this.seg(64, 24)),
      new THREE.MeshStandardMaterial({ color: '#0a0720', roughness: 0.3, metalness: 0.7 })
    );
    floor.rotation.x = -Math.PI / 2;
    this.add(floor);

    // ------------------------------------------------------- temporal rings
    this.ringSpecs = [];
    const count = Math.max(4, Math.round(8 * this.caps.detail));
    for (let i = 0; i < count; i++) {
      const r = 2.2 + i * 0.95;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.018 + i * 0.002, 4, this.seg(60, 22)),
        emissive('#b06aff', 1.2)
      );
      ring.rotation.x = Math.PI / 2 + (i % 2 ? 0.06 : -0.05) * (i * 0.4);
      ring.rotation.z = i * 0.3;
      ring.position.y = 2.0 + Math.sin(i * 1.1) * 0.55;
      this.add(ring);
      this.ringSpecs.push({ ring, r, base: ring.position.y, i });
    }

    // ---------------------------------------------------------------- core
    this.core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.85, this.caps.detail > 0.8 ? 1 : 0),
      new THREE.MeshStandardMaterial({
        color: '#241145',
        emissive: new THREE.Color('#d06aff'),
        emissiveIntensity: 1.2,
        roughness: 0.2,
        metalness: 0.4,
        flatShading: true,
      })
    );
    this.core.position.set(0, 2.6, 0);
    this.add(this.core);

    this.coreCage = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.15, 1)),
      lineMaterial('#ff8fe0', 0.5)
    );
    this.coreCage.position.copy(this.core.position);
    this.add(this.coreCage);

    this.coreGlow = glowSprite('#e4a8ff', 4.5, 0.3);
    this.coreGlow.position.copy(this.core.position);
    this.add(this.coreGlow);

    // -------------------------------------------------------------- lattice
    // Nodes on a shell, connected — the topology the pulse travels through.
    this.nodeCount = this.count(46, 16);
    this.nodePos = [];
    for (let i = 0; i < this.nodeCount; i++) {
      // Fibonacci shell, so the distribution never clumps.
      const k = i + 0.5;
      const phi = Math.acos(1 - (2 * k) / this.nodeCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * k;
      const r = 4.6;
      this.nodePos.push(
        new THREE.Vector3(
          Math.cos(theta) * Math.sin(phi) * r,
          2.5 + Math.cos(phi) * r * 0.52,
          Math.sin(theta) * Math.sin(phi) * r
        )
      );
    }

    this.nodes = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.14, 0),
      emissive('#ffffff', 2),
      this.nodeCount
    );
    this.nodes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.add(this.nodes);

    const linePts = [];
    for (let i = 0; i < this.nodeCount; i++) {
      const a = this.nodePos[i];
      linePts.push(0, 2.6, 0, a.x, a.y, a.z);
      const b = this.nodePos[(i + 5) % this.nodeCount];
      if (a.distanceTo(b) < 5.4) linePts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePts), 3));
    this.lattice = new THREE.LineSegments(g, lineMaterial('#b06aff', 0.14));
    this.add(this.lattice);

    // Wavefront ring that travels outward on a pulse.
    this.front = halo('#ffb0f0', 1, 0);
    this.front.rotation.x = Math.PI / 2;
    this.front.position.y = 2.2;
    this.add(this.front);

    // Layered dimensional planes — faint, they give the chamber a ceiling.
    this.planes = [];
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(
        new THREE.RingGeometry(3 + i * 1.8, 3.2 + i * 1.8, this.seg(50, 20)),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color('#8f6ad0'),
          transparent: true,
          opacity: 0.09,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      p.rotation.x = Math.PI / 2;
      p.position.y = 6.2 + i * 0.9;
      this.add(p);
      this.planes.push(p);
    }

    const motes = [];
    const n = this.count(180, 40);
    for (let i = 0; i < n; i++) {
      const a = this.rand() * TAU;
      const r = 2 + this.rand() * 9;
      motes.push(Math.cos(a) * r, this.rand() * 8, Math.sin(a) * r);
    }
    this.motes = pointCloud(motes, { color: '#dfa8ff', size: 0.035, opacity: 0.3 });
    this.add(this.motes);

    const l = this.addLight(new THREE.PointLight('#d06aff', 8, 14, 2));
    if (l) l.position.set(0, 2.6, 0);
    this.coreLight = l;
  }

  camera(local, out) {
    return shot(this.shotKeys, local, out);
  }

  choreograph(local, ctl) {
    ctl.costume('modern');
    const p = pathAt(this.walkKeys, local);
    ctl.place(p.x, 0, p.z, p.ry);
    if (local > 0.4) {
      ctl.play('reach', { param: 0.55 + Math.sin(local * 6) * 0.1, fade: 0.8 });
    } else if (local > 0.28) {
      ctl.play('lookUp', { fade: 0.8 });
    } else {
      ctl.auto();
    }
    ctl.lookAt(0, 2.6, 0, 0.85);
  }

  update({ local, t, dt, actions, env }) {
    const reveal = ramp(local, 0.03, 0.3);

    // A pulse is a single travelling wavefront, not a global flash.
    if (actions.pulse && this.wave < 0) this.wave = 0;
    if (this.wave >= 0) {
      this.wave += dt * 0.42;
      if (this.wave > 1.35) this.wave = -1;
    }
    const w = this.wave;
    this.pulse = w >= 0 ? Math.sin(clamp(w) * Math.PI) : lerp(this.pulse, 0, dt * 2);

    const front = w >= 0 ? w * 11 : -1;

    this.core.rotation.y = t * 0.16;
    this.core.rotation.x = Math.sin(t * 0.24) * 0.18;
    this.core.scale.setScalar(reveal * (1 + this.pulse * 0.22 + Math.sin(t * 1.7) * 0.02));
    this.core.material.emissiveIntensity = 0.9 + this.pulse * 2.6 + Math.sin(t * 1.2) * 0.12;
    this.coreCage.rotation.y = -t * 0.1;
    this.coreCage.rotation.z = t * 0.06;
    this.coreCage.scale.setScalar(reveal * (1 + this.pulse * 0.3));
    this.coreCage.material.opacity = 0.3 + this.pulse * 0.5;
    this.coreGlow.material.opacity = reveal * (0.22 + this.pulse * 0.5);
    if (this.coreLight) this.coreLight.intensity = 5 + this.pulse * 14;

    // Rings respond as the wavefront passes their radius.
    for (const s of this.ringSpecs) {
      const hit = front > 0 ? clamp(1 - Math.abs(front - s.r) / 1.5) : 0;
      s.ring.rotation.z += dt * (0.05 + s.i * 0.012) * (s.i % 2 ? 1 : -1);
      s.ring.position.y = s.base + Math.sin(t * 0.5 + s.i * 0.7) * 0.06 + hit * 0.14;
      s.ring.material.emissiveIntensity = reveal * (0.5 + Math.sin(t * 1.3 + s.i) * 0.12 + hit * 3.4);
      s.ring.scale.setScalar(reveal * (1 + hit * 0.02));
    }

    // Nodes illuminate as it reaches them, then fade back.
    for (let i = 0; i < this.nodeCount; i++) {
      const p = this.nodePos[i];
      const d = Math.hypot(p.x, p.y - 2.6, p.z);
      const hit = front > 0 ? clamp(1 - Math.abs(front - d) / 1.8) : 0;
      V.copy(p);
      V.y += Math.sin(t * 0.6 + i) * 0.05;
      E.set(t * 0.3 + i, t * 0.24, 0);
      Q.setFromEuler(E);
      V2.setScalar(Math.max(0.0001, reveal * (0.7 + hit * 1.1)));
      M4.compose(V, Q, V2);
      this.nodes.setMatrixAt(i, M4);
      COL.set('#b06aff').lerp(WHITE_HOT, hit);
      COL.multiplyScalar(0.5 + hit * 1.6);
      this.nodes.setColorAt(i, COL);
    }
    this.nodes.instanceMatrix.needsUpdate = true;
    if (this.nodes.instanceColor) this.nodes.instanceColor.needsUpdate = true;

    this.lattice.material.opacity = reveal * (0.1 + this.pulse * 0.45);

    this.front.visible = front > 0;
    if (front > 0) {
      this.front.scale.setScalar(Math.max(0.01, front));
      this.front.material.opacity = clamp(1 - w) * 0.4;
    }

    for (let i = 0; i < this.planes.length; i++) {
      this.planes[i].rotation.z = t * 0.03 * (i % 2 ? -1 : 1);
      this.planes[i].material.opacity = reveal * (0.06 + this.pulse * 0.12);
    }

    if (this.motes) this.motes.rotation.y = t * 0.01;

    // Exposure lifts fractionally with the resonance — the room breathes light.
    if (env) env.exposure *= 1 + this.pulse * 0.16;
  }
}
