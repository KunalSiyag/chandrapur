import * as THREE from 'three';
import { toonMaterial } from '../core/toon.js';
import { BRIDGE, bridgeDeckY, groundHeight } from './layout.js';
import { addBoxRect } from './colliders.js';

/**
 * The footbridge over the river, joining the promenade to the
 * south-bank lane. Lantern posts on the landings; from its crest
 * you look back at the whole bazaar. The deck is built from the
 * same curve the player walks (layout.bridgeDeckY).
 */
export function createBridge(scene) {
  const group = new THREE.Group();
  group.name = 'footbridge';

  const { x: BX, z0: Z0, z1: Z1, rise } = BRIDGE;
  const A = new THREE.Vector3(BX, groundHeight(BX, Z0) + 0.25, Z0);
  const B = new THREE.Vector3(BX, groundHeight(BX, Z1) + 0.25, Z1);
  const mid = A.clone().lerp(B, 0.5); mid.y += rise;
  const curve = new THREE.QuadraticBezierCurve3(A, mid, B);

  const woodMat = toonMaterial(0x8a5f3c);
  const darkWood = toonMaterial(0x5f3f28);
  const stoneMat = toonMaterial(0x8d8fa3);

  // deck — sampled from the walk curve itself
  const N = 15;
  const plankGeo = new THREE.BoxGeometry(2.4, 0.16, 0.85);
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t);
    const plank = new THREE.Mesh(plankGeo, i % 2 ? woodMat : darkWood);
    plank.position.copy(p);
    plank.rotation.y = Math.atan2(tan.x, tan.z) + Math.PI / 2;
    plank.rotation.x = -Math.asin(THREE.MathUtils.clamp(tan.y, -1, 1)) * 0.7;
    plank.castShadow = plank.receiveShadow = true;
    group.add(plank);
  }

  // railings with vertical bars
  const railPts = curve.getPoints(24);
  for (const side of [-1.15, 1.15]) {
    const pts = railPts.map((p) => {
      const tan = curve.getTangent(railPts.indexOf(p) / 24);
      const sideV = new THREE.Vector3(-tan.z, 0, tan.x).normalize().multiplyScalar(side);
      return p.clone().add(sideV);
    });
    const railCurve = new THREE.CatmullRomCurve3(pts.map((p) => p.clone().add(new THREE.Vector3(0, 1.0, 0))));
    const rail = new THREE.Mesh(new THREE.TubeGeometry(railCurve, 32, 0.06, 6), darkWood);
    rail.castShadow = true;
    group.add(rail);
    const midCurve = new THREE.CatmullRomCurve3(pts.map((p) => p.clone().add(new THREE.Vector3(0, 0.35, 0.98))));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(midCurve, 32, 0.035, 5), darkWood));
    for (let i = 0; i <= 8; i++) {
      const p = curve.getPoint(i / 8);
      const tan = curve.getTangent(i / 8);
      const sideV = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.0, 6), woodMat);
      bar.position.copy(p).addScaledVector(sideV, side).add(new THREE.Vector3(0, 0.5, 0));
      bar.castShadow = true;
      group.add(bar);
    }
  }

  // warm bulbs at the four corners of the span
  const lampWarm = new THREE.MeshBasicMaterial({ color: 0xffc46b });
  for (const [t, side] of [[0.06, -1.15], [0.06, 1.15], [0.94, -1.15], [0.94, 1.15]]) {
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t);
    const sideV = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.5, 6), darkWood);
    post.position.copy(p).addScaledVector(sideV, side).add(new THREE.Vector3(0, 0.75, 0));
    group.add(post);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), lampWarm);
    lamp.position.copy(post.position).add(new THREE.Vector3(0, 0.85, 0));
    group.add(lamp);
  }

  // stone footings at both landings + two steps
  for (const p of [A, B]) {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 1, 7), stoneMat);
    foot.position.set(p.x, p.y - 0.55, p.z);
    foot.receiveShadow = true;
    group.add(foot);
    const dir = p === A ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 0, 1);
    for (let s = 0; s < 2; s++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 0.5), stoneMat);
      step.position.copy(p).addScaledVector(dir, 0.3 + s * 0.5).add(new THREE.Vector3(0, -0.18 - s * 0.15, 0));
      group.add(step);
    }
  }

  scene.add(group);
  // the railings keep you on the deck — walkable width between them
  addBoxRect(BRIDGE.x - 1.4, BRIDGE.z0 - 0.4, BRIDGE.x - 1.05, BRIDGE.z1 + 0.4);
  addBoxRect(BRIDGE.x + 1.05, BRIDGE.z0 - 0.4, BRIDGE.x + 1.4, BRIDGE.z1 + 0.4);
  return { group };
}
