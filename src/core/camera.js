import * as THREE from 'three';
import { WORLD_BOUNDS } from '../world/layout.js';

/**
 * Cinematic orbit camera.
 * - Slow auto-drift until the user grabs it.
 * - Drag to orbit, wheel to zoom, WASD/arrows to pan the target.
 * - `flyTo()` for HUD buttons / agent tools.
 * - `update()` applies damping + optional intro sweep.
 */
export function createCamera(input) {
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);

  // the opening frame: the lantern street running north to the station
  const target = new THREE.Vector3(0, 2.6, -9);
  const spherical = new THREE.Spherical(24, 1.45, 0.06);

  let autoRotate = true;
  let tween = null;
  let introT = 0;
  const introFrom = new THREE.Spherical(74, 1.05, 1.35);
  const introTo = spherical.clone();
  let introDone = false;

  function stopAuto() {
    autoRotate = false;
  }
  window.addEventListener('pointerdown', stopAuto, { once: true });
  window.addEventListener('wheel', stopAuto, { once: true });

  function flyTo({ distance = 26, phi = Math.PI / 2.7, theta = Math.PI * 0.4, lookAt = null, duration = 1.6 } = {}) {
    tween = {
      t: 0,
      duration,
      fromS: spherical.clone(),
      toS: new THREE.Spherical(distance, phi, theta),
      fromT: target.clone(),
      toT: lookAt ? lookAt.clone() : target.clone(),
    };
    introDone = true; // a directed shot always cancels the intro
    autoRotate = false;
  }

  function cinematicMoonShot(moonPos) {
    // Frame the moon beside the scene — never dead-center, so the glow
    // sprite can't fill the screen and blow out the exposure.
    const side = new THREE.Vector3().subVectors(moonPos, target).normalize();
    const lookAt = target.clone().addScaledVector(side, 4);
    lookAt.y = Math.min(lookAt.y, 8);
    flyTo({
      distance: 38,
      phi: Math.PI / 2.75,
      theta: Math.atan2(side.x, side.z) + 0.95,
      lookAt,
      duration: 2.2,
    });
  }

  /** Instant, exact placement — debug shots and the screenshot runner. */
  function snapTo(p, t) {
    tween = null;
    introDone = true;
    autoRotate = false;
    target.copy(t);
    const offset = p.clone().sub(t);
    spherical.set(offset.length(), Math.acos(THREE.MathUtils.clamp(offset.y / offset.length(), -1, 1)), Math.atan2(offset.x, offset.z));
  }

  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  function update(dt, elapsed) {
    // Intro sweep over ~3.5s
    if (!introDone) {
      introT += dt / 3.5;
      const k = easeInOut(Math.min(introT, 1));
      spherical.radius = THREE.MathUtils.lerp(introFrom.radius, introTo.radius, k);
      spherical.phi = THREE.MathUtils.lerp(introFrom.phi, introTo.phi, k);
      spherical.theta = THREE.MathUtils.lerp(introFrom.theta, introTo.theta, k);
      if (introT >= 1) introDone = true;
    } else if (tween) {
      tween.t += dt / tween.duration;
      const k = easeInOut(Math.min(tween.t, 1));
      spherical.radius = THREE.MathUtils.lerp(tween.fromS.radius, tween.toS.radius, k);
      spherical.phi = THREE.MathUtils.lerp(tween.fromS.phi, tween.toS.phi, k);
      spherical.theta = THREE.MathUtils.lerp(tween.fromS.theta, tween.toS.theta, k);
      target.lerpVectors(tween.fromT, tween.toT, k);
      if (tween.t >= 1) tween = null;
    } else {
      if (autoRotate) spherical.theta += dt * 0.03;
      // drag orbit (clamp only while actually dragging, so a low
      // tween that looks up at the sky isn't snapped back)
      if (input.dragDX || input.dragDY) {
        spherical.theta -= input.dragDX * 0.005;
        spherical.phi = THREE.MathUtils.clamp(spherical.phi - input.dragDY * 0.004, 0.3, 2.6);
      }
      spherical.radius = THREE.MathUtils.clamp(spherical.radius * (1 + input.zoomDelta * 0.0012), 2, 175);
      // pan
      const speed = 12 * dt;
      const fwd = new THREE.Vector3();
      camera.getWorldDirection(fwd);
      fwd.y = 0;
      fwd.normalize();
      const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).negate();
      if (input.isDown('KeyW') || input.isDown('ArrowUp')) target.addScaledVector(fwd, speed);
      if (input.isDown('KeyS') || input.isDown('ArrowDown')) target.addScaledVector(fwd, -speed);
      if (input.isDown('KeyA') || input.isDown('ArrowLeft')) target.addScaledVector(right, -speed);
      if (input.isDown('KeyD') || input.isDown('ArrowRight')) target.addScaledVector(right, speed);
      target.x = THREE.MathUtils.clamp(target.x, WORLD_BOUNDS.x0, WORLD_BOUNDS.x1);
      target.z = THREE.MathUtils.clamp(target.z, WORLD_BOUNDS.z0, WORLD_BOUNDS.z1);
      target.y = THREE.MathUtils.clamp(target.y, 0.5, 50);
    }

    input.consumeFrame();

    const pos = new THREE.Vector3().setFromSpherical(spherical).add(target);
    // gentle breathing bob
    pos.y += Math.sin(elapsed * 0.5) * 0.15;
    camera.position.copy(pos);
    camera.lookAt(target);
  }

  // initial placement
  camera.position.setFromSpherical(introFrom).add(target);
  camera.lookAt(target);

  return { camera, target, update, flyTo, snapTo, cinematicMoonShot, stopAuto };
}
