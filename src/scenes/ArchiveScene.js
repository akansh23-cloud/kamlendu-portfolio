import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { shot, pathAt } from './shot.js';
import { groundPlane, archiveBox } from './props.js';
import { matte, pointCloud, labelSprite } from '../lib/gfx.js';
import { clamp, ramp, lerp } from '../lib/math.js';
import { M4, Q, E, V, V2, COL } from '../lib/scratch.js';

const CARD_COLOR = new THREE.Color('#e9dcb6');

/**
 * SCENE 2 — PHYSICAL ARCHIVES
 *
 * The room from scene one, multiplied until it becomes a discipline. The camera
 * tracks the guide from behind down a corridor that keeps going past the edge
 * of the fog, because the point of this era is that the archive is always
 * bigger than the person walking through it.
 *
 * By the far end the spines on the shelves have stopped being books: they lie
 * flat, they are all the same size, and they have gone cream — the first
 * machine-readable card is a filing decision, not an invention.
 */
export class ArchiveScene extends SceneBase {
  static key = 'archive';

  constructor(ctx) {
    super(ctx);
    this.lighting = {
      bg: '#08070a',
      fog: '#0d0a07',
      fogDensity: 0.052,
      ambient: { color: '#3c3223', intensity: 0.6 },
      hemi: { sky: '#6a563a', ground: '#100c08', intensity: 0.55 },
      key: { color: '#ffc478', intensity: 2.1, pos: [2.4, 4.2, 2.0] },
      rim: { color: '#6c86ad', intensity: 0.75, pos: [-3.2, 3.4, -4.5] },
      fill: { color: '#33261a', intensity: 0.45, pos: [0, 2.4, 6] },
      exposure: 1.02,
    };

    this.shotKeys = [
      { at: 0.00, pos: [1.4, 1.75, 6.6], target: [0.2, 1.25, 2.8], fov: 40 },
      { at: 0.30, pos: [0.9, 1.8, 3.4], target: [0.0, 1.2, -1.2], fov: 42 },
      { at: 0.62, pos: [0.6, 1.9, -1.4], target: [0.0, 1.2, -6.0], fov: 43 },
      { at: 0.86, pos: [1.3, 1.6, -6.4], target: [-0.4, 1.15, -10.4], fov: 40 },
      { at: 1.00, pos: [1.05, 1.42, -9.4], target: [-0.5, 1.15, -12.6], fov: 34 },
    ];

    this.walkKeys = [
      { at: 0.00, pos: [0.1, 0, 3.6], ry: Math.PI },
      { at: 1.00, pos: [-0.35, 0, -12.2], ry: Math.PI },
    ];
  }

  build() {
    const detail = this.caps.detail;
    this.add(groundPlane('#15100b', 70, 0.96));

    // ---------------------------------------------------------------- bays
    this.bays = Math.max(7, Math.round(14 * this.caps.density));
    const bayGap = 2.0;
    this.bayGap = bayGap;
    this.zStart = 5;

    const frameMat = matte('#3d2e1f', 0.9);
    const uprightGeo = new THREE.BoxGeometry(0.08, 2.7, 0.08);
    const shelfGeo = new THREE.BoxGeometry(0.55, 0.035, 1.7);

    const uprights = new THREE.InstancedMesh(uprightGeo, frameMat, this.bays * 8);
    const shelves = new THREE.InstancedMesh(shelfGeo, frameMat, this.bays * 12);
    let ui = 0;
    let si = 0;

    for (let b = 0; b < this.bays; b++) {
      const z = this.zStart - b * bayGap;
      for (const side of [-1, 1]) {
        const x = side * 2.25;
        for (const dz of [-0.85, 0.85]) {
          M4.makeTranslation(x, 1.35, z + dz);
          uprights.setMatrixAt(ui++, M4);
        }
        for (let s = 0; s < 6; s++) {
          M4.makeTranslation(x, 0.28 + s * 0.44, z);
          shelves.setMatrixAt(si++, M4);
        }
      }
    }
    uprights.count = ui;
    shelves.count = si;
    uprights.instanceMatrix.needsUpdate = true;
    shelves.instanceMatrix.needsUpdate = true;
    this.add(uprights, shelves);

    // -------------------------------------------------------------- ledgers
    // Each spine is one instance. They slide into alignment as the corridor
    // organises itself, then flatten into cards at the far end.
    const perShelf = Math.max(6, Math.round(13 * detail));
    this.ledgerCount = this.bays * 2 * 5 * perShelf;
    const ledgerGeo = new THREE.BoxGeometry(0.4, 0.3, 0.055);
    this.ledgers = new THREE.InstancedMesh(ledgerGeo, matte('#8a6a45', 0.92), this.ledgerCount);
    this.ledgers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ledgerData = [];

    const palette = ['#8a6a45', '#7a5b3c', '#96784f', '#6d5236', '#a08054', '#5f4a33'];
    let li = 0;
    for (let b = 0; b < this.bays; b++) {
      const z0 = this.zStart - b * bayGap;
      for (const side of [-1, 1]) {
        for (let s = 0; s < 5; s++) {
          for (let k = 0; k < perShelf; k++) {
            const z = z0 - 0.78 + (k / (perShelf - 1)) * 1.56;
            this.ledgerData.push({
              x: side * 2.25,
              y: 0.46 + s * 0.44,
              z,
              side,
              // Pre-organised chaos: a random lean and offset that resolves.
              lean: (this.rand() - 0.5) * 0.34,
              off: (this.rand() - 0.5) * 0.16,
              h: 0.82 + this.rand() * 0.36,
              color: palette[Math.floor(this.rand() * palette.length)],
              zWorld: z,
            });
            COL.set(this.ledgerData[li].color);
            this.ledgers.setColorAt(li, COL);
            li++;
          }
        }
      }
    }
    this.ledgerCount = li;
    this.ledgers.count = li;
    if (this.ledgers.instanceColor) this.ledgers.instanceColor.needsUpdate = true;
    this.add(this.ledgers);

    // --------------------------------------------------------------- boxes
    for (let b = 0; b < this.bays; b += 2) {
      const z = this.zStart - b * bayGap;
      for (const side of [-1, 1]) {
        const box = archiveBox(0.46, 0.3, 0.36);
        box.position.set(side * 2.25, 2.62, z + (this.rand() - 0.5) * 0.6);
        box.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        this.add(box);
      }
    }

    // -------------------------------------------------------------- labels
    // Metadata surfaces quietly as you pass — it does not shout.
    this.labels = [];
    const tags = ['LEDGER 1/48', 'INDEX A–F', 'RECORD SET 12', 'DRAWER 07', 'CATALOGUE'];
    for (let i = 0; i < Math.min(5, this.bays); i++) {
      const z = this.zStart - (i * 2 + 1) * bayGap;
      const sprite = labelSprite(tags[i % tags.length], '#e8d3a8', 0.44);
      sprite.position.set(i % 2 ? 1.72 : -1.72, 1.72, z);
      sprite.material.opacity = 0;
      this.labels.push({ sprite, z });
      this.add(sprite);
    }

    // ---------------------------------------------------------------- dust
    const n = this.count(220, 60);
    const pts = [];
    for (let i = 0; i < n; i++) {
      pts.push((this.rand() - 0.5) * 5, this.rand() * 3, this.zStart - this.rand() * this.bays * bayGap);
    }
    this.dust = pointCloud(pts, { color: '#ffcf95', size: 0.016, opacity: 0.38 });
    this.add(this.dust);

    // Warm pools of light down the corridor.
    const lamp = this.addLight(new THREE.PointLight('#ffc27a', 6, 9, 2));
    if (lamp) lamp.position.set(0, 2.5, 0);
    this.lamp = lamp;
  }

  camera(local, out) {
    return shot(this.shotKeys, local, out);
  }

  choreograph(local, ctl) {
    ctl.costume(local > 0.12 ? 'archivist' : 'scribe');
    const p = pathAt(this.walkKeys, local);
    ctl.place(p.x, 0, p.z, p.ry);
    ctl.auto();
    // Glances at the shelves as they pass, then forward again near the cards.
    const side = Math.sin(local * 9) * 2.2;
    ctl.lookAt(side, 1.7, p.z - 3, local > 0.85 ? 0.2 : 0.45);
  }

  update({ local, t }) {
    // The lamp travels with the guide so there is always a pool of light ahead.
    const walkZ = lerp(3.6, -12.2, local);
    if (this.lamp) this.lamp.position.z = walkZ - 1.2;

    const organise = ramp(local, 0.18, 0.66);
    const cardify = ramp(local, 0.62, 0.98);

    for (let i = 0; i < this.ledgerCount; i++) {
      const d = this.ledgerData[i];

      // Records ahead of the guide standardise first — order arrives from the
      // direction they are walking, which makes the corridor feel authored.
      const ahead = clamp((walkZ - d.zWorld) / 6 + 0.5);
      const org = clamp(organise * 1.4 - ahead * 0.3);
      const card = clamp(cardify * 1.6 - (1 - ahead) * 0.9);

      const lean = d.lean * (1 - org);
      const off = d.off * (1 - org);
      const h = lerp(d.h, 1, org);

      V.set(d.x + off * d.side, d.y + (h - 1) * 0.15, d.z);
      // Flatten and turn cream: the spine becomes a card lying on the shelf.
      E.set(0, 0, lean + card * (d.side > 0 ? -Math.PI / 2 : Math.PI / 2));
      Q.setFromEuler(E);
      V2.set(lerp(1, 1.15, card), lerp(h, 0.16, card), lerp(1, 1.7, card));
      M4.compose(V, Q, V2);
      this.ledgers.setMatrixAt(i, M4);

      if (card > 0.01) {
        COL.set(d.color);
        COL.lerp(CARD_COLOR, card);
        this.ledgers.setColorAt(i, COL);
      }
    }
    this.ledgers.instanceMatrix.needsUpdate = true;
    if (cardify > 0.01 && this.ledgers.instanceColor) this.ledgers.instanceColor.needsUpdate = true;

    for (const l of this.labels) {
      const near = 1 - clamp(Math.abs(l.z - walkZ) / 3.4);
      l.sprite.material.opacity = near * 0.8;
    }

    if (this.dust) this.dust.rotation.y = t * 0.008;
  }
}
