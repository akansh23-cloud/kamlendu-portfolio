import * as THREE from 'three';
import { matte, metal, emissive, paperTexture, brushedTexture, scanlineTexture, glowSprite } from '../lib/gfx.js';

/**
 * props.js — the object vocabulary of the whole journey.
 *
 * Every era's hero object is built here once and reused: the archive shelf that
 * fills the corridor in chapter two is the same builder that supplies the tiny
 * orbiting ledger in the finale, so the closing sequence is literally made of
 * the objects the visitor already walked past. Consistency of visual language
 * matters more than photorealism (section 28).
 */

const D = (n, detail) => Math.max(4, Math.round(n * detail));

/* ------------------------------------------------------------------ paper */

export function sheet(w = 0.44, h = 0.6) {
  const g = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({
      map: paperTexture(),
      color: '#fbf6e8',
      roughness: 0.94,
      metalness: 0,
      side: THREE.DoubleSide,
    })
  );
  g.receiveShadow = true;
  return g;
}

export function ledger(w = 0.06, h = 0.3, d = 0.24, color = '#8a6a45') {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matte(color, 0.9));
  const spine = new THREE.Mesh(new THREE.BoxGeometry(w * 1.06, h * 0.16, d * 1.02), matte('#d8c9a4', 0.85));
  spine.position.y = h * 0.28;
  m.add(spine);
  return m;
}

export function archiveBox(w = 0.5, h = 0.32, d = 0.38) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matte('#8d7350', 0.95));
  const label = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.5, h * 0.34), matte('#e8dcc0', 0.9));
  label.position.set(0, 0, d / 2 + 0.002);
  grp.add(body, label);
  return grp;
}

/* ------------------------------------------------------------- punch card */

export function punchCard(detail = 1, { color = '#f0e6c8', holeColor = '#100c07' } = {}) {
  const grp = new THREE.Group();
  const w = 0.46;
  const h = 0.2;
  const card = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, 0.004),
    matte(color, 0.92)
  );
  grp.add(card);

  // A clipped corner is the single most recognisable thing about a punch card.
  const corner = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.008), matte('#0b0e13', 1));
  corner.position.set(-w / 2 + 0.012, h / 2 - 0.012, 0);
  corner.rotation.z = Math.PI / 4;
  grp.add(corner);

  const cols = D(20, detail);
  const rows = 6;
  const holeGeo = new THREE.PlaneGeometry(0.011, 0.016);
  const holeMat = matte(holeColor, 1);
  const holes = new THREE.InstancedMesh(holeGeo, holeMat, cols * rows);
  const m = new THREE.Matrix4();
  const pattern = [];
  let i = 0;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const on = (c * 7 + r * 13) % 5 < 2;
      pattern.push(on);
      m.makeTranslation(
        -w / 2 + 0.03 + (c / (cols - 1)) * (w - 0.06),
        h / 2 - 0.036 - (r / (rows - 1)) * (h - 0.07),
        0.0035
      );
      if (!on) m.scale(new THREE.Vector3(0.001, 0.001, 0.001));
      holes.setMatrixAt(i++, m);
    }
  }
  holes.instanceMatrix.needsUpdate = true;
  grp.add(holes);
  grp.userData.holes = holes;
  grp.userData.pattern = pattern;
  grp.userData.grid = { cols, rows, w, h };
  return grp;
}

/* ------------------------------------------------------------- tape reel */

export function tapeReel(radius = 1.15, detail = 1, color = '#c8763f') {
  const grp = new THREE.Group();
  const seg = D(38, detail);

  const flangeGeo = new THREE.TorusGeometry(radius, 0.035, D(8, detail), seg);
  const flangeMat = metal('#6d6a66', 0.42);
  for (const z of [-0.07, 0.07]) {
    const f = new THREE.Mesh(flangeGeo, flangeMat);
    f.position.z = z;
    grp.add(f);
  }

  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.97, radius * 0.97, 0.012, seg),
    new THREE.MeshStandardMaterial({ color: '#3a3532', roughness: 0.5, metalness: 0.35, transparent: true, opacity: 0.34 })
  );
  disc.rotation.x = Math.PI / 2;
  for (const z of [-0.068, 0.068]) {
    const d = disc.clone();
    d.position.z = z;
    grp.add(d);
  }

  // Wound tape: a dark cylinder with a warm edge, which is what actually reads
  // as "this reel is full" from ten metres away.
  const wound = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.74, radius * 0.74, 0.13, seg),
    new THREE.MeshStandardMaterial({ color: '#241a15', roughness: 0.85, metalness: 0.1 })
  );
  wound.rotation.x = Math.PI / 2;
  grp.add(wound);
  grp.userData.wound = wound;

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.2, radius * 0.2, 0.18, D(20, detail)), metal('#8a8378', 0.35));
  hub.rotation.x = Math.PI / 2;
  grp.add(hub);

  const spokeGeo = new THREE.BoxGeometry(radius * 1.05, 0.05, 0.03);
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(spokeGeo, metal('#9a9186', 0.4));
    s.rotation.z = (i / 3) * Math.PI * 2;
    grp.add(s);
  }

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.74, 0.012, 5, seg),
    emissive(color, 1.1)
  );
  grp.add(rim);
  grp.userData.rim = rim;
  return grp;
}

/* ----------------------------------------------------------- floppy disk */

export function floppy(size = 0.42, color = '#1f2b33') {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(size, size, 0.014), matte(color, 0.72, 0.08));
  grp.add(body);

  const shutter = new THREE.Mesh(new THREE.BoxGeometry(size * 0.42, size * 0.2, 0.018), metal('#b9c2c6', 0.3));
  shutter.position.set(size * 0.04, size * 0.4, 0);
  grp.add(shutter);
  grp.userData.shutter = shutter;

  const label = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.74, size * 0.34), matte('#dfe6df', 0.9));
  label.position.set(0, -size * 0.16, 0.0085);
  grp.add(label);

  const hub = new THREE.Mesh(new THREE.CircleGeometry(size * 0.13, 20), metal('#8e979b', 0.35));
  hub.position.set(0, size * 0.08, -0.0085);
  hub.rotation.y = Math.PI;
  grp.add(hub);

  // The magnetic disk inside — revealed during the transition to the platter.
  const inner = new THREE.Mesh(
    new THREE.CircleGeometry(size * 0.36, 32),
    new THREE.MeshStandardMaterial({ color: '#16110d', roughness: 0.42, metalness: 0.5 })
  );
  inner.position.z = 0.0086;
  inner.visible = false;
  grp.add(inner);
  grp.userData.inner = inner;
  return grp;
}

/* ------------------------------------------------------------ hdd platter */

export function platter(radius = 1, detail = 1) {
  const grp = new THREE.Group();
  const seg = D(64, detail);
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 0.014, seg),
    new THREE.MeshStandardMaterial({
      map: brushedTexture(),
      color: '#c8ced3',
      roughness: 0.17,
      metalness: 0.96,
    })
  );
  grp.add(disc);

  const hole = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, 0.02, D(28, detail)),
    matte('#05080c', 1)
  );
  grp.add(hole);

  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.1, radius * 0.1, 0.1, D(20, detail)), metal('#7f878c', 0.28));
  spindle.position.y = 0.05;
  grp.add(spindle);

  const arm = new THREE.Group();
  const armMesh = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.9, 0.018, 0.06), metal('#9aa2a8', 0.3));
  armMesh.position.x = radius * 0.45;
  const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 14), metal('#6f767b', 0.4));
  arm.add(armMesh, pivot);
  arm.position.set(radius * 0.95, 0.05, radius * 0.55);
  grp.add(arm);
  grp.userData.arm = arm;
  grp.userData.disc = disc;
  return grp;
}

/* ----------------------------------------------------------- server rack */

export function serverRack(detail = 1, { h = 2.1, w = 0.62, d = 0.9, ledColor = '#7ee6c0' } = {}) {
  const grp = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matte('#141a20', 0.78, 0.25));
  frame.position.y = h / 2;
  grp.add(frame);

  const units = Math.max(6, Math.round(14 * detail));
  const faceGeo = new THREE.BoxGeometry(w * 0.94, (h / units) * 0.78, 0.02);
  const faceMat = matte('#1e262e', 0.62, 0.35);
  const ledGeo = new THREE.PlaneGeometry(0.016, 0.016);
  const ledMat = emissive(ledColor, 2.2);
  const leds = new THREE.InstancedMesh(ledGeo, ledMat, units * 3);
  const m = new THREE.Matrix4();
  let i = 0;

  for (let u = 0; u < units; u++) {
    const y = (u + 0.5) * (h / units);
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.set(0, y, d / 2 + 0.002);
    grp.add(face);
    for (let k = 0; k < 3; k++) {
      m.makeTranslation(-w * 0.36 + k * 0.036, y, d / 2 + 0.016);
      leds.setMatrixAt(i++, m);
    }
  }
  leds.count = i;
  leds.instanceMatrix.needsUpdate = true;
  grp.add(leds);
  grp.userData.leds = leds;
  grp.userData.height = h;
  return grp;
}

/* ------------------------------------------------------------- data node */

export function nodeCube(size = 0.34, color = '#e3a152') {
  const grp = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshStandardMaterial({ color: '#0e1319', roughness: 0.55, metalness: 0.4 })
  );
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(size, size, size)),
    new THREE.LineBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.85 })
  );
  const core = new THREE.Mesh(new THREE.BoxGeometry(size * 0.42, size * 0.42, size * 0.42), emissive(color, 1.4));
  grp.add(box, edges, core);
  grp.userData.core = core;
  grp.userData.edges = edges;
  return grp;
}

/* ---------------------------------------------------------- cloud object */

export function cloudShard(size = 0.5, color = '#62d8ff') {
  const grp = new THREE.Group();
  const geo = new THREE.BoxGeometry(size, size * 0.62, size * 0.62);
  const shell = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: '#0d2027',
      roughness: 0.28,
      metalness: 0.2,
      transparent: true,
      opacity: 0.5,
    })
  );
  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.7 })
  );
  grp.add(shell, wire);
  return grp;
}

/* ------------------------------------------------------- iceberg crystal */

export function crystal(size = 1, detail = 1, color = '#a18aff') {
  const grp = new THREE.Group();
  const geo = new THREE.OctahedronGeometry(size, detail > 0.8 ? 1 : 0);
  const body = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: '#20183a',
      roughness: 0.12,
      metalness: 0.25,
      transparent: true,
      opacity: 0.42,
      flatShading: true,
    })
  );
  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.75 })
  );
  grp.add(body, wire);
  grp.userData.body = body;
  return grp;
}

/* -------------------------------------------------------------- packet */

export function packet(size = 0.1, color = '#ff914d') {
  const m = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.5, size * 2.2), emissive(color, 2));
  return m;
}

/* --------------------------------------------------------------- screen */

export function crtScreen(w = 0.62, h = 0.48) {
  const grp = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.BoxGeometry(w * 1.22, h * 1.28, 0.46), matte('#c9c3ab', 0.86));
  grp.add(shell);
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({
      map: scanlineTexture(),
      color: '#0a1f16',
      emissive: new THREE.Color('#3ef2a4'),
      emissiveIntensity: 0.55,
      roughness: 0.3,
    })
  );
  glass.position.z = 0.235;
  grp.add(glass);
  grp.userData.glass = glass;
  return grp;
}

/* --------------------------------------------------------- light helpers */

export function beam(color, length = 3, radius = 0.012, opacity = 0.5) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 2.4, length, 6, 1, true),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  return m;
}

export function halo(color, radius = 1, opacity = 0.4) {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.94, radius, 48),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  return m;
}

export function groundPlane(color = '#0a0d12', size = 60, roughness = 0.95) {
  const g = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size, 1, 1),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness, metalness: 0.05 })
  );
  g.rotation.x = -Math.PI / 2;
  g.receiveShadow = true;
  return g;
}

export { glowSprite };
