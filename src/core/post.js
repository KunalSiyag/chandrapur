import * as THREE from 'three';

// ============================================================
// Filmic render pipeline for Chandrapur:
//   HDR colour (MSAA) -> energy-conserving bloom chain (only the
//   genuinely bright: lamps, sun, moon, glints) -> composite with
//   exposure, AgX tone mapping, a gentle filmic grade (warm
//   highlights / cool shadows), mild vignette and fine grain.
// Exposure, grade and bloom are driven by the day cycle through
// `setDayState`, so nights are darker but stay playable.
// ============================================================

const FS_VERT = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function fsTriangle() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  return g;
}

export function createPost(renderer, scene, camera) {
  const size = new THREE.Vector2();
  const HF = THREE.HalfFloatType;
  const rtColor = new THREE.WebGLRenderTarget(4, 4, { type: HF, samples: 4 });
  rtColor.depthTexture = new THREE.DepthTexture(4, 4, THREE.UnsignedIntType);
  // ambient occlusion at half resolution (raw + blurred ping-pong)
  const rtAO1 = new THREE.WebGLRenderTarget(4, 4, { type: THREE.UnsignedByteType, depthBuffer: false });
  const rtAO2 = new THREE.WebGLRenderTarget(4, 4, { type: THREE.UnsignedByteType, depthBuffer: false });
  const rtB1 = new THREE.WebGLRenderTarget(4, 4, { type: HF });
  const rtB2 = new THREE.WebGLRenderTarget(4, 4, { type: HF });
  const rtB3 = new THREE.WebGLRenderTarget(4, 4, { type: HF });
  const rtB4 = new THREE.WebGLRenderTarget(4, 4, { type: HF });

  const quad = new THREE.Mesh(fsTriangle());
  quad.frustumCulled = false;
  const qScene = new THREE.Scene();
  qScene.add(quad);
  const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // bright pass works on exposed values, so the threshold is in display terms
  const brightMat = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uThreshold: { value: 1.6 }, uKnee: { value: 0.6 }, uExposure: { value: 1 } },
    vertexShader: FS_VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D tSrc; uniform float uThreshold; uniform float uKnee; uniform float uExposure; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(tSrc, vUv).rgb * uExposure;
        float l = max(c.r, max(c.g, c.b));
        float soft = clamp(l - uThreshold + uKnee, 0.0, 2.0*uKnee); soft = soft*soft/(4.0*uKnee+1e-4);
        float w = max(soft, l - uThreshold) / max(l, 1e-4);
        gl_FragColor = vec4(min(c * w, vec3(24.0)), 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });

  const blurMat = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
    vertexShader: FS_VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
      void main(){
        vec3 s = texture2D(tSrc, vUv).rgb * 0.2270270270;
        s += texture2D(tSrc, vUv + uDir*1.3846153846).rgb * 0.3162162162;
        s += texture2D(tSrc, vUv - uDir*1.3846153846).rgb * 0.3162162162;
        s += texture2D(tSrc, vUv + uDir*3.2307692308).rgb * 0.0702702703;
        s += texture2D(tSrc, vUv - uDir*3.2307692308).rgb * 0.0702702703;
        gl_FragColor = vec4(s, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });

  // Screen-space ambient occlusion from the resolved depth: view-space
  // hemisphere samples around a reconstructed normal. It darkens contact
  // creases (eaves, benches on paving, doorways) that the sky light can't see.
  const AO_SAMPLES = 12;
  const kernel = [];
  for (let i = 0; i < AO_SAMPLES; i++) {
    const a = i * 2.399963, z = 0.15 + 0.85 * ((i + 0.5) / AO_SAMPLES);
    const r = Math.sqrt(1 - z * z), scale = 0.25 + 0.75 * Math.pow((i + 1) / AO_SAMPLES, 2);
    kernel.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z).multiplyScalar(scale));
  }
  const aoMat = new THREE.ShaderMaterial({
    defines: { AO_SAMPLES },
    uniforms: {
      tDepth: { value: rtColor.depthTexture }, uProj: { value: new THREE.Matrix4() }, uProjInv: { value: new THREE.Matrix4() },
      uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1.1 }, uKernel: { value: kernel },
    },
    vertexShader: FS_VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D tDepth; uniform mat4 uProj, uProjInv; uniform vec2 uTexel; uniform float uRadius;
      uniform vec3 uKernel[AO_SAMPLES]; varying vec2 vUv;
      vec3 viewPos(vec2 uv, float d){ vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return v.xyz / v.w; }
      vec3 posAt(vec2 uv){ return viewPos(uv, texture2D(tDepth, uv).x); }
      float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      void main(){
        float d = texture2D(tDepth, vUv).x;
        if (d >= 0.99999) { gl_FragColor = vec4(1.0); return; }
        vec3 P = viewPos(vUv, d);
        // normal from the smaller of the one-sided depth differences (robust at edges)
        vec3 l = posAt(vUv - vec2(uTexel.x, 0.0)), r = posAt(vUv + vec2(uTexel.x, 0.0));
        vec3 b = posAt(vUv - vec2(0.0, uTexel.y)), t = posAt(vUv + vec2(0.0, uTexel.y));
        vec3 dx = abs(r.z - P.z) < abs(P.z - l.z) ? r - P : P - l;
        vec3 dy = abs(t.z - P.z) < abs(P.z - b.z) ? t - P : P - b;
        vec3 N = normalize(cross(dx, dy));
        float ang = hash(gl_FragCoord.xy) * 6.2831853;
        vec3 rv = vec3(cos(ang), sin(ang), 0.0);
        vec3 T = normalize(rv - N * dot(rv, N)); vec3 B = cross(N, T);
        float radius = uRadius * (1.0 + clamp(-P.z * 0.02, 0.0, 1.5));
        float occ = 0.0;
        for (int i = 0; i < AO_SAMPLES; i++) {
          vec3 k = uKernel[i];
          vec3 S = P + (T * k.x + B * k.y + N * k.z) * radius;
          vec4 c = uProj * vec4(S, 1.0); vec2 suv = c.xy / c.w * 0.5 + 0.5;
          float sz = posAt(suv).z;
          float range = smoothstep(0.0, 1.0, radius / max(abs(P.z - sz), 1e-3));
          occ += step(S.z + 0.04 + 0.002 * -P.z, sz) * range;
        }
        float ao = 1.0 - occ / float(AO_SAMPLES);
        ao = mix(ao, 1.0, smoothstep(60.0, 140.0, -P.z));
        gl_FragColor = vec4(vec3(ao), 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  // depth-aware separable blur of the AO
  const aoBlurMat = new THREE.ShaderMaterial({
    uniforms: { tAO: { value: null }, tDepth: { value: rtColor.depthTexture }, uDir: { value: new THREE.Vector2() }, uNear: { value: 0.1 }, uFar: { value: 500 } },
    vertexShader: FS_VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D tAO, tDepth; uniform vec2 uDir; uniform float uNear, uFar; varying vec2 vUv;
      float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
      void main(){
        float z0 = lin(texture2D(tDepth, vUv).x);
        float sum = 0.0, wsum = 0.0;
        for (int i = -3; i <= 3; i++) {
          vec2 uv = vUv + uDir * float(i);
          float w = exp(-float(i * i) * 0.18) * exp(-abs(lin(texture2D(tDepth, uv).x) - z0) / (0.05 * z0 + 0.05));
          sum += texture2D(tAO, uv).r * w; wsum += w;
        }
        gl_FragColor = vec4(vec3(sum / max(wsum, 1e-4)), 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });

  const compMat = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: rtColor.texture }, tBloom: { value: rtB2.texture }, tBloom2: { value: rtB4.texture },
      tAO: { value: rtAO1.texture }, uAO: { value: 0.75 },
      tDepth: { value: rtColor.depthTexture }, uProjInv: { value: new THREE.Matrix4() },
      uLightView: { value: new THREE.Vector3(0, 0, -1) }, uHazeCol: { value: new THREE.Color(0, 0, 0) }, uHazeDensity: { value: 0.012 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uBloom: { value: 0.07 }, uGlow: { value: 0.05 }, uExposure: { value: 1.0 },
      uTime: { value: 0 }, uVignette: { value: 0.16 }, uGrain: { value: 0.018 },
      uNight: { value: 0 }, uDusk: { value: 0 }, uSat: { value: 1.06 }, uContrast: { value: 1.04 },
      uWarm: { value: new THREE.Vector3(1.05, 1.0, 0.92) }, uCool: { value: new THREE.Vector3(0.97, 0.99, 1.04) },
    },
    vertexShader: FS_VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D tColor, tBloom, tBloom2, tAO, tDepth; uniform vec2 uRes; uniform mat4 uProjInv;
      uniform vec3 uLightView, uHazeCol; uniform float uHazeDensity;
      uniform float uAO, uBloom, uGlow, uExposure, uTime, uVignette, uGrain, uNight, uDusk, uSat, uContrast;
      uniform vec3 uWarm, uCool; varying vec2 vUv;
      float lum(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }
      float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      vec3 toSRGB(vec3 c){ c = max(c, 0.0); return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
      // ---- AgX (Blender/Filament), as in three.js, linear sRGB in and out
      const mat3 SRGB_TO_2020 = mat3(vec3(0.6274, 0.0691, 0.0164), vec3(0.3293, 0.9195, 0.0880), vec3(0.0433, 0.0113, 0.8956));
      const mat3 R2020_TO_SRGB = mat3(vec3(1.6605, -0.1246, -0.0182), vec3(-0.5876, 1.1329, -0.1006), vec3(-0.0728, -0.0083, 1.1187));
      vec3 agxContrast(vec3 x){ vec3 x2 = x*x; vec3 x4 = x2*x2;
        return 15.5*x4*x2 - 40.14*x4*x + 31.96*x4 - 6.868*x2*x + 0.4298*x2 + 0.1191*x - 0.00232; }
      vec3 agx(vec3 color){
        const mat3 inset = mat3(vec3(0.856627153315983, 0.137318972929847, 0.11189821299995),
          vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903), vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
        const mat3 outset = mat3(vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826),
          vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294), vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
        const float minEv = -12.47393, maxEv = 4.026069;
        color = inset * (SRGB_TO_2020 * color);
        color = clamp((log2(max(color, 1e-10)) - minEv) / (maxEv - minEv), 0.0, 1.0);
        color = agxContrast(color);
        // look: a touch of contrast and saturation around the middle
        color = pow(max(color, 0.0), vec3(uContrast));
        float l = dot(color, vec3(0.2126, 0.7152, 0.0722));
        color = l + uSat * (color - l);
        color = outset * color;
        color = pow(max(vec3(0.0), color), vec3(2.2));
        return clamp(R2020_TO_SRGB * color, 0.0, 1.0);
      }
      void main(){
        vec3 col = texture2D(tColor, vUv).rgb;
        col *= mix(1.0, texture2D(tAO, vUv).r, uAO);
        // forward (Mie) scattering in the dusty air toward the sun / moon:
        // distant geometry near the light picks up a warm veil of glare
        float dz = texture2D(tDepth, vUv).x;
        if (dz < 0.99999) {
          vec4 vp = uProjInv * vec4(vUv * 2.0 - 1.0, dz * 2.0 - 1.0, 1.0);
          vec3 v = vp.xyz / vp.w; float dist = length(v);
          float cosT = max(dot(v / dist, uLightView), 0.0);
          float phase = 0.06 + pow(cosT, 8.0) * 0.6 + pow(cosT, 64.0) * 1.4;
          col += uHazeCol * phase * (1.0 - exp(-dist * uHazeDensity));
        }
        // physically motivated veil: bloom is light that is already there, scattered
        col += (texture2D(tBloom, vUv).rgb * uBloom + texture2D(tBloom2, vUv).rgb * uGlow) / max(uExposure, 1e-3);
        col *= uExposure;
        col = agx(col);
        // filmic grade: warm highlights, cool shadows (night leans cooler)
        float L = lum(col);
        vec3 shadowT = mix(uCool, uCool * vec3(0.97, 0.99, 1.04), uNight);
        vec3 highT = mix(uWarm, vec3(1.06, 1.0, 0.9), uDusk * 0.6);
        col *= mix(shadowT, highT, smoothstep(0.05, 0.6, L));
        // vignette
        vec2 asp = vec2(uRes.x / uRes.y, 1.0);
        vec2 q = (vUv - 0.5) * asp * 0.9;
        col *= 1.0 - uVignette * smoothstep(0.3, 1.0, length(q));
        vec3 outc = toSRGB(col);
        // fine grain, strongest in the mids, plus dither
        float n = hash(vUv * uRes + fract(uTime * 7.31) * 113.0) - 0.5;
        float m = lum(outc);
        outc += n * uGrain * (1.0 - abs(m - 0.45) * 1.2) + (hash(vUv * uRes + 17.0) - 0.5) / 255.0;
        gl_FragColor = vec4(outc, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });

  function setSize(w, h, pr) {
    const W = Math.max(4, Math.floor(w * pr)), H = Math.max(4, Math.floor(h * pr));
    size.set(W, H);
    rtColor.setSize(W, H);
    const aw = Math.max(4, W >> 1), ah = Math.max(4, H >> 1);
    rtAO1.setSize(aw, ah); rtAO2.setSize(aw, ah);
    aoMat.uniforms.uTexel.value.set(1 / W, 1 / H);
    const bw = Math.max(4, W >> 2), bh = Math.max(4, H >> 2);
    rtB1.setSize(bw, bh); rtB2.setSize(bw, bh);
    rtB3.setSize(Math.max(4, W >> 4), Math.max(4, H >> 4));
    rtB4.setSize(Math.max(4, W >> 4), Math.max(4, H >> 4));
    compMat.uniforms.uRes.value.set(W, H);
  }

  function pass(mat, target) {
    quad.material = mat;
    renderer.setRenderTarget(target);
    renderer.render(qScene, qCam);
  }

  const renderStats = { calls: 0, triangles: 0 };
  const _v = new THREE.Vector3();
  let aoEnabled = true, aoStrength = 0.85;

  // `leakPos` is accepted for API compatibility; the filmic pipeline lets
  // bloom alone carry the sun's and moon's glare.
  function render(scene, camera, leakPos, t) {
    const oldAutoReset = renderer.info.autoReset;
    renderer.info.autoReset = false;
    renderer.info.reset();
    // 1. HDR colour pass — all layers
    camera.layers.enableAll();
    renderer.setRenderTarget(rtColor);
    renderer.setClearColor(0x000000, 1.0);
    renderer.clear();
    renderer.render(scene, camera);
    // 2. ambient occlusion (half res) + depth-aware blur
    if (aoEnabled) {
      aoMat.uniforms.uProj.value.copy(camera.projectionMatrix);
      aoMat.uniforms.uProjInv.value.copy(camera.projectionMatrixInverse);
      aoBlurMat.uniforms.uNear.value = camera.near; aoBlurMat.uniforms.uFar.value = camera.far;
      pass(aoMat, rtAO1);
      aoBlurMat.uniforms.tAO.value = rtAO1.texture; aoBlurMat.uniforms.uDir.value.set(1 / rtAO1.width, 0); pass(aoBlurMat, rtAO2);
      aoBlurMat.uniforms.tAO.value = rtAO2.texture; aoBlurMat.uniforms.uDir.value.set(0, 1 / rtAO1.height); pass(aoBlurMat, rtAO1);
    }
    compMat.uniforms.uAO.value = aoEnabled ? aoStrength : 0;
    // 3. bloom chain (quarter + sixteenth resolution)
    brightMat.uniforms.uExposure.value = compMat.uniforms.uExposure.value;
    brightMat.uniforms.tSrc.value = rtColor.texture; pass(brightMat, rtB1);
    blurMat.uniforms.tSrc.value = rtB1.texture; blurMat.uniforms.uDir.value.set(1 / rtB1.width, 0); pass(blurMat, rtB2);
    blurMat.uniforms.tSrc.value = rtB2.texture; blurMat.uniforms.uDir.value.set(0, 1 / rtB1.height); pass(blurMat, rtB1);
    blurMat.uniforms.tSrc.value = rtB1.texture; blurMat.uniforms.uDir.value.set(1.5 / rtB1.width, 0); pass(blurMat, rtB2);
    blurMat.uniforms.tSrc.value = rtB2.texture; blurMat.uniforms.uDir.value.set(1 / rtB3.width, 0); pass(blurMat, rtB3);
    blurMat.uniforms.tSrc.value = rtB3.texture; blurMat.uniforms.uDir.value.set(0, 1 / rtB3.height); pass(blurMat, rtB4);
    blurMat.uniforms.tSrc.value = rtB4.texture; blurMat.uniforms.uDir.value.set(1.6 / rtB3.width, 0); pass(blurMat, rtB3);
    blurMat.uniforms.tSrc.value = rtB3.texture; blurMat.uniforms.uDir.value.set(0, 1.6 / rtB3.height); pass(blurMat, rtB4);
    // 4. composite: exposure, AgX, grade, vignette, grain
    compMat.uniforms.uTime.value = t;
    compMat.uniforms.uProjInv.value.copy(camera.projectionMatrixInverse);
    if (leakPos) {
      _v.copy(leakPos).sub(camera.position).normalize().transformDirection(camera.matrixWorldInverse);
      compMat.uniforms.uLightView.value.copy(_v);
    }
    pass(compMat, null);
    renderStats.calls = renderer.info.render.calls;
    renderStats.triangles = renderer.info.render.triangles;
    renderer.info.autoReset = oldAutoReset;
  }

  const ev = (stops) => Math.pow(2, stops);
  return {
    render,
    setSize,
    compMat,
    renderStats,
    get renderer() { return renderer; },
    setBloom({ strength, radius, threshold }) {
      if (strength !== undefined) compMat.uniforms.uBloom.value = strength;
      if (radius !== undefined) compMat.uniforms.uGlow.value = radius;
      if (threshold !== undefined) brightMat.uniforms.uThreshold.value = threshold;
    },
    get composer() { return null; },
    /** Toggle / scale screen-space ambient occlusion (perf knob). */
    setAO({ enabled, strength } = {}) {
      if (enabled !== undefined) aoEnabled = !!enabled;
      if (strength !== undefined) aoStrength = strength;
    },
    /** Exposure and grade for the hour: brighter-exposed dusk and night, like an eye adapting. */
    setDayState({ night, dusk, sunElev = 0.5, haze }) {
      const u = compMat.uniforms, day = 1 - night;
      if (haze) u.uHazeCol.value.copy(haze);
      u.uNight.value = night; u.uDusk.value = dusk;
      // EV offsets: noon 0, low sun +0.6, blue hour +2.2, deep night +3.3
      const low = 1 - THREE.MathUtils.smoothstep(sunElev, 0.05, 0.45);
      u.uExposure.value = 0.58 * ev(0.8 * low * day + THREE.MathUtils.lerp(0, 2.3, Math.pow(night, 1.3)));
      u.uVignette.value = THREE.MathUtils.lerp(0.14, 0.24, night);
      u.uSat.value = THREE.MathUtils.lerp(1.28, 0.9, night);
      u.uContrast.value = THREE.MathUtils.lerp(1.16, 1.06, night);
      u.uGrain.value = THREE.MathUtils.lerp(0.016, 0.026, night);
      u.uBloom.value = THREE.MathUtils.lerp(0.06, 0.09, night);
      u.uGlow.value = THREE.MathUtils.lerp(0.04, 0.08, night);
      brightMat.uniforms.uThreshold.value = THREE.MathUtils.lerp(1.6, 1.15, night);
    },
  };
}
