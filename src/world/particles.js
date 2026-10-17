import * as THREE from 'three';

/**
 * Fireflies over the riverbanks and gardens (the damp green
 * places they actually live), a star dome, and the chimney
 * smoke of the observatory cottage.
 */
export function createParticles(scene, opts = {}) {
  const group = new THREE.Group();
  group.name = 'particles';

  // ---- fireflies: three home ranges ----
  const FIREFLIES = 120;
  const fGeo = new THREE.BufferGeometry();
  const fPos = new Float32Array(FIREFLIES * 3);
  const fSeed = new Float32Array(FIREFLIES * 4);
  const homes = [
    // the riverbanks — the biggest range
    { pick: () => [-70 + Math.random() * 104, 29 + Math.random() * 18] },
    // station square gardens + street mouth
    { pick: () => [-11 + Math.random() * 24, -6 + Math.random() * 12] },
    // the south bank lane
    { pick: () => [10 + Math.random() * 22, 44 + Math.random() * 10] },
  ];
  let i = 0;
  while (i < FIREFLIES) {
    const home = homes[Math.floor(Math.random() * homes.length)];
    const [x, z] = home.pick();
    const y = 0.6 + Math.random() * 3.2;
    fPos.set([x, y, z], i * 3);
    fSeed.set([Math.random() * 100, 0.4 + Math.random() * 1.2, Math.random() * Math.PI * 2, 0.5 + Math.random()], i * 4);
    i++;
  }
  fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  fGeo.setAttribute('aSeed', new THREE.BufferAttribute(fSeed, 4));
  const fMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vTwinkle;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * aSeed.y + aSeed.x) * 1.1;
        p.y += sin(uTime * aSeed.y * 1.3 + aSeed.z) * 0.55;
        p.z += cos(uTime * aSeed.y * 0.8 + aSeed.x) * 1.1;
        vTwinkle = 0.5 + 0.5 * sin(uTime * (1.5 + aSeed.w) + aSeed.z * 3.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (3.2 + vTwinkle * 4.0) * uPixelRatio * (18.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vTwinkle;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float a = smoothstep(0.5, 0.05, d) * (0.25 + 0.75 * vTwinkle);
        gl_FragColor = vec4(1.0, 0.85, 0.45, a);
      }
    `,
  });
  const fireflies = new THREE.Points(fGeo, fMat);
  fireflies.frustumCulled = false;
  group.add(fireflies);

  // ---- stars (fog-exempt: they are the sky, not the weather) ----
  const STARS = 700;
  const sGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(STARS * 3);
  for (let s = 0; s < STARS; s++) {
    const a = Math.random() * Math.PI * 2;
    const e = 0.12 + Math.random() * 1.3;
    const r = 220;
    sPos[s * 3] = Math.cos(a) * Math.cos(e) * r;
    sPos[s * 3 + 1] = Math.sin(e) * r;
    sPos[s * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const stars = new THREE.Points(sGeo, new THREE.PointsMaterial({
    color: 0xcfd8ff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false, fog: false,
  }));
  stars.frustumCulled = false;
  group.add(stars);

  // ---- chimney smoke ----
  const SMOKE = 26;
  const smokeGeo = new THREE.BufferGeometry();
  const smokePos = new Float32Array(SMOKE * 3);
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
  const smokeTex = makePuffTexture();
  const smokeMat = new THREE.PointsMaterial({
    map: smokeTex, size: 2.2, transparent: true, opacity: 0.35,
    color: 0xaab4d4, depthWrite: false,
  });
  const smoke = new THREE.Points(smokeGeo, smokeMat);
  smoke.frustumCulled = false;
  group.add(smoke);
  const chimneyTop = opts.chimneyTop || new THREE.Vector3(-52, 17, -30);

  scene.add(group);

  function update(t) {
    fMat.uniforms.uTime.value = t;
    const arr = smokeGeo.attributes.position.array;
    for (let s = 0; s < SMOKE; s++) {
      const life = ((t * 0.25 + s / SMOKE) % 1);
      arr[s * 3] = chimneyTop.x + Math.sin((life * 5 + s) * 1.7) * life * 1.6 + life * 1.2;
      arr[s * 3 + 1] = chimneyTop.y + life * 7;
      arr[s * 3 + 2] = chimneyTop.z + Math.cos((life * 4 + s) * 1.3) * life * 1.4;
    }
    smokeGeo.attributes.position.needsUpdate = true;
    stars.rotation.y = t * 0.004;
  }

  return { group, update, fireflies };
}

function makePuffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
