import * as THREE from 'three';

// ============================================================
// Night cel-shading for Chandpur. The ramp is a 16-texel
// 3-band split (after Sakura Crossing's finding that a wide
// grazing band reads as anime, not as plastic), every material
// carries a whisper of world-space hand-painted variation, and
// the palette is one list so the town stays coherent.
// ============================================================

export const PALETTE = {
  // the night ground
  grass: '#31604a', grassDark: '#22463a', road: '#4a4f5a', lane: '#55534e',
  plaza: '#8a8172', prom: '#7d7a72', ballast: '#5b5e66', deck: '#9aa0a8',
  bed: '#1d2c3a', sand: '#7c7256', rock: '#4a5670',
  // built Chandpur
  plaster: '#c9a96e', plasterCool: '#9fb0a4', wood: '#6e5a42', woodDark: '#5a4032',
  roofClay: '#7a4438', roofBlue: '#56677a', trimMaroon: '#5a3c30',
  coachBlue: '#24466e', coachBand: '#d8b83a',
  ink: '#2a2740', // never pure black
  lampWarm: '#ffd9a0', marigold: '#e8931a',
};

let gradientMap = null;

/** 16-texel ramp: back-face -> 0, grazing -> 0.42, mid -> 0.8, lit -> 1. */
export function getGradientMap() {
  if (gradientMap) return gradientMap;
  const n = 16, data = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const dotNL = ((i + 0.5) / n) * 2 - 1;
    let v;
    if (dotNL < 0.0) v = 0.0;
    else if (dotNL < 0.12) v = 0.42;
    else if (dotNL < 0.42) v = 0.8;
    else v = 1.0;
    data[i] = Math.round(v * 255);
  }
  gradientMap = new THREE.DataTexture(data, n, 1, THREE.RedFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.generateMipmaps = false;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

const NOISE_GLSL = /* glsl */`
float pn_hash(vec3 p){ p = fract(p*0.3183099+vec3(0.1,0.2,0.3)); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float pn_noise(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(pn_hash(i+vec3(0,0,0)),pn_hash(i+vec3(1,0,0)),f.x),mix(pn_hash(i+vec3(0,1,0)),pn_hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(pn_hash(i+vec3(0,0,1)),pn_hash(i+vec3(1,0,1)),f.x),mix(pn_hash(i+vec3(0,1,1)),pn_hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
float paintNoise(vec3 p){ return (pn_noise(p*0.45)*0.6 + pn_noise(p*1.9+11.0)*0.4) * 2.0 - 1.0; }
`;

/** World-space hand-painted colour variation on any built-in material. */
function patchPaint(material, amount) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uPaint = { value: amount };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPWorld;')
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        { vec4 pw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            pw = instanceMatrix * pw;
          #endif
          vPWorld = (modelMatrix * pw).xyz; }`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPWorld;\nuniform float uPaint;\n' + NOISE_GLSL)
      .replace('#include <map_fragment>', `#include <map_fragment>
        { float pn = paintNoise(vPWorld);
          diffuseColor.rgb *= 1.0 + uPaint * pn;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(0.93,0.93,0.97), uPaint*2.0*clamp(pn*1.5,0.0,1.0)); }`);
  };
  material.customProgramCacheKey = () => 'paint';
}

let paintWarned = false;
const matCache = new Map();

/** Toon material with painted variation (shared via cache). */
export function toonMaterial(color, opts = {}) {
  const c = color instanceof THREE.Color ? color : new THREE.Color(color);
  const key = c.getHexString() + '|' + JSON.stringify(opts, (k, v) => (v && v.isColor ? v.getHexString() : v));
  const { paint, ...params } = opts;
  if (opts.vertexColors || opts.map) {
    // unique-ish materials skip the cache
    const m = new THREE.MeshToonMaterial({ color: c, gradientMap: getGradientMap(), ...params });
    patchPaint(m, paint ?? 0.045); m.userData.paint = paint ?? 0.045;
    return m;
  }
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshToonMaterial({ color: c, gradientMap: getGradientMap(), ...params });
  patchPaint(m, paint ?? 0.045); m.userData.paint = paint ?? 0.045;
  matCache.set(key, m);
  return m;
}

/**
 * Night lighting rig:
 *  - cool hemisphere fill (sky / ground)
 *  - warm moon directional with shadows
 *  - faint blue rim from opposite side
 *  - the fill is strong on purpose: night shadows are indigo, not black
 */
export function setupLights(scene) {
  const hemi = new THREE.HemisphereLight(0xa7b8df, 0x4b544b, 1.15);
  scene.add(hemi);

  const moonLight = new THREE.DirectionalLight(0xffedce, 1.55);
  moonLight.position.set(-28, 34, 18);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(4096, 4096);
  moonLight.shadow.camera.near = 1;
  moonLight.shadow.camera.far = 220;
  moonLight.shadow.camera.left = -112;
  moonLight.shadow.camera.right = 112;
  moonLight.shadow.camera.top = 112;
  moonLight.shadow.camera.bottom = -112;
  moonLight.shadow.bias = -0.0004;
  moonLight.shadow.normalBias = 0.03;
  scene.add(moonLight);
  scene.add(moonLight.target);

  const rim = new THREE.DirectionalLight(0x91afd4, 0.65);
  rim.position.set(-40, 32, -30);
  scene.add(rim);

  const ambient = new THREE.AmbientLight(0x77878f, 0.25);
  scene.add(ambient);

  return { hemi, moonLight, rim, ambient };
}
