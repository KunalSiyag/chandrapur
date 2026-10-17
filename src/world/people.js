import * as THREE from 'three';
import { toonMaterial } from '../core/toon.js';
import { groundHeight, surfaceY, MOON_HOME } from './layout.js';
import { Human } from './people/human.js';
import { Driver, rot, rotMul } from './people/anim.js';
import { clamp, lerp, smooth, limb, ellipsoid, rbox, rings } from './people/skin.js';

// ============================================================
// The people of Chandpur, rebuilt the Sakura Crossing way:
// one skinned, painted person each — kurta-pyjama, sarees with
// pleated drapes and swaying pallus, salwar-kameez — pouring
// chai, fanning doorways, walking home with jhola bags,
// racing around the square lamp, flying a kite over the river.
// ============================================================

const pulse = (t, p, d) => { const c = ((t % p) + p) % p; return c < d ? Math.sin((c / d) * Math.PI) : 0; };

// ------------------------------------------------------------------ palettes
const SKIN = { warm: '#e8b48e', deep: '#d9a173', fair: '#f0c8a0', tan: '#c89066', old: '#e3b28f' };
const HAIR = {
  black: { top: '#2a222c', base: '#201a22', tip: '#1a141c', hi: '#4a3f4e', hi2: '#6a5a72' },
  oiled: { top: '#33262e', base: '#241a20', tip: '#1a1218', hi: '#574250', hi2: '#7a5f6e' },
  gray: { top: '#bdb9c3', base: '#aca8b4', tip: '#a19dab', hi: '#dbd8e0', hi2: '#e6e3ea' },
};

function faceF(o = {}) {
  return { skin: SKIN.warm, ink: '#3b3144', eyeP: 24, eyeT: -12, eyeW: 20, eyeH: 22, irisDark: '#4a3346', irisMid: '#7d5b62', irisLight: '#c69f8f',
    lash: 1, lidTop: -0.5, iris: 0.37, irisH: 0.46, brow: '#4a3428', browW: 1.7, browGap: 3.5, browArch: 2.4,
    noseT: -32, mouthT: -52, mouthW: 9, smile: 0.3, blush: 0.75, bindi: false, ...o };
}
function faceM(o = {}) {
  return faceF({ eyeW: 19, eyeH: 15, lash: 0.5, lidTop: -0.48, iris: 0.36, irisH: 0.5, browW: 2.6, browArch: 1.2, browGap: 3, blush: 0.25, smile: 0.1, ...o });
}
function faceKid(o = {}) {
  return faceF({ eyeH: 24, eyeW: 20, iris: 0.42, irisH: 0.5, blush: 0.6, smile: 0.45, browGap: 4, ...o });
}

// ------------------------------------------------------------------ handheld props (skinned into the mesh)
const M4 = (x, y, z, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)).setPosition(x, y, z);

/** small stacked-rings helper for props (thin vessel shapes) */
function vessel(hh, list, bone, color, matrix) {
  const g = rings(list.map(r => ({ y: r.y, a: r.a, b: r.b })), 12);
  hh.add(g, { bone, color, matrix });
  return g;
}

export function propJhola(hand, col = '#8a7850', greens = false) {
  return (hh) => {
    const k = hh.P.k, b = hh.b['hand' + hand];
    hh.add(rbox(0.24 * k, 0.2 * k, 0.06 * k, 0.01 * k, [0, -0.1 * k, 0.02 * k]), { bone: b, color: col, matrix: M4(0, -0.02 * k, 0.015 * k, 0.2, 0, 0) });
    if (greens) for (let i = 0; i < 4; i++) {
      hh.add(ellipsoid(0.028 * k, 0.02 * k, 0.028 * k, [(i - 1.5) * 0.035 * k, 0.005 * k, (i % 2) * 0.02 * k], 6, 5), { bone: b, color: '#5a8a3c', matrix: M4(0, -0.02 * k, 0.015 * k, 0.2, 0, 0) });
    }
  };
}
export function propKettle(hand) {
  return (hh) => {
    const k = hh.P.k, b = hh.b['hand' + hand];
    const mat = M4(0, -0.055 * k, 0.02 * k, Math.PI / 2 + 0.2, 0, 0.5);
    const tin = '#9aa0a8';
    vessel(hh, [{ y: 0, a: 0.052 * k, b: 0.052 * k }, { y: 0.03 * k, a: 0.05 * k, b: 0.05 * k }, { y: 0.075 * k, a: 0.038 * k, b: 0.038 * k }], b, tin, mat);
    hh.add(rbox(0.012 * k, 0.09 * k, 0.012 * k, 0.004 * k, [0.055 * k, 0.065 * k, 0]), { bone: b, color: tin, matrix: mat });
  };
}
export function propFan(hand, col = '#e8d9b8') {
  return (hh) => {
    const k = hh.P.k, b = hh.b['hand' + hand];
    hh.add(rbox(0.19 * k, 0.15 * k, 0.012 * k, 0.02 * k, [0, -0.075 * k, 0.025 * k]), { bone: b, color: col, matrix: M4(0, -0.01 * k, 0.01 * k, 1.35, 0, 0.25) });
    hh.add(rbox(0.02 * k, 0.07 * k, 0.02 * k, 0.006 * k, [0, -0.02 * k, 0]), { bone: b, color: '#8a6a4a' });
  };
}
export function propGlass(hand) {
  return (hh) => {
    const k = hh.P.k;
    vessel(hh, [{ y: 0, a: 0.026 * k, b: 0.022 * k }, { y: 0.05 * k, a: 0.03 * k, b: 0.026 * k }], hh.b['hand' + hand], '#e8b45e', M4(0, -0.05 * k, 0.02 * k, 0.2, 0, 0));
  };
}
export function propLathi(hand) {
  return (hh) => {
    const k = hh.P.k;
    hh.add(limb(0.95 * k, 0.016 * k, 0.02 * k, { cols: 8 }), { bone: hh.b['hand' + hand], color: '#8a7452', matrix: M4(0.01 * k, 0, 0.02 * k, 0.15, 0, -0.06) });
  };
}
export function propSpool(hand) {
  return (hh) => {
    const k = hh.P.k;
    hh.add(rbox(0.055 * k, 0.05 * k, 0.055 * k, 0.008 * k, [0, -0.05 * k, 0.01 * k]), { bone: hh.b['hand' + hand], color: '#8a6a4a' });
  };
}
export function propMatka(fore) {
  return (hh) => {
    const k = hh.P.k, b = hh.b['farm' + fore];
    hh.add(ellipsoid(0.105 * k, 0.09 * k, 0.105 * k, [0, -0.1 * k, 0.06 * k], 12, 9), { bone: b, color: '#a8593c' });
    vessel(hh, [{ y: 0, a: 0.052 * k, b: 0.052 * k }, { y: 0.012 * k, a: 0.056 * k, b: 0.056 * k }], b, '#8a4a30', M4(0, -0.005 * k, 0.06 * k));
  };
}
export function propShawl(col = '#8a4a38') {
  return (hh) => {
    const k = hh.P.k;
    const g = new THREE.TorusGeometry(0.175 * k, 0.052 * k, 10, 22, Math.PI * 1.9);
    hh.add(g, { bone: hh.b.chest, color: col, matrix: M4(0, 0.12 * k, -0.01 * k, Math.PI / 2, 0, Math.PI * 0.55), weights: hh.torsoWeights() });
  };
}

// ------------------------------------------------------------------ walk cycle (planted feet, from Sakura's grandmother)
/** Drive a person's gait from distance travelled. Legs plant and swing with IK. */
export function walkCycle(d, h, dist, { stride = 0.42, lift = 0.05, lean = 0.06, sway = 1 } = {}) {
  const b = h.b, P = h.P;
  const ph = dist / stride;
  const bob = Math.abs(Math.sin(ph * Math.PI));
  b.hips.position.y += -0.012 + 0.012 * bob;
  b.hips.position.x += 0.016 * Math.sin(ph * Math.PI) * sway;
  rotMul(b.hips, lean, 0.05 * Math.sin(ph * Math.PI) * sway, 0.03 * Math.sin(ph * Math.PI) * sway);
  h.group.updateMatrixWorld(true);
  const foot = (n, off) => {
    const s = n === 'L' ? 1 : -1;
    let p = (((ph + off) % 2) + 2) % 2;
    let zf, yf = P.ankle;
    if (p < 1.2) zf = lerp(stride * 0.3, -stride * 0.3, p / 1.2);
    else { const q = (p - 1.2) / 0.8; zf = lerp(-stride * 0.3, stride * 0.3, smooth(0, 1, q)); yf += lift * Math.sin(q * Math.PI); }
    return [s * P.hipJx * 1.1, yf, zf];
  };
  d.leg('L', foot('L', 0), 0.16, [0.08, 1]);
  d.leg('R', foot('R', 1), -0.16, [0.08, 1]);
  rotMul(b.spine, lean * 0.6, 0, 0);
  rotMul(b.chest, lean * 0.5, -0.04 * Math.sin(ph * Math.PI) * sway, 0);
  return ph;
}

/** idle standing: soft knees, tiny sway */
export function idlePose(d, h, t, o = {}) {
  const s = Math.sin(t * 0.31 + h.seed * 1.7);
  d.stand({ hx: (o.hx ?? 0.012) * s, hrz: (o.hrz ?? 0.015) * s, hry: o.hry ?? 0, footL: o.footL, footR: o.footR, stance: o.stance ?? 1.05 });
}

/** a walk between two points with pauses and a smooth turn-around */
function patrol(t, ax, az, bx, bz, { speed = 1.0, pause = 4, turn = 2.4 } = {}) {
  const len = Math.hypot(bx - ax, bz - az);
  const legT = len / speed;
  const period = 2 * (legT + pause + turn);
  const c = ((t % period) + period) % period;
  const headA = Math.atan2(bx - ax, bz - az);
  const headB = Math.atan2(ax - bx, az - bz);
  let s = 0, walking = false, yaw = headA, at = 'A';
  if (c < legT) { s = c * speed; walking = true; yaw = headA; at = 'AB'; }
  else if (c < legT + pause) { s = len; yaw = headA; at = 'B'; }
  else if (c < legT + pause + turn) { s = len; yaw = headA + Math.PI * smooth(0, 1, (c - legT - pause) / turn); at = 'B'; }
  else if (c < 2 * legT + pause + turn) { s = len - (c - legT - pause - turn) * speed; walking = true; yaw = headB; at = 'BA'; }
  else if (c < 2 * legT + 2 * pause + turn) { s = 0; yaw = headB; at = 'A'; }
  else { s = 0; yaw = headB + Math.PI * smooth(0, 1, (c - 2 * legT - 2 * pause - turn) / turn); at = 'A'; }
  const u = s / len;
  return { x: lerp(ax, bx, u), z: lerp(az, bz, u), dist: (at === 'BA' ? 2 * len - s : s), walking, yaw, at };
}

// a stretched cylinder whose base sits at `from` and reaches `to`
function makeStretch(r, mat) {
  const geo = new THREE.CylinderGeometry(r, r, 1, 6, 1, true);
  geo.translate(0, 0.5, 0);
  return new THREE.Mesh(geo, mat);
}
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
function stretch(m, from, to) {
  m.position.copy(from);
  _dir.copy(to).sub(from);
  const len = _dir.length();
  m.quaternion.setFromUnitVectors(_up, _dir.normalize());
  m.scale.set(1, len, 1);
}

// ============================================================
// assembly
// ============================================================
export function createPeople(scene, opts = {}) {
  const group = new THREE.Group();
  group.name = 'people';
  const updaters = [];
  const getPlayer = opts.getPlayer || (() => null);
  const playerPos = () => {
    const pl = getPlayer();
    return pl && pl.position ? pl.position : null;
  };
  const nearPlayer = (x, z, r = 5) => {
    const p = playerPos();
    return p ? Math.hypot(p.x - x, p.z - z) < r : false;
  };
  const lookTarget = new THREE.Vector3();
  const tmpV = new THREE.Vector3();
  const handW = new THREE.Vector3();
  const pole = new THREE.Vector3();

  const spawn = (spec) => {
    const h = new Human(spec);
    if (spec.circle) h.group.userData.solidCircle = spec.circle;
    group.add(h.group);
    return h;
  };

  // ================= 1. the chai-wala, behind his square stall =================
  {
    const h = spawn({
      key: 'chaiwala', sex: 'm', height: 1.64, seed: 11, skin: SKIN.tan, ears: true,
      face: faceM({ skin: SKIN.tan, irisMid: '#6a4a3e', irisLight: '#a07a5e', smile: 0.3 }),
      hair: { fringe: { n: 5, span: 52, tip: 12, skew: 10, w: 0.05, edgeDrop: 8 }, hairlineSide: -16, hairlineBack: -60, volume: 1.05 },
      hairStyle: 'short', hairTex: HAIR.black,
      outfit: { kind: 'kurta', topColor: '#6e7a5a', bottomColor: '#d8cfbf', shoes: '#5a4a3a' },
      hands: { L: 'relax', R: 'grip' },
      props: [propKettle('R'), propShawl('#6a5a3a')],
      variants: ['open', 'blink', 'talk'],
      circle: 0.42,
    });
    h.group.name = 'chai-wala';
    const d = new Driver(h, { seed: 11 });
    const pourFrom = new THREE.Vector3();
    const glassPoint = new THREE.Vector3(11.54, groundHeight(11.54, -2.92) + 1.02, -2.92);
    const stream = makeStretch(0.008, new THREE.MeshBasicMaterial({ color: 0xd8a44a, transparent: true, opacity: 0.85 }));
    stream.visible = false;
    stream.name = 'chai-stream';
    group.add(stream);

    updaters.push((t) => {
      d.place(12.22, groundHeight(12.22, -3.18), -3.18, -Math.PI / 2 - 0.3);
      d.reset();
      idlePose(d, h, t, { stance: 1.15 });
      d.breathe(t);
      // left hand rests on the counter
      d.arm('L', 0.62, 0.18, 0, 0.25, [0.3, 0, 0]);
      // right hand: stir, then raise and pour
      const c = t % 11;
      const pour = smooth(3.4, 4.0, c) * (1 - smooth(6.6, 7.2, c));
      const raise = smooth(3.0, 3.6, c) * (1 - smooth(7.0, 7.6, c));
      d.arm('R', 0.45 + raise * 0.6, 0.12, 0, 0.5 + raise * 0.55, [-0.2 - pour * 0.5, 0, 0.2]);
      stream.visible = pour > 0.4;
      if (stream.visible) {
        h.group.updateMatrixWorld(true);
        h.b.handR.getWorldPosition(handW);
        handW.y += 0.02;
        stretch(stream, handW, glassPoint);
      }
      if (nearPlayer(12.2, -3.1, 6.5)) {
        const pp = playerPos();
        lookTarget.set(pp.x, pp.y + 1.45, pp.z);
        d.lookAt(lookTarget, 1 / 60, { speed: 3.5 });
      } else {
        lookTarget.set(4 + Math.sin(t * 0.23) * 4, 1.4, -4 + Math.cos(t * 0.17) * 3);
        d.lookAt(lookTarget, 1 / 60, { maxYaw: 0.7 });
      }
      d.blink(t);
    });
  }

  // ================= 2. the sweets-shop owner, fanning his doorway =================
  {
    const h = spawn({
      key: 'sweets', sex: 'm', height: 1.68, seed: 12, skin: SKIN.warm, ears: true,
      face: faceM({ skin: SKIN.warm, irisMid: '#5d4a44', irisLight: '#8f7564', smile: 0.2 }),
      hair: { fringe: { n: 5, span: 54, tip: 14, skew: 12, w: 0.056, edgeDrop: 10 }, hairlineSide: -12, hairlineBack: -58, volume: 1.06 },
      hairStyle: 'short', hairTex: HAIR.oiled,
      outfit: { kind: 'kurta-vest', topColor: '#e8d8b8', waistcoat: '#7a2c22', bottomColor: '#d8cfbf', shoes: '#4a3a30' },
      hands: { L: 'relax', R: 'grip' },
      props: [propFan('R', '#e8d0a0')],
      variants: ['open', 'blink'],
      circle: 0.42,
    });
    h.group.name = 'sweets-owner';
    const d = new Driver(h, { seed: 12 });
    updaters.push((t) => {
      d.place(-3.95, groundHeight(-3.95, 3.96), 3.96, Math.PI / 2 + 0.15);
      d.reset();
      idlePose(d, h, t);
      d.breathe(t);
      d.arm('L', 0.25, 0.34, 0.1, 1.15, [0.2, 0, 0]); // hand at the waist
      // the pankhi waves near his face
      d.arm('R', 0.68, 0.26, 0.2, 1.55, [-0.5 + Math.sin(t * 4.4) * 0.3, 0, 0.3]);
      const c = t % 26;
      if (c > 9 && c < 13.5) lookTarget.set(-4.25, groundHeight(-8.2, 6.2) + 3.2, 6.2); // his shop cat
      else if (nearPlayer(-3.95, 3.96, 6.5)) {
        const pp = playerPos();
        lookTarget.set(pp.x, pp.y + 1.45, pp.z);
      } else lookTarget.set(-2 + Math.sin(t * 0.21) * 6, 1.3, 6 + Math.cos(t * 0.16) * 8);
      d.lookAt(lookTarget, 1 / 60);
      d.blink(t);
    });
  }

  // ================= 3. two women walking the bazaar lane =================
  {
    const wa = spawn({
      key: 'womanA', sex: 'f', height: 1.56, seed: 21, skin: SKIN.fair,
      face: faceF({ skin: SKIN.fair, irisMid: '#6a4a42', irisLight: '#b08a6a', bindi: true, smile: 0.2, eyeH: 19 }),
      hair: { fringe: { n: 6, span: 58, tip: 8, skew: 14, w: 0.056, part: 4, partAt: -10 }, hairlineSide: -60, hairlineBack: -74, flare: 0.12, side: { w: 0.04 }, bun: { r: 0.042, th: 14 } },
      hairStyle: 'short', hairTex: HAIR.oiled,
      outfit: { kind: 'saree', topColor: '#c23326', bottomColor: '#2e7a4a', pallu: '#d85a2a', hem: '#d8b83a', shoes: '#7a4a3a' },
      hands: { L: 'relax', R: 'hold' },
      props: [propJhola('R', '#8a7850')],
      variants: ['open', 'blink', 'talk'],
    });
    wa.group.name = 'woman-a';
    const wb = spawn({
      key: 'womanB', sex: 'f', height: 1.6, seed: 22, skin: SKIN.warm,
      face: faceF({ skin: SKIN.warm, irisMid: '#5d4840', irisLight: '#a8825e', bindi: true, smile: 0.35 }),
      hair: { fringe: { n: 7, span: 60, tip: 2, skew: 5, w: 0.05 }, side: { long: 0.08, w: 0.032 }, back: { len: 0.42, n: 5, span: 90, w: 0.06, spread: 0.25 }, hairlineBack: -62 },
      hairStyle: 'short', hairTex: HAIR.black,
      outfit: { kind: 'kameez', topColor: '#9c4a78', dupatta: '#e8d9a8', bottomColor: '#4a4a5a', shoes: '#6a4a3a' },
      hands: { L: 'hold', R: 'relax' },
      props: [propJhola('L', '#5a6a52', true)],
      variants: ['open', 'blink', 'talk'],
    });
    wb.group.name = 'woman-b';
    const da = new Driver(wa, { seed: 21, hairAmp: 1.1, skirtAmp: 1.3 });
    const db = new Driver(wb, { seed: 22, hairAmp: 1.15 });

    updaters.push((t) => {
      const st = patrol(t, -2.35, 6, -2.35, 21, { speed: 0.92, pause: 7, turn: 2.8 });
      const legs = [{ w: wa, d: da, sgn: -1 }, { w: wb, d: db, sgn: 1 }];
      for (const { w, d, sgn } of legs) {
        const x = st.x + sgn * 0.42, z = st.z + sgn * 0.3;
        const y = surfaceY(x, z);
        let yaw = st.yaw;
        let talk = 0;
        if (!st.walking && st.at === 'B') {
          yaw = Math.atan2(-sgn, 0.25);
        }
        d.place(x, y, z, yaw);
        d.reset();
        if (st.walking) {
          walkCycle(d, w, st.dist, { stride: 0.38, lift: 0.045, lean: 0.04 });
          const sw = Math.sin((st.dist / 0.38) * Math.PI);
          if (sgn < 0) { d.arm('R', -sw * 0.12, 0.08, 0, 0.25); d.arm('L', sw * 0.12, 0.06, 0, 0.28); }
          else { d.arm('L', -sw * 0.12, 0.08, 0, 0.25); d.arm('R', sw * 0.12, 0.06, 0, 0.28); }
        } else {
          idlePose(d, w, t, { stance: 1.0 });
          talk = pulse(t + w.seed, 3.3, 1.4);
          if (sgn < 0) d.arm('R', 0.35 + talk * 0.4, 0.14, 0, 0.8 + talk * 0.3);
          else d.arm('L', 0.3 + talk * 0.35, 0.14, 0, 0.75 + talk * 0.3);
        }
        d.breathe(t);
        if (nearPlayer(x, z, 4.5)) {
          const pp = playerPos();
          lookTarget.set(pp.x, pp.y + 1.4, pp.z);
          d.lookAt(lookTarget, 1 / 60, { maxYaw: 0.9 });
        } else if (!st.walking) {
          lookTarget.set(x - sgn * 0.6, y + 1.42, z + 0.3);
          d.lookAt(lookTarget, 1 / 60);
        } else {
          lookTarget.set(x + Math.sin(yaw) * 5 + Math.sin(t * 0.4 + w.seed) * 1.5, y + 1.4, z + Math.cos(yaw) * 5);
          d.lookAt(lookTarget, 1 / 60, { maxYaw: 0.3 });
        }
        d.wind(t, 1 / 60);
        d.blink(t, !st.walking && talk > 0.5);
      }
    });
  }

  // ================= 4. the kids, racing around the square lamp =================
  {
    const kA = spawn({
      key: 'kidA', sex: 'm', height: 1.12, width: 0.88, shoulder: 0.84, headK: 1.14, seed: 31, skin: SKIN.warm,
      face: faceKid({ skin: SKIN.warm, irisMid: '#5a4a46', irisLight: '#937a6a' }),
      hair: { fringe: { n: 6, span: 58, tip: 10, skew: -10, w: 0.058, edgeDrop: 12 }, hairlineSide: -16, hairlineBack: -66, volume: 1.1 },
      hairStyle: 'short', hairTex: HAIR.black,
      outfit: { kind: 'school', topColor: '#ecebe4', shorts: '#2c3a5e', shoes: '#3a3430' },
      variants: ['open', 'blink', 'laugh'],
    });
    kA.group.name = 'kid-a';
    const kB = spawn({
      key: 'kidB', sex: 'm', height: 1.06, width: 0.9, shoulder: 0.85, headK: 1.16, seed: 32, skin: SKIN.deep,
      face: faceKid({ skin: SKIN.deep, irisMid: '#54423a', irisLight: '#8a6a50' }),
      hair: { fringe: { n: 5, span: 55, tip: 14, skew: 14, w: 0.06, edgeDrop: 8 }, hairlineSide: -14, hairlineBack: -60, volume: 1.08 },
      hairStyle: 'short', hairTex: HAIR.oiled,
      outfit: { kind: 'kurta', topColor: '#d8b83a', bottomColor: '#4a4a5a', shoes: '#3a3430' },
      variants: ['open', 'blink', 'laugh'],
    });
    kB.group.name = 'kid-b';
    const dA = new Driver(kA, { seed: 31 });
    const dB = new Driver(kB, { seed: 32 });
    const C = { x: -11, z: -5 }, R = 1.5;
    updaters.push((t) => {
      for (const [w, d, wgt, ph] of [[kA, dA, 0.9, 0], [kB, dB, 0.98, 2.75]]) {
        const ang = t * wgt + ph;
        const x = C.x + Math.cos(ang) * R, z = C.z + Math.sin(ang) * R;
        const yaw = Math.atan2(-Math.sin(ang), Math.cos(ang));
        d.place(x, groundHeight(x, z), z, yaw);
        d.reset();
        walkCycle(d, w, ang * R + 40, { stride: 0.52, lift: 0.075, lean: 0.14 });
        const sw = Math.sin((ang * R) / 0.52 * Math.PI);
        d.arm('L', sw * 0.7, 0.12, 0, 0.6);
        d.arm('R', -sw * 0.7, 0.12, 0, 0.6);
        d.breathe(t, 1.4);
        if (nearPlayer(x, z, 3.2)) {
          const pp = playerPos();
          lookTarget.set(pp.x, pp.y + 1.1, pp.z);
          d.lookAt(lookTarget, 1 / 60, { maxYaw: 0.9 });
        } else {
          d.lookYP(0.2 * Math.sin(t * 1.7 + ph), -0.06, 1 / 60);
        }
        // the laughing bounds of children racing
        const laugh = ((t + ph) % 3.4) < 0.5;
        w.setFace(laugh ? 'laugh' : 'open');
      }
    });
  }

  // ================= 5. the kite boy, on the promenade =================
  {
    const kid = spawn({
      key: 'kiteboy', sex: 'm', height: 1.18, width: 0.9, shoulder: 0.86, headK: 1.15, seed: 33, skin: SKIN.fair,
      face: faceKid({ skin: SKIN.fair, irisMid: '#4f4a5e', irisLight: '#86809a' }),
      hair: { fringe: { n: 6, span: 58, tip: 5, skew: 12, w: 0.06, edgeDrop: 14 }, hairlineSide: -20, hairlineBack: -68, volume: 1.11 },
      hairStyle: 'short', hairTex: HAIR.black,
      outfit: { kind: 'school', topColor: '#d8dcca', shorts: '#5a4a6e', shoes: '#3a3430' },
      hands: { L: 'grip', R: 'grip' },
      props: [propSpool('L')],
      variants: ['open', 'blink'],
      circle: 0.32,
    });
    kid.group.name = 'kite-boy';
    const d = new Driver(kid, { seed: 33 });
    const kp = { x: -6.5, z: 29.8 };
    // the kite: a marigold diamond patrolling the sky over the river
    const kite = new THREE.Group();
    kite.add(new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.6, 2, 2), toonMaterial(0xe8931a, { side: THREE.DoubleSide })));
    const sparMat = toonMaterial(0x6a5a44);
    const spineB = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.66, 0.015), sparMat); spineB.position.z = -0.008;
    const spar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.015), sparMat); spar.position.set(0, 0.06, -0.008);
    kite.add(spineB, spar);
    const tail = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const bow = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.05), toonMaterial(i % 2 ? 0xc23326 : 0x2e7a4a, { side: THREE.DoubleSide }));
      bow.position.set(Math.sin(i * 2.1) * 0.05, -0.42 - i * 0.14, -0.02 - i * 0.06);
      bow.rotation.z = i * 0.7;
      tail.add(bow);
    }
    kite.add(tail);
    kite.name = 'kite';
    group.add(kite);
    const line = makeStretch(0.006, toonMaterial(0xc8b48a));
    group.add(line);
    const kiteW = new THREE.Vector3();
    const shoulderW = new THREE.Vector3();

    updaters.push((t) => {
      // the kite drifts on the night wind above the river
      const kx = 2 + Math.sin(t * 0.3) * 2.6;
      const ky = 15.5 + Math.sin(t * 0.5 + 1) * 1.2;
      const kz = 40.5 + Math.cos(t * 0.24) * 2.0;
      kiteW.set(kx, ky, kz);
      kite.position.copy(kiteW);
      kite.rotation.set(0.4 + Math.sin(t * 0.7) * 0.1, Math.atan2(kp.x - kx, kp.z - kz), Math.sin(t * 0.9) * 0.16);
      tail.rotation.z = Math.sin(t * 1.4) * 0.2;

      // the boy stands under it, facing it, leaning back
      const yaw = Math.atan2(kx - kp.x, kz - kp.z);
      d.place(kp.x, groundHeight(kp.x, kp.z), kp.z, yaw);
      d.reset();
      idlePose(d, kid, t, { stance: 1.0 });
      kid.b.spine.rotation.x -= 0.05;
      d.breathe(t);
      // his right arm stretches up along the line
      kid.group.updateMatrixWorld(true);
      kid.b.uarmR.getWorldPosition(shoulderW);
      _dir.copy(kiteW).sub(shoulderW).normalize();
      const armLen = (kid.P.uarm + kid.P.farm) * 0.96;
      lookTarget.copy(shoulderW).addScaledVector(_dir, armLen);
      pole.copy(shoulderW).addScaledVector(_dir, armLen * 0.3).add(new THREE.Vector3(Math.cos(yaw) * 0.25, 0, -Math.sin(yaw) * 0.25));
      d.armIK('R', lookTarget, pole);
      d.arm('L', 0.45, 0.18, 0, 1.1, [0.2, 0, 0]);
      kid.group.updateMatrixWorld(true);
      kid.b.handR.getWorldPosition(handW);
      stretch(line, handW, kiteW);
      d.lookAt(kiteW, 1 / 60, { maxUp: 0.85 });
      d.blink(t);
    });
  }

  // ================= 6. the old man, out with his lathi =================
  {
    const h = spawn({
      key: 'oldman', sex: 'm', height: 1.58, width: 1.06, belly: 0.1, headK: 1.06, seed: 41, skin: SKIN.old, ears: true,
      face: faceM({ skin: SKIN.old, eyeW: 17, eyeH: 12, lidTop: -0.3, lash: 0.4, iris: 0.4, irisH: 0.55, irisMid: '#5e4d48', irisLight: '#8a766c', blush: 0.35, brow: '#9a9097', browW: 1.8, browGap: 4, smile: 0.5, wrinkles: true }),
      hair: { fringe: { n: 6, span: 62, tip: 18, skew: 26, w: 0.06, part: 8, partAt: 0, edgeDrop: 6 }, hairlineSide: -18, hairlineBack: -44, volume: 1.1 },
      hairStyle: 'short', hairTex: HAIR.gray,
      outfit: { kind: 'kurta-vest', topColor: '#d8cfbf', waistcoat: '#4a5548', bottomColor: '#c8bcae', shoes: '#4a3a30' },
      hands: { L: 'relax', R: 'grip' },
      props: [propLathi('R'), propShawl('#8a4a38')],
      variants: ['open', 'blink'],
    });
    h.group.name = 'old-man';
    const d = new Driver(h, { seed: 41 });
    updaters.push((t) => {
      const st = patrol(t, -34, 28.4, -17, 28.4, { speed: 0.55, pause: 7, turn: 3.2 });
      d.place(st.x, groundHeight(st.x, st.z), st.z, st.yaw);
      d.reset();
      if (st.walking) {
        walkCycle(d, h, st.dist, { stride: 0.34, lift: 0.03, lean: 0.16 });
        const sw = Math.sin((st.dist / 0.34) * Math.PI);
        d.arm('R', 0.3 + sw * 0.1, 0.16, 0, 0.25);
        d.arm('L', -sw * 0.08 - 0.04, 0.08, 0, 0.2);
        lookTarget.set(st.x + Math.sin(st.yaw) * 5, groundHeight(st.x, st.z) + 1.3, st.z + Math.cos(st.yaw) * 5);
        d.lookAt(lookTarget, 1 / 60, { maxYaw: 0.3 });
      } else {
        idlePose(d, h, t, { stance: 1.1 });
        d.arm('R', 0.22, 0.14, 0, 0.22);
        d.arm('L', 0.18, 0.1, 0, 0.3);
        if (st.at === 'A') {
          lookTarget.set(-36, 1.6, 27.8); // he checks on the decorated cow
          d.lookAt(lookTarget, 1 / 60, { maxYaw: 1.0 });
        } else {
          d.lookYP(0.3 * Math.sin(t * 0.17), -0.2, 1 / 60);
        }
      }
      h.b.spine.rotation.x += 0.2; // the permanent bow of old backs
      d.breathe(t, 1.15);
      d.wind(t, 1 / 60);
      d.blink(t, 5.1);
    });
  }

  // ================= 7. the matka woman, up from the ghat =================
  {
    const h = spawn({
      key: 'matka', sex: 'f', height: 1.54, seed: 51, skin: SKIN.deep,
      face: faceF({ skin: SKIN.deep, irisMid: '#5d4840', irisLight: '#a8825e', bindi: true, smile: 0.15 }),
      hair: { fringe: { n: 6, span: 58, tip: 8, skew: 14, w: 0.056, part: 4, partAt: -10 }, hairlineSide: -58, hairlineBack: -72, flare: 0.14, side: { w: 0.04 }, bun: { r: 0.04, th: 16 } },
      hairStyle: 'short', hairTex: HAIR.black,
      outfit: { kind: 'saree', topColor: '#9c4a78', bottomColor: '#3a6a9c', pallu: '#d8b83a', hem: '#e8d9a8', shoes: '#7a4a3a' },
      hands: { L: 'hold', R: 'relax' },
      props: [propMatka('L')],
      variants: ['open', 'blink'],
    });
    h.group.name = 'matka-woman';
    const d = new Driver(h, { seed: 51, hairAmp: 1.1, skirtAmp: 1.4 });
    updaters.push((t) => {
      // the loop: promenade edge, down the ghat steps, a pause at the water, back up, a stretch west
      const T = 7.5, DOWN = 3.5, PAUSE = 5, UP = 7.5, WALK = 5, PAUSE2 = 4;
      const period = T + DOWN + PAUSE + UP + WALK + PAUSE2;
      const c = ((t % period) + period) % period;
      let x = -1.5, z = 29.4, yaw = Math.PI / 2, walking = true, dist = t * 0.8;
      if (c < T) { z = lerp(29.4, 30.6, c / T); dist = c * 0.55; yaw = Math.PI / 2; }
      else if (c < T + DOWN) { z = lerp(30.6, 32.5, (c - T) / DOWN); dist = T * 0.55 + (c - T) * 0.45; yaw = Math.PI / 2; }
      else if (c < T + DOWN + PAUSE) { z = 32.5; walking = false; yaw = Math.PI / 2; }
      else if (c < T + DOWN + PAUSE + UP) { z = lerp(32.5, 30.6, (c - T - DOWN - PAUSE) / UP); dist = (T + DOWN) * 0.5 + (c - T - DOWN - PAUSE) * 0.4; yaw = -Math.PI / 2; }
      else if (c < T + DOWN + PAUSE + UP + WALK) {
        const u = (c - T - DOWN - PAUSE - UP) / WALK;
        x = lerp(-1.5, -8, u); z = lerp(30.6, 29.6, u);
        dist = (T + DOWN) * 0.5 + UP * 0.4 + (c - T - DOWN - PAUSE - UP) * 0.7;
        yaw = -Math.PI / 2 - 0.1;
      } else { x = -8; z = 29.6; walking = false; yaw = Math.PI / 2 + 0.3; }
      d.place(x, surfaceY(x, z), z, yaw);
      d.reset();
      if (walking) {
        walkCycle(d, h, dist, { stride: 0.36, lift: 0.04, lean: 0.05 });
      } else {
        idlePose(d, h, t, { stance: 1.0 });
        d.lookYP(0.3 * Math.sin(t * 0.19), -0.15, 1 / 60);
      }
      // the left arm cradles the matka; the right steadies it or swings
      d.arm('L', 0.3, 0.42, 0.1, 1.25, [0.15, 0, 0]);
      d.arm('R', walking ? 0.05 : 0.35, 0.12, 0, walking ? 0.25 : 0.7);
      d.breathe(t);
      d.wind(t, 1 / 60, { legs: walking ? [{ x: 0.3, a: 0.04 }] : null });
      d.blink(t);
    });
  }

  // ================= 8. the rickshaw man, asleep on his seat =================
  {
    const h = spawn({
      key: 'sleeper', sex: 'm', height: 1.6, seed: 61, skin: SKIN.warm, ears: true,
      face: faceM({ skin: SKIN.warm, irisMid: '#5d4a44', irisLight: '#8f7564', smile: 0.4 }),
      hair: { fringe: { n: 5, span: 54, tip: 14, skew: 10, w: 0.05, edgeDrop: 6 }, hairlineSide: -14, hairlineBack: -62, volume: 1.035 },
      hairStyle: 'short', hairTex: HAIR.black,
      outfit: { kind: 'kurta', topColor: '#8a8276', bottomColor: '#c8bcae', shoes: '#4a3a30' },
      props: [propShawl('#8a4a38')],
      variants: ['blink'],
    });
    h.group.name = 'rickshaw-sleeper';
    const d = new Driver(h, { seed: 61 });
    updaters.push((t) => {
      // curled on the cycle-rickshaw seat at the station corner
      d.place(12.26, 0.74, -4.97, 0.9 + Math.PI / 2);
      d.reset();
      const b = h.b, P = h.P;
      b.hips.position.y += -0.24 * P.k;
      rot(b.hips, 0.05, 0.25, 0);
      for (const s of ['L', 'R']) {
        rot(b['thigh' + s], -1.25, 0, s === 'L' ? 0.1 : -0.12);
        rot(b['shin' + s], 1.35, 0, 0);
        rot(b['foot' + s], 0.25, 0, 0);
      }
      rot(b.spine, -0.22, 0, 0);
      rot(b.chest, -0.08, 0, 0);
      rot(b.neck, 0.12, 0.2, 0.12);
      rot(b.head, 0.1, 0.15, 0.3);
      for (const s of ['L', 'R']) {
        rot(b['uarm' + s], -0.15, 0, s === 'L' ? 0.5 : -0.5);
        rot(b['farm' + s], -1.6, 0, 0);
        rot(b['hand' + s], 0, 0, 0);
      }
      h.setFace('blink'); // eyes shut, sleeping
      d.breathe(t, 0.6);
    });
  }

  // ================= 9. the chai drinker on the ghat step =================
  {
    const h = spawn({
      key: 'drinker', sex: 'm', height: 1.6, seed: 71, skin: SKIN.warm, ears: true,
      face: faceM({ skin: SKIN.warm, irisMid: '#5d4a44', irisLight: '#8f7564', smile: 0.25 }),
      hair: { fringe: { n: 6, span: 56, tip: 6, skew: 10, w: 0.055, edgeDrop: 14 }, hairlineSide: -18, hairlineBack: -68, volume: 1.08, side: { w: 0.028 } },
      hairStyle: 'short', hairTex: HAIR.black,
      outfit: { kind: 'kurta', topColor: '#465064', bottomColor: '#d8cfbf', shoes: '#4a3a30' },
      hands: { L: 'relax', R: 'hold' },
      props: [propGlass('R'), propShawl('#8a4a38')],
      variants: ['open', 'blink'],
      circle: 0.44,
    });
    h.group.name = 'chai-drinker';
    const d = new Driver(h, { seed: 71 });
    updaters.push((t) => {
      d.place(-12.4, -0.02, 31.45, 1.06);
      d.reset();
      const b = h.b, P = h.P;
      // sitting on the top step, legs dangling over the second tread
      b.hips.position.set(0.02, 0.24 * P.k, -0.1);
      rot(b.hips, -0.08, 0, 0);
      h.group.updateMatrixWorld(true);
      d.leg('L', [0.11, -0.34 * P.k, 0.42], 0.1, [0.1, 1]);
      d.leg('R', [-0.12, -0.34 * P.k, 0.46], -0.1, [0.1, 1]);
      rotMul(b.spine, 0.1, 0, 0); rotMul(b.chest, 0.06, 0, 0);
      d.breathe(t, 0.9);
      // sips from the glass now and then, watching where the moon comes down
      const sip = smooth(4, 4.6, t % 9) * (1 - smooth(6.2, 6.8, t % 9));
      d.arm('R', 0.5 + sip * 0.6, 0.18, 0, 0.75 + sip * 0.55, [-0.3 - sip * 0.3, 0, 0.3]);
      d.arm('L', 0.18, 0.14, 0.05, 0.5, [0.15, 0, 0]);
      lookTarget.set(10, 8, 44);
      d.lookAt(lookTarget, 1 / 60, { maxYaw: 0.8, maxUp: 0.5 });
      d.wind(t, 1 / 60);
      d.blink(t, 5.5);
    });
  }

  // ================= 10. the moon-gazer at the railing =================
  {
    const h = spawn({
      key: 'gazer', sex: 'f', height: 1.62, seed: 81, skin: SKIN.fair,
      face: faceF({ skin: SKIN.fair, irisDark: '#4a3a4e', irisMid: '#7b6272', irisLight: '#c7a7ae', smile: 0.35, eyeH: 23 }),
      hair: { fringe: { n: 7, span: 62, tip: 0, skew: -6, w: 0.05 }, side: { long: 0.14, w: 0.033 }, bun: { r: 0.038, th: 12 } },
      hairStyle: 'short', hairTex: HAIR.oiled,
      outfit: { kind: 'kameez', topColor: '#d8cfbf', dupatta: '#9a8a6a', bottomColor: '#8a8276', shoes: '#6a4a3a' },
      hands: { L: 'relax', R: 'relax' },
      props: [propShawl('#8a4a38')],
      variants: ['open', 'blink'],
      circle: 0.42,
    });
    h.group.name = 'moon-gazer';
    const gx = 0.8, gz = 30.1;
    const yaw = Math.atan2(MOON_HOME.x - gx, MOON_HOME.z - gz);
    const d = new Driver(h, { seed: 81, hairAmp: 1.15 });
    updaters.push((t) => {
      d.place(gx, groundHeight(gx, gz), gz, yaw);
      d.reset();
      idlePose(d, h, t, { stance: 1.0, hry: 0.04 * Math.sin(t * 0.5) });
      // hands folded behind the back, eyes up on her
      d.arm('L', -0.3, 0.1, 0.2, 0.85, [0.3, 0, 0]);
      d.arm('R', -0.32, 0.1, -0.2, 0.9, [0.3, 0, 0]);
      d.breathe(t, 1.1);
      lookTarget.copy(MOON_HOME);
      d.lookAt(lookTarget, 1 / 60, { maxUp: 0.6 });
      d.wind(t, 1 / 60, { boost: 1.1 });
      d.blink(t, 6.2);
    });
  }


  // ================= 11. the lane walker, going the other way =================
  {
    const h = spawn({
      key: 'laneMan', sex: 'm', height: 1.7, seed: 91, skin: SKIN.tan, ears: true,
      face: faceM({ skin: SKIN.tan, irisMid: '#5d4a44', irisLight: '#8f7564', smile: 0.15 }),
      hair: { fringe: { n: 5, span: 52, tip: 14, skew: 10, w: 0.05, edgeDrop: 6 }, hairlineSide: -14, hairlineBack: -62, volume: 1.035 },
      hairStyle: 'short', hairTex: HAIR.oiled,
      outfit: { kind: 'kurta', topColor: '#8a9478', bottomColor: '#d8cfbf', shoes: '#4a3a30' },
      hands: { L: 'hold', R: 'hold' },
      variants: ['open', 'blink'],
    });
    h.group.name = 'lane-walker';
    const d = new Driver(h, { seed: 91 });
    updaters.push((t) => {
      // walks the east side of the lane, north to south and back,
      // offset in time so he passes the women near the chai corner
      const st = patrol(t + 14, 2.9, 22.5, 2.9, 5.5, { speed: 1.05, pause: 5, turn: 2.6 });
      const y = surfaceY(st.x, st.z);
      d.place(st.x, y, st.z, st.yaw);
      d.reset();
      if (st.walking) {
        walkCycle(d, h, st.dist, { stride: 0.44, lift: 0.05, lean: 0.04 });
        const sw = Math.sin((st.dist / 0.44) * Math.PI);
        d.arm('L', sw * 0.32, 0.07, 0, 0.32);
        d.arm('R', -sw * 0.32, 0.07, 0, 0.32);
        lookTarget.set(st.x + Math.sin(st.yaw) * 5, y + 1.4, st.z + Math.cos(st.yaw) * 5);
        d.lookAt(lookTarget, 1 / 60, { maxYaw: 0.25 });
      } else {
        idlePose(d, h, t, { stance: 1.05 });
        d.arm('L', 0.1, 0.1, 0, 0.35);
        d.arm('R', 0.1, 0.1, 0, 0.35);
        d.lookYP(0.25 * Math.sin(t * 0.2), -0.05, 1 / 60);
      }
      d.breathe(t);
      d.wind(t, 1 / 60);
      d.blink(t);
    });
  }

  // ================= 12. the crossing man, last train on his mind =================
  {
    const h = spawn({
      key: 'crossingMan', sex: 'm', height: 1.65, seed: 92, skin: SKIN.deep, ears: true,
      face: faceM({ skin: SKIN.deep, irisMid: '#54423a', irisLight: '#8a6a50', smile: 0.05 }),
      hair: { fringe: { n: 5, span: 50, tip: 16, skew: 16, w: 0.056, edgeDrop: 10 }, hairlineSide: -12, hairlineBack: -58, volume: 1.05 },
      hairStyle: 'short', hairTex: HAIR.black,
      outfit: { kind: 'kurta-vest', topColor: '#b8a98c', waistcoat: '#3e4a5c', bottomColor: '#8a8276', shoes: '#3a3430' },
      hands: { L: 'relax', R: 'relax' },
      props: [propShawl('#4a5568')],
      variants: ['open', 'blink'],
      circle: 0.42,
    });
    h.group.name = 'crossing-man';
    const d = new Driver(h, { seed: 92 });
    updaters.push((t) => {
      // stands at the level crossing, watching the rails to the west
      const cx = -11.8, cz = -11.6;
      d.place(cx, groundHeight(cx, cz), cz, -Math.PI / 2 + 0.4);
      d.reset();
      idlePose(d, h, t, { stance: 1.1 });
      d.breathe(t, 0.9);
      d.arm('L', 0.06, 0.1, 0, 0.22);
      d.arm('R', 0.06, 0.1, 0, 0.22);
      // his gaze follows the rails, then checks down the road
      const c = t % 30;
      if (c < 14) lookTarget.set(-70, 1.2, -15.5);
      else if (c < 18) lookTarget.set(-30, 1.5, -15.5);
      else lookTarget.set(-12, 1.5, -2);
      d.lookAt(lookTarget, 1 / 60, { speed: 1.6 });
      d.wind(t, 1 / 60);
      d.blink(t, 5.8);
    });
  }

  scene.add(group);
  return { group, updaters };
}
