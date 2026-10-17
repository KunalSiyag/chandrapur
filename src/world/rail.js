import * as THREE from 'three';
import { toonMaterial } from '../core/toon.js';
import { RAIL_Z, RAIL_X0, RAIL_X1, CROSSING_X, groundHeight } from './layout.js';
import { fenceRun, electricalBox, streetLamp, crossingBoom } from './props.js';
import { addBoxRect } from './colliders.js';

/**
 * The railway: ballast, rails, sleepers, catenary with sagging
 * wires, fences — and the night rake stabled at the platform,
 * blue coaches with a yellow band, mostly dark, a few windows
 * on. The line runs east–west, screened by trees at both ends.
 */
export function createRail(scene) {
  const group = new THREE.Group();
  group.name = 'railway';

  const L = RAIL_X1 - RAIL_X0;
  const cx = (RAIL_X0 + RAIL_X1) / 2;

  const ballast = new THREE.Mesh(new THREE.BoxGeometry(L, 0.22, 4.4), toonMaterial(0x555a64));
  ballast.position.set(cx, 0.52, RAIL_Z);
  ballast.receiveShadow = true;
  group.add(ballast);

  const sleeperGeo = new THREE.BoxGeometry(0.28, 0.09, 2.3);
  const sleeperMat = toonMaterial(0x3c3228);
  const nSleep = Math.floor(L / 1.15);
  const sleepers = new THREE.InstancedMesh(sleeperGeo, sleeperMat, nSleep);
  const m = new THREE.Matrix4();
  for (let i = 0; i < nSleep; i++) {
    const x = RAIL_X0 + (i + 0.5) * 1.15;
    m.makeTranslation(x, 0.66, RAIL_Z);
    sleepers.setMatrixAt(i, m);
  }
  sleepers.receiveShadow = true;
  group.add(sleepers);

  const railMat = toonMaterial(0x8d949e);
  for (const dz of [-0.72, 0.72]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(L, 0.14, 0.1), railMat);
    rail.position.set(cx, 0.75, RAIL_Z + dz);
    group.add(rail);
  }

  // catenary poles + drooping messenger wire
  const poleXs = [];
  for (let x = -40; x <= 40; x += 13.33) {
    if (Math.abs(x - CROSSING_X) < 4) continue;
    poleXs.push(x);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6.4, 7), toonMaterial(0x4c4238));
    pole.position.set(x, 0.55 + 3.2, RAIL_Z - 2.4);
    pole.castShadow = true;
    group.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.2), toonMaterial(0x4c4238));
    arm.position.set(x, 0.55 + 6.1, RAIL_Z - 1.3);
    group.add(arm);
  }
  const wireMat = new THREE.MeshBasicMaterial({ color: 0x11141c });
  for (let i = 0; i < poleXs.length - 1; i++) {
    const a = new THREE.Vector3(poleXs[i], 6.5, RAIL_Z - 0.3);
    const b = new THREE.Vector3(poleXs[i + 1], 6.5, RAIL_Z - 0.3);
    const mid = a.clone().lerp(b, 0.5); mid.y -= 0.35;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.02, 4), wireMat));
  }
  const contact = new THREE.Mesh(new THREE.BoxGeometry(L, 0.045, 0.045), wireMat);
  contact.position.set(cx, 5.6, RAIL_Z);
  group.add(contact);

  // fences: south side broken at the crossing + station, north full
  group.add(fenceRun({ from: [RAIL_X0 + 12, RAIL_Z + 4.6], to: [CROSSING_X - 3.4, RAIL_Z + 4.6] }));
  group.add(fenceRun({ from: [CROSSING_X + 3.4, RAIL_Z + 4.6], to: [-10, RAIL_Z + 4.6] }));
  group.add(fenceRun({ from: [10, RAIL_Z + 4.6], to: [RAIL_X1 - 12, RAIL_Z + 4.6] }));
  group.add(fenceRun({ from: [RAIL_X0 + 10, RAIL_Z - 4.6], to: [RAIL_X1 - 10, RAIL_Z - 4.6] }));

  // ---- the level crossing: striped booms, lamps, the gateman's hut ----
  const deck = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.16, 6.4), toonMaterial(0x8a8f98));
  deck.position.set(CROSSING_X, 0.56, RAIL_Z);
  deck.receiveShadow = true;
  group.add(deck);
  for (const sx of [-1, 1]) {
    const boom = crossingBoom({});
    boom.position.set(CROSSING_X - sx * 4.6, groundHeight(CROSSING_X - sx * 4.6, RAIL_Z + 4.2), RAIL_Z + sx * 4.2);
    boom.rotation.y = sx > 0 ? Math.PI : 0;
    group.add(boom);
  }
  // the gateman's hut — one warm window means somebody's on duty
  const hut = new THREE.Group();
  const hutBody = new THREE.Mesh(new THREE.BoxGeometry(2, 2.2, 1.8), toonMaterial(0xb0a278));
  hutBody.position.y = 1.1;
  hutBody.castShadow = true;
  hut.add(hutBody);
  const hutRoof = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.7, 4), toonMaterial(0x6a4438));
  hutRoof.rotation.y = Math.PI / 4;
  hutRoof.position.y = 2.55;
  hut.add(hutRoof);
  const hutWin = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.6), new THREE.MeshBasicMaterial({ color: 0xffc46b }));
  hutWin.position.set(0, 1.3, 0.92);
  hut.add(hutWin);
  hut.position.set(CROSSING_X + 5.5, groundHeight(CROSSING_X + 5.5, RAIL_Z + 4.6), RAIL_Z + 4.6);
  hut.rotation.y = 0.4;
  hut.userData.solid = true;
  group.add(hut);

  const box = electricalBox();
  box.position.set(CROSSING_X + 3.4, groundHeight(CROSSING_X + 3.4, RAIL_Z + 4.6), RAIL_Z + 7.4);
  box.rotation.y = 0.4;
  group.add(box);
  const crossLamp = streetLamp({ h: 4 });
  crossLamp.position.set(CROSSING_X - 4.5, groundHeight(CROSSING_X - 4.5, RAIL_Z + 6.5), RAIL_Z + 6.5);
  group.add(crossLamp);

  // ---- the night rake, stabled clear of the crossing ----
  const train = buildTrain();
  train.position.set(3, 0.83, RAIL_Z);
  group.add(train);
  addBoxRect(-11, RAIL_Z - 1.8, 17.5, RAIL_Z + 1.8);

  scene.add(group);
  return { group };
}

function buildTrain() {
  const g = new THREE.Group();
  g.name = 'night-rake';
  // the Indian night coach: oxide-blue body, yellow band, dust
  const bodyMat = toonMaterial(0x24466e);
  const bandMat = toonMaterial(0xd8b83a);
  const darkMat = toonMaterial(0x2c313a);
  const underMat = toonMaterial(0x1a1e26);

  for (let car = 0; car < 2; car++) {
    const c = new THREE.Group();
    const x0 = car * 13.6 - 6.8;
    const body = new THREE.Mesh(new THREE.BoxGeometry(13, 2.7, 2.7), bodyMat);
    body.position.set(x0, 1.65, 0);
    body.castShadow = true;
    c.add(body);
    // yellow band just below the windows
    const band = new THREE.Mesh(new THREE.BoxGeometry(13.02, 0.28, 2.72), bandMat);
    band.position.set(x0, 1.45, 0);
    c.add(band);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 1.38, 12.9, 10, 1, false, 0, Math.PI), toonMaterial(0x8a9098));
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    roof.position.set(x0, 3.0, 0);
    c.add(roof);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.5, 2.4), underMat);
    skirt.position.set(x0, 0.25, 0);
    c.add(skirt);
    for (const dx of [-4.3, 4.3]) {
      const door = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 2.0), darkMat);
      door.position.set(x0 + dx, 1.35, 1.37);
      c.add(door);
    }
    // window band — a stabled rake: most dark, a few reading late
    for (let i = 0; i < 8; i++) {
      const wx = x0 - 5.3 + i * 1.5;
      const lit = (car === 0 && (i === 2 || i === 5)) || (car === 1 && (i === 1 || i === 5));
      const cool = car === 1 && i === 5;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.9),
        new THREE.MeshBasicMaterial({ color: lit ? (cool ? 0x8ab6ff : 0xffd98a) : 0x141c28 }));
      win.position.set(wx, 2.15, 1.37);
      c.add(win);
      const win2 = win.clone();
      win2.position.z = -1.37;
      win2.rotation.y = Math.PI;
      c.add(win2);
    }
    // the small blue nameplate glow
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.32), new THREE.MeshBasicMaterial({ color: 0xdde8ff }));
    plate.position.set(x0, 3.15, 1.39);
    c.add(plate);
    g.add(c);
  }
  // tail lamp glowing west
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
  tail.position.set(-13.5, 2.6, 0.9);
  g.add(tail);
  const tail2 = tail.clone();
  tail2.position.z = -0.9;
  g.add(tail2);
  return g;
}
