import * as THREE from 'three';
import { riverCentre, riverHalfWidth, WATER_Y, MOON_HOME } from './layout.js';

/** A continuous reach across one valley. The banks/bed and water use the same
 * centreline. The water is a smooth dielectric: its colour is the silty body
 * (dark, slightly green), its brightness is the sky it reflects through the
 * environment map, with Fresnel doing the rest. Animated ripple normals
 * break up the reflection, and the sun/moon key glints in the broken water.
 * At night a long moon path follows the viewer's reflected sightline. */
export function createRiver(scene) {
  const uniforms = {
    uTime: { value: 0 }, uMoon: { value: MOON_HOME.clone() },
    uDeep: { value: new THREE.Color('#22322c') }, uShallow: { value: new THREE.Color('#4a5a46') },
    uGlint: { value: new THREE.Color('#d8d4b4') }, uMoonPath: { value: 0 },
  };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.09, metalness: 0, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWWorld; varying vec2 vWUv;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWWorld = (modelMatrix * vec4(transformed, 1.0)).xyz; vWUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime, uMoonPath; uniform vec3 uMoon, uDeep, uShallow, uGlint;
        varying vec3 vWWorld; varying vec2 vWUv;
        // sum of travelling waves: height derivative only (for normals)
        vec2 waveGrad(vec2 p, float t){
          vec2 g = vec2(0.0);
          vec2 d1 = normalize(vec2(1.0, 0.25)), d2 = normalize(vec2(0.7, -0.6)), d3 = normalize(vec2(-0.3, 1.0)), d4 = normalize(vec2(0.9, 0.45));
          g += d1 * cos(dot(p, d1) * 2.4 - t * 1.3) * 0.016;
          g += d2 * cos(dot(p, d2) * 4.3 - t * 1.9) * 0.014;
          g += d3 * cos(dot(p, d3) * 7.9 - t * 2.6) * 0.011;
          g += d4 * cos(dot(p, d4) * 13.1 - t * 3.4) * 0.009;
          // slow broad swell across the current
          g += vec2(0.3, 1.0) * cos(p.x * 0.35 + p.y * 1.1 - t * 0.5) * 0.012;
          return g;
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float edge = abs(vWUv.y - 0.5) * 2.0;
        diffuseColor.rgb = mix(uDeep, uShallow, smoothstep(0.55, 1.0, edge) * 0.8);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec2 g = waveGrad(vWWorld.xz, uTime);
          // fade fine ripples with distance so the far water stays a mirror, not noise
          float far = smoothstep(15.0, 90.0, length(cameraPosition - vWWorld));
          g *= mix(1.0, 0.3, far);
          vec3 nW = normalize(vec3(-g.x, 1.0, -g.y));
          normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          // moon path on the water at night (uGlint is cool at night, the sun's tint by day)
          vec3 V = normalize(cameraPosition - vWWorld);
          vec3 M = normalize(uMoon - vWWorld);
          vec2 eye = cameraPosition.xz;
          vec2 toward = normalize(uMoon.xz - eye);
          float across = abs(dot(vWWorld.xz - eye, vec2(-toward.y, toward.x)));
          float ripple = sin(vWWorld.x * 1.7 + uTime * 0.65 + sin(vWWorld.z * 1.5)) * sin(vWWorld.z * 3.7 - uTime * 0.4);
          float small = sin(vWWorld.x * 5.1 - vWWorld.z * 9.0 + uTime * 0.9);
          float broken = smoothstep(0.25, 0.85, ripple * 0.5 + small * 0.25 + 0.3);
          // a real moon path is only seen at glancing angles
          float graze = pow(clamp(1.0 - V.y, 0.0, 1.0), 4.0);
          float streak = exp(-across * across * 0.12) * max(0.0, dot(normalize(V.xz), -normalize(M.xz))) * broken * graze;
          totalEmissiveRadiance += uGlint * streak * 0.05 * uMoonPath;
        }`);
  };
  mat.customProgramCacheKey = () => 'river-pbr';
  const vertices = [], uvs = [], indices = [], n = 228;
  for (let i = 0; i <= n; i++) {
    const x = -114 + i;
    for (const side of [-1, 1]) {
      vertices.push(x, WATER_Y, riverCentre(x) + side * (riverHalfWidth(x) + 0.5));
      uvs.push(i / n, side < 0 ? 0 : 1);
    }
    if (i < n) { const k = i * 2; indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.setIndex(indices); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat); mesh.name = 'river'; mesh.receiveShadow = true; scene.add(mesh);
  return { mesh, uniforms, update(t, moon) { uniforms.uTime.value = t; uniforms.uMoon.value.copy(moon); } };
}
