import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonMaterial } from '../core/toon.js';
import { shrubGeometry } from './foliage.js';
import { LOCAL as C, group, mesh, box, cylinder, sphere, beam, flat, seeded, footprint, roundFootprint, compact } from './build-kit.js';
import { textSign } from './props.js';

// Village and farm generators. Local coordinates, origin at ground contact,
// fronts face +Z. Crops are instanced and sway together in one breeze.

export const breeze = { value: 0 };
const swayCache = new Map();

/** Rough PBR foliage material whose vertices bend with height in the shared breeze. */
export function swayMaterial(color = '#ffffff', { amp = 0.05, vertexColors = true } = {}) {
  const key = `${color}|${amp}|${vertexColors}`;
  if (swayCache.has(key)) return swayCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.8, metalness: 0, vertexColors, side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uBreeze = breeze; shader.uniforms.uAmp = { value: amp };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uBreeze; uniform float uAmp;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 swayAt = vec3(0.0);
        #ifdef USE_INSTANCING
          swayAt = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #endif
        swayAt += (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float bendH = max(position.y, 0.0);
        float gust = sin(uBreeze * 1.6 + swayAt.x * 0.33 + swayAt.z * 0.21) * 0.65 + sin(uBreeze * 2.7 + swayAt.x * 0.8 - swayAt.z * 0.4) * 0.25;
        transformed.x += gust * uAmp * bendH * bendH;
        transformed.z += gust * uAmp * 0.45 * bendH * bendH;`);
    // foliage cards light evenly from both sides (no back-face darkening)
    shader.fragmentShader = shader.fragmentShader.replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;')
      // sun-faded field colours, same treatment as the weathered surfaces
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, 0.82) * 0.92;`);
  };
  m.customProgramCacheKey = () => `sway-${amp}-${vertexColors}`;
  swayCache.set(key, m);
  return m;
}

/** Paint a vertex colour onto a geometry so differently coloured parts merge. */
export function tint(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}
const T = (geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = null) => {
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
  if (s) m.scale(new THREE.Vector3(...s));
  m.setPosition(x, y, z); geo.applyMatrix4(m); return geo;
};

// ------------------------------------------------------------------ crop plants (one merged geometry each)
// Low-poly "cards": every blade is one tapered triangle, every flower or
// grain head a flat diamond, drawn double-sided. A clump is 5–25 triangles,
// so whole fields of them stay cheap.
function blade(x, z, h, w, lean, yaw, color, curl = 0) {
  const tx = x + Math.sin(yaw) * lean * h, tz = z + Math.cos(yaw) * lean * h;
  const px = Math.cos(yaw) * w / 2, pz = -Math.sin(yaw) * w / 2;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([x - px, 0, z - pz, x + px, 0, z + pz, tx + curl * px, h, tz + curl * pz], 3));
  g.computeVertexNormals();
  return tint(g, color);
}
function diamond(x, y, z, w, h, yaw, color) {
  const px = Math.cos(yaw) * w / 2, pz = -Math.sin(yaw) * w / 2;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    x, y - h / 2, z, x + px, y, z + pz, x, y + h / 2, z,
    x, y - h / 2, z, x, y + h / 2, z, x - px, y, z - pz,
  ], 3));
  g.computeVertexNormals();
  return tint(g, color);
}
const cropGeoCache = new Map();
export function cropGeometry(kind) {
  if (cropGeoCache.has(kind)) return cropGeoCache.get(kind);
  const parts = [];
  const golden = 2.399963;
  if (kind === 'wheat') {
    for (let i = 0; i < 7; i++) {
      const a = i * golden, r = 0.03 + (i % 3) * 0.02, h = 0.78 + (i % 3) * 0.1, lean = 0.08 + (i % 2) * 0.06;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      parts.push(blade(x, z, h, 0.035, lean, a, i % 2 ? '#c9a23a' : '#b8933a'));
      parts.push(diamond(x + Math.sin(a) * lean * h, h + 0.04, z + Math.cos(a) * lean * h, 0.06, 0.2, a + 1.2, '#f2cd62'));
    }
    for (let i = 0; i < 3; i++) parts.push(blade(0, 0, 0.42, 0.06, 0.45, i * 2.1, '#a8a048'));
  } else if (kind === 'mustard') {
    parts.push(blade(0, 0, 0.98, 0.05, 0.02, 0, '#4f9a34'), blade(0, 0, 0.98, 0.05, 0.02, Math.PI / 2, '#4f9a34'));
    for (let i = 0; i < 4; i++) parts.push(blade(0, 0, 0.42 + i * 0.05, 0.14, 0.5, i * 1.6, i % 2 ? '#5aa83a' : '#66b444', 0.6));
    for (let i = 0; i < 8; i++) {
      const a = i * golden, r = i ? 0.04 + (i % 3) * 0.035 : 0;
      parts.push(diamond(Math.cos(a) * r, 0.92 + (i % 4) * 0.05, Math.sin(a) * r, 0.12, 0.11, a, i % 2 ? '#fff04a' : '#ffe100'));
    }
  } else if (kind === 'sugarcane') {
    const stalk = new THREE.CylinderGeometry(0.032, 0.038, 2.5, 3, 1, true); stalk.translate(0, 1.25, 0);
    parts.push(tint(stalk, '#8a9a3c'));
    for (let i = 0; i < 6; i++) parts.push(blade(0, 0, 1.1, 0.08, 0.75, i * 1.1, i % 2 ? '#4f9e35' : '#62b23f').translate(0, 1.6 + (i % 3) * 0.3, 0));
  } else if (kind === 'marigold-bush') {
    parts.push(tint(T(new THREE.IcosahedronGeometry(0.24, 0), 0, 0.24, 0, 0, 0, 0, [1, 0.8, 1]), '#3f8a35'));
  } else if (kind === 'marigold-flowers') {
    for (let i = 0; i < 6; i++) {
      const a = i * golden, r = 0.08 + (i % 2) * 0.08;
      parts.push(tint(T(new THREE.OctahedronGeometry(0.065, 0), Math.cos(a) * r, 0.38 + (i % 3) * 0.04, Math.sin(a) * r), '#ffffff'));
    }
  } else if (kind === 'cabbage') {
    parts.push(tint(T(new THREE.IcosahedronGeometry(0.17, 0), 0, 0.15, 0, 0, 0, 0, [1, 0.8, 1]), '#a6d672'));
    for (let i = 0; i < 4; i++) parts.push(blade(0, 0, 0.22, 0.22, 0.9, i * 1.57 + 0.4, '#5fa548'));
  } else if (kind === 'rice' || kind === 'rice-young') {
    const h = kind === 'rice' ? 0.62 : 0.34, n = kind === 'rice' ? 8 : 5;
    for (let i = 0; i < n; i++) parts.push(blade(0, 0, h * (0.85 + (i % 3) * 0.1), 0.035, 0.22 + (i % 2) * 0.14, i * golden, i % 3 ? '#7fd34a' : '#5fbf3a'));
    if (kind === 'rice') for (let i = 0; i < 2; i++) parts.push(diamond(Math.cos(i * 3) * 0.1, h + 0.02, Math.sin(i * 3) * 0.1, 0.05, 0.16, i * 1.7, '#d9cf62'));
  } else if (kind === 'banana') {
    parts.push(tint(T(new THREE.CylinderGeometry(0.09, 0.14, 1.9, 6), 0, 0.95, 0), '#7a9a4a'));
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9;
      const leaf = T(new THREE.BoxGeometry(0.42, 0.012, 1.6), 0, 0, 0.8);
      T(leaf, 0, 0, 0, -0.55 - (i % 3) * 0.2, a, 0);
      T(leaf, 0, 1.85, 0);
      parts.push(tint(leaf, i % 2 ? '#5fbf45' : '#4aa63a'));
    }
  } else if (kind === 'grass') {
    for (let i = 0; i < 6; i++) parts.push(blade(0, 0, 0.3, 0.05, 0.35, i * golden, i % 2 ? '#7cc045' : '#5ea83a'));
  }
  const geo = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  // Cards and blades read best lit like a canopy: normals lean to the sky.
  const n = geo.attributes.normal, v = new THREE.Vector3();
  for (let i = 0; i < n.count; i++) {
    v.set(n.getX(i), n.getY(i), n.getZ(i));
    if (v.y < 0) v.negate();
    v.multiplyScalar(0.35).add(new THREE.Vector3(0, 1, 0)).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeBoundingSphere();
  cropGeoCache.set(kind, geo);
  return geo;
}

/**
 * One InstancedMesh per crop part, shared by every plot that grows it.
 * `positions` are world points [x, y, z, yaw, scale, tintIndex].
 */
export function instanceCrop(parent, kind, positions, { amp = 0.05, tints = ['#ffffff'], name = kind, cast = false } = {}) {
  if (!positions.length) return null;
  const im = new THREE.InstancedMesh(cropGeometry(kind), swayMaterial('#ffffff', { amp }), positions.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler(), col = new THREE.Color();
  positions.forEach(([x, y, z, yaw = 0, scale = 1, ti = 0], i) => {
    p.set(x, y, z); q.setFromEuler(e.set(0, yaw, 0)); s.set(scale, scale * (0.9 + ((i * 7) % 5) * 0.05), scale);
    im.setMatrixAt(i, m.compose(p, q, s));
    im.setColorAt(i, col.set(tints[ti % tints.length]));
  });
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.castShadow = cast; im.receiveShadow = true; im.name = name;
  im.raycast = () => {}; // the follow camera may pass through crops
  im.computeBoundingSphere();
  parent.add(im);
  return im;
}

// ------------------------------------------------------------------ buildings
/** Thatched hip roof (chhappar): straw cone layers on a rectangle. */
export function makeThatchRoof({ w = 5, d = 4, rise = 1.6, over = 0.5, color = '#d9b25a', dark = '#b48c3e' } = {}) {
  const g = group('thatch-roof');
  const W = w / 2 + over, D = d / 2 + over;
  const v = [
    -W, 0, D, W, 0, D, 0.4 * W, rise, 0, -W, 0, D, 0.4 * W, rise, 0, -0.4 * W, rise, 0,
    W, 0, -D, -W, 0, -D, -0.4 * W, rise, 0, W, 0, -D, -0.4 * W, rise, 0, 0.4 * W, rise, 0,
    -W, 0, -D, -W, 0, D, -0.4 * W, rise, 0, W, 0, D, W, 0, -D, 0.4 * W, rise, 0,
  ];
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.computeVertexNormals();
  mesh(g, geo, toonMaterial(color, { side: THREE.DoubleSide, paint: 0.09 }));
  // shaggy eave fringe and straw bands
  for (const [x, z, len, yaw] of [[0, D, 2 * W, 0], [0, -D, 2 * W, 0], [W, 0, 2 * D, Math.PI / 2], [-W, 0, 2 * D, Math.PI / 2]]) {
    const fringe = box(g, len + 0.1, 0.16, 0.12, dark, x, -0.05, z); fringe.rotation.y = yaw;
  }
  for (let i = 1; i < 3; i++) {
    const t = i / 3, y = rise * t, ww = W * (1 - t * 0.6), dd = D * (1 - t);
    for (const s of [-1, 1]) { const b = box(g, ww * 2, 0.06, 0.07, dark, 0, y + 0.02, s * dd); b.rotation.x = s * Math.atan2(rise, D) * 0.9; }
  }
  beam(g, [-0.4 * W, rise + 0.04, 0], [0.4 * W, rise + 0.04, 0], 0.09, dark);
  return g;
}

/** Kutcha farmhouse: mud-plastered walls with a painted white border, blue door, thatched roof and veranda. */
export function makeFarmhouse({ w = 6.2, d = 4.4, h = 2.7, wall = '#d89a5a', band = '#f6efe0', door = '#2f6db5', name = 'farmhouse', seed = 1 } = {}) {
  const g = group(name); footprint(g, w + 0.2, d + 0.2);
  box(g, w + 0.3, 0.3, d + 0.3, '#a8743f', 0, 0.15, 0);
  box(g, w, h, d, wall, 0, 0.3 + h / 2, 0);
  // white lime border and dotted mandana paintings by the door
  for (const s of [-1, 1]) box(g, w + 0.02, 0.18, 0.02, band, 0, 0.55, s * (d / 2 + 0.005));
  box(g, w + 0.02, 0.14, d + 0.02, band, 0, h + 0.18, 0);
  for (let i = 0; i < 9; i++) sphere(g, 0.045, flat(i % 3 === 0 ? '#c0392b' : band), -w * 0.12 + (i % 3) * 0.16, 1.3 + Math.floor(i / 3) * 0.16, d / 2 + 0.02, [1, 1, 0.3]);
  for (let i = 0; i < 6; i++) { const tri = sphere(g, 0.07, flat(band), w * 0.36 - i * 0.12, 2.35, d / 2 + 0.02, [1, 0.6, 0.25]); tri.rotation.z = Math.PI / 4; }
  // door + frame
  box(g, 1.15, 2.05, 0.1, C.timber, w * 0.12, 1.33, d / 2 + 0.02);
  box(g, 0.95, 1.9, 0.08, door, w * 0.12, 1.28, d / 2 + 0.06);
  box(g, 0.04, 1.85, 0.03, '#1f3f6a', w * 0.12, 1.28, d / 2 + 0.11);
  for (const s of [-1, 1]) sphere(g, 0.035, C.brass, w * 0.12 + s * 0.08, 1.3, d / 2 + 0.12);
  // windows with jaali shutters
  for (const x of [-w * 0.3, w * 0.38]) {
    box(g, 0.8, 0.75, 0.08, C.timber, x, 1.55, d / 2 + 0.02);
    box(g, 0.66, 0.6, 0.06, '#2a7a6a', x, 1.55, d / 2 + 0.05);
    for (let i = -1; i <= 1; i++) box(g, 0.02, 0.6, 0.03, '#f0d080', x + i * 0.2, 1.55, d / 2 + 0.09);
  }
  const roof = makeThatchRoof({ w, d, rise: 1.5 + (seed % 2) * 0.2 }); roof.position.y = h + 0.3; g.add(roof);
  // front veranda on bamboo posts, thatched lean-to
  for (const x of [-w / 2 + 0.2, 0, w / 2 - 0.2]) { cylinder(g, 0.06, 0.07, 2.3, '#a9874e', x, 1.45, d / 2 + 1.55, 6); roundFootprint(g, 0.1, x, d / 2 + 1.55); }
  const lean = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.1, 1.9), toonMaterial('#d9b25a', { paint: 0.09 }));
  lean.position.set(0, 2.62, d / 2 + 0.85); lean.rotation.x = 0.16; lean.castShadow = true; lean.receiveShadow = true; g.add(lean);
  box(g, w + 0.6, 0.12, 0.1, '#b48c3e', 0, 2.48, d / 2 + 1.78);
  box(g, w + 0.4, 0.12, 2.0, '#c99a62', 0, 0.06, d / 2 + 1.0);
  return g;
}

export function makeCattleShed({ w = 5.4, d = 3.4, name = 'cattle-shed' } = {}) {
  const g = group(name);
  for (const x of [-w / 2, 0, w / 2]) for (const z of [-d / 2, d / 2]) { cylinder(g, 0.07, 0.08, 2.4, '#8a6a3e', x, 1.2, z, 6); roundFootprint(g, 0.1, x, z); }
  const roof = makeThatchRoof({ w, d, rise: 1.0, over: 0.35 }); roof.position.y = 2.4; g.add(roof);
  box(g, w, 0.06, d, '#9a7a4a', 0, 0.03, 0);
  // mud feeding trough (nand) and fodder heap
  box(g, w * 0.8, 0.35, 0.5, '#a8743f', 0, 0.18, -d / 2 + 0.4);
  box(g, w * 0.78, 0.06, 0.38, '#7fae3e', 0, 0.36, -d / 2 + 0.4);
  box(g, 0.8, 1.3, d * 0.9, '#b8874a', -w / 2 + 0.4, 0.65, 0);
  return g;
}

/** Conical haystack (bhoosa/ paddy straw) with a pole through the top. */
export function makeHaystack({ r = 1.3, h = 2.4, color = '#e4c060', seed = 1 } = {}) {
  const g = group('haystack'); roundFootprint(g, r * 0.85);
  const geo = new THREE.LatheGeometry([
    new THREE.Vector2(0.001, h), new THREE.Vector2(r * 0.35, h * 0.92), new THREE.Vector2(r * 0.8, h * 0.68),
    new THREE.Vector2(r, h * 0.38), new THREE.Vector2(r * 0.96, h * 0.12), new THREE.Vector2(r * 0.8, 0),
  ], 14);
  mesh(g, geo, toonMaterial(color, { paint: 0.12 }));
  for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(r * (0.98 - i * 0.2), 0.035, 4, 18), toonMaterial('#a88a3c')); t.rotation.x = Math.PI / 2; t.position.y = h * (0.3 + i * 0.22); g.add(t); }
  beam(g, [0, h - 0.2, 0], [0.05 * (seed % 2 ? 1 : -1), h + 0.7, 0], 0.035, '#6a5030');
  return g;
}

/** Woven charpai cot: a place to rest until evening. */
export function makeCharpai({ name = 'charpai' } = {}) {
  const g = group(name); footprint(g, 1.0, 1.95);
  for (const x of [-0.45, 0.45]) for (const z of [-0.9, 0.9]) cylinder(g, 0.05, 0.045, 0.45, '#7a4a2a', x, 0.225, z, 6);
  for (const x of [-0.45, 0.45]) box(g, 0.07, 0.07, 1.9, '#8a5a32', x, 0.42, 0);
  for (const z of [-0.9, 0.9]) box(g, 0.95, 0.07, 0.07, '#8a5a32', 0, 0.42, z);
  for (let i = 0; i < 9; i++) box(g, 0.86, 0.015, 0.06, i % 2 ? '#e8d2a0' : '#c0392b', 0, 0.44, -0.8 + i * 0.2);
  for (let i = 0; i < 4; i++) box(g, 0.06, 0.018, 1.76, '#e8d2a0', -0.3 + i * 0.2, 0.445, 0);
  box(g, 0.75, 0.08, 0.35, '#2f6db5', 0, 0.5, -0.65);
  return g;
}

export function makeHandpump() {
  const g = group('handpump'); roundFootprint(g, 0.3);
  box(g, 1.2, 0.12, 1.2, '#b8b0a0', 0, 0.06, 0.25);
  cylinder(g, 0.09, 0.11, 1.05, '#2f8a5e', 0, 0.62, 0, 10);
  cylinder(g, 0.12, 0.12, 0.25, '#2f8a5e', 0, 1.2, 0, 10);
  beam(g, [0, 1.0, 0.08], [0, 0.88, 0.42], 0.03, '#2f8a5e');
  beam(g, [0, 1.28, 0], [0, 1.38, -0.75], 0.025, '#2f8a5e');
  cylinder(g, 0.13, 0.11, 0.26, '#b0b8c0', 0.05, 0.25, 0.5, 12);
  return g;
}

/** Brick well (kuan) with a wooden pulley frame and a brass lota on the rim. */
export function makeWell() {
  const g = group('village-well'); roundFootprint(g, 1.15);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.1, 0.85, 18, 1, true), toonMaterial('#b8644a', { side: THREE.DoubleSide }));
  ring.position.y = 0.42; ring.castShadow = true; g.add(ring);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.86, 18, 1, true), toonMaterial('#8a4a38', { side: THREE.BackSide }));
  inner.position.y = 0.42; g.add(inner);
  const top = new THREE.Mesh(new THREE.RingGeometry(0.82, 1.12, 18), toonMaterial('#e6dccb')); top.rotation.x = -Math.PI / 2; top.position.y = 0.86; g.add(top);
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.82, 18), flat('#1d4a5a')); water.rotation.x = -Math.PI / 2; water.position.y = 0.2; g.add(water);
  for (const s of [-1, 1]) beam(g, [s * 0.95, 0.85, 0], [s * 0.75, 2.2, 0], 0.06, C.wood);
  beam(g, [-0.85, 2.15, 0], [0.85, 2.15, 0], 0.05, C.wood);
  const pulley = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 6, 12), toonMaterial('#5a4a3a')); pulley.position.set(0, 2.15, 0); g.add(pulley);
  beam(g, [0.12, 2.1, 0], [0.12, 1.1, 0], 0.008, '#e8d8b0');
  cylinder(g, 0.1, 0.08, 0.16, C.brass, 0.12, 1.02, 0, 10);
  cylinder(g, 0.08, 0.06, 0.14, C.brass, -0.9, 0.95, 0.3, 10);
  return g;
}

/** Red farm tractor with yellow rims; no maker's branding. */
export function makeTractor({ body = '#d4321f', rim = '#f2c230', name = 'tractor' } = {}) {
  const g = group(name); footprint(g, 1.7, 3.3, 0, 0.1);
  box(g, 0.9, 0.75, 1.7, body, 0, 1.05, 0.6);
  box(g, 0.92, 0.12, 1.72, '#f2f2f2', 0, 1.36, 0.6);
  box(g, 0.75, 0.55, 0.12, '#3a3a3a', 0, 0.98, 1.47);
  for (let i = 0; i < 5; i++) box(g, 0.6, 0.05, 0.13, '#cfd4d8', 0, 0.8 + i * 0.09, 1.5);
  cylinder(g, 0.05, 0.06, 0.9, '#3a3a3a', 0.3, 1.75, 0.9, 8);
  box(g, 1.1, 0.5, 1.0, body, 0, 1.05, -0.55);
  box(g, 0.55, 0.12, 0.45, '#2a2a2a', 0, 1.42, -0.6);
  box(g, 0.5, 0.45, 0.1, '#2a2a2a', 0, 1.7, -0.84);
  beam(g, [0, 1.35, 0.0], [0, 1.6, 0.25], 0.03, '#2a2a2a');
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 6, 14), toonMaterial('#2a2a2a'));
  wheel.position.set(0, 1.65, 0.3); wheel.rotation.x = -0.9; g.add(wheel);
  for (const s of [-1, 1]) {
    const back = cylinder(g, 0.72, 0.72, 0.42, '#262626', s * 0.82, 0.72, -0.6, 18); back.rotation.z = Math.PI / 2;
    const backRim = cylinder(g, 0.42, 0.42, 0.44, rim, s * 0.82, 0.72, -0.6, 14); backRim.rotation.z = Math.PI / 2;
    for (let i = 0; i < 8; i++) { const lug = box(g, 0.44, 0.08, 0.1, '#1d1d1d', s * 0.82, 0.72 + Math.cos(i * 0.785) * 0.72, -0.6 + Math.sin(i * 0.785) * 0.72); lug.rotation.x = i * 0.785; }
    const mud = box(g, 0.5, 0.06, 1.25, body, s * 0.82, 1.48, -0.6); mud.rotation.x = 0;
    const front = cylinder(g, 0.38, 0.38, 0.26, '#262626', s * 0.55, 0.38, 1.05, 14); front.rotation.z = Math.PI / 2;
    const frontRim = cylinder(g, 0.2, 0.2, 0.28, rim, s * 0.55, 0.38, 1.05, 12); frontRim.rotation.z = Math.PI / 2;
    sphere(g, 0.08, flat('#fff6c8'), s * 0.32, 1.25, 1.48, [1, 1, 0.5]);
  }
  return g;
}

/** Bullock cart (bail gaadi): planked bed, spoked wheels, yoke. */
export function makeBullockCart({ name = 'bullock-cart', loaded = true } = {}) {
  const g = group(name); footprint(g, 1.9, 3.0, 0, -0.3);
  box(g, 1.4, 0.1, 2.2, '#9a6a3a', 0, 0.95, -0.4);
  for (const s of [-1, 1]) {
    box(g, 0.08, 0.3, 2.2, '#7a4a2a', s * 0.7, 1.13, -0.4);
    for (let i = 0; i < 5; i++) beam(g, [s * 0.7, 1.0, -1.4 + i * 0.5], [s * 0.72, 1.55, -1.4 + i * 0.5], 0.025, '#7a4a2a');
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 22), toonMaterial('#5a3a22')); rim.position.set(s * 0.86, 0.66, -0.5); rim.rotation.y = Math.PI / 2; rim.castShadow = true; g.add(rim);
    for (let i = 0; i < 6; i++) { const sp = box(g, 0.04, 1.2, 0.05, '#7a4a2a', s * 0.86, 0.66, -0.5); sp.rotation.x = i * Math.PI / 6; }
    cylinder(g, 0.1, 0.1, 0.18, '#5a3a22', s * 0.86, 0.66, -0.5, 8).rotation.z = Math.PI / 2;
  }
  cylinder(g, 0.04, 0.04, 1.9, '#5a3a22', 0, 0.66, -0.5, 6).rotation.z = Math.PI / 2;
  beam(g, [0, 0.95, 0.7], [0, 0.95, 2.1], 0.06, '#7a4a2a');
  beam(g, [-0.9, 1.05, 2.0], [0.9, 1.05, 2.0], 0.05, '#7a4a2a');
  if (loaded) for (let i = 0; i < 6; i++) sphere(g, 0.32, '#e4c060', -0.3 + (i % 2) * 0.6, 1.25 + Math.floor(i / 2) * 0.12, -1.1 + Math.floor(i / 2) * 0.55, [1, 0.7, 1.2]);
  return g;
}

/** Bovine: white zebu bullocks with painted horns and a hump, or a black water buffalo. */
export function makeBovine({ kind = 'zebu', hornColor = '#e8781a', name = kind } = {}) {
  const g = group(name); footprint(g, 0.95, 2.1);
  const buffalo = kind === 'buffalo';
  const hide = buffalo ? '#3a3638' : '#efe9de', hide2 = buffalo ? '#2c292b' : '#d8d0c2';
  const body = sphere(g, 0.5, hide, 0, 1.0, 0, [0.85, 0.82, 1.7]);
  sphere(g, 0.38, hide2, 0, 0.98, -0.55, [1, 0.95, 1.1]);
  if (!buffalo) sphere(g, 0.24, hide2, 0, 1.42, 0.45, [0.9, 1, 1]);
  const legs = [];
  for (const [x, z] of [[-0.24, 0.55], [0.24, 0.55], [-0.24, -0.6], [0.24, -0.6]]) {
    legs.push(cylinder(g, 0.065, 0.075, 0.8, hide2, x, 0.4, z, 7));
    cylinder(g, 0.08, 0.08, 0.06, '#2a2420', x, 0.03, z, 7);
  }
  const neck = group('bovine-neck'); neck.position.set(0, 1.15, 0.75); g.add(neck);
  sphere(neck, 0.22, hide, 0, 0.0, 0.12, [0.8, 1, 1.1]);
  if (!buffalo) sphere(neck, 0.12, '#e8e0d0', 0, -0.32, 0.05, [0.7, 1.4, 0.7]);
  const head = group('bovine-head'); head.position.set(0, 0.06, 0.32); neck.add(head);
  sphere(head, 0.17, hide, 0, 0, 0.12, [0.85, 0.9, 1.4]);
  sphere(head, 0.12, buffalo ? '#4a4446' : '#d8b8a8', 0, -0.07, 0.33, [1, 0.8, 0.9]);
  for (const s of [-1, 1]) {
    sphere(head, 0.025, flat('#1d1a1a'), s * 0.12, 0.05, 0.2);
    const ear = sphere(head, 0.08, hide2, s * 0.2, 0.04, 0.03, [1.4, 0.45, 0.7]); ear.rotation.z = s * 0.4;
    if (buffalo) {
      const horn = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 6, 10, Math.PI * 0.9), toonMaterial('#5a5048'));
      horn.position.set(s * 0.12, 0.1, -0.02); horn.rotation.set(0, Math.PI / 2, s * 0.2 + (s > 0 ? 0 : Math.PI)); head.add(horn);
    } else {
      beam(head, [s * 0.08, 0.12, 0.02], [s * 0.2, 0.36, -0.05], 0.03, hornColor);
      sphere(head, 0.035, '#f2c230', s * 0.2, 0.37, -0.05);
    }
  }
  if (!buffalo) {
    // a beaded neck band with a small brass bell
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.025, 5, 14), toonMaterial('#c0392b')); band.position.set(0, -0.06, 0.08); band.rotation.x = Math.PI / 2 + 0.4; neck.add(band);
    sphere(neck, 0.05, C.brass, 0, -0.26, 0.18);
  }
  const tail = group('bovine-tail'); tail.position.set(0, 1.25, -0.82); g.add(tail);
  beam(tail, [0, 0, 0], [0, -0.75, -0.08], 0.02, hide2);
  sphere(tail, 0.05, '#2a2420', 0, -0.8, -0.08, [1, 1.6, 1]);
  compact(g, [neck, head, tail]);
  return { group: g, neck, head, tail, body, legs };
}

/** Scarecrow (bijuka) in an old kurta with a painted clay-pot head. */
export function makeScarecrow({ shirt = '#c0392b' } = {}) {
  const g = group('scarecrow');
  beam(g, [0, 0, 0], [0, 2.2, 0], 0.04, '#7a5a32');
  beam(g, [-0.75, 1.6, 0], [0.75, 1.6, 0], 0.035, '#7a5a32');
  box(g, 0.55, 0.75, 0.25, shirt, 0, 1.3, 0);
  for (const s of [-1, 1]) { const sl = box(g, 0.5, 0.18, 0.2, shirt, s * 0.45, 1.58, 0); sl.rotation.z = s * -0.1; }
  for (let i = 0; i < 5; i++) beam(g, [0.72, 1.6, 0], [0.82 + i * 0.02, 1.45 - i * 0.03, 0.05 * (i - 2)], 0.012, '#e4c060');
  for (let i = 0; i < 5; i++) beam(g, [-0.72, 1.6, 0], [-0.82 - i * 0.02, 1.45 - i * 0.03, 0.05 * (i - 2)], 0.012, '#e4c060');
  sphere(g, 0.24, '#c87a4a', 0, 2.0, 0);
  sphere(g, 0.05, flat('#1a1a1a'), -0.08, 2.05, 0.21); sphere(g, 0.05, flat('#1a1a1a'), 0.08, 2.05, 0.21);
  box(g, 0.14, 0.03, 0.02, flat('#f6efe0'), 0, 1.93, 0.23);
  for (let i = 0; i < 4; i++) sphere(g, 0.04, flat('#f6efe0'), -0.12 + i * 0.08, 2.17, 0.19);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.28, 12), toonMaterial('#d9b25a')); hat.position.y = 2.32; hat.castShadow = true; g.add(hat);
  return g;
}

/** Banyan (bargad) with aerial roots and a whitewashed chabutra platform. */
export function makeBanyan({ seed = 3, platform = true } = {}) {
  const g = group('banyan-tree'); roundFootprint(g, platform ? 2.4 : 0.8);
  if (platform) {
    cylinder(g, 2.6, 2.7, 0.55, '#e8dcc4', 0, 0.27, 0, 20);
    cylinder(g, 2.7, 2.7, 0.07, '#c0392b', 0, 0.56, 0, 20);
    for (let i = 0; i < 3; i++) sphere(g, 0.12, flat(['#ff9a1a', '#ffd000', '#c0392b'][i]), Math.cos(i * 0.4 + 1) * 0.95, 0.65, Math.sin(i * 0.4 + 1) * 0.95);
  }
  beam(g, [0, 0, 0], [0.2, 4.2, 0.1], 0.6, '#6e5640', 12);
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05 + seed;
    beam(g, [0.1, 3.4, 0], [Math.cos(a) * 3.6, 5.0 + (i % 2) * 0.6, Math.sin(a) * 3.6], 0.2, '#6e5640', 8);
    beam(g, [Math.cos(a) * 3.0, 4.8, Math.sin(a) * 3.0], [Math.cos(a) * 3.05, platform ? 0.6 : 0, Math.sin(a) * 3.05], 0.035, '#8a7258', 5);
    beam(g, [Math.cos(a + 0.3) * 2.2, 4.6, Math.sin(a + 0.3) * 2.2], [Math.cos(a + 0.3) * 2.25, 1.6, Math.sin(a + 0.3) * 2.25], 0.025, '#8a7258', 5);
  }
  const foliage = toonMaterial(0xffffff, { vertexColors: true, paint: 0.025 });
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9 + seed, r = i === 0 ? 0 : 3.1;
    const geo = shrubGeometry({ rx: i ? 2.4 : 3.0, ry: 1.6, rz: i ? 2.3 : 3.0, seed: 61 + i, spacing: 0.3, maxDetail: 7, puffAmp: 0.35,
      colors: { top: '#9fd46a', mid: '#3f9a45', base: '#2a6a3a' } });
    const m = mesh(g, geo, foliage, [Math.cos(a) * r, 5.6 + (i % 3) * 0.5, Math.sin(a) * r]); m.receiveShadow = false;
  }
  // red and yellow sacred threads tied around the trunk
  for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.03, 5, 18), toonMaterial(i % 2 ? '#ffd000' : '#d4321f')); t.rotation.x = Math.PI / 2; t.position.y = 1.4 + i * 0.12 + (platform ? 0.4 : 0); g.add(t); }
  return g;
}

/** Mango tree: dense dark rounded crown with hanging yellow-orange fruit. */
export function makeMangoTree({ h = 5.2, spread = 2.8, seed = 1, fruit = true } = {}) {
  const g = group('mango-tree'); roundFootprint(g, 0.35);
  const rnd = seeded(seed);
  beam(g, [0, 0, 0], [0.1, h * 0.42, 0], 0.22, '#5e4630', 9);
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + seed; beam(g, [0.05, h * 0.38, 0], [Math.cos(a) * 1.0, h * 0.62, Math.sin(a) * 1.0], 0.12, '#5e4630', 7); }
  const foliage = toonMaterial(0xffffff, { vertexColors: true, paint: 0.03 });
  for (let i = 0; i < 4; i++) {
    const a = i * 2.1 + seed, r = i ? spread * 0.42 : 0;
    const geo = shrubGeometry({ rx: spread * (i ? 0.7 : 0.95), ry: h * 0.3, rz: spread * (i ? 0.7 : 0.9), seed: 81 + (seed + i) % 5, spacing: 0.26, maxDetail: 7, puffAmp: 0.3,
      colors: { top: '#6fbf4a', mid: '#2f8a3e', base: '#1d5a32' } });
    const m = mesh(g, geo, foliage, [Math.cos(a) * r, h * 0.66 + (i % 2) * 0.4, Math.sin(a) * r]); m.receiveShadow = false;
  }
  if (fruit) for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, r = spread * (0.75 + rnd() * 0.2), y = h * 0.52 + rnd() * h * 0.2;
    sphere(g, 0.1, rnd() > 0.4 ? '#f5b82a' : '#e8781a', Math.cos(a) * r, y, Math.sin(a) * r, [0.85, 1.2, 0.85]);
  }
  return g;
}

/** Coconut palm with a curved, ringed trunk and drooping fronds. */
export function makeCoconutPalm({ h = 7, lean = 0.18, seed = 1 } = {}) {
  const g = group('coconut-palm'); roundFootprint(g, 0.25);
  const segs = 9, pts = [];
  for (let i = 0; i <= segs; i++) { const t = i / segs; pts.push([Math.sin(t * 1.3) * lean * h, t * h, 0]); }
  for (let i = 0; i < segs; i++) {
    beam(g, pts[i], pts[i + 1], 0.16 - i * 0.008, i % 2 ? '#8a7454' : '#7a6448', 7);
  }
  const top = pts[segs];
  for (let i = 0; i < 4; i++) sphere(g, 0.15, '#6a7a2a', top[0] + Math.cos(i * 1.6) * 0.2, top[1] - 0.25, Math.sin(i * 1.6) * 0.2);
  for (let i = 0; i < 10; i++) {
    const a = i * 0.628 + seed, frond = group('frond');
    const segsF = 4; let px = 0, py = 0, pitch = 0.25 + (i % 3) * 0.12;
    for (let j = 0; j < segsF; j++) {
      const len = 0.62, nx = px + Math.cos(pitch) * len, ny = py + Math.sin(pitch) * len;
      const blade = box(frond, 0.5 - j * 0.08, 0.02, len + 0.04, i % 2 ? '#3f9a3e' : '#58b04a', 0, (py + ny) / 2, (px + nx) / 2);
      blade.rotation.x = -pitch; px = nx; py = ny; pitch -= 0.38;
    }
    frond.position.set(...top); frond.rotation.y = a; g.add(frond);
  }
  return g;
}

/** Raised watch platform (machan) built from bamboo, with a thatched hood. */
export function makeMachan() {
  const g = group('machan');
  for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) { beam(g, [x * 1.1, 0, z * 1.1], [x, 2.6, z], 0.06, '#b89a5a'); roundFootprint(g, 0.1, x * 1.1, z * 1.1); }
  box(g, 1.9, 0.1, 1.9, '#a9874e', 0, 2.6, 0);
  for (const z of [-0.95, 0.95]) box(g, 1.9, 0.05, 0.05, '#a9874e', 0, 3.1, z);
  for (let i = 0; i < 8; i++) beam(g, [0.9 + 0.35, i * 0.33, 0.3], [0.9 + 0.35, i * 0.33, -0.3], 0.025, '#b89a5a');
  for (const z of [0.3, -0.3]) beam(g, [1.25, 0, z], [1.0, 2.6, z], 0.03, '#b89a5a');
  const hood = makeThatchRoof({ w: 1.7, d: 1.7, rise: 0.8, over: 0.2 }); hood.position.y = 3.6; g.add(hood);
  for (const [x, z] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]]) beam(g, [x, 2.6, z], [x, 3.6, z], 0.03, '#b89a5a');
  return g;
}

/** A jhoola: rope swing hung from a branch, with a painted plank seat. */
export function makeJhoola({ h = 3.2 } = {}) {
  const g = group('jhoola'); g.userData.dynamic = true;
  const seat = group('jhoola-seat'); seat.position.y = h; g.add(seat);
  for (const x of [-0.35, 0.35]) beam(seat, [x, 0, 0], [x, -h + 0.55, 0], 0.012, '#e8d8b0');
  box(seat, 0.85, 0.06, 0.3, '#d4321f', 0, -h + 0.52, 0);
  for (let i = 0; i < 4; i++) sphere(seat, 0.05, flat(i % 2 ? '#ff9a1a' : '#ffd000'), -0.3 + i * 0.2, -h + 0.95 + (i % 2) * 0.1, 0);
  g.userData.update = (t) => { seat.rotation.x = Math.sin(t * 1.4) * 0.22; };
  return g;
}

/** Triangular festival flag string (jhandiyan): one instanced draw per string. */
export function makeBunting({ from, to, count = 14, sag = 0.4, colors = ['#e8558a', '#ffd000', '#1f9a62', '#ff8c1a', '#2f6db5', '#d4321f', '#7a3fb0'], size = 0.32 } = {}) {
  const g = group('bunting'); g.userData.dynamic = true;
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const mid = a.clone().lerp(b, 0.5); mid.y -= sag;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.01, 4), flat('#3a2e28')); g.add(rope);
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([-size / 2, 0, 0, size / 2, 0, 0, 0, -size * 1.25, 0], 3)); tri.computeVertexNormals();
  const dir = b.clone().sub(a).setY(0).normalize(), yaw = Math.atan2(dir.x, dir.z) - Math.PI / 2;
  const flags = new THREE.InstancedMesh(tri, buntingMaterial(), count);
  const pts = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
  for (let i = 0; i < count; i++) { pts.push(curve.getPoint((i + 0.5) / count)); flags.setColorAt(i, col.set(colors[i % colors.length])); }
  const pose = (t) => {
    for (let i = 0; i < count; i++) { q.setFromEuler(e.set(Math.sin(t * 2.2 + i * 0.7) * 0.25, yaw, 0, 'YXZ')); flags.setMatrixAt(i, m4.compose(pts[i], q, one)); }
    flags.instanceMatrix.needsUpdate = true;
  };
  pose(0); flags.instanceColor.needsUpdate = true; flags.computeBoundingSphere(); flags.raycast = () => {};
  g.add(flags);
  g.userData.update = pose;
  return g;
}
let buntingMat = null;
function buntingMaterial() { return buntingMat ??= new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }); }

/** Paper kite (patang) high on the breeze, with its manjha string down to an anchor. */
export function makeKite({ color = '#e8558a', color2 = '#ffd000', anchor = [0, 1, 0], height = 18, offset = [6, 0, 4] } = {}) {
  const g = group('kite'); g.userData.dynamic = true;
  const kite = group('kite-body'); g.add(kite);
  const shape = new THREE.BufferGeometry();
  shape.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.55, 0, -0.45, 0, 0, 0, -0.55, 0, 0, 0.55, 0, 0, -0.55, 0, 0.45, 0, 0], 3)); shape.computeVertexNormals();
  const body = new THREE.Mesh(shape, toonMaterial(color, { side: THREE.DoubleSide })); kite.add(body);
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 1.1), toonMaterial(color2, { side: THREE.DoubleSide })); stripe.position.z = 0.005; kite.add(stripe);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 3), toonMaterial(color2)); tail.position.y = -0.68; tail.rotation.z = Math.PI; kite.add(tail);
  const lineGeo = new THREE.BufferGeometry(); const linePts = new Float32Array(13 * 3);
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePts, 3));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#4a453e' })); line.frustumCulled = false; g.add(line);
  const A = new THREE.Vector3(...anchor), K = new THREE.Vector3();
  g.userData.update = (t) => {
    K.set(A.x + offset[0] + Math.sin(t * 0.7 + A.x) * 1.4, A.y + height + Math.sin(t * 1.1 + A.z) * 0.9, A.z + offset[2] + Math.cos(t * 0.5) * 1.1);
    kite.position.copy(K); kite.rotation.set(-0.5 + Math.sin(t * 1.7) * 0.15, Math.atan2(-offset[0], -offset[2]), Math.sin(t * 1.3 + A.x) * 0.35);
    for (let i = 0; i <= 12; i++) {
      const s = i / 12, sagY = Math.sin(s * Math.PI) * 1.6;
      linePts[i * 3] = A.x + (K.x - A.x) * s; linePts[i * 3 + 1] = A.y + (K.y - A.y) * s - sagY; linePts[i * 3 + 2] = A.z + (K.z - A.z) * s;
    }
    lineGeo.attributes.position.needsUpdate = true;
  };
  return g;
}

/** Clothes line with sarees and dupattas drying in the sun. */
export function makeClothesline({ w = 4, colors = ['#e8558a', '#ffd000', '#2f6db5', '#1f9a62', '#ff8c1a'] } = {}) {
  const g = group('clothesline'); g.userData.dynamic = true;
  for (const x of [-w / 2, w / 2]) { cylinder(g, 0.04, 0.05, 2.0, '#8a6a3e', x, 1.0, 0, 6); roundFootprint(g, 0.08, x, 0); }
  beam(g, [-w / 2, 1.92, 0], [w / 2, 1.92, 0], 0.008, '#e8e0d0');
  const cloths = [];
  const n = colors.length;
  for (let i = 0; i < n; i++) {
    const cw = (w - 0.4) / n - 0.06;
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(cw, 1.1 + (i % 2) * 0.25, 1, 4), toonMaterial(colors[i], { side: THREE.DoubleSide }));
    cloth.geometry.translate(0, -(1.1 + (i % 2) * 0.25) / 2, 0);
    cloth.position.set(-w / 2 + 0.2 + (i + 0.5) * (w - 0.4) / n, 1.9, 0); cloth.castShadow = true; g.add(cloth); cloths.push(cloth);
    const border = box(g, cw, 0.08, 0.01, i % 2 ? '#d9ac4a' : '#c0392b', cloth.position.x, 1.9 - (1.1 + (i % 2) * 0.25) + 0.05, 0.01);
    cloths.push(border);
  }
  g.userData.update = (t) => { for (let i = 0; i < cloths.length; i += 2) cloths[i].rotation.x = Math.sin(t * 1.8 + i) * 0.12 + 0.06; };
  return g;
}

/** Stacked clay matkas and a brass lota by the door. */
export function makeMatkas({ n = 3 } = {}) {
  const g = group('matkas');
  for (let i = 0; i < n; i++) {
    const x = i * 0.42 - (n - 1) * 0.21;
    sphere(g, 0.22, i % 2 ? '#b8603a' : '#a8502e', x, 0.2, 0, [1, 0.9, 1]);
    cylinder(g, 0.09, 0.11, 0.08, '#8a4028', x, 0.4, 0, 10);
    for (let k = 0; k < 3; k++) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.008, 4, 16), flat('#f6efe0')); band.rotation.x = Math.PI / 2; band.position.set(x, 0.18 + k * 0.05, 0); g.add(band); }
  }
  return g;
}

/** Brick tubewell room with a pipe gushing into a field channel. */
export function makeTubewell() {
  const g = group('tubewell'); footprint(g, 2.2, 2.0);
  box(g, 2.2, 1.9, 2.0, '#c0583a', 0, 0.95, 0);
  for (let r = 0; r < 7; r++) box(g, 2.22, 0.02, 2.02, '#e6d2b8', 0, 0.2 + r * 0.25, 0);
  box(g, 2.5, 0.12, 2.3, '#9a9a8a', 0, 1.96, 0);
  box(g, 0.75, 1.4, 0.06, '#2f6db5', -0.4, 0.75, 1.02);
  const sign = textSign({ text: 'बलदेव का ट्यूबवेल', sub: 'PANI · WATER', w: 1.3, h: 0.35, bg: '#1f9a62' }); sign.position.set(0.4, 1.55, 1.04); g.add(sign);
  cylinder(g, 0.11, 0.11, 0.9, '#6a6a6a', 0.55, 0.65, 1.3, 10).rotation.x = Math.PI / 2;
  // tank and gush
  box(g, 1.4, 0.45, 1.0, '#b8b0a0', 0.55, 0.22, 2.2);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.85), flat('#5fc0d8')); water.rotation.x = -Math.PI / 2; water.position.set(0.55, 0.43, 2.2); water.userData.dayVisible = true; g.add(water);
  const gush = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, 0.45, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#d8f4ff', transparent: true, opacity: 0.8 }));
  gush.position.set(0.55, 0.5, 1.82); gush.userData.dayVisible = true; g.add(gush);
  const foam = sphere(g, 0.16, flat('#ffffff'), 0.55, 0.45, 2.0, [1.4, 0.5, 1.2]);
  const animated = group('tubewell-water'); g.add(animated); animated.add(gush, foam); compact(g, [animated]);
  g.userData.dynamic = true;
  g.userData.update = (t) => { gush.scale.set(1 + Math.sin(t * 13) * 0.08, 1, 1 + Math.cos(t * 11) * 0.08); foam.scale.set(1.4 + Math.sin(t * 9) * 0.15, 0.5, 1.2 + Math.cos(t * 7) * 0.15); };
  return g;
}

/** Roadside village shrine: a little orange-painted stone deity niche with a flag. */
export function makeWaysideShrine() {
  const g = group('wayside-shrine'); footprint(g, 1.3, 1.3);
  box(g, 1.3, 0.3, 1.3, '#e8dcc4', 0, 0.15, 0);
  box(g, 0.9, 1.0, 0.8, '#f6efe0', 0, 0.8, 0);
  box(g, 0.5, 0.55, 0.05, '#2a1a14', 0, 0.75, 0.41);
  sphere(g, 0.16, '#ff6a1a', 0, 0.7, 0.33, [1, 1.3, 0.8]);
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.8, 4), toonMaterial('#ff8c1a')); top.position.y = 1.7; top.rotation.y = Math.PI / 4; top.castShadow = true; g.add(top);
  sphere(g, 0.08, C.brass, 0, 2.12, 0);
  beam(g, [0.55, 0.3, -0.5], [0.55, 3.1, -0.5], 0.025, '#8a6a3e');
  const flag = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -0.4, 0, 0.7, -0.2, 0], 3)), toonMaterial('#ff6a1a', { side: THREE.DoubleSide }));
  flag.geometry.computeVertexNormals(); flag.position.set(0.55, 3.1, -0.5); g.add(flag);
  for (let i = 0; i < 5; i++) sphere(g, 0.07, flat(i % 2 ? '#ff9a1a' : '#ffd000'), -0.4 + i * 0.2, 0.33, 0.55);
  const pennant = group('shrine-pennant'); pennant.position.copy(flag.position); flag.position.set(0, 0, 0); pennant.add(flag); g.add(pennant); compact(g, [pennant]);
  g.userData.dynamic = true;
  g.userData.update = (t) => { pennant.rotation.y = Math.sin(t * 2.5) * 0.35; };
  return g;
}

/** Lotus pond: water disc with lily pads and pink blooms. */
export function makeLotusPond({ r = 3.6, waterY = -0.62 } = {}) {
  const g = group('lotus-pond');
  const water = new THREE.Mesh(new THREE.CircleGeometry(r + 0.6, 28), toonMaterial('#3fa0b0', { paint: 0.02 }));
  water.rotation.x = -Math.PI / 2; water.position.y = waterY; water.receiveShadow = true; g.add(water);
  const rnd = seeded(77);
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r * 0.85;
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.28 + rnd() * 0.15, 10, 0.3, Math.PI * 1.8), toonMaterial('#3f9a3e'));
    pad.rotation.x = -Math.PI / 2; pad.rotation.z = rnd() * 6; pad.position.set(Math.cos(a) * d, waterY + 0.02, Math.sin(a) * d); g.add(pad);
    if (i % 3 === 0) {
      for (let k = 0; k < 6; k++) { const petal = sphere(g, 0.07, '#f27aa6', Math.cos(a) * d + Math.cos(k) * 0.07, waterY + 0.12, Math.sin(a) * d + Math.sin(k) * 0.07, [0.6, 1.2, 0.6]); petal.rotation.z = Math.cos(k) * 0.5; petal.rotation.x = Math.sin(k) * 0.5; }
      sphere(g, 0.045, '#ffd000', Math.cos(a) * d, waterY + 0.16, Math.sin(a) * d);
    }
  }
  return g;
}

/** White egret standing in shallow water. */
export function makeEgret() {
  const g = group('egret');
  sphere(g, 0.13, '#fafafa', 0, 0.5, 0, [0.8, 0.8, 1.5]);
  const neck = group('egret-neck'); neck.position.set(0, 0.58, 0.14); g.add(neck);
  beam(neck, [0, 0, 0], [0, 0.26, 0.05], 0.025, '#fafafa');
  sphere(neck, 0.045, '#fafafa', 0, 0.28, 0.07);
  beam(neck, [0, 0.28, 0.1], [0, 0.27, 0.24], 0.012, '#f2c230');
  for (const s of [-1, 1]) beam(g, [s * 0.04, 0.42, 0], [s * 0.04, 0, 0], 0.01, '#3a3a3a');
  compact(g, [neck]);
  return { group: g, neck };
}
