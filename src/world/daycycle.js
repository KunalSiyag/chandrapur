import * as THREE from 'three';
import { flat, LOCAL } from './build-kit.js';

/**
 * Sun, moon and the hours of a Chandrapur day. `time` runs 0..1 from midnight:
 * 0.25 sunrise, 0.5 noon, 0.75 sunset. Everything that should know the hour
 * (lights, fog, sky, image-based light, window glow, lamp glows, river
 * colour, exposure) is driven from here, so the town reads as one coherent
 * moment. Sunlight colour and fog/horizon colour come from the sky's
 * atmosphere model, so the light always matches the sky it falls from.
 */
const DAY_SECONDS = 720; // one in-game day ≈ 12 real minutes

const SUN_INTENSITY = 4.0;   // noon sun, scene units (white albedo ≈ 1.0 lit)
const MOON_INTENSITY = 0.36; // full moon key, read through the night exposure

export function createDayCycle({ scene, lights, sky, post, moon, river, startTime = 0.32 }) {
  let time = startTime;
  let timeScale = 1;
  let rushTo = null;
  const sunDir = new THREE.Vector3(), moonDir = new THREE.Vector3(), keyDir = new THREE.Vector3();
  const c = (hex) => new THREE.Color(hex);
  const P = {
    moon: c('#aebfe0'), hemiSkyNight: c('#5c74a8'), hemiGroundNight: c('#2c2a28'),
    groundAlbedo: c('#9a846a'),
    windowDay: c('#262d33'), windowNight: c(LOCAL.warm), fireNight: c('#e8be83'),
    deepDay: c('#22322c'), shallowDay: c('#4a5a46'), deepNight: c('#060c10'), shallowNight: c('#0e1a1c'),
    glintDay: c('#fff1d6'), glintNight: c('#cfd8ee'),
  };
  // Every decorative glow (lamp sprites, light pools/cones) and every local
  // point light is a night thing. Record base values once, then scale.
  const glows = [], pointLights = [], lines = [];
  function collect() {
    glows.length = 0; pointLights.length = 0; lines.length = 0;
    scene.traverse((o) => {
      let inMoon = false;
      for (let p = o; p; p = p.parent) if (p === moon.group) { inMoon = true; break; }
      if (inMoon) return;
      if (o.isPointLight || o.isSpotLight) { pointLights.push({ o, base: o.intensity }); return; }
      // unlit strings/wires: darken with the light so they don't glow at night
      if (o.isLine && o.material?.color) { lines.push({ o, base: o.material.color.clone() }); return; }
      if (o.userData.dayVisible) return;
      const glow = o.isSprite || o.name === 'light-pool' || o.name === 'light-cone' || o.name === 'halo' || o.name === 'lamp-glow';
      if (glow && o.material && 'opacity' in o.material) glows.push({ o, base: o.material.opacity });
    });
  }
  collect();
  const windowMat = flat(LOCAL.warm);
  const fireMat = flat('#e8be83');
  const haze = new THREE.Color();
  const sunCol = new THREE.Color(), skyTint = new THREE.Color(), ground = new THREE.Color(), tmp = new THREE.Color();
  const smooth = THREE.MathUtils.smoothstep, lerp = THREE.MathUtils.lerp;

  let night = 0, dusk = 0, sunElev = 0;
  function apply(t) {
    const angle = (t - 0.25) * Math.PI * 2;
    // Sun rises in the east (+x), crosses the southern sky (+z), sets west.
    sunDir.set(Math.cos(angle), Math.sin(angle), 0.42 + 0.1 * Math.sin(angle)).normalize();
    sunElev = sunDir.y;
    moonDir.copy(moon.position).normalize();
    const day = smooth(sunElev, -0.1, 0.16);
    night = 1 - day;
    dusk = Math.exp(-Math.pow((sunElev - 0.03) / 0.16, 2)) * 0.95;

    sky.setState({ sunDir, moonDir, night, dusk, time: performance.now() / 1000 });

    // ---- key light: the sun through the atmosphere by day, the moon by night.
    // Both fade to zero around the switch, so the shadow direction never pops.
    const strength = sky.sunlight(sunDir, sunCol);
    const sunK = smooth(sunElev, -0.03, 0.06);
    const moonK = smooth(-sunElev, 0.05, 0.2);
    const L = lights.moonLight;
    if (sunK > 0.001) {
      keyDir.copy(sunDir);
      // soften Preetham's very red low sun a touch (the eye adapts to warm light)
      L.color.setRGB(Math.pow(sunCol.r, 0.8), Math.pow(sunCol.g, 0.8), Math.pow(sunCol.b, 0.8));
      L.intensity = SUN_INTENSITY * sunK * Math.pow(Math.max(strength, 0.02), 0.55);
    } else {
      keyDir.copy(moonDir);
      L.color.copy(P.moon);
      L.intensity = MOON_INTENSITY * moonK * (moon.isDown() ? 0.6 : 1);
    }
    L.position.copy(keyDir).multiplyScalar(110);

    // ---- sky fill: weak hemisphere on top of the image-based sky light
    skyTint.copy(sky.fogColor);
    const fl = Math.max(1e-4, skyTint.r, skyTint.g, skyTint.b);
    skyTint.multiplyScalar(1 / fl).lerp(P.hemiSkyNight, night);
    lights.hemi.color.copy(skyTint);
    lights.hemi.groundColor.copy(P.groundAlbedo).multiply(sunCol).lerp(P.hemiGroundNight, night);
    lights.hemi.intensity = lerp(0.12, 0.2, night);
    // ground bounce, from below and opposite the key (warm by day)
    lights.rim.color.copy(P.groundAlbedo).multiply(L.color);
    lights.rim.position.set(-keyDir.x * 60, -25, -keyDir.z * 60);
    lights.rim.intensity = L.intensity * Math.max(keyDir.y, 0) * 0.16;
    lights.ambient.intensity = 0;

    // ---- environment ground hemisphere (the bounce the IBL sees)
    ground.copy(P.groundAlbedo).multiply(tmp.copy(L.color).multiplyScalar(L.intensity * Math.max(keyDir.y, 0) / Math.PI))
      .add(tmp.copy(sky.fogColor).multiply(P.groundAlbedo).multiplyScalar(0.8));
    sky.setGround(ground);
    scene.environmentIntensity = lerp(0.5, 1.1, night);
    sky.updateEnvironment(post.renderer, scene);

    // ---- atmosphere: fog takes the sky's own horizon colour
    scene.fog.color.copy(sky.fogColor);
    scene.fog.density = lerp(0.0021, 0.002, night) + dusk * 0.0003;

    // ---- the town's own lights
    const lampK = smooth(night, 0.25, 0.75);
    const winK = smooth(night, 0.15, 0.7);
    windowMat.color.copy(P.windowDay).lerp(tmp.copy(P.windowNight).multiplyScalar(0.62), winK);
    fireMat.color.copy(P.windowDay).lerp(tmp.copy(P.fireNight).multiplyScalar(0.7), winK);
    for (const g of glows) g.o.material.opacity = g.base * lampK * 0.8;
    for (const l of pointLights) l.o.intensity = l.base * lampK * 0.7;
    for (const l of lines) l.o.material.color.copy(l.base).multiplyScalar(lerp(1, 0.1, night));

    if (river.uniforms) {
      river.uniforms.uDeep.value.copy(P.deepNight).lerp(P.deepDay, day);
      river.uniforms.uShallow.value.copy(P.shallowNight).lerp(P.shallowDay, day);
      river.uniforms.uGlint.value.copy(P.glintNight).lerp(P.glintDay, day);
      if (river.uniforms.uMoonPath) river.uniforms.uMoonPath.value = smooth(night, 0.5, 1.0) * (moon.group.visible ? 1 : 0);
    }
    // scattered key light in the dusty air (post adds it toward the sun/moon)
    haze.copy(L.color).multiplyScalar(L.intensity * (sunK > 0.001 ? 0.07 + dusk * 0.08 : 0.05));
    post.setDayState?.({ night, dusk, sunElev, haze });
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
