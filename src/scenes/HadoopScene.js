import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { shot, pathAt } from './shot.js';
import { glowSprite, halo } from './props.js';
import { matte, emissive, lineMaterial, labelSprite } from '../lib/gfx.js';
import { clamp, ramp, lerp, easeInOut } from '../lib/math.js';
import { M4, Q, E, V, V2, COL } from '../lib/scratch.js';

const LEGACY = new THREE.Color('#e3a152');
const CLOUD = new THREE.Color('#62d8ff');
const DIM = new THREE.Color('#2a2419');

/**
 * SCENE 7 — DISTRIBUTED DATA
 *
 * The racks stop being furniture and become topology. The guide is standing
 * inside the logical picture of a cluster rather than beside a machine, which
 * is the actual shift this era represents.
 *
 * "Run migration" is the one interaction in this scene, and it is grounded:
 * blocks leave the legacy cluster, land on the cloud side, get a validation
 * pulse, and only then does the old side go dark. Nothing is claimed about how
 * long it took or how much it saved — the animation states the shape of the
 * work and stops there.
 */
export class HadoopScene extends SceneBase {
  static key = 'hadoop';

  constructor(ctx) {
    super(ctx);
    this.lighting = {
      bg: '#060810',
      fog: '#080c14',
      fogDensity: 0.036,
      ambient: { color: '#33384a', intensity: 0.55 },
      hemi: { sky: '#5b6a86', ground: '#0b0a08', intensity: 0.5 },
      key: { color: '#ffc27a', intensity: 1.5, pos: [-4, 4.5, 3] },
      rim: { color: '#62d8ff', intensity: 1.4, pos: [5, 3.2, -3] },
      fill: { color: '#1e2838', intensity: 0.5, pos: [0, 2, 6] },
      exposure: 1,
    };

    this.shotKeys = [
      { at: 0.00, pos: [0.4, 1.75, 6.4], target: [-0.6, 1.7, 0.4], fov: 44 },
      { at: 0.26, pos: [-2.6, 2.3, 3.6], target: [-2.6, 1.75, -1.6], fov: 46 },
      { at: 0.52, pos: [0.2, 2.6, 5.2], target: [0.2, 1.7, -1.4], fov: 50 },
      { at: 0.78, pos: [2.4, 2.2, 4.6], target: [1.6, 1.7, -1.6], fov: 47 },
      { at: 1.00, pos: [3.6, 2.4, 3.4], target: [4.4, 1.9, -2.2], fov: 44 },
    ];

    this.walkKeys = [
      { at: 0.00, pos: [-0.4, 0, 2.4], ry: Math.PI },
      { at: 0.3, pos: [-1.6, 0, 1.6], ry: 3.5 },
      { at: 0.7, pos: [0.4, 0, 1.4], ry: 2.9 },
      { at: 1.00, pos: [1.9, 0, 1.2], ry: 2.6 },
    ];

    this.migrated = 0;
  }

  build() {
    const detail = this.caps.detail;

    // A dark reflective floor keeps the topology floating rather than grounded.
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 70),
      new THREE.MeshStandardMaterial({ color: '#070a10', roughness: 0.45, metalness: 0.6 })
    );
    floor.rotation.x = -Math.PI / 2;
    this.add(floor);

    const grid = new THREE.GridHelper(40, 40, 0x1b2635, 0x121a26);
    grid.material.transparent = true;
    grid.material.opacity = 0.4;
    this.add(grid);

    // ------------------------------------------------------------ the nodes
    this.legacyCount = Math.max(9, Math.round(18 * this.caps.density));
    this.cloudCount = Math.max(6, Math.round(12 * this.caps.density));
    const total = this.legacyCount + this.cloudCount;

    this.nodePos = [];
    for (let i = 0; i < this.legacyCount; i++) {
      const c = i % 3;
      const r = Math.floor(i / 3) % 3;
      const l = Math.floor(i / 9);
      this.nodePos.push(new THREE.Vector3(-4.4 + c * 1.15, 0.85 + r * 1.05, -2.6 + l * 1.5));
    }
    for (let i = 0; i < this.cloudCount; i++) {
      const c = i % 3;
      const r = Math.floor(i / 3) % 2;
      const l = Math.floor(i / 6);
      this.nodePos.push(new THREE.Vector3(3.4 + c * 1.1, 1.15 + r * 1.15, -2.4 + l * 1.6));
    }

    const bodyGeo = new THREE.BoxGeometry(0.34, 0.34, 0.34);
    this.nodeBodies = new THREE.InstancedMesh(bodyGeo, matte('#0d1219', 0.6, 0.4), total);
    this.nodeWires = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.36, 0.36, 0.36),
      new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.75 }),
      total
    );
    this.nodeCores = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), emissive('#ffffff', 1.6), total);

    for (let i = 0; i < total; i++) {
      const p = this.nodePos[i];
      V.copy(p);
      E.set(0, 0, 0);
      Q.setFromEuler(E);
      V2.setScalar(1);
      M4.compose(V, Q, V2);
      this.nodeBodies.setMatrixAt(i, M4);
      this.nodeWires.setMatrixAt(i, M4);
      this.nodeCores.setMatrixAt(i, M4);
      COL.copy(i < this.legacyCount ? LEGACY : CLOUD);
      this.nodeWires.setColorAt(i, COL);
      this.nodeCores.setColorAt(i, COL);
    }
    this.nodeBodies.instanceMatrix.needsUpdate = true;
    this.nodeWires.instanceMatrix.needsUpdate = true;
    this.nodeCores.instanceMatrix.needsUpdate = true;
    this.add(this.nodeBodies, this.nodeWires, this.nodeCores);

    // ------------------------------------------------------------- lineage
    const linePts = [];
    for (let i = 0; i < this.legacyCount; i++) {
      for (const j of [i + 1, i + 3, i + 9]) {
        if (j < this.legacyCount) {
          linePts.push(this.nodePos[i].x, this.nodePos[i].y, this.nodePos[i].z);
          linePts.push(this.nodePos[j].x, this.nodePos[j].y, this.nodePos[j].z);
        }
      }
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePts), 3));
    this.legacyLines = new THREE.LineSegments(lg, lineMaterial('#e3a152', 0.24));
    this.add(this.legacyLines);

    const cPts = [];
    for (let i = this.legacyCount; i < total; i++) {
      for (const j of [i + 1, i + 3]) {
        if (j < total) {
          cPts.push(this.nodePos[i].x, this.nodePos[i].y, this.nodePos[i].z);
          cPts.push(this.nodePos[j].x, this.nodePos[j].y, this.nodePos[j].z);
        }
      }
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cPts), 3));
    this.cloudLines = new THREE.LineSegments(cg, lineMaterial('#62d8ff', 0.06));
    this.add(this.cloudLines);

    // -------------------------------------------------------------- blocks
    this.blockCount = this.count(64, 20);
    this.blocks = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.11, 0.11, 0.11),
      emissive('#ffffff', 2.2),
      this.blockCount
    );
    this.blocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.blockData = [];
    for (let i = 0; i < this.blockCount; i++) {
      this.blockData.push({
        from: Math.floor(this.rand() * this.legacyCount),
        to: Math.floor(this.rand() * this.legacyCount),
        phase: this.rand(),
        speed: 0.22 + this.rand() * 0.3,
        arc: 0.3 + this.rand() * 0.6,
        crossed: false,
      });
    }
    this.add(this.blocks);

    // -------------------------------------------------------------- labels
    const l1 = labelSprite('LEGACY CLUSTER', '#e3a152', 0.7);
    l1.position.set(-3.8, 3.5, -1.8);
    const l2 = labelSprite('AWS', '#62d8ff', 0.7);
    l2.position.set(4.2, 3.3, -1.6);
    this.add(l1, l2);
    this.labelCloud = l2;
    l2.material.opacity = 0.25;

    // Validation halo that fires on the cloud side as blocks land.
    this.validate = halo('#7dffcf', 1.6, 0);
    this.validate.position.set(4.2, 1.8, -1.6);
    this.add(this.validate);

    this.legacyGlow = glowSprite('#e3a152', 4, 0.16);
    this.legacyGlow.position.set(-3.8, 1.8, -1.8);
    this.add(this.legacyGlow);

    this.cloudGlow = glowSprite('#62d8ff', 4.6, 0.05);
    this.cloudGlow.position.set(4.2, 1.9, -1.6);
    this.add(this.cloudGlow);
  }

  camera(local, out) {
    return shot(this.shotKeys, local, out);
  }

  choreograph(local, ctl) {
    ctl.costume('enterprise');
    const p = pathAt(this.walkKeys, local);
    ctl.place(p.x, 0, p.z, p.ry);
    if (this.migrated > 0.02 && this.migrated < 0.98) {
      ctl.play('reach', { param: 0.8, fade: 0.5 });
    } else {
      ctl.auto();
    }
    const look = this.migrated > 0.1 ? 4.2 : -3.8;
    ctl.lookAt(look, 2.0, -1.8, 0.7);
  }

  update({ local, t, dt, actions }) {
    // The interaction drives a value that only ever moves forward.
    const want = actions.migrate ? 1 : 0;
    this.migrated = clamp(this.migrated + (want ? dt * 0.42 : 0));
    const m = this.migrated;

    const total = this.legacyCount + this.cloudCount;
    const reveal = ramp(local, 0.05, 0.3);

    // Node presence, and the legacy side dimming as the migration completes.
    for (let i = 0; i < total; i++) {
      const legacy = i < this.legacyCount;
      const p = this.nodePos[i];
      const pulse = 1 + Math.sin(t * 2 + i * 0.9) * 0.05;
      const scale = legacy
        ? reveal * pulse * lerp(1, 0.82, m)
        : clamp(reveal * 1.2 - 0.1) * pulse * lerp(0.7, 1.08, m);

      V.copy(p);
      E.set(0, t * 0.12 + i, 0);
      Q.setFromEuler(E);
      V2.setScalar(Math.max(0.0001, scale));
      M4.compose(V, Q, V2);
      this.nodeBodies.setMatrixAt(i, M4);
      this.nodeWires.setMatrixAt(i, M4);
      V2.setScalar(Math.max(0.0001, scale * (0.8 + Math.sin(t * 3 + i) * 0.2)));
      M4.compose(V, Q, V2);
      this.nodeCores.setMatrixAt(i, M4);

      if (legacy) {
        COL.copy(LEGACY).lerp(DIM, m * 0.9);
      } else {
        COL.copy(CLOUD).multiplyScalar(0.4 + m * 0.9);
      }
      this.nodeWires.setColorAt(i, COL);
      this.nodeCores.setColorAt(i, COL);
    }
    this.nodeBodies.instanceMatrix.needsUpdate = true;
    this.nodeWires.instanceMatrix.needsUpdate = true;
    this.nodeCores.instanceMatrix.needsUpdate = true;
    if (this.nodeWires.instanceColor) this.nodeWires.instanceColor.needsUpdate = true;
    if (this.nodeCores.instanceColor) this.nodeCores.instanceColor.needsUpdate = true;

    // Blocks: replicating locally, then crossing.
    for (let i = 0; i < this.blockCount; i++) {
      const b = this.blockData[i];
      b.phase += dt * b.speed * (0.6 + reveal);
      if (b.phase >= 1) {
        b.phase = 0;
        b.from = b.to;
        const shouldCross = m > (i + 0.5) / this.blockCount;
        if (shouldCross) {
          b.to = this.legacyCount + Math.floor(this.rand() * this.cloudCount);
          b.crossed = true;
        } else if (b.crossed) {
          b.to = this.legacyCount + Math.floor(this.rand() * this.cloudCount);
        } else {
          b.to = Math.floor(this.rand() * this.legacyCount);
        }
      }
      const a = this.nodePos[b.from];
      const c = this.nodePos[b.to];
      const k = easeInOut(b.phase);
      V.lerpVectors(a, c, k);
      V.y += Math.sin(k * Math.PI) * b.arc;
      E.set(t * 2 + i, t * 1.4, 0);
      Q.setFromEuler(E);
      V2.setScalar(reveal * (0.7 + Math.sin(b.phase * Math.PI) * 0.5));
      M4.compose(V, Q, V2);
      this.blocks.setMatrixAt(i, M4);
      COL.copy(b.crossed ? CLOUD : LEGACY);
      this.blocks.setColorAt(i, COL);
    }
    this.blocks.instanceMatrix.needsUpdate = true;
    if (this.blocks.instanceColor) this.blocks.instanceColor.needsUpdate = true;

    // Validation fires as the cloud side receives.
    const vp = m > 0.02 && m < 1 ? (Math.sin(t * 3) * 0.5 + 0.5) : 0;
    this.validate.material.opacity = vp * 0.5 * m;
    this.validate.scale.setScalar(lerp(0.7, 1.7, (t * 0.4) % 1));

    this.legacyLines.material.opacity = 0.24 * reveal * lerp(1, 0.12, m);
    this.cloudLines.material.opacity = 0.06 + 0.3 * m;
    this.legacyGlow.material.opacity = 0.16 * lerp(1, 0.15, m);
    this.cloudGlow.material.opacity = 0.05 + 0.22 * m;
    this.labelCloud.material.opacity = 0.25 + m * 0.6;
  }
}
