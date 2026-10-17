import * as THREE from 'three';

// ============================================================
// Night render pipeline for Chandpur — adapted from the
// screen-space-ink technique pioneered by Sakura Crossing
// (normal+depth pre-pass -> HDR colour -> bloom chain ->
// composite with colour-aware ink lines, cool-shadow grade,
// and a light leak that here follows the MOON instead of the
// sun). Layer 1 = decorative glows the ink pass must ignore.
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
  const rtND = new THREE.WebGLRenderTarget(4, 4, { type: HF, samples: 0, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const rtB1 = new THREE.WebGLRenderTarget(4, 4, { type: HF });
  const rtB2 = new THREE.WebGLRenderTarget(4, 4, { type: HF });
  const rtB3 = new THREE.WebGLRenderTarget(4, 4, { type: HF });
  const rtB4 = new THREE.WebGLRenderTarget(4, 4, { type: HF });

  // normal + linear depth override material (instancing + skinning through chunks)
  const ndMat = new THREE.ShaderMaterial({
    uniforms: { uFar: { value: 500 } },
    vertexShader: /* glsl */`
      #include <common>
      #include <skinning_pars_vertex>
      varying vec3 vN; varying float vD;
      void main(){
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <defaultnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        #include <project_vertex>
        vN = normalize(transformedNormal); vD = -mvPosition.z;
      }`,
    fragmentShader: /* glsl */`
      uniform float uFar; varying vec3 vN; varying float vD;
      void main(){ vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n; gl_FragColor = vec4(n*0.5+0.5, vD/uFar); }`,
    side: THREE.DoubleSide,
  });

  const quad = new THREE.Mesh(fsTriangle());
  quad.frustumCulled = false;
  const qScene = new THREE.Scene();
  qScene.add(quad);
  const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const brightMat = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uThreshold: { value: 0.72 }, uKnee: { value: 0.35 } },
    vertexShader: FS_VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D tSrc; uniform float uThreshold; uniform float uKnee; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(tSrc, vUv).rgb;
        float l = max(c.r, max(c.g, c.b));
        float soft = clamp(l - uThreshold + uKnee, 0.0, 2.0*uKnee); soft = soft*soft/(4.0*uKnee+1e-4);
        float w = max(soft, l - uThreshold) / max(l, 1e-4);
        gl_FragColor = vec4(min(c * w, vec3(8.0)), 1.0);
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

  const compMat = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: rtColor.texture }, tND: { value: rtND.texture },
      tBloom: { value: rtB2.texture }, tBloom2: { value: rtB4.texture },
      uRes: { value: new THREE.Vector2(1, 1) }, uFar: { value: 500 }, uPx: { value: 1.0 },
      uOutline: { value: 1.0 }, uLine: { value: new THREE.Color('#2a2740') },
      uBloom: { value: 0.42 }, uGlow: { value: 0.16 }, uExposure: { value: 1.06 },
      uMoonScreen: { value: new THREE.Vector3(0.5, 0.8, 0) }, uLeak: { value: 1.0 },
      uTime: { value: 0 }, uVignette: { value: 0.26 }, uNight: { value: 1 }, uDusk: { value: 0 }, uKnee: { value: 0.78 }, uSat: { value: 1.07 },
    },
    vertexShader: FS_VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D tColor, tND, tBloom, tBloom2; uniform vec2 uRes; uniform float uFar, uPx, uOutline, uBloom, uGlow, uExposure, uLeak, uTime, uVignette, uNight, uDusk, uKnee, uSat;
      uniform vec3 uLine; uniform vec3 uMoonScreen; varying vec2 vUv;
      vec4 nd(vec2 uv){ return texture2D(tND, uv); }
      float lum(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }
      vec3 softClip(vec3 c){ vec3 k = vec3(uKnee); vec3 over = max(c - k, 0.0); return min(c, k) + (1.0-k) * (1.0 - exp(-over/(1.0-k))); }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      vec3 toSRGB(vec3 c){ c = max(c, 0.0); return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
      void main(){
        vec2 px = uPx / uRes;
        vec3 col = texture2D(tColor, vUv).rgb;
        // ---------- ink: inverse-depth laplacian + normal discontinuity
        vec4 c0 = nd(vUv);
        float d0 = c0.a * uFar;
        vec4 cl = nd(vUv - vec2(px.x,0.0)), cr = nd(vUv + vec2(px.x,0.0)), cu = nd(vUv + vec2(0.0,px.y)), cd = nd(vUv - vec2(0.0,px.y));
        float i0 = 1.0/max(d0,0.05);
        float il = 1.0/max(cl.a*uFar,0.05), ir = 1.0/max(cr.a*uFar,0.05), iu = 1.0/max(cu.a*uFar,0.05), idn = 1.0/max(cd.a*uFar,0.05);
        float lapX = abs(il + ir - 2.0*i0) / i0, lapY = abs(iu + idn - 2.0*i0) / i0;
        float dEdge = smoothstep(0.06, 0.18, max(lapX, lapY));
        float dmin = min(min(cl.a,cr.a),min(cu.a,cd.a))*uFar;
        dEdge = max(dEdge, smoothstep(0.10, 0.25, (d0 - dmin)/max(dmin,0.05)));
        vec3 n0 = c0.rgb*2.0-1.0;
        float nEdge = 0.0;
        nEdge = max(nEdge, 1.0 - dot(n0, cl.rgb*2.0-1.0));
        nEdge = max(nEdge, 1.0 - dot(n0, cr.rgb*2.0-1.0));
        nEdge = max(nEdge, 1.0 - dot(n0, cu.rgb*2.0-1.0));
        nEdge = max(nEdge, 1.0 - dot(n0, cd.rgb*2.0-1.0));
        nEdge = smoothstep(0.30, 0.65, nEdge);
        float dNear = min(d0, dmin);
        float fade = 1.0 - smoothstep(35.0, 190.0, dNear);
        float edge = max(dEdge, nEdge * 0.85) * fade * uOutline;
        vec3 lineCol = mix(col * vec3(0.40, 0.36, 0.52), uLine, 0.35);
        col = mix(col, lineCol, edge * 0.82);
        // ---------- bloom & wide glow
        col += texture2D(tBloom, vUv).rgb * uBloom + texture2D(tBloom2, vUv).rgb * uGlow;
        // ---------- exposure / night grade
        col *= uExposure;
        col = softClip(col);
        float L = lum(col);
        // night: indigo shadows, warm-paper highlights; day: sunlit, saturated
        col = mix(col, col * vec3(0.86, 0.90, 1.16), (1.0 - smoothstep(0.06, 0.5, L)) * 0.6 * uNight);
        col = mix(col, col * vec3(0.94, 0.97, 1.08), (1.0 - smoothstep(0.04, 0.35, L)) * 0.5 * (1.0 - uNight));
        col += vec3(0.024, 0.012, -0.014) * smoothstep(0.5, 1.0, L) * (uNight + uDusk);
        col *= mix(vec3(1.0), vec3(1.08, 0.97, 0.88), uDusk * 0.6);
        col = mix(vec3(lum(col)), col, uSat);
        // ---------- moonlight leak from the moon's screen side
        vec2 asp = vec2(uRes.x/uRes.y, 1.0);
        vec2 sp = uMoonScreen.xy;
        float ds = length((vUv - sp) * asp);
        float leak = exp(-ds*ds*1.8) * 0.10 + exp(-ds*ds*10.0) * 0.10 * uMoonScreen.z;
        col += mix(vec3(1.0, 0.9, 0.72), vec3(1.0, 0.86, 0.6), 1.0 - uNight) * leak * uLeak * (0.55 + 0.45*uMoonScreen.z) * mix(0.7, 1.0, uNight);
        // ---------- vignette + dither
        vec2 q = (vUv - 0.5) * asp * 0.9;
        col *= 1.0 - uVignette * smoothstep(0.35, 1.05, length(q));
        vec3 outc = toSRGB(col);
        outc += (hash(vUv * uRes + fract(uTime)) - 0.5) / 255.0;
        gl_FragColor = vec4(outc, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });

  function setSize(w, h, pr) {
    const W = Math.max(4, Math.floor(w * pr)), H = Math.max(4, Math.floor(h * pr));
    size.set(W, H);
    rtColor.setSize(W, H);
    rtND.setSize(W, H);
    const bw = Math.max(4, W >> 2), bh = Math.max(4, H >> 2);
    rtB1.setSize(bw, bh); rtB2.setSize(bw, bh);
    rtB3.setSize(Math.max(4, W >> 4), Math.max(4, H >> 4));
    rtB4.setSize(Math.max(4, W >> 4), Math.max(4, H >> 4));
    compMat.uniforms.uRes.value.set(W, H);
    compMat.uniforms.uPx.value = Math.max(1.0, H / 1100);
  }

  function pass(mat, target) {
    quad.material = mat;
    renderer.setRenderTarget(target);
    renderer.render(qScene, qCam);
  }

  const _v = new THREE.Vector3();
  const clearND = new THREE.Color(0.5, 0.5, 1.0);
  const renderStats = { calls: 0, triangles: 0 };

  function render(scene, camera, moonPos, t) {
    const oldAutoReset = renderer.info.autoReset;
    renderer.info.autoReset = false;
    renderer.info.reset();
    const updateShadows = renderer.shadowMap.needsUpdate;
    // 1. normal + depth pre-pass — layer 0 only, no fog, no sky
    ndMat.uniforms.uFar.value = camera.far;
    compMat.uniforms.uFar.value = camera.far;
    const bg = scene.background, fog = scene.fog;
    scene.background = null; scene.fog = null;
    scene.overrideMaterial = ndMat;
    renderer.shadowMap.autoUpdate = false;
    // Never bake the ND override into the shadow atlas. Only the colour pass
    // refreshes it, at the application's requested cadence.
    renderer.shadowMap.needsUpdate = false;
    camera.layers.set(0);
    renderer.setRenderTarget(rtND);
    renderer.setClearColor(clearND, 1.0);
    renderer.clear();
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    scene.background = bg; scene.fog = fog;
    // 2. colour pass — all layers
    camera.layers.enableAll();
    renderer.shadowMap.needsUpdate = updateShadows;
    renderer.setRenderTarget(rtColor);
    renderer.setClearColor(0x070b1a, 1.0);
    renderer.clear();
    renderer.render(scene, camera);
    // 3. bloom chain
    brightMat.uniforms.tSrc.value = rtColor.texture; pass(brightMat, rtB1);
    blurMat.uniforms.tSrc.value = rtB1.texture; blurMat.uniforms.uDir.value.set(1 / rtB1.width, 0); pass(blurMat, rtB2);
    blurMat.uniforms.tSrc.value = rtB2.texture; blurMat.uniforms.uDir.value.set(0, 1 / rtB1.height); pass(blurMat, rtB1);
    blurMat.uniforms.tSrc.value = rtB1.texture; blurMat.uniforms.uDir.value.set(1.5 / rtB1.width, 0); pass(blurMat, rtB2);
    blurMat.uniforms.tSrc.value = rtB2.texture; blurMat.uniforms.uDir.value.set(1 / rtB3.width, 0); pass(blurMat, rtB3);
    blurMat.uniforms.tSrc.value = rtB3.texture; blurMat.uniforms.uDir.value.set(0, 1 / rtB3.height); pass(blurMat, rtB4);
    blurMat.uniforms.tSrc.value = rtB4.texture; blurMat.uniforms.uDir.value.set(1.6 / rtB3.width, 0); pass(blurMat, rtB3);
    blurMat.uniforms.tSrc.value = rtB3.texture; blurMat.uniforms.uDir.value.set(0, 1.6 / rtB3.height); pass(blurMat, rtB4);
    // 4. composite — the leak follows the moon
    _v.copy(moonPos).sub(camera.position);
    const dist = _v.length();
    _v.multiplyScalar(1000 / Math.max(dist, 1e-4)).add(camera.position).project(camera);
    const inFront = _v.z < 1 ? 1 : 0;
    const sx = _v.x * 0.5 + 0.5, sy = _v.y * 0.5 + 0.5;
    compMat.uniforms.uMoonScreen.value.set(
      inFront ? THREE.MathUtils.clamp(sx, -0.3, 1.3) : (sx < 0.5 ? 1.4 : -0.4),
      inFront ? THREE.MathUtils.clamp(sy, -0.2, 1.3) : 1.2,
      inFront,
    );
    compMat.uniforms.uLeak.value = inFront ? 1.0 : 0.25;
    compMat.uniforms.uTime.value = t;
    pass(compMat, null);
    renderStats.calls = renderer.info.render.calls;
    renderStats.triangles = renderer.info.render.triangles;
    renderer.info.autoReset = oldAutoReset;
  }

  return {
    render,
    setSize,
    compMat,
    renderStats,
    setBloom({ strength, radius, threshold }) {
      if (strength !== undefined) compMat.uniforms.uBloom.value = strength;
      if (radius !== undefined) compMat.uniforms.uGlow.value = radius;
      if (threshold !== undefined) brightMat.uniforms.uThreshold.value = threshold;
    },
    get composer() { return null; },
    setDayState({ night, dusk }) {
      const u = compMat.uniforms, day = 1 - night;
      u.uNight.value = night; u.uDusk.value = dusk;
      u.uExposure.value = THREE.MathUtils.lerp(1.06, 1.0, day);
      u.uVignette.value = THREE.MathUtils.lerp(0.26, 0.14, day);
      u.uKnee.value = THREE.MathUtils.lerp(0.78, 0.86, day);
      u.uSat.value = THREE.MathUtils.lerp(1.07, 1.1, day);
      u.uBloom.value = THREE.MathUtils.lerp(0.42, 0.18, day);
      u.uGlow.value = THREE.MathUtils.lerp(0.16, 0.08, day);
      brightMat.uniforms.uThreshold.value = THREE.MathUtils.lerp(0.72, 1.05, day);
    },
  };
}
