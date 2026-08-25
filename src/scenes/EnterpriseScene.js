import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { shot, pathAt } from './shot.js';
import { groundPlane, platter, glowSprite } from './props.js';
import { matte, emissive, pointCloud, brushedTexture } from '../lib/gfx.js';
import { clamp, ramp, lerp } from '../lib/math.js';
import { M4, Q, E, V, V2, COL } from '../lib/scratch.js';

const LED_ON = new THREE.Color('#8ff0d0');
const LED_OFF = new THREE.Color('#0d2b28');
const LED_AMBER = new THREE.Color('#ffb45c');

/**
 * SCENE 6 — HARD DISK / ENTERPRISE
 *
 * The disk from the previous era lies down into a machine, turns out to be one
 * of a stack, and then the room around it stands up. Racks rise out of the
 * floor in order of distance, which is the cheapest possible way to say
 * "storage became infrastructure" without a caption.
 *
 * The corridor is two instanced meshes and one instanced LED field — about
 * three draw calls for thirty-odd racks — which is what makes a data centre
 * affordable on a phone.
 */
export class EnterpriseScene extends SceneBase {
  static key = 'enterprise';

  constructor(ctx) {
    super(ctx);
    this.lighting = {
      bg: '#050a0f',
      fog: '#07111a',
      fogDensity: 0.055,
      ambient: { color: '#2b3d4c', intensity: 0.55 },
      hemi: { sky: '#5f7d94', ground: '#070c11', intensity: 0.6 },
      key: { color: '#cfe4f2', intensity: 1.5, pos: [3, 5, 3] },
      rim: { color: '#5ad2c0', intensity: 1.0, pos: [-3, 2.6, -6] },
      fill: { color: '#1b2c38', intensity: 0.5, pos: [0, 2, 6] },
      exposure: 1,
    };

    this.shotKeys = [
      { at: 0.00, pos: [0.0, 1.15, 0.52], target: [0.0, 1.15, 0.0], fov: 16 },
      { at: 0.16, pos: [0.18, 1.52, 1.5], target: [0.0, 1.12, 0.0], fov: 30 },
      { at: 0.36, pos: [0.7, 2.05, 3.3], target: [0.0, 1.02, -0.5], fov: 42 },
      { at: 0.56, pos: [1.0, 1.98, 4.2], target: [0.3, 1.35, -2.2], fov: 46 },
      { at: 0.76, pos: [0.62, 1.86, 0.3], target: [0.2, 1.28, -6.0], fov: 44 },
      { at: 1.00, pos: [0.5, 1.72, -9.2], target: [0.2, 1.2, -15.5], fov: 40 },
    ];

    this.walkKeys = [
      { at: 0.00, pos: [0.95, 0, 3.0], ry: Math.PI },
      { at: 0.46, pos: [0.6, 0, 1.6], ry: Math.PI },
      { at: 1.00, pos: [0.15, 0, -14.2], ry: Math.PI },
    ];
  }

  build() {
    const detail = this.caps.detail;
    const floor = groundPlane('#0a1016', 80, 0.6);
    floor.material.metalness = 0.35;
    this.add(floor);

    // ------------------------------------------------------- the hero platter
    this.platter = platter(1.0, detail);
    this.platter.position.set(0, 1.15, 0);
    this.add(this.platter);

    // The chassis it lies down into.
    this.chassis = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, 2.4), matte('#151c23', 0.6, 0.5));
    this.chassis.position.set(0, 1.02, 0);
    this.chassis.scale.setScalar(0.001);
    this.add(this.chassis);

    // The stack it turns out to belong to.
    this.stackCount = this.count(9, 4);
    const discGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.012, this.seg(40, 18));
    this.stack = new THREE.InstancedMesh(
      discGeo,
      new THREE.MeshStandardMaterial({ map: brushedTexture(), color: '#aab3ba', roughness: 0.2, metalness: 0.95 }),
      this.stackCount
    );
    this.stack.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.stackSlots = [];
    for (let i = 0; i < this.stackCount; i++) {
      const c = i % 3;
      const r = Math.floor(i / 3);
      this.stackSlots.push({ x: -1.7 + c * 1.7, y: 1.05, z: -1.6 + r * 1.7 });
    }
    this.add(this.stack);

    // ---------------------------------------------------------- the corridor
    this.rackCount = Math.max(9, Math.round(19 * this.caps.density));
    const spacing = 1.5;
    this.rackSpacing = spacing;
    const rackGeo = new THREE.BoxGeometry(0.66, 2.15, 1.0);
    this.racks = new THREE.InstancedMesh(rackGeo, matte('#121920', 0.72, 0.35), this.rackCount * 2);
    this.racks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rackSlots = [];
    for (let i = 0; i < this.rackCount; i++) {
      const z = -1.6 - i * spacing;
      for (const side of [-1, 1]) {
        this.rackSlots.push({ x: side * 1.95, z, side, order: i });
      }
    }
    this.add(this.racks);

    // Faces, so the racks read as equipment and not as blocks.
    const faceGeo = new THREE.BoxGeometry(0.6, 0.1, 0.02);
    this.faces = new THREE.InstancedMesh(faceGeo, matte('#1d2831', 0.55, 0.45), this.rackSlots.length * 12);
    this.faces.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.add(this.faces);

    // The LED field: every blinking light in the corridor in one draw call.
    const ledGeo = new THREE.PlaneGeometry(0.022, 0.022);
    this.ledMat = emissive('#8ff0d0', 2.6);
    this.ledsPerRack = 12;
    this.leds = new THREE.InstancedMesh(ledGeo, this.ledMat, this.rackSlots.length * this.ledsPerRack);
    this.leds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.add(this.leds);
    for (let i = 0; i < this.leds.count; i++) this.leds.setColorAt(i, LED_OFF);

    // Overhead cable tray gives the corridor a ceiling to be under.
    const trayGeo = new THREE.BoxGeometry(0.5, 0.06, this.rackCount * spacing + 4);
    for (const x of [-1.95, 1.95]) {
      const tray = new THREE.Mesh(trayGeo, matte('#1a232b', 0.8, 0.3));
      tray.position.set(x, 2.62, -1.6 - (this.rackCount * spacing) / 2);
      this.add(tray);
    }

    // A haze of dust in the cold aisle.
    const n = this.count(200, 50);
    const pts = [];
    for (let i = 0; i < n; i++) {
      pts.push((this.rand() - 0.5) * 4.4, this.rand() * 2.8, -this.rand() * this.rackCount * spacing);
    }
    this.haze = pointCloud(pts, { color: '#9fd8e8', size: 0.02, opacity: 0.3 });
    this.add(this.haze);

    // Exit seed: the LEDs stop being lights and start being nodes.
    const nodePts = [];
    const nn = this.count(150, 40);
    for (let i = 0; i < nn; i++) {
      const s = this.rackSlots[Math.floor(this.rand() * this.rackSlots.length)];
      nodePts.push(s.x, 0.4 + this.rand() * 1.8, s.z);
    }
    this.nodes = pointCloud(nodePts, { color: '#e3a152', size: 0.07, opacity: 0 });
    this.nodeBase = Float32Array.from(nodePts);
    this.add(this.nodes);

    this.aisleLight = this.addLight(new THREE.PointLight('#bfe6ff', 6, 10, 2));
    if (this.aisleLight) this.aisleLight.position.set(0, 2.3, -2);

    this.platterGlow = glowSprite('#cfe4f2', 1.2, 0.25);
    this.platterGlow.position.set(0, 1.2, 0.1);
    this.add(this.platterGlow);
  }

  camera(local, out) {
    return shot(this.shotKeys, local, out);
  }

  choreograph(local, ctl) {
    ctl.costume('enterprise');
    const p = pathAt(this.walkKeys, local);
    ctl.place(p.x, 0, p.z, p.ry);

    if (local < 0.5) {
      ctl.auto();
      ctl.lookAt(0, 1.1, 0, 0.5);
    } else {
      ctl.auto();
      // Glances at the racks either side, then back down the aisle.
      const side = Math.sin(local * 11) * 2.4;
      ctl.lookAt(side, 1.6, p.z - 4, 0.35);
    }
  }

  update({ local, t }) {
    const layDown = ramp(local, 0.04, 0.24);
    const multiply = ramp(local, 0.22, 0.46);
    const rise = ramp(local, 0.42, 0.72);
    const walk = ramp(local, 0.6, 1);
    const scatter = ramp(local, 0.86, 1);

    // The disk from the last era lies down into a drive.
    this.platter.rotation.x = lerp(-Math.PI / 2, 0, layDown);
    this.platter.position.y = lerp(1.15, 1.1, layDown);
    this.platter.rotation.y = t * (0.4 + walk * 5.5);
    this.platter.userData.arm.rotation.y = Math.sin(t * 0.9) * 0.34 * (0.2 + walk);
    this.platterGlow.material.opacity = 0.25 * (1 - multiply);

    this.chassis.scale.setScalar(Math.max(0.001, multiply));
    this.chassis.visible = multiply > 0.01;

    // …and one of many.
    this.stack.visible = multiply > 0.01 && rise < 0.98;
    for (let i = 0; i < this.stackCount; i++) {
      const s = this.stackSlots[i];
      const on = clamp(multiply * 1.5 - i * 0.06) * (1 - rise);
      V.set(s.x, s.y, s.z);
      E.set(0, t * (0.3 + i * 0.05), 0);
      Q.setFromEuler(E);
      V2.setScalar(Math.max(0.0001, on));
      M4.compose(V, Q, V2);
      this.stack.setMatrixAt(i, M4);
    }
    this.stack.instanceMatrix.needsUpdate = true;

    // Racks stand up out of the floor, nearest first.
    let fi = 0;
    let li = 0;
    for (let i = 0; i < this.rackSlots.length; i++) {
      const s = this.rackSlots[i];
      const grow = clamp(rise * 2.4 - s.order * 0.1);
      const h = 2.15 * grow;

      V.set(s.x, h / 2, s.z);
      E.set(0, s.side > 0 ? -0.02 : 0.02, 0);
      Q.setFromEuler(E);
      V2.set(1, Math.max(0.0001, grow), 1);
      M4.compose(V, Q, V2);
      this.racks.setMatrixAt(i, M4);

      for (let u = 0; u < 12; u++) {
        const y = 0.12 + u * 0.17;
        const on = y < h ? 1 : 0.0001;
        V.set(s.x + s.side * -0.52, y, s.z);
        E.set(0, s.side > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
        Q.setFromEuler(E);
        V2.setScalar(on);
        M4.compose(V, Q, V2);
        this.faces.setMatrixAt(fi++, M4);

        // One LED per unit, each blinking on its own schedule.
        V.set(s.x + s.side * -0.535, y, s.z - 0.18);
        M4.compose(V, Q, V2);
        this.leds.setMatrixAt(li, M4);
        const seed = i * 7 + u * 13;
        const blink = Math.sin(t * (2.2 + (seed % 5) * 0.7) + seed) > 0.1;
        const amber = seed % 11 === 0;
        COL.copy(blink && y < h ? (amber ? LED_AMBER : LED_ON) : LED_OFF);
        COL.multiplyScalar(0.25 + walk * 0.9);
        this.leds.setColorAt(li, COL);
        li++;
      }
    }
    this.racks.instanceMatrix.needsUpdate = true;
    this.faces.instanceMatrix.needsUpdate = true;
    this.leds.instanceMatrix.needsUpdate = true;
    if (this.leds.instanceColor) this.leds.instanceColor.needsUpdate = true;

    if (this.aisleLight) {
      this.aisleLight.position.z = lerp(0, -14, walk);
      this.aisleLight.intensity = 3 + walk * 5;
    }

    // Individual machines start to come loose and become nodes.
    if (scatter > 0.001) {
      const arr = this.nodes.geometry.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        const bx = this.nodeBase[i];
        const by = this.nodeBase[i + 1];
        const bz = this.nodeBase[i + 2];
        const sp = scatter * scatter;
        arr[i] = bx + Math.sin(i * 0.7) * sp * 2.4;
        arr[i + 1] = by + Math.cos(i * 0.4) * sp * 1.6 + sp * 0.8;
        arr[i + 2] = bz + Math.sin(i * 0.23) * sp * 2.0;
      }
      this.nodes.geometry.attributes.position.needsUpdate = true;
      this.nodes.material.opacity = scatter * 0.9;
    } else if (this.nodes.material.opacity !== 0) {
      this.nodes.material.opacity = 0;
    }

    if (this.haze) this.haze.rotation.y = t * 0.004;
  }
}
