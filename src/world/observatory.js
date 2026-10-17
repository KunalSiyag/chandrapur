import * as THREE from 'three';
import { toonMaterial } from '../core/toon.js';
import { PAD, groundHeight } from './layout.js';
import { bench, streetLamp, flowerPot } from './props.js';

/**
 * The hilltop house with the observatory: a small cottage whose
 * roof carries a dome, a south deck with a telescope, a warm
 * window and a chimney breathing smoke. From up here the whole
 * town lies below and the moon hangs just above the rooftops.
 */
export function createObservatory(scene) {
  const group = new THREE.Group();
  group.name = 'observatory';
  const y0 = groundHeight(PAD.x, PAD.z);
  group.position.set(PAD.x, y0, PAD.z);
  group.rotation.y = 0.42; // faces the town south-east
  group.userData.solid = true;

  const wallMat = toonMaterial(0xa89a80);
  const woodMat = toonMaterial(0x6e5a42);
  const roofMat = toonMaterial(0x7a4438);
  const darkMat = toonMaterial(0x2c313a);

  // cottage body — an old hill bungalow
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 3, 3.6), wallMat);
  body.position.y = 1.5;
  body.castShadow = body.receiveShadow = true;
  group.add(body);

  // gable roof
  const hw = 2.5, hd = 2.0, rh = 1.5;
  const g = new THREE.BufferGeometry();
  const v = new Float32Array([
    -hw, 0, -hd, hw, 0, -hd, 0, rh, -hd,
    -hw, 0, hd, 0, rh, hd, hw, 0, hd,
    -hw, 0, -hd, 0, rh, -hd, 0, rh, hd, -hw, 0, -hd, 0, rh, hd, -hw, 0, hd,
    hw, 0, -hd, hw, 0, hd, 0, rh, hd, hw, 0, -hd, 0, rh, hd, 0, rh, -hd,
  ]);
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  const roof = new THREE.Mesh(g, roofMat);
  roof.position.y = 3;
  roof.castShadow = true;
  group.add(roof);

  // the dome on a drum — the observatory itself
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.8, 12), darkMat);
  drum.position.set(-0.6, 3.4 + 0.8, -0.4);
  drum.castShadow = true;
  group.add(drum);
  const domeMat = toonMaterial(0x5d667e);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.15, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
  dome.position.set(-0.6, 4.2, -0.4);
  dome.castShadow = true;
  group.add(dome);
  // the slit — a dark slot facing the moon (south-west)
  const slit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.05, 0.34), new THREE.MeshBasicMaterial({ color: 0x0c1018 }));
  slit.position.set(-1.15, 4.65, -0.05);
  slit.rotation.z = 0.1;
  slit.rotation.y = 0.42;
  group.add(slit);

  // south deck with the telescope
  const deck = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.14, 2.0), woodMat);
  deck.position.set(0.4, 0.55, 2.7);
  deck.castShadow = true;
  group.add(deck);
  for (let i = 0; i < 6; i++) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.8, 4), woodMat);
    bar.position.set(-1.5 + i * 0.6, 1.0, 3.6);
    group.add(bar);
  }
  const deckRail = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.05, 0.05), woodMat);
  deckRail.position.set(0.4, 1.4, 3.6);
  group.add(deckRail);

  // the telescope, aimed at the moon
  const scope = new THREE.Group();
  const tripod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.22, 0.95, 6), darkMat);
  tripod.position.y = 0.48;
  scope.add(tripod);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 1.1, 10), toonMaterial(0x3e4a66));
  tube.position.set(0, 1.15, 0);
  tube.rotation.x = Math.PI / 2 - 0.85; // tilted up toward the sky
  tube.rotation.z = 0.55;
  tube.castShadow = true;
  scope.add(tube);
  scope.position.set(0.6, 0.62, 2.9);
  group.add(scope);

  // door + warm windows
  const winGlow = new THREE.MeshBasicMaterial({ color: 0xffc46b });
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.8, 0.12), toonMaterial(0x46342a));
  door.position.set(-1.4, 0.9, 1.85);
  group.add(door);
  const porchLight = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), winGlow);
  porchLight.position.set(-0.7, 2.3, 1.88);
  group.add(porchLight);
  for (const [wx, wz] of [[0.4, 1.83], [1.6, 1.83]]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.8, 0.1), woodMat);
    frame.position.set(wx, 1.7, wz);
    group.add(frame);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.6), winGlow);
    pane.position.set(wx, 1.7, wz + 0.06);
    group.add(pane);
  }
  const inner = new THREE.PointLight(0xffb45e, 22, 12, 1.9);
  inner.position.set(0, 1.8, 0);
  group.add(inner);

  // chimney (smoke is attached in particles.js)
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.3, 0.55), toonMaterial(0x70665a));
  chimney.position.set(1.35, 3.9, -0.9);
  chimney.castShadow = true;
  group.add(chimney);

  // deck furniture: a bench, a lamp, pots
  const b = bench({ len: 1.4 });
  b.position.set(-1.2, 0.62, 3.0);
  b.rotation.y = Math.PI + 0.4;
  group.add(b);
  const lamp = streetLamp({ h: 3, arm: 0.5 });
  lamp.position.set(2.2, 0.55, 2.4);
  group.add(lamp);
  for (const [px, pz, hue] of [[-2.1, 1.9, 0xd85a6a], [2.15, 1.95, 0xe8b44a]]) {
    const pot = flowerPot({ hue });
    pot.position.set(px, 0.62, pz);
    group.add(pot);
  }

  scene.add(group);
  const chimneyTop = new THREE.Vector3(PAD.x, y0 + 4.8, PAD.z).add(new THREE.Vector3(1.35 * Math.cos(0.42), 0, -1.35 * Math.sin(0.42)));

  return {
    group,
    chimneyTop,
    update(t) {
      inner.intensity = 22 + Math.sin(t * 7.1) * 2;
    },
  };
}
