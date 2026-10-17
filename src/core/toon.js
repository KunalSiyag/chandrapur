import * as THREE from 'three';

// ============================================================
// Surface materials and the light rig for Chandrapur.
//
// Every built surface is a physically based MeshStandardMaterial
// (rough, dielectric by default) lit by the sun/moon key, the sky's
// image-based light (scene.environment, generated from the sky in
// sky.js) and the local lamps. A world-space weathering patch
// breaks up flat procedural colour: low-frequency albedo drift,
// patchy grime and a little roughness variation, the way limewash,
// dust and monsoon stains break up a real wall.
//
// `toonMaterial` keeps its historical name so the ~200 call sites
// don't change; `surfaceMaterial` is the same function.
// ============================================================

export const PALETTE = {
  // ground
  grass: '#4f6a3c', grassDark: '#3a5232', road: '#5b5850', lane: '#7a6e5c',
  plaza: '#9c907c', prom: '#8f877a', ballast: '#6a665e', deck: '#8f8a80',
  bed: '#33403c', sand: '#a8987a', rock: '#6e6658',
  // built Chandrapur
  plaster: '#c8b28a', plasterCool: '#a8aca0', wood: '#6a5644', woodDark: '#4e3c30',
  roofClay: '#8a5040', roofBlue: '#5e6a74', trimMaroon: '#5e3e34',
  coachBlue: '#2e4a68', coachBand: '#c8a848',
  ink: '#2a2826',
  lampWarm: '#ffd9a0', marigold: '#d88a28',
};

/** Roughness / metalness presets callers may request with `{ surface: '...' }`. */
const SURFACES = {
  default: { roughness: 0.88, metalness: 0 },
  plaster: { roughness: 0.92, metalness: 0 },
  earth: { roughness: 0.96, metalness: 0 },
  wood: { roughness: 0.82, metalness: 0 },
  cloth: { roughness: 0.94, metalness: 0 },
  foliage: { roughness: 0.78, metalness: 0 },
  skin: { roughness: 0.7, metalness: 0 },
  paint: { roughness: 0.6, metalness: 0 },
  metal: { roughness: 0.42, metalness: 0.85 },
  brass: { roughness: 0.35, metalness: 0.9 },
  glass: { roughness: 0.08, metalness: 0 },
  water: { roughness: 0.06, metalness: 0 },
};

const NOISE_GLSL = /* glsl */`
float pn_hash(vec3 p){ p = fract(p*0.3183099+vec3(0.1,0.2,0.3)); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float pn_noise(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(pn_hash(i+vec3(0,0,0)),pn_hash(i+vec3(1,0,0)),f.x),mix(pn_hash(i+vec3(0,1,0)),pn_hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(pn_hash(i+vec3(0,0,1)),pn_hash(i+vec3(1,0,1)),f.x),mix(pn_hash(i+vec3(0,1,1)),pn_hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
`;

/**
 * World-space weathering on a MeshStandardMaterial: broad albedo drift,
 * patchy grime/dust, fine grain, a gentle desaturation of the procedural
 * palette (real pigments under dust are never toy-bright) and a little
 * roughness variation. `amount` is the historical "paint" strength.
 */
function patchWeathering(material, amount) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWeather = { value: amount };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPWorld;')
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        { vec4 pw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            pw = instanceMatrix * pw;
          #endif
          vPWorld = (modelMatrix * pw).xyz; }`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPWorld;\nuniform float uWeather;\nfloat wGrime;\nfloat wFine;\n' + NOISE_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float broad = pn_noise(vPWorld * 0.35) * 2.0 - 1.0;
          float mid = pn_noise(vPWorld * 1.7 + 11.0) * 2.0 - 1.0;
          wFine = pn_noise(vPWorld * 9.0 + 3.0) * 2.0 - 1.0;
          float k = uWeather * 6.0;
          // dusty, sun-faded pigments
          float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb = mix(vec3(l), diffuseColor.rgb, 0.84);
          diffuseColor.rgb = min(diffuseColor.rgb, vec3(0.78)) + max(diffuseColor.rgb - 0.78, 0.0) * 0.4;
          diffuseColor.rgb *= 1.0 + k * (0.11 * broad + 0.06 * mid + 0.04 * wFine);
          // patchy grime: darker, browner, a little desaturated
          wGrime = smoothstep(0.15, 0.85, mid * 0.6 + broad * 0.5) * clamp(k, 0.0, 1.5);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.8, 0.76, 0.7), wGrime * 0.6);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + uWeather * 6.0 * (0.05 * wFine + 0.04 * wGrime), 0.03, 1.0);`);
  };
  material.customProgramCacheKey = () => 'weather';
}

const matCache = new Map();

function build(c, opts) {
  const { paint, surface, ...params } = opts;
  const preset = SURFACES[surface] ?? SURFACES.default;
  const m = new THREE.MeshStandardMaterial({ color: c, ...preset, ...params });
  const amount = paint ?? 0.045;
  patchWeathering(m, amount);
  m.userData.paint = amount;
  // plain coloured, non-emissive surfaces may be baked into vertex colours
  m.userData.bakeable = !params.map && !params.emissiveMap && !(params.emissive && new THREE.Color(params.emissive).getHex() !== 0);
  return m;
}

/**
 * Physically based surface material with world-space weathering (shared via
 * cache). Options pass through to MeshStandardMaterial; extra keys:
 *  - `paint`: weathering strength (default 0.045)
 *  - `surface`: a roughness/metalness preset name (see SURFACES)
 */
export function toonMaterial(color, opts = {}) {
  const c = color instanceof THREE.Color ? color : new THREE.Color(color);
  if (opts.vertexColors || opts.map) return build(c, opts); // unique-ish materials skip the cache
  const key = c.getHexString() + '|' + JSON.stringify(opts, (k, v) => (v && v.isColor ? v.getHexString() : v));
  if (matCache.has(key)) return matCache.get(key);
  const m = build(c, opts);
  matCache.set(key, m);
  return m;
}
export const surfaceMaterial = toonMaterial;

/**
 * The light rig. Names are historical and kept for callers:
 *  - `moonLight`: the shadow-casting key — the sun by day, the moon by night
 *  - `hemi`: a weak sky/ground fill on top of the image-based sky light
 *  - `rim`: ground bounce, opposite the key (no shadows)
 *  - `ambient`: kept at (almost) zero; the environment map does this job
 * Colours and intensities are driven every frame by daycycle.js.
 */
export function setupLights(scene) {
  const hemi = new THREE.HemisphereLight(0xc4d4ea, 0x6e5e48, 0.15);
  scene.add(hemi);

  const moonLight = new THREE.DirectionalLight(0xfff1dc, 3.0);
  moonLight.position.set(-28, 34, 18);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(4096, 4096);
  moonLight.shadow.camera.near = 1;
  moonLight.shadow.camera.far = 240;
  moonLight.shadow.camera.left = -112;
  moonLight.shadow.camera.right = 112;
  moonLight.shadow.camera.top = 112;
  moonLight.shadow.camera.bottom = -112;
  moonLight.shadow.bias = -0.0003;
  moonLight.shadow.normalBias = 0.035;
  moonLight.shadow.radius = 2.2;
  scene.add(moonLight);
  scene.add(moonLight.target);

  const rim = new THREE.DirectionalLight(0xd8b890, 0.0);
  rim.position.set(-40, -10, -30);
  scene.add(rim);

  const ambient = new THREE.AmbientLight(0xffffff, 0.0);
  scene.add(ambient);

  return { hemi, moonLight, rim, ambient };
}
