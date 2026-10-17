import * as THREE from 'three';
import { toonMaterial } from '../core/toon.js';
import { shrubGeometry } from './foliage.js';
import { textSign, poster, lightPool, wire, marigoldToran, diya, makeCanvasTexture } from './props.js';
import { BRIDGE, GHAT, bridgeDeckY, WATER_Y } from './layout.js';
import { LOCAL as C, group, mesh, box, cylinder, sphere, beam, plane, flat, seeded, footprint, roundFootprint, ribbon } from './build-kit.js';

// One architectural vocabulary, original geometry. All generators are local:
// buildings face +Z, parked vehicles nose +Z, their origin is ground contact.
// Seeds select local repairs, stock and window use; parcels are never random.

export function makeSlateRoof({ w, d, rise = 1.05, seed = 1 } = {}) {
  const g = group('slate-roof');
  const hw = w / 2, hd = d / 2;
  const vertices = [
    -hw, 0, -hd, hw, 0, -hd, hw, rise, 0, -hw, 0, -hd, hw, rise, 0, -hw, rise, 0,
    -hw, rise, 0, hw, rise, 0, hw, 0, hd, -hw, rise, 0, hw, 0, hd, -hw, 0, hd,
    -hw, 0, hd, -hw, 0, -hd, -hw, rise, 0, hw, 0, -hd, hw, 0, hd, hw, rise, 0,
  ];
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.computeVertexNormals();
  mesh(g, geo, toonMaterial(C.slate, { side: THREE.DoubleSide }));
  // Broad overlapping courses, not a field of individual identical tiles.
  for (const side of [-1, 1]) {
    const pitch = Math.atan2(rise, hd);
    for (let row = 1; row < 6; row++) {
      const z = side * hd * row / 6, y = rise * (1 - row / 6);
      const course = box(g, w + 0.08, 0.045, 0.045, row % 3 === seed % 3 ? C.slateDark : C.slate, 0, y + 0.02, z);
      course.rotation.x = side * pitch;
    }
    box(g, w + 0.15, 0.1, 0.1, C.timber, 0, 0, side * hd);
  }
  cylinder(g, 0.075, 0.075, w + 0.12, C.slateDark, 0, rise + 0.045, 0).rotation.z = Math.PI / 2;
  for (const x of [-hw, hw]) {
    beam(g, [x, 0, -hd], [x, rise, 0], 0.065, C.timber);
    beam(g, [x, rise, 0], [x, 0, hd], 0.065, C.timber);
  }
  return g;
}

export function makeWindow({ w = 1.0, h = 1.25, lit = true, shutter = C.indigo, bars = false } = {}) {
  const g = group('window');
  box(g, w + 0.18, h + 0.18, 0.13, C.timber);
  plane(g, w, h, flat(lit ? C.warm : C.dark), 0, 0, 0.071);
  box(g, 0.06, h, 0.04, shutter, 0, 0, 0.1);
  box(g, w, 0.06, 0.04, shutter, 0, h * 0.08, 0.1);
  box(g, w + 0.3, 0.085, 0.23, C.stone, 0, -h / 2 - 0.07, 0.06);
  if (bars) for (let i = -1; i <= 1; i++) box(g, 0.025, h, 0.04, C.timber, i * w / 4, 0, 0.15);
  if (!lit) {
    for (const s of [-1, 1]) {
      box(g, w / 2 - 0.04, h - 0.05, 0.05, shutter, s * w / 4, 0, 0.105);
      for (let i = 0; i < 5; i++) box(g, w / 2 - 0.1, 0.025, 0.03, C.timber, s * w / 4, -h * 0.35 + i * h * 0.17, 0.145);
    }
  }
  return g;
}

export function makeBalcony({ w = 2.5, laundry = true, seed = 1, timber = C.timber } = {}) {
  const g = group('balcony');
  box(g, w, 0.14, 0.92, timber, 0, 0, 0.43);
  for (const x of [-w / 2 + 0.15, w / 2 - 0.15]) beam(g, [x, -0.65, 0], [x, 0, 0.73], 0.055, C.wood);
  for (let i = 0; i <= Math.floor(w / 0.28); i++) box(g, 0.035, 0.85, 0.035, timber, -w / 2 + i * w / Math.floor(w / 0.28), 0.5, 0.87);
  box(g, w + 0.1, 0.06, 0.065, timber, 0, 0.92, 0.87);
  if (laundry) {
    beam(g, [-w * 0.42, 1.13, 0.75], [w * 0.42, 1.13, 0.75], 0.007, C.wood);
    const colors = [C.canvas, '#adb5c4', '#a78180'];
    for (let i = 0; i < 3; i++) {
      const cloth = plane(g, 0.38, 0.55 + (i % 2) * 0.17, toonMaterial(colors[(i + seed) % 3], { side: THREE.DoubleSide }), (i - 1) * 0.49, 0.8, 0.77);
      cloth.rotation.y = (i - 1) * 0.06;
      if (seed % 2 === 0) {
        cloth.userData.dynamic = true;
        cloth.userData.update = (t) => { cloth.rotation.x = Math.sin(t * 1.3 + i + seed) * 0.07; };
      }
    }
  }
  const pot = makePot({ flowers: seed % 2 === 0, seed }); pot.position.set(w * 0.34, 0.13, 0.35); g.add(pot);
  return g;
}

function stoneBase(g, w, d, h, seed) {
  box(g, w, h, d, C.stoneDark, 0, h / 2, 0);
  const rnd = seeded(seed);
  for (let row = 0; row < Math.ceil(h / 0.24); row++) {
    const n = Math.ceil(w / 0.65);
    for (let i = 0; i < n; i++) {
      box(g, w / n - 0.035, 0.2, 0.035, rnd() > 0.5 ? C.stone : '#8c8e83', -w / 2 + (i + 0.5) * w / n, row * 0.24 + 0.12, d / 2 + 0.012);
    }
  }
}

function buildingShell({ w, d, h, wall, trim, seed, shop = false, roof = true }) {
  const g = group(shop ? 'shop' : 'house');
  footprint(g, w, d);
  stoneBase(g, w + 0.08, d + 0.08, 0.48, seed);
  box(g, w, h - 0.48, d - (shop ? 0.55 : 0), wall, 0, (h + 0.48) / 2, shop ? -0.275 : 0, 'lime-plaster');
  if (shop) {
    box(g, w, h - 2.6, 0.6, wall, 0, (h + 2.6) / 2, d / 2 - 0.3);
    for (const s of [-1, 1]) box(g, 0.2, 2.65, 0.56, trim, s * (w / 2 - 0.1), 1.32, d / 2 - 0.28);
  }
  box(g, w + 0.09, 0.17, d + 0.09, trim, 0, 2.85, 0);
  for (const s of [-1, 1]) box(g, 0.16, h - 0.5, 0.18, trim, s * (w / 2 - 0.08), (h + 0.5) / 2, d / 2 + 0.015);
  if (roof) {
    const r = makeSlateRoof({ w: w + 0.65, d: d + 0.85, rise: 0.95 + w * 0.045, seed }); r.position.y = h; g.add(r);
  }
  // A repaired corner and a painted damp tide imply age, without noise props.
  box(g, w * 0.22, 0.13, 0.014, '#9eaa9b', -w * 0.3, 0.68, d / 2 + 0.025);
  const drain = cylinder(g, 0.033, 0.033, h - 0.1, trim, w / 2 - 0.04, h / 2, d / 2 + 0.13, 6);
  drain.name = 'rainwater-pipe';
  // Every building has ordinary sides and a service rear. Aerial exploration
  // must not reveal a town of stage-set frontages with blank cube backs.
  for (const side of [-1, 1]) for (let floor = 0; floor < (h > 4.9 ? 2 : 1); floor++) {
    const win = makeWindow({ w: Math.min(0.82, d * 0.21), h: 1.0, lit: (seed + floor + (side > 0 ? 1 : 0)) % 4 === 0, shutter: trim });
    win.position.set(side * (w / 2 + 0.055), floor ? h - 1.35 : 1.7, -d * 0.1);
    win.rotation.y = side * Math.PI / 2; g.add(win);
  }
  for (const side of [-1, 1]) {
    const back = makeWindow({ w: 0.85, h: 1.08, lit: (seed + (side > 0 ? 1 : 0)) % 4 === 0, shutter: trim });
    back.position.set(side * w * 0.24, h - 1.25, -d / 2 - 0.055); back.rotation.y = Math.PI; g.add(back);
  }
  const backDoor = box(g, 0.84, 1.97, 0.08, trim, w * 0.23, 1.44, -d / 2 - 0.045); backDoor.name = 'service-door';
  box(g, 1.08, 0.13, 0.38, C.stone, w * 0.23, 0.54, -d / 2 - 0.2);
  return g;
}

export function makeShop({ w = 4.5, d = 5.2, h = 6.2, seed = 1, name = 'shop', text = 'चंदपुर भंडार', sub = 'GENERAL STORE',
  wall = C.plaster, trim = C.indigo, kind = 'grocer', closed = false, balcony = true, awning = true } = {}) {
  const g = buildingShell({ w, d, h, wall, trim, seed, shop: true }); g.name = name;
  const f = d / 2;
  box(g, w - 0.4, 2.15, 0.02, flat(C.dark), 0, 1.53, f - 0.28, 'shop-recess');
  if (closed) {
    box(g, w - 0.38, 2.16, 0.07, '#74817f', 0, 1.52, f - 0.17);
    for (let i = 0; i < 14; i++) box(g, w - 0.45, 0.025, 0.025, '#546366', 0, 0.52 + i * 0.15, f - 0.115);
    const bill = poster({ title: 'कल सुबह', lines: ['OPEN AT 7', 'दूध · चाय · राशन'], w: 0.65, h: 0.9, hue: '#ded3b7' });
    bill.position.set(w * 0.23, 1.5, f - 0.07); g.add(bill);
  } else {
    // Real recessed stock cabinet: shelf fronts and goods stand ahead of its
    // dark backing; no solid body hides the contents.
    const sw = w * 0.64;
    for (const y of [0.83, 1.35, 1.95]) box(g, sw, 0.075, 0.41, C.wood, -w * 0.09, y, f - 0.04);
    box(g, sw, 0.22, 0.5, C.wood, -w * 0.09, 0.63, f - 0.07);
    const rnd = seeded(seed);
    for (let shelf = 0; shelf < 2; shelf++) for (let i = 0; i < 7; i++) {
      const x = -sw / 2 + i * sw / 7 + sw / 14 - w * 0.09, y = 0.9 + shelf * 0.55;
      if (kind === 'sweets') {
        cylinder(g, 0.16, 0.16, 0.055, C.brass, x, y, f + 0.03);
        for (const side of [-1, 1]) sphere(g, 0.065, shelf ? '#bd8d4c' : '#d7b26d', x + side * 0.06, y + 0.075, f + 0.03);
      } else if (kind === 'tailor' || kind === 'books') {
        for (let k = 0; k < 3; k++) box(g, 0.26, 0.07, 0.25, [C.red, C.indigo, C.sage, C.canvas][(i + k) % 4], x, y + k * 0.07, f + 0.035);
      } else if (kind === 'brass') {
        cylinder(g, 0.055, 0.11, 0.22, C.brass, x, y + 0.11, f + 0.02);
        sphere(g, 0.08, C.brass, x, y + 0.1, f + 0.01, [1, 0.7, 1]);
      } else {
        box(g, 0.19, 0.23 + rnd() * 0.06, 0.17, ['#bd8a61', C.red, '#7a9274', C.canvas][i % 4], x, y + 0.13, f + 0.045);
        plane(g, 0.11, 0.07, flat('#e7d9ab'), x, y + 0.12, f + 0.14);
      }
    }
    const curtain = box(g, 0.7, 2.05, 0.04, trim, w * 0.35, 1.5, f - 0.12); curtain.name = 'side-door';
    cylinder(g, 0.025, 0.025, 0.16, C.brass, w * 0.28, 1.25, f - 0.07).rotation.z = Math.PI / 2;
    const pool = lightPool(1.85, 0xffc481, 0.06); pool.position.set(-0.3, 0.04, f + 0.5); g.add(pool);
  }
  const sign = textSign({ text, sub, w: w - 0.45, h: 0.76, bg: trim, fg: '#ecdfbd' });
  sign.position.set(0, 3.17, f + 0.12); g.add(sign);
  if (awning) {
    const canopy = group('canvas-awning');
    const colors = [trim, C.canvas];
    for (let i = 0; i < 6; i++) {
      const a = box(canopy, (w - 0.15) / 6, 0.035, 1.02, colors[i % 2], -w / 2 + 0.075 + (i + 0.5) * (w - 0.15) / 6, 2.77, f + 0.41);
      a.rotation.x = 0.16;
      box(canopy, (w - 0.15) / 6 - 0.015, 0.17, 0.04, colors[i % 2], a.position.x, 2.58, f + 0.94);
    }
    for (const x of [-w / 2 + 0.16, w / 2 - 0.16]) beam(canopy, [x, 2.35, f], [x, 2.75, f + 0.93], 0.024, C.timber);
    g.add(canopy);
  }
  const upperY = h - 1.5;
  for (const s of [-1, 1]) {
    const win = makeWindow({ w: Math.min(1.15, w * 0.24), h: 1.3, lit: (seed + (s > 0 ? 1 : 0)) % 3 !== 0, shutter: trim });
    win.position.set(s * w * 0.25, upperY, f + 0.05); g.add(win);
  }
  if (balcony) { const b = makeBalcony({ w: w * 0.67, seed, laundry: seed % 3 !== 0, timber: trim }); b.position.set(0, upperY - 0.8, f + 0.03); g.add(b); }
  if (seed % 2 === 0) {
    const toran = marigoldToran({ w: w * 0.5, count: 12 }); toran.position.set(-w * 0.08, 2.45, f + 0.06); g.add(toran);
  }
  return g;
}

export function makeHouse({ w = 4.7, d = 4.8, h = 5.4, seed = 1, wall = C.sage, trim = C.indigo, balcony = true, name = 'house' } = {}) {
  const g = buildingShell({ w, d, h, wall, trim, seed }); g.name = name;
  const f = d / 2 + 0.03;
  box(g, 1.04, 2.16, 0.13, C.timber, w * 0.2, 1.52, f);
  box(g, 0.87, 2.0, 0.1, trim, w * 0.2, 1.5, f + 0.08);
  plane(g, 0.08, 0.04, flat(C.brass), w * 0.29, 1.44, f + 0.15);
  for (const [x, y, lit] of [[-w * 0.25, 1.83, true], [-w * 0.24, h - 1.22, seed % 3 !== 0], [w * 0.24, h - 1.22, seed % 2 === 0]]) {
    const win = makeWindow({ lit, shutter: trim, w: w * 0.22, h: y < 3 ? 1.05 : 1.2 }); win.position.set(x, y, f); g.add(win);
  }
  const side = makeWindow({ lit: seed % 3 === 1, w: 0.95, h: 1.1, shutter: trim });
  side.position.set(w / 2 + 0.035, h - 1.4, 0.15); side.rotation.y = Math.PI / 2; g.add(side);
  if (balcony) { const b = makeBalcony({ w: w * 0.65, seed }); b.position.set(0, h - 2.0, f); g.add(b); }
  const number = textSign({ text: `${21 + seed}`, w: 0.26, h: 0.22, bg: trim, fg: '#efe4c9' }); number.position.set(w * 0.36, 2.47, f + 0.08); g.add(number);
  const tank = makeWaterContainer({ kind: 'tank' }); tank.position.set(-w * 0.27, h + 0.52, -d * 0.3); g.add(tank);
  cylinder(g, 0.06, 0.07, 0.8, C.timber, w * 0.27, h + 0.38, -d * 0.28, 6);
  for (const x of [-0.36, 0.36]) { const pot = makePot({ seed: seed + 2, flowers: true }); pot.position.set(w * 0.2 + x, 0.04, f + 0.4); g.add(pot); }
  // Small worked household courts make the connective housing read as
  // parcels on a lane, not detached cubes in empty grass. A gate lines up
  // with each door; the shared street is never filled with random clutter.
  box(g, w + 0.75, 0.055, 1.55, '#939780', 0, 0.013, f + 0.73, 'household-court');
  for (const side of [-1, 1]) {
    box(g, 0.17, 0.34, 1.55, C.stoneDark, side * (w / 2 + 0.28), 0.18, f + 0.73);
    box(g, 0.21, 0.055, 1.57, C.stone, side * (w / 2 + 0.28), 0.365, f + 0.73);
  }
  const doorX = w * 0.2, bounds = [[-w / 2 - 0.28, doorX - 0.65], [doorX + 0.65, w / 2 + 0.28]];
  for (const [a, b] of bounds) if (b > a) {
    box(g, b - a, 0.33, 0.17, C.stoneDark, (a + b) / 2, 0.17, f + 1.45);
    box(g, b - a + 0.05, 0.055, 0.21, C.stone, (a + b) / 2, 0.36, f + 1.45);
  }
  if (seed % 3 === 0) {
    const water = makeWaterContainer({ kind: 'drum' }); water.position.set(-w * 0.31, 0.035, f + 0.35); g.add(water);
    const basin = cylinder(g, 0.2, 0.13, 0.12, '#9baba0', -w * 0.29, 0.1, f + 0.94, 12); basin.name = 'washing-basin';
  }
  return g;
}

export function makePot({ flowers = false, seed = 1 } = {}) {
  const g = group('household-pot');
  cylinder(g, 0.19, 0.12, 0.29, '#9c6c51', 0, 0.145, 0);
  cylinder(g, 0.205, 0.19, 0.035, '#b08161', 0, 0.29, 0);
  sphere(g, 0.22, '#588968', 0, 0.39, 0, [1, 0.8, 1]);
  if (flowers) for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5 + seed; sphere(g, 0.066, C.marigold, Math.cos(a) * 0.16, 0.5 + i % 2 * 0.05, Math.sin(a) * 0.16);
  }
  return g;
}

export function makeCrates({ count = 3, produce = false, seed = 1 } = {}) {
  const g = group('delivery-crates');
  for (let i = 0; i < count; i++) {
    const x = (i % 2) * 0.65, y = Math.floor(i / 2) * 0.43;
    box(g, 0.56, 0.4, 0.46, C.wood, x, y + 0.2, 0);
    for (let row = 0; row < 3; row++) box(g, 0.58, 0.065, 0.025, '#a38d6b', x, y + 0.08 + row * 0.12, 0.24);
    for (const s of [-1, 1]) box(g, 0.035, 0.42, 0.03, '#5c4937', x + s * 0.2, y + 0.2, 0.255);
    if (produce && i >= count - 2) for (let j = 0; j < 6; j++) sphere(g, 0.075, (j + seed) % 2 ? '#ce9845' : '#98a46b', x + (j % 3 - 1) * 0.14, y + 0.43, (Math.floor(j / 3) - 0.5) * 0.14);
  }
  footprint(g, 0.65 * Math.min(2, count), 0.48, count > 1 ? 0.32 : 0, 0);
  return g;
}

export function makeWaterContainer({ kind = 'pot' } = {}) {
  const g = group('water-container');
  if (kind === 'tank') {
    cylinder(g, 0.46, 0.46, 0.72, '#3b4c57', 0, 0.36, 0, 14);
    for (const y of [0.17, 0.4, 0.63]) cylinder(g, 0.475, 0.475, 0.035, '#556774', 0, y, 0, 14);
    cylinder(g, 0.43, 0.49, 0.055, C.timber, 0, 0.75, 0, 14);
  } else if (kind === 'drum') {
    cylinder(g, 0.28, 0.28, 0.72, '#446978', 0, 0.36, 0);
    for (const y of [0.07, 0.65]) cylinder(g, 0.29, 0.29, 0.035, C.timber, 0, y, 0);
  } else {
    sphere(g, 0.24, '#b48660', 0, 0.26, 0, [1, 1.15, 1]);
    cylinder(g, 0.1, 0.12, 0.16, '#b48660', 0, 0.52, 0);
    cylinder(g, 0.12, 0.12, 0.035, '#cd9d74', 0, 0.62, 0);
  }
  return g;
}

export function makeChaiStall({ seed = 1, canopy = true } = {}) {
  const g = group('chai-stall'); footprint(g, 2.3, 1.1);
  box(g, 2.15, 0.66, 0.83, C.indigo, 0, 0.58, 0);
  for (const x of [-0.95, 0.95]) box(g, 0.1, 0.46, 0.7, C.timber, x, 0.23, 0);
  box(g, 2.3, 0.095, 1.0, C.wood, 0, 0.97, 0);
  const kettle = cylinder(g, 0.18, 0.23, 0.25, '#9caeaf', -0.62, 1.19, 0.03);
  cylinder(g, 0.14, 0.2, 0.035, C.timber, -0.62, 1.34, 0.03);
  beam(g, [-0.47, 1.19, 0.03], [-0.33, 1.3, 0.03], 0.04, '#9caeaf');
  const handle = mesh(g, new THREE.TorusGeometry(0.13, 0.025, 6, 12, Math.PI * 1.5), C.timber, [-0.76, 1.25, 0.03]); handle.rotation.y = Math.PI / 2;
  cylinder(g, 0.19, 0.22, 0.085, flat('#e8984a'), -0.62, 1.035, 0.03);
  for (let i = 0; i < 6; i++) cylinder(g, 0.047, 0.035, 0.1, '#bf9d68', -0.05 + i * 0.145, 1.075, 0.25);
  cylinder(g, 0.12, 0.12, 0.3, '#c6ab74', 0.75, 1.17, -0.23);
  for (const x of [-0.94, 0.94]) {
    cylinder(g, 0.035, 0.045, canopy ? 2.6 : 1.7, C.wood, x, canopy ? 1.3 : 0.85, -0.36, 6);
  }
  if (canopy) {
    const top = box(g, 2.65, 0.06, 1.58, '#8b8f7c', 0, 2.64, -0.05); top.rotation.x = 0.09;
    const fascia = textSign({ text: 'गर्म चाय', sub: 'CHAI · ₹10', w: 1.7, h: 0.48, bg: C.indigo }); fascia.position.set(0, 2.29, 0.74); g.add(fascia);
  }
  const label = textSign({ text: 'चाय', sub: 'EST. 1968', w: 0.8, h: 0.43, bg: C.indigo }); label.position.set(0, 0.6, 0.424); g.add(label);
  const pool = lightPool(2.4, 0xffc68e, 0.08); pool.position.set(0, 0.045, 0.6); g.add(pool);
  // Steam is a tiny dynamic rig, retained when the rest of the stall batches.
  const steam = group('kettle-steam'); steam.userData.dynamic = true;
  for (let i = 0; i < 3; i++) {
    const m = sphere(steam, 0.11, new THREE.MeshBasicMaterial({ color: '#d2d6ca', transparent: true, opacity: 0.2, depthWrite: false }), -0.62, 1.45 + i * 0.27, 0.03, [1, 1.5, 1]);
    m.castShadow = m.receiveShadow = false;
  }
  steam.userData.update = (t) => steam.children.forEach((m, i) => {
    const life = (t * 0.3 + i / 3) % 1;
    m.position.set(-0.62 + Math.sin(life * 5 + seed) * life * 0.15, 1.44 + life * 1.25, 0.03);
    m.scale.setScalar(0.65 + life); m.material.opacity = (1 - life) * 0.22;
  });
  g.add(steam); kettle.name = 'chai-kettle'; return g;
}

export function makeStreetLamp({ h = 4.5, seed = 1, arm = 0.72 } = {}) {
  const g = group('street-lamp'); roundFootprint(g, 0.18);
  cylinder(g, 0.11, 0.18, 0.38, C.stoneDark, 0, 0.19, 0);
  cylinder(g, 0.045, 0.078, h - 0.3, C.timber, 0, (h + 0.3) / 2, 0, 8);
  beam(g, [0, h - 0.12, 0], [arm * 0.45, h + 0.14, 0], 0.035, C.timber);
  beam(g, [arm * 0.45, h + 0.14, 0], [arm, h - 0.03, 0], 0.035, C.timber);
  cylinder(g, 0.02, 0.23, 0.16, C.timber, arm, h - 0.06, 0);
  sphere(g, 0.115, flat(seed % 4 ? C.warm : '#e8be83'), arm, h - 0.16, 0, [1, 0.5, 1]);
  const pool = lightPool(h * 0.56, 0xffc98a, 0.075); pool.position.set(arm, 0.04, 0); g.add(pool);
  return g;
}

function tire(g, x, y, z, r = 0.25, thickness = 0.09) {
  const wheel = cylinder(g, r, r, thickness, C.ink, x, y, z, 14); wheel.rotation.z = Math.PI / 2;
  for (const side of [-1, 1]) {
    const hub = cylinder(g, r * 0.56, r * 0.56, 0.012, '#9baba8', x + side * thickness * 0.52, y, z, 12); hub.rotation.z = Math.PI / 2;
  }
  return wheel;
}
export function makeScooter({ color = '#86969e', seed = 1 } = {}) {
  const g = group('parked-scooter'); footprint(g, 0.68, 1.65);
  for (const z of [-0.52, 0.53]) tire(g, 0, 0.25, z);
  box(g, 0.4, 0.24, 0.68, color, 0, 0.56, -0.3);
  sphere(g, 0.24, color, 0, 0.48, -0.35, [1, 1, 1.65]);
  box(g, 0.45, 0.11, 0.63, C.timber, 0, 0.82, -0.28);
  box(g, 0.42, 0.07, 0.63, '#adada0', 0, 0.33, 0.1);
  const shield = box(g, 0.46, 0.63, 0.15, color, 0, 0.66, 0.39); shield.rotation.x = -0.13;
  cylinder(g, 0.044, 0.05, 0.49, '#73898d', 0, 0.6, 0.51, 6);
  beam(g, [-0.3, 1.04, 0.46], [0.3, 1.04, 0.46], 0.026, C.timber);
  sphere(g, 0.11, color, 0, 0.96, 0.48, [1.8, 1, 0.8]);
  plane(g, 0.16, 0.12, flat('#e4d8b9'), 0, 0.96, 0.576);
  for (const s of [-1, 1]) {
    beam(g, [s * 0.24, 1.04, 0.44], [s * 0.31, 1.25, 0.48], 0.014, '#9aa8a8');
    sphere(g, 0.065, '#758b97', s * 0.31, 1.27, 0.48, [1, 0.75, 0.24]);
  }
  box(g, 0.09, 0.05, 0.025, flat('#b16453'), 0, 0.61, -0.675);
  beam(g, [-0.05, 0.38, -0.08], [-0.25, 0.03, 0.04], 0.02, C.timber);
  return g;
}

export function makeBicycle({ color = C.green, basket = false, seed = 1 } = {}) {
  const g = group('parked-bicycle'); footprint(g, 0.55, 1.6);
  for (const z of [-0.55, 0.55]) {
    const rim = mesh(g, new THREE.TorusGeometry(0.32, 0.022, 6, 24), '#a5aaa0', [0, 0.32, z]); rim.rotation.y = Math.PI / 2;
    const rubber = mesh(g, new THREE.TorusGeometry(0.34, 0.022, 6, 24), C.ink, [0, 0.32, z]); rubber.rotation.y = Math.PI / 2;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4; beam(g, [0, 0.32, z], [0, 0.32 + Math.cos(a) * 0.31, z + Math.sin(a) * 0.31], 0.005, '#9caaa7', 4);
    }
  }
  for (const [a, b] of [
    [[0, 0.32, -0.55], [0, 0.77, -0.15]], [[0, 0.77, -0.15], [0, 0.32, -0.06]],
    [[0, 0.32, -0.06], [0, 0.32, -0.55]], [[0, 0.32, -0.06], [0, 0.83, 0.34]],
    [[0, 0.83, 0.34], [0, 0.77, -0.15]], [[0, 0.83, 0.34], [0, 0.32, 0.55]],
  ]) beam(g, a, b, 0.019, color);
  box(g, 0.21, 0.055, 0.26, C.timber, 0, 0.82, -0.2);
  beam(g, [0, 0.82, 0.34], [0, 1.02, 0.38], 0.022, '#a9ada4');
  beam(g, [-0.23, 1.01, 0.42], [0.23, 1.01, 0.42], 0.02, C.timber);
  beam(g, [-0.2, 0.32, -0.05], [0.2, 0.32, -0.05], 0.015, C.timber);
  box(g, 0.28, 0.04, 0.49, '#9daaa6', 0, 0.7, -0.57);
  if (basket) box(g, 0.38, 0.25, 0.3, '#9b8767', 0, 0.88, 0.63);
  beam(g, [0, 0.34, -0.2], [-0.24, 0.03, -0.26], 0.017, C.timber);
  return g;
}

export function makeRickshaw({ color = C.green, seed = 1 } = {}) {
  const g = group('station-rickshaw'); footprint(g, 1.35, 2.4);
  for (const [x, z] of [[-0.64, -0.6], [0.64, -0.6], [0, 0.95]]) tire(g, x, 0.29, z, 0.28, 0.15);
  box(g, 1.17, 0.38, 1.6, color, 0, 0.52, -0.22);
  box(g, 1.12, 0.4, 0.12, color, 0, 0.95, -0.95);
  for (const s of [-1, 1]) box(g, 0.09, 0.4, 1.05, color, s * 0.59, 0.89, -0.5);
  box(g, 1.04, 0.14, 0.4, C.timber, 0, 0.83, -0.56);
  box(g, 1.03, 0.37, 0.12, C.timber, 0, 1.05, -0.76);
  box(g, 0.85, 0.62, 0.32, color, 0, 0.81, 0.87);
  for (const [x, z] of [[-0.56, -0.93], [0.56, -0.93], [-0.48, 0.7], [0.48, 0.7]]) beam(g, [x, 0.91, z], [x * 0.91, 1.86, z - 0.1], 0.035, C.timber);
  const roof = box(g, 1.3, 0.12, 1.93, '#b19e6f', 0, 1.89, -0.18); roof.rotation.x = 0.025;
  box(g, 0.95, 0.08, 0.12, C.timber, 0, 1.25, 0.91);
  plane(g, 0.87, 0.56, new THREE.MeshBasicMaterial({ color: '#526d79', transparent: true, opacity: 0.58, side: THREE.DoubleSide }), 0, 1.53, 0.79);
  for (const x of [-0.25, 0.25]) plane(g, 0.16, 0.11, flat('#dfce9c'), x, 0.95, 1.035);
  const plate = textSign({ text: 'चंदपुर', sub: `UK 08 · ${2180 + seed}`, w: 0.6, h: 0.19, bg: '#c5b86a', fg: '#24343d' }); plate.position.set(0, 0.65, 1.04); g.add(plate);
  return g;
}

export function makeStreetSign({ labels = ['बाज़ार / BAZAAR', 'घाट / RIVER'], directions = [1, 1], h = 2.55 } = {}) {
  const g = group('wayfinding-sign'); roundFootprint(g, 0.14);
  cylinder(g, 0.04, 0.065, h, C.timber, 0, h / 2, 0, 6);
  labels.forEach((label, i) => {
    const s = textSign({ text: `${directions[i] > 0 ? '→' : '←'} ${label}`, w: 1.85, h: 0.38, bg: C.green, fg: '#e5dac0' });
    s.position.set(directions[i] * 0.27, h - 0.16 - i * 0.47, 0.07); g.add(s);
    const back = s.clone(); back.rotation.y = Math.PI; back.position.z = 0.035; g.add(back);
  });
  return g;
}

export function makeTree({ species = 'peepal', h = 6.6, spread = 2.5, seed = 1 } = {}) {
  const g = group(`${species}-tree`); roundFootprint(g, species === 'peepal' ? 0.43 : 0.26);
  const rnd = seeded(seed);
  const trunkH = species === 'pine' ? h * 0.65 : h * 0.52;
  beam(g, [0, 0, 0], [0.13, trunkH, 0], species === 'peepal' ? 0.19 : 0.12, C.wood, 10);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + seed;
    beam(g, [0, 0.1, 0], [Math.cos(a) * 0.55, 0.04, Math.sin(a) * 0.55], 0.08, C.wood, 8);
  }
  const foliage = toonMaterial(0xffffff, { vertexColors: true, paint: 0.025 });
  if (species === 'pine') {
    for (let i = 0; i < 5; i++) {
      const m = mesh(g, new THREE.ConeGeometry(spread * (1 - i * 0.15), h * 0.32, 11), '#2f7a4a', [0.12, h * 0.38 + i * h * 0.115, 0]);
      m.receiveShadow = false;
    }
  } else {
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI * 2 / 3 + seed, r = i === 0 ? 0 : spread * 0.45;
      const geo = shrubGeometry({ rx: spread * (i ? 0.72 : 0.92), ry: (h - trunkH) * 0.52, rz: spread * (i ? 0.68 : 0.9),
        seed: 41 + seed % 3 + i, spacing: 0.25, maxDetail: 7, puffAmp: 0.35, colors: { top: '#a8de6a', mid: '#4fa24a', base: '#2a6b3c' } });
      const m = mesh(g, geo, foliage, [Math.cos(a) * r, trunkH - 0.5 + (i % 2) * 0.85, Math.sin(a) * r]); m.receiveShadow = false;
      if (i) beam(g, [0.12, trunkH * 0.65, 0], [Math.cos(a) * r, trunkH + 0.1, Math.sin(a) * r], 0.075, C.wood, 8);
    }
  }
  return g;
}

export function makeShrub({ w = 1.2, h = 0.7, seed = 1 } = {}) {
  const g = group('shrub');
  const geo = shrubGeometry({ rx: w / 2, ry: h * 0.65, rz: w * 0.44, seed: 101 + seed % 3, maxDetail: 5, spacing: 0.2,
    colors: { top: '#9bd462', mid: '#4f9a48', base: '#2c6538' } });
  mesh(g, geo, toonMaterial(0xffffff, { vertexColors: true })); return g;
}

export function makeFlowerPatch({ w = 2.0, d = 0.8, seed = 1 } = {}) {
  const g = group('marigold-bed');
  box(g, w, 0.09, d, '#596349', 0, 0.025, 0);
  const rnd = seeded(seed);
  // Cultivated rows tied to a bed, not object scatter.
  for (let i = 0; i < Math.floor(w / 0.26); i++) for (let j = 0; j < 2; j++) {
    const x = -w / 2 + 0.18 + i * 0.26, z = (j - 0.5) * d * 0.55, y = 0.22 + rnd() * 0.12;
    beam(g, [x, 0.02, z], [x, y, z], 0.012, '#527a48', 4);
    sphere(g, 0.072, j % 2 ? '#d6ab53' : C.marigold, x, y, z);
  }
  return g;
}

export function makeBench({ w = 1.8, stone = false } = {}) {
  const g = group('resting-bench'); footprint(g, w, 0.54);
  for (const x of [-w * 0.37, w * 0.37]) box(g, 0.12, 0.45, 0.45, stone ? C.stoneDark : C.timber, x, 0.22, 0);
  for (let i = 0; i < 3; i++) box(g, w, 0.08, 0.12, stone ? C.stone : '#9b8160', 0, 0.47, -0.17 + i * 0.17);
  for (const x of [-w * 0.37, w * 0.37]) beam(g, [x, 0.38, -0.16], [x, 0.93, -0.26], 0.04, C.timber);
  for (const y of [0.69, 0.9]) box(g, w, 0.12, 0.045, '#9b8160', 0, y, -0.24);
  return g;
}

export function makeTemple({ small = false, seed = 1 } = {}) {
  const g = group(small ? 'wayside-shrine' : 'hill-temple');
  const scale = small ? 0.3 : 1;
  const body = group('temple-body'); footprint(body, 3.8, 3.8);
  stoneBase(body, 4.1, 4.0, 0.38, seed);
  box(body, 3.5, 2.5, 3.4, '#e0d4b4', 0, 1.63, -0.2);
  box(body, 3.65, 0.17, 3.55, C.red, 0, 2.8, -0.2);
  box(body, 1.45, 2.0, 0.06, flat('#433c37'), 0, 1.44, 1.53);
  for (const s of [-1, 1]) box(body, 0.15, 2.15, 0.14, C.red, s * 0.8, 1.43, 1.58);
  box(body, 1.8, 0.2, 0.18, C.red, 0, 2.5, 1.58);
  // A restrained North Indian shikhara. Local stone and limewash continue
  // the town, without a palace/chhatri or Himalayan pagoda grafted onto it.
  for (let i = 0; i < 7; i++) {
    const base = 2.45 - i * 0.24, top = base - 0.2;
    const tower = cylinder(body, top / Math.sqrt(2), base / Math.sqrt(2), 0.56, '#d8ccad', 0, 3.11 + i * 0.49, -0.3, 4);
    tower.rotation.y = Math.PI / 4;
    box(body, base + 0.08, 0.09, base + 0.08, i % 3 === 0 ? C.red : '#b5ab91', 0, 3.35 + i * 0.49, -0.3);
  }
  cylinder(body, 0.6, 0.65, 0.17, C.stone, 0, 6.65, -0.3, 12);
  sphere(body, 0.22, C.brass, 0, 6.95, -0.3, [0.8, 1.2, 0.8]);
  cylinder(body, 0.015, 0.025, 1.3, C.brass, 0, 7.5, -0.3, 6);
  const flag = plane(body, 0.62, 0.36, toonMaterial(C.red, { side: THREE.DoubleSide }), 0.3, 7.99, -0.3); flag.rotation.y = -0.3;
  if (!small) {
    // Walk-through bell porch is an actual frame, with no invisible full
    // building collider spanning the approach.
    for (const [x, z] of [[-1.8, 1.95], [1.8, 1.95], [-1.8, 4.0], [1.8, 4.0]]) {
      cylinder(body, 0.11, 0.14, 2.7, '#b9b399', x, 1.52, z, 8); roundFootprint(body, 0.16, x, z);
    }
    const roof = makeSlateRoof({ w: 4.5, d: 2.8, rise: 0.9, seed }); roof.position.set(0, 2.88, 3.0); body.add(roof);
    cylinder(body, 0.015, 0.015, 0.45, C.brass, 0, 2.64, 3.0, 6);
    cylinder(body, 0.045, 0.16, 0.2, C.brass, 0, 2.31, 3.0, 12);
    const garland = marigoldToran({ w: 2.65, count: 17 }); garland.position.set(0, 2.5, 4.06); body.add(garland);
    const sign = textSign({ text: 'देवस्थान', sub: 'PLEASE LEAVE SHOES HERE', w: 2.4, h: 0.55, bg: C.red }); sign.position.set(0, 2.76, 4.43); body.add(sign);
    for (const x of [-0.75, -0.4, 0.45, 0.8]) {
      const shoe = sphere(body, 0.11, C.wood, x, 0.13, 4.0, [0.75, 0.42, 1.5]); shoe.name = 'shrine-shoes';
    }
  }
  for (const x of [-0.42, 0.42]) { const d = diya(); d.group.position.set(x, 0.43, 1.85); body.add(d.group); }
  const pot = makeWaterContainer(); pot.position.set(1.25, 0.08, 2); body.add(pot);
  body.scale.setScalar(scale); g.add(body); return g;
}

export function makeGhat() {
  const g = group('river-ghat');
  for (let i = 0; i < GHAT.count; i++) {
    const y = -0.15 - i * GHAT.stepH;
    box(g, GHAT.x1 - GHAT.x0, 1.3 + y, GHAT.stepD + 0.025, i % 2 ? '#969d91' : '#858e86',
      (GHAT.x0 + GHAT.x1) / 2, y - (1.3 + y) / 2, GHAT.z0 + (i + 0.5) * GHAT.stepD, 'ghat-tread');
    box(g, GHAT.x1 - GHAT.x0, 0.035, 0.09, '#a6ad9b', (GHAT.x0 + GHAT.x1) / 2, y + 0.015, GHAT.z0 + (i + 1) * GHAT.stepD - 0.04);
  }
  for (const x of [GHAT.x0 - 0.28, GHAT.x1 + 0.28]) {
    box(g, 0.45, 1.2, 4.6, C.stoneDark, x, -0.44, GHAT.z0 + 2.1);
    for (let i = 0; i < 6; i++) box(g, 0.51, 0.15, 0.69, C.stone, x, -0.06 - i * 0.12, GHAT.z0 + (i + 0.5) * 0.7);
  }
  return g;
}

export function makeBridge() {
  const g = group('stone-footbridge');
  const points = [];
  for (let i = 0; i <= 42; i++) {
    const z = BRIDGE.z0 + (BRIDGE.z1 - BRIDGE.z0) * i / 42;
    points.push([BRIDGE.x, bridgeDeckY(BRIDGE.x, z), z]);
  }
  ribbon(g, points, BRIDGE.halfW * 2, '#9eaa9d', { height: null, name: 'bridge-deck' });
  // A continuous swept arch has a visible underside and connects the deck
  // to its piers. A ribbon and isolated pier boxes alone would float.
  const archVertices = [], archIndices = [];
  for (let i = 0; i < points.length; i++) {
    const [x, y, z] = points[i];
    archVertices.push(x - BRIDGE.halfW, y - 0.06, z, x + BRIDGE.halfW, y - 0.06, z,
      x - BRIDGE.halfW, y - 0.5, z, x + BRIDGE.halfW, y - 0.5, z);
    if (i < points.length - 1) {
      const k = i * 4;
      archIndices.push(k, k + 4, k + 1, k + 1, k + 4, k + 5,
        k + 2, k + 3, k + 6, k + 3, k + 7, k + 6,
        k, k + 2, k + 4, k + 2, k + 6, k + 4,
        k + 1, k + 5, k + 3, k + 3, k + 5, k + 7);
    }
  }
  const archGeo = new THREE.BufferGeometry(); archGeo.setAttribute('position', new THREE.Float32BufferAttribute(archVertices, 3));
  archGeo.setIndex(archIndices); archGeo.computeVertexNormals(); mesh(g, archGeo, C.stoneDark, [0, 0, 0], 'masonry-bridge-arch');
  for (const side of [-1, 1]) {
    const x = BRIDGE.x + side * (BRIDGE.halfW + 0.17), verts = [], idx = [];
    for (let i = 0; i < points.length; i++) {
      const [, y, z] = points[i];
      verts.push(x, y - 0.42, z, x, y + 0.75, z);
      if (i < points.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    mesh(g, geo, toonMaterial(C.stoneDark, { side: THREE.DoubleSide }));
    ribbon(g, points.map(([px, y, z]) => [px + side * (BRIDGE.halfW + 0.17), y + 0.77, z]), 0.33, C.stone, { height: null, name: 'bridge-coping' });
    // Narrow collider, not the AABB of the whole sloping bridge.
    footprint(g, 0.26, BRIDGE.z1 - BRIDGE.z0, x, (BRIDGE.z0 + BRIDGE.z1) / 2);
    for (let i = 0; i < 19; i++) {
      const z = BRIDGE.z0 + (i + 0.5) * (BRIDGE.z1 - BRIDGE.z0) / 19, y = bridgeDeckY(BRIDGE.x, z);
      box(g, 0.027, 0.026, 0.76, '#adb09e', x - side * 0.14, y + 0.25, z);
    }
  }
  for (const z of [53.0, 64.2]) {
    const top = bridgeDeckY(BRIDGE.x, z) - 0.45, bottom = -2.3;
    box(g, 3.8, top - bottom, 1.35, C.stoneDark, BRIDGE.x, (top + bottom) / 2, z);
    box(g, 3.9, 0.14, 1.55, C.stone, BRIDGE.x, top - 0.01, z);
  }
  return g;
}

export function makeRailwayStation({ seed = 1 } = {}) {
  const g = group('old-railway-station');
  // Two wings leave a genuine open central passage to the platform.
  for (const side of [-1, 1]) {
    const wing = buildingShell({ w: 6.9, d: 4.6, h: 3.65, wall: C.ochre, trim: C.red, seed: seed + (side > 0 ? 1 : 0), roof: false });
    wing.position.set(side * 4.95, 0, -0.35); g.add(wing);
    for (const wx of [-1.8, 1.65]) {
      const win = makeWindow({ w: 1.35, h: 1.5, lit: wx < 0 || side > 0, shutter: C.red, bars: true }); win.position.set(wx, 2.0, 2.33); wing.add(win);
    }
    const label = textSign({ text: side < 0 ? 'टिकट घर' : 'प्रतीक्षालय', sub: side < 0 ? 'TICKETS' : 'WAITING ROOM', w: 2.3, h: 0.42, bg: C.red }); label.position.set(0, 3.16, 2.33); wing.add(label);
  }
  const roof = makeSlateRoof({ w: 19.2, d: 8.2, rise: 1.7, seed }); roof.position.set(0, 3.76, -0.6); g.add(roof);
  for (const x of [-8.5, -5.5, -2.5, 2.5, 5.5, 8.5]) {
    box(g, 0.16, 3.45, 0.16, C.red, x, 1.72, 3.22); roundFootprint(g, 0.16, x, 3.22);
    beam(g, [x, 2.82, 3.22], [x + 0.45, 3.43, 3.22], 0.055, C.red);
    beam(g, [x, 2.82, 3.22], [x - 0.45, 3.43, 3.22], 0.055, C.red);
  }
  box(g, 18.2, 0.22, 0.18, C.red, 0, 3.4, 3.22);
  const name = textSign({ text: 'चंदपुर', sub: 'CHANDPUR · 642 m', w: 3.25, h: 0.91, bg: '#d4b85e', fg: '#27353b', accent: '#27353b' }); name.position.set(0, 3.05, 3.36); g.add(name);
  // Clock remains visible from the return lane and upper terraces.
  box(g, 1.35, 2.1, 1.35, C.ochre, -4.65, 6.2, -0.62, 'station-clock-tower');
  const clockTex = makeCanvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#e9dfc5'; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#47505a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(64, 64, 54, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ctx.beginPath(); ctx.moveTo(64 + Math.sin(a) * 44, 64 + Math.cos(a) * 44); ctx.lineTo(64 + Math.sin(a) * 49, 64 + Math.cos(a) * 49); ctx.stroke(); }
    ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(56, 30); ctx.moveTo(64, 64); ctx.lineTo(93, 54); ctx.stroke();
  });
  for (let i = 0; i < 4; i++) {
    const clock = plane(g, 1.08, 1.08, new THREE.MeshBasicMaterial({ map: clockTex }), -4.65, 6.62, -0.62); clock.rotation.y = i * Math.PI / 2;
    clock.position.x += Math.sin(i * Math.PI / 2) * 0.685; clock.position.z += Math.cos(i * Math.PI / 2) * 0.685;
  }
  const cap = makeSlateRoof({ w: 1.65, d: 1.65, rise: 0.55, seed }); cap.position.set(-4.65, 7.28, -0.62); g.add(cap);
  for (const x of [-6.4, 6.4]) { const pool = lightPool(3.6, 0xffc38a, 0.065); pool.position.set(x, 0.04, 3.1); g.add(pool); }
  return g;
}

export function makeBalloonStation({ upper = false } = {}) {
  const g = group('balloon-landing');
  box(g, 7.5, 0.18, 6.2, '#938267', 0, -0.1, 0);
  for (let i = 0; i < 18; i++) box(g, 7.35, 0.035, 0.027, '#65553e', 0, 0.008, -3 + i * 0.34);
  // No perimeter wall across the boarding/exit side.
  for (const [x, z] of [[-3.4, -2.7], [3.4, -2.7], [-3.4, 2.7], [3.4, 2.7]]) {
    cylinder(g, 0.07, 0.09, 0.7, C.wood, x, 0.35, z, 8); roundFootprint(g, 0.1, x, z);
  }
  const shed = group('flight-shed'); footprint(shed, 2.5, 2.2);
  box(shed, 2.4, 2.15, 2.1, C.sage, 0, 1.075, 0);
  const roof = makeSlateRoof({ w: 3, d: 2.7, rise: 0.7 }); roof.position.y = 2.2; shed.add(roof);
  const win = makeWindow({ w: 1.0, h: 0.9, lit: true }); win.position.set(0, 1.36, 1.08); shed.add(win);
  const board = textSign({ text: 'गुब्बारा पड़ाव', sub: upper ? 'FORT SHOULDER · RETURN FLIGHT' : 'RIVER MEADOW · SCENIC FLIGHT', w: 2.25, h: 0.63, bg: C.indigo }); board.position.set(0, 2.12, 1.13); shed.add(board);
  shed.position.set(upper ? -5.6 : -5.1, 0, upper ? -4.0 : 3.4); g.add(shed);
  cylinder(g, 0.035, 0.05, 4.3, C.timber, 4.5, 2.15, 1.5, 6); roundFootprint(g, 0.12, 4.5, 1.5);
  const sock = cylinder(g, 0.07, 0.22, 0.9, C.red, 4.85, 4.05, 1.5, 10); sock.rotation.z = -1.22;
  for (let i = 0; i < 3; i++) {
    const fuel = cylinder(g, 0.16, 0.16, 0.65, '#7b7f72', -3.8, 0.33, -2.4 + i * 0.38); fuel.name = 'flight-fuel';
    cylinder(g, 0.05, 0.05, 0.1, C.brass, -3.8, 0.72, -2.4 + i * 0.38, 6);
  }
  for (let i = 0; i < 3; i++) {
    const coil = mesh(g, new THREE.TorusGeometry(0.25 - i * 0.044, 0.013, 5, 24), '#b2a17f', [2.6, 0.04 + i * 0.014, 2.3]); coil.rotation.x = Math.PI / 2;
  }
  const instruction = textSign({ text: 'E · बैठें / BOARD', sub: 'THE PATH ALSO CONTINUES ON FOOT', w: 1.75, h: 0.48, bg: C.green }); instruction.position.set(2.65, 0.95, -2.5); g.add(instruction);
  cylinder(g, 0.03, 0.04, 0.8, C.wood, 2.65, 0.4, -2.55, 6);
  return g;
}

export function makeLuggageTrolley() {
  const g = group('luggage-trolley'); footprint(g, 1.15, 1.7);
  box(g, 1.0, 0.1, 1.65, '#8c927d', 0, 0.33, 0);
  for (const [x, z] of [[-0.46, -0.55], [0.46, -0.55], [-0.46, 0.55], [0.46, 0.55]]) tire(g, x, 0.18, z, 0.16, 0.06);
  for (const x of [-0.46, 0.46]) beam(g, [x, 0.36, -0.77], [x, 1.1, -0.77], 0.026, C.timber);
  beam(g, [-0.46, 1.1, -0.77], [0.46, 1.1, -0.77], 0.03, C.timber);
  for (let i = 0; i < 3; i++) {
    const suitcase = box(g, 0.65, 0.35, 0.45, i % 2 ? '#8f7964' : C.red, i % 2 * 0.16, 0.58 + i * 0.25, (i - 1) * 0.18);
    for (const x of [-0.2, 0.2]) box(g, 0.035, 0.35, 0.46, C.timber, suitcase.position.x + x, suitcase.position.y, suitcase.position.z);
  }
  return g;
}

export function makeRiverBoat() {
  const g = group('local-rowboat');
  const shape = new THREE.Shape(); shape.moveTo(0, 1.6); shape.quadraticCurveTo(0.78, 0.8, 0.54, -1.2);
  shape.quadraticCurveTo(0, -1.85, -0.54, -1.2); shape.quadraticCurveTo(-0.78, 0.8, 0, 1.6);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.23, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1, steps: 1, curveSegments: 8 });
  geo.rotateX(-Math.PI / 2); mesh(g, geo, C.wood, [0, 0.03, 0]);
  const inside = mesh(g, new THREE.ShapeGeometry(shape), '#594c3e', [0, 0.27, 0]); inside.rotation.x = -Math.PI / 2; inside.scale.set(0.86, 0.86, 1);
  for (const z of [-0.6, 0.5]) box(g, 1.1, 0.08, 0.23, '#a38b69', 0, 0.37, z);
  beam(g, [-0.45, 0.41, -0.8], [0.43, 0.42, 1.05], 0.025, '#b09b77');
  box(g, 0.14, 0.025, 0.48, '#b09b77', 0.39, 0.43, 1.0).rotation.y = 0.42;
  return g;
}
