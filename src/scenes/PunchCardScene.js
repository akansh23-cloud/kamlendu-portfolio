import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { shot, pathAt } from './shot.js';
import { groundPlane, punchCard, beam, glowSprite } from './props.js';
import { matte, metal, emissive } from '../lib/gfx.js';
import { clamp, ramp, lerp } from '../lib/math.js';
import { M4, Q, E, V, V2 } from '../lib/scratch.js';

/**
 * SCENE 3 — PUNCH CARDS
 *
 * Where writing stops being for people. A card goes into the machine, the
 * machine bites holes into it, and light comes through the other side. The
 * perforation pattern is the first thing in this whole story that a human
 * cannot read at a glance and a machine can.
 *
 * The exit is the transition the brief singled out: the camera flies into one
 * of the holes and comes out the far side inside a tape reel. Both scenes frame
 * a bright circle dead centre at the moment of the cut, so it reads as one
 * continuous move through an aperture rather than two shots spliced together.
 */
export class PunchCardScene extends SceneBase {
  static key = 'punchCard';

  constructor(ctx) {
    super(ctx);
    this.lighting = {
      bg: '#080604',
      fog: '#0f0a06',
      fogDensity: 0.055,
      ambient: { color: '#48331f', intensity: 0.55 },
      hemi: { sky: '#7a5330', ground: '#0f0a06', intensity: 0.5 },
      key: { color: '#ffa64d', intensity: 2.7, pos: [2.6, 3.6, 2.4] },
      rim: { color: '#8fb6d8', intensity: 0.9, pos: [-3, 2.6, -3.4] },
      fill: { color: '#3d2411', intensity: 0.4, pos: [0, 1.8, 5] },
      exposure: 1,
    };

    this.shotKeys = [
      { at: 0.00, pos: [3.9, 2.1, 4.6], target: [0.3, 1.25, 0.2], fov: 42 },
      { at: 0.26, pos: [2.4, 1.62, 2.7], target: [0.15, 1.2, 0.1], fov: 40 },
      { at: 0.50, pos: [1.15, 1.42, 1.62], target: [0.02, 1.14, 0.05], fov: 36 },
      { at: 0.72, pos: [0.42, 1.28, 1.05], target: [0.0, 1.16, 0.0], fov: 30 },
      { at: 0.88, pos: [0.06, 1.19, 0.62], target: [0.0, 1.175, 0.0], fov: 22 },
      { at: 1.00, pos: [0.005, 1.176, 0.16], target: [0.0, 1.176, -0.4], fov: 13 },
    ];

    this.walkKeys = [
      { at: 0.00, pos: [1.5, 0, 1.9], ry: -2.4 },
      { at: 0.26, pos: [0.72, 0, 0.72], ry: -2.0 },
      { at: 1.00, pos: [0.72, 0, 0.72], ry: -2.0 },
    ];
  }

  build() {
    const detail = this.caps.detail;
    this.add(groundPlane('#120c07', 50, 0.94));

    // ------------------------------------------------------------- machine
    const machine = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.15, 0.92), matte('#4c4237', 0.72, 0.3));
    body.position.y = 0.58;
    body.castShadow = this.caps.shadows;
    machine.add(body);

    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.09, 1.02), metal('#6e6355', 0.5));
    desk.position.y = 1.16;
    machine.add(desk);

    // Hopper of blank cards waiting to be read.
    const hopper = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.3, 0.34), metal('#7d7263', 0.45));
    hopper.rotation.x = -0.32;
    hopper.position.set(-0.62, 1.34, 0.06);
    machine.add(hopper);

    const stack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.2, 0.26), matte('#e8dcb8', 0.9));
    stack.rotation.x = -0.32;
    stack.position.set(-0.62, 1.38, 0.06);
    machine.add(stack);

    // The reader: a slot, a window, a row of panel lamps.
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.035, 0.3), matte('#0d0a07', 1));
    slot.position.set(0.42, 1.21, 0.1);
    machine.add(slot);

    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.42, 0.06), matte('#2b2620', 0.7, 0.3));
    panel.position.set(0.42, 1.02, 0.49);
    machine.add(panel);

    this.lamps = [];
    for (let i = 0; i < 7; i++) {
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.022, 12), emissive('#ffb057', 1.4));
      l.position.set(0.13 + i * 0.095, 1.02, 0.525);
      machine.add(l);
      this.lamps.push(l);
    }

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.14, 0.36), metal('#8b8172', 0.4));
    arm.position.set(0.42, 1.42, 0.1);
    machine.add(arm);
    this.punchArm = arm;

    machine.position.set(-0.1, 0, -0.35);
    this.add(machine);

    // --------------------------------------------------------- stacks of cards
    const stackGeo = new THREE.BoxGeometry(0.46, 0.006, 0.2);
    const stackMat = matte('#e6d9b2', 0.92);
    const n = this.count(90, 24);
    const cards = new THREE.InstancedMesh(stackGeo, stackMat, n);
    for (let i = 0; i < n; i++) {
      const col = Math.floor(i / 30);
      const k = i % 30;
      V.set(-1.55 + col * 0.56, 0.9 + k * 0.0075, -1.3 + (this.rand() - 0.5) * 0.05);
      E.set(0, (this.rand() - 0.5) * 0.06, 0);
      Q.setFromEuler(E);
      V2.setScalar(1);
      M4.compose(V, Q, V2);
      cards.setMatrixAt(i, M4);
    }
    cards.instanceMatrix.needsUpdate = true;

    const trolley = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 0.5), matte('#3a322a', 0.85));
    trolley.position.set(-1.28, 0.45, -1.3);
    this.add(trolley, cards);

    // ------------------------------------------------------------ hero card
    // The card the guide feeds in. It ends up filling the frame, and one of its
    // holes becomes the doorway to the next era.
    this.card = punchCard(detail);
    this.card.position.set(0, 1.176, 0);
    this.card.scale.setScalar(1.6);
    this.add(this.card);

    const holes = this.card.userData.holes;
    this.holeMesh = holes;
    this.pattern = this.card.userData.pattern;
    this.grid = this.card.userData.grid;
    this.holeCount = this.pattern.length;
    this.holeBase = [];
    for (let i = 0; i < this.holeCount; i++) {
      holes.getMatrixAt(i, M4);
      V.setFromMatrixPosition(M4);
      this.holeBase.push(V.clone());
    }

    // The hole the camera goes through: pick a punched one near the centre.
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < this.holeCount; i++) {
      if (!this.pattern[i]) continue;
      const d = Math.abs(this.holeBase[i].x) + Math.abs(this.holeBase[i].y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    this.portalIndex = best;
    const p = this.holeBase[best];
    this.portalWorld = new THREE.Vector3(p.x * 1.6, 1.176 + p.y * 1.6, 0);
    this.shotKeys[4].pos[0] = this.portalWorld.x;
    this.shotKeys[4].pos[1] = this.portalWorld.y;
    this.shotKeys[4].target[0] = this.portalWorld.x;
    this.shotKeys[4].target[1] = this.portalWorld.y;
    this.shotKeys[5].pos[0] = this.portalWorld.x;
    this.shotKeys[5].pos[1] = this.portalWorld.y;
    this.shotKeys[5].target[0] = this.portalWorld.x;
    this.shotKeys[5].target[1] = this.portalWorld.y;

    // -------------------------------------------------------- light through
    this.beams = [];
    const beamCount = this.count(14, 6);
    let made = 0;
    for (let i = 0; i < this.holeCount && made < beamCount; i += 3) {
      if (!this.pattern[i]) continue;
      const b = beam('#ffd9a0', 2.6, 0.008, 0);
      b.rotation.x = Math.PI / 2;
      b.position.set(this.holeBase[i].x * 1.6, 1.176 + this.holeBase[i].y * 1.6, 1.3);
      this.add(b);
      this.beams.push(b);
      made++;
    }

    this.backLight = this.addLight(new THREE.PointLight('#ffd9a0', 0, 6, 2));
    if (this.backLight) this.backLight.position.set(0, 1.2, -0.9);

    // Aperture ring — grows past the camera at the moment of the crossing.
    this.aperture = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 6, 40),
      new THREE.MeshBasicMaterial({ color: '#07070a', side: THREE.DoubleSide, transparent: true, opacity: 0 })
    );
    this.aperture.position.set(this.portalWorld.x, this.portalWorld.y, 0.02);
    this.add(this.aperture);

    this.portalGlow = glowSprite('#ffe3b0', 0.9, 0);
    this.portalGlow.position.copy(this.portalWorld).setZ(-0.02);
    this.add(this.portalGlow);
  }

  camera(local, out) {
    return shot(this.shotKeys, local, out);
  }

  choreograph(local, ctl) {
    ctl.costume('operator');
    const p = pathAt(this.walkKeys, local);
    ctl.place(p.x, 0, p.z, p.ry);

    if (local < 0.24) {
      ctl.auto();
      ctl.lookAt(0, 1.3, 0, 0.6);
    } else if (local < 0.42) {
      ctl.play('reach', { param: ramp(local, 0.24, 0.4), fade: 0.5 });
      ctl.lookAt(0.32, 1.2, 0.1, 0.9);
    } else if (local < 0.78) {
      ctl.play('activate', { fade: 0.5 });
      ctl.lookAt(0, 1.2, 0.0, 0.9);
    } else {
      ctl.play('observe', { fade: 0.6 });
      ctl.lookAt(0, 1.25, 0.4, 0.8);
    }
  }

  update({ local, t, rig }) {
    const feed = ramp(local, 0.3, 0.46);
    const punch = ramp(local, 0.46, 0.72);
    const through = ramp(local, 0.68, 0.92);
    const portal = ramp(local, 0.86, 1);

    // The card slides in from the guide's hand.
    this.card.position.x = lerp(0.5, 0, feed);
    this.card.position.z = lerp(0.34, 0, feed);
    this.card.rotation.z = lerp(0.22, 0, feed);
    this.card.scale.setScalar(lerp(1.05, 1.6, feed));

    // The punch head hammers while the holes appear, then lifts away.
    const hammer = punch > 0 && punch < 1 ? Math.abs(Math.sin(t * 9)) : 0;
    this.punchArm.position.y = 1.42 - hammer * 0.11 * (1 - punch * 0.5);

    // Holes are bitten in order across the card.
    for (let i = 0; i < this.holeCount; i++) {
      const on = this.pattern[i];
      const bp = this.holeBase[i];
      const order = (bp.x + this.grid.w / 2) / this.grid.w;
      const open = on ? clamp((punch - order * 0.55) * 4) : 0;
      V.copy(bp);
      E.set(0, 0, 0);
      Q.setFromEuler(E);
      V2.setScalar(Math.max(0.0001, open));
      M4.compose(V, Q, V2);
      this.holeMesh.setMatrixAt(i, M4);
    }
    this.holeMesh.instanceMatrix.needsUpdate = true;

    // Light arrives behind the card and pours through the perforations.
    for (const b of this.beams) {
      b.material.opacity = through * 0.55 * (0.75 + Math.sin(t * 3 + b.position.x * 9) * 0.25);
      b.scale.setScalar(lerp(0.6, 1.35, through));
    }
    if (this.backLight) this.backLight.intensity = through * 7;

    for (let i = 0; i < this.lamps.length; i++) {
      const on = punch > 0 ? (Math.sin(t * 6 + i * 1.3) > -0.2 ? 1 : 0.15) : 0.12;
      this.lamps[i].material.emissiveIntensity = 0.5 + on * 2.2;
    }

    // The crossing: the hole opens up and swallows the camera.
    this.portalGlow.material.opacity = through * 0.85;
    this.portalGlow.scale.setScalar(lerp(0.35, 2.2, portal));
    this.aperture.material.opacity = portal * 0.96;
    this.aperture.scale.setScalar(lerp(0.02, 1.1, portal));
    this.aperture.position.z = lerp(0.02, 0.34, portal);

    if (portal > 0.3 && rig) rig.addShake(0.012);
  }
}
