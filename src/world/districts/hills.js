import { ROUTES, pointAlong, surfaceY, groundHeight, PAD, LANDINGS, activeRoutes, pathAt } from '../layout.js';
import { LOCAL as C, group, box, cylinder, beam, sphere, place, footprint, roundFootprint, ribbon } from '../build-kit.js';
import { makeHouse, makeShop, makeTemple, makeTree, makeShrub, makeBench, makeStreetLamp,
  makeStreetSign, makeFlowerPatch, makeWaterContainer, makeCrates, makeBalloonStation, makePot, makeBicycle } from '../generators.js';
import { textSign, wire, poster } from '../props.js';
import { wallRun, offsetPoints } from './civil.js';

export function buildHillDistricts(root) {
  const village = group('district-village'); village.userData.district = 'village';
  // Low stone retaining terraces, two bends and a small shared washing court.
  // Houses stand beside grades, not on an unrelated mountain prop.
  const houses = [
    { x: -49, z: -33.5, y: 7.7, yaw: Math.PI, seed: 71 },
    { x: -56.9, z: -36.1, y: 8.2, yaw: Math.PI / 2, seed: 72 },
    { x: -42.6, z: -34.2, y: 8.2, yaw: Math.PI, seed: 73 },
    { x: -41.0, z: -47.8, y: 11, yaw: 0.0, seed: 74 },
    { x: -31.8, z: -42.0, y: 11, yaw: -Math.PI / 2, seed: 75 },
  ];
  for (const h of houses) {
    place(village, makeHouse({ w: 4.3, d: 3.7, h: 4.8 + h.seed % 2 * 0.65, seed: h.seed, wall: [C.sage, C.peach, C.ochre, C.plaster, C.blue, C.pink][h.seed % 6],
      trim: h.seed % 2 ? C.indigo : C.green, name: `hill-house-${h.seed}` }), h.x, h.z, h.yaw, h.y);
    // Foundations meet the actual hillside, closing the graded terrace edge.
    const ground = groundHeight(h.x, h.z);
    if (ground < h.y - 0.2) box(village, 4.5, h.y - ground, 3.9, C.stoneDark, h.x, (h.y + ground) / 2, h.z);
  }
  // A provision shop at a resting bend is useful on the way up, scaled as a
  // household frontage rather than another bazaar transplanted to the ridge.
  place(village, makeShop({ w: 3.55, d: 3.1, h: 4.9, seed: 82, text: 'पहाड़ी राशन', sub: 'VILLAGE PROVISIONS', kind: 'grocer',
    wall: C.plaster, trim: C.green, balcony: false, awning: false, name: 'village-provisions' }), -47.4, -48.5, 0.1, 11.0);
  const hillRoad = ROUTES.find((r) => r.id === 'hill-lane');
  // Retaining walls follow the graded lane, with their top derived from it.
  for (const [start, end, side] of [[22, 35, 1], [39, 49, -1]]) {
    const points = [];
    for (let dist = start; dist <= end; dist += 1) {
      const p = pointAlong(hillRoad.points, dist); points.push([p.x + p.dz * side * 2.55, p.y, p.z - p.dx * side * 2.55]);
    }
    const wall = wallRun(village, points, { h: 1.3, width: 0.38, collision: false, base: (x, z) => surfaceY(x, z) - 1.3 });
    wall.name = 'village-retaining-face';
  }
  place(village, makeStreetSign({ labels: ['बस्ती / VILLAGE', 'किला / FORT'], directions: [-1, -1] }), -29.2, -24.1, 0.3);
  place(village, makeStreetSign({ labels: ['किला / FORT', 'देवस्थान / SHRINE'], directions: [-1, 1] }), -43.0, -41.0, -0.1, 11);
  place(village, makeStreetLamp({ h: 3.9, seed: 2 }), -50.3, -35.8, Math.PI / 2, 8.2);
  place(village, makeStreetLamp({ h: 3.6, seed: 3 }), -39.0, -40.7, -Math.PI / 2, 11);
  place(village, makeWaterContainer({ kind: 'drum' }), -37.5, -42.1, 0, 11);
  place(village, makeWaterContainer(), -38.2, -42.3, 0, 11);
  place(village, makeBicycle({ color: C.red }), -36.8, -42.1, 0.5, 11);
  place(village, makeBench({ w: 1.8, stone: true }), -43.0, -38.0, 0.1, 8.2);
  place(village, makeFlowerPatch({ w: 2.4, seed: 11 }), -40.8, -39.1, 0, 8.2);
  place(village, makeCrates({ count: 2, seed: 11 }), -45.7, -46.5, 0.15, 11);
  // Village-level power supply traces each inhabited terrace, not the skyline.
  village.add(wire([-57, 13.6, -35.5], [-49, 12.8, -33.5], 0.45));
  village.add(wire([-49, 12.8, -33.5], [-41, 16.5, -47.8], 0.9));
  for (const [x, z, seed] of [[-31.1, -29.6, 8], [-56.9, -31.3, 9], [-59.5, -40.7, 10]]) {
    place(village, makeTree({ species: seed === 8 ? 'peepal' : 'pine', h: seed === 8 ? 5.7 : 8, spread: seed === 8 ? 2.0 : 1.45, seed }), x, z);
  }
  root.add(village);

  const fort = group('district-fort'); fort.userData.district = 'fort';
  box(fort, 17.3, 0.09, 14.2, '#949b83', PAD.x, PAD.y - 0.005, PAD.z, 'fort-courtyard');
  // The western entry and north-east postern are real breaks in the rampart.
  const walls = [
    [[-81.5, -69], [-81.5, -60.4]], [[-81.5, -55.8], [-81.5, -54.8]],
    [[-81.5, -54.8], [-64.4, -54.8]], [[-64.4, -54.8], [-64.4, -69]],
    [[-81.5, -69], [-71.3, -69]], [[-67.5, -69], [-64.4, -69]],
  ];
  for (const p of walls) {
    const south = p[0][1] === -54.8 && p[1][1] === -54.8;
    const wallH = south ? 0.62 : 0.82;
    const wall = wallRun(fort, p.map(([x, z]) => [x, PAD.y, z]), { h: wallH, width: 0.5, base: () => PAD.y });
    // registerCollisions at final assembly also includes wall sections.
    wall.name = 'fort-rampart';
    const a = p[0], b = p[1], n = Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.3);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = a[0] + (b[0] - a[0]) * t;
      if (south && x > -75.0 && x < -71.0) continue; // the old survey lookout has a clear low coping
      box(fort, 0.5, 0.32, 0.58, C.stoneDark, x, PAD.y + wallH + 0.16, a[1] + (b[1] - a[1]) * t);
    }
  }
  for (const [x, z, h] of [[-80.8, -67.5, 2.7], [-65.5, -67.5, 3.2]]) {
    const tower = group('ruined-square-bastion'); footprint(tower, 2.4, 2.4);
    box(tower, 2.4, h, 2.4, C.stoneDark, 0, h / 2, 0);
    for (let row = 0; row < Math.ceil(h / 0.4); row++) box(tower, 2.42, 0.035, 2.42, C.stone, 0, 0.17 + row * 0.4, 0);
    for (const side of [-1, 1]) box(tower, 0.4, 0.4, 2.42, C.stoneDark, side, h + 0.2, 0);
    place(fort, tower, x, z, 0, PAD.y);
  }
  const gate = group('fort-western-gate');
  for (const z of [-1.5, 1.5]) {
    box(gate, 0.6, 2.4, 0.5, C.stoneDark, 0, 1.2, z); footprint(gate, 0.6, 0.5, 0, z);
  }
  box(gate, 0.65, 0.42, 3.65, C.stone, 0, 2.6, 0);
  const fortSign = textSign({ text: 'पुराना किला', sub: 'OLD FORT · RIDGE WALK', w: 2.2, h: 0.48, bg: C.green });
  fortSign.rotation.y = -Math.PI / 2; fortSign.position.set(-0.34, 2.56, 0); gate.add(fortSign);
  place(fort, gate, -81.4, -58.1, 0, PAD.y);
  place(fort, makeBench({ w: 2.0, stone: true }), -76.8, -56.2, 0, PAD.y);
  place(fort, makeStreetSign({ labels: ['देवस्थान / SHRINE', 'बस्ती / VILLAGE'], directions: [1, -1] }), -75.4, -64.5, 0, PAD.y);
  const mapBoard = textSign({ text: 'चंद्रपुर की घाटी', sub: 'STATION · BAZAAR · RIVER · VALLEY VIEW', w: 2.7, h: 0.65, bg: '#52645b' });
  mapBoard.position.set(-69.4, PAD.y + 0.84, -55.4); mapBoard.rotation.x = -0.32; fort.add(mapBoard);
  cylinder(fort, 0.04, 0.05, 0.73, C.timber, -70.3, PAD.y + 0.37, -55.45, 6);
  cylinder(fort, 0.04, 0.05, 0.73, C.timber, -68.5, PAD.y + 0.37, -55.45, 6);
  // Ruins have a working trail and a swept lookout, not decorative rubble
  // covering the entire court. Stone fragments belong to one damaged corner.
  for (const [x, z, s] of [[-78, -66, 0.5], [-77.2, -65.9, 0.32], [-79.1, -64.8, 0.45]]) sphere(fort, s, C.stoneDark, x, PAD.y + s * 0.35, z, [1.5, 0.6, 1]);
  root.add(fort);

  const shrine = group('district-shrine'); shrine.userData.district = 'shrine';
  place(shrine, makeTemple({ seed: 9 }), -35, -79.3, 0, 25.5);
  box(shrine, 12.6, 0.08, 12.2, '#b0ac90', -35, 25.49, -76.0, 'shrine-forecourt');
  place(shrine, makeTree({ h: 6.6, spread: 2.4, seed: 6 }), -29.2, -81.0, 0, 25.5);
  place(shrine, makeBench({ w: 1.8, stone: true }), -40.3, -71.2, 0.22, 25.5);
  place(shrine, makeFlowerPatch({ w: 3.1, seed: 8 }), -30.4, -77.3, Math.PI / 2, 25.5);
  place(shrine, makeStreetLamp({ h: 3.4, seed: 4 }), -29.5, -73.5, Math.PI, 25.5);
  place(shrine, makeStreetSign({ labels: ['किला / FORT', 'बस्ती / VILLAGE'], directions: [-1, 1] }), -37.3, -70.6, 0, 25.5);
  root.add(shrine);

  const landings = group('district-balloon-landings');
  for (const l of LANDINGS) place(landings, makeBalloonStation({ upper: l.id === 'upper' }), l.position[0], l.position[2], 0, l.position[1]);
  place(landings, makeBench({ w: 1.8 }), 9.0, 78.7, Math.PI, 0.2);
  place(landings, makeStreetLamp({ h: 3.8 }), 8.1, 74.0, Math.PI, 0.2);
  place(landings, makeStreetSign({ labels: ['घाट / GHATS', 'पुल / BRIDGE'], directions: [-1, -1] }), -2.9, 74.4, 0, 0.2);
  root.add(landings);

  const growth = group('hill-groves');
  // Purposeful contour bands of chir pine; open view corridors are measured
  // against the route graph and maintained. The remainder is low scrub.
  const pineBands = [
    [[-97, -39], [-102, -47], [-106, -56], [-99, -64], [-96, -73], [-92, -80]],
    [[-89, -86], [-82, -89], [-74, -92], [-66, -92], [-59, -90]],
    [[-17, -86], [-13, -78], [-11, -69], [-14, -62], [-16, -56]],
    [[31, -59], [38, -66], [49, -70], [59, -66], [66, -58]],
  ];
  let seed = 110;
  for (const band of pineBands) for (const [x, z] of band) {
    if (activeRoutes().some((r) => pathAt(r.points, x, z).d < r.width / 2 + 3)) continue;
    place(growth, makeTree({ species: 'pine', h: 7.5 + seed % 3 * 0.7, spread: 1.7, seed: seed++ }), x, z);
  }
  for (const [x, z, w] of [[-34, -33, 2.7], [-45, -29, 2], [-61, -34, 2.7], [-64, -38, 2.4], [-58, -52, 1.9],
    [-75, -41, 3], [-85, -51, 2.5], [-84, -61, 2.1], [-62, -78, 1.9], [-39, -85, 2.4], [-25, -70, 2.1], [-20, -56, 2.4]]) {
    if (activeRoutes().some((r) => pathAt(r.points, x, z).d < r.width / 2 + w / 2 + 0.5)) continue;
    place(growth, makeShrub({ w, h: w * 0.27, seed: seed++ }), x, z);
  }
  for (const [x, z] of [[-34, -28], [-47, -29], [-58, -40], [-70, -43], [-83, -53], [-61, -80], [-29, -64]]) {
    const y = groundHeight(x, z); sphere(growth, 0.55, C.stone, x, y + 0.18, z, [1.5, 0.65, 1]);
  }
  root.add(growth);
  return [village, fort, shrine, landings, growth];
}
