import * as THREE from 'three';
import { surfaceY } from '../world/layout.js';
import { Driver, rot } from '../world/people/anim.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const cycle = (a) => ((a % 2) + 2) % 2;
const ease = (t) => t * t * (3 - 2 * t);

/** Owns skeletal posing and world-space foot plants. No camera transforms
 *  enter this rig: body yaw comes from locomotion, head gaze from input. */
export function createPlayerPose(h) {
  const d = new Driver(h, { seed: h.seed });
  const P = h.P;
  const feet = ['L', 'R'].map((side, i) => ({
    side, sign: i === 0 ? 1 : -1, offset: i,
    contact: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(),
    ankle: new THREE.Vector3(), planted: true, yaw: 0, fromYaw: 0, swingStart: 1.1,
  }));
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const middle = new THREE.Vector3();
  const localMiddle = new THREE.Vector3();
  let initialized = false;
  let wasMoving = false;
  let phase = 0;

  function heading(yaw) {
    forward.set(Math.sin(yaw), 0, Math.cos(yaw));
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));
  }

  function reset(position, yaw) {
    heading(yaw);
    for (const f of feet) {
      f.contact.copy(position).addScaledVector(right, f.sign * P.hipJx * 1.08);
      f.contact.y = surfaceY(f.contact.x, f.contact.z);
      f.from.copy(f.contact); f.to.copy(f.contact);
      f.planted = true;
      f.yaw = yaw + f.sign * 0.1;
      f.fromYaw = f.yaw;
    }
    phase = 0;
    initialized = true;
    wasMoving = false;
    d.lookInit = false;
    d.look.yaw = d.look.pitch = 0;
  }

  function update({ position, yaw, distance, moving, running, blend, lookYaw, lookPitch, dt, time }) {
    if (!initialized) reset(position, yaw);
    heading(yaw);
    const step = running ? 0.6 : 0.46;
    const stanceEnd = running ? 1.04 : 1.1;
    const lead = step * stanceEnd * 0.5;
    if (moving) {
      if (!wasMoving) {
        // Start with a planted support foot and a short first recovery step.
        phase = stanceEnd * 0.5;
        for (const f of feet) {
          const p = cycle(phase + f.offset);
          f.from.copy(f.contact); f.fromYaw = f.yaw;
          f.planted = p < stanceEnd;
          f.swingStart = Math.max(stanceEnd, p);
        }
      }
      phase += distance / step;
      for (const f of feet) {
        const p = cycle(phase + f.offset);
        if (f.planted && p >= stanceEnd) {
          f.planted = false;
          f.from.copy(f.contact); f.fromYaw = f.yaw;
          f.swingStart = stanceEnd;
        } else if (!f.planted && p < stanceEnd) {
          // Touchdown fixes both position and heading in WORLD space.
          f.contact.copy(position).addScaledVector(forward, lead - p * step)
            .addScaledVector(right, f.sign * P.hipJx * 1.08);
          f.contact.y = surfaceY(f.contact.x, f.contact.z);
          f.yaw = yaw + f.sign * 0.1;
          f.planted = true;
        }
        if (!f.planted) {
          const progress = THREE.MathUtils.clamp((p - f.swingStart) / (2 - f.swingStart), 0, 1);
          f.to.copy(position).addScaledVector(forward, (2 - p) * step + lead)
            .addScaledVector(right, f.sign * P.hipJx * 1.08);
          f.contact.lerpVectors(f.from, f.to, ease(progress));
          f.contact.y = surfaceY(f.contact.x, f.contact.z) + Math.sin(progress * Math.PI) * (running ? 0.075 : 0.05);
          f.yaw = f.fromYaw + wrap(yaw + f.sign * 0.1 - f.fromYaw) * ease(progress);
        }
      }
    } else {
      // Stop at the existing plants. Land the free foot without sliding it
      // sideways, then balance the pelvis above this support midpoint.
      for (const f of feet) {
        f.contact.y = surfaceY(f.contact.x, f.contact.z);
        f.planted = true;
      }
    }
    wasMoving = moving;

    d.place(position.x, position.y, position.z, yaw);
    d.reset();
    const b = h.b;
    if (!moving) {
      middle.copy(feet[0].contact).add(feet[1].contact).multiplyScalar(0.5);
      localMiddle.copy(middle);
      h.group.worldToLocal(localMiddle);
      b.hips.position.x = localMiddle.x;
      b.hips.position.z = localMiddle.z;
    }

    // Keep the actual thigh/shin chain within reach of BOTH foot plants.
    // Pelvis height may soften the knees; pelvis pitch is always zero.
    let hipY = P.hip - 0.012 + (moving ? Math.abs(Math.sin(phase * Math.PI)) * 0.005 : 0);
    const reach = P.thigh + P.shin - 0.005;
    for (const f of feet) {
      const localX = b.hips.position.x + f.sign * P.hipJx;
      const hipX = position.x + right.x * localX + forward.x * b.hips.position.z;
      const hipZ = position.z + right.z * localX + forward.z * b.hips.position.z;
      f.ankle.copy(f.contact).sub(b['foot' + f.side].userData.soleOffset);
      const horizontalSq = (f.ankle.x - hipX) ** 2 + (f.ankle.z - hipZ) ** 2;
      const vertical = Math.sqrt(Math.max(0.001, reach ** 2 - horizontalSq));
      hipY = Math.min(hipY, f.ankle.y + vertical - position.y - (P.hipJy - P.hip));
    }
    b.hips.position.y = hipY;

    // One bounded intentional motion pitch, distributed along the spine.
    // It is zero on the FIRST stationary frame, independent of arm blending.
    const lean = moving ? (running ? 0.065 : 0.035) * blend : 0;
    rot(b.spine, lean * 0.65, 0, 0);
    rot(b.chest, lean * 0.35, 0, 0);
    d.breathe(time, 1 + blend * 0.4, { pitch: false });
    h.group.updateMatrixWorld(true);
    for (const f of feet) d.legWorld(f.side, f.ankle, f.yaw);

    const swing = moving ? Math.sin(phase * Math.PI) * 0.42 * blend : 0;
    d.arm('L', 0.08 + swing, 0.07, 0, 0.26 + Math.max(0, swing) * 0.25);
    d.arm('R', 0.08 - swing, 0.07, 0, 0.26 + Math.max(0, -swing) * 0.25);
    // Explicit gaze is confined to the neck/head; the camera never parents
    // or rotates the pelvis, spine, mesh, or root bone.
    const gaze = THREE.MathUtils.clamp(wrap(lookYaw - yaw), -1.1, 1.1);
    d.lookYP(gaze, moving ? -lean : lookPitch, dt, { speed: 8 });
    d.blink(time);
    h.group.updateMatrixWorld(true);
    h.mesh.skeleton.update();
  }

  return { reset, update };
}
