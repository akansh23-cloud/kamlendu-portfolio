import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { shot, pathAt } from './shot.js';
import {
  sheet, ledger, punchCard, tapeReel, floppy, platter,
  serverRack, nodeCube, cloudShard, crystal, packet, halo, glowSprite,
} from './props.js';
import { matte, emissive, labelSprite, pointCloud } from '../lib/gfx.js';
import { profile, projects, chapters } from '../data/portfolio.js';
import { clamp, ramp, lerp, TAU, rng } from '../lib/math.js';
import { M4, Q, E, V, V2 } from '../lib/scratch.js';

/**
 * SCENE 13 — PRESENT DAY
 *
 * This one scene carries the last three chapters, and the timeline hands it a
 * single continuous local progress from 0 to 1 across all of them. That is
 * deliberate: the ending should not feel like three more sections, it should
 * feel like one long exhale after twelve eras.
 *
 *   0.00 – 0.34  ORBIT        every artefact from the journey circles overhead
 *   0.34 – 0.42  DISSOLVE     they break into the particles they were made of
 *   0.42 – 0.72  CONSTELLATION the particles resolve into skills, then portals
 *   0.72 – 1.00  HORIZON      the guide walks away from the camera, forward
 *
 * The artefacts are the *same prop functions* the era scenes used, not
 * lookalikes. What orbits the guide at the end is literally the objects the
 * visitor already walked past.
 */
export class ProfileScene extends SceneBase {
  static key = 'profile';

  constructor(ctx) {
    super(ctx);
    this.lighting = {
      bg: '#050810',
      fog: '#070c16',
      fogDensity: 0.021,
      ambient: { color: '#4b5364', intensity: 0.75 },
      hemi: { sky: '#98a8bd', ground: '#0c0f14', intensity: 0.7 },
      key: { color: '#f0f4d8', intensity: 2.0, pos: [3, 6, 5] },
      rim: { color: '#cfe86a', intensity: 1.6, pos: [-5, 3.5, -4] },
      fill: { color: '#2a3140', intensity: 0.55, pos: [0, 2, 7] },
      exposure: 1.04,
    };

    this.shotKeys = [
      { at: 0.00, pos: [0.0, 2.2, 7.4], target: [0.0, 2.2, 0.0], fov: 50 },
      { at: 0.18, pos: [3.4, 3.4, 6.2], target: [0.0, 2.6, 0.0], fov: 54 },
      { at: 0.36, pos: [0.4, 2.0, 5.4], target: [0.0, 2.0, 0.0], fov: 50 },
      { at: 0.54, pos: [-2.6, 2.6, 5.8], target: [0.4, 2.4, -0.6], fov: 52 },
      { at: 0.72, pos: [0.0, 2.4, 6.4], target: [0.0, 2.0, -1.6], fov: 48 },
      { at: 0.88, pos: [0.0, 2.0, 5.6], target: [0.0, 1.7, -6.0], fov: 44 },
      { at: 1.00, pos: [0.0, 1.9, 5.0], target: [0.0, 1.9, -14.0], fov: 40 },
    ];

    this.walkKeys = [
      { at: 0.00, pos: [0, 0, 0.6], ry: 0 },
      { at: 0.34, pos: [0, 0, 0.6], ry: 0 },
      { at: 0.46, pos: [-0.8, 0, 0.2], ry: 0.5 },
      { at: 0.62, pos: [0.9, 0, 0.0], ry: -0.5 },
      { at: 0.74, pos: [0, 0, -0.4], ry: Math.PI },
      { at: 1.00, pos: [0, 0, -9.5], ry: Math.PI },
    ];

    this.highlight = null;
    this._highlightMix = 0;
    this.completion = 0;
    this._lit = 0;
  }

  build() {
    const d = this.caps.detail;

    // ------------------------------------------------------------- the ground
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: '#070a11', roughness: 0.3, metalness: 0.6 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.add(floor);

    const pad = halo('#cfe86a', 2.4, 0.35);
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.012;
    this.add(pad);
    this.pad = pad;

    // ==================================================== ACT A — THE ORBIT
    // One artefact per era, in the order they were encountered, built from the
    // exact prop functions those scenes used.
    const makers = [
      { key: 'writtenMemory', make: () => sheet(0.44, 0.6), scale: 1.1, color: '#d8b06a' },
      { key: 'archive', make: () => ledger(0.1, 0.42, 0.32, '#8a6a45'), scale: 1.2, color: '#c9a26a' },
      { key: 'punchCard', make: () => punchCard(d), scale: 1.0, color: '#c9794b' },
      { key: 'tape', make: () => tapeReel(0.42, d, '#c8763f'), scale: 1.0, color: '#b96a3c' },
      { key: 'digitalMedia', make: () => floppy(0.42, '#1f2b33'), scale: 1.05, color: '#6ee6a8' },
      { key: 'enterprise', make: () => platter(0.42, d), scale: 1.0, color: '#7ea7bd' },
      { key: 'enterprise2', make: () => serverRack(d, { h: 0.9, w: 0.28, d: 0.4 }), scale: 1.0, color: '#7ea7bd' },
      { key: 'hadoop', make: () => nodeCube(0.34, '#e3a152'), scale: 1.1, color: '#e3a152' },
      { key: 'cloud', make: () => cloudShard(0.46, '#62d8ff'), scale: 1.1, color: '#62d8ff' },
      { key: 'lakehouse', make: () => crystal(0.42, d, '#a18aff'), scale: 1.0, color: '#a18aff' },
      { key: 'streaming', make: () => packet(0.22, '#ff914d'), scale: 1.4, color: '#ff914d' },
      { key: 'governance', make: () => this._token(), scale: 1.0, color: '#6fd8c8' },
    ];

    this.orbit = new THREE.Group();
    this.orbit.position.y = 2.4;
    this.add(this.orbit);

    this.artefacts = [];
    for (let i = 0; i < makers.length; i++) {
      const m = makers[i];
      const holder = new THREE.Group();
      const obj = m.make();
      obj.scale.setScalar(m.scale);
      holder.add(obj);

      const a = (i / makers.length) * TAU;
      const r = 3.5 + (i % 3) * 0.42;
      const y = Math.sin(i * 1.9) * 0.85;
      holder.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      holder.userData = { a, r, y, spin: (this.rand() - 0.5) * 0.9, tilt: this.rand() * TAU };

      const aura = glowSprite(m.color, 1.5, 0.22);
      holder.add(aura);

      this.orbit.add(holder);
      this.artefacts.push({ holder, aura, color: new THREE.Color(m.color) });
    }

    // ================================================ ACT B — CONSTELLATION
    // Skills are placed on a shell around the guide. Named exactly from the
    // source list — nothing added, nothing rated, no invented proficiency.
    const skills = profile.skills;
    this.nodes = [];
    const srand = rng(4177);
    for (let i = 0; i < skills.length; i++) {
      // Fibonacci-ish placement keeps them evenly spread without clumping,
      // then a little jitter stops it looking like a lab diagram.
      const k = (i + 0.5) / skills.length;
      const phi = Math.acos(1 - 2 * k * 0.78);
      const theta = TAU * 1.618 * i;
      const r = 3.0 + srand() * 1.5;
      const p = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * r,
        1.5 + Math.cos(phi) * 2.3 + srand() * 0.4,
        Math.sin(phi) * Math.sin(theta) * r * 0.7 - 0.6
      );
      this.nodes.push({ p, phase: srand() * TAU, name: skills[i] });
    }

    this.nodeMesh = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.075, 0),
      emissive('#e6f57a', 1.7, { transparent: true, opacity: 0.95 }),
      this.nodes.length
    );
    this.add(this.nodeMesh);

    // Edges: nearest neighbours only, so the shape reads as a constellation
    // rather than a hairball.
    const edgePts = [];
    for (let i = 0; i < this.nodes.length; i++) {
      const dists = [];
      for (let j = 0; j < this.nodes.length; j++) {
        if (i === j) continue;
        dists.push({ j, dd: this.nodes[i].p.distanceToSquared(this.nodes[j].p) });
      }
      dists.sort((a, b) => a.dd - b.dd);
      for (let n = 0; n < 2; n++) {
        const j = dists[n]?.j;
        if (j === undefined || j < i) continue;
        edgePts.push(
          this.nodes[i].p.x, this.nodes[i].p.y, this.nodes[i].p.z,
          this.nodes[j].p.x, this.nodes[j].p.y, this.nodes[j].p.z
        );
      }
    }
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.Float32BufferAttribute(edgePts, 3));
    this.edges = new THREE.LineSegments(
      eg,
      new THREE.LineBasicMaterial({ color: '#cfe86a', transparent: true, opacity: 0 })
    );
    this.add(this.edges);

    // Labels are expensive; on low tiers only the anchors of the constellation
    // get one, and the accessible list in the DOM carries the rest.
    this.skillLabels = [];
    const labelEvery = this.caps.tier === 'high' ? 1 : this.caps.tier === 'mid' ? 2 : 3;
    for (let i = 0; i < this.nodes.length; i += labelEvery) {
      const s = labelSprite(this.nodes[i].name, '#dfe9a8', 0.42);
      s.position.copy(this.nodes[i].p).add(new THREE.Vector3(0, 0.22, 0));
      s.material.opacity = 0;
      this.add(s);
      this.skillLabels.push(s);
    }

    // ------------------------------------------------------- the dissolve
    // The particle bridge between the orbit and the constellation. Each mote
    // starts on an artefact and ends on a skill node, so the transformation is
    // literally "the history becomes the toolkit".
    this.moteCount = this.count(320, 110);
    this.motePos = new Float32Array(this.moteCount * 3);
    this.moteFrom = [];
    this.moteTo = [];
    for (let i = 0; i < this.moteCount; i++) {
      const src = this.artefacts[i % this.artefacts.length].holder.position;
      this.moteFrom.push(new THREE.Vector3(
        src.x + (this.rand() - 0.5) * 0.7,
        src.y + 2.4 + (this.rand() - 0.5) * 0.7,
        src.z + (this.rand() - 0.5) * 0.7
      ));
      const dst = this.nodes[i % this.nodes.length].p;
      this.moteTo.push(new THREE.Vector3(
        dst.x + (this.rand() - 0.5) * 0.55,
        dst.y + (this.rand() - 0.5) * 0.55,
        dst.z + (this.rand() - 0.5) * 0.55
      ));
    }
    this.motes = pointCloud(this.motePos, { color: '#e6f57a', size: 0.045, opacity: 0 });
    this.add(this.motes);

    // ------------------------------------------------------- work portals
    // One frame per project, tinted with the colour of the era it belongs to,
    // arranged as an arc the guide can walk along.
    this.portals = [];
    const eraColor = (sceneKey) =>
      chapters.find((c) => c.scene === sceneKey)?.color || '#cfe86a';

    for (let i = 0; i < projects.length; i++) {
      const pr = projects[i];
      const col = eraColor(pr.scene);
      const g = new THREE.Group();
      const a = (-0.62 + (i / (projects.length - 1)) * 1.24);
      const r = 4.6;
      g.position.set(Math.sin(a) * r, 0, -Math.cos(a) * r);
      g.rotation.y = a + Math.PI;

      const frameMat = matte('#0d1219', 0.5, 0.5);
      const post = new THREE.BoxGeometry(0.05, 2.0, 0.05);
      const l = new THREE.Mesh(post, frameMat);
      l.position.set(-0.62, 1.0, 0);
      const rr = new THREE.Mesh(post, frameMat);
      rr.position.set(0.62, 1.0, 0);
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.29, 0.05, 0.05), frameMat);
      top.position.set(0, 2.0, 0);
      g.add(l, rr, top);

      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 1.9),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(col),
          transparent: true,
          opacity: 0.07,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      glass.position.y = 1.0;
      g.add(glass);

      const base = halo(col, 0.72, 0.4);
      base.rotation.x = -Math.PI / 2;
      base.position.y = 0.014;
      g.add(base);

      const lbl = labelSprite(pr.name, col, 0.52);
      lbl.position.set(0, 2.28, 0);
      lbl.material.opacity = 0;
      g.add(lbl);

      const bulb = glowSprite(col, 1.5, 0.25);
      bulb.position.y = 1.0;
      g.add(bulb);

      g.visible = false;
      this.add(g);
      this.portals.push({ id: pr.id, group: g, glass, base, lbl, bulb, color: new THREE.Color(col), heat: 0 });
    }

    // ================================================== ACT C — THE HORIZON
    // Not a backdrop: a road with a light at the end of it that the guide
    // actually walks down. The last shot of the site is a person leaving.
    this.horizon = new THREE.Group();
    this.horizon.visible = false;
    this.add(this.horizon);

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 70, 1, 1),
      new THREE.MeshStandardMaterial({
        color: '#0a0f18',
        roughness: 0.22,
        metalness: 0.7,
        transparent: true,
        opacity: 0.9,
      })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.008, -32);
    this.horizon.add(road);

    // Rails receding into distance, spaced to give parallax as the guide walks.
    this.markCount = this.count(26, 10);
    this.marks = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.06, 0.02, 0.9),
      emissive('#cfe86a', 1.2, { transparent: true, opacity: 0.6 }),
      this.markCount * 2
    );
    for (let i = 0; i < this.markCount; i++) {
      for (let s = 0; s < 2; s++) {
        V.set(s ? 2.0 : -2.0, 0.02, -2 - i * 2.4);
        E.set(0, 0, 0);
        Q.setFromEuler(E);
        V2.setScalar(1);
        M4.compose(V, Q, V2);
        this.marks.setMatrixAt(i * 2 + s, M4);
      }
    }
    this.marks.instanceMatrix.needsUpdate = true;
    this.horizon.add(this.marks);

    const band = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 9),
      new THREE.MeshBasicMaterial({
        color: '#cfe86a',
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    band.position.set(0, 2.2, -46);
    this.horizon.add(band);
    this.band = band;

    const sun = glowSprite('#eaf7c8', 16, 0.28);
    sun.position.set(0, 1.6, -44);
    this.horizon.add(sun);
    this.sun = sun;

    // -------------------------------------------------------------- signage
    this.nameLabel = labelSprite(profile.name, '#f2f7dd', 0.95);
    this.nameLabel.position.set(0, 3.4, -1.2);
    this.nameLabel.material.opacity = 0;
    this.add(this.nameLabel);

    this.roleLabel = labelSprite(`${profile.role} · ${profile.employer}`, '#cfe86a', 0.55);
    this.roleLabel.position.set(0, 2.95, -1.2);
    this.roleLabel.material.opacity = 0;
    this.add(this.roleLabel);
  }

  /** A stand-in for the governed record — the last artefact in the orbit. */
  _token() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.21, 0.02),
      matte('#0b2422', 0.4, 0.3)
    );
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.35, 0.22, 0.03)),
      new THREE.LineBasicMaterial({ color: '#6fd8c8', transparent: true, opacity: 0.85 })
    );
    for (let i = 0; i < 5; i++) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.11, 0.005),
        emissive('#6fd8c8', 1.4)
      );
      bar.position.set(-0.1 + i * 0.05, 0, 0.014);
      g.add(bar);
    }
    g.add(body, wire);
    return g;
  }

  // ---------------------------------------------------------------- external

  /** The UI calls this on hover / open so the 3D and the DOM stay in sync. */
  setHighlight(id) {
    this.highlight = id;
  }

  /**
   * How much of the operator record has been filled in, 0…1.
   *
   * The finale's constellation is dim by default and brightens with it. A
   * visitor who played nothing still gets the full ending — the skills are all
   * there, they are just quieter — and a visitor who worked through the six
   * exercises arrives at a constellation that is genuinely lit. It is the only
   * place in the site where the games leave a mark on the world itself.
   */
  setCompletion(v) {
    this.completion = this.clampUnit(v);
  }

  clampUnit(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  camera(local, out) {
    return shot(this.shotKeys, local, out);
  }

  choreograph(local, ctl) {
    ctl.costume('kamlendu');
    const p = pathAt(this.walkKeys, local);
    ctl.place(p.x, 0, p.z, p.ry);

    if (local < 0.3) {
      // Watching the whole journey circle overhead.
      ctl.play('lookUp', { param: ramp(local, 0.02, 0.22), fade: 0.7 });
      const a = local * 6;
      ctl.lookAt(Math.cos(a) * 3.5, 4.6, Math.sin(a) * 3.5, 0.9);
    } else if (local < 0.44) {
      ctl.play('observe', { param: 0.7, fade: 0.6 });
      ctl.lookAt(0, 3.4, 0, 0.8);
    } else if (local < 0.72) {
      ctl.auto();
      const near = this._nearestPortal(p.x, p.z);
      if (near) ctl.lookAt(near.group.position.x, 1.3, near.group.position.z, 0.75);
    } else {
      ctl.auto();
      ctl.lookAt(0, 1.9, -30, 0.35);
    }
  }

  _nearestPortal(x, z) {
    let best = null;
    let bd = Infinity;
    for (const p of this.portals) {
      const dd = (p.group.position.x - x) ** 2 + (p.group.position.z - z) ** 2;
      if (dd < bd) { bd = dd; best = p; }
    }
    return best;
  }

  update({ local, t, dt }) {
    const orbitIn = ramp(local, 0.0, 0.12);
    const dissolve = ramp(local, 0.30, 0.44);
    const constellation = ramp(local, 0.40, 0.62);
    const portalsIn = ramp(local, 0.52, 0.70);
    const depart = ramp(local, 0.70, 0.88);
    const gone = ramp(local, 0.80, 1.0);

    // ---------------------------------------------------------- ACT A: orbit
    this.orbit.rotation.y = t * 0.075;
    this.orbit.visible = dissolve < 0.995;
    for (let i = 0; i < this.artefacts.length; i++) {
      const a = this.artefacts[i];
      const h = a.holder;
      const u = h.userData;
      h.rotation.y = t * u.spin;
      h.rotation.x = Math.sin(t * 0.3 + u.tilt) * 0.25;
      h.position.y = u.y + Math.sin(t * 0.5 + i) * 0.14;
      // Each artefact leaves on its own beat, oldest first.
      const mine = clamp((dissolve - (i / this.artefacts.length) * 0.5) / 0.5);
      const s = orbitIn * (1 - mine);
      h.scale.setScalar(Math.max(0.0001, s));
      h.visible = s > 0.004;
      a.aura.material.opacity = 0.16 * s;
    }

    // ------------------------------------------------------- the dissolve
    if (dissolve > 0.001 && constellation < 0.999) {
      const arr = this.motePos;
      const spin = t * 0.075;
      const cos = Math.cos(spin);
      const sin = Math.sin(spin);
      for (let i = 0; i < this.moteCount; i++) {
        const f = this.moteFrom[i];
        const to = this.moteTo[i];
        // Motes are born in the orbit's rotating frame, so they detach from
        // where the artefact actually is rather than from where it started.
        const fx = f.x * cos - f.z * sin;
        const fz = f.x * sin + f.z * cos;
        const k = clamp((dissolve * 1.15 - (i % 7) * 0.02));
        const e = k * k * (3 - 2 * k);
        const x = lerp(fx, to.x, e);
        const y = lerp(f.y, to.y, e) + Math.sin(k * Math.PI) * 0.6;
        const z = lerp(fz, to.z, e);
        arr[i * 3] = x;
        arr[i * 3 + 1] = y;
        arr[i * 3 + 2] = z;
      }
      this.motes.geometry.attributes.position.needsUpdate = true;
      this.motes.visible = true;
      this.motes.material.opacity = Math.sin(clamp(dissolve * 1.1) * Math.PI) * 0.85;
    } else {
      this.motes.visible = false;
    }

    // -------------------------------------------------- ACT B: constellation
    const cVis = constellation * (1 - gone * 0.55);
    this.nodeMesh.visible = cVis > 0.01;
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const settle = clamp((constellation - (i / this.nodes.length) * 0.35) / 0.65);
      const pulse = 1 + Math.sin(t * 1.8 + n.phase) * 0.18;
      V.copy(n.p);
      V.y += Math.sin(t * 0.6 + n.phase) * 0.05;
      E.set(t * 0.4 + n.phase, t * 0.3, 0);
      Q.setFromEuler(E);
      V2.setScalar(Math.max(0.0001, settle * pulse * cVis));
      M4.compose(V, Q, V2);
      this.nodeMesh.setMatrixAt(i, M4);
    }
    this.nodeMesh.instanceMatrix.needsUpdate = true;

    // Earned brightness. Eased so that finishing an exercise and scrolling
    // back to the ending shows the constellation coming up rather than a
    // value that was simply different the whole time.
    this._lit += (this.completion - this._lit) * Math.min(1, dt * 1.6);
    const lit = 0.55 + this._lit * 0.45;

    this.nodeMesh.material.opacity = cVis * 0.95 * lit;
    this.edges.material.opacity = cVis * (0.12 + this._lit * 0.26);
    for (const s of this.skillLabels) s.material.opacity = cVis * (0.4 + this._lit * 0.4);

    this.nameLabel.material.opacity = ramp(local, 0.12, 0.3) * (1 - ramp(local, 0.46, 0.6)) * 0.95;
    this.roleLabel.material.opacity = this.nameLabel.material.opacity * 0.8;

    // -------------------------------------------------------- work portals
    this._highlightMix += ((this.highlight ? 1 : 0) - this._highlightMix) * Math.min(1, dt * 6);
    for (const p of this.portals) {
      const on = portalsIn * (1 - gone);
      p.group.visible = on > 0.01;
      p.group.scale.setScalar(Math.max(0.001, on));
      const isHot = this.highlight === p.id;
      p.heat += ((isHot ? 1 : 0) - p.heat) * Math.min(1, dt * 7);
      // Everything that is not the highlighted portal steps back rather than
      // switching off, so the arc stays legible while one item is open.
      const dim = lerp(1, 0.35, this._highlightMix * (1 - p.heat));
      const flick = 0.5 + Math.sin(t * 1.5 + p.group.position.x) * 0.5;
      p.glass.material.opacity = on * dim * (0.05 + flick * 0.04 + p.heat * 0.3);
      p.base.material.opacity = on * dim * (0.2 + p.heat * 0.5);
      p.base.scale.setScalar(1 + p.heat * 0.2 + Math.sin(t * 2 + p.heat) * 0.02);
      p.bulb.material.opacity = on * dim * (0.12 + p.heat * 0.4);
      p.lbl.material.opacity = on * (0.5 + p.heat * 0.5);
      p.group.position.y = p.heat * 0.06;
    }

    // ------------------------------------------------------- ACT C: horizon
    this.horizon.visible = depart > 0.005;
    if (this.horizon.visible) {
      const breath = 0.5 + Math.sin(t * 0.7) * 0.5;
      this.band.material.opacity = depart * (0.06 + breath * 0.07);
      this.sun.material.opacity = depart * (0.16 + breath * 0.12);
      this.marks.material.opacity = depart * 0.5;
      // The road lights up ahead of the walker rather than all at once.
      for (let i = 0; i < this.markCount; i++) {
        const lead = clamp(depart * 1.4 - i / this.markCount);
        for (let s = 0; s < 2; s++) {
          V.set(s ? 2.0 : -2.0, 0.02, -2 - i * 2.4);
          E.set(0, 0, 0);
          Q.setFromEuler(E);
          const w = lead * (0.7 + Math.sin(t * 3 - i * 0.6) * 0.3);
          V2.set(1, 1, Math.max(0.0001, w));
          M4.compose(V, Q, V2);
          this.marks.setMatrixAt(i * 2 + s, M4);
        }
      }
      this.marks.instanceMatrix.needsUpdate = true;
    }

    this.pad.material.opacity = (0.1 + Math.sin(t * 0.9) * 0.03) * (1 - depart);
  }
}
