import * as THREE from 'three';

/**
 * The painted sky over Chandpur. One dome blends a bright Indian-summer day
 * (deep blue zenith, milky horizon, cel-shaded cumulus), a saffron dusk and
 * the original starry night. The day cycle drives it through `setState`.
 */
export function createSky(scene) {
  const stars = makeStarTexture();
  const lin = (hex) => new THREE.Color(hex);
  const uniforms = {
    uSunDir: { value: new THREE.Vector3(0.4, 0.6, 0.3).normalize() },
    uMoonDir: { value: new THREE.Vector3(0.4, 0.3, 0.8).normalize() },
    uNight: { value: 0 }, uDusk: { value: 0 }, uTime: { value: 0 },
    tStars: { value: stars },
    uDayZenith: { value: lin('#2f86d6') }, uDayHorizon: { value: lin('#bfe4f4') },
    uDuskZenith: { value: lin('#46508e') }, uDuskHorizon: { value: lin('#ff9a52') },
    uNightZenith: { value: lin('#05070f') }, uNightHorizon: { value: lin('#121c3e') },
    uSunColor: { value: lin('#fff3d0') },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: /* glsl */`
      varying vec3 vDir; varying vec2 vUv;
      void main(){ vUv = uv; vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uSunDir, uMoonDir; uniform float uNight, uDusk, uTime; uniform sampler2D tStars;
      uniform vec3 uDayZenith, uDayHorizon, uDuskZenith, uDuskHorizon, uNightZenith, uNightHorizon, uSunColor;
      varying vec3 vDir; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a*noise(p); p = p*2.03 + 17.0; a *= 0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.2, 1.0);
        float up = pow(clamp(h, 0.0, 1.0), 0.55);
        vec3 day = mix(uDayHorizon, uDayZenith, up);
        // warm sunrise/sunset band, strongest toward the sun
        float sunSide = pow(max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0), 3.0);
        vec3 dusk = mix(mix(uDuskHorizon, vec3(0.85, 0.42, 0.45), 1.0 - sunSide), uDuskZenith, smoothstep(0.0, 0.55, h));
        vec3 night = texture2D(tStars, vUv).rgb;
        vec3 col = mix(day, dusk, uDusk);
        col = mix(col, night, uNight);
        // sun disc + bloom halo
        float sd = dot(d, uSunDir);
        float disc = smoothstep(0.9988, 0.9993, sd);
        float halo = pow(max(sd, 0.0), 220.0) * 0.9 + pow(max(sd, 0.0), 12.0) * 0.18;
        col += uSunColor * (disc * 6.0 + halo) * (1.0 - uNight);
        // cel-shaded cumulus drifting over the valley
        if (d.y > 0.0) {
          vec2 cp = d.xz / (d.y + 0.12) * 1.6 + vec2(uTime * 0.012, uTime * 0.004);
          float n = fbm(cp * 0.9);
          float cover = smoothstep(0.52, 0.56, n);
          float shade = smoothstep(0.56, 0.68, fbm(cp * 0.9 + vec2(0.06, 0.09)));
          vec3 cloudLit = mix(vec3(1.0, 0.99, 0.96), vec3(1.0, 0.72, 0.52), uDusk);
          vec3 cloudShade = mix(vec3(0.70, 0.78, 0.90), vec3(0.62, 0.45, 0.58), uDusk);
          vec3 cloud = mix(cloudLit, cloudShade, shade * 0.75);
          cloud = mix(cloud, vec3(0.05, 0.07, 0.13), uNight * 0.92);
          float fade = smoothstep(0.0, 0.18, d.y);
          col = mix(col, cloud, cover * fade * (1.0 - uNight * 0.6));
        }
        // ground haze below the horizon
        col = mix(col, mix(uDayHorizon * 0.9, uNightHorizon, uNight), smoothstep(0.0, -0.15, d.y));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(238, 48, 28), material);
  dome.name = 'sky-dome';
  dome.renderOrder = -1;
  scene.add(dome);
  return {
    dome,
    setState({ sunDir, moonDir, night, dusk, time }) {
      uniforms.uSunDir.value.copy(sunDir);
      if (moonDir) uniforms.uMoonDir.value.copy(moonDir);
      uniforms.uNight.value = night; uniforms.uDusk.value = dusk; uniforms.uTime.value = time;
    },
    follow(camera) { dome.position.copy(camera.position); },
  };
}

function makeStarTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#05070f');
  grad.addColorStop(0.42, '#0a1130');
  grad.addColorStop(0.52, '#121c3e');
  grad.addColorStop(0.60, '#0a1130');
  grad.addColorStop(1.0, '#080d22');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 260; i++) {
    const x = ((i * 197.63 + 17) % 1024), y = ((i * 89.73 + 13) % 205) + 10;
    const alpha = 0.2 + (i % 5) * 0.09;
    ctx.fillStyle = `rgba(228,232,236,${alpha})`;
    ctx.beginPath(); ctx.arc(x, y, i % 9 === 0 ? 1.0 : 0.55, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
