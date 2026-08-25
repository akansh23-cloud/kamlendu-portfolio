import * as THREE from 'three';

/**
 * Renderer — one WebGLRenderer, configured once, resized carefully.
 *
 * Antialiasing is a high-tier luxury; everywhere else the adaptive DPR in
 * Capabilities does the same job for a fraction of the fill cost.
 */
export function createRenderer(canvas, caps) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: caps.tier === 'high',
    alpha: false,
    powerPreference: caps.mobile ? 'default' : 'high-performance',
    stencil: false,
    depth: true,
  });

  renderer.setClearColor(0x04070b, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  if (caps.shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  renderer.setPixelRatio(caps.dpr);

  return renderer;
}

export class Viewport {
  constructor(renderer, camera, caps) {
    this.renderer = renderer;
    this.camera = camera;
    this.caps = caps;
    this.width = 0;
    this.height = 0;
    this.resize();

    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => this.resize());
    };
    addEventListener('resize', onResize, { passive: true });
    addEventListener('orientationchange', onResize, { passive: true });
  }

  resize() {
    const w = innerWidth;
    const h = innerHeight;
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(this.caps.dpr);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  applyDpr() {
    this.renderer.setPixelRatio(this.caps.dpr);
    this.renderer.setSize(this.width, this.height, false);
  }
}
