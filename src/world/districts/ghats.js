import { WATER_Y, surfaceY } from '../layout.js';
import { LOCAL as C, group, box, cylinder, place, roundFootprint } from '../build-kit.js';
import { makeGhat, makeBridge, makeTree, makeShrub, makeBench, makeStreetLamp, makeStreetSign, makeWaterContainer,
  makeTemple, makeSlateRoof, makeRiverBoat, makePot } from '../generators.js';
import { diya, wire } from '../props.js';
import { wallRun } from './civil.js';

export function buildGhats(root) {
  const g = group('district-river'); g.userData.district = 'river';
  place(g, makeGhat(), 0, 0, 0, 0);
  place(g, makeBridge(), 0, 0, 0, 0);
  // A small everyday sitting pavilion, built from the same stone and slate
  // as the town. Its roof does not announce another regional architectural set.
  const pavilion = group('ghat-sitting-pavilion');
  for (const [x, z] of [[-1.65, -1.15], [1.65, -1.15], [-1.65, 1.15], [1.65, 1.15]]) {
    cylinder(pavilion, 0.1, 0.14, 2.4, C.stone, x, 1.2, z, 8); roundFootprint(pavilion, 0.15, x, z);
  }
  const roof = makeSlateRoof({ w: 4.4, d: 3.4, rise: 0.9, seed: 2 }); roof.position.y = 2.48; pavilion.add(roof);
  box(pavilion, 3.4, 0.45, 0.48, C.stoneDark, 0, 0.225, -0.95);
  box(pavilion, 3.5, 0.08, 0.56, C.stone, 0, 0.49, -0.95);
  place(g, pavilion, 39, 48.0, 0, -0.05);
  place(g, makeTemple({ small: true, seed: 4 }), 40.4, 46.1, Math.PI, -0.05);
  place(g, makeTree({ h: 7.3, spread: 3, seed: 9 }), -6, 44.8, 0, 0);
  place(g, makeBench({ w: 2.0, stone: true }), -5.9, 44.0, 0, 0);
  place(g, makeTree({ h: 6.8, spread: 2.8, seed: 4 }), -33.7, 43.5, 0, 0);
  place(g, makeStreetLamp({ h: 3.8 }), 12.4, 47.3, 0, -0.05);
  place(g, makeStreetLamp({ h: 3.6 }), -17.8, 48.5, Math.PI, 0);
  place(g, makeStreetLamp({ h: 3.8 }), -18.8, 70.6, Math.PI, 0);
  place(g, makeStreetSign({ labels: ['पुल / BRIDGE', 'गुब्बारा पड़ाव / BALLOON'], directions: [-1, -1] }), 10.1, 47.2, 0, 0);
  // Riverbank wall has a broad opening at the ghat and at the footbridge.
  const y = (x, z) => surfaceY(x, Math.min(z, 49.4));
  for (const points of [[[-36, 49], [-24, 49.8]], [[-18, 49.8], [14, 50]], [[35.8, 50.0], [44, 50.0]]]) {
    const wall = wallRun(g, points, { h: 0.72, width: 0.28, base: y });
    place(g, wall, 0, 0, 0, 0);
  }
  for (const [i, x] of [17.0, 22.5, 28.6, 33.0].entries()) {
    const d = diya({ scale: 1.4 }); place(g, d.group, x, 52.5, 0, -0.61); d.group.name = 'ghat-diya';
  }
  place(g, makeWaterContainer(), 29.9, 51.2, 0, -0.3);
  place(g, makeWaterContainer(), 30.5, 51.1, 0, -0.3);
  // Folded washing belongs to the top landing, not the market or mid-river.
  for (let i = 0; i < 3; i++) box(g, 0.55, 0.065, 0.38, i % 2 ? '#a7b3b9' : C.canvas, 28.3, -0.22 + i * 0.065, 51.0);
  const boat = makeRiverBoat(); place(g, boat, 6.4, 55.3, -0.27, WATER_Y + 0.03);
  g.add(wire([6.4, WATER_Y + 0.32, 54.8], [6.9, 0.2, 50.3], 0.18));
  cylinder(g, 0.06, 0.075, 0.5, C.wood, 6.9, 0.13, 50.3, 8);
  for (const [x, z, seed] of [[-30, 73.8, 1], [-10, 79, 2], [14, 80.2, 3], [30, 76.1, 4], [46, 71, 5]]) {
    place(g, makeTree({ species: seed === 5 ? 'pine' : 'peepal', h: 5.8 + seed * 0.25, spread: 2.4, seed: seed + 20 }), x, z);
  }
  for (const [x, z] of [[-26, 75.3], [-13, 79.2], [18, 79], [38, 76], [43, 74]]) place(g, makeShrub({ w: 2.8, h: 0.8, seed: x + 50 }), x, z);
  // A quiet reed belt along the far waterline is purposeful riparian growth.
  for (const start of [-46, -9, 28, 58]) for (let i = 0; i < 11; i++) {
    const x = start + i * 0.38, z = 68.0 + Math.sin(x * 0.3) * 0.45;
    cylinder(g, 0.017, 0.021, 0.65 + i % 3 * 0.13, '#7a8b61', x, -0.3, z, 5);
  }
  root.add(g); return g;
}
