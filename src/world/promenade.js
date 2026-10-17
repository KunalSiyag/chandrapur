import * as THREE from 'three';
import { toonMaterial } from '../core/toon.js';
import { PROM, GHAT, TERRACE, groundHeight, isDeepWater } from './layout.js';
import {
  railingRun, streetLamp, bench, flowerPot, textSign, diya, templeFlag, palm,
  cow, streetDog, chaiStall, rangoli, marigoldToran,
} from './props.js';
import { addBoxRect } from './colliders.js';

/**
 * Chandni Ghat — the riverside. Steps walk down to the water,
 * diyas sit on every tread and a few float out on the current,
 * a small temple keeps its flag moving at the head of the steps,
 * palms lean over the bank. The far bank has its quiet lane and
 * the chhatri at the end of it.
 */
export function createPromenade(scene) {
  const group = new THREE.Group();
  group.name = 'ghat';
  const updaters = [];

  // railing along the water's edge — interrupted by the ghat
  // steps and by the footbridge stair
  group.add(railingRun({ from: [PROM.x0, 30.6], to: [GHAT.x0 - 0.6, 30.6] }));
  group.add(railingRun({ from: [GHAT.x1 + 0.6, 30.6], to: [12.4, 30.6] }));
  group.add(railingRun({ from: [15.6, 30.6], to: [PROM.x1, 30.6] }));

  // ---- the ghat steps ----
  const stepMat = toonMaterial(0x7d7668);
  const stepTop = toonMaterial(0x9a9284);
  for (let s = 0; s < 4; s++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(GHAT.x1 - GHAT.x0, 0.2, GHAT.stepD), s === 0 ? stepTop : stepMat);
    const z = GHAT.z0 + (s + 0.5) * GHAT.stepD;
    // top of the tread must equal layout.surfaceY's step height
    step.position.set((GHAT.x0 + GHAT.x1) / 2, -s * GHAT.stepH - 0.12, z);
    step.receiveShadow = true;
    step.castShadow = true;
    group.add(step);
  }

  // ---- diyas: a row on the top step, a few below ----
  const diyaInstances = [];
  for (let i = 0; i < 14; i++) {
    const x = GHAT.x0 + 0.7 + i * ((GHAT.x1 - GHAT.x0 - 1.4) / 13);
    const d = diya({ scale: 1 + (i % 3) * 0.15 });
    d.group.position.set(x, 0.06, GHAT.z0 + 0.35);
    group.add(d.group);
    diyaInstances.push(d);
  }
  for (const [x, s] of [[-8.5, 2], [-4.2, 3], [1.5, 2], [3.2, 3]]) {
    const d = diya({ scale: 1.1 });
    d.group.position.set(x, -(s - 1) * GHAT.stepH + 0.1, GHAT.z0 + (s - 0.5) * GHAT.stepD);
    group.add(d.group);
    diyaInstances.push(d);
  }
  updaters.push((t) => {
    for (let i = 0; i < diyaInstances.length; i++) {
      const d = diyaInstances[i];
      const f = 0.85 + Math.sin(t * (7 + i * 0.7) + i) * 0.15 + Math.sin(t * 17 + i * 3) * 0.05;
      d.flame.material.color.setHSL(0.09, 1, 0.55 * f);
      d.glow.material.opacity = 0.5 * f + 0.15;
    }
  });

  // ---- floating diyas drifting on the current ----
  const floaters = [];
  for (let i = 0; i < 7; i++) {
    const d = diya({ scale: 0.9 });
    const fx = -10 + i * 2.6;
    d.group.position.set(fx, -0.48, 34.5 + (i % 3) * 1.8);
    group.add(d.group);
    floaters.push({ d, x: fx, z: 34.5 + (i % 3) * 1.8, ph: i * 1.7 });
  }
  updaters.push((t) => {
    for (const f of floaters) {
      const x = f.x + Math.sin(t * 0.25 + f.ph) * 1.2;
      f.d.group.position.set(x, -0.48 + Math.sin(t * 1.3 + f.ph) * 0.035, f.z + Math.sin(t * 0.18 + f.ph) * 0.8);
      const k = 0.75 + Math.sin(t * (6 + f.ph) + f.ph) * 0.2;
      f.d.flame.material.color.setHSL(0.09, 1, 0.5 * k);
      f.d.glow.material.opacity = 0.45 * k + 0.1;
    }
  });

  // ---- the temple at the head of the ghat ----
  const temple = new THREE.Group();
  const sanctum = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), toonMaterial(0xe8e0d0));
  sanctum.position.y = 0.9;
  sanctum.castShadow = true;
  temple.add(sanctum);
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 2.4), toonMaterial(0x8a8078));
  base.position.y = 0.15;
  temple.add(base);
  // the shikhara: stacked tiers
  const shMat = toonMaterial(0xd8913a);
  for (let i = 0; i < 3; i++) {
    const tier = new THREE.Mesh(new THREE.ConeGeometry(1.35 - i * 0.38, 0.55, 4), shMat);
    tier.rotation.y = Math.PI / 4;
    tier.position.y = 2.1 + i * 0.48;
    tier.castShadow = true;
    temple.add(tier);
  }
  const kalash = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), toonMaterial(0xe8c832));
  kalash.position.y = 3.6;
  temple.add(kalash);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2), new THREE.MeshBasicMaterial({ color: 0xff9a3c }));
  door.position.set(0, 0.85, 0.92);
  temple.add(door);
  const templeGlow = new THREE.PointLight(0xff9a3c, 8, 7, 2);
  templeGlow.position.set(0, 1.2, 1.2);
  temple.add(templeGlow);
  const flag = templeFlag({ poleH: 1.5 });
  flag.group.position.set(1.3, 1.8, 0);
  temple.add(flag.group);
  temple.position.set(-16.5, groundHeight(-16.5, 28), 28);
  temple.rotation.y = 0.6;
  temple.userData.solid = true;
  group.add(temple);
  updaters.push((t) => {
    flag.flag.rotation.y = Math.sin(t * 2.2) * 0.35 + Math.sin(t * 5.1) * 0.08;
    flag.flag.rotation.x = Math.sin(t * 1.7) * 0.08;
  });
  // temple diyas at the door
  for (const dx of [-0.7, 0.7]) {
    const d = diya({});
    d.group.position.set(dx, 0.32, 1.25);
    temple.add(d.group);
    diyaInstances.push(d);
  }
  // a marigold toran over the temple door
  const doorToran = marigoldToran({ w: 1.0, drop: 0.3, count: 9 });
  doorToran.position.set(0, 1.56, 0.96);
  temple.add(doorToran);
  // a rangoli laid at the ghat head, in front of the temple
  const ghatKolam = rangoli({ r: 1.05, seed: 11 });
  ghatKolam.position.set(-15.2, groundHeight(-15.2, 29.9) + 0.03, 29.9);
  ghatKolam.rotation.z = 2.2;
  group.add(ghatKolam);

  // ---- lamps + benches along the bank ----
  for (let x = PROM.x0 + 4; x <= PROM.x1 - 2; x += 9) {
    if (Math.abs(x - 14) < 2.6 || (x > GHAT.x0 - 3 && x < GHAT.x1 + 3)) continue;
    const l = streetLamp({});
    l.position.set(x, groundHeight(x, 30.2), 30.2);
    l.rotation.y = Math.PI;
    group.add(l);
  }
  for (const [x, ry] of [[-36, 0.1], [-22, -0.06], [20, -0.1], [27, 0.08]]) {
    const b = bench({});
    b.position.set(x, groundHeight(x, 29.2), 29.2);
    b.rotation.y = Math.PI + ry;
    group.add(b);
  }

  // ---- the cow, resting by the ghat ----
  const cowObj = cow();
  cowObj.group.position.set(-9.5, groundHeight(-9.5, 27.5), 27.5);
  cowObj.group.rotation.y = 2.8;
  group.add(cowObj.group);
  updaters.push((t) => {
    cowObj.tail.rotation.x = Math.sin(t * 1.1) * 0.25 + Math.sin(t * 3.3) * 0.06;
    cowObj.neck.rotation.x = Math.sin(t * 0.5) * 0.06 - 0.08;
  });

  // a street dog asleep on the second step
  const dog = streetDog();
  dog.group.position.set(1.2, -GHAT.stepH, GHAT.z0 + 1.0);
  dog.group.rotation.y = -0.5;
  group.add(dog.group);
  updaters.push((t) => {
    dog.body.scale.y = 1 + Math.sin(t * 1.9 + 1) * 0.03;
    dog.tail.rotation.x = Math.sin(t * 1.2 + 2) * 0.15;
  });

  // palms leaning over the water
  const palmSpots = [
    [-30, 26.5, 0.14], [-24.5, 27, -0.1], [-42, 26.8, 0.1], [-55, 26.4, 0.15],
    [-20, 27.4, -0.12], [18, 45.8, 0.12], [30, 47.5, -0.08], [23, 49.5, 0.1],
  ];
  for (const [x, z, lean] of palmSpots) {
    const p = palm({ h: 5.5 + (x % 3) * 0.7, lean });
    p.position.set(x, groundHeight(x, z), z);
    p.rotation.y = (x * 2.7 + z * 1.3) % (Math.PI * 2);
    group.add(p);
  }

  // a chai stall at the ghat head — tea with a view of the moon
  const ghatStall = chaiStall({});
  ghatStall.group.position.set(-13.4, groundHeight(-13.4, 29.2), 29.2);
  ghatStall.group.rotation.y = Math.PI * 0.15;
  group.add(ghatStall.group);
  updaters.push((t) => {
    ghatStall.stove.material.color.setHSL(0.08, 0.9, 0.55 + Math.sin(t * 7.7 + 1) * 0.12 + Math.sin(t * 17) * 0.05);
  });

  // ---- the far bank: quiet lane + the chhatri ----
  const laneLamp = streetLamp({ h: 3.8 });
  laneLamp.position.set(18, groundHeight(18, 47), 47);
  group.add(laneLamp);

  const circle = new THREE.Mesh(new THREE.CylinderGeometry(TERRACE.r, TERRACE.r + 0.2, 0.12, 20), toonMaterial(0x7d7a72));
  circle.position.set(TERRACE.x, groundHeight(TERRACE.x, TERRACE.z) + 0.06, TERRACE.z);
  circle.receiveShadow = true;
  group.add(circle);

  // the chhatri: four pillars and a little dome, the moon-view seat
  const chhatri = new THREE.Group();
  chhatri.userData.solid = true;
  const pillarMat = toonMaterial(0xc8bca0);
  const domeMat = toonMaterial(0x5d667e);
  for (const [px, pz] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.1, 8), pillarMat);
    pillar.position.set(px, 1.05, pz);
    pillar.castShadow = true;
    chhatri.add(pillar);
  }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 1.4), toonMaterial(0x7a5a3a));
  seat.position.y = 0.5;
  chhatri.add(seat);
  const chRoof = new THREE.Mesh(new THREE.SphereGeometry(1.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
  chRoof.scale.y = 0.62;
  chRoof.position.y = 2.1;
  chRoof.castShadow = true;
  chhatri.add(chRoof);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), toonMaterial(0xe8c832));
  finial.position.y = 2.95;
  chhatri.add(finial);
  chhatri.position.set(TERRACE.x, groundHeight(TERRACE.x, TERRACE.z) + 0.12, TERRACE.z);
  chhatri.rotation.y = 0.4;
  group.add(chhatri);
  addBoxRect(TERRACE.x - 1, TERRACE.z - 1, TERRACE.x + 1, TERRACE.z + 1);

  const marker = textSign({ text: 'चाँदनी छतरी', sub: 'CHANDNI CHHATRI · moon seat', w: 1.25, h: 0.5, bg: '#2a3450', fg: '#ffe9a0' });
  marker.position.set(TERRACE.x - 2.6, groundHeight(TERRACE.x - 2.6, TERRACE.z + 1.4) + 0.85, TERRACE.z + 1.4);
  marker.rotation.y = -0.5;
  group.add(marker);

  scene.add(group);
  return { group, updaters };
}
