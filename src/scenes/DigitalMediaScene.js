import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { shot, pathAt } from './shot.js';
import { groundPlane, floppy, crtScreen, glowSprite } from './props.js';
import { matte, emissive } from '../lib/gfx.js';
import { clamp, ramp, lerp } from '../lib/math.js';
import { M4, Q, E, V, V2 } from '../lib/scratch.js';

/**
 * SCENE 5 — DIGITAL MEDIA
 *
 * A desk, a beige machine, a screen that takes a moment to warm up. This is
 * period-accurate rather than cyberpunk: the palette is phosphor green and
 * washed cyan because that is what these rooms actually looked like, not
 * because neon is a mood.
 *
 * The guide puts a disk in the drive and files appear on the glass — the first
 * time in the whole journey that storage answers back.
 */
export class DigitalMediaScene extends SceneBase {
  static key = 'digitalMedia';

  constructor(ctx) {
    super(ctx);
    this.lighting = {
      bg: '#04090a',
      fog: '#061012',
      fogDensity: 0.06,
      ambient: { color: '#23413c', intensity: 0.5 },
      hemi: { sky: '#3d6f68', ground: '#060b0c', intensity: 0.5 },
      key: { color: '#9fe8d0', intensity: 1.5, pos: [2.4, 3.4, 2.8] },
      rim: { color: '#4fd8b0', intensity: 1.2, pos: [-2.2, 2.2, -2.6] },
      fill: { color: '#16333a', intensity: 0.55, pos: [0, 1.6, 5] },
      exposure: 1,
    };

    this.shotKeys = [
      { at: 0.00, pos: [0.1, 1.62, 0.85], target: [0.0, 1.62, -0.4], fov: 20 },
      { at: 0.16, pos: [0.5, 1.6, 1.9], target: [0.05, 1.32, 0.1], fov: 34 },
      { at: 0.40, pos: [1.5, 1.52, 2.3], target: [0.05, 1.18, 0.0], fov: 42 },
      { at: 0.62, pos: [0.55, 1.42, 1.55], target: [0.0, 1.28, -0.15], fov: 34 },
      { at: 0.84, pos: [0.16, 1.24, 0.95], target: [0.0, 1.13, -0.05], fov: 26 },
      { at: 1.00, pos: [0.02, 1.13, 0.42], target: [0.0, 1.13, -0.3], fov: 16 },
    ];

    this.walkKeys = [
      { at: 0.00, pos: [1.5, 0, 1.5], ry: -2.3 },
      { at: 0.26, pos: [0.78, 0, 0.86], ry: -2.5 },
      { at: 1.00, pos: [0.78, 0, 0.86], ry: -2.5 },
    ];
  }

  build() {
    const detail = this.caps.detail;
    this.add(groundPlane('#080e10', 44, 0.92));

    const wall = new THREE.Mesh(new THREE.PlaneGeometry(20, 8), matte('#08100f', 1));
    wall.position.set(0, 4, -3.2);
    this.add(wall);

    // ---------------------------------------------------------------- desk
    const desk = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.055, 0.9), matte('#4c4438', 0.8));
    top.position.y = 0.9;
    top.castShadow = this.caps.shadows;
    top.receiveShadow = true;
    desk.add(top);
    for (const x of [-0.95, 0.95]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.85), matte('#3c352c', 0.85));
      side.position.set(x, 0.45, 0);
      desk.add(side);
    }
    desk.position.z = -0.2;
    this.add(desk);

    // ---------------------------------------------------------- workstation
    this.crt = crtScreen(0.62, 0.48);
    this.crt.position.set(-0.02, 1.24, -0.36);
    this.crt.rotation.y = 0.12;
    this.add(this.crt);
    this.glass = this.crt.userData.glass;

    // The chassis with the drive slot the disk goes into.
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.17, 0.62), matte('#c6c0a8', 0.8));
    chassis.position.set(0.02, 1.02, -0.1);
    this.add(chassis);

    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.028, 0.03), matte('#1a1c18', 1));
    slot.position.set(-0.08, 1.02, 0.21);
    this.add(slot);

    this.driveLed = new THREE.Mesh(new THREE.CircleGeometry(0.012, 10), emissive('#5cff9f', 0.4));
    this.driveLed.position.set(0.24, 1.02, 0.212);
    this.add(this.driveLed);

    const keyboard = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.03, 0.24), matte('#cdc7ae', 0.85));
    keyboard.position.set(-0.06, 0.945, 0.24);
    keyboard.rotation.x = -0.05;
    this.add(keyboard);

    // Keycaps as one instanced grid — 60 keys for the cost of one draw call.
    const keyGeo = new THREE.BoxGeometry(0.026, 0.008, 0.026);
    const keys = new THREE.InstancedMesh(keyGeo, matte('#a9a48e', 0.8), 60);
    let ki = 0;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 15; c++) {
        V.set(-0.32 + c * 0.0435, 0.962 + r * 0.001, 0.175 + r * 0.032);
        E.set(-0.05, 0, 0);
        Q.setFromEuler(E);
        V2.setScalar(1);
        M4.compose(V, Q, V2);
        keys.setMatrixAt(ki++, M4);
      }
    }
    keys.count = ki;
    keys.instanceMatrix.needsUpdate = true;
    this.add(keys);

    // -------------------------------------------------------------- floppies
    this.disk = floppy(0.42, '#1f2b33');
    this.disk.position.set(0.62, 1.13, 0.3);
    this.disk.rotation.set(0, -0.3, 0.1);
    this.add(this.disk);

    const spare = floppy(0.4, '#26323a');
    spare.rotation.set(-Math.PI / 2, 0, 0.3);
    spare.position.set(0.78, 0.94, -0.1);
    this.add(spare);

    // ------------------------------------------------------------ file blocks
    // What appears on the glass once the disk is read.
    this.fileCount = this.count(22, 8);
    const fileGeo = new THREE.PlaneGeometry(0.038, 0.026);
    this.fileMat = emissive('#6effc0', 2.4, { transparent: true, opacity: 0.9 });
    this.files = new THREE.InstancedMesh(fileGeo, this.fileMat, this.fileCount);
    this.files.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.glass.add(this.files);
    this.files.position.z = 0.004;

    this.fileSlots = [];
    for (let i = 0; i < this.fileCount; i++) {
      this.fileSlots.push({
        x: -0.24 + (i % 6) * 0.096,
        y: 0.17 - Math.floor(i / 6) * 0.062,
      });
    }

    this.screenGlow = glowSprite('#57f5b4', 1.5, 0);
    this.screenGlow.position.set(-0.02, 1.24, -0.05);
    this.add(this.screenGlow);

    this.screenLight = this.addLight(new THREE.PointLight('#5cf0b4', 0, 4.5, 2));
    if (this.screenLight) this.screenLight.position.set(0, 1.35, 0.15);
  }

  camera(local, out) {
    return shot(this.shotKeys, local, out);
  }

  choreograph(local, ctl) {
    ctl.costume('casual');
    const p = pathAt(this.walkKeys, local);
    ctl.place(p.x, 0, p.z, p.ry);

    if (local < 0.24) {
      ctl.auto();
      ctl.lookAt(0, 1.25, -0.3, 0.6);
    } else if (local < 0.46) {
      ctl.play('reach', { param: ramp(local, 0.24, 0.44), fade: 0.5 });
      ctl.lookAt(0, 1.05, 0.2, 0.9);
    } else if (local < 0.8) {
      ctl.play('observe', { fade: 0.6 });
      ctl.lookAt(-0.02, 1.28, -0.36, 0.95);
    } else {
      ctl.play('reach', { param: 0.7, fade: 0.6 });
      ctl.lookAt(0, 1.13, 0, 0.9);
    }
  }

  update({ local, t }) {
    const insert = ramp(local, 0.28, 0.5);
    const boot = ramp(local, 0.48, 0.66);
    const read = ramp(local, 0.6, 0.86);
    const spin = ramp(local, 0.82, 1);

    // The disk travels from the guide's hand into the slot, then comes back out
    // and turns to show what is inside it.
    this.disk.position.set(
      lerp(0.62, -0.08, insert) + spin * 0.08,
      lerp(1.13, 1.02, insert),
      lerp(0.3, 0.14, insert) + spin * 0.14
    );
    this.disk.rotation.set(
      lerp(0, -Math.PI / 2, insert) * (1 - spin) + spin * -0.2,
      lerp(-0.3, 0, insert) + spin * t * 1.6,
      lerp(0.1, 0, insert)
    );
    this.disk.scale.setScalar(lerp(1, 1.5, spin));
    this.disk.userData.inner.visible = spin > 0.05;
    this.disk.userData.shutter.position.x = 0.42 * 0.04 - insert * 0.06;

    this.driveLed.material.emissiveIntensity = 0.3 + (read > 0 ? (Math.sin(t * 14) > 0 ? 3 : 0.4) : 0.2);

    // CRT warm-up: a bright line that opens into a full raster.
    const warm = boot;
    this.glass.material.emissiveIntensity = 0.25 + warm * 1.15 + Math.sin(t * 31) * 0.03 * warm;
    this.glass.scale.y = clamp(0.02 + warm * 0.98);
    this.glass.material.map.offset.y = -t * 0.05;
    this.screenGlow.material.opacity = warm * 0.5;
    if (this.screenLight) this.screenLight.intensity = warm * 3.4;

    for (let i = 0; i < this.fileCount; i++) {
      const s = this.fileSlots[i];
      const on = clamp((read * this.fileCount - i) / 2);
      V.set(s.x, s.y, 0.004);
      E.set(0, 0, 0);
      Q.setFromEuler(E);
      V2.setScalar(Math.max(0.0001, on));
      M4.compose(V, Q, V2);
      this.files.setMatrixAt(i, M4);
    }
    this.files.instanceMatrix.needsUpdate = true;
    this.fileMat.opacity = clamp(read * 1.2) * (0.75 + Math.sin(t * 6) * 0.08);
  }
}
