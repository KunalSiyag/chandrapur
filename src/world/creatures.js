import * as THREE from 'three';
import { toonMaterial } from '../core/toon.js';
import { groundHeight } from './layout.js';
import { cow as makeCow } from './props.js';

// ============================================================
// The living town — inspired by Sakura Crossing's fauna, but
// this is Chandpur, so: street cats on every good ledge, a
// decorated cow grazing the promenade (marigold wreath, bell,
// a vermillion tikli), a mother cow and her calf on the south
// bank, a peacock holding the sweets-shop ridge, pigeons on
// the bazaar wires, bats patrolling the river, one awake dog,
// and two people who stayed up with the moon.
// Every pose is a pure function of t (plus the player, for the
// cats — they always know where you are).
// ============================================================

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;

/** short jerky window used all over: a pulse every `p` seconds */
function pulse(t, p, dur) { const c = t % p; return c < dur ? Math.sin((c / dur) * Math.PI) : 0; }
function smooth(a, b, x) { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); }

// ------------------------------------------------------------
// CAT — sit / loaf / curl. Toon parts, a tail of chained
// segments, glowing night eyes that blink.
// ------------------------------------------------------------
export function makeCat({ pose = 'sit', fur = 0xd98d4f, patches = null, scale = 1, eye = 0xb8d44a, tilt = 0 }) {
  const g = new THREE.Group();
  const furMat = toonMaterial(fur);
  const patchMat = patches ? toonMaterial(patches) : null;
  const innerMat = toonMaterial(0xe8a8ac);
  const k = scale;

  const add = (mesh, parent = g) => { mesh.castShadow = true; parent.add(mesh); return mesh; };
  const body = new THREE.Group();
  g.add(body);

  let headPos, tailBase, tailPose;
  if (pose === 'sit') {
    const haunch = add(new THREE.Mesh(new THREE.SphereGeometry(0.105 * k, 14, 12), furMat), body);
    haunch.scale.set(1.05, 1, 1.25); haunch.position.set(0, 0.1 * k, -0.02 * k);
    if (patchMat) { const p = add(new THREE.Mesh(new THREE.SphereGeometry(0.07 * k, 10, 8), patchMat), body); p.scale.set(1, 0.6, 0.7); p.position.set(0.06 * k, 0.13 * k, -0.05 * k); }
    const torso = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.062 * k, 0.1 * k, 6, 12), furMat), body);
    torso.rotation.x = 0.35; torso.position.set(0, 0.17 * k, 0.045 * k);
    for (const s of [-1, 1]) {
      const leg = add(new THREE.Mesh(new THREE.CylinderGeometry(0.019 * k, 0.021 * k, 0.17 * k, 10), furMat), body);
      leg.position.set(s * 0.03 * k, 0.085 * k, 0.075 * k);
      const paw = add(new THREE.Mesh(new THREE.SphereGeometry(0.021 * k, 10, 8), patchMat || furMat), body);
      paw.scale.set(1, 0.55, 1.4); paw.position.set(s * 0.03 * k, 0.012 * k, 0.088 * k);
    }
    headPos = [0, 0.28 * k, 0.085 * k];
    tailBase = [0, 0.055 * k, -0.13 * k];
    tailPose = [[-1.35, 0, 0], [-0.15, -0.75, 0], [-0.05, -0.6, 0], [0, -0.45, 0], [0, -0.35, 0]];
  } else if (pose === 'loaf') {
    const trunk = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.075 * k, 0.17 * k, 6, 14), furMat), body);
    trunk.rotation.x = Math.PI / 2; trunk.position.set(0, 0.082 * k, 0);
    if (patchMat) { const p = add(new THREE.Mesh(new THREE.SphereGeometry(0.05 * k, 10, 8), patchMat), body); p.scale.set(0.9, 0.55, 1.1); p.position.set(0.03 * k, 0.11 * k, -0.04 * k); }
    for (const s of [-1, 1]) {
      const paw = add(new THREE.Mesh(new THREE.SphereGeometry(0.024 * k, 10, 8), patchMat || furMat), body);
      paw.scale.set(1, 0.5, 1.3); paw.position.set(s * 0.03 * k, 0.013 * k, 0.12 * k);
    }
    headPos = [0, 0.14 * k, 0.115 * k];
    tailBase = [0, 0.045 * k, -0.15 * k];
    tailPose = [[-1.25, 0, 0], [0, -0.55, 0], [-0.05, -0.5, 0], [0, -0.4, 0], [0, -0.3, 0]];
  } else { // curl — a bean with the tail wrapped round
    const bean = add(new THREE.Mesh(new THREE.SphereGeometry(0.1 * k, 14, 12), furMat), body);
    bean.scale.set(1.18, 0.72, 1.1); bean.position.set(0, 0.068 * k, 0);
    if (patchMat) { const p = add(new THREE.Mesh(new THREE.SphereGeometry(0.055 * k, 10, 8), patchMat), body); p.scale.set(0.9, 0.5, 0.9); p.position.set(-0.05 * k, 0.09 * k, 0.05 * k); }
    const haunch = add(new THREE.Mesh(new THREE.SphereGeometry(0.062 * k, 12, 10), furMat), body);
    haunch.position.set(-0.05 * k, 0.08 * k, -0.085 * k);
    headPos = [0.06 * k, 0.105 * k, 0.085 * k];
    tailBase = [0, 0.04 * k, -0.1 * k];
    tailPose = [[-1.3, 0.9, 0], [0, 1.0, 0], [0, 0.85, 0], [0, 0.7, 0], [0, 0.55, 0]];
  }

  // ---- head: sphere + muzzle + ears + eyes (they glow a little at night)
  const head = new THREE.Group();
  head.position.set(...headPos);
  body.add(head);
  const skull = add(new THREE.Mesh(new THREE.SphereGeometry(0.052 * k, 16, 14), furMat), head);
  const muzzle = add(new THREE.Mesh(new THREE.SphereGeometry(0.03 * k, 12, 10), furMat), head);
  muzzle.scale.set(1.15, 0.78, 1); muzzle.position.set(0, -0.012 * k, 0.042 * k);
  const nose = add(new THREE.Mesh(new THREE.BoxGeometry(0.011 * k, 0.008 * k, 0.008 * k), toonMaterial(0xc46a72)), head);
  nose.position.set(0, -0.002 * k, 0.062 * k);
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(s * 0.032 * k, 0.044 * k, -0.006 * k);
    ear.rotation.z = -s * 0.28;
    head.add(ear);
    const outer = add(new THREE.Mesh(new THREE.ConeGeometry(0.02 * k, 0.048 * k, 10), patchMat || furMat), ear);
    outer.position.y = 0.022 * k;
    const inner = add(new THREE.Mesh(new THREE.ConeGeometry(0.012 * k, 0.03 * k, 8), innerMat), ear);
    inner.position.set(0, 0.018 * k, 0.004 * k);
    ears.push(ear);
  }
  const eyes = new THREE.Group();
  head.add(eyes);
  const eyeMat = new THREE.MeshBasicMaterial({ color: eye });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.0085 * k, 8, 8), eyeMat);
    e.position.set(s * 0.02 * k, 0.008 * k, 0.044 * k);
    eyes.add(e);
  }

  // ---- tail: a chain of segments, posed then swayed
  const tail = new THREE.Group();
  tail.position.set(...tailBase);
  body.add(tail);
  const segs = [];
  let parent = tail;
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Group();
    if (tailPose[i]) { seg.rotation.x = tailPose[i][0]; seg.rotation.y = tailPose[i][1]; }
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.014 * k, 0.075 * k, 4, 8), patchMat && i > 2 ? patchMat : furMat);
    m.rotation.x = Math.PI / 2;
    m.position.z = 0.045 * k;
    m.castShadow = true;
    seg.add(m);
    parent.add(seg);
    segs.push(seg);
    parent = seg;
  }

  g.rotation.z = tilt;
  g.name = 'cat-' + pose;
  return { group: g, head, eyes, ears, segs, body };
}

// ------------------------------------------------------------
// PIGEON — wire-perchers and ground-peckers
// ------------------------------------------------------------
export function makePigeon() {
  const g = new THREE.Group();
  const grey = toonMaterial(0x8a93a8);
  const dark = toonMaterial(0x565e6e);
  const cream = toonMaterial(0xc8c4b8);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), grey);
  body.scale.set(1, 0.88, 1.35); body.position.y = 0.045;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Group();
  head.position.set(0, 0.075, 0.05);
  g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), dark);
  skull.castShadow = true;
  head.add(skull);
  const neckRing = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), cream);
  neckRing.scale.set(1.05, 0.45, 1.05);
  neckRing.position.set(0, 0.068, 0.036);
  g.add(neckRing);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.02, 6), toonMaterial(0x4a4440));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.002, 0.038);
  head.add(beak);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.008, 0.07), dark);
  tail.position.set(0, 0.05, -0.085);
  tail.rotation.x = 0.25;
  g.add(tail);
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), dark);
    wing.scale.set(0.45, 0.7, 1.15);
    wing.position.set(s * 0.045, 0.05, -0.015);
    g.add(wing);
  }
  g.name = 'pigeon';
  return { group: g, head, tail };
}

// ------------------------------------------------------------
// PIGEON helper: the wire curve matches shops.js (poles at x=5,
// tops at y=6.9, sag 0.55)
// ------------------------------------------------------------
function wirePoint(t, z0, z1) {
  const y = 6.9 - 0.55 * 2 * t * (1 - t);
  return { x: 5, y, z: lerp(z0, z1, t) };
}

// ------------------------------------------------------------
// BAT — a flick of dark wings on a looping path over the river
// ------------------------------------------------------------
export function makeBat() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x1b1522 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.05, 4, 8), mat);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const wings = [];
  for (const s of [-1, 1]) {
    const wing = new THREE.Group();
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.085), mat);
    plane.material.side = THREE.DoubleSide;
    plane.position.x = (s * 0.19) / 2;
    wing.add(plane);
    // an elbow crease so the silhouette isn't a plain rectangle
    const tip = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.06), plane.material);
    tip.position.set(s * 0.23, 0.01, 0);
    tip.rotation.z = s * 0.5;
    wing.add(tip);
    g.add(wing);
    wings.push(wing);
  }
  g.name = 'bat';
  return { group: g, wings };
}

// ------------------------------------------------------------
// SITTING DOG — awake, on the lane
// ------------------------------------------------------------
export function makeSittingDog() {
  const g = new THREE.Group();
  const fur = toonMaterial(0x9a8a72);
  const snoutMat = toonMaterial(0xb8a488);
  const haunch = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), fur);
  haunch.scale.set(1, 1.05, 1.1);
  haunch.position.y = 0.12;
  haunch.castShadow = true;
  g.add(haunch);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.14, 6, 12), fur);
  torso.rotation.x = 0.55;
  torso.position.set(0, 0.2, 0.06);
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Group();
  head.position.set(0, 0.34, 0.13);
  g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 12), fur);
  skull.castShadow = true;
  head.add(skull);
  const muzzle = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.05, 6, 10), snoutMat);
  muzzle.rotation.x = Math.PI / 2 - 0.15;
  muzzle.position.set(0, -0.025, 0.075);
  head.add(muzzle);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), toonMaterial(0x2a2226));
  nose.position.set(0, -0.01, 0.115);
  head.add(nose);
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 8), fur);
    ear.position.set(s * 0.05, 0.09, 0.01);
    ear.rotation.z = -s * 0.16;
    head.add(ear);
    ears.push(ear);
  }
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), snoutMat);
  chest.scale.set(1, 1.1, 0.7);
  chest.position.set(0, 0.235, 0.11);
  g.add(chest);
  const frontLegs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.24, 10), fur);
    leg.position.set(s * 0.055, 0.12, 0.12);
    leg.castShadow = true;
    g.add(leg);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), fur);
    paw.scale.set(1, 0.6, 1.4);
    paw.position.set(s * 0.055, 0.014, 0.135);
    g.add(paw);
    frontLegs.push(leg);
  }
  const tail = new THREE.Group();
  const tailM = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.2, 4, 8), fur);
  tailM.rotation.x = Math.PI / 2 - 0.35;
  tailM.position.set(0, 0.01, -0.1);
  tail.add(tailM);
  tail.position.set(0, 0.04, -0.1);
  g.add(tail);
  g.name = 'sitting-dog';
  return { group: g, head, ears, tail };
}

// ------------------------------------------------------------
// CALF — the mother's shadow on the south-bank lane
// ------------------------------------------------------------
function makeCalf() {
  const g = new THREE.Group();
  g.userData.solid = true;
  const hide = toonMaterial(0xd8cfc0);
  const spot = toonMaterial(0xa89070);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 6, 12), hide);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.56;
  body.castShadow = true;
  g.add(body);
  const patch = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), spot);
  patch.scale.set(1.2, 0.7, 0.9);
  patch.position.set(0.05, 0.68, 0.14);
  g.add(patch);
  const neck = new THREE.Group();
  const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.18, 6, 10), hide);
  head.rotation.x = Math.PI / 2 + 0.35;
  head.position.y = 0.12;
  neck.add(head);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.2), toonMaterial(0xd8b8a8));
  snout.position.set(0, 0.26, 0.14);
  neck.add(snout);
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.055, 0.02), hide);
    ear.add(m);
    ear.position.set(s * 0.13, 0.2, -0.02);
    ear.rotation.z = s * 0.4;
    neck.add(ear);
    ears.push(ear);
  }
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 6), toonMaterial(0xd8cba8));
    horn.position.set(s * 0.06, 0.3, -0.02);
    neck.add(horn);
  }
  neck.position.set(0, 0.62, 0.42);
  neck.rotation.x = 0.5;
  g.add(neck);
  const legGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.44, 8);
  for (const [x, z] of [[-0.26, -0.14], [0.26, -0.14], [-0.26, 0.14], [0.26, 0.14]]) {
    const leg = new THREE.Mesh(legGeo, hide);
    leg.position.set(x, 0.22, z);
    leg.castShadow = true;
    g.add(leg);
  }
  const tail = new THREE.Group();
  const tailM = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.45, 6), hide);
  tailM.position.y = -0.22;
  tail.add(tailM);
  tail.position.set(0, 0.78, -0.44);
  g.add(tail);
  g.name = 'calf';
  return { group: g, neck, ears, tail };
}

// ------------------------------------------------------------
// PEAFOWL — the sweets-shop ridge is his. Deep blue body,
// crested head, a train of eyed feathers hanging down the roof.
// ------------------------------------------------------------
function makePeacock() {
  const g = new THREE.Group();
  const blue = toonMaterial(0x1d5a86);
  const teal = toonMaterial(0x2a7a94);
  const gold = toonMaterial(0xe8b93a);
  const green = toonMaterial(0x3a8a5e);

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.15, 6, 12), blue);
  body.rotation.x = Math.PI / 2 - 0.12;
  body.position.set(0, 0.13, -0.01);
  body.castShadow = true;
  g.add(body);
  const wing = toonMaterial(0x1a3a5c);
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), wing);
    w.scale.set(0.4, 0.8, 1.2);
    w.position.set(s * 0.07, 0.13, -0.02);
    g.add(w);
  }
  // the neck: a bent tube up to the head
  const neckCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0.16, 0.1),
    new THREE.Vector3(0, 0.34, 0.17),
    new THREE.Vector3(0, 0.47, 0.16),
  );
  const neck = new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 12, 0.028, 10), teal);
  neck.castShadow = true;
  g.add(neck);
  const head = new THREE.Group();
  head.position.set(0, 0.47, 0.16);
  g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.034, 14, 12), teal);
  head.add(skull);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), toonMaterial(0xece8dc));
  face.scale.set(0.85, 1, 0.55);
  face.position.set(0, -0.004, 0.02);
  head.add(face);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.026, 8), toonMaterial(0x8a8278));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -0.002, 0.042);
  head.add(beak);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.005, 6, 6), new THREE.MeshBasicMaterial({ color: 0x2a1a20 }));
    eye.position.set(s * 0.014, 0.006, 0.022);
    head.add(eye);
  }
  // the crest: little lollipops on stems
  const crest = new THREE.Group();
  head.add(crest);
  for (let i = 0; i < 5; i++) {
    const a = -0.5 + (i / 4) * 1.0;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.05, 5), teal);
    stem.position.set(Math.sin(a) * 0.02, 0.045, 0.005 + Math.abs(a) * 0.006);
    stem.rotation.z = -a * 0.7;
    crest.add(stem);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), green);
    dot.position.set(Math.sin(a) * 0.035, 0.07, 0.005 + Math.abs(a) * 0.008);
    crest.add(dot);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 6), gold);
    core.position.copy(dot.position);
    core.position.y += 0.004;
    crest.add(core);
  }
  // the train: eyed feathers fanned behind, hanging down the roof slope
  const train = new THREE.Group();
  train.position.set(0, 0.13, -0.06);
  g.add(train);
  const eyeMats = [green, teal, blue, gold];
  for (let i = 0; i < 9; i++) {
    const a = (-0.75 + (i / 8) * 1.5);
    const feather = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.5, 6), teal);
    stem.position.y = -0.22;
    feather.add(stem);
    const outer = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), eyeMats[0]);
    outer.scale.set(1, 1.25, 0.25);
    outer.position.y = -0.44;
    feather.add(outer);
    const mid = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), eyeMats[1]);
    mid.scale.set(1, 1.2, 0.3);
    mid.position.y = -0.42;
    feather.add(mid);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), eyeMats[3]);
    inner.scale.set(1, 1.15, 0.35);
    inner.position.y = -0.39;
    feather.add(inner);
    feather.rotation.y = a * 1.35;
    feather.rotation.x = 0.45 + Math.abs(a) * 0.3;
    train.add(feather);
  }
  g.name = 'peacock';
  return { group: g, head, crest, train };
}

// ============================================================
// assembly
// ============================================================
export function createCreatures(scene, opts = {}) {
  const group = new THREE.Group();
  group.name = 'creatures';
  const updaters = [];
  const getPlayer = opts.getPlayer || (() => null);
  const tmp = new THREE.Vector3();

  /** angle (radians, local to a body rotated rotY) from cat to player */
  const angleToPlayer = (x, z, rotY) => {
    const p = getPlayer();
    if (!p || !p.position) return null;
    const d = Math.hypot(p.position.x - x, p.position.z - z);
    if (d > 5.5) return null;
    const a = Math.atan2(p.position.x - x, p.position.z - z) - rotY;
    return { yaw: clamp(Math.atan2(Math.sin(a), Math.cos(a)), -1.35, 1.35), d };
  };

  // ---------------- cats ----------------
  const CATS = [
    // white queen on the sweets-shop awning, watching the lane
    { pose: 'sit', fur: 0xefe9e1, patches: 0xd98d4f, x: -4.25, z: 6.2, y: groundHeight(-8.2, 6.2) + 2.81, rotY: Math.PI / 2 + 0.3, tilt: -0.12, seed: 1 },
    // ginger tabby holding the platform bench
    { pose: 'sit', fur: 0xd98d4f, patches: 0xa8622e, x: -5.5, z: -12.05, y: 1.49, rotY: 0.25, tilt: 0, seed: 2 },
    // black cat loafing on the ghat steps, face to the water
    { pose: 'loaf', fur: 0x3d3a48, patches: null, x: -3.8, z: 32.6, y: -0.32, rotY: 0.35, tilt: 0, seed: 3 },
    // calico curled asleep on the chhatri seat
    { pose: 'curl', fur: 0xefe9e1, patches: 0x8a745c, x: 26.2, z: 48.4, y: groundHeight(26, 48.4) + 0.66, rotY: -0.8, tilt: 0, seed: 4 },
    // grey cat silhouetted on the hotel roof ridge
    { pose: 'sit', fur: 0x7d8494, patches: null, x: -8.2, z: 24.6, y: groundHeight(-8.2, 23.5) + 6.97, rotY: Math.PI / 2 + 1.9, tilt: 0, seed: 5 },
  ];
  for (const c of CATS) {
    const cat = makeCat({ pose: c.pose, fur: c.fur, patches: c.patches, tilt: c.tilt });
    cat.group.position.set(c.x, c.y, c.z);
    cat.group.rotation.y = c.rotY;
    group.add(cat.group);
    const asleep = c.pose === 'curl';
    updaters.push((t) => {
      const s = c.seed;
      // breathing
      cat.body.scale.y = 1 + Math.sin(t * (asleep ? 1.6 : 2.3) + s) * 0.02;
      // blink (asleep cat keeps them shut)
      const cyc = (t + s * 2.7) % 5.2;
      cat.eyes.scale.y = asleep ? 0.12 : (cyc < 0.16 ? 0.14 : 1);
      // ear flicks
      cat.ears[0].rotation.z = -0.28 + pulse(t + s * 3.3, 4.5 + s * 0.7, 0.22) * -0.4;
      cat.ears[1].rotation.z = 0.28 + pulse(t + s * 1.7, 5.9 + s * 0.5, 0.2) * 0.4;
      // tail: wave travelling down the chain
      for (let i = 0; i < cat.segs.length; i++) {
        const amp = asleep ? 0.03 : 0.09 + (i / cat.segs.length) * 0.1;
        cat.segs[i].rotation.z = Math.sin(t * (asleep ? 0.9 : 1.7) - i * 0.65 + s) * amp;
      }
      // head: slow wandering looks — or you, when you come close
      let yaw = Math.sin(t * 0.19 + s) * 0.5 + Math.sin(t * 0.53 + s * 2) * 0.12;
      if (!asleep) {
        const tp = angleToPlayer(c.x, c.z, c.rotY);
        if (tp) yaw = tp.yaw;
      }
      cat.head.rotation.y = lerp(cat.head.rotation.y, yaw, 0.12);
      cat.head.rotation.x = asleep ? 0.35 : Math.sin(t * 0.31 + s) * 0.08 - (asleep ? 0 : 0.02);
    });
  }

  // ---------------- the decorated cow, grazing the promenade ----
  {
    const c = makeCow();
    c.group.position.set(-36, groundHeight(-36, 27.8), 27.8);
    c.group.rotation.y = 2.55;
    c.group.name = 'cow-decorated';
    group.add(c.group);
    // marigold wreath around her neck
    const wreath = new THREE.Group();
    const f1 = toonMaterial(0xe8931a);
    const f2 = toonMaterial(0xf2b93a);
    const leaf = toonMaterial(0x4a7a3a);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 7), i % 3 === 2 ? leaf : (i % 2 ? f2 : f1));
      m.position.set(Math.cos(a) * 0.24, 0.16 + Math.sin(a) * 0.24, 0.12);
      c.neck.add(m);
    }
    // a brass bell under her throat
    const bell = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.062, 0.07, 10), toonMaterial(0xc8a032));
    bell.add(shell);
    const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), toonMaterial(0x8a6a20));
    clapper.position.y = -0.045;
    bell.add(clapper);
    bell.position.set(0, -0.14, 0.28);
    c.neck.add(bell);
    // vermillion tikli on her forehead
    const tikli = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), toonMaterial(0xc23326));
    tikli.scale.set(1, 0.5, 0.5);
    tikli.position.set(0, 0.3, 0.28);
    c.neck.add(tikli);
    updaters.push((t) => {
      // long graze cycles: head down to the grass, then up to look
      const graze = Math.max(0, Math.sin(t * 0.055 + 1.5));
      c.neck.rotation.x = 0.1 + Math.pow(graze, 0.8) * 0.85;
      // ear twitches
      c.ears[0].rotation.z = 0.35 + pulse(t, 4.3, 0.18) * 0.5;
      c.ears[1].rotation.z = -0.35 - pulse(t + 2.1, 5.1, 0.2) * 0.5;
      // tail: lazy sway, quick swish at the flies
      const swish = (t % 7) < 1.1 ? Math.sin(t * 10) * 0.5 : 0;
      c.tail.rotation.x = Math.sin(t * 1.2) * 0.18 + swish;
      // the bell swings with her
      bell.rotation.z = Math.sin(t * 1.2) * 0.15 + swish * 0.3;
    });
  }

  // ---------------- mother cow + calf, south-bank lane ----
  {
    const m = makeCow();
    m.group.name = 'cow-mother';
    m.group.position.set(23.5, groundHeight(23.5, 44.8), 44.8);
    m.group.rotation.y = -1.9; // head toward the lane, rump to the water
    group.add(m.group);
    const calf = makeCalf();
    calf.group.position.set(24.6, groundHeight(24.6, 44.2), 44.2);
    calf.group.rotation.y = -2.3;
    group.add(calf.group);
    updaters.push((t) => {
      const graze = Math.max(0, Math.sin(t * 0.04 + 0.4));
      m.neck.rotation.x = 0.12 + Math.pow(graze, 0.8) * 0.8;
      m.ears[0].rotation.z = 0.35 + pulse(t + 1, 6.1, 0.18) * 0.5;
      m.ears[1].rotation.z = -0.35 - pulse(t + 3.4, 5.4, 0.2) * 0.5;
      m.tail.rotation.x = Math.sin(t * 1.1 + 2) * 0.2 + ((t + 2) % 8 < 1 ? Math.sin(t * 9) * 0.45 : 0);
      // the calf: quick little head bobs, tail like a metronome
      calf.neck.rotation.x = 0.5 + Math.sin(t * 1.7) * 0.12 + pulse(t + 1.2, 9, 0.5) * 0.25;
      calf.ears[0].rotation.z = 0.4 + Math.sin(t * 2.3) * 0.18;
      calf.ears[1].rotation.z = -0.4 - Math.sin(t * 2.7 + 1) * 0.18;
      calf.tail.rotation.x = Math.sin(t * 3.1) * 0.35;
      // she checks on him now and then
      const check = smooth(14, 16, t % 30) * (1 - smooth(20, 22, t % 30));
      m.neck.rotation.y = check * 0.4;
    });
  }

  // ---------------- the peacock on the chhatri dome ----------------
  {
    // the terrace chhatri at the south-bank end: from the ghat and the
    // bridge he reads as a silhouette against the river sky
    const chY = groundHeight(26, 48.5) + 0.12 + 2.98; // dome apex + finial
    const pk = makePeacock();
    pk.group.position.set(26, chY, 48.5);
    pk.group.rotation.y = Math.PI + 0.3; // facing north, over the water
    pk.group.name = 'peacock';
    group.add(pk.group);
    updaters.push((t) => {
      // proud little head turns, crest bob
      pk.head.rotation.y = Math.sin(t * 0.4) * 0.65 + pulse(t + 2, 11, 0.7) * 0.5;
      pk.head.rotation.x = -0.08 + Math.sin(t * 0.8) * 0.06 + pulse(t + 4, 9, 0.5) * 0.18;
      pk.crest.rotation.x = Math.sin(t * 1.1) * 0.08;
      // the train breathes down the dome
      pk.train.rotation.x = 0.06 + Math.sin(t * 0.5) * 0.05;
      pk.train.rotation.z = Math.sin(t * 0.7) * 0.03;
      // a sudden shimmer of the whole bird
      pk.group.rotation.z = pulse(t + 5, 17, 0.4) * 0.04;
    });
  }

  // ---------------- pigeons: the wire flock + ground pair ----
  {
    const wireBirds = [];
    const perches = [
      { t: 0.28, z0: 12.8, z1: 20.8, face: 1 },
      { t: 0.36, z0: 12.8, z1: 20.8, face: -1 },
      { t: 0.62, z0: 12.8, z1: 20.8, face: 1 },
      { t: 0.55, z0: 20.8, z1: 28.4, face: -1 },
    ];
    for (const p of perches) {
      const b = makePigeon();
      const w = wirePoint(p.t, p.z0, p.z1);
      b.group.position.set(w.x, w.y + 0.005, w.z);
      b.group.rotation.y = p.face > 0 ? Math.PI / 2 : -Math.PI / 2;
      b.group.scale.setScalar(0.9);
      group.add(b.group);
      wireBirds.push({ b, p });
    }
    const groundBirds = [];
    const homes = [[-0.4, -6.3], [1.6, -5.0]];
    for (let i = 0; i < homes.length; i++) {
      const b = makePigeon();
      const [hx, hz] = homes[i];
      b.group.position.set(hx, groundHeight(hx, hz), hz);
      group.add(b.group);
      groundBirds.push({ b, hx, hz, seed: 3 + i });
    }
    updaters.push((t) => {
      for (const it of wireBirds) {
        const sd = it.p.t * 9;
        // sleepy shuffles along the wire; a wing shrug now and then
        const sh = Math.sin(t * 0.11 + sd) * 0.06;
        const w = wirePoint(clamp(it.p.t + sh, 0.05, 0.95), it.p.z0, it.p.z1);
        it.b.group.position.set(w.x, w.y + 0.005 + Math.abs(Math.sin(t * 1.4 + sd)) * 0.003, w.z);
        it.b.head.position.y = 0.075 + pulse(t + sd, 3.3, 0.25) * 0.012;
        it.b.head.rotation.y = Math.sin(t * 0.5 + sd) * 0.5;
        it.b.group.rotation.z = pulse(t + sd, 13, 0.5) * 0.08;
      }
      for (const it of groundBirds) {
        const sd = it.seed;
        // hop between two nearby spots, pecking
        const T = 2.6, n = Math.floor(t / T + sd), f = (t / T + sd) - n;
        const fract = (m) => { const x = Math.sin(m) * 43758.5453; return x - Math.floor(x); };
        const pt = (m) => [it.hx + (fract(m * 12.9898 + sd * 78.233) - 0.5) * 1.1, it.hz + (fract(m * 4.898 + sd * 12.3) - 0.5) * 0.9];
        const p0 = pt(n), p1 = pt(n + 1);
        const hop = smooth(0, 0.3, f);
        const x = lerp(p0[0], p1[0], hop), z = lerp(p0[1], p1[1], hop);
        const air = Math.sin(clamp(f / 0.3, 0, 1) * Math.PI) * 0.05;
        it.b.group.position.set(x, groundHeight(x, z) + air, z);
        it.b.group.rotation.y = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]);
        const peck = f > 0.5 && f < 0.9 ? Math.sin((f - 0.5) / 0.4 * Math.PI * 2.4) : 0;
        it.b.head.position.y = 0.075 - Math.max(0, peck) * 0.03;
      }
    });
  }

  // ---------------- bats over the river ----------------
  {
    const bats = [];
    const anchors = [
      { x: -14, y: 10, z: 34, r: 6, w: 0.32, p: 0.2 },
      { x: 2, y: 12.5, z: 38, r: 8, w: 0.24, p: 2.4 },
      { x: -4, y: 13.5, z: 42, r: 10, w: 0.19, p: 4.1 },
      { x: -24, y: 9.5, z: 30, r: 5, w: 0.36, p: 1.1 },
      { x: 12, y: 11, z: 41, r: 7, w: 0.27, p: 5.3 },
      { x: -32, y: 12, z: 36, r: 9, w: 0.21, p: 3.0 },
    ];
    for (const a of anchors) {
      const bat = makeBat();
      bat.group.scale.setScalar(0.8 + (a.p % 1) * 0.4);
      group.add(bat.group);
      bats.push({ bat, a });
    }
    updaters.push((t) => {
      for (const { bat, a } of bats) {
        const ang = t * a.w + a.p;
        const x = a.x + Math.cos(ang) * a.r;
        const z = a.z + Math.sin(ang) * a.r * 0.72;
        const y = a.y + Math.sin(ang * 2.7) * 1.3;
        bat.group.position.set(x, y, z);
        // heading along the path
        const dx = -Math.sin(ang) * a.w * a.r;
        const dz = Math.cos(ang) * a.w * a.r * 0.72;
        bat.group.rotation.y = Math.atan2(dx, dz);
        bat.group.rotation.z = Math.sin(ang * 2.7 + 1) * 0.2;
        const flap = Math.sin(t * 11 + a.p * 7);
        bat.wings[0].rotation.y = flap * 0.9;
        bat.wings[1].rotation.y = -flap * 0.9;
      }
    });
  }

  // ---------------- the awake dog on the lane ----------------
  {
    const d = makeSittingDog();
    d.group.position.set(-3.9, groundHeight(-3.9, 9.5), 9.5);
    d.group.rotation.y = -0.5; // facing down the lane, watching
    d.group.userData.solidCircle = 0.34;
    group.add(d.group);
    updaters.push((t) => {
      // ears track sounds only she hears; the tail sweeps the dust
      d.head.rotation.y = Math.sin(t * 0.23) * 0.6 + pulse(t + 1, 13, 0.6) * 0.35;
      d.ears[0].rotation.z = -0.16 + pulse(t, 5.7, 0.16) * 0.22;
      d.ears[1].rotation.z = 0.16 + pulse(t + 3.1, 6.3, 0.18) * 0.22;
      d.tail.rotation.y = Math.sin(t * 2.9) * 0.45;
      const tp = angleToPlayer(-3.9, 9.5, -0.5);
      if (tp && tp.d < 4) {
        d.head.rotation.y = lerp(d.head.rotation.y, tp.yaw, 0.3);
        d.tail.rotation.y = Math.sin(t * 9) * 0.6; // pleased
      }
    });
  }

  scene.add(group);
  return { group, updaters };
}
