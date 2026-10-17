import * as THREE from 'three';
import { toonMaterial } from '../core/toon.js';
import { group, batchStatic, registerCollisions } from './build-kit.js';
import { stageIncludes, DISTRICTS, ROUTES, LANDINGS, WORLD_STAGE } from './layout.js';
import { buildCivilWorks } from './districts/civil.js';
import { buildStationQuarter } from './districts/station-quarter.js';
import { buildBazaar } from './districts/bazaar.js';
import { buildGhats } from './districts/ghats.js';
import { buildHillDistricts } from './districts/hills.js';
import { buildFarms } from './districts/farms.js';
import { makeBunting } from './farm-kit.js';
import { ROUTES as ALL_ROUTES, pointAlong } from './layout.js';
import { clearColliders } from './colliders.js';

export function buildTown(scene) {
  clearColliders();
  const root = group('chandpur-town'); scene.add(root);
  const districts = [buildCivilWorks(root), buildStationQuarter(root), buildBazaar(root), buildGhats(root)];
  if (stageIncludes('hills')) districts.push(...buildHillDistricts(root));
  const farms = buildFarms(root); districts.push(farms);
  districts.push(buildFestival(root));
  registerCollisions(root);
  const updaters = [];
  root.traverse((o) => { if (o.userData.update) updaters.push(o.userData.update); });
  const batchReport = districts.map((g) => ({ district: g.name, ...batchStatic(g) }));
  return { group: root, solids: districts, spots: farms.userData.spots, updaters, batchReport, districts: DISTRICTS.filter((d) => stageIncludes(d.stage)),
    routes: ROUTES.filter((r) => stageIncludes(r.stage)), landings: LANDINGS, stage: WORLD_STAGE };
}

/** Festival dressing: jhandiyan strung across the bazaar and station forecourt. */
function buildFestival(root) {
  const g = group('festival-bunting');
  const spine = ALL_ROUTES.find((r) => r.id === 'bazaar-spine').points;
  for (const d of [3, 11, 20, 27, 35, 44]) {
    const p = pointAlong(spine, d), nx = p.dz, nz = -p.dx;
    g.add(makeBunting({ from: [p.x - nx * 3.0, 5.1, p.z - nz * 3.0], to: [p.x + nx * 3.0, 5.1, p.z + nz * 3.0], count: 11, sag: 0.45, size: 0.28 }));
  }
  for (const [a, b] of [[[-14.5, 4.6, 5.0], [-1, 4.2, -8.6]], [[14.5, 4.6, 5.0], [1, 4.2, -8.6]], [[-14.5, 4.6, 5.0], [14.5, 4.6, 5.0]]]) {
    g.add(makeBunting({ from: a, to: b, count: 22, sag: 0.9, size: 0.3 }));
  }
  for (const x of [-14.5, 14.5]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.7, 7), toonMaterial('#a9874e'));
    pole.position.set(x, 2.35, 5.0); pole.castShadow = true; g.add(pole);
  }
  root.add(g); return g;
}
