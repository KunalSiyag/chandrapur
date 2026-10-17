import * as THREE from 'three';
import { toonMaterial } from '../core/toon.js';
import { terrainField, surfaceAt, fbm, TERRAIN_CELL } from './layout.js';

/** One drawn lattice, one queried lattice. Facets and broad vegetation/value
 * fields describe a valley; the skyline is terrain rather than cone props. */
export function createGround(scene) {
  const x0 = -128, z0 = -120, nx = 256, nz = 232;
  const vertices = [], colors = [], indices = [];
  const palette = {
    grass: '#4e9a36', rock: '#6e9a48', road: '#7a7468', lane: '#b8a27a', path: '#c2a173',
    paving: '#c4b89a', plaza: '#c4b89a', prom: '#b7ae96', ballast: '#7a7670',
    deck: '#b8b3a4', bed: '#3d6a6a', sand: '#d6c08e', steps: '#b2a68e', field: '#7a5a36',
  };
  const c = new THREE.Color();
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = x0 + i * TERRAIN_CELL, z = z0 + j * TERRAIN_CELL, h = terrainField(x, z);
    vertices.push(x, h - 0.055, z);
    const type = surfaceAt(x, z, h);
    c.set(palette[type] ?? palette.grass);
    const cover = fbm(x * 0.13 + 4, z * 0.13), broad = fbm(x * 0.037, z * 0.035);
    c.multiplyScalar(0.83 + cover * 0.17 + broad * 0.06);
    if (type === 'rock') c.lerp(new THREE.Color('#9a8a5a'), Math.max(0, broad - 0.45) * 0.8);
    if (type === 'grass') c.lerp(new THREE.Color('#8fbf3e'), Math.max(0, cover - 0.55) * 1.1).lerp(new THREE.Color('#2f7a34'), Math.max(0, 0.55 - broad) * 0.7);
    colors.push(c.r, c.g, c.b);
    if (j < nz && i < nx) {
      const a = j * (nx + 1) + i, b = a + 1, d = a + nx + 1, e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.setIndex(indices); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, toonMaterial(0xffffff, { vertexColors: true, paint: 0.035 }));
  mesh.name = 'valley-terrain'; mesh.receiveShadow = true; scene.add(mesh);
  return { mesh };
}
