import * as THREE from 'three';

/**
 * Creates the WebGL renderer + scene + fog backbone.
 * Night-time palette, soft shadows, ACES tone mapping.
 */
export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Town geometry and the night key are static. Refresh the shadow atlas at
  // a modest cadence for people/cloth/balloon rather than all geometry at 60Hz.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  // tone mapping lives in the composite pass now, not the renderer
  renderer.toneMapping = THREE.NoToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070b1a);
  scene.fog = new THREE.FogExp2(0x182b42, 0.0038);

  const onResize = (camera, composer) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (composer) composer.setSize(w, h);
  };

  return { renderer, scene, onResize };
}
