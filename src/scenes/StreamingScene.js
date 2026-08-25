import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { shot, pathAt } from './shot.js';
import { halo, glowSprite } from './props.js';
import { emissive, labelSprite, lineMaterial } from '../lib/gfx.js';
import { clamp, ramp, lerp, TAU } from '../lib/math.js';
import { M4, Q, E, V, V2, COL } from '../lib/scratch.js';

const HOT = new THREE.Color('#ff914d');
const COOL = new THREE.Color('#62d8ff');

/**
 * SCENE 10 — LIVE STREAMING
 *
 * The highest-energy scene in the portfolio, and the one with the strictest
 * rule: every moving thing belongs to a flow. There are no ambient particles
 * here. Each packet is on a named lane travelling from a source, through Kafka,
 * through Spark Structured Streaming, into state, and out to Customer 360 — so
 * the motion is a diagram you can feel rather than confetti.
 *
 * The burst interaction raises the event rate and lights the pipeline in order.
 * Camera response is capped hard: a nudge, never a lurch.
 */
export class StreamingScene extends SceneBase {
  static key = 'streaming';

  constructor(ctx) {
    super(ctx);
    this.lighting = {
      bg: '#07070d',
      fog: '#0a0a14',
      fogDensity: 0.042,
      ambient: { color: '#3a3348', intensity: 0.5 },
      hemi: { sky: '#6d5f7a', ground: '#0a0a12', intensity: 0.45 },
      key: { color: '#ffb277', intensity: 1.6, pos: [3, 4, 4] },
      rim: { color: '#5ce0ff', intensity: 2.0, pos: [-4, 2.4, -6] },
      fill: { color: '#3a2233', intensity: 0.55, pos: [0, 1.6, 6] },
      exposure: 1.05,
    };

    this.stages = [
      { z: -1.5, name: 'SOURCE', color: '#9ad9ff' },
      { z: -7.5, name: 'KAFKA', color: '#62d8ff' },
      { z: -13.5, name: 'SPARK STRUCTURED STREAMING', color: '#ff914d' },
      { z: -19.5, name: 'STATE', color: '#ffc46b' },
      { z: -25.5, name: 'CUSTOMER 360', color: '#ffe9a8' },
    ];

    this.shotKeys = [
      { at: 0.00, pos: [0.4, 1.9, 3.2], target: [0.0, 1.7, -3.0], fov: 48 },
      { at: 0.24, pos: [0.9, 1.85, -2.4], target: [0.0, 1.6, -9.0], fov: 54 },
      { at: 0.50, pos: [0.2, 1.9, -8.6], target: [0.0, 1.6, -15.5], fov: 58 },
      { at: 0.76, pos: [-0.8, 1.8, -15.0], target: [0.0, 1.6, -21.5], fov: 55 },
      { at: 1.00, pos: [0.3, 1.85, -21.4], target: [0.0, 1.7, -28.0], fov: 48 },
    ];

    this.walkKeys = [
      { at: 0.00, pos: [0, 0, 0.6], ry: Math.PI },
      { at: 1.00, pos: [0, 0, -24.6], ry: Math.PI },
    ];

    this.burst = 0;
    this.flow = 0;
  }

  build() {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 80),
      new THREE.MeshStandardMaterial({ color: '#08080f', roughness: 0.4, metalness: 0.6 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -14;
    this.add(floor);

    // ---------------------------------------------------------- tunnel rings
    this.ringCount = Math.max(14, Math.round(34 * this.caps.density));
    this.ringSpacing = 28 / this.ringCount;
    this.rings = new THREE.InstancedMesh(
      new THREE.TorusGeometry(2.5, 0.02, 4, this.seg(36, 14)),
      emissive('#62d8ff', 1.4, { transparent: true, opacity: 0.8 }),
      this.ringCount
    );
    this.rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.add(this.rings);

    // ----------------------------------------------------------- flow lanes
    this.laneCount = Math.max(4, Math.round(7 * this.caps.detail));
    this.lanes = [];
    for (let i = 0; i < this.laneCount; i++) {
      const a = (i / this.laneCount) * TAU;
      const r = 1.15 + (i % 3) * 0.42;
      this.lanes.push({ a, r, twist: 0.5 + (i % 2) * 0.35, y: 1.5 + (i % 2 ? 0.25 : -0.15) });
    }

    // Draw the lanes themselves so packets visibly ride a path.
    const pts = [];
    for (const lane of this.lanes) {
      for (let s = 0; s < 60; s++) {
        for (const k of [s, s + 1]) {
          const u = k / 60;
          this._lanePoint(lane, u, V);
          pts.push(V.x, V.y, V.z);
        }
      }
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    this.laneLines = new THREE.LineSegments(lg, lineMaterial('#5ce0ff', 0.14));
    this.add(this.laneLines);

    // -------------------------------------------------------------- packets
    this.packetCount = this.count(220, 70);
    this.packets = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.07, 0.07, 0.3),
      emissive('#ffffff', 2.4),
      this.packetCount
    );
    this.packets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.packetData = [];
    for (let i = 0; i < this.packetCount; i++) {
      this.packetData.push({
        lane: i % this.laneCount,
        u: this.rand(),
        speed: 0.07 + this.rand() * 0.05,
        size: 0.7 + this.rand() * 0.7,
      });
    }
    this.add(this.packets);

    // --------------------------------------------------------------- stages
    this.stageObjects = [];
    for (const s of this.stages) {
      const g = new THREE.Group();
      const gate = new THREE.Mesh(
        new THREE.TorusGeometry(2.55, 0.055, 6, this.seg(44, 18)),
        emissive(s.color, 1.6)
      );
      g.add(gate);
      const ring = halo(s.color, 2.2, 0.2);
      g.add(ring);
      const glow = glowSprite(s.color, 3.2, 0.1);
      g.add(glow);
      const label = labelSprite(s.name, s.color, s.name.length > 12 ? 0.5 : 0.66);
      label.position.set(0, 3.05, 0);
      g.add(label);
      g.position.set(0, 1.55, s.z);
      this.add(g);
      this.stageObjects.push({ g, gate, ring, glow, label, spec: s });
    }

    // Customer 360 gets a destination worth arriving at.
    this.destination = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const r = halo('#ffe9a8', 1.2 + i * 0.6, 0.24 - i * 0.05);
      r.rotation.x = i * 0.6;
      r.rotation.y = i * 0.4;
      this.destination.add(r);
    }
    const core = glowSprite('#fff2c8', 2.4, 0.35);
    this.destination.add(core);
    this.destCore = core;
    this.destination.position.set(0, 1.6, -28.5);
    this.add(this.destination);
  }

  _lanePoint(lane, u, out) {
    const z = lerp(2, -28, u);
    const a = lane.a + u * lane.twist * TAU * 0.5;
    out.set(Math.cos(a) * lane.r, lane.y + Math.sin(a) * lane.r * 0.45, z);
    return out;
  }

  camera(local, out) {
    return shot(this.shotKeys, local, out);
  }

  choreograph(local, ctl) {
    ctl.costume('modern');
    const p = pathAt(this.walkKeys, local);
    ctl.place(p.x, 0, p.z, p.ry);
    ctl.auto();
    // Tracks the packets going past rather than staring straight ahead.
    const swing = Math.sin(local * 14) * 1.6;
    ctl.lookAt(swing, 1.9, p.z - 3.5, 0.45);
  }

  update({ local, t, dt, actions, rig }) {
    // Burst decays on its own; the button tops it up.
    this.burst = clamp(this.burst + (actions.burst ? dt * 2.2 : -dt * 0.5));
    const b = this.burst;
    const reveal = ramp(local, 0.02, 0.2);
    const rate = 1 + b * 2.6;
    this.flow += dt * rate;

    // Rings breathe down the length of the tunnel.
    for (let i = 0; i < this.ringCount; i++) {
      const z = 2 - i * this.ringSpacing;
      const wave = Math.sin(t * 2.2 - i * 0.45) * 0.5 + 0.5;
      const s = 1 + wave * 0.02 + b * 0.03;
      V.set(0, 1.55, z);
      E.set(0, 0, 0);
      Q.setFromEuler(E);
      V2.setScalar(reveal * s);
      M4.compose(V, Q, V2);
      this.rings.setMatrixAt(i, M4);
      COL.copy(COOL).lerp(HOT, clamp((-z - 6) / 18));
      COL.multiplyScalar(0.25 + wave * 0.5 + b * 0.7);
      this.rings.setColorAt(i, COL);
    }
    this.rings.instanceMatrix.needsUpdate = true;
    if (this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true;

    // Packets ride their lane, and change colour as they pass each stage.
    for (let i = 0; i < this.packetCount; i++) {
      const p = this.packetData[i];
      p.u = (p.u + dt * p.speed * rate) % 1;
      const lane = this.lanes[p.lane];
      this._lanePoint(lane, p.u, V);

      // Tangent, so packets point where they are going.
      this._lanePoint(lane, Math.min(1, p.u + 0.01), V2);
      const yaw = Math.atan2(V2.x - V.x, V2.z - V.z);
      const pitch = Math.atan2(V2.y - V.y, 0.34);
      E.set(-pitch, yaw, 0);
      Q.setFromEuler(E);

      const stretch = 1 + b * 1.6;
      V2.set(p.size, p.size, p.size * stretch);
      M4.compose(V, Q, V2);
      this.packets.setMatrixAt(i, M4);

      COL.copy(COOL).lerp(HOT, clamp((p.u - 0.28) * 2.2));
      COL.multiplyScalar(reveal * (0.8 + b * 0.9));
      this.packets.setColorAt(i, COL);
    }
    this.packets.instanceMatrix.needsUpdate = true;
    if (this.packets.instanceColor) this.packets.instanceColor.needsUpdate = true;

    // Stages light in order down the pipeline when a burst is injected.
    for (let i = 0; i < this.stageObjects.length; i++) {
      const s = this.stageObjects[i];
      const lag = clamp(b * 2.2 - i * 0.32);
      const beat = Math.sin(t * 3 - i * 0.7) * 0.5 + 0.5;
      s.gate.material.emissiveIntensity = reveal * (0.9 + beat * 0.5 + lag * 2.4);
      s.ring.material.opacity = reveal * (0.14 + lag * 0.4);
      s.ring.scale.setScalar(1 + Math.sin(t * 1.4 + i) * 0.02 + lag * 0.08);
      s.glow.material.opacity = reveal * (0.08 + lag * 0.32);
      s.label.material.opacity = reveal * (0.55 + lag * 0.45);
      s.g.rotation.z = t * 0.05 * (i % 2 ? 1 : -1);
    }

    // Customer 360 brightens last, which is the point of the whole pipeline.
    const arrive = clamp(b * 1.6 - 0.5);
    this.destination.rotation.y = t * 0.18;
    this.destination.rotation.x = Math.sin(t * 0.3) * 0.1;
    this.destCore.material.opacity = reveal * (0.28 + arrive * 0.6 + Math.sin(t * 4) * 0.05 * arrive);
    this.destination.scale.setScalar(1 + arrive * 0.14);

    this.laneLines.material.opacity = reveal * (0.1 + b * 0.28);

    // A nudge, deliberately capped so nobody gets motion sick.
    if (b > 0.05 && rig) rig.addShake(Math.min(0.02, b * 0.02));
  }
}
