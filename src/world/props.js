import * as THREE from 'three';
import { toonMaterial } from '../core/toon.js';
import { groundHeight } from './layout.js';

// ============================================================
// Street furniture — Chandrapur edition. One generator per class,
// placed by hand where a composition or a story needs it. All
// signboards are hand-painted at runtime with Canvas2D — Hindi
// on top, English underneath, the way a real town paints them.
// ============================================================

export function makeCanvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const DE = '"Noto Sans Devanagari", "Noto Sans Devanagari UI", sans-serif';

/** Painted shopboard / station board: Hindi headline, English sub. */
export function textSign({ text, sub = '', w = 4, h = 1.1, bg = '#1c3a6e', fg = '#ffe9a8', accent = null }) {
  const tex = makeCanvasTexture(512, 512 * h / w, (ctx, W, H) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = accent ?? fg; ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, W - 20, H - 20);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = fg;
    ctx.font = `bold ${sub ? Math.min(120, H * 0.42) : Math.min(150, H * 0.6)}px ${DE}`;
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowOffsetY = 6;
    ctx.fillText(text, W / 2, sub ? H * 0.34 : H * 0.5);
    ctx.shadowColor = 'transparent';
    if (sub) {
      ctx.font = `bold ${Math.min(52, H * 0.2)}px sans-serif`;
      ctx.fillStyle = '#e8e4d4';
      ctx.fillText(sub, W / 2, H * 0.72);
    }
  });
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    toonMaterial(0xffffff, { paint: 0.015, map: tex }),
  );
  m.name = 'sign';
  return m;
}

/** Small painted poster: mela notices, film bills, a lost dog. */
export function poster({ title, lines = [], w = 0.9, h = 1.2, hue = '#f2e6c8', titleColor = '#c23326' }) {
  const tex = makeCanvasTexture(160, Math.round(160 * h / w), (ctx, W, H) => {
    ctx.fillStyle = hue; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = titleColor; ctx.fillRect(0, 0, W, W * 0.22);
    ctx.fillStyle = '#fff'; ctx.font = `bold ${W * 0.14}px ${DE}`;
    ctx.textAlign = 'center';
    ctx.fillText(title, W / 2, W * 0.15);
    ctx.fillStyle = '#3a3a3a'; ctx.font = `${W * 0.1}px ${DE}`;
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, W / 2, W * 0.3 + i * W * 0.13));
    ctx.strokeStyle = '#b8b0a0'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(12, H - W * 0.22 + i * 12); ctx.lineTo(W - 12, H - W * 0.22 + i * 12); ctx.stroke();
    }
  });
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    toonMaterial(0xffffff, { paint: 0.015, map: tex }),
  );
  m.name = 'poster';
  return m;
}

/** Station timetable board, the yellow kind. */
export function timetable({ w = 1.9, h = 1.15 } = {}) {
  const tex = makeCanvasTexture(256, 160, (ctx, W, H) => {
    ctx.fillStyle = '#e8c832'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 5; ctx.strokeRect(3, 3, W - 6, H - 6);
    ctx.fillStyle = '#111'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = `bold 22px ${DE}`;
    ctx.fillText('चंद्रपुर — CHANDRAPUR', 12, 10);
    ctx.font = `17px sans-serif`;
    const rows = [['6035 UP', '22:15', 'last ▲'], ['6036 DN', '05:40', 'first ▼'], ['—', '—', 'passenger halt']];
    rows.forEach((r, i) => ctx.fillText(`${r[0]}  ${r[1]}  ${r[2]}`, 14, 42 + i * 30));
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), toonMaterial(0xffffff, { paint: 0.015, map: tex }));
  m.name = 'timetable';
  return m;
}

// ---- warm additive helpers (night pools + cones) ----
// pools are soft radial falloffs now — real light on a road has no hard rim
let poolTex = null;
function getPoolTexture() {
  if (!poolTex) {
    poolTex = makeCanvasTexture(128, 128, (ctx) => {
      const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.5)');
      g.addColorStop(0.7, 'rgba(255,255,255,0.16)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    });
  }
  return poolTex;
}
const poolGeo = new THREE.CircleGeometry(1, 28);
export function lightPool(r, color = 0xffb45e, opacity = 0.09) {
  const m = new THREE.Mesh(poolGeo, new THREE.MeshBasicMaterial({
    color, map: getPoolTexture(), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  m.rotation.x = -Math.PI / 2;
  m.scale.setScalar(r);
  m.renderOrder = 3;
  m.name = 'light-pool';
  return m;
}

const coneGeo = new THREE.ConeGeometry(1, 1, 20, 1, true);
export function lightCone(r, h, color = 0xffc06a, opacity = 0.05) {
  const m = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide,
  }));
  m.scale.set(r, h, r);
  m.name = 'light-cone';
  return m;
}

// ---- street lamp (sodium-vapour warm) ----
let lampGlowTex = null;
function getLampGlowTex() {
  if (!lampGlowTex) {
    lampGlowTex = makeCanvasTexture(64, 64, (ctx) => {
      const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255,214,140,0.85)');
      grad.addColorStop(0.5, 'rgba(255,214,140,0.2)');
      grad.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
    });
  }
  return lampGlowTex;
}

export function streetLamp({ h = 4.4, arm = 0.9, warm = 0xffc98a } = {}) {
  const g = new THREE.Group();
  const poleMat = toonMaterial(0x3a4152);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, h, 8), poleMat);
  pole.position.y = h / 2;
  pole.castShadow = true;
  pole.userData.solidCircle = 0.22;
  g.add(pole);
  const armM = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, arm, 6), poleMat);
  armM.rotation.z = Math.PI / 2;
  armM.position.set(arm / 2, h - 0.06, 0);
  g.add(armM);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), new THREE.MeshBasicMaterial({ color: warm }));
  head.position.set(arm, h - 0.16, 0);
  g.add(head);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.22, 10), toonMaterial(0x2c3242));
  shade.position.set(arm, h - 0.02, 0);
  g.add(shade);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getLampGlowTex(), color: warm, transparent: true, opacity: 0.8,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glow.scale.setScalar(1.6);
  glow.position.set(arm, h - 0.16, 0);
  g.add(glow);
  const cone = lightCone(1.15, h - 0.2);
  cone.position.set(arm, (h - 0.2) / 2, 0);
  g.add(cone);
  const pool = lightPool(2.4);
  pool.position.set(arm, 0.02, 0);
  g.add(pool);
  g.name = 'street-lamp';
  return g;
}

// ---- string of festival bulbs across the bazaar ----
export function bulbString({ from, to, sag = 0.5, count = 9, size = 0.14, big = false }) {
  const g = new THREE.Group();
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const mid = a.clone().lerp(b, 0.5); mid.y -= sag;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  const wire = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 20, 0.012, 4),
    new THREE.MeshBasicMaterial({ color: 0x14161c }),
  );
  g.add(wire);
  const glowTex = getLampGlowTex();
  for (let i = 0; i < count; i++) {
    const t = (i + 1) / (count + 1);
    const p = curve.getPoint(t);
    const warm = (i % 3) !== 1; // mostly warm, a few red
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(size * (big ? 1.35 : 1), 8, 6),
      new THREE.MeshBasicMaterial({ color: warm ? 0xffd28a : 0xff6a52 }),
    );
    bulb.position.copy(p);
    bulb.position.y -= size * 1.4;
    g.add(bulb);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: warm ? 0xffd9a0 : 0xff8a6a, transparent: true,
      opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    glow.scale.setScalar(big ? 1.1 : 0.75);
    glow.position.copy(bulb.position);
    g.add(glow);
  }
  g.name = 'bulb-string';
  return g;
}

// ---- marigold garland strung across a shopfront ----
export function marigoldGarland({ from, to, count = 13 }) {
  const g = new THREE.Group();
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const mid = a.clone().lerp(b, 0.5); mid.y -= 0.25;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  const flowerMat = toonMaterial(0xe8931a);
  const leafMat = toonMaterial(0x4a7a3a);
  for (let i = 0; i < count; i++) {
    const p = curve.getPoint((i + 0.5) / count);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 5), i % 4 === 3 ? leafMat : flowerMat);
    f.position.copy(p);
    g.add(f);
  }
  g.name = 'garland';
  return g;
}

// ---- utility pole (placed in a run; wires added by caller) ----
export function utilityPole({ h = 7, cross = 2, lean = 0 } = {}) {
  const g = new THREE.Group();
  const mat = toonMaterial(0x4c4238);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, h, 7), mat);
  pole.position.y = h / 2;
  pole.rotation.z = lean;
  pole.castShadow = true;
  pole.userData.solidCircle = 0.24;
  g.add(pole);
  for (let i = 0; i < cross; i++) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5 - i * 0.35, 0.09, 0.09), mat);
    arm.position.y = h - 0.5 - i * 0.85;
    g.add(arm);
    for (const s of [-1, 1]) {
      const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 6), toonMaterial(0x7d84a0));
      ins.position.set(s * (0.55 - i * 0.12), h - 0.38 - i * 0.85, 0);
      g.add(ins);
    }
  }
  g.name = 'utility-pole';
  return g;
}

export function wire(a, b, sag = 0.5) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const mid = A.clone().lerp(B, 0.5); mid.y -= sag;
  const curve = new THREE.QuadraticBezierCurve3(A, mid, B);
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, 12, 0.014, 4),
    new THREE.MeshBasicMaterial({ color: 0x11141c }),
  );
}

// ---- bench facing +z by default ----
export function bench({ len = 1.7 } = {}) {
  const g = new THREE.Group();
  g.userData.solid = true;
  const wood = toonMaterial(0x7a5a3a);
  const dark = toonMaterial(0x4c3826);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.42), wood);
  seat.position.y = 0.45;
  seat.castShadow = true;
  g.add(seat);
  for (const z of [0.16, -0.16]) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.09), dark);
    slat.position.set(0, 0.62, z);
    slat.rotation.x = z > 0 ? 0.25 : -0.25;
    g.add(slat);
  }
  for (const x of [-len / 2 + 0.15, len / 2 - 0.15]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.4), dark);
    leg.position.set(x, 0.22, 0);
    g.add(leg);
  }
  g.name = 'bench';
  return g;
}

// ---- bicycle (leans on its stand) ----
export function bicycle({ color = 0x9c4a3c, basket = true } = {}) {
  const g = new THREE.Group();
  const frameMat = toonMaterial(color);
  const tireMat = toonMaterial(0x1e222a);
  for (const x of [-0.42, 0.42]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 6, 18), tireMat);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(x, 0.3, 0);
    g.add(wheel);
  }
  const bar = (x1, y1, z1, x2, y2, z2, r = 0.025) => {
    const len = Math.hypot(x2 - x1, y2 - y1, z2 - z1);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 5), frameMat);
    m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    m.lookAt(new THREE.Vector3(x2, y2, z2));
    m.rotateX(Math.PI / 2);
    g.add(m);
  };
  bar(-0.42, 0.3, 0, -0.05, 0.62, 0);
  bar(-0.05, 0.62, 0, 0.42, 0.3, 0);
  bar(-0.42, 0.3, 0, -0.12, 0.35, 0);
  bar(-0.12, 0.35, 0, -0.05, 0.62, 0);
  bar(0.42, 0.3, 0, 0.42, 0.55, 0);
  bar(-0.05, 0.62, 0, 0.28, 0.68, 0);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.12), toonMaterial(0x2a2a30));
  seat.position.set(-0.12, 0.68, 0);
  g.add(seat);
  if (basket) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.22), toonMaterial(0x8a7850));
    b.position.set(-0.62, 0.62, 0);
    g.add(b);
  }
  g.rotation.z = 0.09;
  g.name = 'bicycle';
  return g;
}

// ---- the chai stall — the vending machine of this town ----
export function chaiStall({ face = 0 } = {}) {
  const g = new THREE.Group();
  g.userData.solid = true;
  const woodMat = toonMaterial(0x7a5a3a);
  const tinMat = toonMaterial(0x8a8f98);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.9), woodMat);
  counter.position.y = 0.95;
  counter.castShadow = true;
  g.add(counter);
  for (const [x, z] of [[-1, -0.35], [1, -0.35], [-1, 0.35], [1, 0.35]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.95, 0.09), woodMat);
    leg.position.set(x, 0.475, z);
    g.add(leg);
  }
  // kettle on a kerosene glow
  const stoveGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.16, 10), new THREE.MeshBasicMaterial({ color: 0xff9a3c }));
  stoveGlow.position.set(-0.55, 1.03, 0.05);
  g.add(stoveGlow);
  const kettle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.24, 10), tinMat);
  kettle.position.set(-0.55, 1.19, 0.05);
  kettle.castShadow = true;
  g.add(kettle);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.22, 6), tinMat);
  spout.rotation.z = 0.8;
  spout.position.set(-0.4, 1.22, 0.05);
  g.add(spout);
  // glass rail of chai glasses
  const glassMat = new THREE.MeshBasicMaterial({ color: 0xdcc498, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 5; i++) {
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.038, 0.11, 8), glassMat);
    glass.position.set(0.1 + i * 0.14, 1.045, -0.18);
    g.add(glass);
  }
  // a thermos + biscuit jar
  const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 10), new THREE.MeshBasicMaterial({ color: 0xc8a84a }));
  jar.position.set(0.85, 1.09, -0.15);
  g.add(jar);
  // glow + pool
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getLampGlowTex(), color: 0xffb45e, transparent: true, opacity: 0.9,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glow.scale.setScalar(2.4);
  glow.position.set(0, 1.25, 0);
  g.add(glow);
  const pool = lightPool(2.2, 0xffb45e, 0.1);
  pool.position.set(0, 0.02, 0.4);
  g.add(pool);
  g.rotation.y = face;
  g.name = 'chai-stall';
  return { group: g, kettleTop: new THREE.Vector3(0, 1.35, 0), stove: stoveGlow };
}

// ---- auto-rickshaw, parked for the night ----
export function autoRickshaw({ color = 0x2c6e4f } = {}) {
  const g = new THREE.Group();
  g.userData.solid = true;
  const bodyMat = toonMaterial(color);
  const topMat = toonMaterial(0xe8c832);
  const darkMat = toonMaterial(0x1a1e24);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 2.0), bodyMat);
  body.position.y = 0.95;
  body.castShadow = true;
  g.add(body);
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 2.0, 12, 1, false, 0, Math.PI), topMat);
  canopy.rotation.z = Math.PI / 2;
  canopy.rotation.y = Math.PI / 2;
  canopy.position.set(0, 1.5, -0.15);
  canopy.castShadow = true;
  g.add(canopy);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 0.5), bodyMat);
  nose.position.set(0, 0.85, 1.2);
  g.add(nose);
  const windshield = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), toonMaterial(0x223040));
  windshield.position.set(0, 1.0, 1.46);
  g.add(windshield);
  const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), darkMat);
  handlebar.rotation.z = Math.PI / 2;
  handlebar.position.set(0, 1.1, 1.15);
  g.add(handlebar);
  const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.18, 10);
  for (const [x, z] of [[-0.68, -0.7], [0.68, -0.7]]) {
    const w = new THREE.Mesh(wheelGeo, darkMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.28, z);
    g.add(w);
  }
  const front = new THREE.Mesh(wheelGeo, darkMat);
  front.rotation.z = Math.PI / 2;
  front.position.set(0, 0.28, 1.35);
  g.add(front);
  g.name = 'auto-rickshaw';
  return g;
}

// ---- cycle rickshaw, resting on its stand ----
export function cycleRickshaw() {
  const g = new THREE.Group();
  const frame = toonMaterial(0x22557a);
  const hood = toonMaterial(0x3a4a3c);
  const tireMat = toonMaterial(0x1e222a);
  for (const [x, z] of [[0.9, 0], [-0.85, 0.12], [-0.85, -0.12]]) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 6, 18), tireMat);
    w.rotation.y = Math.PI / 2;
    w.position.set(x, 0.3, z);
    g.add(w);
  }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.5), hood);
  seat.position.set(-0.55, 0.72, 0);
  g.add(seat);
  const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.5), hood);
  seatBack.position.set(-0.95, 0.95, 0);
  g.add(seatBack);
  const bar = (x1, y1, x2, y2) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 5), frame);
    m.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0);
    m.rotation.z = Math.atan2(y2 - y1, x2 - x1) - Math.PI / 2;
    g.add(m);
  };
  bar(0.9, 0.3, 0.2, 0.95);
  bar(0.2, 0.95, -0.55, 0.72);
  bar(-0.85, 0.3, -0.55, 0.72);
  bar(0.2, 0.95, 0.2, 1.05);
  g.name = 'cycle-rickshaw';
  return g;
}

// ---- small clutter ----
export function flowerPot({ hue = 0xe8931a } = {}) {
  const g = new THREE.Group();
  g.userData.solidCircle = 0.26;
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.3, 8), toonMaterial(0x8a5a40));
  pot.position.y = 0.15;
  pot.castShadow = true;
  g.add(pot);
  const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), toonMaterial(hue));
  bloom.position.y = 0.42;
  g.add(bloom);
  const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), toonMaterial(0x3a6a3c));
  leaf.position.set(0.12, 0.3, 0.06);
  g.add(leaf);
  g.name = 'flower-pot';
  return g;
}

export function electricalBox() {
  const g = new THREE.Group();
  g.userData.solid = true;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.6), toonMaterial(0x5c6470));
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const vent = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.02), toonMaterial(0x3c424c));
  vent.position.set(0, 0.8, 0.31);
  g.add(vent);
  const p = poster({ title: 'खोया-पाया', lines: ['काली गाय / lost dog', 'मिले तो चाय पॉइंट', 'में बताएं'], w: 0.55, h: 0.62, hue: '#e8dcc0' });
  p.position.set(0.18, 0.5, 0.311);
  g.add(p);
  g.name = 'electrical-box';
  return g;
}

export function crates(n = 3) {
  const g = new THREE.Group();
  const mat = toonMaterial(0x8a7452);
  for (let i = 0; i < n; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.5), mat);
    c.position.set((i - (n - 1) / 2) * 0.68, 0.2 + (i % 2) * 0.4, (i % 2) * 0.1);
    c.rotation.y = i * 0.3;
    c.castShadow = true;
    g.add(c);
    // a soft-drink crate has a red stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.52), toonMaterial(0xb03a34));
    stripe.position.copy(c.position);
    stripe.position.y -= 0.14;
    g.add(stripe);
  }
  g.name = 'crates';
  return g;
}

export function laundry() {
  const g = new THREE.Group();
  const mat = toonMaterial(0x6a6458);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 5), mat);
  pole.rotation.z = Math.PI / 2;
  pole.position.y = 1.0;
  g.add(pole);
  const cloth = (x, w, h, c) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), toonMaterial(c, { side: THREE.DoubleSide }));
    m.position.set(x, 1.0 - h / 2, 0);
    m.rotation.y = 0.06;
    g.add(m);
    return m;
  };
  const cloths = [cloth(-0.4, 0.34, 0.5, 0xe8e4d8), cloth(0.05, 0.28, 0.42, 0xd8c9a8), cloth(0.42, 0.3, 0.46, 0x9ab6d8)];
  g.name = 'laundry';
  return { group: g, cloths };
}

export function waterTank({ r = 0.55 } = {}) {
  const g = new THREE.Group();
  const mat = toonMaterial(0x2a3444);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.75, 12), mat);
  tank.castShadow = true;
  g.add(tank);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 1.0, 0.08, 12), toonMaterial(0x1c2430));
  lid.position.y = 0.41;
  g.add(lid);
  for (const [x, z] of [[-r * 0.6, -r * 0.6], [r * 0.6, -r * 0.6], [-r * 0.6, r * 0.6], [r * 0.6, r * 0.6]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.06), toonMaterial(0x4c4238));
    leg.position.set(x, -0.5, z);
    g.add(leg);
  }
  g.name = 'water-tank';
  return g;
}

// ---- the level crossing: striped boom on a post ----
export function crossingBoom({ armLen = 5 }) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.6, 8), toonMaterial(0x4a505c));
  post.position.y = 1.3;
  post.castShadow = true;
  g.add(post);
  const arm = new THREE.Group();
  const poleMat = toonMaterial(0xd8d0c0);
  const stripeMat = toonMaterial(0xc23326);
  for (let i = 0; i < Math.ceil(armLen / 0.5); i++) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.16), i % 2 ? poleMat : stripeMat);
    seg.position.x = 0.25 + i * 0.5;
    arm.add(seg);
  }
  arm.position.y = 2.2;
  arm.rotation.z = -0.5; // raised for the night
  g.add(arm);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff5a4a }));
  lamp.position.y = 2.45;
  g.add(lamp);
  g.name = 'crossing-boom';
  return g;
}

// ---- fences & railings ----
export function fenceRun({ from, to, h = 0.85, step = 1.6 } = {}) {
  const g = new THREE.Group();
  const a = new THREE.Vector2(...from), b = new THREE.Vector2(...to);
  const len = a.distanceTo(b);
  const n = Math.max(2, Math.round(len / step));
  const mat = toonMaterial(0x6a5a44);
  const railMat = toonMaterial(0x554838);
  const dir = b.clone().sub(a).normalize();
  const angle = Math.atan2(dir.y, dir.x);
  for (let i = 0; i <= n; i++) {
    const p = a.clone().lerp(b, i / n);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, 0.08), mat);
    post.position.set(p.x, groundHeight(p.x, p.y) + h / 2, p.y);
    post.castShadow = true;
    g.add(post);
  }
  for (const dy of [h * 0.5, h * 0.95]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.05), railMat);
    const mid = a.clone().lerp(b, 0.5);
    rail.position.set(mid.x, groundHeight(mid.x, mid.y) + dy, mid.y);
    rail.rotation.y = -angle;
    g.add(rail);
  }
  // register the run as a thin blocker
  const nx = -dir.y, nz = dir.x;
  const pad = 0.1;
  g.userData.collideStrip = {
    x0: Math.min(a.x, b.x) + Math.min(0, nx * pad), z0: Math.min(a.y, b.y) + Math.min(0, nz * pad),
    x1: Math.max(a.x, b.x) + Math.max(0, nx * pad), z1: Math.max(a.y, b.y) + Math.max(0, nz * pad),
  };
  g.name = 'fence';
  return g;
}

export function railingRun({ from, to, h = 1.05, step = 1.5 } = {}) {
  const g = new THREE.Group();
  const a = new THREE.Vector2(...from), b = new THREE.Vector2(...to);
  const len = a.distanceTo(b);
  const n = Math.max(2, Math.round(len / step));
  const mat = toonMaterial(0x2f3a4c);
  const barGeo = new THREE.CylinderGeometry(0.03, 0.03, h, 5);
  const dir = b.clone().sub(a).normalize();
  const angle = Math.atan2(dir.y, dir.x);
  const y0 = groundHeight(a.x, a.y);
  for (let i = 0; i <= n; i++) {
    const p = a.clone().lerp(b, i / n);
    const bar = new THREE.Mesh(barGeo, mat);
    bar.position.set(p.x, y0 + h / 2, p.y);
    g.add(bar);
  }
  for (const dy of [h, h * 0.55]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.05), mat);
    const mid = a.clone().lerp(b, 0.5);
    rail.position.set(mid.x, y0 + dy, mid.y);
    rail.rotation.y = -angle;
    g.add(rail);
  }
  const pad = 0.1;
  g.userData.collideStrip = {
    x0: Math.min(a.x, b.x) - pad, z0: Math.min(a.y, b.y) - pad,
    x1: Math.max(a.x, b.x) + pad, z1: Math.max(a.y, b.y) + pad,
  };
  g.name = 'railing';
  return g;
}

// ---- living details: dog, cow, diya, temple flag, palm ----
export function streetDog() {
  const g = new THREE.Group();
  const fur = toonMaterial(0x8a745c);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.42, 4, 8), fur);
  body.rotation.z = Math.PI / 2 - 0.35;
  body.position.y = 0.18;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), fur);
  head.position.set(0.32, 0.13, 0.05);
  g.add(head);
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 6), fur);
  snout.rotation.z = Math.PI / 2;
  snout.position.set(0.42, 0.11, 0.05);
  g.add(snout);
  for (const sx of [-0.05, 0.06]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.09, 4), fur);
    ear.position.set(0.28, 0.24, 0.05 + sx * 0.4);
    g.add(ear);
  }
  const tail = new THREE.Group();
  const tailM = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.3, 5), fur);
  tailM.position.y = 0.15;
  tail.add(tailM);
  tail.position.set(-0.38, 0.1, 0);
  tail.rotation.z = 0.9;
  g.add(tail);
  g.name = 'street-dog';
  return { group: g, tail, body };
}

export function cow() {
  const g = new THREE.Group();
  g.userData.solid = true;
  const hide = toonMaterial(0xe8e0d4);
  const spot = toonMaterial(0x8a745c);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.0, 4, 10), hide);
  body.rotation.z = Math.PI / 2;
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);
  const patch = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), spot);
  patch.position.set(-0.1, 1.3, 0.25);
  patch.scale.set(1, 0.6, 0.8);
  g.add(patch);
  const neck = new THREE.Group();
  const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.3, 4, 8), hide);
  head.rotation.x = Math.PI / 2;
  head.position.y = 0.2;
  neck.add(head);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.3), toonMaterial(0xd8b8a8));
  snout.position.set(0, 0.42, 0.12);
  neck.add(snout);
  const horns = [];
  for (const sx of [-0.09, 0.09]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.18, 5), toonMaterial(0xc8bca0));
    horn.position.set(sx, 0.42, -0.08);
    neck.add(horn);
    horns.push(horn);
  }
  const ears = [];
  for (const sx of [-0.1, 0.1]) {
    const ear = new THREE.Group();
    const earM = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.02), hide);
    ear.add(earM);
    ear.position.set(sx * 1.8, 0.3, -0.02);
    neck.add(ear);
    ears.push(ear);
  }
  neck.position.set(0, 1.2, 0.75);
  g.add(neck);
  const legGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.75, 6);
  for (const [x, z] of [[-0.45, -0.25], [0.45, -0.25], [-0.45, 0.25], [0.45, 0.25]]) {
    const leg = new THREE.Mesh(legGeo, hide);
    leg.position.set(x, 0.37, z);
    leg.castShadow = true;
    g.add(leg);
  }
  const tail = new THREE.Group();
  const tailM = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.85, 5), hide);
  tailM.position.y = -0.42;
  tail.add(tailM);
  const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), spot);
  tuft.position.y = -0.85;
  tail.add(tuft);
  tail.position.set(0, 1.45, -0.78);
  g.add(tail);
  g.name = 'cow';
  return { group: g, tail, neck, ears, horns };
}

/** An oil lamp: clay bowl + living flame glow. */
export function diya({ scale = 1 } = {}) {
  const g = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * scale, 0.05 * scale, 0.035 * scale, 8), toonMaterial(0x9a5a3c));
  g.add(bowl);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.032 * scale, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffb44a }));
  flame.position.y = 0.055 * scale;
  flame.scale.y = 1.5;
  g.add(flame);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getLampGlowTex(), color: 0xffa04a, transparent: true, opacity: 0.65,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glow.scale.setScalar(0.5 * scale);
  glow.position.y = 0.07 * scale;
  g.add(glow);
  g.name = 'diya';
  return { group: g, flame, glow };
}

/** Red temple pennant on a pole — it must sway. */
export function templeFlag({ poleH = 1.6 }) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, poleH, 6), toonMaterial(0x8a7858));
  pole.position.y = poleH / 2;
  g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.34, 6, 1), toonMaterial(0xc23326, { side: THREE.DoubleSide }));
  flag.position.set(0.29, poleH - 0.2, 0);
  g.add(flag);
  g.name = 'temple-flag';
  return { group: g, flag };
}

/** Marigold door valance — a strand across the top of a doorframe
 *  with two short hanging tails. Festival dressing for shopfronts. */
export function marigoldToran({ w = 1.3, drop = 0.35, count = 11 } = {}) {
  const g = new THREE.Group();
  const flowerMat = toonMaterial(0xe8931a);
  const flowerMat2 = toonMaterial(0xf2b93a);
  const leafMat = toonMaterial(0x4a7a3a);
  let fMat = flowerMat;
  const bead = (p, s = 1) => {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.05 * s, 6, 5), fMat);
    f.position.copy(p);
    g.add(f);
  };
  // the horizontal strand with a gentle sag
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const x = -w / 2 + t * w;
    const y = -Math.sin(t * Math.PI) * 0.09;
    fMat = i % 5 === 2 ? flowerMat2 : (i % 5 === 4 ? leafMat : flowerMat);
    bead(new THREE.Vector3(x, y, 0), i % 5 === 4 ? 0.85 : 1);
  }
  // hanging tails at both ends
  for (const sx of [-1, 1]) {
    fMat = flowerMat;
    for (let i = 0; i < 4; i++) {
      fMat = i % 3 === 2 ? leafMat : flowerMat;
      bead(new THREE.Vector3(sx * (w / 2), -0.09 - i * 0.09, 0), 0.9);
    }
  }
  g.name = 'toran';
  return g;
}

/** A rangoli painted on the ground: concentric petals and dot rings.
 *  A festival-eve square keeps one fresh. CircleGeometry, laid flat. */
export function rangoli({ r = 1.1, seed = 1 } = {}) {
  const S = 256;
  const tex = makeCanvasTexture(S, S, (ctx, W, H) => {
    const cx = W / 2, cy = H / 2;
    let s = seed * 13.7;
    const rnd = () => { const x = Math.sin(s++ * 127.1) * 43758.5453; return x - Math.floor(x); };
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, W / 2 - 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#e8dfc8'; ctx.fillRect(0, 0, W, H);
    const ring = (rad, col, lw) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke(); };
    ring(W * 0.47, '#c23326', 5);
    ring(W * 0.40, '#2e7a4a', 4);
    ring(W * 0.26, '#c23326', 4);
    ring(W * 0.12, '#e8931a', 4);
    // petal rosette
    const petals = 12;
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2 + 0.13;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * W * 0.33, cy + Math.sin(a) * W * 0.33);
      ctx.rotate(a);
      ctx.fillStyle = i % 2 ? '#d85a6a' : '#e8931a';
      ctx.beginPath();
      ctx.ellipse(0, 0, W * 0.055, W * 0.105, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7a2c22'; ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    // the centre diya motif + scattered dots
    ctx.fillStyle = '#2e7a4a';
    ctx.beginPath(); ctx.arc(cx, cy, W * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b93a';
    ctx.beginPath(); ctx.arc(cx, cy, W * 0.03, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 24; i++) {
      const a = rnd() * Math.PI * 2, d = W * (0.16 + rnd() * 0.18);
      ctx.fillStyle = ['#c23326', '#e8931a', '#d85a6a', '#2e7a4a'][i % 4];
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, W * 0.008 + rnd() * W * 0.006, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, 28),
    toonMaterial(0xffffff, { paint: 0.015, map: tex, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  m.name = 'rangoli';
  return m;
}

// ---- hanging shop merchandise: bangle rings + chip packets ----
// Every Indian bazaar lane has these: a rope under the awning strung
// with bangle sets and bright packets, swaying a little in the breeze.
export function hangingGoods({ from, to, kind = 'bangles', count = 7 } = {}) {
  const g = new THREE.Group();
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const mid = a.clone().lerp(b, 0.5); mid.y -= 0.12;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.008, 4), new THREE.MeshBasicMaterial({ color: 0x14161c }));
  g.add(rope);
  const threadMat = new THREE.MeshBasicMaterial({ color: 0x22201c });
  const bangleCols = [0xd85a6a, 0x3a8a5e, 0xe8b93a, 0x9a6ad8, 0xd8842a];
  for (let i = 0; i < count; i++) {
    const t = (i + 1) / (count + 1);
    const p = curve.getPoint(t);
    if (kind === 'bangles') {
      // a set of 3 thin bangles on a thread
      for (let k = 0; k < 3; k++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.008, 6, 14), toonMaterial(bangleCols[(i + k) % bangleCols.length]));
        ring.position.set(p.x, p.y - 0.09 - k * 0.012, p.z);
        ring.rotation.x = Math.PI / 2 + 0.12;
        g.add(ring);
      }
      const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.08, 4), threadMat);
      thread.position.set(p.x, p.y - 0.045, p.z);
      g.add(thread);
    } else {
      // chip / snack packets: bright foil squares with a little sheen
      const cols = [0xc23326, 0x2e7a4a, 0xe8931a, 0x3a5a9c];
      for (let k = 0; k < 2; k++) {
        const packet = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.02), toonMaterial(cols[(i + k) % cols.length]));
        packet.position.set(p.x + k * 0.012, p.y - 0.09 - k * 0.01, p.z + k * 0.006);
        packet.rotation.y = 0.3 + i * 0.2;
        g.add(packet);
        const shine = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.05), new THREE.MeshBasicMaterial({ color: 0xfff6d8 }));
        shine.position.set(packet.position.x + 0.025, packet.position.y + 0.03, packet.position.z + 0.012);
        g.add(shine);
      }
      const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.07, 4), threadMat);
      thread.position.set(p.x, p.y - 0.035, p.z);
      g.add(thread);
    }
  }
  g.name = 'hanging-goods';
  return { group: g, curve };
}

/** Palm: bent trunk + a burst of fronds. Riverside trees. */
export function palm({ h = 6, lean = 0.12 } = {}) {
  const g = new THREE.Group();
  g.userData.solidCircle = 0.28;
  const trunkMat = toonMaterial(0x7a684f);
  const segs = 5;
  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.13 - t * 0.05, 0.16 - t * 0.05, h / segs, 7), trunkMat);
    seg.position.set(Math.sin(t * 1.2) * lean * h, (i + 0.5) * (h / segs), 0);
    seg.rotation.z = -Math.cos(t * 1.2) * lean;
    seg.castShadow = true;
    g.add(seg);
  }
  const crownX = Math.sin(1.2) * lean * h;
  const frondMat = toonMaterial(0x3a7a4e);
  const frondMat2 = toonMaterial(0x2e6244);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const frond = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.7), trunkMat);
    stem.position.z = 0.85;
    frond.add(stem);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 1.5), i % 2 ? frondMat : frondMat2);
    blade.position.set(0, 0.04, 1.1);
    frond.add(blade);
    frond.position.set(crownX, h - 0.1, 0);
    frond.rotation.y = a;
    frond.rotation.x = -0.55 - (i % 3) * 0.12;
    g.add(frond);
  }
  g.name = 'palm';
  return g;
}
