import * as THREE from 'three';
import { toonMaterial } from '../../core/toon.js';
import { RAIL_X0, RAIL_X1, RAIL_Z, CROSSING_X, surfaceY, ROUTES, pointAlong, groundHeight } from '../layout.js';
import { LOCAL as C, group, box, cylinder, beam, plane, flat, place, footprint } from '../build-kit.js';
import { makeRailwayStation, makeChaiStall, makeBench, makeBicycle, makeScooter, makeRickshaw, makeLuggageTrolley,
  makeStreetLamp, makeStreetSign, makeHouse, makeTree, makeShrub, makeFlowerPatch, makeWaterContainer } from '../generators.js';
import { textSign, timetable, poster, wire } from '../props.js';
import { wallRun } from './civil.js';

export function buildStationQuarter(root) {
  const g = group('district-station'); g.userData.district = 'station';
  place(g, makeRailwayStation(), 0, -11.35, 0, 0);
  box(g, 24.6, 0.66, 2.0, C.stoneDark, 0, 0.47, -16, 'station-platform');
  box(g, 24.6, 0.03, 0.16, '#d6bc65', 0, 0.822, -16.84, 'platform-edge-line');
  buildRailway(g);
  place(g, makeChaiStall({ seed: 3 }), 8.4, -4.7, -0.5, 0);
  place(g, makeChaiStall({ seed: 7, canopy: false }), -8.8, -15.8, 0, 0.8);
  place(g, makeLuggageTrolley(), 7.8, -15.8, -0.07, 0.8);
  place(g, makeBench({ w: 2.0 }), -4.4, -16, 0, 0.8);
  const timetableBoard = timetable({ w: 1.9, h: 1.15 }); timetableBoard.position.set(-11.5, 1.65, -15.3); g.add(timetableBoard);
  cylinder(g, 0.04, 0.04, 1.0, C.timber, -11.5, 1.1, -15.35, 6);
  place(g, makeRickshaw({ seed: 5 }), 12.9, -6.6, 0.25, 0); // parked clear of the farm lane
  place(g, makeScooter({ color: '#a4ada4' }), -11.4, -4.3, 1.18, 0);
  place(g, makeBicycle({ color: C.red, basket: true }), -9.4, -3.1, 1.28, 0);
  place(g, makeBicycle({ color: C.green }), -9.7, -1.9, 1.22, 0);
  place(g, makeBench({ w: 2.1 }), -5.5, -6.65, 0, 0);
  place(g, makeBench({ w: 1.65 }), 5.5, -6.7, -0.1, 0);
  place(g, makeStreetLamp({ h: 4.3, arm: 0.8 }), -13, -6.0, 0, 0);
  place(g, makeStreetLamp({ h: 4.6 }), 9.7, 1.4, Math.PI, 0);
  place(g, makeTree({ seed: 2, h: 7.8, spread: 3.0 }), -13.5, 3.8, 0, 0);
  place(g, makeFlowerPatch({ w: 3.8, d: 0.75 }), -6.0, -7.1, 0, 0);
  place(g, makeStreetSign({ labels: ['बाज़ार / BAZAAR', 'घाट / RIVER'], directions: [1, 1] }), 7.1, 3.2, -0.3, 0);
  place(g, makeStreetSign({ labels: ['पहाड़ी बस्ती / HILL', 'किला / FORT'], directions: [-1, -1] }), -10.1, 1.0, 0.08, 0);
  // A readable schematic in the station, showing a route network instead
  // of teleport buttons. The world map repeats the same physical graph.
  const notice = textSign({ text: 'आप यहाँ हैं · YOU ARE HERE', sub: 'BAZAAR → GHATS  ·  CROSSING → HILL VILLAGE', w: 3.0, h: 0.65, bg: C.green });
  notice.position.set(-7.3, 1.6, -8.92); g.add(notice);
  const bill = poster({ title: 'चंद्रपुर समाचार', lines: ['last train · 22:15', 'bazaar opens at dawn', 'flight from river meadow'], w: 0.8, h: 1.02 });
  bill.position.set(3.3, 1.78, -8.95); g.add(bill);
  // Station-workers' houses are the connective tissue on the western return
  // lane. Their front doors and utility service face that lane.
  const returnRoute = ROUTES.find((r) => r.id === 'western-return');
  for (const [distance, seed] of [[13, 21], [21, 22], [31, 23], [42, 24]]) {
    const p = pointAlong(returnRoute.points, distance), nx = p.dz, nz = -p.dx;
    const x = p.x - nx * 5.7, z = p.z - nz * 5.7;
    place(g, makeHouse({ w: 4.7, d: 4.4, h: seed % 2 ? 5.0 : 5.6, seed, wall: [C.peach, C.ochre, C.sage, C.plaster][seed % 4], trim: [C.indigo, C.green, C.red, C.indigo][seed % 4], name: `railway-worker-house-${seed}` }), x, z, Math.atan2(nx, nz), surfaceY(p.x, p.z));
    if (seed % 2 === 0) place(g, makeScooter({ seed, color: C.green }), p.x - nx * 2.7, p.z - nz * 2.7, Math.atan2(p.dx, p.dz));
  }
  // The compound wall opens on a field gate to the paddy lane.
  wallRun(g, [[-39, 8], [-42, 23], [-42.3, 27.3]], { h: 0.85 });
  wallRun(g, [[-42.6, 31.6], [-43, 37]], { h: 0.85 });
  // Ridge planting belongs to the railway bench. Dark, slender chir pines
  // mark the foothill, not palms or alpine chalets.
  for (const [x, z, seed] of [[-42, -23, 10], [-54, -24, 11], [-65, -24, 12], [-78, -25, 13],
    [24, -26, 14], [35, -28, 15], [48, -28, 16], [63, -27, 17], [77, -25, 18], [91, -25, 19]]) {
    place(g, makeTree({ species: 'pine', h: 8 + seed % 3, spread: 1.65, seed }), x, z, 0, groundHeight(x, z));
  }
  for (const [x, z, seed] of [[18, -7, 31], [25, -8.8, 32], [33, -9.8, 33]]) {
    place(g, makeHouse({ w: 5.2, d: 4.2, h: 4.4 + seed % 2, seed, wall: [C.pink, C.turquoise, C.ochre][seed % 3], trim: [C.green, C.red, C.indigo][seed % 3], name: `station-lane-house-${seed}` }), x, z, 0, 0);
  }
  root.add(g); return g;
}

function buildRailway(g) {
  const L = RAIL_X1 - RAIL_X0;
  box(g, L, 0.22, 4.5, '#68716c', 0, 0.49, RAIL_Z, 'railway-ballast');
  for (const z of [-0.73, 0.73]) box(g, L, 0.1, 0.095, '#a3afa8', 0, 0.69, RAIL_Z + z, 'steel-rail');
  for (let x = RAIL_X0; x <= RAIL_X1; x += 1.18) box(g, 0.23, 0.075, 2.25, C.wood, x, 0.605, RAIL_Z);
  for (let x = -93; x < 102; x += 14) {
    if (Math.abs(x - CROSSING_X) < 5) continue;
    cylinder(g, 0.06, 0.085, 6.6, C.timber, x, 3.8, RAIL_Z - 2.6, 7);
    beam(g, [x, 6.63, RAIL_Z - 2.6], [x, 6.63, RAIL_Z + 0.3], 0.036, C.timber);
    if (x + 14 < 102) g.add(wire([x, 6.63, RAIL_Z], [x + 14, 6.63, RAIL_Z], 0.25));
  }
  const train = group('night-passenger-train'); footprint(train, 26.9, 2.8);
  for (let car = 0; car < 2; car++) {
    const cx = -6.65 + car * 13.3;
    box(train, 12.7, 2.5, 2.55, '#31566f', cx, 1.8, 0, 'blue-passenger-coach');
    box(train, 12.73, 0.2, 2.58, '#c3b279', cx, 1.76, 0);
    box(train, 12.5, 0.28, 2.25, C.dark, cx, 0.5, 0);
    const roof = cylinder(train, 1.35, 1.35, 12.8, '#7b8e97', cx, 3.06, 0, 16); roof.rotation.z = Math.PI / 2; roof.scale.x = 0.52;
    for (const dx of [-4.45, 4.45]) {
      for (const s of [-1, 1]) {
        const wheel = cylinder(train, 0.35, 0.35, 0.13, C.dark, cx + dx, 0.36, s * 0.91, 12); wheel.rotation.x = Math.PI / 2;
      }
    }
    for (let i = 0; i < 8; i++) for (const s of [-1, 1]) {
      const window = plane(train, 0.96, 0.74, flat(i === 2 || i === 6 ? '#cabb8c' : '#283b4b'), cx - 5.2 + i * 1.48, 2.3, s * 1.29);
      window.rotation.y = s < 0 ? Math.PI : 0;
      for (const yy of [2.13, 2.37]) box(train, 1.02, 0.035, 0.035, '#778c95', cx - 5.2 + i * 1.48, yy, s * 1.31);
    }
    const destination = textSign({ text: 'चंद्रपुर — देहरादून', sub: 'NIGHT PASSENGER', w: 2.1, h: 0.32, bg: '#bfae77', fg: '#263c4a' });
    destination.position.set(cx, 3.0, 1.315); train.add(destination);
  }
  place(g, train, 3.2, RAIL_Z, 0, 0.69);
  // The crossing is a proper gap on BOTH sides of the railway. Raised booms
  // clear the walkable lane, rather than forming a hidden collider wall.
  for (const side of [-1, 1]) {
    const x = CROSSING_X + side * 3.1, z = RAIL_Z + side * 3.2;
    cylinder(g, 0.095, 0.11, 1.3, C.stoneDark, x, 1.1, z, 8);
    beam(g, [x, 1.7, z], [x - side * 0.6, 4.9, z], 0.06, '#d1c8a6');
    for (let i = 0; i < 4; i++) box(g, 0.14, 0.2, 0.14, C.red, x - side * i * 0.15, 2.0 + i * 0.75, z);
  }
  // Low fencing stops at the crossing and platform, preserving access.
  for (const [x0, x1, z] of [[-101, -29, -21.4], [-21, 101, -21.4], [-101, -29, -14.7], [15, 101, -14.7]]) {
    wallRun(g, [[x0, z], [x1, z]], { h: 0.55, width: 0.16, color: '#717d69', collision: true });
  }
}
