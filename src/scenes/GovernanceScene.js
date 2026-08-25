import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { shot, pathAt } from './shot.js';
import { halo, glowSprite } from './props.js';
import { emissive, lineMaterial, labelSprite, pointCloud } from '../lib/gfx.js';
import { clamp, ramp, lerp, easeInOut, TAU } from '../lib/math.js';
import { M4, Q, E, V, V2, COL } from '../lib/scratch.js';

const RAW = new THREE.Color('#6fd8c8');
const DUPE = new THREE.Color('#3f7f78');
const TOKEN = new THREE.Color('#e8c37a');

/**
 * SCENE 12 — GOVERNED, UNIFIED DATA
 *
 * After the noise of streaming and the resonance of CHORON, this era is quiet
 * on purpose. Fragments of the same person arrive from every direction,
 * duplicates collapse into a single stable identity, and that identity crosses
 * a boundary. What comes out the other side is gold instead of green, and it is
 * a different shape: the raw value did not travel, only a token did.
 *
 * The whole scene is one sentence — many records, one identity, nothing raw
 * leaves — and it is told without a single line of explanatory text on screen.
 */
export class GovernanceScene extends SceneBase {
  static key = 'governance';

  constructor(ctx) {
    super(ctx);
    this.lighting = {
      bg: '#04100f',
      fog: '#061715',
      fogDensity: 0.03,
      ambient: { color: '#2f5b55', intensity: 0.65 },
      hemi: { sky: '#6fc0b4', ground: '#04100f', intensity: 0.6 },
      key: { color: '#e8dcb8', intensity: 1.4, pos: [3, 5, 3] },
      rim: { color: '#6fd8c8', intensity: 1.5, pos: [-4, 2.6, -4] },
      fill: { color: '#1a4038', intensity: 0.6, pos: [0, 1.6, 6] },
      exposure: 1,
    };

    this.shotKeys = [
      { at: 0.00, pos: [0.6, 2.2, 6.8], target: [0.0, 1.9, -0.4], fov: 46 },
      { at: 0.26, pos: [-2.8, 2.0, 4.2], target: [0.0, 1.85, -0.6], fov: 44 },
      { at: 0.54, pos: [0.4, 1.75, 3.4], target: [0.1, 1.85, -1.4], fov: 40 },
      { at: 0.80, pos: [2.6, 1.9, 1.6], target: [0.0, 1.9, -2.2], fov: 42 },
      { at: 1.00, pos: [0.5, 2.3, 3.6], target: [0.0, 2.0, -1.2], fov: 46 },
    ];

    this.walkKeys = [
      { at: 0.00, pos: [1.5, 0, 3.0], ry: 3.4 },
      { at: 0.4, pos: [1.15, 0, 1.5], ry: 3.6 },
      { at: 1.00, pos: [1.1, 0, 1.35], ry: 3.6 },
    ];

    this.tokenised = 0;
  }

  build() {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(20, this.seg(60, 22)),
      new THREE.MeshStandardMaterial({ color: '#061412', roughness: 0.35, metalness: 0.65 })
    );
    floor.rotation.x = -Math.PI / 2;
    this.add(floor);

    // ------------------------------------------------------------- boundary
    // A vertical aperture. Everything governed passes through this plane.
    this.boundary = new THREE.Group();
    const frame = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.03, 6, this.seg(60, 22)),
      emissive('#e8c37a', 1.6)
    );
    this.boundary.add(frame);
    this.frame = frame;

    const film = new THREE.Mesh(
      new THREE.CircleGeometry(1.5, this.seg(52, 20)),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#6fd8c8'),
        transparent: true,
        opacity: 0.07,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.boundary.add(film);
    this.film = film;

    for (let i = 0; i < 3; i++) {
      const r = halo('#e8c37a', 1.7 + i * 0.4, 0.16 - i * 0.04);
      this.boundary.add(r);
    }
    this.boundary.position.set(0, 1.9, -1.6);
    this.add(this.boundary);

    const label = labelSprite('GOVERNANCE BOUNDARY', '#e8c37a', 0.52);
    label.position.set(0, 3.75, -1.6);
    label.material.opacity = 0.45;
    this.add(label);

    // ----------------------------------------------------- identity resolve
    // Duplicate fragments of the same entity, arriving from all sides.
    this.fragCount = this.count(120, 40);
    this.frags = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.13, 0.09, 0.02),
      emissive('#6fd8c8', 1.6),
      this.fragCount
    );
    this.frags.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fragData = [];
    this.clusterCount = Math.max(4, Math.round(7 * this.caps.detail));
    this.clusters = [];
    for (let i = 0; i < this.clusterCount; i++) {
      const a = (i / this.clusterCount) * TAU;
      this.clusters.push(new THREE.Vector3(Math.cos(a) * 1.05, 1.9 + Math.sin(a * 2) * 0.4, 1.4 + Math.sin(a) * 0.7));
    }
    for (let i = 0; i < this.fragCount; i++) {
      const a = this.rand() * TAU;
      const r = 4 + this.rand() * 5;
      this.fragData.push({
        origin: new THREE.Vector3(Math.cos(a) * r, 0.5 + this.rand() * 3.6, 2.6 + Math.sin(a) * r * 0.6),
        cluster: i % this.clusterCount,
        dupe: this.rand() > 0.45,
        speed: 0.1 + this.rand() * 0.16,
        phase: this.rand(),
        spin: (this.rand() - 0.5) * 1.2,
      });
    }
    this.add(this.frags);

    // The resolved entity: one record per cluster, then one record overall.
    this.entity = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.3, 1),
      emissive('#c8f2e8', 2.2)
    );
    this.entity.position.set(0, 1.9, 0.9);
    this.add(this.entity);

    this.entityHalo = halo('#6fd8c8', 0.62, 0.4);
    this.entityHalo.position.copy(this.entity.position);
    this.add(this.entityHalo);

    // ------------------------------------------------------------- tokens
    // What leaves: a different shape, a different colour, no raw value.
    this.tokenCount = this.count(30, 10);
    this.tokens = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.03, 6),
      emissive('#e8c37a', 2.2, { transparent: true, opacity: 0 }),
      this.tokenCount
    );
    this.tokens.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.add(this.tokens);

    // ---------------------------------------------------------- trust rings
    this.trust = [];
    for (let i = 0; i < 4; i++) {
      const r = halo('#6fd8c8', 2.6 + i * 1.5, 0.12 - i * 0.02);
      r.rotation.x = Math.PI / 2;
      r.position.y = 0.06 + i * 0.02;
      this.add(r);
      this.trust.push(r);
    }

    // Vault: a quiet structure behind the boundary holding what does not leave.
    const vault = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 2.2, 1.2),
      new THREE.MeshStandardMaterial({ color: '#08201d', roughness: 0.3, metalness: 0.6, transparent: true, opacity: 0.5 })
    );
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(2.2, 2.2, 1.2)),
      lineMaterial('#6fd8c8', 0.3)
    );
    vault.add(shell, wire);
    vault.position.set(0, 1.9, -4.2);
    this.add(vault);
    this.vault = vault;

    const lineagePts = [];
    for (const c of this.clusters) {
      lineagePts.push(c.x, c.y, c.z, 0, 1.9, 0.9);
    }
    lineagePts.push(0, 1.9, 0.9, 0, 1.9, -1.6);
    lineagePts.push(0, 1.9, -1.6, 0, 1.9, -4.2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lineagePts), 3));
    this.lineage = new THREE.LineSegments(g, lineMaterial('#9fe8dc', 0.14));
    this.add(this.lineage);

    this.glow = glowSprite('#e8c37a', 3, 0.14);
    this.glow.position.set(0, 1.9, -1.6);
    this.add(this.glow);

    const motes = [];
    const n = this.count(160, 40);
    for (let i = 0; i < n; i++) motes.push((this.rand() - 0.5) * 26, this.rand() * 8, (this.rand() - 0.5) * 26);
    this.motes = pointCloud(motes, { color: '#8fe0d0', size: 0.028, opacity: 0.26 });
    this.add(this.motes);

    const l = this.addLight(new THREE.PointLight('#9fe8dc', 5, 12, 2));
    if (l) l.position.set(0, 2.4, 0.6);
  }

  camera(local, out) {
    return shot(this.shotKeys, local, out);
  }

  choreograph(local, ctl) {
    ctl.costume('kamlendu');
    const p = pathAt(this.walkKeys, local);
    ctl.place(p.x, 0, p.z, p.ry);
    if (this.tokenised > 0.02 && this.tokenised < 0.99) {
      ctl.play('activate', { fade: 0.6 });
    } else {
      ctl.play('observe', { fade: 0.7 });
    }
    ctl.lookAt(0, 1.9, lerp(0.9, -1.6, this.tokenised), 0.85);
  }

  update({ local, t, dt, actions }) {
    this.tokenised = clamp(this.tokenised + (actions.tokenise ? dt * 0.45 : 0));
    const k = this.tokenised;
    const reveal = ramp(local, 0.03, 0.32);
    const converge = ramp(local, 0.1, 0.62);

    // Fragments travel in, group by entity, then collapse into one record.
    for (let i = 0; i < this.fragCount; i++) {
      const f = this.fragData[i];
      f.phase = (f.phase + dt * f.speed * (0.6 + converge)) % 1;
      const cluster = this.clusters[f.cluster];

      const inbound = easeInOut(clamp(f.phase * 1.4));
      V.copy(f.origin).lerp(cluster, inbound * converge);
      // Duplicates merge into the resolved entity; the survivor stays visible.
      const merge = f.dupe ? clamp(converge * 1.5 - 0.5) : 0;
      V2.copy(this.entity.position);
      V.lerp(V2, merge);
      V.y += Math.sin(t * 0.7 + i) * 0.03;

      E.set(t * f.spin * 0.3, t * f.spin * 0.4 + i, 0);
      Q.setFromEuler(E);
      const size = reveal * (1 - merge * 0.85) * (0.7 + inbound * 0.4);
      V2.setScalar(Math.max(0.0001, size));
      M4.compose(V, Q, V2);
      this.frags.setMatrixAt(i, M4);
      COL.copy(f.dupe ? DUPE : RAW).multiplyScalar(0.6 + inbound * 0.8);
      this.frags.setColorAt(i, COL);
    }
    this.frags.instanceMatrix.needsUpdate = true;
    if (this.frags.instanceColor) this.frags.instanceColor.needsUpdate = true;

    // The resolved identity: stable, and it stops wobbling once it is one thing.
    const stable = converge;
    this.entity.rotation.y = t * 0.4;
    this.entity.rotation.x = Math.sin(t * 0.6) * 0.2 * (1 - stable);
    this.entity.scale.setScalar(reveal * (0.6 + stable * 0.6) * (1 - k * 0.35));
    this.entity.material.emissiveIntensity = 1.4 + stable * 1.2;
    this.entityHalo.scale.setScalar(1 + Math.sin(t * 1.2) * 0.05 + stable * 0.3);
    this.entityHalo.material.opacity = reveal * (0.15 + stable * 0.3) * (1 - k * 0.6);
    this.entityHalo.lookAt(0, 1.9, 12);

    // Tokens leave the far side of the boundary.
    for (let i = 0; i < this.tokenCount; i++) {
      const u = ((t * 0.16 + i / this.tokenCount) % 1);
      const travel = clamp(k * 1.4 - i / this.tokenCount * 0.4);
      V.set(
        Math.sin(i * 2.3) * 0.5 * u,
        1.9 + Math.cos(i * 1.7) * 0.5 * u,
        lerp(-1.6, -5.4, u)
      );
      E.set(Math.PI / 2, t * 0.6 + i, u * 2);
      Q.setFromEuler(E);
      V2.setScalar(Math.max(0.0001, travel * (1 - u * 0.3)));
      M4.compose(V, Q, V2);
      this.tokens.setMatrixAt(i, M4);
    }
    this.tokens.instanceMatrix.needsUpdate = true;
    this.tokens.material.opacity = clamp(k * 1.5) * 0.95;

    // The boundary is only bright when it is doing something.
    this.frame.material.emissiveIntensity = reveal * (0.8 + k * 2.2 + Math.sin(t * 1.5) * 0.1);
    this.film.material.opacity = reveal * (0.05 + k * 0.14 + Math.sin(t * 2.2) * 0.015);
    COL.copy(RAW).lerp(TOKEN, k);
    this.film.material.color.copy(COL);
    this.glow.material.opacity = reveal * (0.1 + k * 0.24);
    this.boundary.rotation.z = t * 0.04;

    for (let i = 0; i < this.trust.length; i++) {
      this.trust[i].rotation.z = t * 0.05 * (i % 2 ? 1 : -1);
      this.trust[i].material.opacity = reveal * (0.06 + Math.sin(t * 0.8 + i) * 0.02 + k * 0.06);
    }

    this.vault.rotation.y = Math.sin(t * 0.12) * 0.06;
    this.lineage.material.opacity = reveal * (0.1 + k * 0.2);
    if (this.motes) this.motes.rotation.y = t * 0.005;
  }
}
