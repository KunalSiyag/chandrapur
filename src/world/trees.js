import * as THREE from 'three';
import { toonMaterial } from '../core/toon.js';
import { groundHeight, pathAt, HILL_ROAD, PAD, STREET } from './layout.js';
import { addCircle } from './colliders.js';
import { shrubGeometry, NIGHT_GREENS, NIGHT_GREENS_DARK } from './foliage.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ============================================================
// Chandrapur's trees, after Sakura Crossing's foliage lesson:
// canopies are welded cloud surfaces of round leaf puffs
// (scalloped painted silhouettes, soft toon terminators —
// never faceted low-poly balls), merged from several offset
// blobs per variant and instanced. And because this is an
// Indian bazaar: two big peepal trees grow in the MIDDLE of
// the lane, the way they really do.
// ============================================================

function rand(s) { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

/** one merged multi-blob canopy: a big crown + satellites, baked vertex colours */
function canopyGeometry(seed, { blobs = 4, spread = 1.0, tall = 1.0, dark = false } = {}) {
  const parts = [];
  const C = dark ? NIGHT_GREENS_DARK : NIGHT_GREENS;
  const n = Math.max(2, blobs);
  // the main crown
  parts.push(shrubGeometry({
    rx: 2.6 * spread, ry: 2.1 * tall, rz: 2.6 * spread,
    lumps: 0.26, freq: 2.3, seed, spacing: 0.2, scallop: 0.09, puffAmp: 0.5, colors: C, dark: 0.22,
  }));
  // satellite crowns huddled around it
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + seed;
    const r = (0.55 + rand(seed + i * 7) * 0.5) * spread;
    const g = shrubGeometry({
      rx: (1.1 + rand(seed + i * 3) * 0.7) * spread,
      ry: (0.9 + rand(seed + i * 5) * 0.6) * tall,
      rz: (1.1 + rand(seed + i * 3) * 0.7) * spread,
      lumps: 0.28, freq: 2.6, seed: seed + 40 + i * 13, spacing: 0.22, scallop: 0.11, puffAmp: 0.52, colors: C, dark: 0.24,
    });
    g.translate(Math.cos(a) * 2.1 * spread, 1.15 * tall + rand(seed + i) * 1.1 * tall, Math.sin(a) * 2.1 * spread);
    parts.push(g);
  }
  return mergeGeometries(parts, false);
}

/** a conifer spire (deodar): two stacked cloud tiers on a stem */
function coniferGeometry(seed) {
  const parts = [];
  parts.push(shrubGeometry({ rx: 1.5, ry: 2.5, rz: 1.5, lumps: 0.32, freq: 2.8, seed, spacing: 0.2, scallop: 0.14, puffAmp: 0.5, flatBottom: true, colors: NIGHT_GREENS_DARK, dark: 0.26 }));
  parts.push(shrubGeometry({ rx: 0.95, ry: 1.7, rz: 0.95, lumps: 0.3, freq: 3.0, seed: seed + 7, spacing: 0.24, colors: NIGHT_GREENS_DARK, dark: 0.26 }));
  parts[1].translate(0, 3.1, 0);
  return mergeGeometries(parts, false);
}

// [type, x, z, scale] — 'b' broadleaf, 'c' conifer
const PLACED = [
  // the street-mouth tree the moon rises behind, seen from the square
  ['b', -6.5, 27.5, 1.35],
  // riverside accents along the promenade (frames the water gap)
  ['b', -24, 28.2, 1.05], ['b', -40, 27.6, 1.5], ['b', -54, 27.8, 1.1],
  // screening the railway's west end + flanking the crossing road
  ['b', -34, 1.5, 1.2], ['c', -26, -6.5, 1.0], ['c', -22, -10.5, 0.9],
  ['b', -38, -8.5, 1.15], ['b', -46, -7, 1.0], ['c', -56, -8, 1.2], ['c', -63, -9.5, 1.3],
  // railway's east end
  ['b', 42, -10, 1.1], ['c', 48, -8.5, 1.2], ['b', 54, -11, 1.25], ['c', 60, -9, 1.4], ['c', 66, -10, 1.1],
  // the cutting's flanks (hill bisected by the rail)
  ['c', -38, -25, 1.2], ['c', -44, -25.5, 1.4], ['c', -62, -26, 1.5], ['c', -68, -30, 1.4], ['c', -74, -34, 1.3],
  ['c', -44, -4.5, 1.1], ['c', -56, -5, 1.3],
  // north backdrop behind the station
  ['c', -14, -26, 1.1], ['c', -8, -30, 1.3], ['c', -2, -27, 1.0], ['c', 4, -31, 1.2],
  ['b', 12, -28, 1.0], ['c', 18, -30, 1.1], ['b', 26, -27, 0.9], ['c', 34, -30, 1.2],
  // east rail-side houses' gardens
  ['b', 19, -10.5, 0.9], ['b', 28, -11, 1.0],
  // south bank — seen across the water
  ['b', 0, 51.5, 1.3], ['b', 12, 54.5, 1.1], ['b', 20, 46, 0.95], ['b', 30, 49.5, 1.2], ['b', -12, 52, 1.15],
  // beside the terrace (its little grove)
  ['b', 29.5, 46.5, 1.0], ['c', 31.5, 51, 1.0],
  // a garden tree inside town, behind the shops
  ['b', -14.5, 24, 0.85], ['b', 15, 22, 0.95],
];

// plantation blocks on the hill
const BLOCKS = [
  { cx: -46, cz: -47, w: 18, d: 12, rot: 0.5, grid: 3.4 },
  { cx: -62, cz: -38, w: 14, d: 10, rot: -0.35, grid: 3.2 },
];

// ---- the street-median peepals: trees in the middle of the road ----
const MEDIAN = [
  { x: 0, z: 8, h: 7.2, crown: 3.4, seed: 71 },
  { x: 0, z: 17, h: 8.2, crown: 3.8, seed: 72 },
];

/** a gnarly peepal: bent trunk with limbs reaching into the crown */
function makePeepal({ h, crown, seed }) {
  const g = new THREE.Group();
  const trunkMat = toonMaterial(0x6a4f38, { paint: 0.05 });
  const lean = (rand(seed) - 0.5) * 0.16;
  const segs = 6;
  let topX = 0, topY = 0;
  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.34 - t * 0.16, 0.38 - t * 0.15, h / segs, 10), trunkMat);
    seg.position.set(topX + lean * h * t, (i + 0.5) * (h / segs), 0);
    seg.rotation.z = -lean * 0.9;
    seg.castShadow = true;
    g.add(seg);
    topX = seg.position.x; topY = (i + 1) * (h / segs);
  }
  // limbs: three branches splitting off near the top
  const limbs = 3 + Math.floor(rand(seed + 3) * 2);
  for (let i = 0; i < limbs; i++) {
    const a = (i / limbs) * Math.PI * 2 + rand(seed + i) * 1.2;
    const len = crown * (0.55 + rand(seed + i * 5) * 0.35);
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.17, len, 8), trunkMat);
    limb.position.set(topX + Math.cos(a) * len * 0.4, topY + len * 0.32, Math.sin(a) * len * 0.4);
    limb.lookAt(new THREE.Vector3(topX + Math.cos(a) * len * 0.9, topY + len * 0.75, Math.sin(a) * len * 0.9));
    limb.rotateX(Math.PI / 2);
    limb.castShadow = true;
    g.add(limb);
  }
  // the crown: a big merged canopy at the top
  const canopy = new THREE.Mesh(canopyGeometry(seed, { blobs: 4, spread: crown / 2.6, tall: 0.8 }), foliageMat());
  canopy.position.set(topX, topY - crown * 0.25, 0);
  canopy.castShadow = true;
  canopy.receiveShadow = false;
  g.add(canopy);
  g.name = 'peepal';
  return g;
}

let _foliageMat = null;
function foliageMat() {
  if (!_foliageMat) _foliageMat = toonMaterial(0xffffff, { vertexColors: true, paint: 0.02 });
  return _foliageMat;
}

export function createTrees(scene) {
  const group = new THREE.Group();
  group.name = 'trees';

  const list = [...PLACED];
  for (const b of BLOCKS) {
    const cos = Math.cos(b.rot), sin = Math.sin(b.rot);
    const nx = Math.round(b.w / b.grid), nz = Math.round(b.d / b.grid);
    for (let i = 0; i <= nx; i++) {
      for (let j = 0; j <= nz; j++) {
        const lx = (i - nx / 2) * b.grid, lz = (j - nz / 2) * b.grid;
        const x = b.cx + lx * cos - lz * sin;
        const z = b.cz + lx * sin + lz * cos;
        const road = pathAt(HILL_ROAD, x, z);
        const pad = Math.hypot(x - PAD.x, z - PAD.z);
        const h = groundHeight(x, z);
        if (road.d < 4.5 || pad < PAD.r + 3 || h < 2.5 || h > 14) continue;
        list.push(['c', x, z, 0.8 + rand(i * 7 + j * 13) * 0.5]);
      }
    }
  }

  // ---- canopy + trunk instancing, per variant geometry ----
  const bSeeds = [21, 22, 23];
  const cSeeds = [31, 32];
  const broadGeo = bSeeds.map((s) => canopyGeometry(s, { blobs: 3 + (s % 2), spread: 1.0, tall: 1.0 }));
  const conifGeo = cSeeds.map((s) => coniferGeometry(s));

  // trunks: smooth tapered cylinders (10-sided), slightly bent per variant
  const trunkGeo = new THREE.CylinderGeometry(0.13, 0.36, 2.6, 10, 4);
  {
    const p = trunkGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const t = (y + 1.3) / 2.6;                 // 0 at the base
      p.setX(i, p.getX(i) + Math.sin(y * 0.9) * 0.06 + (1 - t) * 0.05); // lean + root flare
      p.setZ(i, p.getZ(i) * (1 + (1 - t) * 0.25));
    }
    trunkGeo.computeVertexNormals();
  }
  const cTrunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 1.6, 9, 2);
  const trunkMat = toonMaterial(0x6a4f38, { paint: 0.05 });
  const cTrunkMat = toonMaterial(0x5a4634, { paint: 0.05 });

  const nB = list.filter((t) => t[0] === 'b').length;
  const nC = list.length - nB;
  const nBM = nB * bSeeds.length, nCM = nC * cSeeds.length;

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, nB);
  const cTrunks = new THREE.InstancedMesh(cTrunkGeo, cTrunkMat, nC);
  trunks.castShadow = cTrunks.castShadow = true;
  trunks.receiveShadow = cTrunks.receiveShadow = true;

  // one InstancedMesh per canopy variant (all share the foliage material)
  const bMeshes = broadGeo.map((geo) => {
    const m = new THREE.InstancedMesh(geo, foliageMat(), nB);
    m.castShadow = true;
    m.receiveShadow = false; // night canopies stay flat lit masses
    group.add(m);
    return m;
  });
  const cMeshes = conifGeo.map((geo) => {
    const m = new THREE.InstancedMesh(geo, foliageMat(), nC);
    m.castShadow = true;
    m.receiveShadow = false;
    group.add(m);
    return m;
  });
  const bCount = new Array(bSeeds.length).fill(0);
  const cCount = new Array(cSeeds.length).fill(0);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const sc = new THREE.Vector3();
  const pv = new THREE.Vector3();
  let bi = 0, ci = 0;

  for (const [type, x, z, s] of list) {
    const y = groundHeight(x, z);
    addCircle(x, z, (type === 'b' ? 0.34 : 0.28) * s + 0.12);
    const lean = (rand(x * 3.1 + z) - 0.5) * 0.1;
    e.set(lean, rand(x + z * 7) * Math.PI, lean * 0.6);
    q.setFromEuler(e);
    if (type === 'b') {
      const vi = bi % bSeeds.length;
      m.compose(pv.set(x, y + 1.25 * s, z), q, sc.set(s, s, s));
      trunks.setMatrixAt(bi, m);
      m.compose(pv.set(x, y + 3.0 * s, z), q, sc.set(s, s, s));
      bMeshes[vi].setMatrixAt(bCount[vi]++, m);
      bi++;
    } else {
      const vi = ci % cSeeds.length;
      m.compose(pv.set(x, y + 0.75 * s, z), q, sc.set(s, s, s));
      cTrunks.setMatrixAt(ci, m);
      m.compose(pv.set(x, y + 0.55 * s, z), q, sc.set(s, s, s));
      cMeshes[vi].setMatrixAt(cCount[vi]++, m);
      ci++;
    }
  }
  for (let i = 0; i < bMeshes.length; i++) bMeshes[i].count = bCount[i];
  for (let i = 0; i < cMeshes.length; i++) cMeshes[i].count = cCount[i];
  group.add(trunks, cTrunks);

  // ---- the peepals in the middle of the lane (the Indian street way) ----
  for (const spec of MEDIAN) {
    const tree = makePeepal(spec);
    tree.position.set(spec.x, groundHeight(spec.x, spec.z), spec.z);
    tree.rotation.y = spec.seed * 1.7;
    group.add(tree);
    addCircle(spec.x, spec.z, 0.62);
  }

  scene.add(group);
  return { group };
}
