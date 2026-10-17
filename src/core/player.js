import * as THREE from 'three';
import { surfaceY, isDeepWater, inWorld } from '../world/layout.js';
import { resolveXZ } from '../world/colliders.js';
import { Human } from '../world/people/human.js';
import { createPlayerPose } from './player-pose.js';

// ============================================================
// The night-walker: the person you play, built on the same
// skinned, painted rig as every other townsperson — cream
// kurta and maroon waistcoat, a real walk with planted feet,
// blinking eyes. Camera trails the shoulders, pulled in by
// walls, never dipping under the town.
// ============================================================

const EYE = 1.62;
const WALK = 3.2;
const RUN = 5.9;

function faceM(o = {}) {
  return { skin: '#e8b48e', ink: '#3b3144', eyeP: 24, eyeT: -12, eyeW: 19, eyeH: 15, irisDark: '#4a3346', irisMid: '#6a4a3e', irisLight: '#a07a5e',
    lash: 0.5, lidTop: -0.48, iris: 0.36, irisH: 0.5, brow: '#4a3428', browW: 2.4, browArch: 1.4, browGap: 3,
    noseT: -32, mouthT: -52, mouthW: 10, smile: 0.15, blush: 0.25, ...o };
}
const HAIR = { top: '#2a222c', base: '#201a22', tip: '#1a141c', hi: '#4a3f4e', hi2: '#6a5a72' };

function makeAvatar() {
  const h = new Human({
    key: 'avatar', sex: 'm', height: 1.66, seed: 3, skin: '#e8b48e', ears: true,
    face: faceM(),
    hair: { fringe: { n: 6, span: 56, tip: 6, skew: 10, w: 0.055, edgeDrop: 14 }, hairlineSide: -18, hairlineBack: -66, volume: 1.08, side: { w: 0.028 } },
    hairTex: HAIR,
    outfit: { kind: 'kurta-vest', topColor: '#e8e0d0', waistcoat: '#5a3c30', bottomColor: '#d8cfbf', shoes: '#4a3a30' },
    variants: ['open', 'blink'],
  });
  return { group: h.group, h };
}

export function createPlayer(input, camera, opts = {}) {
  const spawn = opts.spawn ?? new THREE.Vector3(5, 0, -3);
  const avatar = makeAvatar();
  const root = avatar.group;
  const h = avatar.h;
  const pose = createPlayerPose(h);
  opts.scene?.add(root);
  // The deterministic rig harness supplies its own collision registry. In
  // the live app this is the shared town resolver (Vite URLs must not create
  // a second empty singleton registry during an isolated test import).
  const resolvePosition = opts.resolveXZ ?? resolveXZ;

  // state
  const pos = spawn.clone();
  pos.y = surfaceY(pos.x, pos.z);
  let yaw = opts.yaw ?? -2.9;          // facing the station passage
  let camYaw = yaw;
  let camPitch = 0.12;
  let camDist = 3.6;
  let blend = 0;                       // 0 idle → 1 walking, eased
  let settle = 1;
  let tSim = 0;
  const tmp = new THREE.Vector3();
  const before = new THREE.Vector3();
  let lookYaw = yaw;
  let lookPitch = 0;
  let transported = false;
  let cameraBlend = null;
  let air = 0, vy = 0;                 // jump: height above the ground and its velocity

  function snapTo(p, t) {
    pos.set(p.x, surfaceY(p.x, p.z), p.z);
    const head = new THREE.Vector3(pos.x, pos.y + EYE, pos.z);
    camYaw = Math.atan2(t.x - head.x, t.z - head.z);
    const dv = new THREE.Vector3(t.x - head.x, t.y - head.y, t.z - head.z);
    camPitch = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp((t.y - head.y) / dv.length(), -1, 1)), -0.62, 1.0);
    yaw = camYaw;
    lookYaw = yaw;
    lookPitch = -camPitch;
    blend = 0;
    pose.reset(pos, yaw);
    pose.update({ position: pos, yaw, moving: false, distance: 0, running: false,
      blend, lookYaw, lookPitch, dt: 0, time: tSim });
  }

  function update(dt) {
    if (transported) return;
    settle = Math.min(1, settle + dt / 1.4);
    tSim += dt;

    // ---- look ----
    const sens = 0.0026;
    camYaw -= input.lookDX * sens;
    camPitch = THREE.MathUtils.clamp(camPitch + input.lookDY * sens, -0.62, 1.0);
    camDist = THREE.MathUtils.clamp(camDist + input.zoomDelta * 0.006, 2.0, 6.5);
    if (input.lookDX || input.lookDY) {
      lookYaw = camYaw;
      lookPitch = THREE.MathUtils.clamp(-camPitch, -0.55, 0.5);
    }

    // ---- move, camera-relative ----
    let ix = 0, iz = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) iz += 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) iz -= 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) ix -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) ix += 1;
    const wantsMove = ix !== 0 || iz !== 0;
    const running = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = running ? RUN : WALK;
    before.copy(pos);
    if (wantsMove) {
      const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
      tmp.set((sin * iz - cos * ix), 0, (cos * iz + sin * ix)).normalize();
      const next = pos.clone().addScaledVector(tmp, speed * dt);
      if (!inWorld(next.x, next.z)) {
        next.copy(pos);
      }
      if (isDeepWater(next.x, next.z)) {
        const nx = pos.clone(); nx.x = next.x;
        const nz = pos.clone(); nz.z = next.z;
        if (!isDeepWater(nx.x, nx.z)) pos.copy(nx);
        else if (!isDeepWater(nz.x, nz.z)) pos.copy(nz);
      } else {
        pos.copy(next);
      }
      resolvePosition(pos, 0.34);
    }
    // Gait and lean follow displacement AFTER collision/water resolution.
    // Pressing into a wall is idle, not a walk cycle on the spot.
    tmp.copy(pos).sub(before); tmp.y = 0;
    const distance = tmp.length();
    const moving = distance > 1e-5;
    blend = THREE.MathUtils.lerp(blend, moving ? Math.min(1, distance / (speed * Math.max(dt, 1e-6))) : 0,
      Math.min(1, dt * (moving ? 7 : 9)));
    if (moving) {
      const wantYaw = Math.atan2(tmp.x, tmp.z);
      let dYaw = wantYaw - yaw;
      while (dYaw > Math.PI) dYaw -= Math.PI * 2;
      while (dYaw < -Math.PI) dYaw += Math.PI * 2;
      yaw += dYaw * Math.min(1, dt * 12);
      lookYaw = wantYaw;
      lookPitch = 0;
    }

    // ---- jump ----
    if (input.wasPressed('Space') && air === 0) { vy = 5.4; air = 0.001; opts.onJump?.(); }
    if (air > 0) { vy -= 15 * dt; air = Math.max(0, air + vy * dt); if (air === 0) { vy = 0; opts.onLand?.(); } }

    // ---- stand on the town ----
    const gy = surfaceY(pos.x, pos.z);
    pos.y = THREE.MathUtils.lerp(pos.y, gy, Math.min(1, dt * 10));
    const footY = pos.y;
    pos.y = footY + air;

    pose.update({ position: pos, yaw, distance, moving: moving && air === 0, running, blend: air > 0 ? blend * 0.4 : blend,
      lookYaw, lookPitch, dt, time: tSim });
    pos.y = footY;

    // ---- follow camera ----
    const focus = new THREE.Vector3(pos.x, pos.y + EYE + air * 0.6, pos.z);
    const dist = camDist * (settle < 1 ? THREE.MathUtils.lerp(7.5, 1, settle) : 1);
    const cd = new THREE.Vector3(
      Math.sin(camYaw) * Math.cos(camPitch),
      Math.sin(camPitch),
      Math.cos(camYaw) * Math.cos(camPitch),
    ).multiplyScalar(-dist);
    const desired = focus.clone().add(cd);
    const dir = desired.clone().sub(focus);
    const len = dir.length();
    dir.normalize();
    const ray = new THREE.Raycaster(focus, dir, 0.1, len);
    const hits = ray.intersectObjects(opts.solids ?? [], true);
    const dd = hits.length ? Math.max(0.6, hits[0].distance - 0.25) : len;
    camera.position.copy(focus).addScaledVector(dir, dd);
    const groundMin = surfaceY(camera.position.x, camera.position.z) + 0.35;
    if (camera.position.y < groundMin) camera.position.y = groundMin;
    camera.lookAt(focus);
    if (cameraBlend) {
      cameraBlend.time = Math.min(1, cameraBlend.time + dt / 1.3);
      const k = cameraBlend.time * cameraBlend.time * (3 - 2 * cameraBlend.time);
      camera.position.lerpVectors(cameraBlend.position, camera.position.clone(), k);
      camera.quaternion.slerpQuaternions(cameraBlend.quaternion, camera.quaternion.clone(), k);
      if (cameraBlend.time === 1) cameraBlend = null;
    }

    input.consumeFrame();
  }

  pose.reset(pos, yaw);
  pose.update({ position: pos, yaw, moving: false, distance: 0, running: false,
    blend, lookYaw, lookPitch, dt: 0, time: tSim });

  return {
    group: root,
    update,
    snapTo,
    enterTransport() { transported = true; root.visible = false; },
    placeTransport(p) { pos.copy(p); root.position.copy(p); },
    exitTransport(p, target) {
      cameraBlend = { time: 0, position: camera.position.clone(), quaternion: camera.quaternion.clone() };
      transported = false; root.visible = true; settle = 1;
      snapTo(p, target);
    },
    get transported() { return transported; },
    get position() { return pos; },
    get yaw() { return yaw; },
    get cameraYaw() { return camYaw; },
    get airborne() { return air > 0; },
  };
}
