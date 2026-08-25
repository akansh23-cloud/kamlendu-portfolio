import * as THREE from 'three';
import { lerp } from '../lib/math.js';

/**
 * Environment — one light rig for the entire journey.
 *
 * Each scene declares a lighting descriptor; the environment interpolates
 * between the outgoing and incoming descriptors across a transition. Because
 * the character is lit by these same lights and never by scene-local ones, the
 * guide absorbs every era automatically — warm lamp in the writing room, steel
 * blue in the machine room, magenta in CHORON — which is the continuity trick
 * section 30 of the brief asks for.
 */

const C = (hex) => new THREE.Color(hex);

export const DEFAULT_LIGHTING = {
  bg: '#04070b',
  fog: '#04070b',
  fogDensity: 0.028,
  ambient: { color: '#6a7280', intensity: 0.5 },
  hemi: { sky: '#93a2b3', ground: '#241d16', intensity: 0.55 },
  key: { color: '#ffd9a0', intensity: 2.2, pos: [3, 5, 4] },
  rim: { color: '#7fb2ff', intensity: 1.1, pos: [-4, 3, -5] },
  fill: { color: '#405060', intensity: 0.4, pos: [0, 2, 6] },
  exposure: 1,
};

export class Environment {
  constructor(scene, caps) {
    this.scene = scene;
    this.caps = caps;

    this.ambient = new THREE.AmbientLight('#6a7280', 0.5);
    this.hemi = new THREE.HemisphereLight('#93a2b3', '#241d16', 0.55);
    this.key = new THREE.DirectionalLight('#ffd9a0', 2.2);
    this.rim = new THREE.DirectionalLight('#7fb2ff', 1.1);
    this.fill = new THREE.DirectionalLight('#405060', 0.4);

    if (caps.shadows) {
      this.key.castShadow = true;
      this.key.shadow.mapSize.set(1024, 1024);
      this.key.shadow.camera.near = 0.5;
      this.key.shadow.camera.far = 30;
      this.key.shadow.camera.left = -6;
      this.key.shadow.camera.right = 6;
      this.key.shadow.camera.top = 6;
      this.key.shadow.camera.bottom = -6;
      this.key.shadow.bias = -0.0012;
      this.key.shadow.normalBias = 0.02;
    }

    scene.add(this.ambient, this.hemi, this.key, this.rim, this.fill);
    scene.add(this.key.target, this.rim.target, this.fill.target);

    this.fog = new THREE.FogExp2('#04070b', 0.028);
    scene.fog = this.fog;
    this.bg = C('#04070b');
    scene.background = this.bg;

    this.state = structuredClone(DEFAULT_LIGHTING);
    this._a = C();
    this._b = C();
  }

  /** Blend two descriptors and push the result onto the real lights. */
  apply(from, to, t, exposureScale = 1) {
    const A = { ...DEFAULT_LIGHTING, ...from };
    const B = { ...DEFAULT_LIGHTING, ...to };
    const mixC = (target, ka, kb) => {
      this._a.set(ka);
      this._b.set(kb);
      target.copy(this._a).lerp(this._b, t);
    };

    mixC(this.bg, A.bg, B.bg);
    mixC(this.fog.color, A.fog, B.fog);
    this.fog.density = lerp(A.fogDensity, B.fogDensity, t);

    const a = { ...DEFAULT_LIGHTING.ambient, ...A.ambient };
    const b = { ...DEFAULT_LIGHTING.ambient, ...B.ambient };
    mixC(this.ambient.color, a.color, b.color);
    this.ambient.intensity = lerp(a.intensity, b.intensity, t);

    const ha = { ...DEFAULT_LIGHTING.hemi, ...A.hemi };
    const hb = { ...DEFAULT_LIGHTING.hemi, ...B.hemi };
    mixC(this.hemi.color, ha.sky, hb.sky);
    mixC(this.hemi.groundColor, ha.ground, hb.ground);
    this.hemi.intensity = lerp(ha.intensity, hb.intensity, t);

    for (const [name, light] of [['key', this.key], ['rim', this.rim], ['fill', this.fill]]) {
      const la = { ...DEFAULT_LIGHTING[name], ...A[name] };
      const lb = { ...DEFAULT_LIGHTING[name], ...B[name] };
      mixC(light.color, la.color, lb.color);
      light.intensity = lerp(la.intensity, lb.intensity, t);
      light.position.set(
        lerp(la.pos[0], lb.pos[0], t),
        lerp(la.pos[1], lb.pos[1], t),
        lerp(la.pos[2], lb.pos[2], t)
      );
      light.target.position.set(0, 1, 0);
      light.target.updateMatrixWorld();
    }

    this.exposure = lerp(A.exposure, B.exposure, t) * exposureScale;
  }

  /** Keeps the shadow frustum tight around wherever the character actually is. */
  followShadow(x, z) {
    if (!this.caps.shadows) return;
    this.key.shadow.camera.position?.set?.(x, 6, z);
    this.key.target.position.set(x, 1, z);
    this.key.target.updateMatrixWorld();
  }
}
