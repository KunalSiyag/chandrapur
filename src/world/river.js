import * as THREE from 'three';
import { riverCentre, riverHalfWidth, WATER_Y, MOON_HOME } from './layout.js';

/** A continuous reach across one valley. The banks/bed and water use the same
 * centreline; the moon streak follows the viewer's reflected sightline. */
export function createRiver(scene) {
  const uniforms = {
    uTime: { value: 0 }, uMoon: { value: MOON_HOME.clone() },
    uDeep: { value: new THREE.Color('#1b4252') }, uShallow: { value: new THREE.Color('#397170') },
    uGlint: { value: new THREE.Color('#d8d4b4') },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.DoubleSide,
    vertexShader: `
      varying vec3 vWorld; varying vec2 vUv;
      void main(){ vUv=uv; vec4 wp=modelMatrix*vec4(position,1.0); vWorld=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }
    `,
    fragmentShader: `
      uniform float uTime; uniform vec3 uMoon; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uGlint;
      varying vec3 vWorld; varying vec2 vUv;
      void main(){
        float ripple=sin(vWorld.x*1.7+uTime*.65+sin(vWorld.z*1.5))*sin(vWorld.z*3.7-uTime*.4);
        float small=sin(vWorld.x*5.1-vWorld.z*9.0+uTime*.9);
        vec3 col=mix(uDeep,uShallow,.35+.11*ripple);
        vec3 V=normalize(cameraPosition-vWorld);
        vec3 M=normalize(uMoon-vWorld);
        vec3 H=normalize(V+M);
        float spec=pow(max(H.y,0.0),120.0);
        float broken=smoothstep(.08,.7,ripple*.5+small*.23+.25);
        col+=uGlint*spec*broken*.85;
        // A quiet elongated streak remains readable in a moon-facing view.
        vec2 eye=cameraPosition.xz;
        vec2 toward=normalize(uMoon.xz-eye);
        float across=abs(dot(vWorld.xz-eye,vec2(-toward.y,toward.x)));
        float streak=exp(-across*across*.16)*max(0.,dot(V.xz,-M.xz))*broken;
        col+=uGlint*streak*.23;
        float bridge=exp(-pow(vWorld.x+21.,2.)*.1)*smoothstep(.2,1.,small*.5+.5);
        col+=vec3(.16,.1,.03)*bridge;
        col+=vec3(.025,.04,.035)*smoothstep(.75,1.,ripple);
        gl_FragColor=vec4(col,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
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
  const mesh = new THREE.Mesh(geo, mat); mesh.name = 'river'; scene.add(mesh);
  return { mesh, uniforms, update(t, moon) { uniforms.uTime.value = t; uniforms.uMoon.value.copy(moon); } };
}
