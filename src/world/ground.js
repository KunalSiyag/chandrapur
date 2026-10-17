import * as THREE from 'three';
import { toonMaterial } from '../core/toon.js';
import { terrainField, surfaceAt, fbm, TERRAIN_CELL } from './layout.js';

/** One drawn lattice, one queried lattice. Facets and broad vegetation/value
 * fields describe a valley; the skyline is terrain rather than cone props. */
export function createGround(scene) {
  const x0 = -128, z0 = -120, nx = 256, nz = 232;
  const vertices = [], colors = [], indices = [];
  const palette = {
    // late-season North Indian ground: olive, sun-dried grass, dusty earth
    grass: '#5d7a38', rock: '#76784c', road: '#6e695e', lane: '#a8916c', path: '#b09068',
    paving: '#b0a68e', plaza: '#b0a68e', prom: '#a59c88', ballast: '#6e6a62',
    deck: '#a8a294', bed: '#4a5244', sand: '#c2ad84', steps: '#a49882', field: '#6e5236',
  };
  const c = new THREE.Color();
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = x0 + i * TERRAIN_CELL, z = z0 + j * TERRAIN_CELL, h = terrainField(x, z);
    vertices.push(x, h - 0.055, z);
    const type = surfaceAt(x, z, h);
    c.set(palette[type] ?? palette.grass);
    const cover = fbm(x * 0.13 + 4, z * 0.13), broad = fbm(x * 0.037, z * 0.035);
    c.multiplyScalar(0.83 + cover * 0.17 + broad * 0.06);
    if (type === 'rock') c.lerp(new THREE.Color('#9a8a62'), Math.max(0, broad - 0.45) * 0.8);
    // dry, straw-coloured patches and darker damp-green hollows
    if (type === 'grass') c.lerp(new THREE.Color('#9a9450'), Math.max(0, cover - 0.55) * 1.1).lerp(new THREE.Color('#3e6230'), Math.max(0, 0.55 - broad) * 0.7);
    colors.push(c.r, c.g, c.b);
    if (j < nz && i < nx) {
      const a = j * (nx + 1) + i, b = a + 1, d = a + nx + 1, e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.setIndex(indices); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, toonMaterial(0xffffff, { vertexColors: true, paint: 0.06, surface: 'earth' }));
  mesh.name = 'valley-terrain'; mesh.receiveShadow = true; scene.add(mesh);
  return { mesh };
}
