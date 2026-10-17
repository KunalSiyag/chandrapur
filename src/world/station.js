import * as THREE from 'three';
import { toonMaterial } from '../core/toon.js';
import { RAIL_Z, SQUARE, groundHeight } from './layout.js';
import {
  textSign, timetable, bench, bicycle, streetLamp, flowerPot, crates, lightPool,
  chaiStall, cycleRickshaw, streetDog, makeCanvasTexture, poster, rangoli,
} from './props.js';
import { addBoxRect } from './colliders.js';

/**
 * Chandrapur station — the hub. A mustard halt with a long veranda,
 * deep eaves, a working clock and the yellow name board. A chai
 * stall steams on the platform; the last rake of the night waits
 * beyond it. Everything in town is measured from this front step.
 */
export function createStation(scene) {
  const group = new THREE.Group();
  group.name = 'station';
  const updaters = [];

  // ---- platform ----
  const platform = new THREE.Mesh(new THREE.BoxGeometry(22, 0.45, 2.9), toonMaterial(0x8a8078));
  platform.position.set(-1, 0.55 + 0.225, RAIL_Z + 2.45);
  platform.receiveShadow = true;
  group.add(platform);
  // the yellow coach-warning line along the platform edge
  const strip = new THREE.Mesh(new THREE.BoxGeometry(22, 0.03, 0.34), toonMaterial(0xd8b83a));
  strip.position.set(-1, 1.015, RAIL_Z + 1.05);
  group.add(strip);
  const platPool = lightPool(6, 0xffc06a, 0.05);
  platPool.position.set(-1, 1.03, RAIL_Z + 2.4);
  group.add(platPool);

  // ---- station building ----
  const B = new THREE.Group();
  B.userData.solid = true;
  const plasterMat = toonMaterial(0xc9a96e);      // mustard halt
  const trimMat = toonMaterial(0x5a3c30);        // maroon woodwork
  const roofMat = toonMaterial(0x6a4438);       // clay-tile red
  const body = new THREE.Mesh(new THREE.BoxGeometry(10, 3.6, 4.5), plasterMat);
  body.position.set(0, 1.8, -8.75);
  body.castShadow = body.receiveShadow = true;
  B.add(body);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.5, 4.9), trimMat);
  plinth.position.set(0, 0.25, -8.75);
  B.add(plinth);
  // long low red roof with deep eaves over the platform
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 7.4, 2.4, 4, 1, false, Math.PI * 0.25), roofMat);
  roof.scale.set(0.78, 1, 1);
  roof.position.set(0, 4.5, -8.75);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  B.add(roof);
  // veranda columns onto the platform
  for (const x of [-4.6, -1.6, 1.6, 4.6]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 2.9, 7), trimMat);
    col.position.set(x, 1.45, -11.6);
    col.castShadow = true;
    B.add(col);
  }
  const overhang = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.18, 2.6), trimMat);
  overhang.position.set(0, 2.95, -11.4);
  overhang.castShadow = true;
  B.add(overhang);

  // waiting-room windows: warm, cool, dim — the room closing for the night
  const winGlow = new THREE.MeshBasicMaterial({ color: 0xffc46b });
  const winCool = new THREE.MeshBasicMaterial({ color: 0xaac8ff });
  const winDim = new THREE.MeshBasicMaterial({ color: 0x2a3140 });
  for (const [wx, mat] of [[-3, winGlow], [-1, winCool], [1.6, winDim], [3.4, winGlow]]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.3, 0.14), trimMat);
    frame.position.set(wx, 2.1, -10.98);
    B.add(frame);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 1.04), mat);
    pane.position.set(wx, 2.1, -10.9);
    B.add(pane);
  }
  // doors: one onto the platform, one onto the square
  const doorMat = toonMaterial(0x46342a);
  const door1 = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.3, 0.16), doorMat);
  door1.position.set(0.6, 1.15, -10.97);
  B.add(door1);
  const door2 = door1.clone();
  door2.position.set(-0.8, 1.15, -6.53);
  B.add(door2);
  const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.1), winGlow);
  doorGlow.position.set(-0.8, 0.8, -6.44);
  B.add(doorGlow);
  for (const wx of [-3, 3]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 0.14), trimMat);
    frame.position.set(wx, 2.15, -6.56);
    B.add(frame);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 1.12), winGlow);
    pane.position.set(wx, 2.15, -6.47);
    B.add(pane);
  }

  // the yellow station boards — platform side + square side
  const hangSign = (z, ry) => {
    const s = textSign({ text: 'चंदपुर', sub: 'CHANDPUR', w: 3.6, h: 0.95, bg: '#e8c832', fg: '#1a1a1a', accent: '#1a1a1a' });
    s.position.set(0, 2.42, z);
    s.rotation.y = ry;
    B.add(s);
    const back = s.clone();
    back.rotation.y = ry + Math.PI;
    back.position.z = z - 0.02 * Math.sign(z);
    B.add(back);
  };
  hangSign(-11.05, 0);
  hangSign(-6.42, 0);

  // the clock tower
  const tower = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 1.3), plasterMat);
  tower.position.set(0, 5.4, -8.75);
  tower.castShadow = true;
  B.add(tower);
  const clockTex = makeCanvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#f4eedd'; ctx.beginPath(); ctx.arc(64, 64, 58, 0, 7); ctx.fill();
    ctx.strokeStyle = '#333a48'; ctx.lineWidth = 6; ctx.stroke();
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(64, 22); ctx.stroke(); // 12
    ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(94, 78); ctx.stroke();
    ctx.fillStyle = '#222a38'; ctx.beginPath(); ctx.arc(64, 64, 6, 0, 7); ctx.fill();
  });
  const clock = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), toonMaterial(0xffffff, { paint: 0.015, map: clockTex }));
  clock.position.set(0, 5.4, -8.05);
  B.add(clock);
  const clock2 = clock.clone();
  clock2.rotation.y = Math.PI;
  clock2.position.z = -9.45;
  B.add(clock2);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.7, 4), roofMat);
  cap.rotation.y = Math.PI / 4;
  cap.position.set(0, 6.2, -8.75);
  cap.castShadow = true;
  B.add(cap);

  // interior warmth
  const interior = new THREE.PointLight(0xffb45e, 16, 14, 1.8);
  interior.position.set(0, 2.3, -8.75);
  B.add(interior);

  group.add(B);

  // ---- the platform chai stall — steam, kettle, glasses ----
  const stall = chaiStall({});
  stall.group.position.set(7.5, 1.0, -12.1);
  stall.group.rotation.y = Math.PI;
  group.add(stall.group);
  stall.group.updateMatrixWorld(true);
  const kettleWorld = stall.kettleTop.clone().applyMatrix4(stall.group.matrixWorld);
  updaters.push((t) => {
    stall.stove.material.color.setHSL(0.08, 0.9, 0.55 + Math.sin(t * 9) * 0.12 + Math.sin(t * 23) * 0.05);
  });

  // steam over the kettle (three lazy points)
  const steamGeo = new THREE.BufferGeometry();
  steamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  const steam = new THREE.Points(steamGeo, new THREE.PointsMaterial({
    color: 0xcfd8e8, size: 0.55, transparent: true, opacity: 0.28, depthWrite: false, fog: false,
  }));
  steam.frustumCulled = false;
  group.add(steam);
  updaters.push((t) => {
    const arr = steamGeo.attributes.position.array;
    for (let i = 0; i < 3; i++) {
      const life = (t * 0.4 + i / 3) % 1;
      arr[i * 3] = kettleWorld.x + Math.sin(life * 9 + i) * 0.16 * life;
      arr[i * 3 + 1] = kettleWorld.y + life * 1.5;
      arr[i * 3 + 2] = kettleWorld.z + Math.cos(life * 7 + i * 2) * 0.16 * life;
    }
    steamGeo.attributes.position.needsUpdate = true;
  });

  // ---- platform furniture ----
  const b1 = bench({});
  b1.position.set(-5.5, 1.0, -12.1);
  group.add(b1);
  const b2 = bench({});
  b2.position.set(2.5, 1.0, -12.1);
  b2.rotation.y = Math.PI;
  group.add(b2);
  const tt = timetable({});
  tt.position.set(-8.5, 1.9, -10.9);
  group.add(tt);
  const ttPost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), toonMaterial(0x4a505c));
  ttPost.position.set(-8.5, 1.45, -10.95);
  group.add(ttPost);
  const lampP = streetLamp({ h: 3.4, arm: 0.6 });
  lampP.position.set(9.5, 1.0, -12.2);
  group.add(lampP);
  const bike = bicycle({ color: 0x3a6a9c });
  bike.position.set(-7.8, 1.0, -11.6);
  bike.rotation.y = 1.4;
  group.add(bike);

  // ---- station square ----
  const sqY = groundHeight(0, -2);
  const rack = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.5), toonMaterial(0x3c4452));
  rack.position.set(-8, sqY + 0.5, -3.6);
  group.add(rack);
  for (let i = 0; i < 3; i++) {
    const bc = bicycle({ color: [0x9c4a3c, 0x4a7a5c, 0x8a7a3c][i], basket: i !== 1 });
    bc.position.set(-8.9 + i * 0.95, sqY, -3.3 - (i % 2) * 0.25);
    bc.rotation.y = -0.25 + i * 0.3;
    group.add(bc);
  }
  // cycle rickshaw resting at the station corner
  const crick = cycleRickshaw();
  crick.position.set(12.6, sqY, -5.4);
  crick.rotation.y = 0.9;
  crick.userData.solid = true;
  group.add(crick);

  // the chai corner of the square: stall + crates + sleeping dog
  const sqStall = chaiStall({});
  sqStall.group.position.set(11.5, sqY, -3.4);
  sqStall.group.rotation.y = -Math.PI / 2 - 0.3;
  group.add(sqStall.group);
  updaters.push((t) => {
    sqStall.stove.material.color.setHSL(0.08, 0.9, 0.55 + Math.sin(t * 8.3 + 2) * 0.12 + Math.sin(t * 19) * 0.05);
  });
  const crateStack = crates(3);
  crateStack.position.set(13.6, sqY, -4.9);
  crateStack.rotation.y = 0.5;
  group.add(crateStack);
  const dog = streetDog();
  dog.group.position.set(9.6, sqY, -5.2);
  dog.group.rotation.y = 2.3;
  group.add(dog.group);
  updaters.push((t) => {
    dog.body.scale.y = 1 + Math.sin(t * 2.1) * 0.03;           // breathing
    dog.tail.rotation.x = Math.sin(t * 1.4) * 0.18;            // dreaming
  });

  const sqBench = bench({});
  sqBench.position.set(-4, sqY, -5.4);
  sqBench.rotation.y = 0.15;
  group.add(sqBench);
  const sqBench2 = bench({});
  sqBench2.position.set(5.5, sqY, -5.2);
  sqBench2.rotation.y = -0.4;
  group.add(sqBench2);
  const lamp1 = streetLamp({});
  lamp1.position.set(-11, sqY, -5);
  group.add(lamp1);
  const lamp2 = streetLamp({});
  lamp2.position.set(9, sqY, -0.5);
  lamp2.rotation.y = Math.PI;
  group.add(lamp2);
  for (const [px, pz, hue] of [[3.8, -6.2, 0xe8931a], [-2.6, -6.4, 0xe8931a], [10.4, -1.4, 0xd85a6a]]) {
    const pot = flowerPot({ hue });
    pot.position.set(px, sqY, pz);
    group.add(pot);
  }
  // a painted notice by the door: the mela announcement
  const notice = poster({ title: 'मेला 15 अगस्त', lines: ['station chowk', '7 बजे से · from 7 pm', 'झूले · खाना · दुकानें'], w: 0.85, h: 1.1, hue: '#f2e6c8' });
  notice.position.set(2.1, 2.0, -6.43);
  group.add(notice);

  // a rangoli in front of the station door, kept fresh for the mela
  const kolam = rangoli({ r: 1.0, seed: 5 });
  kolam.position.set(0.4, groundHeight(0.4, -5.6) + 0.03, -5.6);
  kolam.rotation.z = 0.6;
  group.add(kolam);

  scene.add(group);
  return { group, updaters };
}
