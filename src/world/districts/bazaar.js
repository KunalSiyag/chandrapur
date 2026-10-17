import { ROUTES, pointAlong, surfaceY } from '../layout.js';
import { LOCAL as C, group, box, cylinder, beam, place } from '../build-kit.js';
import { makeShop, makeHouse, makeCrates, makeScooter, makeBicycle, makeTree, makePot, makeBench,
  makeStreetLamp, makeStreetSign, makeShrub, makeWaterContainer } from '../generators.js';
import { bulbString, textSign, wire, hangingGoods, poster } from '../props.js';

const TENANTS = [
  ['शर्मा मिठाई', 'SWEETS · FRESH JALEBI', 'sweets', C.peach, C.red],
  ['अनाज भंडार', 'GRAIN · PULSES · RICE', 'grocer', C.ochre, C.green],
  ['मित्तल दर्ज़ी', 'TAILOR · REPAIRS', 'tailor', C.turquoise, C.red],
  ['पीतल घर', 'BRASS · UTENSILS', 'brass', C.peach, C.green],
  ['किताब गली', 'BOOKS · STATIONERY', 'books', C.blue, C.ochre],
  ['गुप्ता किराना', 'TEA · MILK · EVERYDAY', 'grocer', C.pink, C.green],
  ['नदी चाय घर', 'RIVER TEA HOUSE', 'sweets', C.ochre, C.green],
];

export function buildBazaar(root) {
  const g = group('district-bazaar'); g.userData.district = 'bazaar';
  const spine = ROUTES.find((r) => r.id === 'bazaar-spine');
  const shopRows = [
    { side: -1, distances: [6, 12, 18, 30, 36, 42] }, // missing frontage is the peepal court/shortcut
    { side: 1, distances: [6, 12, 19, 25, 31, 38, 44] },
  ];
  for (const row of shopRows) for (let i = 0; i < row.distances.length; i++) {
    const p = pointAlong(spine.points, row.distances[i]), nx = p.dz, nz = -p.dx;
    const [text, sub, kind, wall, trim] = TENANTS[(i + (row.side > 0 ? 2 : 0)) % TENANTS.length];
    const seed = 10 + i + (row.side > 0 ? 20 : 0), w = i === 0 ? 4.9 : 4.55, d = 4.4;
    const center = 3.05 + d / 2;
    const x = p.x + nx * row.side * center, z = p.z + nz * row.side * center;
    const yaw = Math.atan2(-row.side * nx, -row.side * nz);
    const building = makeShop({ w, d, h: 5.6 + (seed % 3) * 0.47, seed, text, sub, kind, wall, trim,
      closed: (row.side > 0 && i === 2) || (row.side < 0 && i === 4), balcony: seed % 3 !== 1,
      name: `bazaar-${kind}-${row.side}-${i}` });
    place(g, building, x, z, yaw, surfaceY(p.x, p.z));
    // Stock and parked transport belong to a specific storefront or delivery
    // door. The 4.7 m spine remains open; no centreline obstacle scatter.
    if (i % 3 === 0) {
      const crate = makeCrates({ count: 3, produce: kind === 'grocer', seed });
      place(g, crate, p.x + nx * row.side * 3.08 + p.dx * 1.15, p.z + nz * row.side * 3.08 + p.dz * 1.15, yaw);
    }
    if (i % 3 === 1) {
      place(g, makePot({ flowers: true, seed }), p.x + nx * row.side * 2.97 - p.dx * 1.75, p.z + nz * row.side * 2.97 - p.dz * 1.75, 0);
    }
    if (i === 2 || i === 5) {
      place(g, makeScooter({ color: i === 2 ? '#a4a795' : '#7b95a4', seed }),
        p.x + nx * row.side * 2.97 + p.dx * 1.9, p.z + nz * row.side * 2.97 + p.dz * 1.9, Math.atan2(p.dx, p.dz));
    }
    if (kind === 'tailor' && !(row.side > 0 && i === 2)) {
      const clothes = hangingGoods({ from: [-1.8, 2.39, d / 2 + 0.38], to: [1.65, 2.39, d / 2 + 0.38], kind: 'bangles', count: 6 }).group;
      clothes.position.copy(building.position); clothes.rotation.y = yaw; g.add(clothes);
    }
  }
  // Dwelling backs on the outer east and a genuinely narrow inhabited rear
  // lane on the west: a route has two frontages, not shops in empty grass.
  const rearLane = ROUTES.find((r) => r.id === 'bazaar-back');
  for (const side of [-1, 1]) for (const [i, distance] of (side < 0 ? [8, 17, 29, 37] : [12, 21, 32, 39]).entries()) {
    const p = pointAlong(side < 0 ? rearLane.points : spine.points, distance), nx = p.dz, nz = -p.dx;
    const offset = side < 0 ? 5.6 : 12.1;
    const x = p.x + nx * side * offset, z = p.z + nz * side * offset;
    place(g, makeHouse({ w: 4.9, d: 3.9, h: 5.1 + (i % 2) * 0.8, seed: 51 + i + (side > 0 ? 10 : 0),
      wall: [C.sage, C.plaster, C.pink, C.turquoise][(i + (side > 0 ? 1 : 0)) % 4], name: `bazaar-house-${side}-${i}` }), x, z, Math.atan2(-side * nx, -side * nz), 0);
  }
  // The peepal belongs to an old widened courtyard at the lane's dogleg.
  // Its trunk does not block the spine or the shortcut under its canopy.
  place(g, makeTree({ species: 'peepal', h: 7.5, spread: 2.7, seed: 7 }), 12.1, 27.0, 0, 0);
  place(g, makeBench({ w: 1.6 }), 10.5, 26.8, Math.PI / 2, 0);
  place(g, makeBicycle({ color: C.indigo, basket: true }), 9.7, 23.1, -0.1, 0);
  place(g, makeWaterContainer({ kind: 'drum' }), 10.0, 27.5, 0, 0);
  const laneNotice = textSign({ text: 'पीपल वाली गली', sub: 'PEEPAL LANE · STATION ←', w: 1.9, h: 0.43, bg: C.green }); laneNotice.position.set(10.8, 2.0, 23.45); laneNotice.rotation.y = Math.PI; g.add(laneNotice);
  // A modest bazaar threshold made from actual adjacent shop fascias and
  // their overhead service wire, rather than a monumental theme-park gate.
  const entry = textSign({ text: 'पुराना बाज़ार', sub: 'OLD BAZAAR · GHATS AHEAD', w: 3.9, h: 0.74, bg: C.indigo });
  entry.position.set(13.75, 4.35, 7.65); entry.rotation.y = -2.35; g.add(entry);
  g.add(wire([9.8, 4.7, 10.9], [17.7, 4.7, 3.6], 0.22));
  const tops = [];
  for (const [i, distance] of [5, 17, 29, 42, 49].entries()) {
    const p = pointAlong(spine.points, distance), x = p.x + p.dz * 3.0, z = p.z - p.dx * 3.0;
    const h = 6.7 + i % 2 * 0.5;
    cylinder(g, 0.06, 0.085, h, C.wood, x, h / 2, z, 7);
    beam(g, [x - 0.7, h - 0.25, z], [x + 0.7, h - 0.25, z], 0.035, C.wood);
    tops.push([x, h - 0.2, z]);
    if (i < 4) g.add(bulbString({ from: [p.x - p.dz * 3.2, 4.35, p.z + p.dx * 3.2], to: [x, 4.35, z], count: 6, sag: 0.3, size: 0.08 }));
    if (i % 2 === 0) place(g, makeStreetLamp({ h: 3.8, seed: i + 1 }), p.x - p.dz * 2.85, p.z + p.dx * 2.85, Math.atan2(p.dz, -p.dx));
  }
  for (let i = 0; i < tops.length - 1; i++) {
    g.add(wire(tops[i], tops[i + 1], 0.7));
    g.add(wire(tops[i].map((n, j) => j === 1 ? n - 0.4 : n), tops[i + 1].map((n, j) => j === 1 ? n - 0.4 : n), 0.82));
  }
  place(g, makeStreetSign({ labels: ['घाट / RIVER', 'स्टेशन / STATION'], directions: [1, -1] }), 23.1, 45.6, -0.1, -0.1);
  const backRoute = ROUTES.find((r) => r.id === 'bazaar-back');
  for (const [i, distance] of [12, 25, 40].entries()) {
    const p = pointAlong(backRoute.points, distance);
    place(g, makeWaterContainer(), p.x - 1.35, p.z, 0, 0);
    if (i === 1) place(g, makeCrates({ count: 2, seed: 6 }), p.x + 1.5, p.z - 1.2, 0, 0);
  }
  root.add(g); return g;
}
