import * as THREE from 'three';

/**
 * Every texture in this project is generated at runtime from a 2D canvas.
 * No image requests, no CDN, no decode stalls, identical on every device —
 * which is exactly what section 38 of the brief asked for.
 */

const cache = new Map();

const cached = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

const canvas2d = (size) => {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
};

/** Soft radial falloff — used for glows, contact shadows and light blooms. */
export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', power = 1) {
  return cached(`radial:${inner}:${outer}:${power}`, () => {
    const [c, ctx] = canvas2d(128);
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, inner);
    g.addColorStop(Math.min(0.85, 0.45 * power), inner.replace(/[\d.]+\)$/, '0.35)'));
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

/** Aged paper: warm base, subtle fibre noise, faint ruled lines. */
export function paperTexture() {
  return cached('paper', () => {
    const [c, ctx] = canvas2d(512);
    ctx.fillStyle = '#f2ead6';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 5200; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.fillStyle = `rgba(${170 + Math.random() * 60},${150 + Math.random() * 50},${118 + Math.random() * 40},${Math.random() * 0.12})`;
      ctx.fillRect(x, y, 1 + Math.random() * 2, 1);
    }
    ctx.strokeStyle = 'rgba(120,104,74,0.10)';
    ctx.lineWidth = 1;
    for (let y = 96; y < 470; y += 34) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(472, y);
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

/** CRT scanlines with a faint phosphor grid. */
export function scanlineTexture() {
  return cached('scanline', () => {
    const [c, ctx] = canvas2d(256);
    ctx.fillStyle = '#04120c';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 3) {
      ctx.fillStyle = 'rgba(120,255,190,0.055)';
      ctx.fillRect(0, y, 256, 1);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

/** Brushed metal for platters and machine housings. */
export function brushedTexture() {
  return cached('brushed', () => {
    const [c, ctx] = canvas2d(256);
    ctx.fillStyle = '#8d949b';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2400; i++) {
      const y = Math.random() * 256;
      ctx.strokeStyle = `rgba(255,255,255,${Math.random() * 0.08})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y + (Math.random() - 0.5) * 2);
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

/** A monospace label rendered to a sprite — used for in-world technical tags. */
export function labelSprite(text, color = '#eef2f4', scale = 1) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = '600 44px "IBM Plex Mono", monospace';
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 48;
  c.width = w;
  c.height = 84;
  const g = c.getContext('2d');
  g.font = font;
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.globalAlpha = 0.92;
  g.fillText(text, 24, 44);
  g.globalAlpha = 1;
  g.strokeStyle = color;
  g.globalAlpha = 0.35;
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, w - 3, 81);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set((w / 84) * 0.5 * scale, 0.5 * scale, 1);
  sprite.userData.isLabel = true;
  return sprite;
}

/**
 * Fake contact shadow. Cheaper than a shadow map by orders of magnitude and it
 * runs on every tier, which is why the character never looks like it is
 * floating even on a phone with shadow maps switched off.
 */
export function contactShadow(radius = 0.6, opacity = 0.42) {
  const mat = new THREE.MeshBasicMaterial({
    map: radialTexture('rgba(0,0,0,0.85)', 'rgba(0,0,0,0)'),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -1;
  mesh.userData.isShadow = true;
  return mesh;
}

/** Additive glow quad, for LEDs, pulses and light shafts. */
export function glowSprite(color = '#ffffff', size = 1, opacity = 0.8) {
  const mat = new THREE.SpriteMaterial({
    map: radialTexture(),
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(size);
  return s;
}

/** Emissive standard material with sane defaults for era-lit objects. */
export function emissive(color, intensity = 1, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).multiplyScalar(0.25),
    emissive: new THREE.Color(color),
    emissiveIntensity: intensity,
    roughness: 0.4,
    metalness: 0,
    ...opts,
  });
}

export function matte(color, roughness = 0.85, metalness = 0.02, opts = {}) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness, metalness, ...opts });
}

export function metal(color, roughness = 0.32, opts = {}) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness, metalness: 0.9, ...opts });
}

/** Additive line material for lattices, lineage and flow paths. */
export function lineMaterial(color, opacity = 0.4) {
  return new THREE.LineBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/** Recursively release GPU memory for a subtree. Shared caches are left alone. */
export function disposeObject(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (m.userData?.shared) continue;
      for (const key of ['map', 'alphaMap', 'emissiveMap', 'normalMap', 'roughnessMap']) {
        if (m[key] && !cacheHasTexture(m[key])) m[key].dispose();
      }
      m.dispose();
    }
  });
  root.clear?.();
}

function cacheHasTexture(tex) {
  for (const v of cache.values()) if (v === tex) return true;
  return false;
}

/** Builds a THREE.Points cloud from a positions array with an additive sprite. */
export function pointCloud(positions, { color = '#ffffff', size = 0.05, opacity = 0.9 } = {}) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  const mat = new THREE.PointsMaterial({
    size,
    map: radialTexture(),
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  return new THREE.Points(geo, mat);
}
