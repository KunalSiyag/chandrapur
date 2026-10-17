import * as THREE from 'three';
import { toonMaterial } from '../core/toon.js';
import { Human } from './people/human.js';
import { Driver, rot } from './people/anim.js';
import { createPlayerPose } from '../core/player-pose.js';
import { propGlass, propKettle, propJhola, propMatka, propShawl, propLathi } from './people.js';
import { makeCat, makePigeon, makeSittingDog, makeBat } from './creatures.js';
import { cow as cowRig } from './props.js';
import { ROUTES, pointAlong, surfaceY, MOON_HOME } from './layout.js';
import { group, box, cylinder, sphere, beam, flat, LOCAL as C } from './build-kit.js';

// A sparse authored cast, each with a reason to occupy its place. No crowd
// spawning or arbitrary patrol between landmarks. Gait uses the fixed rig.
const HAIR = { top: '#302730', base: '#241f27', tip: '#1b1720', hi: '#58494e', hi2: '#776264' };
function face(skin = '#d9a77e', feminine = false) {
  return { skin, ink: '#3f3440', eyeP: 24, eyeT: -12, eyeW: 19, eyeH: feminine ? 20 : 15,
    irisDark: '#493a37', irisMid: '#755344', irisLight: '#aa8665', lash: feminine ? 1 : 0.5,
    lidTop: -0.48, iris: 0.37, irisH: 0.48, brow: '#483730', browW: feminine ? 1.9 : 2.5,
    browGap: 3.4, browArch: 1.6, noseT: -32, mouthT: -52, mouthW: 9, smile: 0.16, blush: 0.3, bindi: feminine };
}
function person({ key, seed, female = false, height = female ? 1.57 : 1.67, outfit, props = [], gray = false, skin = '#d9a77e' }) {
  return new Human({ key, sex: female ? 'f' : 'm', height, seed, skin, face: face(skin, female), ears: true,
    hair: { fringe: { n: 5, span: 52, tip: 10, skew: 6, w: 0.05, edgeDrop: 9 }, hairlineSide: -18, hairlineBack: -64, volume: 1.05 },
    hairTex: gray ? { top: '#b5b1b5', base: '#939398', tip: '#807f86', hi: '#d2cecc', hi2: '#e2dcd4' } : HAIR,
    hairStyle: female ? 'bun' : 'short', outfit, props, variants: ['open', 'blink', 'talk'] });
}

export function createTownLife(scene, { player }) {
  const root = group('living-chandrapur'), updaters = [], residents = [], animals = [];
  scene.add(root);
  const delta = new THREE.Vector3(), look = new THREE.Vector3();
  let lastTime = 0;
  function standAt(h, position, yaw, action) {
    const d = new Driver(h, { seed: h.seed });
    const pos = new THREE.Vector3(...position); pos.y = surfaceY(pos.x, pos.z);
    root.add(h.group); residents.push({ name: h.spec.key, position: pos.toArray(), human: h });
    updaters.push((t, dt) => {
      d.place(pos.x, pos.y, pos.z, yaw); d.reset();
      d.stand({ stance: 1.08, hy: -0.012 }); d.breathe(t, 1, { pitch: false });
      d.arm('L', 0.05, 0.08, 0, 0.23); d.arm('R', 0.05, 0.08, 0, 0.23);
      if (action) action(d, h, t);
      delta.copy(player.position).sub(pos);
      if (delta.length() < 4.2 && !player.transported) {
        look.copy(player.position); look.y += 1.48; d.lookAt(look, dt, { maxYaw: 0.8, maxUp: 0.35, maxDown: 0.35 });
      } else d.lookYP(Math.sin(t * 0.16 + h.seed) * 0.15, 0.03, dt);
      d.blink(t, !!action && Math.sin(t * 0.7 + h.seed) > 0.6); d.wind(t, dt, { boost: 0.55 });
      h.group.updateMatrixWorld(true); h.mesh.skeleton.update();
    });
    return h;
  }
  standAt(person({ key: 'station-chaiwala', seed: 11, outfit: { kind: 'kurta', topColor: '#899279', bottomColor: '#ddd3b9', shoes: C.wood }, props: [propKettle('R')] }),
    [8.85, 0, -5.55], -0.5, (d, h, t) => {
      const pour = Math.max(0, Math.sin(t * 0.7)); d.arm('R', 0.55 + pour * 0.12, 0.13, 0.1, 0.92, [0.1, 0, pour * 0.35]);
      d.arm('L', 0.23, 0.08, 0, 0.64);
    });
  standAt(person({ key: 'late-passenger', seed: 13, outfit: { kind: 'kurta-vest', topColor: '#d6c6a3', waistcoat: '#4d6875', bottomColor: '#c5b89e', shoes: C.wood }, props: [propGlass('L'), propJhola('R')] }),
    [6.4, 0, -2.45], 2.4, (d, h, t) => { d.arm('L', 0.45, 0.08, 0, 1.55 + Math.sin(t * 0.32) * 0.18); });
  const sweetsP = pointAlong(ROUTES.find((r) => r.id === 'bazaar-spine').points, 8);
  standAt(person({ key: 'sweets-shopkeeper', seed: 18, outfit: { kind: 'kurta', topColor: '#b8a87c', bottomColor: '#e1d7ba', shoes: C.wood }, props: [propShawl('#9b7261')] }),
    [sweetsP.x - sweetsP.dz * 2.1, 0, sweetsP.z + sweetsP.dx * 2.1], Math.atan2(sweetsP.dz, -sweetsP.dx), (d, h, t) => {
      d.arm('R', 0.33, 0.13, 0, 0.72 + Math.sin(t * 1.1) * 0.1);
    });
  // One shopper follows the crooked market lane itself, pauses at the river
  // end, and returns. Position is resolved on the real grade on each step.
  const shopper = person({ key: 'bazaar-shopper', seed: 29, female: true, outfit: { kind: 'kameez', topColor: '#8e6170', bottomColor: '#ceb891', dupatta: '#bba784', shoes: C.wood }, props: [propJhola('R', '#ac9773', true)] });
  const pose = createPlayerPose(shopper); root.add(shopper.group);
  const shopperPath = ROUTES.find((r) => r.id === 'bazaar-spine').points;
  const start = pointAlong(shopperPath, 12), shopperPos = new THREE.Vector3(start.x, surfaceY(start.x, start.z), start.z), previous = shopperPos.clone();
  let shopperDistance = 12, returning = false, pause = 0, shopperYaw = Math.atan2(start.dx, start.dz), blend = 0;
  pose.reset(shopperPos, shopperYaw); residents.push({ name: 'bazaar-shopper', human: shopper, moving: true });
  updaters.push((t, dt) => {
    previous.copy(shopperPos);
    if (pause > 0) pause -= dt;
    else { shopperDistance += dt * (returning ? -0.68 : 0.68); if (shopperDistance > 46 || shopperDistance < 7) { shopperDistance = THREE.MathUtils.clamp(shopperDistance, 7, 46); returning = !returning; pause = 5; } }
    const p = pointAlong(shopperPath, shopperDistance);
    shopperPos.set(p.x + p.dz * 0.58, surfaceY(p.x + p.dz * 0.58, p.z - p.dx * 0.58), p.z - p.dx * 0.58);
    const distance = shopperPos.distanceTo(previous), moving = distance > 1e-6;
    const desiredYaw = Math.atan2(p.dx * (returning ? -1 : 1), p.dz * (returning ? -1 : 1));
    shopperYaw += Math.atan2(Math.sin(desiredYaw - shopperYaw), Math.cos(desiredYaw - shopperYaw)) * Math.min(1, dt * 4);
    blend += ((moving ? 1 : 0) - blend) * Math.min(1, dt * 6);
    pose.update({ position: shopperPos, yaw: shopperYaw, distance, moving, running: false, blend, lookYaw: shopperYaw, lookPitch: 0, dt, time: t });
  });
  standAt(person({ key: 'river-water-carrier', seed: 36, female: true, outfit: { kind: 'saree', topColor: '#586f70', bottomColor: '#8da39b', pallu: '#8da39b', hem: '#bdac7b', shoes: C.wood }, props: [propMatka('L')] }),
    [31.5, -0.45, 52.2], -2.5, (d, h, t) => { d.arm('L', 0.24, 0.16, 0, 1.0); d.arm('R', 0.36, 0.16, 0, 0.78); });
  standAt(person({ key: 'hill-grandfather', seed: 41, gray: true, height: 1.6, outfit: { kind: 'kurta-vest', topColor: '#c6baa1', waistcoat: '#647865', bottomColor: '#c8bea8', shoes: C.wood }, props: [propLathi('R')] }),
    [-44.0, 8.2, -37.7], 0.65, (d) => { d.arm('R', 0.12, 0.13, 0, 0.39); });
  standAt(person({ key: 'balloon-keeper', seed: 44, outfit: { kind: 'kurta-vest', topColor: '#cbb99b', waistcoat: '#816454', bottomColor: '#9da699', shoes: C.wood } }),
    [-0.8, 0.2, 79.1], 1.0, (d, h, t) => { d.arm('L', 0.14, 0.08, 0, 0.57); });

  // Cats occupy the warm stall, an awning ledge, and a quiet porch.
  for (const [name, position, fur, scale] of [
    ['station-cat', [-6.2, 0.51, -6.65], 0xc8a071, 1.5],
    ['bazaar-awning-cat', [11.15, 2.8, 12.5], 0x787b75, 1.45],
    ['hill-porch-cat', [-38.5, 11, -47.0], 0xcfb590, 1.5],
  ]) {
    const cat = makeCat({ pose: name === 'station-cat' ? 'loaf' : 'sit', fur, scale });
    cat.group.position.set(...position); cat.group.name = name; root.add(cat.group); animals.push(name);
    updaters.push((t) => {
      cat.body.scale.y = 1 + Math.sin(t * 1.6) * 0.018;
      cat.head.rotation.y = Math.sin(t * 0.19 + scale) * 0.3;
      cat.eyes.scale.y = (t + scale) % 4.3 < 0.13 ? 0.08 : 1;
      cat.segs[0].rotation.z = Math.sin(t * 0.7 + scale) * 0.09;
    });
  }
  const dog = makeSittingDog(); dog.group.scale.setScalar(1.5); dog.group.position.set(10.4, 0, -5.8); dog.group.rotation.y = -0.3; dog.group.name = 'chai-corner-dog'; root.add(dog.group); animals.push('chai-corner-dog');
  updaters.push((t) => { dog.group.scale.y = 1.5 + Math.sin(t * 1.3) * 0.018; dog.head.rotation.y = Math.sin(t * 0.3) * 0.18; });
  const cow = cowRig(); cow.group.position.set(-36.7, surfaceY(-36.7, 28), 28); cow.group.rotation.y = 0.7; cow.group.scale.setScalar(0.85); cow.group.name = 'courtyard-cow'; root.add(cow.group); animals.push('courtyard-cow');
  updaters.push((t) => { cow.neck.rotation.x = 0.16 + Math.sin(t * 0.37) * 0.1; cow.tail.rotation.z = Math.sin(t * 0.64) * 0.12; cow.ears.forEach((ear, i) => { ear.rotation.z = Math.sin(t * 2.3 + i) * 0.08; }); });
  const goat = makeGoat(); goat.group.position.set(-58.6, surfaceY(-58.6, -34.5), -34.5); goat.group.rotation.y = 1.6; root.add(goat.group); animals.push('village-goat');
  updaters.push((t) => { goat.head.rotation.x = 0.22 + Math.sin(t * 0.43) * 0.17; });
  for (const [i, position] of [[-2.6, 0, -5.8], [-1.5, 0, -5.0], [4.2, 0, -16.0], [22.3, 0, 49.7], [23.2, 0, 49.9], [-32.1, 25.5, -80.4]].entries()) {
    const bird = makePigeon(); bird.group.scale.setScalar(1.8); bird.group.position.set(...position); bird.group.name = 'town-pigeon'; root.add(bird.group); animals.push('pigeon');
    updaters.push((t) => { bird.head.rotation.x = Math.max(0, Math.sin(t * 2.3 + i)) * 0.6; bird.group.rotation.y = Math.sin(t * 0.25 + i) * 0.4 + i; });
  }
  // Bats patrol their feeding reach over the water, not every district's sky.
  for (let i = 0; i < 3; i++) {
    const bat = makeBat(); bat.group.scale.setScalar(1.5); root.add(bat.group); animals.push('river-bat');
    updaters.push((t) => {
      const a = t * 0.31 + i * 2.1; bat.group.position.set(13 + Math.cos(a) * 13, 3.8 + Math.sin(t * 0.7 + i) * 0.7, 60 + Math.sin(a) * 3.0);
      bat.group.rotation.y = -a; bat.wings.forEach((w, k) => { w.rotation.y = (k ? 1 : -1) * Math.sin(t * 11 + i) * 0.65; });
    });
  }
  // A few tiny fireflies belong to the riparian shrub bed. They have smooth
  // bounded local motions and do not turn the entire town into particles.
  const fireGeo = new THREE.BufferGeometry(), firePositions = new Float32Array(12 * 3);
  fireGeo.setAttribute('position', new THREE.BufferAttribute(firePositions, 3));
  const fireflies = new THREE.Points(fireGeo, new THREE.PointsMaterial({ color: '#d6ce7f', size: 0.065, transparent: true, opacity: 0.65, depthWrite: false }));
  fireflies.name = 'river-fireflies'; root.add(fireflies);
  updaters.push((t) => {
    for (let i = 0; i < 12; i++) {
      firePositions[i * 3] = -8 + (i % 4) * 0.7 + Math.sin(t * 0.42 + i) * 0.4;
      firePositions[i * 3 + 1] = 0.3 + (i % 3) * 0.35 + Math.cos(t * 0.6 + i) * 0.1;
      firePositions[i * 3 + 2] = 44 + Math.floor(i / 4) * 0.7 + Math.sin(t * 0.31 + i) * 0.25;
    }
    fireGeo.attributes.position.needsUpdate = true;
  });
  return { group: root, residents, animals, update(t) {
    const dt = THREE.MathUtils.clamp(t - lastTime, 0, 0.05); lastTime = t;
    for (const update of updaters) update(t, dt);
  } };
}

function makeGoat() {
  const g = group('village-goat');
  sphere(g, 0.27, '#c4c1b1', 0, 0.55, 0, [0.8, 0.85, 1.6]);
  for (const [x, z] of [[-0.13, -0.22], [0.13, -0.22], [-0.13, 0.25], [0.13, 0.25]]) {
    cylinder(g, 0.027, 0.035, 0.47, '#b8b7a8', x, 0.25, z, 8); cylinder(g, 0.036, 0.036, 0.055, C.timber, x, 0.04, z, 8);
  }
  const head = group('goat-head'); head.position.set(0, 0.66, 0.39); g.add(head);
  sphere(head, 0.14, '#bfc0ae', 0, 0.1, 0.08, [0.7, 1.3, 1]);
  sphere(head, 0.075, '#a09f8f', 0, 0.05, 0.2, [0.85, 0.65, 1.0]);
  for (const s of [-1, 1]) {
    beam(head, [s * 0.08, 0.19, 0.03], [s * 0.06, 0.37, -0.07], 0.018, '#797b6e');
    sphere(head, 0.06, '#b4b29e', s * 0.15, 0.12, 0.03, [1.6, 0.5, 0.7]);
    sphere(head, 0.014, flat('#353c39'), s * 0.09, 0.13, 0.12);
  }
  beam(g, [0, 0.65, -0.38], [0, 0.8, -0.45], 0.027, '#bfc0ae');
  return { group: g, head };
}
