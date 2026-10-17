import * as THREE from 'three';

/**
 * Agent tools: small scene API for console tinkering, automated checks,
 * and the headless screenshot runner. In-browser: `window.__moon.help()`.
 */
export function createAgentTools({ scene, camera, camCtl, player, mode, moon, river, post, music, toggleMoon, toggleCinema }) {
  const raycaster = new THREE.Raycaster();
  const sourceOf = (hit) => hit.object.userData.sourceRanges?.find((r) => hit.faceIndex < r.end)?.source
    ?? hit.object.name ?? hit.object.parent?.name ?? hit.object.type;

  function sceneInfo() {
    const meshes = [];
    scene.traverse((o) => {
      if (o.isMesh || o.isPoints || o.isSprite) {
        meshes.push({ name: o.name || o.type, type: o.type, pos: o.getWorldPosition(new THREE.Vector3()).toArray().map((n) => +n.toFixed(2)) });
      }
    });
    return {
      objects: scene.children.length,
      camera: { pos: camera.position.toArray().map((n) => +n.toFixed(2)), target: camCtl.target.toArray().map((n) => +n.toFixed(2)) },
      moon: { pos: moon.position.toArray().map((n) => +n.toFixed(2)), down: moon.isDown() },
      meshes: meshes,
    };
  }

  /**
   * Geometry critique of the current frame: where the moon sits on
   * screen, whether it is occluded (and by what, where), and what the
   * exact centre of the frame lands on. Only meshes count as
   * occluders — points and sprites are decoration, not walls.
   */
  function frameInfo() {
    camera.updateMatrixWorld();
    raycaster.camera = camera;
    const out = { camera: camera.position.toArray().map((n) => +n.toFixed(2)) };

    const NON_BLOCKERS = ['moon-glow', 'light-pool', 'light-cone', 'river', 'sky-dome', 'stars', 'avatar'];
    const isBlocker = (h) => {
      let n = h.object;
      while (n) {
        if (NON_BLOCKERS.includes(n.name) || (n.userData && n.userData.ghost)) return false;
        n = n.parent;
      }
      return h.object.isMesh;
    };

    // moon on screen
    const ndc = moon.position.clone().project(camera);
    out.moonNDC = [+ndc.x.toFixed(3), +ndc.y.toFixed(3)];
    out.moonVisible = ndc.x > -1 && ndc.x < 1 && ndc.y > -1 && ndc.y < 1 && ndc.z < 1;

    // occlusion: 5 rays across the moon's apparent disc (±4 m at the
    // moon's distance, scaled so the offset is an angle, not a swing)
    const toMoon = moon.position.clone().sub(camera.position);
    const dist = toMoon.length();
    const dir = toMoon.clone().normalize();
    const sideU = new THREE.Vector3().crossVectors(dir, camera.up).normalize();
    const upU = new THREE.Vector3().crossVectors(sideU, dir).normalize();
    const off = 4 / dist;
    let blocked = 0;
    const occluders = [];
    for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const d = dir.clone().addScaledVector(sideU, ox * off).addScaledVector(upU, oy * off).normalize();
      raycaster.set(camera.position, d);
      raycaster.far = dist - 8;
      const hits = raycaster.intersectObjects(scene.children, true).filter(isBlocker);
      if (hits.length) {
        blocked++;
        const h = hits[0];
        occluders.push({
          what: sourceOf(h),
          at: h.point.toArray().map((n) => +n.toFixed(1)),
        });
      }
    }
    out.moonBlockedFrac = +(blocked / 5).toFixed(2);
    out.moonOccluders = occluders.slice(0, 5);

    // centre-of-frame hit
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    raycaster.far = Infinity;
    const centre = raycaster.intersectObjects(scene.children, true).find(isBlocker);
    out.centreHit = centre ? sourceOf(centre) : 'sky';
    out.centreDist = centre ? +centre.distance.toFixed(1) : Infinity;
    return out;
  }

  return {
    help() {
      return [
        '__moon.help() — this list',
        '__moon.sceneInfo() — counts + positions',
        '__moon.frameInfo() — moon placement, occlusion, centre hit',
        '__moon.viewFrom(px,py,pz, tx,ty,tz) — stand at p, look at t',
        '__moon.toggleMoon() — bring down / send home',
        '__moon.moonDown() / __moon.moonHome()',
        '__moon.flyTo({distance, phi, theta, lookAt})',
        '__moon.cinema() — moon framing shot',
        '__moon.setBloom({strength, radius, threshold})',
        '__moon.sound(on?) — toggle or force music',
      ].join('\n');
    },
    sceneInfo,
    frameInfo,
    /** the walker's own state (position + facing), for debug shots */
    playerInfo() {
      return {
        pos: player.position.toArray().map((n) => +n.toFixed(2)),
        yaw: +player.yaw.toFixed(3),
      };
    },
    /** instant exact camera placement (orbit mode) — no tween, for the runner */
    orbitSnap(px, py, pz, tx, ty, tz) {
      camCtl.snapTo(new THREE.Vector3(px, py, pz), new THREE.Vector3(tx, ty, tz));
      return true;
    },

    /** switch walk <-> cinema (orbit) — orbit gives the runner a deterministic camera */
    cinemaMode(on) {
      if (on === undefined) return toggleCinema ? toggleCinema() : null;
      const want = !!on;
      for (let attempts = 0; attempts < 2 && mode() !== (want ? 'orbit' : 'walk'); attempts++) {
        if (!toggleCinema) return mode();
        toggleCinema();
      }
      return mode();
    },
    /** positions of every node with a matching name (landmark probes) */
    find(name) {
      const out = [];
      scene.traverse((o) => {
        if (o.name === name) out.push(o.getWorldPosition(new THREE.Vector3()).toArray().map((n) => +n.toFixed(2)));
      });
      return out;
    },
    /** project a world point to screen px (for landmark probes) */
    project(x, y, z) {
      camera.updateMatrixWorld();
      const v = new THREE.Vector3(x, y, z).project(camera);
      return {
        x: +((v.x * 0.5 + 0.5) * window.innerWidth).toFixed(1),
        y: +((0.5 - v.y * 0.5) * window.innerHeight).toFixed(1),
        visible: v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1,
      };
    },
    toggleMoon,
    moonDown() { if (!moon.isDown()) return toggleMoon(); return true; },
    moonHome() { if (moon.isDown()) return toggleMoon(); return false; },
    flyTo(opts) { camCtl.flyTo(opts); return true; },
    /** Stand the walker at (px,pz) on the ground, aimed at t — the runner's verb. */
    viewFrom(px, py, pz, tx, ty, tz) {
      if (mode() === 'walk' && player) {
        player.snapTo(new THREE.Vector3(px, py, pz), new THREE.Vector3(tx, ty, tz));
      } else {
        const p = new THREE.Vector3(px, py, pz);
        const t = new THREE.Vector3(tx, ty, tz);
        const offset = p.clone().sub(t);
        camCtl.flyTo({
          distance: offset.length(),
          phi: Math.acos(THREE.MathUtils.clamp(offset.y / offset.length(), -1, 1)),
          theta: Math.atan2(offset.x, offset.z),
          lookAt: t, duration: 0.05,
        });
      }
      return true;
    },
    /** Convenience: stand at ground height of (x,z), look at t. */
    standAt(x, z, tx, ty, tz) {
      return this.viewFrom(x, 0, z, tx, ty, tz);
    },
    cinema() { camCtl.cinematicMoonShot(moon.position); return true; },
    setBloom(p) { post.setBloom(p); return true; },
    async sound(on) {
      if (on === true && !music.playing) await music.play();
      else if (on === false && music.playing) await music.pause();
      else await music.toggle();
      return music.playing;
    },
  };
}
