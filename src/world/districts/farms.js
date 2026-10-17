import * as THREE from 'three';
import { toonMaterial } from '../../core/toon.js';
import { FARM_PLOTS, FARMSTEAD, PADDY_FARMSTEAD, POND, plotLevel, groundHeight, surfaceY, pathAt, ROUTES } from '../layout.js';
import { LOCAL as C, group, box, cylinder, sphere, beam, place, seeded, flat } from '../build-kit.js';
import { makeTree, makeShrub, makeStreetSign, makeBench } from '../generators.js';
import { textSign, rangoli } from '../props.js';
import {
  instanceCrop, breeze, makeFarmhouse, makeCattleShed, makeHaystack, makeCharpai, makeHandpump, makeWell, makeTractor,
  makeBullockCart, makeBovine, makeScarecrow, makeBanyan, makeMangoTree, makeCoconutPalm, makeMachan, makeJhoola,
  makeBunting, makeKite, makeClothesline, makeMatkas, makeTubewell, makeWaysideShrine, makeLotusPond, makeEgret,
} from '../farm-kit.js';

// Chandpur's farmland: the mustard-and-wheat patchwork east of the station,
// flooded paddy terraces beyond the railway workers' lane, and a mango
// orchard across the river. Interaction points are exported in `spots`.

const CROP = {
  wheat: { parts: [['wheat', 0.06, ['#ffffff', '#f4e6c0', '#fff2d0']]], dx: 0.34, dz: 0.3, scale: [0.9, 1.15] },
  mustard: { parts: [['mustard', 0.07, ['#ffffff', '#f2ffd8', '#fff6c8']]], dx: 0.42, dz: 0.38, scale: [0.95, 1.25] },
  sugarcane: { parts: [['sugarcane', 0.025, ['#ffffff', '#e8f2c8']]], dx: 0.7, dz: 0.55, scale: [0.85, 1.1] },
  marigold: { parts: [['marigold-bush', 0.03, ['#ffffff', '#e0f0c8']], ['marigold-flowers', 0.03, ['#ff8c1a', '#ffb000', '#ff6a00', '#ffd000']]], dx: 0.6, dz: 0.55, scale: [0.9, 1.15] },
  vegetable: { parts: [['cabbage', 0.0, ['#ffffff', '#e6f6c8', '#d8f0b8']]], dx: 0.6, dz: 0.7, scale: [0.85, 1.15], ridges: true },
  paddy: { parts: [['rice', 0.05, ['#ffffff', '#e8ffd0']]], dx: 0.36, dz: 0.36, scale: [0.9, 1.15], water: true },
  'paddy-young': { parts: [['rice-young', 0.04, ['#ffffff', '#f0ffe0']]], dx: 0.5, dz: 0.5, scale: [0.85, 1.1], water: true },
};

export function buildFarms(root) {
  const g = group('district-farms'); g.userData.district = 'farms';
  const crops = group('crops'); crops.userData.dynamic = true; g.add(crops);
  const spots = { marigolds: [], mangoes: [], rest: [], npcs: {} };
  const byKind = new Map();
  // one instanced batch per crop part and field block, so whole blocks cull
  const push = (kind, amp, tints, rec) => {
    const key = `${kind}|${rec[0] > 0 ? 'east' : 'west'}|${rec[2] > 18 ? 's' : 'n'}`;
    if (!byKind.has(key)) byKind.set(key, { kind, amp, tints, list: [] });
    byKind.get(key).list.push(rec);
  };
  const rnd = seeded(2024);
  const nearRoute = (x, z, pad) => ROUTES.some((r) => pathAt(r.points, x, z).d < r.width / 2 + pad);
  for (const p of FARM_PLOTS) {
    const y = plotLevel(p), spec = CROP[p.crop];
    const inset = 0.55;
    // bunds (mendh): raised earth around every plot, grassy on top
    const bh = spec.water ? 0.32 : 0.2;
    const w = p.x1 - p.x0, d = p.z1 - p.z0, cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
    for (const [bx, bz, bw, bd] of [[cx, p.z0, w + 0.5, 0.5], [cx, p.z1, w + 0.5, 0.5], [p.x0, cz, 0.5, d], [p.x1, cz, 0.5, d]]) {
      box(g, bw, bh, bd, '#8a6440', bx, y + bh / 2 - 0.04, bz);
      box(g, bw + 0.02, 0.05, bd + 0.02, '#5a9a3a', bx, y + bh - 0.02, bz);
    }
    if (spec.water) {
      const water = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.4, d - 0.4), toonMaterial('#5fa9a8', { paint: 0.05 }));
      water.rotation.x = -Math.PI / 2; water.position.set(cx, y + 0.1, cz); water.receiveShadow = true; water.name = 'paddy-water'; g.add(water);
    }
    if (spec.ridges) for (let z = p.z0 + inset; z < p.z1 - inset; z += spec.dz) box(g, w - 1.0, 0.12, 0.34, '#7a5434', cx, y + 0.04, z);
    for (let x = p.x0 + inset + spec.dx / 2; x < p.x1 - inset; x += spec.dx) {
      for (let z = p.z0 + inset + spec.dz / 2; z < p.z1 - inset; z += spec.dz) {
        const jx = x + (rnd() - 0.5) * spec.dx * 0.35, jz = z + (rnd() - 0.5) * spec.dz * 0.3;
        if (nearRoute(jx, jz, 0.2)) continue;
        const s = spec.scale[0] + rnd() * (spec.scale[1] - spec.scale[0]);
        const yaw = rnd() * Math.PI * 2, ti = Math.floor(rnd() * 8);
        const base = spec.water ? y + 0.03 : y - 0.02;
        for (const [kind, amp, tints] of spec.parts) push(kind, amp, tints, [jx, base, jz, yaw, s, ti]);
      }
    }
    if (p.crop === 'marigold') spots.marigolds.push({ x0: p.x0 + 1, x1: p.x1 - 1, z0: p.z0 + 1, z1: p.z1 - 1, y });
  }
  for (const [key, { kind, amp, tints, list }] of byKind) instanceCrop(crops, kind, list, { amp, tints, name: `crop-${key}` });
  // a breeze for the whole valley
  crops.userData.update = (t) => { breeze.value = t; };

  buildEastFarmstead(g, spots);
  buildPaddyHomestead(g, spots);
  buildOrchard(g, spots);
  buildBanyanCourt(g, spots);
  root.add(g);
  g.userData.spots = spots;
  return g;
}

function buildEastFarmstead(g, spots) {
  const F = FARMSTEAD, y = F.y;
  const yard = group('farmstead-yard');
  // packed-earth courtyard, swept and edged with whitewashed stones
  box(yard, 15.2, 0.06, 15.4, '#c9a26a', F.x, y - 0.02, F.z);
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2;
    sphere(yard, 0.16, '#f2ece0', F.x + Math.cos(a) * 7.4, y + 0.05, F.z + Math.sin(a) * 7.4, [1, 0.6, 1]);
  }
  g.add(yard);
  const house = makeFarmhouse({ wall: '#d8945a', door: '#2f6db5', name: 'baldev-farmhouse' });
  place(g, house, 87.2, F.z, -Math.PI / 2, y);
  const r = rangoli({ r: 0.95, seed: 4 }); r.position.set(81.6, y + 0.06, F.z + 1.8); g.add(r);
  place(g, makeMatkas({ n: 3 }), 84.0, F.z - 2.4, Math.PI / 2, y + 0.12);
  place(g, makeCharpai({ name: 'farm-charpai' }), 83.6, F.z + 1.5, 0, y + 0.12);
  spots.rest.push({ id: 'farm-charpai', position: [83.6, y + 0.5, F.z + 1.5], label: 'Rest on the charpai until evening' });
  const shed = makeCattleShed({ name: 'farm-cattle-shed' });
  place(g, shed, 86.4, 13.4, -Math.PI / 2, y);
  const animals = [];
  for (const [x, z, yaw] of [[83.4, 13.9, -1.4], [83.6, 11.6, -1.8]]) {
    const b = makeBovine({ kind: 'buffalo', name: 'farm-buffalo' }); place(g, b.group, x, z, yaw, y); animals.push(b);
  }
  for (const [x, z, s] of [[77.6, 13.6, 1], [79.4, 1.0, 2], [75.4, 11.0, 3]]) place(g, makeHaystack({ r: 1.25 + s * 0.1, h: 2.3 + s * 0.15, seed: s }), x, z, 0, y);
  place(g, makeHandpump(), 80.2, 3.2, 0.3, y);
  place(g, makeWell(), 77.0, 5.6, 0, y);
  place(g, makeTractor({ name: 'farm-tractor' }), 74.6, -0.2, 0.5, y);
  const cart = makeBullockCart({ name: 'farm-bullock-cart' }); place(g, cart, 77.6, 9.6, -Math.PI / 2, y);
  for (const s of [-1, 1]) {
    const b = makeBovine({ kind: 'zebu', hornColor: s < 0 ? '#2f6db5' : '#e8781a', name: 'farm-bullock' });
    place(g, b.group, 77.6 - 2.9, 9.6 + s * 0.62, -Math.PI / 2, y); animals.push(b);
  }
  place(g, makeClothesline({ w: 4.2 }), 82.6, 0.4, 0, y);
  place(g, makeTubewell(), 73.4, 13.4, Math.PI / 2, y);
  // a field-water channel from the tubewell into the mustard
  box(g, 0.5, 0.05, 2.8, '#5fc0d8', 76.3, y + 0.0, 14.8).userData.dayVisible = true;
  for (const [from, to] of [[[84.4, y + 4.4, F.z - 3.4], [77.2, y + 2.6, -0.6]], [[84.4, y + 4.4, F.z + 3.4], [76.8, y + 2.4, 16.0]]]) g.add(makeBunting({ from, to, count: 13, sag: 0.5 }));
  cylinder(g, 0.05, 0.06, 2.8, '#a9874e', 77.2, y + 1.3, -0.6, 6); cylinder(g, 0.05, 0.06, 2.8, '#a9874e', 76.8, y + 1.3, 16.0, 6);
  const gate = textSign({ text: 'बलदेव फ़ार्म', sub: 'BALDEV FARM · SARSON FIELDS', w: 2.6, h: 0.6, bg: '#1f9a62' });
  gate.position.set(71.6, y + 2.6, F.z - 6.2); gate.rotation.y = -Math.PI / 2; g.add(gate);
  for (const z of [F.z - 7.4, F.z - 5.0]) cylinder(g, 0.07, 0.09, 3.0, '#7a5a32', 71.6, y + 1.5, z, 7);
  place(g, makeScarecrow({ shirt: '#d4321f' }), 63, 3.4, 0.4, plotLevel(FARM_PLOTS.find((p) => p.id === 'e6')));
  place(g, makeScarecrow({ shirt: '#2f6db5' }), 76, 25.2, -0.3, plotLevel(FARM_PLOTS.find((p) => p.id === 'e11')));
  place(g, makeStreetSign({ labels: ['खेत / FIELDS', 'स्टेशन / STATION'], directions: [1, -1] }), 45.5, -1.8, 0, 0);
  for (const [x, z, s] of [[92.0, -3.0, 1], [92.5, 12, 2], [92.2, 44.5, 3], [72, 44.5, 4], [50, 44.6, 5]]) place(g, makeMangoTree({ h: 5.0, spread: 2.6, seed: s, fruit: s % 2 === 0 }), x, z, s, groundHeight(x, z));
  for (const [x, z] of [[47, 45], [60, 45.5], [83, 45]]) place(g, makeCoconutPalm({ h: 6.5, seed: x }), x, z, x * 0.1, groundHeight(x, z));
  // kites over the mustard: Chotu flies one from the courtyard
  g.add(makeKite({ color: '#e8558a', color2: '#ffd000', anchor: [80.6, y + 1.3, 10.8], height: 16, offset: [-9, 0, 6] }));
  g.add(makeKite({ color: '#2f6db5', color2: '#ff8c1a', anchor: [55, 2, 18], height: 20, offset: [6, 0, -8] }));
  g.add(makeKite({ color: '#1f9a62', color2: '#ffffff', anchor: [20, 7, 30], height: 14, offset: [10, 0, 5] }));
  spots.npcs.baldev = { position: [82.0, y, F.z - 1.2], yaw: -Math.PI / 2 };
  spots.npcs.chotu = { position: [80.6, y, 10.8], yaw: -1.0 };
  const animTick = group('farm-animals'); animTick.userData.dynamic = true; g.add(animTick);
  animTick.userData.update = (t) => animals.forEach((a, i) => {
    a.neck.rotation.x = 0.1 + Math.sin(t * 0.4 + i * 1.7) * 0.12;
    a.head.rotation.y = Math.sin(t * 0.23 + i) * 0.25;
    a.tail.rotation.z = Math.sin(t * 1.1 + i) * 0.25;
  });
  animals.forEach((a) => { a.group.userData.dynamic = true; });
}

function buildPaddyHomestead(g, spots) {
  const F = PADDY_FARMSTEAD, y = F.y;
  box(g, 11.4, 0.06, 8.6, '#c9a26a', F.x, y - 0.02, F.z + 0.4);
  place(g, makeFarmhouse({ w: 5.4, d: 4.0, wall: '#e0a868', door: '#1f9a62', name: 'paddy-farmhouse', seed: 2 }), F.x + 0.6, F.z + 2.4, Math.PI, y);
  const r = rangoli({ r: 0.85, seed: 9 }); r.position.set(F.x + 0.2, y + 0.06, F.z - 2.2); g.add(r);
  place(g, makeHaystack({ r: 1.2, h: 2.2, color: '#d9b05a', seed: 5 }), F.x + 4.6, F.z - 2.4, 0, y);
  place(g, makeHaystack({ r: 1.0, h: 1.9, color: '#d9b05a', seed: 6 }), F.x - 4.6, F.z - 2.6, 0, y);
  place(g, makeCharpai({ name: 'paddy-charpai' }), F.x - 2.8, F.z - 1.0, Math.PI / 2, y);
  spots.rest.push({ id: 'paddy-charpai', position: [F.x - 2.8, y + 0.5, F.z - 1.0], label: 'Rest on the charpai until evening' });
  place(g, makeMatkas({ n: 4 }), F.x + 3.2, F.z + 0.1, 0, y);
  place(g, makeHandpump(), F.x - 4.9, F.z + 1.4, 1.2, y);
  place(g, makeClothesline({ w: 3.4, colors: ['#ffd000', '#d4321f', '#7a3fb0', '#28b7b0'] }), F.x + 4.2, F.z + 3.6, Math.PI / 2, y);
  place(g, makeWaysideShrine(), -46.0, 32.6, -0.4, groundHeight(-46, 32.6));
  place(g, makeLotusPond({ r: POND.r, waterY: -0.55 }), POND.x, POND.z, 0, 0);
  for (const [x, z, s] of [[-86.25, 9, 1], [-86.25, 22, 2], [-73.75, 12, 3], [-73.75, 24, 4], [-48.0, 31.6, 5], [-61.2, 33.8, 6],
    [-84.8, 44.0, 7], [-75.6, 47.0, 8], [-88.0, 31.0, 9], [-99.5, 18, 10], [-47.5, 9.0, 11], [-47.6, 21.0, 12]]) {
    place(g, makeCoconutPalm({ h: 6 + (s % 3) * 0.9, lean: 0.12 + (s % 4) * 0.05, seed: s }), x, z, s * 1.3, groundHeight(x, z));
  }
  const bananas = [];
  for (let i = 0; i < 14; i++) {
    const a = i * 0.45 + 2.6, rr = 6.2 + (i % 3) * 0.6;
    const x = F.x + Math.cos(a) * rr, z = F.z + 1 + Math.sin(a) * rr * 0.8;
    if (z < 31.6) continue;
    bananas.push([x, groundHeight(x, z), z, i, 0.9 + (i % 3) * 0.12, 0]);
  }
  instanceCrop(g, 'banana', bananas, { amp: 0.02, tints: ['#ffffff'], name: 'banana-grove', cast: true });
  const egrets = [];
  const rnd = seeded(9);
  for (const id of ['w2', 'w4', 'w6', 'w7', 'w1', 'w9']) {
    const p = FARM_PLOTS.find((q) => q.id === id);
    const e = makeEgret(); const x = p.x0 + 1.5 + rnd() * (p.x1 - p.x0 - 3), z = p.z0 + 1.5 + rnd() * (p.z1 - p.z0 - 3);
    e.group.scale.setScalar(1.6); place(g, e.group, x, z, rnd() * 6, plotLevel(p) + 0.05); egrets.push(e); e.group.userData.dynamic = true;
  }
  const tick = group('paddy-life'); tick.userData.dynamic = true; g.add(tick);
  tick.userData.update = (t) => egrets.forEach((e, i) => {
    const peck = Math.max(0, Math.sin(t * 0.9 + i * 2.3));
    e.neck.rotation.x = peck * peck * 1.1;
  });
  g.add(makeBunting({ from: [F.x - 2.0, y + 3.8, F.z + 0.4], to: [F.x - 6.2, y + 2.6, F.z - 3.6], count: 10, sag: 0.4 }));
  cylinder(g, 0.05, 0.06, 2.8, '#a9874e', F.x - 6.2, y + 1.3, F.z - 3.6, 6);
  g.add(makeKite({ color: '#ff8c1a', color2: '#2f6db5', anchor: [F.x + 1, y + 1.2, F.z - 3], height: 18, offset: [-12, 0, -6] }));
  const sign = textSign({ text: 'धान के खेत', sub: 'PADDY FIELDS · GANGA DEVI', w: 2.3, h: 0.55, bg: '#1f9a62' });
  sign.position.set(-44.6, 2.1, 27.4); sign.rotation.y = Math.PI / 2; g.add(sign);
  cylinder(g, 0.06, 0.08, 2.5, '#7a5a32', -44.6, 1.25, 27.4, 7);
  spots.npcs.ganga = { position: [F.x - 1.6, y, F.z - 3.0], yaw: Math.PI };
  const w3 = FARM_PLOTS.find((q) => q.id === 'w3'), w7 = FARM_PLOTS.find((q) => q.id === 'w7');
  spots.npcs.planter1 = { position: [-66.5, plotLevel(w3) + 0.08, 11.5], yaw: 0.6, bend: true };
  spots.npcs.planter2 = { position: [-69.0, plotLevel(w7) + 0.08, 21.0], yaw: -2.2, bend: true };
}

function buildOrchard(g, spots) {
  const og = group('district-orchard');
  const rows = [[72.4, [52, 60, 68, 76, 84]], [83.2, [47, 55, 63, 71, 79, 87]], [89.4, [51, 59, 67, 75, 83]]];
  const trees = [];
  for (const [z, xs] of rows) for (const [i, x] of xs.entries()) {
    const y = groundHeight(x, z);
    const tree = makeMangoTree({ h: 5.2 + (i % 2) * 0.6, spread: 2.9, seed: i + Math.round(z) });
    place(og, tree, x, z, i * 1.7, y); trees.push([x, y, z]);
  }
  for (const [x, y, z] of trees) for (let k = 0; k < 2; k++) {
    const a = k * 2.6 + x, rr = 1.6 + k * 0.6;
    spots.mangoes.push([x + Math.cos(a) * rr, y + 0.35, z + Math.sin(a) * rr]);
  }
  const jx = 63, jz = 83.2, jy = groundHeight(jx, jz);
  place(og, makeJhoola({ h: 3.0 }), jx + 1.9, jz, 0.3, jy);
  beam(og, [jx + 0.6, jy + 3.3, jz], [jx + 2.6, jy + 3.15, jz + 0.3], 0.07, '#5e4630');
  place(og, makeMachan(), 79, 86.4, 0.3, groundHeight(79, 86.4));
  for (const [x, z] of [[66.5, 79.6], [67.6, 79.9]]) {
    const y = groundHeight(x, z);
    box(og, 0.6, 0.38, 0.45, C.wood, x, y + 0.19, z);
    for (let i = 0; i < 6; i++) sphere(og, 0.09, i % 2 ? '#f5b82a' : '#e8781a', x - 0.15 + (i % 3) * 0.15, y + 0.42, z - 0.08 + Math.floor(i / 3) * 0.16, [0.85, 1.1, 0.85]);
  }
  place(og, makeBench({ w: 1.8 }), 60.5, 79.4, Math.PI, groundHeight(60.5, 79.4));
  for (const [x, z, s] of [[45, 70.2, 1], [56, 70.6, 2], [64, 70.4, 3], [80, 71.0, 4], [90.5, 72.5, 5], [91, 80, 6]]) {
    place(og, makeCoconutPalm({ h: 6.4 + (s % 3) * 0.8, lean: 0.18, seed: s }), x, z, s, groundHeight(x, z));
  }
  const bananas = [];
  for (let i = 0; i < 18; i++) {
    const x = 86 + (i % 3) * 1.6 + (i % 2) * 0.4, z = 75 + Math.floor(i / 3) * 1.7;
    bananas.push([x, groundHeight(x, z), z, i, 0.95 + (i % 4) * 0.08, 0]);
  }
  instanceCrop(og, 'banana', bananas, { amp: 0.02, name: 'orchard-bananas', cast: true });
  const sign = textSign({ text: 'आम का बाग़', sub: 'MANGO ORCHARD · MUNNI DIDI', w: 2.3, h: 0.55, bg: '#c05a1a' });
  const sy = groundHeight(46, 75.8); sign.position.set(46, sy + 2.0, 75.8); sign.rotation.y = 0.3; og.add(sign);
  cylinder(og, 0.06, 0.08, 2.4, '#7a5a32', 46, sy + 1.2, 75.8, 7);
  og.add(makeBunting({ from: [52, groundHeight(52, 72.4) + 3.6, 72.4], to: [60, groundHeight(60, 72.4) + 3.6, 72.4], count: 12, sag: 0.6 }));
  spots.npcs.munni = { position: [61.4, groundHeight(61.4, 78.6), 78.6], yaw: Math.PI * 0.95 };
  g.add(og);
}

function buildBanyanCourt(g, spots) {
  const x = 42.4, z = 12.5, y = groundHeight(x, z);
  place(g, makeBanyan({ seed: 3 }), x, z, 0.4, y);
  spots.npcs.dadaji = { position: [x - 2.0, y + 0.58, z + 1.5], yaw: 2.4, sit: true };
  for (const [sx, sz] of [[38.8, 7.5], [46.2, 17.6], [39, 18.6]]) place(g, makeShrub({ w: 1.6, h: 0.9, seed: sx }), sx, sz, 0, groundHeight(sx, sz));
}
