// Smooth cel-shaded foliage for Chandrapur, ported from Sakura Crossing's
// foliage library (the shrub core): welded, indexed cloud surfaces built
// from round leaf puffs, with normals blended toward the ellipsoid so the
// toon ramp gives soft painted terminators and clean scalloped silhouettes.
// Colour (moonlit top -> body -> cool base) is baked into vertex colours.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

function hash3(x, y, z, s) {
  let h = Math.imul((x | 0) ^ Math.imul(s, 0x27d4eb2d), 0x85ebca6b) ^ Math.imul(y | 0, 0xc2b2ae35) ^ Math.imul(z | 0, 0x165667b1);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, s);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v),
    L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
/** billowy cloud bumps in [0,1] */
function billow(x, y, z, s) {
  let a = 0, amp = 0.62, f = 1;
  for (let o = 0; o < 3; o++) { a += amp * (1 - Math.abs(vnoise(x * f, y * f, z * f, s + o * 17) * 2 - 1)); amp *= 0.45; f *= 2.03; }
  return a / 1.05;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Dart-throw puff centres on the (base) surface vertices. */
function samplePuffs(P, n, cell, seed, ok) {
  const order = new Array(n);
  for (let i = 0; i < n; i++) order[i] = [hash3(i, 7, 3, seed), i];
  order.sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [, i] of order) {
    if (ok && !ok(i)) continue;
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    const md = cell * (0.8 + 0.3 * hash3(i, 1, 9, seed)), md2 = md * md;
    let good = true;
    for (let k = 0; k < out.length; k++) { const q = out[k]; const dx = q[0] - x, dy = q[1] - y, dz = q[2] - z; if (dx * dx + dy * dy + dz * dz < md2) { good = false; break; } }
    if (good) out.push([x, y, z, cell * (0.66 + 0.26 * hash3(i, 5, 2, seed))]);
  }
  return out;
}
/** Smooth union of dome profiles at (x,y,z): [height 0..1, best-second] */
function puffField(puffs, x, y, z, shape = 0.55) {
  let s = 0, h1 = 0, h2 = 0;
  for (let k = 0; k < puffs.length; k++) {
    const q = puffs[k]; const dx = q[0] - x, dy = q[1] - y, dz = q[2] - z; const d2 = (dx * dx + dy * dy + dz * dz) / (q[3] * q[3]);
    if (d2 >= 1) continue;
    const h = Math.pow(1 - d2, shape);
    s += Math.exp(10 * h);
    if (h > h1) { h2 = h1; h1 = h; } else if (h > h2) h2 = h;
  }
  const hs = s > 0 ? Math.max(0, Math.min(1, Math.log(s) / 10)) : 0;
  return [hs, h1 - h2];
}

/** Bake vertex colours: vertical gradient, puff light/valley dark, clump patches. */
function bakeColors(g, o) {
  const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
  const C = o.colors || {};
  const top = new THREE.Color(C.top || '#a9cf7c'), mid = new THREE.Color(C.mid || '#6fa35c'), low = new THREE.Color(C.base || '#4a7a5a');
  const col = new Float32Array(n * 3), c = new THREE.Color();
  const H = o.H, seed = o.seed, ph = o.puffH, vl = o.valley, dark = o.dark ?? 0.2;
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const t = y / H;
    if (t > 0.55) c.copy(mid).lerp(top, smooth(0.55, 1.0, t)); else c.copy(low).lerp(mid, smooth(0.0, 0.55, t));
    const v = vnoise(x * 1.7 + 3, y * 1.7, z * 1.7 - 2, seed + 91) - 0.5;
    c.offsetHSL(v * 0.02, v * 0.05, v * 0.05);
    if (ph) {
      const h = ph[i], ny = nor.getY(i);
      if (h > 0.55 && ny > 0.1 && t > 0.3) c.lerp(top, 0.28 * smooth(0.55, 0.95, h) * smooth(0.1, 0.6, ny));
      c.multiplyScalar(1 - dark + dark * smooth(0.05, 0.5, h));
      if (vl && vl[i] < 0.12 && h < 0.45) c.multiplyScalar(0.93);
    } else {
      const cl = billow(x * 3.0 + 1.3, y * 3.0 - 2.2, z * 3.0 + 0.7, seed + 53);
      if (cl > 0.66 && t > 0.35) c.lerp(top, 0.35); else if (cl < 0.3 && t < 0.7) c.multiplyScalar(0.86);
    }
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

function cutBelow(g, y0) {
  const idx = g.index.array, pos = g.attributes.position, keep = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    if (Math.max(pos.getY(a), pos.getY(b), pos.getY(c)) < y0) continue;
    keep.push(a, b, c);
  }
  g.setIndex(keep);
}

function blendNormals(g, base, blend) {
  const nor = g.attributes.normal, n = new THREE.Vector3(), b = new THREE.Vector3();
  for (let i = 0; i < nor.count; i++) {
    n.fromBufferAttribute(nor, i); b.set(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]);
    n.lerp(b, blend).normalize();
    nor.setXYZ(i, n.x, n.y, n.z);
  }
}

const _ico = new Map();
function icoBase(detail) {
  let g = _ico.get(detail);
  if (!g) { g = new THREE.IcosahedronGeometry(1, detail); g.deleteAttribute('uv'); g.deleteAttribute('normal'); g = mergeVertices(g, 1e-5); _ico.set(detail, g); }
  return g.clone();
}

const _cache = new Map();

// Chandrapur's night-greens: moonlit crowns, cool shadowed bases
export const NIGHT_GREENS = { top: '#6cc48e', mid: '#38905f', base: '#1e5a48' };
export const NIGHT_GREENS_DARK = { top: '#55a878', mid: '#2c7a50', base: '#1a4e40' };

/** Smooth lumpy shrub/canopy blob made of round leaf puffs.
 *  Origin = ground contact centre. See Sakura's foliage.js for the full
 *  parameter doc; the defaults here are tuned for tree canopies at night. */
export function shrubGeometry(o = {}) {
  const rx = o.rx ?? 0.6, ry = o.ry ?? 0.5, rz = o.rz ?? 0.6;
  const lumps = o.lumps ?? 0.22, freq = o.freq ?? 2.2, square = o.square ?? 1, seed = (o.seed ?? 1) | 0;
  const size = Math.max(rx, ry, rz), reff = (rx + ry + rz) / 3;
  let detail = o.detail;
  if (detail === undefined) {
    const sp = o.spacing ?? 0.09;
    detail = Math.round((reff * 1.1) / sp) - 1;
  }
  detail = Math.max(1, Math.min(o.maxDetail ?? 11, detail | 0));
  const spacing = (reff * 1.1) / (detail + 1);
  const puff = o.puff ?? Math.max(spacing * 3.6, Math.min(0.55, 0.16 + size * 0.3));
  const puffAmp = o.puffAmp ?? 0.42;
  const puffShape = o.puffShape ?? 0.5;
  const flat = o.flatBottom ?? true;
  const key = JSON.stringify(['ch-s2', rx, ry, rz, lumps, freq, square, seed, detail, flat, o.colors, puff, puffAmp, o.normalBlend ?? null, o.cutBottom ?? true, o.scallop ?? null, puffShape, o.dark ?? null]);
  if (_cache.has(key)) return _cache.get(key);

  const g = icoBase(detail);
  const pos = g.attributes.position, n = pos.count;
  const base = new Float32Array(n * 3);
  const p = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(pos, i);
    const d = p.clone().normalize();
    const bump = billow(d.x * freq * size + 11.3, d.y * freq * size + 3.7, d.z * freq * size - 5.1, seed);
    let r = 1 + lumps * (bump - 0.55);
    if (o.scallop) { const sf = 3.2 * size; r += o.scallop * (billow(d.x * sf + 2.1, d.y * sf - 7.3, d.z * sf + 4.4, seed + 37) - 0.5); }
    p.multiplyScalar(r);
    p.set(p.x * rx, p.y * ry, p.z * rz);
    if (flat && p.y < -ry * 0.55) p.y = -ry * 0.55 + (p.y + ry * 0.55) * 0.25;
    pos.setXYZ(i, p.x, p.y + ry * 0.55, p.z);
    nn.set(p.x / (rx * rx), p.y / (ry * ry), p.z / (rz * rz)).normalize();
    base[i * 3] = nn.x; base[i * 3 + 1] = nn.y; base[i * 3 + 2] = nn.z;
  }
  const H = ry * 2 * 0.86;
  let ph = null, vl = null;
  if (puff > 0 && puffAmp > 0) {
    const P = pos.array;
    const puffs = samplePuffs(P, n, puff, seed + 3, (i) => P[i * 3 + 1] > H * 0.08);
    ph = new Float32Array(n); vl = new Float32Array(n);
    const amp = puffAmp * puff;
    for (let i = 0; i < n; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      const [h, sep] = puffField(puffs, x, y, z, puffShape);
      ph[i] = h; vl[i] = sep;
      const fade = smooth(0.0, H * 0.22, y);
      const dd = amp * (h - 0.5) * fade;
      pos.setXYZ(i, x + base[i * 3] * dd, y + base[i * 3 + 1] * dd * 0.9, z + base[i * 3 + 2] * dd);
    }
  }
  g.computeVertexNormals();
  blendNormals(g, base, o.normalBlend ?? (ph ? 0.6 : 0.55));
  bakeColors(g, { colors: o.colors, H, seed, puffH: ph, valley: vl, dark: o.dark });
  if (o.cutBottom ?? true) cutBelow(g, -0.004);
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2));
  g.computeBoundingBox(); g.computeBoundingSphere();
  g.userData.foliage = { H, spacing, puff };
  _cache.set(key, g);
  return g;
}
