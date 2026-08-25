import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { shot, pathAt } from './shot.js';
import { halo, glowSprite } from './props.js';
import { emissive, lineMaterial, labelSprite, pointCloud } from '../lib/gfx.js';
import { ramp, lerp, TAU } from '../lib/math.js';
import { M4, Q, E, V, V2, COL } from '../lib/scratch.js';

/**
 * SCENE 8 — CLOUD OBJECT STORAGE
 *
 * The one transition in the journey that should feel like relief. Everything
 * before this was a room; this is the first era with no ceiling, so the camera
 * opens up, the fog thins, and the guide walks out onto a translucent platform
 * suspended in the middle of nothing.
 *
 * Deliberately abstract architecture rather than service logos: the point is
 * that capacity stopped being a building, not that a particular vendor won.
 */
export class CloudScene extends SceneBase {
  static key = 'cloud';

  constructor(ctx) {
    super(ctx);
    this.lighting = {
      bg: '#050d13',
      fog: '#08161f',
      fogDensity: 0.018,
      ambient: { color: '#3d5f70', intensity: 0.75 },
      hemi: { sky: '#7fc8e0', ground: '#0a1a22', intensity: 0.85 },
      key: { color: '#e6f7ff', intensity: 1.6, pos: [4, 6, 4] },
      rim: { color: '#62d8ff', intensity: 1.6, pos: [-5, 2.5, -5] },
      fill: { color: '#1d4655', intensity: 0.7, pos: [0, 1, 7] },
      exposure: 1.05,
    };

    this.shotKeys = [
      { at: 0.00, pos: [3.4, 2.3, 3.2], target: [4.2, 1.9, -2.0], fov: 42 },
      { at: 0.18, pos: [1.2, 2.0, 4.6], target: [0.0, 2.2, -2.0], fov: 52 },
      { at: 0.44, pos: [-1.0, 3.4, 6.4], target: [0.2, 2.6, -3.0], fov: 60 },
      { at: 0.70, pos: [2.6, 2.4, 5.0], target: [0.0, 2.2, -3.4], fov: 54 },
      { at: 1.00, pos: [0.8, 2.1, 3.0], target: [-0.4, 2.3, -4.2], fov: 44 },
    ];

    this.walkKeys = [
      { at: 0.00, pos: [1.9, 0, 1.4], ry: 2.6 },
      { at: 0.35, pos: [0.6, 0, 0.3], ry: 3.0 },
      { at: 1.00, pos: [-0.5, 0, -2.4], ry: 3.2 },
    ];
  }

  build() {
    // ------------------------------------------------------------- platform
    // Translucent, so you can see there is nothing underneath it.
    const plat = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.2, 0.06, this.seg(64, 24)),
      new THREE.MeshStandardMaterial({
        color: '#0f3140',
        roughness: 0.18,
        metalness: 0.5,
        transparent: true,
        opacity: 0.42,
      })
    );
    plat.position.y = -0.03;
    this.add(plat);

    const edge = new THREE.Mesh(
      new THREE.TorusGeometry(4.2, 0.02, 6, this.seg(80, 30)),
      emissive('#62d8ff', 1.6)
    );
    edge.rotation.x = Math.PI / 2;
    this.add(edge);
    this.edge = edge;

    // ------------------------------------------------------------- objects
    // Object storage: a shoal of buckets drifting with almost no gravity.
    this.objCount = this.count(120, 34);
    const geo = new THREE.BoxGeometry(0.34, 0.22, 0.22);
    this.objects = new THREE.InstancedMesh(
      geo,
      new THREE.MeshStandardMaterial({ color: '#0e2733', roughness: 0.3, metalness: 0.35, transparent: true, opacity: 0.9 }),
      this.objCount
    );
    this.objects.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.objWire = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.35, 0.23, 0.23),
      new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.5 }),
      this.objCount
    );
    this.objWire.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    this.objData = [];
    for (let i = 0; i < this.objCount; i++) {
      const a = this.rand() * TAU;
      const r = 1.4 + this.rand() * 7.5;
      this.objData.push({
        a,
        r,
        y: 0.6 + this.rand() * 5.4,
        spin: (this.rand() - 0.5) * 0.5,
        bob: this.rand() * TAU,
        drift: 0.02 + this.rand() * 0.06,
        cold: this.rand() > 0.72,
      });
      COL.set(this.objData[i].cold ? '#3f6d80' : '#62d8ff');
      this.objWire.setColorAt(i, COL);
    }
    this.add(this.objects, this.objWire);

    // -------------------------------------------------------------- regions
    // Three rings in the distance: the same data, kept somewhere else.
    this.regions = [];
    const spec = [
      { x: -11, z: -9, s: 2.6, name: 'REGION A' },
      { x: 12, z: -7, s: 2.2, name: 'REGION B' },
      { x: -2, z: -19, s: 3.0, name: 'REGION C' },
    ];
    for (const s of spec) {
      const g = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const r = halo('#62d8ff', s.s * (0.6 + k * 0.22), 0.22 - k * 0.05);
        r.rotation.x = Math.PI / 2 + 0.4;
        r.rotation.z = k * 0.5;
        g.add(r);
      }
      const core = glowSprite('#9fe9ff', s.s * 0.8, 0.35);
      g.add(core);
      const lbl = labelSprite(s.name, '#9fe9ff', 0.6);
      lbl.position.y = s.s + 0.6;
      lbl.material.opacity = 0.4;
      g.add(lbl);
      g.position.set(s.x, 3.2, s.z);
      this.add(g);
      this.regions.push(g);
    }

    // ---------------------------------------------------------- replication
    // Arcs from the platform out to each region.
    this.arcs = [];
    for (const s of spec) {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0, 1.4, 0),
        new THREE.Vector3(s.x * 0.5, 8, s.z * 0.5),
        new THREE.Vector3(s.x, 3.2, s.z)
      );
      const pts = curve.getPoints(40);
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(g, lineMaterial('#62d8ff', 0.18));
      this.add(line);
      this.arcs.push({ line, curve, pulse: glowSprite('#c8f4ff', 0.28, 0.9) });
      this.add(this.arcs[this.arcs.length - 1].pulse);
    }

    // --------------------------------------------------------------- motes
    const pts = [];
    const n = this.count(260, 60);
    for (let i = 0; i < n; i++) {
      pts.push((this.rand() - 0.5) * 40, this.rand() * 14 - 2, (this.rand() - 0.5) * 40);
    }
    this.motes = pointCloud(pts, { color: '#8fdcff', size: 0.035, opacity: 0.32 });
    this.add(this.motes);

    // Catalogue: a quiet ring of index marks above the platform.
    this.catalogue = new THREE.Mesh(
      new THREE.TorusGeometry(2.4, 0.012, 6, this.seg(70, 24)),
      emissive('#a8ecff', 1.2)
    );
    this.catalogue.rotation.x = Math.PI / 2;
    this.catalogue.position.y = 4.4;
    this.add(this.catalogue);
  }

  camera(local, out) {
    return shot(this.shotKeys, local, out);
  }

  choreograph(local, ctl) {
    ctl.costume('modern');
    const p = pathAt(this.walkKeys, local);
    ctl.place(p.x, 0, p.z, p.ry);
    if (local > 0.2 && local < 0.5) {
      ctl.play('lookUp', { fade: 0.8 });
      ctl.lookAt(0, 7, -3, 0.7);
    } else {
      ctl.auto();
      ctl.lookAt(lerp(6, -4, local), 3.4, -6, 0.5);
    }
  }

  update({ local, t, dt }) {
    const open = ramp(local, 0.02, 0.34);

    for (let i = 0; i < this.objCount; i++) {
      const d = this.objData[i];
      d.a += dt * d.drift * 0.3;
      const y = d.y + Math.sin(t * 0.4 + d.bob) * 0.16;
      V.set(Math.cos(d.a) * d.r, y, Math.sin(d.a) * d.r);
      E.set(t * d.spin * 0.4, d.a + t * d.spin * 0.3, t * d.spin * 0.2);
      Q.setFromEuler(E);
      const s = open * (d.cold ? 0.72 : 1);
      V2.setScalar(Math.max(0.0001, s));
      M4.compose(V, Q, V2);
      this.objects.setMatrixAt(i, M4);
      this.objWire.setMatrixAt(i, M4);
    }
    this.objects.instanceMatrix.needsUpdate = true;
    this.objWire.instanceMatrix.needsUpdate = true;
    if (this.objWire.instanceColor) this.objWire.instanceColor.needsUpdate = true;

    // Replication pulses travelling out to the regions.
    for (let i = 0; i < this.arcs.length; i++) {
      const a = this.arcs[i];
      const u = ((t * 0.22 + i * 0.33) % 1);
      a.curve.getPoint(u, V);
      a.pulse.position.copy(V);
      a.pulse.material.opacity = open * 0.9 * Math.sin(u * Math.PI);
      a.line.material.opacity = 0.06 + open * 0.16;
    }

    for (let i = 0; i < this.regions.length; i++) {
      const g = this.regions[i];
      g.rotation.y = t * 0.06 * (i % 2 ? -1 : 1);
      g.rotation.z = Math.sin(t * 0.14 + i) * 0.05;
    }

    this.catalogue.rotation.z = t * 0.12;
    this.catalogue.material.emissiveIntensity = 0.8 + Math.sin(t * 1.6) * 0.25;
    this.edge.material.emissiveIntensity = 1.2 + Math.sin(t * 0.9) * 0.3;
    if (this.motes) this.motes.rotation.y = t * 0.006;

    // Exit: objects on the far side start locking into crystal alignment.
    const crystallise = ramp(local, 0.86, 1);
    if (crystallise > 0.001) {
      this.objects.material.opacity = lerp(0.9, 0.35, crystallise);
      this.objWire.material.opacity = lerp(0.5, 0.9, crystallise);
    }
  }
}
