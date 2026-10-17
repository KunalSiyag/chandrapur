import * as THREE from 'three';
import { flat, LOCAL } from './build-kit.js';

/**
 * Sun, moon and the hours of a Chandpur day. `time` runs 0..1 from midnight:
 * 0.25 sunrise, 0.5 noon, 0.75 sunset. Everything that should know the hour
 * (lights, fog, sky, window glass, lamp glows, river colour, post grade)
 * is driven from here, so the town reads as one coherent moment.
 */
const DAY_SECONDS = 720; // one in-game day ≈ 12 real minutes

export function createDayCycle({ scene, lights, sky, post, moon, river, startTime = 0.32 }) {
  let time = startTime;
  let timeScale = 1;
  let rushTo = null;
  const sunDir = new THREE.Vector3(), moonDir = new THREE.Vector3(), keyDir = new THREE.Vector3();
  const c = (hex) => new THREE.Color(hex);
  const P = {
    hemiSkyDay: c('#d6ecff'), hemiSkyNight: c('#a7b8df'), hemiSkyDusk: c('#ffc79a'),
    hemiGroundDay: c('#8a8a52'), hemiGroundNight: c('#4b544b'),
    sunDay: c('#fff4dc'), sunDusk: c('#ffb070'), moon: c('#ffedce'),
    fogDay: c('#c9e6f2'), fogDusk: c('#f2b58c'), fogNight: c('#182b42'),
    windowDay: c('#4d6b7f'), windowNight: c(LOCAL.warm), fireNight: c('#e8be83'),
    deepDay: c('#1f7f9a'), shallowDay: c('#58c2c4'), deepNight: c('#1b4252'), shallowNight: c('#397170'),
    glintDay: c('#fff8e0'), glintNight: c('#d8d4b4'),
  };
  // Every decorative glow (lamp sprites, light pools/cones) and every local
  // point light is a night thing. Record base values once, then scale.
  const glows = [], pointLights = [];
  function collect() {
    glows.length = 0; pointLights.length = 0;
    scene.traverse((o) => {
      let inMoon = false;
      for (let p = o; p; p = p.parent) if (p === moon.group) { inMoon = true; break; }
      if (inMoon) return;
      if (o.isPointLight || o.isSpotLight) { pointLights.push({ o, base: o.intensity }); return; }
      if (o.userData.dayVisible) return;
      const glow = o.isSprite || o.name === 'light-pool' || o.name === 'light-cone' || o.name === 'halo' || o.name === 'lamp-glow';
      if (glow && o.material && 'opacity' in o.material) glows.push({ o, base: o.material.opacity });
    });
  }
  collect();
  const windowMat = flat(LOCAL.warm);
  const fireMat = flat('#e8be83');

  let night = 0, dusk = 0, sunElev = 0;
  function apply(t) {
    const angle = (t - 0.25) * Math.PI * 2;
    // Sun rises in the east (+x), crosses the southern sky (+z), sets west.
    sunDir.set(Math.cos(angle), Math.sin(angle), 0.42 + 0.1 * Math.sin(angle)).normalize();
    sunElev = sunDir.y;
    moonDir.copy(moon.position).normalize();
    const day = THREE.MathUtils.smoothstep(sunElev, -0.1, 0.16);
    night = 1 - day;
    dusk = Math.exp(-Math.pow((sunElev - 0.03) / 0.16, 2)) * 0.95;
    // key light: the sun by day, the moon by night
    const sunK = THREE.MathUtils.smoothstep(sunElev, -0.04, 0.12);
    if (sunK > 0.001) keyDir.copy(sunDir); else keyDir.copy(moonDir);
    lights.moonLight.position.copy(keyDir).multiplyScalar(110);
    lights.moonLight.color.copy(P.sunDay).lerp(P.sunDusk, dusk);
    if (sunK <= 0.001) lights.moonLight.color.copy(P.moon);
    lights.moonLight.intensity = sunK > 0.001 ? 0.55 + sunK * 2.65 : 1.45;
    lights.hemi.color.copy(P.hemiSkyNight).lerp(P.hemiSkyDay, day).lerp(P.hemiSkyDusk, dusk * 0.45);
    lights.hemi.groundColor.copy(P.hemiGroundNight).lerp(P.hemiGroundDay, day);
    lights.hemi.intensity = THREE.MathUtils.lerp(1.15, 1.55, day);
    lights.rim.intensity = THREE.MathUtils.lerp(0.65, 0.3, day);
    lights.ambient.intensity = THREE.MathUtils.lerp(0.25, 0.32, day);
    scene.fog.color.copy(P.fogNight).lerp(P.fogDay, day).lerp(P.fogDusk, dusk * 0.7);
    scene.fog.density = THREE.MathUtils.lerp(0.0036, 0.0019, day);
    windowMat.color.copy(P.windowDay).lerp(P.windowNight, THREE.MathUtils.smoothstep(night, 0.15, 0.7));
    fireMat.color.copy(P.windowDay).lerp(P.fireNight, THREE.MathUtils.smoothstep(night, 0.15, 0.7));
    const lampK = THREE.MathUtils.smoothstep(night, 0.25, 0.75);
    for (const g of glows) g.o.material.opacity = g.base * lampK;
    for (const l of pointLights) l.o.intensity = l.base * lampK;
    sky.setState({ sunDir, moonDir, night, dusk, time: performance.now() / 1000 });
    if (river.uniforms) {
      river.uniforms.uDeep.value.copy(P.deepNight).lerp(P.deepDay, day);
      river.uniforms.uShallow.value.copy(P.shallowNight).lerp(P.shallowDay, day);
      river.uniforms.uGlint.value.copy(P.glintNight).lerp(P.glintDay, day);
    }
    post.setDayState?.({ night, dusk });
    // The moon belongs to the night sky unless she has been brought down.
    moon.group.visible = night > 0.12 || moon.isDown();
  }

  return {
    update(dt) {
      if (rushTo !== null) {
        const remaining = ((rushTo - time) % 1 + 1) % 1;
        const step = Math.min(remaining, dt * 0.09);
        time = (time + step) % 1;
        if (remaining < 0.002) { time = rushTo; rushTo = null; }
      } else {
        time = (time + dt * timeScale / DAY_SECONDS) % 1;
      }
      apply(time);
    },
    /** Rest/skip: run the clock quickly forward to `target` (0..1). */
    rushTo(target) { rushTo = ((target % 1) + 1) % 1; },
    set(t) { time = ((t % 1) + 1) % 1; rushTo = null; apply(time); },
    setScale(s) { timeScale = s; },
    recollect: collect,
    get time() { return time; },
    get night() { return night; },
    get dusk() { return dusk; },
    get rushing() { return rushTo !== null; },
    get sunDir() { return sunDir; },
    /** Light position the post pass leaks from: the sun by day, the moon by night. */
    leakSource(out) { return sunElev > 0.02 ? out.copy(sunDir).multiplyScalar(220) : out.copy(moon.position); },
    clock() {
      const minutes = Math.floor(time * 24 * 60), h = Math.floor(minutes / 60), m = minutes % 60;
      const h12 = ((h + 11) % 12) + 1;
      return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
    },
    phase() {
      const h = time * 24;
      if (h < 5) return 'Night';
      if (h < 7) return 'Dawn';
      if (h < 11) return 'Morning';
      if (h < 15.5) return 'Afternoon';
      if (h < 18.5) return 'Evening';
      if (h < 20) return 'Dusk';
      return 'Night';
    },
  };
}
