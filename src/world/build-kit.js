import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonMaterial } from '../core/toon.js';
import { surfaceY } from './layout.js';
import { addOrientedBox, addCircle } from './colliders.js';

export const LOCAL = {
  // A sunlit North Indian palette: limewash in haldi, rani pink, mint and
  // indigo; terracotta roofs; dark sheesham timber; brass and marigold.
  stone: '#a59d8c', stoneDark: '#7d766a', mortar: '#cbc3ae', plaster: '#f3e2b8', ochre: '#efb43f',
  sage: '#7fd3c0', peach: '#f39a9a', wood: '#7a5536', timber: '#4e3a2e', slate: '#b65a3a',
  slateDark: '#8e432c', indigo: '#2f6db5', green: '#1f9a62', red: '#cf3d2a', brass: '#d9ac4a',
  warm: '#ffd291', dark: '#2a3a44', ink: '#252c3b', canvas: '#efe0b6', marigold: '#ff9a1a',
  pink: '#e8558a', turquoise: '#28b7b0', saffron: '#ff8c1a', lime: '#bcd94a', blue: '#4a8fe0',
};
const geoCache = new Map(), flatCache = new Map();
export const seeded = (seed) => {
  let s = seed | 0;
  return () => { s = Math.imul(s ^ s >>> 16, 0x45d9f3b); s = Math.imul(s ^ s >>> 16, 0x45d9f3b); s ^= s >>> 16; return (s >>> 0) / 4294967296; };
};
export function flat(color) {
  if (!flatCache.has(color)) flatCache.set(color, new THREE.MeshBasicMaterial({ color }));
  return flatCache.get(color);
}
function geometry(key, create) {
  if (!geoCache.has(key)) geoCache.set(key, create());
  return geoCache.get(key);
}
export function mesh(parent, geo, material, position = [0, 0, 0], name = '') {
  const m = new THREE.Mesh(geo, typeof material === 'object' ? material : toonMaterial(material));
  m.position.set(...position); m.castShadow = !m.material.isMeshBasicMaterial; m.receiveShadow = true;
  m.name = name; parent.add(m); return m;
}
export function box(parent, w, h, d, color, x = 0, y = 0, z = 0, name = '') {
  return mesh(parent, geometry(`b:${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), color, [x, y, z], name);
}
export function cylinder(parent, rt, rb, h, color, x = 0, y = 0, z = 0, sides = 10) {
  return mesh(parent, geometry(`c:${rt},${rb},${h},${sides}`, () => new THREE.CylinderGeometry(rt, rb, h, sides)), color, [x, y, z]);
}
export function sphere(parent, r, color, x = 0, y = 0, z = 0, scale = [1, 1, 1]) {
  const m = mesh(parent, geometry(`s:${r}`, () => new THREE.SphereGeometry(r, 12, 8)), color, [x, y, z]);
  m.scale.set(...scale); return m;
}
export function beam(parent, a, b, radius, color, sides = 6) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const m = cylinder(parent, radius, radius, A.distanceTo(B), color, ...(A.clone().add(B).multiplyScalar(0.5).toArray()), sides);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.sub(A).normalize());
  return m;
}
export function plane(parent, w, h, color, x, y, z) {
  return mesh(parent, geometry(`p:${w},${h}`, () => new THREE.PlaneGeometry(w, h)), color, [x, y, z]);
}
export function group(name) { const g = new THREE.Group(); g.name = name; return g; }
export function footprint(g, w, d, x = 0, z = 0) {
  (g.userData.footprints ??= []).push({ x, z, w, d });
}
export function roundFootprint(g, radius, x = 0, z = 0) {
  (g.userData.roundFootprints ??= []).push({ x, z, radius });
}
export function place(parent, g, x, z, yaw = 0, y = surfaceY(x, z)) {
  g.position.set(x, y, z); g.rotation.y = yaw; parent.add(g);
  return g;
}
export function registerCollisions(g) {
  g.updateWorldMatrix(true, true);
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), scale = new THREE.Vector3();
  g.traverse((o) => {
    o.matrixWorld.decompose(p, q, scale);
    const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
    for (const f of o.userData.footprints ?? []) {
      const wp = new THREE.Vector3(f.x, 0, f.z).applyMatrix4(o.matrixWorld);
      addOrientedBox(wp.x, wp.z, f.w * scale.x / 2, f.d * scale.z / 2, e.y, p.y).owner = o.name;
    }
    for (const f of o.userData.roundFootprints ?? []) {
      const wp = new THREE.Vector3(f.x, 0, f.z).applyMatrix4(o.matrixWorld);
      addCircle(wp.x, wp.z, f.radius * Math.max(scale.x, scale.z)).owner = o.name;
    }
  });
}

/** Continuous, terrain-seated ribbon, with original data left in local XZ. */
export function ribbon(parent, points, width, color, { lift = 0.025, height = surfaceY, name = 'lane', steps = false } = {}) {
  const samples = [];
  for (let j = 0; j < points.length - 1; j++) {
    const a = points[j], b = points[j + 1], n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.65));
    for (let i = 0; i < n; i++) {
      const t = i / n; samples.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  samples.push(points.at(-1));
  const vertices = [], indices = [], uvs = [];
  for (let i = 0; i < samples.length; i++) {
    const a = samples[Math.max(0, i - 1)], b = samples[Math.min(samples.length - 1, i + 1)], p = samples[i];
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const nx = (b[2] - a[2]) / length, nz = -(b[0] - a[0]) / length;
    for (const side of [-1, 1]) {
      const x = p[0] + nx * width / 2 * side, z = p[2] + nz * width / 2 * side;
      let y = height ? height(x, z) : p[1];
      if (steps) y = Math.floor(p[1] / 0.17) * 0.17;
      vertices.push(x, y + lift, z); uvs.push(side > 0 ? 1 : 0, i * 0.1);
    }
    if (i < samples.length - 1) {
      const k = i * 2; indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.setIndex(indices); geo.computeVertexNormals();
  return mesh(parent, geo, color, [0, 0, 0], name);
}

/** Static civil works and clutter share batches per district/material. Named
 * district/landmark groups and all explicitly dynamic rigs remain available. */
export function batchStatic(root) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert(), buckets = new Map(), originals = [];
  const baked = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || Array.isArray(o.material) || o.material.transparent) return;
    for (let p = o; p && p !== root; p = p.parent) if (p.userData.dynamic) return;
    // Plain toon colours are baked into vertex colours so a district draws in
    // a handful of calls instead of one per paint colour.
    const m = o.material, bake = m.isMeshToonMaterial && !m.map;
    const key = bake ? `bake|${m.side}|${m.userData.paint ?? 0.045}|${o.castShadow}|${o.receiveShadow}` : `${m.uuid}|${o.castShadow}|${o.receiveShadow}`;
    if (bake && !baked.has(key)) baked.set(key, toonMaterial(0xffffff, { vertexColors: true, side: m.side, paint: m.userData.paint ?? 0.045 }));
    const b = buckets.get(key) ?? { material: bake ? baked.get(key) : m, cast: o.castShadow, receive: o.receiveShadow, geometries: [], sourceRanges: [], triangles: 0 };
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    geo.clearGroups(); geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, o.matrixWorld));
    // Canvas planes and primitive solids may have different optional attributes.
    for (const attribute of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(attribute)) geo.deleteAttribute(attribute);
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    if (bake) {
      const n = geo.attributes.position.count, c = new Float32Array(n * 3), src = m.vertexColors ? geo.attributes.color : null;
      for (let i = 0; i < n; i++) {
        c[i * 3] = m.color.r * (src ? src.getX(i) : 1); c[i * 3 + 1] = m.color.g * (src ? src.getY(i) : 1); c[i * 3 + 2] = m.color.b * (src ? src.getZ(i) : 1);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    } else if (geo.attributes.color && !m.vertexColors) geo.deleteAttribute('color');
    const names = [];
    for (let p = o; p && p !== root; p = p.parent) if (p.name) names.push(p.name);
    b.triangles += geo.attributes.position.count / 3;
    b.sourceRanges.push({ end: b.triangles, source: names.reverse().join('/') || root.name });
    b.geometries.push(geo); buckets.set(key, b); originals.push(o);
  });
  const batches = group('static-batches');
  for (const b of buckets.values()) {
    const geo = mergeGeometries(b.geometries, false);
    if (!geo) throw new Error(`Cannot batch ${root.name}`);
    const m = mesh(batches, geo, b.material); m.castShadow = b.cast; m.receiveShadow = b.receive;
    m.userData.sourceRanges = b.sourceRanges;
    for (const part of b.geometries) part.dispose();
  }
  for (const o of originals) o.removeFromParent();
  root.add(batches);
  return { meshes: originals.length, batches: buckets.size };
}

/** Collapse a small rig's static parts into one vertex-coloured mesh per
 *  moving part. `parts` are the sub-groups that animate independently. */
export function compact(rootGroup, parts = []) {
  const owners = [rootGroup, ...parts];
  const ownerOf = (o) => { for (let p = o.parent; p; p = p.parent) if (owners.includes(p)) return p; return null; };
  const lists = new Map(owners.map((g) => [g, []]));
  rootGroup.updateWorldMatrix(true, true);
  rootGroup.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || o.material.transparent || o.material.map) return;
    const owner = ownerOf(o); if (!owner) return;
    lists.get(owner).push(o);
  });
  for (const [owner, meshes] of lists) {
    if (meshes.length < 2) continue;
    const inv = owner.matrixWorld.clone().invert(), geos = [];
    for (const o of meshes) {
      const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      for (const a of Object.keys(geo.attributes)) if (!['position', 'normal'].includes(a)) geo.deleteAttribute(a);
      const n = geo.attributes.position.count, c = new Float32Array(n * 3), col = o.material.color;
      for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); geos.push(geo);
      o.removeFromParent();
    }
    const merged = mergeGeometries(geos, false); geos.forEach((g) => g.dispose());
    const m = new THREE.Mesh(merged, compactMaterial()); m.castShadow = true; m.receiveShadow = true; m.name = `${owner.name || 'rig'}-compact`;
    owner.add(m);
  }
  return rootGroup;
}
let compactMat = null;
function compactMaterial() { return compactMat ??= toonMaterial(0xffffff, { vertexColors: true, paint: 0.03 }); }
