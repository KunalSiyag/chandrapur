import * as THREE from 'three';
import { activeRoutes, surfaceY, SQUARE, BRIDGE, stageIncludes } from '../layout.js';
import { group, box, ribbon, mesh, LOCAL as C, footprint } from '../build-kit.js';
import { toonMaterial } from '../../core/toon.js';

export function buildCivilWorks(root) {
  const g = group('connected-streets');
  // dusty sandstone, worn lime-concrete and sun-bleached asphalt
  const colors = { paving: '#a48c6a', lane: '#8c806a', prom: '#988e7a', road: '#5f5b53', path: '#9e8a6a', steps: '#978b78' };
  for (const r of activeRoutes()) {
    ribbon(g, r.points, r.width, colors[r.material], { name: r.id, steps: r.material === 'steps' });
    if (r.material === 'road' || r.material === 'paving') {
      // A continuous pale drain/kerb on each side carries the road through
      // bends. It is a surface edge, not a string of inked floating slabs.
      for (const side of [-1, 1]) {
        const edge = offsetPoints(r.points, side * (r.width / 2 + 0.12));
        ribbon(g, edge, 0.19, '#8f897a', { lift: 0.028, name: `${r.id}-drain` });
      }
    }
    if (r.material === 'steps') buildTrailSteps(g, r);
    if (r.stage !== 'river' && r.material !== 'steps') buildCutFill(g, r);
  }
  box(g, SQUARE.x1 - SQUARE.x0, 0.07, SQUARE.z1 - SQUARE.z0, '#a88f6a',
    (SQUARE.x0 + SQUARE.x1) / 2, -0.025, (SQUARE.z0 + SQUARE.z1) / 2, 'station-forecourt');
  // Sparse paving joints establish the scale of the square without gridding
  // every road surface or putting clutter on the navigation axis.
  for (let x = -14; x < 15; x += 2) box(g, 0.014, 0.005, 12.5, '#7c7262', x, 0.019, -1);
  for (let z = -6.5; z < 5; z += 2) box(g, 29, 0.005, 0.014, '#7c7262', 0, 0.019, z);
  // Step-free, open platform passage and the eastern baggage ramp.
  ribbon(g, [[0, 0, -7.5], [0, 0.8, -15]], 2.8, '#958a76', { height: null, lift: 0.025, name: 'station-passage-ramp' });
  ribbon(g, [[12, 0, -9.5], [12, 0.8, -15.8]], 2.7, '#9a8f7a', { height: null, lift: 0.025, name: 'platform-side-ramp' });
  root.add(g); return g;
}

function buildCutFill(g, r) {
  for (let j = 0; j < r.points.length - 1; j++) {
    const a = r.points[j], b = r.points[j + 1], length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (Math.abs(b[1] - a[1]) / length < 0.12) continue;
    const nx = (b[2] - a[2]) / length, nz = -(b[0] - a[0]) / length;
    for (const side of [-1, 1]) {
      const p = [], idx = [], n = Math.ceil(length);
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = a[0] + (b[0] - a[0]) * t + nx * side * (r.width / 2 + 0.08),
          z = a[2] + (b[2] - a[2]) * t + nz * side * (r.width / 2 + 0.08), y = a[1] + (b[1] - a[1]) * t;
        p.push(x, y, z, x, y - 0.72, z);
        if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      mesh(g, geo, toonMaterial('#758272', { side: THREE.DoubleSide }), [0, 0, 0], 'graded-trail-stone-edge');
    }
  }
}

export function offsetPoints(points, distance) {
  return points.map((p, i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    return [p[0] + (b[2] - a[2]) / length * distance, p[1], p[2] - (b[0] - a[0]) / length * distance];
  });
}

function buildTrailSteps(g, r) {
  for (let j = 0; j < r.points.length - 1; j++) {
    const a = r.points[j], b = r.points[j + 1], rise = b[1] - a[1], n = Math.ceil(Math.abs(rise) / 0.17);
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]), yaw = Math.atan2(b[0] - a[0], b[2] - a[2]);
    for (let i = 1; i <= n; i++) {
      const t = i / n, x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t;
      const y = Math.floor((a[1] + rise * t) / 0.17) * 0.17;
      const tread = box(g, r.width, 0.16, length / n, '#9ca48f', x, y - 0.075, z); tread.rotation.y = yaw;
    }
  }
}

export function wallRun(parent, points, { h = 0.8, width = 0.3, color = C.stoneDark, collision = true, base = surfaceY } = {}) {
  const g = group('fieldstone-wall');
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1], dx = b[0] - a[0], dz = b[2] - a[2], n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 1.2));
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n, x = a[0] + dx * t, z = a[2] + dz * t;
      const length = Math.hypot(dx, dz) / n, y = base(x, z);
      const part = group('wall-section');
      box(part, width, h, length + 0.015, color, 0, h / 2, 0);
      box(part, width + 0.075, 0.09, length + 0.04, C.stone, 0, h + 0.035, 0);
      for (let row = 0; row < Math.ceil(h / 0.23); row++) {
        box(part, width + 0.02, 0.018, length - 0.04, '#9b9e8a', 0, row * 0.23 + 0.12, 0);
      }
      if (collision) footprint(part, width, length);
      part.position.set(x, y, z); part.rotation.y = Math.atan2(dx, dz); g.add(part);
    }
  }
  parent.add(g); return g;
}
