import * as THREE from 'three';

// Chandrapur: a single lower-hill river valley. All coordinates and grades are
// original. Route data is shared by civil works, feet, navigation and checks.
export const WORLD_STAGE = 'full';
export const WORLD_BOUNDS = { x0: -110, x1: 93, z0: -100, z1: 94 };
export const RAIL_Z = -18;
export const RAIL_X0 = -112;
export const RAIL_X1 = 112;
export const CROSSING_X = -25;
export const RIVER_Z0 = 52;
export const RIVER_Z1 = 66;
export const WATER_Y = -0.95;
export const SQUARE = { x0: -15, x1: 15, z0: -7.5, z1: 5.5 };
export const STREET = { x0: 10, x1: 31, z0: 4, z1: 47 };
export const PROM = { x0: -37, x1: 43, z0: 46, z1: 51 };
export const GHAT = { x0: 16, x1: 34, z0: 50.2, z1: 54.4, stepH: 0.15, stepD: 0.7, count: 6 };
export const BRIDGE = { x: -21, z0: 47.5, z1: 71.2, rise: 2.45, halfW: 1.55 };
export const BRIDGE_X = BRIDGE.x;
export const TERRACE = { x: 32, z: 48, r: 3.6 };
export const HILL = { cx: -57, cz: -57, rx: 56, rz: 49, h: 25 };
export const PAD = { x: -73, z: -62, r: 9, y: 21.5 };
export const MOON_HOME = new THREE.Vector3(76, 51, 133);
export const MOON_DOWN = new THREE.Vector3(49, 12, 76);

export const DISTRICTS = [
  { id: 'station', name: 'Old Railway Station', hi: 'चंद्रपुर स्टेशन', anchor: [0, 0, -2], radius: 21, stage: 'river' },
  { id: 'bazaar', name: 'Old Bazaar', hi: 'पुराना बाज़ार', anchor: [18, 0, 24], radius: 22, stage: 'river' },
  { id: 'river', name: 'Riverside Ghats', hi: 'नदी के घाट', anchor: [24, -0.15, 49], radius: 17, stage: 'river' },
  { id: 'village', name: 'Hill Village', hi: 'पहाड़ी बस्ती', anchor: [-48, 10.5, -39], radius: 19, stage: 'hills' },
  { id: 'fort', name: 'Hill Fort', hi: 'पुराना किला', anchor: [-73, 21.5, -62], radius: 14, stage: 'hills' },
  { id: 'shrine', name: 'Shrine Hill', hi: 'देवस्थान', anchor: [-35, 25.5, -76], radius: 13, stage: 'hills' },
  { id: 'balloon', name: 'Balloon Landing', hi: 'गुब्बारा पड़ाव', anchor: [3, 0.2, 73.4], radius: 14, stage: 'full' },
  { id: 'farms', name: 'Sarson Fields', hi: 'सरसों के खेत', anchor: [69, 0, 8], radius: 27, stage: 'river' },
  { id: 'paddy', name: 'Paddy Fields', hi: 'धान के खेत', anchor: [-70, 0, 29], radius: 28, stage: 'river' },
  { id: 'orchard', name: 'Mango Orchard', hi: 'आम का बाग़', anchor: [64, 0, 78], radius: 19, stage: 'full' },
];

const route = (id, from, to, width, points, material = 'lane', stage = 'river') =>
  ({ id, from, to, width, points, material, stage });

export const ROUTES = [
  route('bazaar-spine', 'station', 'river', 4.7,
    [[9, 0, 3], [14, 0, 8], [18, 0, 17], [17, 0, 25], [20, 0, 34], [26, -0.05, 42], [26, -0.15, 49]], 'paving'),
  route('bazaar-back', 'station', 'river', 2.1,
    [[5, 0, 3], [3.5, 0, 6], [5.2, 0, 13], [7.6, 0, 19], [6.6, 0, 27], [8.8, 0, 34], [13.8, 0, 41], [14.5, 0, 45.5], [19, -0.1, 47.3]], 'lane'),
  route('cloth-alley', 'bazaar', 'bazaar', 2.0,
    [[17, 0, 25], [12, 0, 25], [6.8, 0, 25]], 'lane'),
  route('riverbank', 'river', 'bridge', 3.7,
    [[40, -0.15, 48], [26, -0.15, 49], [11, -0.15, 48.5], [8, 0, 48], [-8, 0, 46.5], [-21, 0, 45.8], [-37, 0, 46]], 'prom'),
  route('western-return', 'station', 'bridge', 3.6,
    [[-11, 0, 2], [-23, 0, 6], [-30, 0, 17], [-34, 0, 32], [-30, 0, 43], [-21, 0, 45.8]], 'road'),
  route('bridge-approach', 'river', 'bridge', 2.9, [[-21, 0, 45.8], [-21, 0, 47.5]], 'prom'),
  route('south-bank', 'bridge', 'balloon', 3.0,
    [[-21, 0, 71.2], [-14, 0.1, 74], [3, 0.2, 73.4], [21, 0.1, 73], [40, 0, 71]], 'path'),
  route('hill-lane', 'station', 'village', 3.8,
    [[-11, 0, 2], [-21, 0, -5], [-25, 0.45, -18], [-29, 1.7, -26], [-40, 4.8, -30],
      [-52, 7.2, -31], [-53, 8.2, -38], [-45, 10.5, -43], [-40, 11, -43]], 'road', 'hills'),
  route('fort-climb', 'village', 'fort', 2.8,
    [[-45, 10.5, -43], [-56, 12.5, -48], [-65, 15.5, -42], [-78, 18.4, -47],
      [-85, 20.5, -56], [-84, 21.5, -58.1], [-80, 21.5, -58.1], [-73, 21.5, -62]], 'path', 'hills'),
  route('shrine-steps', 'village', 'shrine', 2.4,
    [[-40, 11, -43], [-31, 13, -50], [-27, 16.2, -58], [-32, 19.4, -66], [-35, 25.5, -76]], 'steps', 'hills'),
  route('ridge-walk', 'fort', 'shrine', 2.6,
    [[-73, 21.5, -62], [-67, 22.4, -73], [-55, 23.7, -81], [-44, 24.7, -82],
      [-43, 25.5, -73.6], [-35, 25.5, -73.6], [-35, 25.5, -76]], 'path', 'hills'),
  route('upper-landing', 'village', 'upper-balloon', 2.6,
    [[-56, 12.5, -48], [-60, 14.5, -57], [-57, 16.6, -65], [-53, 17.5, -69]], 'path', 'full'),
];
export const HILL_ROAD = ROUTES.find((r) => r.id === 'hill-lane').points;
export const SOUTH_LANE = ROUTES.find((r) => r.id === 'south-bank').points;
export const LANDINGS = [
  { id: 'valley', name: 'River Meadow', position: [3, 0.2, 77], exit: [3, 0.2, 75.0], access: [3, 0.2, 74.8] },
  { id: 'upper', name: 'Fort Shoulder', position: [-53, 17.5, -69], exit: [-53, 17.5, -70.9], access: [-51, 17.5, -67.8] },
];

export const PADS = [
  { x: 0, z: -1, hx: 15, hz: 7.5, y: 0, material: 'plaza' },
  { x: 0, z: -12, hx: 12, hz: 5.0, y: 0, material: 'plaza' },
  { x: 17, z: 25, hx: 4, hz: 4.5, y: 0, material: 'paving' },
  { x: 12.4, z: 25, hx: 3.0, hz: 2.9, y: 0, material: 'paving' },
  { x: 25, z: 48.5, hx: 14, hz: 2.1, y: -0.15, material: 'prom' },
  { x: -48, z: -38, hx: 10, hz: 4.2, y: 8.2, material: 'lane', stage: 'hills' },
  { x: -40, z: -43, hx: 5.0, hz: 3.5, y: 11, material: 'lane', stage: 'hills' },
  // Built parcels share the same seated height as the house foundations.
  // Routes are graded afterwards, so a parcel never fills a street cutting.
  { x: -49, z: -33.5, hx: 2.45, hz: 2.3, y: 7.7, material: 'lane', stage: 'hills' },
  { x: -56.9, z: -36.1, hx: 2.4, hz: 2.45, y: 8.2, material: 'lane', stage: 'hills' },
  { x: -42.6, z: -34.2, hx: 2.45, hz: 2.3, y: 8.2, material: 'lane', stage: 'hills' },
  { x: -41, z: -47.8, hx: 2.45, hz: 2.3, y: 11, material: 'lane', stage: 'hills' },
  { x: -31.8, z: -42, hx: 2.4, hz: 2.45, y: 11, material: 'lane', stage: 'hills' },
  { x: -47.4, z: -48.5, hx: 2.1, hz: 1.8, y: 11, material: 'lane', stage: 'hills' },
  { x: -73, z: -62, hx: 9, hz: 7.5, y: 21.5, material: 'rock', stage: 'hills' },
  { x: -35, z: -76, hx: 7, hz: 7, y: 25.5, material: 'plaza', stage: 'hills' },
  ...LANDINGS.map((l) => ({ x: l.position[0], z: l.position[2], hx: 4.7, hz: 4.5, y: l.position[1], material: 'path', stage: 'full' })),
];

const stageOrder = { river: 0, hills: 1, full: 2 };
export const stageIncludes = (s = 'river', stage = WORLD_STAGE) => stageOrder[stage] >= stageOrder[s];
export const activeRoutes = () => ROUTES.filter((r) => stageIncludes(r.stage));
const smooth = THREE.MathUtils.smoothstep;
const clamp = THREE.MathUtils.clamp;

export function pathAt(points, x, z) {
  let best = { d: Infinity, y: 0, x: 0, z: 0, dx: 0, dz: 1, t: 0, segment: 0 };
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0, z0] = points[i], [x1, y1, z1] = points[i + 1];
    const dx = x1 - x0, dz = z1 - z0, length = Math.hypot(dx, dz);
    const t = clamp(((x - x0) * dx + (z - z0) * dz) / (length * length || 1), 0, 1);
    const px = x0 + dx * t, pz = z0 + dz * t, d = Math.hypot(x - px, z - pz);
    if (d < best.d) best = { d, y: y0 + (y1 - y0) * t, x: px, z: pz, dx: dx / length, dz: dz / length, t, segment: i };
  }
  return best;
}

export function pointAlong(points, distance) {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1], length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (distance <= length || i === points.length - 2) {
      const t = clamp(distance / length, 0, 1);
      return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, z: a[2] + (b[2] - a[2]) * t,
        dx: (b[0] - a[0]) / length, dz: (b[2] - a[2]) / length };
    }
    distance -= length;
  }
}

export function fbm(x, z) {
  return 0.5 + 0.23 * Math.sin(x * 0.91 + Math.cos(z * 0.74))
    + 0.15 * Math.sin(z * 1.83 + x * 0.57) + 0.08 * Math.cos(x * 3.71 - z * 2.67);
}
export const riverCentre = (x) => 59.5 + Math.sin(x * 0.036) * 1.7;
export const riverHalfWidth = (x) => 7.0 + Math.cos(x * 0.046) * 0.7;
function rawHeight(x, z) {
  let y = -0.03 + (fbm(x * 0.055, z * 0.055) - 0.5) * 0.22;
  // Broad foothill masses, not individual mountain props. The railway stays
  // on a flat graded bench; the north has no tropical or alpine silhouettes.
  const hills = [[-67, -68, 48, 43, 22], [-33, -77, 27, 31, 26], [44, -68, 44, 30, 13], [-105, -49, 35, 42, 19]];
  for (const [cx, cz, rx, rz, h] of hills) {
    const d = Math.hypot((x - cx) / rx, (z - cz) / rz);
    y = Math.max(y, h * Math.pow(Math.max(0, 1 - d * d), 1.35) - 0.1);
  }
  y += smooth(Math.abs(x), 70, 117) * (2 + fbm(x * 0.08, z * 0.07) * 4);
  const railK = 1 - smooth(Math.abs(z - RAIL_Z), 3.2, 7.5);
  y = THREE.MathUtils.lerp(y, 0.45, railK);
  const rd = Math.abs(z - riverCentre(x)), hw = riverHalfWidth(x);
  const cut = 1 - smooth(rd, hw - 0.3, hw + 2.8);
  y = THREE.MathUtils.lerp(y, -2.5, cut);
  if (z > 83) y += smooth(z, 83, 113) * (3.5 + fbm(x * 0.05, z * 0.04) * 3);
  return y;
}

// ---- farmland: level terraced plots east (sarson/wheat) and west (paddy).
// Each plot is cut to one height so crops, water and bunds sit flat.
const plot = (id, x0, z0, x1, z1, crop) => ({ id, x0, z0, x1, z1, crop, y: null });
export const FARM_PLOTS = [
  // east of the station: the mustard/wheat patchwork either side of the farm lane
  plot('e1', 48, -12, 57.4, -6.4, 'wheat'), plot('e2', 58.6, -12, 67.2, -6.4, 'wheat'),
  plot('e3', 71.0, -12, 80.6, -6.4, 'mustard'), plot('e4', 81.8, -12, 91, -6.4, 'wheat'),
  plot('e5', 48, -1.4, 57.4, 7.8, 'mustard'), plot('e6', 58.6, -1.4, 67.2, 7.8, 'mustard'),
  plot('e7', 48, 9, 57.4, 16.2, 'marigold'), plot('e8', 58.6, 9, 67.2, 16.2, 'mustard'),
  plot('e9', 48, 20, 57.4, 30, 'sugarcane'), plot('e10', 58.6, 20, 67.2, 30, 'wheat'),
  plot('e11', 71.0, 20, 80.6, 30, 'mustard'), plot('e12', 81.8, 20, 91, 30, 'marigold'),
  plot('e13', 48, 31.2, 57.4, 41, 'vegetable'), plot('e14', 58.6, 31.2, 67.2, 41, 'mustard'),
  plot('e15', 71.0, 31.2, 80.6, 41, 'wheat'), plot('e16', 81.8, 31.2, 91, 41, 'sugarcane'),
  // west, beyond the railway workers' lane: flooded paddy terraces
  plot('w1', -98, 5, -87, 15.5, 'paddy'), plot('w2', -85.5, 5, -74.5, 15.5, 'paddy'),
  plot('w3', -73, 5, -62, 15.5, 'paddy-young'), plot('w4', -60.5, 5, -49, 15.5, 'paddy'),
  plot('w5', -98, 17, -87, 26.6, 'paddy-young'), plot('w6', -85.5, 17, -74.5, 26.6, 'paddy'),
  plot('w7', -73, 17, -62, 26.6, 'paddy'), plot('w8', -60.5, 17, -49, 26.6, 'paddy-young'),
  plot('w9', -98, 31.4, -87, 41, 'paddy'), plot('w10', -85.5, 31.4, -74.5, 41, 'wheat'),
  plot('w11', -73, 31.4, -62, 41, 'paddy-young'),
];
// The east farmstead courtyard and the west farmstead/pond.
export const FARMSTEAD = { x: 81, z: 7.4, y: 0 };
export const PADDY_FARMSTEAD = { x: -54.5, z: 36.6, y: 0 };
export const POND = { x: -80, z: 45.3, r: 3.6 };
const plotDistance = (p, x, z) => Math.max(p.x0 - x, x - p.x1, p.z0 - z, z - p.z1);
export function plotLevel(p) {
  if (p.y === null) p.y = Math.round(rawHeight((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2) / 0.1) * 0.1;
  return p.y;
}
export function plotAt(x, z) {
  for (const p of FARM_PLOTS) if (plotDistance(p, x, z) <= 0) return p;
  return null;
}
export function naturalHeight(x, z) {
  let y = rawHeight(x, z);
  if (x > 40 || x < -40) {
    for (const p of FARM_PLOTS) {
      const d = plotDistance(p, x, z);
      if (d > 1.6) continue;
      y = THREE.MathUtils.lerp(y, plotLevel(p), 1 - smooth(d, 0, 1.6));
    }
    for (const f of [FARMSTEAD, PADDY_FARMSTEAD]) {
      const d = Math.max(Math.abs(x - f.x) - 6.5, Math.abs(z - f.z) - 5.2);
      if (d < 2.5) y = THREE.MathUtils.lerp(y, f.y, 1 - smooth(d, 0, 2.5));
    }
    const pd = Math.hypot(x - POND.x, z - POND.z);
    if (pd < POND.r + 1.5) y = Math.min(y, THREE.MathUtils.lerp(-1.0, y, smooth(pd, POND.r - 1.6, POND.r + 1.5)));
  }
  return y;
}

// This analytic field is sampled by the terrain mesh; a matching triangular
// lattice interpolation is used by the walker off the explicit civil works.
export function terrainField(x, z) {
  let y = naturalHeight(x, z);
  for (const p of PADS) {
    if (!stageIncludes(p.stage)) continue;
    const d = Math.max(Math.abs(x - p.x) - p.hx, Math.abs(z - p.z) - p.hz);
    const k = 1 - smooth(d, 0, 3.0);
    if (k > 0) y = THREE.MathUtils.lerp(y, p.y, k);
  }
  let closest = null, influence = 0;
  for (const r of activeRoutes()) {
    const p = pathAt(r.points, x, z), k = 1 - smooth(p.d, r.width / 2 + 0.3, r.width / 2 + 3.4);
    if (k > influence) { influence = k; closest = p; }
  }
  if (closest) y = THREE.MathUtils.lerp(y, closest.y, influence);
  return y;
}
export const TERRAIN_CELL = 1;
const nodeCache = new Map();
function node(i, j) {
  const key = `${i},${j}`;
  if (!nodeCache.has(key)) nodeCache.set(key, terrainField(i * TERRAIN_CELL, j * TERRAIN_CELL));
  return nodeCache.get(key);
}
export function groundHeight(x, z) {
  const gx = x / TERRAIN_CELL, gz = z / TERRAIN_CELL, i = Math.floor(gx), j = Math.floor(gz);
  const u = gx - i, v = gz - j;
  const a = node(i, j), b = node(i + 1, j), c = node(i, j + 1), d = node(i + 1, j + 1);
  return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
}

export function bridgeDeckY(x, z) {
  if (Math.abs(x - BRIDGE.x) > BRIDGE.halfW || z < BRIDGE.z0 || z > BRIDGE.z1) return null;
  const t = (z - BRIDGE.z0) / (BRIDGE.z1 - BRIDGE.z0);
  return Math.sin(Math.PI * t) * BRIDGE.rise;
}
export function ghatStepY(x, z) {
  if (x < GHAT.x0 || x > GHAT.x1 || z < GHAT.z0 || z > GHAT.z0 + GHAT.count * GHAT.stepD) return null;
  return -0.15 - Math.min(GHAT.count - 1, Math.floor((z - GHAT.z0) / GHAT.stepD)) * GHAT.stepH;
}
export function surfaceY(x, z) {
  let y = groundHeight(x, z);
  for (const p of PADS) {
    if (stageIncludes(p.stage) && Math.abs(x - p.x) <= p.hx && Math.abs(z - p.z) <= p.hz) y = p.y;
  }
  let bestDistance = Infinity;
  for (const r of activeRoutes()) {
    const p = pathAt(r.points, x, z);
    if (p.d <= r.width / 2 && p.d < bestDistance) {
      let ry = p.y;
      if (r.material === 'steps') ry = Math.floor(ry / 0.17) * 0.17;
      y = ry;
      bestDistance = p.d;
    }
  }
  // Platform approaches are sloped, not a height jump through a wall.
  if (x > -12.3 && x < 12.3 && z > -17 && z < -15.0) y = 0.8;
  if (Math.abs(x) < 1.6 && z >= -15 && z <= -7.5) y = clamp((-z - 7.5) / 7.5, 0, 1) * 0.8;
  if (x > 10.5 && x < 13.5 && z > -16.9 && z < -9.5) y = clamp((-z - 9.5) / 6.3, 0, 1) * 0.8;
  const bridge = bridgeDeckY(x, z);
  if (bridge !== null) y = Math.max(y, bridge);
  const ghat = ghatStepY(x, z);
  if (ghat !== null) y = ghat;
  return y;
}
export function isDeepWater(x, z) {
  if (ghatStepY(x, z) !== null) return false;
  return Math.abs(z - riverCentre(x)) < riverHalfWidth(x) + 2.5 && surfaceY(x, z) < WATER_Y + 0.035;
}
export function inWorld(x, z) {
  return x >= WORLD_BOUNDS.x0 && x <= WORLD_BOUNDS.x1 && z >= WORLD_BOUNDS.z0 && z <= WORLD_BOUNDS.z1;
}
export function surfaceAt(x, z, h = groundHeight(x, z)) {
  if (Math.abs(x - CROSSING_X) < 3 && Math.abs(z - RAIL_Z) < 3.6) return 'deck';
  if (Math.abs(z - RAIL_Z) < 2.6) return 'ballast';
  if (Math.abs(z - riverCentre(x)) < riverHalfWidth(x) + 1) return h < -0.7 ? 'bed' : 'sand';
  for (const p of PADS) {
    if (stageIncludes(p.stage) && Math.abs(x - p.x) <= p.hx && Math.abs(z - p.z) <= p.hz) return p.material;
  }
  for (const r of activeRoutes()) if (pathAt(r.points, x, z).d < r.width / 2 + 0.4) return r.material;
  if ((x > 40 || x < -40) && plotAt(x, z)) return 'field';
  return h > 5 ? 'rock' : 'grass';
}
export function districtAt(x, z) {
  if (stageIncludes('full') && Math.hypot(x + 53, z + 69) < 8) return DISTRICTS.find((d) => d.id === 'balloon');
  let nearest = DISTRICTS[0], distance = Infinity;
  for (const d of DISTRICTS) {
    if (!stageIncludes(d.stage)) continue;
    const dd = Math.hypot(x - d.anchor[0], z - d.anchor[2]) / d.radius;
    if (dd < distance) { distance = dd; nearest = d; }
  }
  return nearest;
}

// ---- farm lanes, appended once the terrain functions exist ----
function farmRoute(id, from, to, width, xz, material = 'path', stage = 'river') {
  const points = xz.map(([x, z, y]) => [x, y ?? Math.round(naturalHeight(x, z) * 100) / 100, z]);
  ROUTES.push(route(id, from, to, width, points, material, stage));
}
FARMSTEAD.y = Math.round(rawHeight(FARMSTEAD.x, FARMSTEAD.z) / 0.1) * 0.1;
PADDY_FARMSTEAD.y = Math.round(rawHeight(PADDY_FARMSTEAD.x, PADDY_FARMSTEAD.z) / 0.1) * 0.1;
farmRoute('farm-lane', 'station', 'farms', 3.2,
  [[14.5, -3.4, 0], [24, -3.7, 0], [36, -3.6, 0], [47, -4.0], [69.1, -4.0], [69.1, 8], [69.1, 18.1], [69.1, 30.6], [69.1, 43.5]], 'lane');
farmRoute('farm-cross', 'farms', 'farms', 2.4, [[47.2, 18.1, 0], [69.1, 18.1, 0], [80.5, 18.1, 0]], 'path');
farmRoute('paddy-lane', 'station', 'paddy', 2.8,
  [[-33.2, 30.0, 0], [-38, 29.6], [-44.5, 29.2], [-55, 29.0], [-68, 29.0], [-81, 29.0], [-99, 29.0]], 'path');
farmRoute('paddy-bund', 'paddy', 'paddy', 1.6, [[-61.2, 4.6], [-61.2, 16.3], [-61.2, 29.0]], 'path');
farmRoute('orchard-path', 'balloon', 'orchard', 2.6,
  [[40, 71], [48, 73.6], [58, 75.4], [70, 77.5], [84, 78.6]], 'path', 'full');
for (const d of DISTRICTS) if (['farms', 'paddy', 'orchard'].includes(d.id)) d.anchor[1] = naturalHeight(d.anchor[0], d.anchor[2]);
