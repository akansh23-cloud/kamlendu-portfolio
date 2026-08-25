import * as THREE from 'three';
import { applyPose } from './pose.js';
import { contactShadow } from '../lib/gfx.js';
import { damp } from '../lib/math.js';

/**
 * HumanGuide — one body, twelve eras.
 *
 * Built procedurally rather than loaded from a GLTF, for three reasons the
 * brief cares about: it is a few kilobytes instead of a few megabytes, it can
 * never fail to load on a phone, and continuity is guaranteed by construction —
 * there is literally only one instance of this class for the whole journey, so
 * the person the visitor follows through the punch-card era is the same set of
 * meshes that walks into the streaming tunnel.
 *
 * What changes across eras: garment colour, sleeve length, and which of four
 * small accessories are grown in. What never changes: proportion, silhouette,
 * hair, gait. Costume shifts are interpolated over roughly a second so they
 * read as drift, not as a costume change.
 */

export const HEIGHT = 1.75;
export const HIP_Y = 0.94;
export const SHOULDER_Y = 1.44;
export const EYE_Y = 1.6;

const COSTUMES = {
  // 1 · before digital storage — simple, neutral, historical
  scribe: {
    top: '#b0a084', bottom: '#6a5c4a', accent: '#8d7a5c', shoe: '#4a4038',
    sleeves: 1, skirt: 1, vest: 0, lanyard: 0, collar: 0,
  },
  // 2 · the filing age — early industrial
  archivist: {
    top: '#8a7c66', bottom: '#453c31', accent: '#6d5f4e', shoe: '#332c26',
    sleeves: 1, skirt: 0.55, vest: 1, lanyard: 0, collar: 0.5,
  },
  // 3 · machine memory — workshop
  operator: {
    top: '#7d786a', bottom: '#3f3a32', accent: '#5c5648', shoe: '#2b2721',
    sleeves: 1, skirt: 0, vest: 1, lanyard: 0, collar: 0.7,
  },
  // 4 · mid-century technical
  technician: {
    top: '#93999a', bottom: '#33393c', accent: '#5f6a6c', shoe: '#24282b',
    sleeves: 1, skirt: 0, vest: 0.35, lanyard: 0, collar: 1,
  },
  // 5 · late 20th century casual technical
  casual: {
    top: '#4f6a74', bottom: '#2f353a', accent: '#7fb0b8', shoe: '#22262a',
    sleeves: 0.5, skirt: 0, vest: 0, lanyard: 0, collar: 0.6,
  },
  // 6 · enterprise engineer / operator
  enterprise: {
    top: '#3c4753', bottom: '#252a31', accent: '#7ea7bd', shoe: '#1d2126',
    sleeves: 1, skirt: 0, vest: 0.2, lanyard: 1, collar: 0.9,
  },
  // 7 · modern engineer
  modern: {
    top: '#333c46', bottom: '#1f242a', accent: '#62d8ff', shoe: '#191d22',
    sleeves: 1, skirt: 0, vest: 0, lanyard: 1, collar: 0.8,
  },
  // 8 · present day
  kamlendu: {
    top: '#2b333c', bottom: '#1b1f25', accent: '#cfe86a', shoe: '#15181d',
    sleeves: 1, skirt: 0, vest: 0, lanyard: 1, collar: 0.8,
  },
};

export class HumanGuide {
  constructor(caps) {
    this.caps = caps;
    const seg = caps.detail >= 1 ? 14 : caps.detail >= 0.7 ? 10 : 8;
    this.seg = seg;

    this.group = new THREE.Group();
    this.group.name = 'HumanGuide';

    this.mat = {
      skin: new THREE.MeshStandardMaterial({ color: '#b98a63', roughness: 0.78, metalness: 0 }),
      hair: new THREE.MeshStandardMaterial({ color: '#1d1815', roughness: 0.62, metalness: 0.04 }),
      top: new THREE.MeshStandardMaterial({ color: '#b0a084', roughness: 0.82, metalness: 0.02 }),
      bottom: new THREE.MeshStandardMaterial({ color: '#6a5c4a', roughness: 0.86, metalness: 0.02 }),
      accent: new THREE.MeshStandardMaterial({ color: '#8d7a5c', roughness: 0.6, metalness: 0.2 }),
      shoe: new THREE.MeshStandardMaterial({ color: '#4a4038', roughness: 0.6, metalness: 0.1 }),
    };

    this.bones = {};
    this.anchors = {};
    this.accessories = {};

    this._build();

    this.costume = { ...COSTUMES.scribe };
    this.target = { ...COSTUMES.scribe };
    this._c = {
      top: new THREE.Color(this.costume.top),
      bottom: new THREE.Color(this.costume.bottom),
      accent: new THREE.Color(this.costume.accent),
      shoe: new THREE.Color(this.costume.shoe),
    };
    this._t = {
      top: new THREE.Color(this.costume.top),
      bottom: new THREE.Color(this.costume.bottom),
      accent: new THREE.Color(this.costume.accent),
      shoe: new THREE.Color(this.costume.shoe),
    };
    this._era = new THREE.Color('#d8b06a');
    this._eraTarget = new THREE.Color('#d8b06a');
  }

  get object3D() {
    return this.group;
  }

  // ---------------------------------------------------------------- geometry

  _limb(radius, length, mat, opts = {}) {
    const g = new THREE.CapsuleGeometry(radius, Math.max(0.001, length - radius * 2), 2, this.seg);
    const m = new THREE.Mesh(g, mat);
    m.position.y = -length / 2;
    if (opts.scale) m.scale.set(opts.scale[0], opts.scale[1], opts.scale[2]);
    m.castShadow = this.caps.shadows;
    return m;
  }

  _joint(parent, name, x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    this.bones[name] = g;
    return g;
  }

  _build() {
    const seg = this.seg;
    const M = this.mat;

    // Root → body (bob and sway live here so clips never fight world placement)
    this.body = new THREE.Group();
    this.group.add(this.body);

    const hips = this._joint(this.body, 'hips', 0, HIP_Y, 0);
    const pelvis = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.08, 2, seg), M.bottom);
    pelvis.scale.set(1.15, 1, 0.78);
    pelvis.castShadow = this.caps.shadows;
    hips.add(pelvis);

    const spine = this._joint(hips, 'spine', 0, 0.13, 0);
    const chest = this._joint(spine, 'chest', 0, 0.15, 0);

    const ribs = new THREE.Mesh(new THREE.CapsuleGeometry(0.155, 0.2, 3, seg), M.top);
    ribs.scale.set(1.25, 1, 0.7);
    ribs.position.y = 0.09;
    ribs.castShadow = this.caps.shadows;
    chest.add(ribs);

    // Shoulder yoke — reads as a tailored line instead of two balls.
    const yoke = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.3, 2, seg), M.top);
    yoke.rotation.z = Math.PI / 2;
    yoke.position.y = 0.2;
    yoke.scale.set(1, 1, 0.82);
    chest.add(yoke);

    const neck = this._joint(chest, 'neck', 0, 0.24, 0);
    const neckMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.07, 2, seg), M.skin);
    neckMesh.position.y = 0.04;
    neck.add(neckMesh);

    const head = this._joint(neck, 'head', 0, 0.1, 0);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.113, seg + 4, seg + 2), M.skin);
    skull.scale.set(0.94, 1.14, 1.02);
    skull.position.y = 0.055;
    skull.castShadow = this.caps.shadows;
    head.add(skull);

    // Hair: one silhouette, never changes — the strongest continuity cue there is.
    const hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.121, seg + 4, seg + 2, 0, Math.PI * 2, 0, Math.PI * 0.56),
      M.hair
    );
    hairCap.scale.set(0.96, 1.16, 1.06);
    hairCap.position.y = 0.052;
    head.add(hairCap);

    const nape = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.05, 2, seg), M.hair);
    nape.position.set(0, 0.02, -0.075);
    nape.scale.set(1.5, 1, 0.7);
    head.add(nape);

    // Arms
    for (const s of [1, -1]) {
      const side = s > 0 ? 'L' : 'R';
      const sh = this._joint(chest, `shoulder${side}`, s * 0.185, 0.2, 0);
      sh.add(this._limb(0.052, 0.28, M.top, { scale: [1, 1, 1] }));
      const el = this._joint(sh, `elbow${side}`, 0, -0.28, 0);
      el.add(this._limb(0.044, 0.26, M.top));
      const wr = this._joint(el, `wrist${side}`, 0, -0.26, 0);
      const hand = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.045, 2, seg), M.skin);
      hand.position.y = -0.045;
      hand.scale.set(1, 1, 0.62);
      wr.add(hand);

      // Prop anchor: sits where a pen, card or disk would sit in the fingers.
      const anchor = new THREE.Group();
      anchor.position.set(0, -0.085, 0.02);
      wr.add(anchor);
      this.anchors[`hand${side}`] = anchor;
    }

    // Legs
    for (const s of [1, -1]) {
      const side = s > 0 ? 'L' : 'R';
      const th = this._joint(hips, `thigh${side}`, s * 0.088, -0.04, 0);
      th.add(this._limb(0.068, 0.44, M.bottom));
      const kn = this._joint(th, `knee${side}`, 0, -0.44, 0);
      kn.add(this._limb(0.052, 0.42, M.bottom));
      const an = this._joint(kn, `ankle${side}`, 0, -0.42, 0);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.05, 0.2), M.shoe);
      foot.position.set(0, -0.03, 0.045);
      foot.castShadow = this.caps.shadows;
      an.add(foot);
    }

    this.anchors.chest = chest;
    this.anchors.head = head;

    // ------------------------------------------------------------ accessories
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.27, 0.62, seg + 4, 1, true), M.top);
    skirt.position.y = -0.24;
    skirt.material = M.top;
    hips.add(skirt);
    skirt.material.side = THREE.DoubleSide;
    this.accessories.skirt = skirt;

    const vest = new THREE.Mesh(new THREE.CapsuleGeometry(0.163, 0.19, 3, seg), M.accent);
    vest.scale.set(1.27, 1, 0.74);
    vest.position.y = 0.075;
    chest.add(vest);
    this.accessories.vest = vest;

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.016, 6, seg + 4), M.accent);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.235;
    chest.add(collar);
    this.accessories.collar = collar;

    const lanyard = new THREE.Group();
    const cord = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.006, 5, seg + 4, Math.PI), M.accent);
    cord.rotation.set(Math.PI / 2, 0, 0);
    cord.scale.set(1, 1.5, 1);
    cord.position.y = 0.22;
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.072, 0.006), M.accent);
    badge.position.set(0, 0.075, 0.088);
    lanyard.add(cord, badge);
    chest.add(lanyard);
    this.accessories.lanyard = lanyard;

    for (const key of ['skirt', 'vest', 'collar', 'lanyard']) {
      this.accessories[key].scale.multiplyScalar(0.001);
      this.accessories[key].visible = false;
    }
    this.accessories.skirt.scale.set(1, 1, 1);
    this.accessories.skirt.visible = true;
    this._acc = { skirt: 1, vest: 0, collar: 0, lanyard: 0 };
    this._accBase = {
      skirt: new THREE.Vector3(1, 1, 1),
      vest: new THREE.Vector3(1.27, 1, 0.74),
      collar: new THREE.Vector3(1, 1, 1),
      lanyard: new THREE.Vector3(1, 1, 1),
    };

    // Contact shadow — the character is grounded on every quality tier.
    this.shadow = contactShadow(0.52, 0.4);
    this.shadow.position.y = 0.012;
    this.group.add(this.shadow);
  }

  // ---------------------------------------------------------------- costume

  setCostume(key) {
    const c = COSTUMES[key];
    if (!c || this._costumeKey === key) return;
    this._costumeKey = key;
    this.target = c;
    this._t.top.set(c.top);
    this._t.bottom.set(c.bottom);
    this._t.accent.set(c.accent);
    this._t.shoe.set(c.shoe);
  }

  /** The era colour bleeds into the character as a rim so they absorb each period. */
  setEraColor(color) {
    this._eraTarget.set(color);
  }

  setShadowOpacity(v) {
    this.shadow.material.opacity = v;
  }

  // ----------------------------------------------------------------- update

  update(dt, pose) {
    applyPose(pose, this.bones);

    this.body.position.y = pose.bobY;
    this.body.position.x = pose.sway;
    this.body.rotation.z = pose.lean * 0.35;
    this.body.rotation.x = pose.lean;

    // Costume colours drift rather than snap.
    const k = 3.2;
    for (const key of ['top', 'bottom', 'accent', 'shoe']) {
      this._c[key].lerp(this._t[key], 1 - Math.exp(-k * dt));
      this.mat[key].color.copy(this._c[key]);
    }

    // Sleeves: bare forearms simply take the skin colour, no mesh swapping.
    const sleeve = damp(this.mat.top.userData.sleeve ?? 1, this.target.sleeves, 3, dt);
    this.mat.top.userData.sleeve = sleeve;

    this._era.lerp(this._eraTarget, 1 - Math.exp(-2.4 * dt));
    for (const key of ['top', 'bottom']) {
      this.mat[key].emissive.copy(this._era);
      this.mat[key].emissiveIntensity = 0.09;
    }
    this.mat.accent.emissive.copy(this._era);
    this.mat.accent.emissiveIntensity = 0.34;
    this.mat.skin.emissive.copy(this._era);
    this.mat.skin.emissiveIntensity = 0.05;

    // Accessories grow and shrink instead of popping.
    for (const key of ['skirt', 'vest', 'collar', 'lanyard']) {
      const want = this.target[key === 'skirt' ? 'skirt' : key] ?? 0;
      this._acc[key] = damp(this._acc[key], want, 3, dt);
      const v = this._acc[key];
      const obj = this.accessories[key];
      obj.visible = v > 0.02;
      if (obj.visible) {
        const b = this._accBase[key];
        obj.scale.set(b.x * v, b.y * v, b.z * v);
      }
    }
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    for (const m of Object.values(this.mat)) m.dispose();
    this.shadow.material.dispose();
  }
}
