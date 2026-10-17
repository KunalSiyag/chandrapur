import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

/**
 * The sky over Chandrapur: a physically based Preetham daylight model
 * (three/addons Sky) tuned for hazy North Indian air, blended into a
 * moonlit night with procedural stars. The same model, evaluated on the
 * CPU, gives the fog/horizon colour and the sunlight's colour after its
 * path through the atmosphere, so sky, haze and light always agree.
 *
 * The sky also feeds image-based lighting: `updateEnvironment(renderer,
 * scene)` renders it (plus a sunlit ground hemisphere for bounce light)
 * into a cube map and prefilters it with PMREMGenerator into
 * `scene.environment`, only when the sun or the night blend has moved
 * noticeably.
 */

// ---- atmosphere parameters (hazy, dusty late-season air) ----
const ATMO = { turbidity: 9, rayleigh: 1.5, mieCoefficient: 0.0055, mieDirectionalG: 0.8 };
/** Scales Preetham's radiance into the scene's light units (sun ≈ 3). */
const SKY_SCALE = 0.36;
const SUN_DISC = 0.9;

const NIGHT_GLSL = /* glsl */`
uniform float uNight, uSkyScale, uSunDisc, uHaze;
uniform vec3 uMoonDir, uFogColor, uGroundColor, uNightZenith, uNightHorizon, uMoonGlow;
float st_hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 nightSky(vec3 d){
  float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uNightHorizon, uNightZenith, pow(h, 0.45));
  // moonglow: aureole around the moon
  float cm = max(dot(d, normalize(uMoonDir)), 0.0);
  col += uMoonGlow * (pow(cm, 600.0) * 0.12 + pow(cm, 40.0) * 0.02 + pow(cm, 6.0) * 0.006);
  // stars, dimmed by extinction toward the horizon and near the moon
  vec3 p = d * 260.0;
  vec3 cell = floor(p);
  float r = st_hash(cell);
  if (r > 0.965) {
    vec3 jit = vec3(st_hash(cell + 7.1), st_hash(cell + 3.3), st_hash(cell + 9.7)) - 0.5;
    float dist = length(fract(p) - 0.5 - jit * 0.6);
    float mag = pow((r - 0.965) / 0.035, 3.0);
    float star = smoothstep(0.16, 0.0, dist) * (0.15 + 2.2 * mag);
    vec3 tint = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.86, 0.7), st_hash(cell + 1.7));
    col += tint * star * smoothstep(0.02, 0.3, d.y) * (1.0 - smoothstep(0.9, 0.995, cm)) * 0.06;
  }
  return col;
}
`;

function makeMaterial(uniforms, envMode) {
  const S = Sky.SkyShader;
  const fragReps = [
    ['uniform float time;', 'uniform float time;\n' + NIGHT_GLSL],
    ['vec3 sundiscColor = ( 760.0 * sundisc ) * min( vSunE * Fex, 80.0 );',
      'vec3 sundiscColor = ( uSunDisc * sundisc ) * min( vSunE * Fex, 80.0 );'],
    ['vec3 texColor = ( Lin + L0 ) * 0.04 + sundiscColor + vec3( 0.0, 0.0003, 0.00075 );',
      'vec3 texColor = ( ( Lin + L0 ) * 0.04 + sundiscColor + vec3( 0.0, 0.0003, 0.00075 ) ) * uSkyScale;\n' +
      '\t\t\ttexColor = mix( texColor, nightSky( direction ), uNight );'],
    ['vec3 sunColor = vSunE * Fex * 0.22 * 0.04;', 'vec3 sunColor = vSunE * Fex * 0.22 * 0.04 * uSkyScale;'],
    ['vec3 skyAmbient = Lin * 0.04 + vec3( 0.0, 0.0003, 0.00075 );', 'vec3 skyAmbient = ( Lin * 0.04 + vec3( 0.0, 0.0003, 0.00075 ) ) * uSkyScale;'],
    ['cloudColor *= max( dayFactor, 0.03 );', 'cloudColor *= max( dayFactor, 0.03 );\n\t\t\t\tcloudColor = mix( cloudColor, uNightHorizon * 1.6 * shade + uMoonGlow * 0.04 * silver * edge, uNight );'],
    ['texColor -= L0 * 0.04 * alpha;', 'texColor -= L0 * 0.04 * alpha * uSkyScale;'],
    ['gl_FragColor = vec4( texColor, 1.0 );', `
			// dusty haze band: the sky melts into the fog colour at the horizon
			float hz = 1.0 - smoothstep( 0.0, 0.32, direction.y );
			texColor = mix( texColor, uFogColor, uHaze * hz * hz );
			${envMode
    ? 'texColor = mix( texColor, uGroundColor, smoothstep( 0.0, -0.06, direction.y ) );'
    : 'texColor = mix( texColor, uFogColor, smoothstep( 0.0, -0.04, direction.y ) );'}
			gl_FragColor = vec4( texColor, 1.0 );`],
    ['#include <tonemapping_fragment>', ''],
    ['#include <colorspace_fragment>', ''],
  ];
  let frag = S.fragmentShader;
  for (const [a, b] of fragReps) {
    if (!frag.includes(a)) throw new Error(`sky shader patch failed: ${a}`);
    frag = frag.replace(a, b);
  }
  return new THREE.ShaderMaterial({
    name: envMode ? 'SkyEnv' : 'Sky',
    uniforms,
    vertexShader: S.vertexShader,
    fragmentShader: frag,
    side: THREE.BackSide, depthWrite: false, depthTest: !envMode, fog: false,
  });
}

// ---- CPU Preetham (mirrors three's Sky shader) ----
const TOTAL_RAYLEIGH = [5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5];
const MIE_CONST = [1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14];
function sunIntensity(cosZ) {
  const c = Math.min(1, Math.max(-1, cosZ));
  return 1000 * Math.max(0, 1 - Math.exp(-((1.6110731556870734 - Math.acos(c)) / 1.5)));
}
function betas(sunDir) {
  const sunfade = 1 - Math.min(1, Math.max(0, 1 - Math.exp(sunDir.y)));
  const rc = ATMO.rayleigh - (1 - sunfade);
  const mc = 0.434 * (0.2 * ATMO.turbidity) * 10E-18 * ATMO.mieCoefficient;
  return { bR: TOTAL_RAYLEIGH.map((v) => v * rc), bM: MIE_CONST.map((v) => v * mc) };
}
function opticalLengths(dirY) {
  const z = Math.acos(Math.max(0, dirY));
  const inv = 1 / (Math.cos(z) + 0.15 * Math.pow(93.885 - (z * 180) / Math.PI, -1.253));
  return [8.4E3 * inv, 1.25E3 * inv];
}
/** Linear sky radiance toward `dir` (unit), in scene units, without the sun disc. */
function skyRadiance(dir, sunDir, out) {
  const { bR, bM } = betas(sunDir);
  const [sR, sM] = opticalLengths(dir.y);
  const sunE = sunIntensity(sunDir.y);
  const cosT = dir.x * sunDir.x + dir.y * sunDir.y + dir.z * sunDir.z;
  const rPhase = 0.05968310365946075 * (1 + Math.pow(cosT * 0.5 + 0.5, 2));
  const g = ATMO.mieDirectionalG, g2 = g * g;
  const mPhase = 0.07957747154594767 * (1 - g2) / Math.pow(1 - 2 * g * cosT + g2, 1.5);
  const blend = Math.min(1, Math.max(0, Math.pow(1 - sunDir.y, 5)));
  const res = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const fex = Math.exp(-(bR[i] * sR + bM[i] * sM));
    const ratio = (bR[i] * rPhase + bM[i] * mPhase) / (bR[i] + bM[i]);
    let lin = Math.pow(sunE * ratio * (1 - fex), 1.5);
    lin *= 1 + (Math.sqrt(sunE * ratio * fex) - 1) * blend;
    res[i] = ((lin + 0.1 * fex) * 0.04 + [0, 0.0003, 0.00075][i]) * SKY_SCALE;
  }
  return out.setRGB(res[0], res[1], res[2]);
}
/** Direct sunlight transmittance (0..1 per channel) for the sun at `sunDir`. */
function sunTransmittance(sunDir, out) {
  const { bR, bM } = betas(sunDir);
  const [sR, sM] = opticalLengths(Math.max(sunDir.y, 0.0));
  return out.setRGB(...[0, 1, 2].map((i) => Math.exp(-(bR[i] * sR + bM[i] * sM))));
}

export function createSky(scene) {
  const base = THREE.UniformsUtils.clone(Sky.SkyShader.uniforms);
  const uniforms = {
    ...base,
    uNight: { value: 0 }, uSkyScale: { value: SKY_SCALE }, uSunDisc: { value: SUN_DISC }, uHaze: { value: 0.6 },
    uMoonDir: { value: new THREE.Vector3(0.4, 0.3, 0.8).normalize() },
    uFogColor: { value: new THREE.Color() }, uGroundColor: { value: new THREE.Color() },
    uNightZenith: { value: new THREE.Color(0.0016, 0.0024, 0.0058) },
    uNightHorizon: { value: new THREE.Color(0.0052, 0.0075, 0.0135) },
    uMoonGlow: { value: new THREE.Color(0.75, 0.8, 0.9) },
  };
  uniforms.turbidity.value = ATMO.turbidity;
  uniforms.rayleigh.value = ATMO.rayleigh;
  uniforms.mieCoefficient.value = ATMO.mieCoefficient;
  uniforms.mieDirectionalG.value = ATMO.mieDirectionalG;
  uniforms.cloudCoverage.value = 0.22;
  uniforms.cloudDensity.value = 0.45;
  uniforms.cloudElevation.value = 0.55;
  uniforms.cloudScale.value = 0.00028;
  uniforms.cloudSpeed.value = 0.00004;

  const material = makeMaterial(uniforms, false);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(238, 48, 28), material);
  dome.name = 'sky-dome';
  dome.renderOrder = -1;
  dome.frustumCulled = false;
  scene.add(dome);

  // environment capture: the same sky, sun disc removed, ground below
  const envUniforms = { ...uniforms, uSunDisc: { value: 0 } };
  const envScene = new THREE.Scene();
  const envDome = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), makeMaterial(envUniforms, true));
  envDome.frustumCulled = false;
  envScene.add(envDome);
  const cubeRT = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType, generateMipmaps: false });
  const cubeCam = new THREE.CubeCamera(0.1, 100, cubeRT);
  envScene.add(cubeCam);
  let pmrem = null, envRT = null;
  const lastSun = new THREE.Vector3(0, -2, 0);
  let lastNight = -1, envDirty = true, lastEnvTime = 0;

  const sunDirV = new THREE.Vector3(0.4, 0.6, 0.3).normalize();
  const fogColor = new THREE.Color(), horizon = new THREE.Color(), tmp = new THREE.Color(), tmpDir = new THREE.Vector3();
  const nightFog = new THREE.Color();
  const dustTint = new THREE.Color(1.0, 0.93, 0.8);
  let night = 0;

  /** Horizon radiance away from the sun's forward-scattering glare: the
   *  colour distant terrain takes on in the haze (in-scattered skylight). */
  function horizonRadiance(out) {
    out.setRGB(0, 0, 0);
    const az0 = Math.atan2(sunDirV.z, sunDirV.x);
    for (let k = 0; k < 5; k++) {
      const a = az0 + Math.PI * (0.5 + k * 0.25), e = 0.06;
      tmpDir.set(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e));
      out.add(skyRadiance(tmpDir, sunDirV, tmp));
    }
    return out.multiplyScalar(1 / 5);
  }

  return {
    dome,
    uniforms,
    fogColor,
    setState({ sunDir, moonDir, night: n, time }) {
      night = n;
      sunDirV.copy(sunDir);
      uniforms.sunPosition.value.copy(sunDir).multiplyScalar(450000);
      if (moonDir) uniforms.uMoonDir.value.copy(moonDir);
      uniforms.uNight.value = THREE.MathUtils.smoothstep(n, 0.55, 1.0);
      uniforms.time.value = time;
      // fog = the (dusty) horizon, crossfading into the night horizon
      horizonRadiance(horizon).multiply(dustTint);
      nightFog.copy(uniforms.uNightHorizon.value).multiplyScalar(1.15);
      // keep the haze a little less saturated than the raw horizon (dust scatters broadly)
      const hl = horizon.r * 0.2126 + horizon.g * 0.7152 + horizon.b * 0.0722;
      horizon.lerp(tmp.setRGB(hl, hl, hl), 0.3);
      fogColor.copy(horizon).lerp(nightFog, uniforms.uNight.value);
      uniforms.uFogColor.value.copy(fogColor);
    },
    /** Sunlight colour after the atmosphere (normalised) and its relative strength. */
    sunlight(sunDir, outColor) {
      sunTransmittance(sunDir, outColor);
      const zen = sunTransmittance(tmpDir.set(0, 1, 0), tmp);
      outColor.setRGB(outColor.r / zen.r, outColor.g / zen.g, outColor.b / zen.b);
      const strength = 0.2126 * outColor.r + 0.7152 * outColor.g + 0.0722 * outColor.b;
      const m = Math.max(outColor.r, outColor.g, outColor.b, 1e-4);
      outColor.multiplyScalar(1 / m);
      return strength;
    },
    /** Ground radiance seen in the environment (bounce light), set by the day cycle. */
    setGround(color) { uniforms.uGroundColor.value.copy(color); },
    /** Re-prefilter the sky into scene.environment when it changed noticeably. */
    updateEnvironment(renderer, targetScene, force = false) {
      if (!renderer) return false;
      const cosMoved = lastSun.dot(sunDirV), dNight = Math.abs(night - lastNight);
      const changed = cosMoved < Math.cos(THREE.MathUtils.degToRad(0.8)) || dNight >= 0.02;
      if (!force && !envDirty && !changed) return false;
      // while the clock is rushed, refresh at most ~8×/s unless the jump is big
      const now = performance.now();
      const big = cosMoved < Math.cos(THREE.MathUtils.degToRad(6)) || dNight > 0.15;
      if (!force && !envDirty && !big && now - lastEnvTime < 120) return false;
      lastEnvTime = now;
      pmrem ??= new THREE.PMREMGenerator(renderer);
      const prevTarget = renderer.getRenderTarget();
      cubeCam.update(renderer, envScene);
      envRT = pmrem.fromCubemap(cubeRT.texture, envRT);
      renderer.setRenderTarget(prevTarget);
      targetScene.environment = envRT.texture;
      lastSun.copy(sunDirV); lastNight = night; envDirty = false;
      return true;
    },
    follow(camera) { dome.position.copy(camera.position); },
  };
}
