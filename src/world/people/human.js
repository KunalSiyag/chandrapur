// The people of Chandpur, built the Sakura Crossing way: one SkinnedMesh
// per person (welded smooth parts, GPU skinning — no joint seams), a painted
// face atlas, and Indian garments — kurta-pyjama, saree with a pleated
// drape and swaying pallu, salwar-kameez with dupatta, school uniforms —
// dressed over a shared skeleton with clavicles and 8-bone skirts.
import * as THREE from 'three';
import { surface, rings, limb, sweep, curve, ellipsoid, rbox, SkinBuilder, TAU, DEG, clamp, lerp, smooth } from './skin.js';
import { faceUV, hairUV, cellUV, makeAtlas } from './atlas.js';
import { toonMaterial } from '../../core/toon.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ proportions (from Sakura)
const BASE = {
  f: {
    H: 1.58, hip: 0.80, hipJx: 0.079, hipJy: 0.785, thigh: 0.372, shin: 0.352, ankle: 0.061,
    waist: 0.935, chest: 1.08, neck: 1.262, headB: 1.326, shX: 0.148, shY: 1.232, clavX: 0.03,
    uarm: 0.238, farm: 0.212, hand: 0.86,
    torso: [[0.80, 0.128, 0.099], [0.85, 0.126, 0.096], [0.90, 0.119, 0.089], [0.95, 0.110, 0.080], [1.00, 0.106, 0.075], [1.05, 0.112, 0.081],
      [1.10, 0.124, 0.089], [1.15, 0.135, 0.093], [1.19, 0.143, 0.089], [1.222, 0.142, 0.082], [1.246, 0.12, 0.07], [1.262, 0.074, 0.05], [1.28, 0.034, 0.03]],
    bust: 0.02, bustY: 1.13, neckR: 0.031,
    head: { rx: 0.098, ry: 0.109, rz: 0.104, cy: 0.135, cz: 0.014, jaw: 0.44, chin: 0.28, chinZ: 0.5, flat: 0.93 },
    thighR: [0.072, 0.046], calfR: 0.05, ankleR: 0.027, uarmR: [0.034, 0.028], farmR: [0.027, 0.021],
    pelvis: [[0.955, 0.112, 0.083], [0.90, 0.13, 0.097], [0.84, 0.136, 0.10], [0.785, 0.118, 0.088], [0.745, 0.06, 0.05], [0.735, 0, 0]],
  },
  m: {
    H: 1.72, hip: 0.90, hipJx: 0.09, hipJy: 0.875, thigh: 0.41, shin: 0.395, ankle: 0.07,
    waist: 1.03, chest: 1.19, neck: 1.405, headB: 1.472, shX: 0.186, shY: 1.37, clavX: 0.035,
    uarm: 0.275, farm: 0.245, hand: 0.98,
    torso: [[0.86, 0.150, 0.108], [0.93, 0.148, 0.104], [1.00, 0.144, 0.100], [1.07, 0.146, 0.101], [1.14, 0.155, 0.104], [1.21, 0.166, 0.107],
      [1.28, 0.176, 0.105], [1.33, 0.181, 0.099], [1.36, 0.176, 0.090], [1.383, 0.152, 0.080], [1.40, 0.102, 0.060], [1.418, 0.046, 0.042]],
    bust: 0, bustY: 1.25, neckR: 0.041,
    head: { rx: 0.095, ry: 0.107, rz: 0.103, cy: 0.131, cz: 0.012, jaw: 0.32, chin: 0.22, chinZ: 0.42, flat: 0.95 },
    thighR: [0.082, 0.053], calfR: 0.057, ankleR: 0.031, uarmR: [0.044, 0.036], farmR: [0.036, 0.027],
    pelvis: [[1.05, 0.146, 0.101], [0.99, 0.152, 0.106], [0.93, 0.154, 0.106], [0.875, 0.134, 0.094], [0.83, 0.07, 0.055], [0.815, 0, 0]],
  },
};

function proportions(spec) {
  const b = BASE[spec.sex || 'f'];
  const k = (spec.height || b.H) / b.H;
  const w = spec.width ?? 1;
  const hk = spec.headK ?? 1;
  const P = { k, w, hk, sex: spec.sex || 'f' };
  for (const key of ['hip', 'hipJy', 'thigh', 'shin', 'ankle', 'waist', 'chest', 'neck', 'headB', 'shY', 'uarm', 'farm', 'bustY']) P[key] = b[key] * k;
  P.hipJx = b.hipJx * k * w; P.shX = (b.shX - 0.006) * k * (spec.shoulder ?? w); P.clavX = b.clavX * k; P.shY -= 0.01 * k;
  P.torso = b.torso.map(([y, a, bb]) => [y * k, a * k * w, bb * k * w]);
  if (spec.belly) P.torso = P.torso.map(([y, a, bb]) => { const f = 1 + spec.belly * Math.exp(-((((y / k) - (b.waist + 0.02)) / 0.12) ** 2)); return [y, a * f, bb * f * 1.04]; });
  P.pelvis = b.pelvis.map(([y, a, bb]) => [y * k, a * k * w, bb * k * w]);
  P.bust = b.bust * k * (spec.bust ?? 1);
  P.neckR = b.neckR * k * Math.sqrt(w);
  P.hand = b.hand * k;
  P.head = { ...b.head };
  for (const key of ['rx', 'ry', 'rz', 'cy', 'cz']) P.head[key] = b.head[key] * k * hk;
  P.thighR = b.thighR.map(r => r * k * w); P.calfR = b.calfR * k * w; P.ankleR = b.ankleR * k * Math.sqrt(w);
  P.uarmR = b.uarmR.map(r => r * k * w); P.farmR = b.farmR.map(r => r * k * w);
  {
    // outer garment profile = torso, widened below the waist so kurtas always cover the hips
    const pel = P.pelvis.filter(r => r[1] > 0).slice().sort((a, c) => a[0] - c[0]);
    const pAt = (y) => { if (y <= pel[0][0]) return [pel[0][1], pel[0][2]]; for (let i = 1; i < pel.length; i++) if (y <= pel[i][0]) { const t = (y - pel[i - 1][0]) / (pel[i][0] - pel[i - 1][0]); return [lerp(pel[i - 1][1], pel[i][1], t), lerp(pel[i - 1][2], pel[i][2], t)]; } const l = pel[pel.length - 1]; return [l[1], l[2]]; };
    const ys = [...new Set([...P.torso.map(r => r[0]), ...pel.map(r => r[0])].map(y => +y.toFixed(4)))].sort((a, c) => a - c);
    P.outer = ys.map((y) => { const [a, bb] = prof(P.torso, y); if (y > P.waist + 0.03 * k) return [y, a, bb]; const [pa, pb] = pAt(y); return [y, Math.max(a, pa * 1.085), Math.max(bb, pb * 1.09)]; });
  }
  return P;
}

/** interpolate [y,a,b] profile at y */
function prof(tab, y) {
  if (y <= tab[0][0]) return [tab[0][1], tab[0][2]];
  for (let i = 1; i < tab.length; i++) {
    if (y <= tab[i][0]) { const t = (y - tab[i - 1][0]) / (tab[i][0] - tab[i - 1][0]); return [lerp(tab[i - 1][1], tab[i][1], t), lerp(tab[i - 1][2], tab[i][2], t)]; }
  }
  const l = tab[tab.length - 1]; return [l[1], l[2]];
}

export class Human {
  constructor(spec) {
    this.spec = spec;
    this.P = proportions(spec);
    this.B = new SkinBuilder('chr_' + spec.key);
    this.group = new THREE.Group(); this.group.name = 'chr_' + spec.key;
    this.b = {};
    this.skirtBones = []; this.hairChains = [];
    this.seed = spec.seed ?? 1;
    this._skeleton();
    this._head();
    this._hair();
    this._outfit();
    if (spec.props) for (const p of spec.props) p(this);
    // atlas & material (face variants)
    const aspec = { key: spec.key, face: spec.face, hair: spec.hairTex, stripes: spec.stripes, misc: spec.misc };
    const variants = spec.variants || ['open', 'blink'];
    this.mats = {};
    for (const v of variants) this.mats[v] = toonMaterial('#ffffff', { map: makeAtlas(aspec, v), vertexColors: true, side: THREE.DoubleSide, paint: 0.025 });
    this.mesh = this.B.build(this.group, this.mats[variants[0]]);
    this.mesh.frustumCulled = true;
    this.face = variants[0];
    this.tris = this.B.triangles;
    this.rest = new Map();
    for (const bone of this.B.bones) this.rest.set(bone, {
      p: bone.position.clone(), q: bone.quaternion.clone(), s: bone.scale.clone(),
    });
    // convenient world attach point for outside props (kite line etc.)
    this.handWorld = { L: new THREE.Vector3(), R: new THREE.Vector3() };
  }

  setFace(v) { if (v !== this.face && this.mats[v]) { this.mesh.material = this.mats[v]; this.face = v; } }

  // -------------------------------------------------------------- skeleton
  _skeleton() {
    const { B, P } = this; const b = this.b;
    b.root = B.bone('root', null, 0, 0, 0); this.group.add(b.root);
    b.hips = B.bone('hips', b.root, 0, P.hip, 0);
    b.spine = B.bone('spine', b.hips, 0, P.waist - P.hip, 0);
    b.chest = B.bone('chest', b.spine, 0, P.chest - P.waist, 0);
    b.neck = B.bone('neck', b.chest, 0, P.neck - P.chest, -0.004 * P.k);
    b.head = B.bone('head', b.neck, 0, P.headB - P.neck, -0.006 * P.k);
    for (const s of [1, -1]) {
      const n = s > 0 ? 'L' : 'R';
      b['clav' + n] = B.bone('clav' + n, b.chest, s * P.clavX, P.shY - P.chest, 0);
      b['uarm' + n] = B.bone('uarm' + n, b['clav' + n], s * (P.shX - P.clavX), 0, 0);
      b['farm' + n] = B.bone('farm' + n, b['uarm' + n], 0, -P.uarm, 0);
      b['hand' + n] = B.bone('hand' + n, b['farm' + n], 0, -P.farm, 0);
      b['thigh' + n] = B.bone('thigh' + n, b.hips, s * P.hipJx, P.hipJy - P.hip, 0);
      b['shin' + n] = B.bone('shin' + n, b['thigh' + n], 0, -P.thigh, 0);
      b['foot' + n] = B.bone('foot' + n, b['shin' + n], 0, -P.shin, 0);
      // IK needs the ankle's actual bind offset from the knee (-P.shin).
      // Keep the sole contact separate; replacing rest shortens the IK chain.
      b['foot' + n].userData.soleOffset = V(0, -P.ankle, 0);
    }
  }
  bindPos(bone) { return this.B.bindPos(bone); }
  /** convert root-space point to bone-local (bind has identity rotations) */
  local(bone, p) { const q = this.B.bindPos(bone); return [p[0] - q[0], p[1] - q[1], p[2] - q[2]]; }
  add(geo, o) { this.B.add(geo, o); }

  // -------------------------------------------------------------- head + painted face
  headPt(ph, th, R = 1) {
    const h = this.P.head;
    const cs = Math.cos(th);
    let x = Math.sin(ph) * cs, y = Math.sin(th), z = Math.cos(ph) * cs;
    x *= h.rx * R; z *= h.rz * R;
    if (y >= 0) y *= h.ry * R;
    else {
      const t = -y;
      x *= 1 - h.jaw * t * t;
      y = -h.ry * R * t * (1 + h.chin * t);
      if (z < 0) z *= 1 - 0.32 * t;
      z += h.chinZ * h.rz * R * t * t * (0.75 + 0.25 * Math.cos(ph) * cs);
    }
    if (z > 0) z *= h.flat;
    return [x, y + h.cy, z + h.cz];
  }
  _head() {
    const { P, b } = this; const sp = this.spec;
    const skin = sp.skin || '#e8b48e';
    const nr = P.neckR;
    this.add(rings([{ y: -0.045 * P.k, a: nr * 1.25, b: nr * 1.1 }, { y: 0, a: nr, b: nr }, { y: (P.headB - P.neck) * 0.6, a: nr * 0.96, b: nr * 0.96 }, { y: (P.headB - P.neck) + 0.03 * P.k, a: nr * 0.94, b: nr * 0.94 }], 10), { bone: b.neck, color: skin });
    const cols = 26, rows = 18;
    const g = surface(cols, rows, (u, v) => { const ph = (u - 0.5) * TAU, th = (0.5 - v) * Math.PI; return this.headPt(ph, th, 1); });
    {
      // bend face normals toward the face direction so the cel terminator never slices across the face
      const n = g.attributes.normal, p = g.attributes.position, F = new THREE.Vector3(0, 0.08, 1).normalize(), q = new THREE.Vector3(), q2 = new THREE.Vector3();
      const c0 = new THREE.Vector3(0, P.head.cy, P.head.cz - P.head.rz * 0.6);
      for (let i = 0; i < n.count; i++) {
        q.set(p.getX(i), p.getY(i), p.getZ(i)).sub(c0).normalize();
        q.lerp(q2.set(n.getX(i), n.getY(i), n.getZ(i)), 0.35).normalize();
        q.lerp(F, smooth(-0.15, 0.55, q.z) * 0.72).normalize();
        n.setXYZ(i, q.x, q.y, q.z);
      }
      n.needsUpdate = true;
    }
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const ph = (uv.getX(i) - 0.5) * 360, th = (0.5 - uv.getY(i)) * 180;
      const f = faceUV(ph, th); uv.setXY(i, f[0], f[1]);
    }
    this.add(g, { bone: b.head, color: '#ffffff', rect: [0, 0, 1, 1] });
    // ears
    if (sp.ears !== false) for (const s of [1, -1]) {
      const p = this.headPt(s * 88 * DEG, -10 * DEG, 0.99);
      this.add(ellipsoid(0.012 * P.k, 0.026 * P.k * P.hk, 0.018 * P.k, p, 8, 6), { bone: b.head, color: skin });
    }
  }

  // -------------------------------------------------------------- hands + chappals
  _hand(bone, s, color, style = 'relax') {
    const k = this.P.hand;
    const add = (g) => this.add(g, { bone, color });
    const inward = -s;
    if (style === 'fist' || style === 'grip' || style === 'hold') {
      add(ellipsoid(0.021 * k, 0.036 * k, 0.037 * k, [0, -0.034 * k, 0.004 * k], 8, 6));
      add(ellipsoid(0.02 * k, 0.024 * k, 0.03 * k, [inward * 0.006 * k, -0.062 * k, 0.018 * k], 8, 5));
      add(ellipsoid(0.01 * k, 0.022 * k, 0.011 * k, [inward * 0.012 * k, -0.04 * k, 0.03 * k], 6, 4));
    } else {
      add(ellipsoid(0.02 * k, 0.046 * k, 0.037 * k, [inward * 0.002 * k, -0.046 * k, 0.003 * k], 8, 6));
      add(ellipsoid(0.017 * k, 0.03 * k, 0.034 * k, [inward * 0.005 * k, -0.085 * k, 0.006 * k], 8, 5));
      add(ellipsoid(0.01 * k, 0.024 * k, 0.011 * k, [inward * 0.01 * k, -0.034 * k, 0.03 * k], 6, 4));
    }
  }
  _chappal(bone, s) {
    const P = this.P, k = P.k;
    const a = P.ankle;
    const len = (P.sex === 'm' ? 0.26 : 0.225) * k, wid = (P.sex === 'm' ? 0.095 : 0.08) * k;
    const hh = 0.045 * k;
    const g = surface(12, 6, (u, v) => {
      const ph = (u - 0.5) * TAU, th = (0.5 - v) * Math.PI;
      const e = (x) => Math.sign(x) * Math.pow(Math.abs(x), 0.55);
      let x = e(Math.sin(ph)) * e(Math.cos(th)) * wid / 2, y = e(Math.sin(th)) * hh / 2, z = e(Math.cos(ph)) * e(Math.cos(th)) * len / 2;
      const f = z / (len / 2);
      if (f > 0) { x *= 1 - 0.18 * f * f; y -= Math.max(0, y) * 0.35 * f * f; }
      if (y < -hh * 0.3) y = -hh * 0.3 + (y + hh * 0.3) * 0.25;
      return [x, y, z];
    });
    const cy = -a + hh * 0.34, cz = len * 0.3;
    this.add(g, { bone, color: this.spec.outfit?.shoes || '#8a6a4a', matrix: new THREE.Matrix4().makeTranslation(0, cy, cz) });
    this.add(rbox(wid * 1.04, 0.016 * k, len * 1.02, 0, [0, -a + 0.008 * k, cz]), { bone, color: '#4a3a30' });
    // the toe strap
    this.add(rbox(0.012 * k, 0.008 * k, wid * 0.7, 0, [0, -a + hh * 0.8, cz + len * 0.28]), { bone, color: '#5a4436' });
  }

  // -------------------------------------------------------------- legs (body base)
  _legs(o) {
    const { P, b } = this; const sp = this.spec;
    const skin = sp.skin || '#e8b48e';
    for (const s of [1, -1]) {
      const n = s > 0 ? 'L' : 'R';
      this._hand(b['hand' + n], s, o.gloves || skin, (sp.hands && sp.hands[n]) || 'relax');
      if (o.bottom === 'pyjama' || o.bottom === 'trousers') {
        const tr = 1.22;
        this.add(limb(P.thigh, P.thighR[0] * tr, P.thighR[1] * tr * 1.02, { mid: [[0.5, (P.thighR[0] + P.thighR[1]) * 0.5 * tr]], cols: 10 }), { bone: b['thigh' + n], color: o.bottomColor });
        this.add(limb(P.shin, P.thighR[1] * tr * 1.02, P.ankleR * 1.6, { mid: [[0.3, P.calfR * 1.18]], cols: 10, capBottom: 0.2 }), { bone: b['shin' + n], color: o.bottomColor });
        this._chappal(b['foot' + n], s);
      } else if (o.bottom === 'shorts') {
        this.add(limb(P.thigh, P.thighR[0] * 1.26, P.thighR[1] * 1.3, { mid: [[0.5, (P.thighR[0] + P.thighR[1]) * 0.55 * 1.26]], cols: 10, capBottom: 0.7 }), { bone: b['thigh' + n], color: o.bottomColor });
        this.add(limb(P.shin, P.thighR[1] * 0.98, P.ankleR, { mid: [[0.28, P.calfR], [0.62, P.calfR * 0.78]], cols: 10 }), { bone: b['shin' + n], color: skin });
        this._chappal(b['foot' + n], s);
      }
    }
    if (o.bottom !== 'saree') {
      const L = P.pelvis.map(([y, a, bb]) => ({ y: y - P.hip, a: a * 1.06, b: bb * 1.06 }));
      this.add(rings(L, 14), { bone: b.hips, color: o.bottomColor });
    }
  }

  // -------------------------------------------------------------- torso helpers (from Sakura)
  torsoPt(tab, ph, y, off = 0, bust = this.P.bust) {
    const [a, bb] = prof(tab, y);
    const bump = bust > 0 ? bust * Math.exp(-(((y - this.P.bustY) / (0.05 * this.P.k)) ** 2)) * Math.pow(Math.max(0, Math.cos(ph)), 2) : 0;
    return [Math.sin(ph) * (a + off), y, Math.cos(ph) * (bb + off) + bump];
  }
  torsoWeights() {
    const { P, b } = this;
    return (lx, ly, lz) => {
      const y = ly + this.B.bindPos(b.spine)[1];
      const wc = smooth(P.chest - 0.07 * P.k, P.chest + 0.05 * P.k, y);
      let ws = 1 - wc, wh = 0;
      if (y < P.waist) { wh = ws * smooth(P.waist, P.waist - 0.08 * P.k, y); ws -= wh; }
      return [[b.chest, wc], [b.spine, ws], [b.hips, wh]];
    };
  }
  /** Garment on the torso. opts: {y0 (hem), y1 (top), color, off, hemFlare, vOpen, cols, radial, colorFn} */
  torsoGarment(o) {
    const { P, b } = this;
    const tab = o.tab || P.outer;
    const rowsY = [];
    const y0 = o.y0, y1 = o.y1 ?? tab[tab.length - 1][0];
    for (const r of tab) if (r[0] > y0 + 0.004 && r[0] < y1 - 0.004) rowsY.push(r[0]);
    rowsY.unshift(y0); rowsY.push(y1);
    const ys = [...new Set(rowsY.map(y => +y.toFixed(5)))];
    const rows = ys.length - 1, cols = o.cols || 20;
    const spY = this.B.bindPos(b.spine)[1];
    const g = surface(cols, rows, (u, v) => {
      const y = ys[Math.round(v * rows)];
      let ph = (u - 0.5) * TAU;
      let off = (o.off || 0) + (o.hemFlare ? o.hemFlare * smooth(y0 + 0.08 * P.k, y0, y) : 0);
      const p = this.torsoPt(tab, ph, y, off);
      return [p[0], p[1] - spY, p[2]];
    });
    this.add(g, { bone: b.spine, color: o.color, weights: this.torsoWeights(), colorFn: o.colorFn });
    return g;
  }
  /** Patch lying on the torso surface: inner(u)->[ph,y], outer(u)->[ph,y] (deg, m) */
  torsoPatch(inner, outer, o) {
    const { b } = this; const tab = o.tab || this.P.outer;
    const spY = this.B.bindPos(b.spine)[1];
    const cols = o.cols || 16, rows = o.rows || 4;
    const g = surface(cols, rows, (u, v) => {
      const A = inner(u), C = outer(u);
      const ph = lerp(A[0], C[0], v) * DEG, y = lerp(A[1], C[1], v);
      const p = this.torsoPt(tab, ph, y, (o.off || 0.004) + (o.lift ? o.lift(u, v) : 0));
      return [p[0], p[1] - spY, p[2]];
    });
    this.add(g, { bone: b.spine, color: o.color, weights: this.torsoWeights() });
    return g;
  }

  /** Sleeves. opts: {color, skin, short, loose, cuff:{h,color}, bell} */
  sleeves(o) {
    const { P, b } = this;
    const skin = o.skin || this.spec.skin || '#e8b48e';
    for (const s of [1, -1]) {
      const n = s > 0 ? 'L' : 'R';
      const ua = P.uarmR, fa = P.farmR, f = o.loose ?? 1.12;
      this.add(limb(P.uarm, ua[0] * f * 0.96, ua[1] * f, { mid: [[0.45, (ua[0] + ua[1]) * 0.5 * f * 1.02]], cols: 10, capTop: 0.3 }), { bone: b['uarm' + n], color: o.color });
      if (o.short) {
        this.add(limb(P.uarm * (1 - o.short), ua[1] * 0.95, ua[1] * 0.92, { cols: 10, capTop: 0 }), { bone: b['uarm' + n], color: skin, matrix: new THREE.Matrix4().makeTranslation(0, -P.uarm * o.short, 0) });
        this.add(limb(P.farm, fa[0], fa[1], { cols: 10 }), { bone: b['farm' + n], color: skin });
        continue;
      }
      this.add(limb(P.farm, fa[0] * f * 1.02, fa[1] * f * (o.bell ?? 1.06), { cols: 10, capBottom: 0.3 }), { bone: b['farm' + n], color: o.color });
      if (o.cuff) {
        const r = fa[1] * f * 1.12, h = o.cuff.h * P.k;
        this.add(rings([{ y: -P.farm + h, a: r * 0.98, b: r * 0.98 }, { y: -P.farm + h - 0.002, a: r, b: r }, { y: -P.farm - 0.004, a: r * 1.02, b: r * 1.02 }, { y: -P.farm - 0.006, a: r * 0.8, b: r * 0.8 }], 10), { bone: b['farm' + n], color: o.cuff.color });
      }
    }
  }

  // -------------------------------------------------------------- the saree drape (skirt bones, front pleats)
  skirt(o) {
    const { P, b } = this;
    const K = 8;
    const yTop = o.yTop ?? (P.waist + 0.02 * P.k), yHem = o.yHem;
    const [aT, bT] = prof(P.torso, yTop);
    const aw = aT * 1.02, bw = bT * 1.04;
    for (let k = 0; k < K; k++) {
      const ph = k / K * TAU;
      const sb = B2(this, 'skirt' + k, b.hips, Math.sin(ph) * aw, yTop - P.hip, Math.cos(ph) * bw);
      sb.userData.ph = ph; this.skirtBones.push(sb);
    }
    const hipY = P.hipJy - 0.01 * P.k;
    const [aH, bH] = prof(P.pelvis, hipY);
    const rows = o.rows || 8;
    const N = o.pleats ?? 0;
    const segs = N ? N * 2 : (o.cols || 24);
    const R = (t) => {
      const y = lerp(yTop, yHem, t);
      const hipT = clamp((yTop - hipY) / (yTop - yHem), 0.05, 0.6);
      let a, bb;
      if (t < hipT) { const s2 = Math.sin(t / hipT * Math.PI / 2); a = lerp(aw, aH * 1.18, s2); bb = lerp(bw, bH * 1.2, s2); }
      else { const s2 = (t - hipT) / (1 - hipT); a = aH * 1.18 + (o.flare ?? 0.06) * P.k * s2; bb = bH * 1.2 + (o.flare ?? 0.06) * P.k * s2 * 0.95; }
      return [a, bb, y];
    };
    const pos = [], uvs = [];
    const pleat = o.pleatDepth ?? 0.06;
    const pt = (i, j) => {
      const t = j / rows; const [a, bb, y] = R(t);
      const ph = i / segs * TAU;
      let f = 1;
      // saree pleats: crisp ridges fanned across the FRONT only
      if (N) {
        const front = Math.max(0, Math.cos(ph));
        const pf = (i % 2 === 0) ? 1 - pleat * (0.25 + t * 0.5) : 1 + pleat * (0.25 + t * 0.5);
        f = lerp(1, pf, front * front);
      }
      return [Math.sin(ph) * a * f, y - P.hip, Math.cos(ph) * bb * f, ph, t];
    };
    const tri = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < segs; i++) {
      const A = pt(i, j), Bp = pt(i + 1, j), C = pt(i, j + 1), D = pt(i + 1, j + 1);
      const uA = (i % 2) * 0.5, uB = uA + 0.5;
      tri.push([A, uA, j / rows], [C, uA, (j + 1) / rows], [Bp, uB, j / rows], [Bp, uB, j / rows], [C, uA, (j + 1) / rows], [D, uB, (j + 1) / rows]);
    }
    for (const [p, u, v] of tri) { pos.push(p[0], p[1], p[2]); uvs.push(u, v); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.computeVertexNormals();
    // skirt weights: hem follows the skirt bones, waist stays on the hips
    const weights = (lx, ly, lz) => {
      let ph2 = Math.atan2(lx, lz); if (ph2 < 0) ph2 += TAU;
      const t = clamp((yTop - P.hip - ly) / (yTop - yHem), 0, 1);
      const kf = ph2 / TAU * K, k0 = Math.floor(kf) % K, k1 = (k0 + 1) % K, fr = kf - Math.floor(kf);
      const gw = Math.pow(t, 1.25);
      return [[b.hips, 1 - gw], [this.skirtBones[k0], gw * (1 - fr)], [this.skirtBones[k1], gw * fr]];
    };
    this.add(g, { bone: b.hips, color: o.color, weights });
    // the waistband + the saree's gold border at the hem
    this.add(rings([{ y: yTop - P.hip + 0.012 * P.k, a: aw * 1.01, b: bw * 1.01 }, { y: yTop - P.hip - 0.02 * P.k, a: aw * 1.07, b: bw * 1.08 }], 16), { bone: b.hips, color: o.band || o.color });
    if (o.hem) {
      const [ah, bh] = R(1);
      this.add(rings([{ y: yHem - P.hip + 0.075 * P.k, a: ah * 1.002, b: bh * 1.002 }, { y: yHem - P.hip - 0.002 * P.k, a: ah * 1.004, b: bh * 1.004 }], 24), { bone: b.hips, color: o.hem, weights });
    }
    this.skirtInfo = { yTop, yHem, aw, bw };
  }

  /** The pallu: a drape from the right shoulder across the chest to the left waist,
   *  then hanging down the back to the knees on two swaying bones. */
  pallu(color, back) {
    const { P, b } = this;
    const spY = this.B.bindPos(b.spine)[1];
    // across the chest: a sweep following the torso surface
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const ph = lerp(50, 105, i / 6) * DEG;    // right shoulder to left side
      const y = lerp(P.neck - 0.04 * P.k, P.waist + 0.02 * P.k, Math.pow(i / 6, 0.9));
      const p = this.torsoPt(P.outer, ph, y, 0.014 * P.k);
      pts.push(V(p[0], p[1] - spY, p[2]));
    }
    this.add(sweep(pts, () => 0.075 * P.k, () => 0.012 * P.k, () => V(0, 0, 1), 5), { bone: b.spine, color, weights: this.torsoWeights() });
    if (!back) return;
    // the hanging tail behind the left shoulder, on two bones so the breeze moves it
    const anchor = this.torsoPt(P.outer, 130 * DEG, P.chest + 0.02 * P.k, 0.02 * P.k);
    const c1 = B2(this, 'pallu1', b.chest, anchor[0], anchor[1] - this.B.bindPos(b.chest)[1], anchor[2]);
    const c2 = B2(this, 'pallu2', c1, 0, -0.22 * P.k, 0);
    this.hairChains.push({ name: 'pallu', b1: c1, b2: c2, y0: anchor[1], amp: 0.8, maxFwd: 0.2 });
    const L = 0.42 * P.k;
    const tail = curve([[anchor[0], anchor[1] - 0.02, anchor[2] - 0.01], [anchor[0] * 1.1, anchor[1] - L * 0.5, anchor[2] - 0.03 * P.k], [anchor[0] * 1.15, anchor[1] - L, anchor[2] + 0.01 * P.k]], 8);
    const sp2 = this.B.bindPos(b.chest)[1];
    const wts = (lx, ly, lz) => { const s = clamp((anchor[1] - sp2 - ly) / L, 0, 1.1); const w1 = smooth(-0.05, 0.3, s), w2 = smooth(0.3, 0.9, s); return [[b.chest, 1 - w1], [c1, w1 - w2], [c2, w2]]; };
    this.add(sweep(tail.map(p => V(p.x, p.y - sp2, p.z)), (s) => 0.07 * P.k * Math.pow(1 - s, 0.3), () => 0.012 * P.k, () => V(1, 0, 0), 5), { bone: b.chest, color, weights: wts });
  }

  // -------------------------------------------------------------- hair (painted cap + locks)
  _hair() {
    const hs = this.spec.hair; if (!hs) return;
    const { P, b } = this;
    const h = P.head;
    const c = [0, h.cy, h.cz];
    const hk = P.k * P.hk;
    const uvFn = (lx, ly, lz) => {
      const dx = lx - c[0], dy = ly - c[1], dz = lz - c[2];
      const r = Math.hypot(dx, dy, dz) || 1;
      let row = (1 - Math.asin(clamp(dy / r, -1, 1)) / (Math.PI / 2)) * 0.5;
      if (dy < -h.ry) row = 0.5 + 0.5 * clamp(0.6 + (-dy - h.ry) / 0.5, 0, 1);
      const ph = Math.atan2(dx, dz);
      return hairUV(row, 0.5 + 0.44 * Math.sin(ph * 4));
    };
    const addHair = (g, weights) => this.add(g, { bone: b.head, color: '#ffffff', uvFn, weights });
    const hlFront = hs.hairlineFront ?? 15, hlSide = hs.hairlineSide ?? -22, hlBack = hs.hairlineBack ?? -58;
    const hairline = (ph) => { const a = Math.abs(ph) / DEG; return lerp(lerp(hlFront, hlSide, smooth(25, 95, a)), hlBack, smooth(100, 175, a)); };
    const Rtop = hs.volume ?? 1.09, Rbot = (ph) => (hs.flare ? lerp(1.06, 1.06 + hs.flare, smooth(40, 110, Math.abs(ph) / DEG)) : 1.065);
    addHair(surface(30, 11, (u, v) => {
      const phn = (u - 0.5) * TAU;
      const vv = Math.min(1, v / 0.91);
      const th = lerp(90, hairline(phn), Math.pow(vv, 0.9)) * DEG;
      const R = v > 0.95 ? 0.975 : lerp(Rtop, Rbot(phn), vv);
      return this.headPt(phn, th, R);
    }));
    const out = (p) => V(p.x - c[0], (p.y - c[1]) * 0.8, p.z - c[2]).normalize();
    const lock = (ctrl, w0, t0, opts = {}) => {
      const pts = curve(ctrl.map(q => (q.length === 3 && q.isAng) ? this.headPt(q[0], q[1], q[2]) : q), opts.n || 7);
      const g = sweep(pts, (s) => w0 * hk * (opts.wf ? opts.wf(s) : Math.pow(1 - s, 0.7) * (s < 0.12 ? 0.75 + s * 2 : 1)), (s) => t0 * hk * (1 - 0.65 * s), opts.out || out, 5);
      addHair(g, opts.weights);
      return g;
    };
    const A = (phDeg, thDeg, R) => { const a = [phDeg * DEG, thDeg * DEG, R]; a.isAng = true; return a; };
    // fringe
    const fr = hs.fringe || { n: 7, span: 60, tip: 6, len: 1 };
    for (let i = 0; i < fr.n; i++) {
      const t = fr.n === 1 ? 0.5 : i / (fr.n - 1);
      const ph = lerp(-fr.span, fr.span, t);
      const side = Math.sign(ph) || 1;
      const skew = (fr.skew ?? 6) * (t - 0.5) * 2 + (fr.part ? fr.part * (ph < fr.partAt ? -1 : 1) : 0);
      const edge = Math.abs(t - 0.5) * 2;
      const tipTh = (fr.tip ?? 6) - edge * edge * (fr.edgeDrop ?? 16) + ((i * 7919) % 5 - 2) * 1.6;
      lock([A(ph * 0.6, 62, 1.02), A(ph * 0.85 + skew * 0.2, 40, Rtop * 1.01), A(ph + skew * 0.6, 20, 1.08), A(ph + skew, tipTh, 1.035 + edge * 0.02)],
        (fr.w ?? 0.05) * (1 - edge * 0.2) * 1.15, fr.t ?? 0.024, { n: 7 });
    }
    // side locks in front of the ears
    if (hs.side) for (const s of [1, -1]) {
      const sd = hs.side;
      const base = [A(s * 64, 42, 1.04), A(s * 76, 12, 1.09), A(s * 80, -30, 1.1)];
      const p2 = this.headPt(s * 78 * DEG, -70 * DEG, 1.12);
      const ctrl = [...base, [p2[0], p2[1], p2[2] + 0.004]];
      if (sd.long) ctrl.push([p2[0] * 1.08, p2[1] - sd.long * hk, p2[2] + 0.012 * hk]);
      const wfn = sd.long ? this._chainWeights('side' + (s > 0 ? 'L' : 'R'), p2[1], p2[0], p2[2], sd.long * hk + 0.04) : undefined;
      if (sd.long) { const ch = this.hairChains[this.hairChains.length - 1]; ch.amp = 0.55; ch.maxFwd = 0.5; }
      lock(ctrl, (sd.w ?? 0.034) * 1.2, 0.022, { n: 8, weights: wfn });
    }
    // back hair: the plait (braid) on chains, or a soft curtain
    if (hs.back) {
      const bk = hs.back;
      const napeY = h.cy - h.ry * 0.95;
      const L = bk.len * hk;
      const chains = [-1, 0, 1].map((i) => ({ i, name: 'back' + i, x: i * 0.07 * hk }));
      for (const ch of chains) this._chainWeights(ch.name, napeY, ch.x, h.cz - h.rz * 1.1, L);
      const weightFor = (lx, ly, lz) => {
        const s = clamp((napeY - ly) / L, 0, 1.2);
        const w1 = smooth(-0.05, 0.35, s), w2 = smooth(0.35, 0.95, s);
        const ws = chains.map(ch => Math.exp(-(((lx - ch.x) / (0.07 * hk)) ** 2)));
        const tot = ws.reduce((a, x) => a + x, 0) || 1;
        const out = [[b.head, 1 - w1]];
        const idx = [0, 1, 2].sort((a, c2) => ws[c2] - ws[a]).slice(0, 2);
        const t2 = ws[idx[0]] + ws[idx[1]];
        for (const k of idx) { const chn = this.hairChains.find(cc => cc.name === chains[k].name); out.push([chn.b1, (w1 - w2) * ws[k] / t2], [chn.b2, w2 * ws[k] / t2]); }
        return out;
      };
      const n = bk.n ?? 5;
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const ph = lerp(-Math.min(bk.span ?? 90, 95), Math.min(bk.span ?? 90, 95), t);
        const phw = 180 + ph;
        const e = Math.abs(t - 0.5) * 2;
        const p1 = this.headPt(phw * DEG, -35 * DEG, 1.1);
        const x = p1[0] * (1.05 + e * 0.1);
        const zBack = h.cz - h.rz * (1.12 - e * 0.35) - (bk.clear ?? 0.02) * hk;
        const len = L * (1 - e * (bk.taper ?? 0.25)) * (1 + ((i * 37) % 7 - 3) * 0.03);
        const ctrl = [A(phw, 40, 1.03), A(phw, 5, 1.1), p1, [x * 1.02, napeY - L * 0.12, zBack], [x * (1 + (bk.spread ?? 0.25)), napeY - len * 0.6, zBack - 0.01 * hk], [x * (1 + (bk.spread ?? 0.25) * 1.2), napeY - len, zBack + 0.006 * hk]];
        lock(ctrl, (bk.w ?? 0.06) * (1 - e * 0.2), 0.028, { n: 10, weights: weightFor, wf: (s) => (s < 0.1 ? 0.8 + s * 2 : 1) * Math.pow(1 - Math.max(0, s - 0.55) / 0.45, 0.9) });
      }
    }
    if (hs.bun) {
      const p = this.headPt(Math.PI, (hs.bun.th ?? 18) * DEG, 1.1);
      const r = hs.bun.r * hk;
      addHair(ellipsoid(r * 1.05, r * 0.9, r * 0.85, [p[0], p[1], p[2] - r * 0.55], 12, 8));
      // a marigold-gold hair pin
      this.add(rings([{ y: 0, a: 0.003, b: 0.003 }, { y: -0.001, a: 0.005 * hk, b: 0.005 * hk }, { y: -0.07 * hk, a: 0.003 * hk, b: 0.003 * hk }], 5), { bone: b.head, color: hs.bun.pin || '#e8b93a', matrix: new THREE.Matrix4().makeRotationZ(1.1).setPosition(p[0] - 0.03 * hk, p[1] + 0.035 * hk, p[2] - r * 0.4) });
    }
  }

  /** Hair/pallu chain (2 bones hanging from a parent). Returns weight fn. */
  _chainWeights(name, y0, x0 = null, z0 = null, len = 0.3) {
    const { b } = this;
    let ch = this.hairChains.find(c => c.name === name);
    if (!ch) {
      const b1 = B2(this, 'hair_' + name + '1', b.head, x0 ?? 0, y0, z0 ?? 0);
      const b2 = B2(this, 'hair_' + name + '2', b1, 0, -len * 0.5, 0);
      ch = { name, b1, b2, y0, len, amp: 1, x0: x0 ?? 0 };
      this.hairChains.push(ch);
    }
    return (lx, ly, lz) => {
      const s = clamp((y0 - ly) / len, 0, 1.2);
      const w1 = smooth(0.0, 0.35, s), w2 = smooth(0.35, 0.95, s);
      return [[b.head, 1 - w1], [ch.b1, w1 - w2], [ch.b2, w2]];
    };
  }

  // -------------------------------------------------------------- outfits
  _outfit() {
    const o = this.spec.outfit; if (!o) return;
    const { P, b } = this; const k = P.k;
    const kind = o.kind;
    if (kind === 'kurta') {
      // long kurta over pyjama: hem flares at mid-thigh, mandarin collar, placket + buttons
      this._legs({ bottom: 'pyjama', bottomColor: o.bottomColor, gloves: this.spec.skin });
      const y1 = P.torso[P.torso.length - 1][0];
      this.torsoGarment({ y0: P.hipJy - 0.16 * k, y1, color: o.topColor, off: 0.008 * k, hemFlare: 0.02 * k, tab: P.outer, cols: 22 });
      this.sleeves({ color: o.topColor, loose: 1.16, cuff: { h: 0.035, color: o.cuff || o.topColor } });
      // mandarin collar
      this.torsoPatch((u) => [lerp(-24, 24, u), y1 + 0.012 * k], (u) => [lerp(-40, 40, u), y1 - 0.055 * k + u * 0.02 * k], { off: 0.016 * k, cols: 12, rows: 2, color: o.collar || o.topColor });
      // the placket: a narrow band down the front with three buttons
      this.torsoPatch((u) => [lerp(-2, 1.5, u), y1 - 0.02 * k], (u) => [lerp(-4, 3.5, u), P.waist - 0.06 * k], { off: 0.012 * k, cols: 4, rows: 6, color: o.placket || shade(o.topColor, 0.85) });
      for (let i = 0; i < 3; i++) {
        const y = lerp(y1 - 0.06 * k, P.chest + 0.02 * k, i / 2);
        const p = this.torsoPt(P.outer, 2 * DEG, y, 0.018 * k);
        this.add(ellipsoid(0.0065 * k, 0.0065 * k, 0.0035 * k, [p[0], p[1] - this.B.bindPos(b.spine)[1], p[2]], 6, 4), { bone: b.spine, color: o.button || '#d8b83a', weights: this.torsoWeights() });
      }
    } else if (kind === 'saree') {
      // blouse + the draped drape with front pleats + gold hem + pallu
      const y1 = P.torso[P.torso.length - 1][0];
      this.torsoGarment({ y0: P.waist - 0.01 * k, y1, color: o.topColor, off: 0.005 * k, tab: P.torso });
      this.sleeves({ color: o.topColor, loose: 1.1, short: 0.45, skin: this.spec.skin });
      this.skirt({ yHem: 0.09 * k, color: o.bottomColor, pleats: o.pleats ?? 7, flare: 0.05, band: o.band || o.bottomColor, hem: o.hem || '#d8b83a' });
      this.pallu(o.pallu || o.bottomColor, true);
      this._legs({ bottom: 'saree', bottomColor: o.bottomColor });
    } else if (kind === 'kameez') {
      // straight tunic to the knees + slim trousers + dupatta
      this._legs({ bottom: 'trousers', bottomColor: o.bottomColor, gloves: this.spec.skin });
      const y1 = P.torso[P.torso.length - 1][0];
      this.torsoGarment({ y0: P.hipJy - 0.02 * k, y1, color: o.topColor, off: 0.006 * k, hemFlare: 0.012 * k, tab: P.outer, cols: 22 });
      this.sleeves({ color: o.topColor, loose: 1.14, cuff: { h: 0.03, color: o.cuff || o.topColor } });
      const yN = y1 - 0.004 * k;
      this.torsoPatch((u) => [lerp(-24, 24, u), yN + 0.012 * k], (u) => [lerp(-40, 40, u), yN - 0.05 * k + u * 0.02 * k], { off: 0.015 * k, cols: 12, rows: 2, color: o.collar || o.topColor });
      // dupatta: a soft band across the chest from the left shoulder
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const ph = lerp(118, 35, i / 6) * DEG;
        const y = lerp(P.neck - 0.05 * k, P.waist + 0.03 * P.k, Math.pow(i / 6, 0.9));
        const p = this.torsoPt(P.outer, ph, y, 0.016 * k);
        pts.push(V(p[0], p[1] - this.B.bindPos(b.spine)[1], p[2]));
      }
      this.add(sweep(pts, () => 0.06 * k, () => 0.014 * k, () => V(0, 0, 1), 5), { bone: b.spine, color: o.dupatta || '#e8d9a8', weights: this.torsoWeights() });
    } else if (kind === 'school') {
      // white shirt (tucked, collar points) + navy shorts
      this._legs({ bottom: 'shorts', bottomColor: o.shorts || '#2c3a5e', gloves: this.spec.skin });
      const y1 = P.torso[P.torso.length - 1][0];
      this.torsoGarment({ y0: P.waist - 0.02 * k, y1, color: o.topColor || '#ecebe4', off: 0.005 * k, tab: P.torso });
      this.sleeves({ color: o.topColor || '#ecebe4', short: 0.4, skin: this.spec.skin });
      for (const s of [1, -1]) {
        this.torsoPatch((u) => [s * lerp(4, 42, u), y1 + 0.012 * k - u * 0.006 * k], (u) => [s * lerp(10, 30, u), y1 - 0.032 * k + u * 0.02 * k], { off: 0.012 * k, cols: 4, rows: 2, color: o.topColor || '#ecebe4' });
      }
    } else if (kind === 'kurta-vest') {
      this._legs({ bottom: 'pyjama', bottomColor: o.bottomColor, gloves: this.spec.skin });
      const y1 = P.torso[P.torso.length - 1][0];
      this.torsoGarment({ y0: P.hipJy - 0.1 * k, y1, color: o.topColor, off: 0.008 * k, hemFlare: 0.018 * k, tab: P.outer, cols: 22 });
      this.sleeves({ color: o.topColor, loose: 1.14, cuff: { h: 0.03, color: o.topColor } });
      // the sleeveless waistcoat over it
      this.torsoGarment({ y0: P.waist - 0.06 * k, y1: y1 - 0.02 * k, color: o.waistcoat, off: 0.014 * k, vOpen: { yV: P.chest - 0.02 * k, ang: 38 }, tab: P.outer, cols: 22 });
      this.torsoPatch((u) => [lerp(150, 210, u), y1 + 0.014 * k], (u) => [lerp(150, 210, u), y1 - 0.04 * k], { off: 0.017 * k, cols: 10, rows: 2, color: o.waistcoat });
    } else {
      this._legs({ bottom: 'trousers', bottomColor: o.bottomColor || '#c8bcae', gloves: this.spec.skin });
    }
  }
}

/** bone helper that lives on the instance (used above before the class body ends) */
function B2(self, name, parent, x, y, z) {
  const b = self.B.bone(name, parent, x, y, z);
  return b;
}

/** darken a hex colour (for plackets) */
function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return '#' + c.getHexString();
}
