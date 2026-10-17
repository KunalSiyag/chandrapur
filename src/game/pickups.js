import * as THREE from 'three';
import { toonMaterial } from '../core/toon.js';
import { ROUTES, pointAlong, surfaceY, isDeepWater } from '../world/layout.js';
import { isBlocked } from '../world/colliders.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { tint } from '../world/farm-kit.js';

// Floating, spinning, glinting things to pick up: marigolds (genda phool),
// ripe mangoes and old one-rupee coins hidden along every lane. Walk into
// them. Each pickup bursts into a little shower of coloured sparks.

let sparkTex = null;
function sparkTexture() {
  if (sparkTex) return sparkTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,240,200,0.8)'); g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  sparkTex = new THREE.CanvasTexture(c); sparkTex.colorSpace = THREE.SRGBColorSpace;
  return sparkTex;
}

// Each pickup is one merged, vertex-coloured mesh (one draw call).
const T = (geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sc = null) => {
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
  if (sc) m.scale(new THREE.Vector3(...sc));
  m.setPosition(x, y, z); return geo.applyMatrix4(m);
};
const geoCache = new Map(), matCache = new Map();
function merged(kind, build) {
  if (!geoCache.has(kind)) {
    const parts = build().map(([geo, color]) => tint(geo, color));
    const g = mergeGeometries(parts, false); parts.forEach((p) => p.dispose()); geoCache.set(kind, g);
  }
  if (!matCache.has('vc')) matCache.set('vc', toonMaterial(0xffffff, { vertexColors: true, paint: 0.02 }));
  const m = new THREE.Mesh(geoCache.get(kind), matCache.get('vc')); m.castShadow = true;
  const g = new THREE.Group(); g.add(m); return g;
}
function marigoldModel() {
  return merged('marigold', () => {
    const out = [];
    for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 10 - ring * 3; i++) {
      const a = i / (10 - ring * 3) * Math.PI * 2 + ring, r = 0.16 - ring * 0.05;
      out.push([T(new THREE.SphereGeometry(0.07, 6, 4), Math.cos(a) * r, ring * 0.045, Math.sin(a) * r, 0, -a, 0, [1.4, 0.6, 1]), ring % 2 ? '#ffb000' : '#ff8c1a']);
    }
    out.push([T(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 4), 0, -0.17, 0), '#3f8a35']);
    return out;
  });
}
function mangoModel() {
  return merged('mango', () => [
    [T(new THREE.SphereGeometry(0.16, 12, 9), 0, 0, 0, 0, 0, 0, [0.85, 1.15, 0.8]), '#f5b82a'],
    [T(new THREE.SphereGeometry(0.12, 10, 8), 0.05, 0.05, 0.06, 0, 0, 0, [0.8, 1, 0.6]), '#ef6a2a'],
    [T(new THREE.BoxGeometry(0.08, 0.015, 0.2), 0.05, 0.2, 0, 0, 0, 0.5), '#2f8a3e'],
  ]);
}
function coinModel() {
  return merged('coin', () => [
    [T(new THREE.CylinderGeometry(0.2, 0.2, 0.045, 20), 0, 0, 0, Math.PI / 2), '#ffcc33'],
    [new THREE.TorusGeometry(0.2, 0.022, 6, 20), '#e0a020'],
    [new THREE.BoxGeometry(0.05, 0.16, 0.06), '#d08a10'],
    [T(new THREE.BoxGeometry(0.14, 0.035, 0.06), 0, 0.05, 0), '#d08a10'],
  ]);
}
const MODELS = { marigold: marigoldModel, mango: mangoModel, coin: coinModel };
const GLOW = { marigold: '#ffb04a', mango: '#ffd060', coin: '#fff0a0' };

export function createPickups(scene, { onPick }) {
  const root = new THREE.Group(); root.name = 'pickups'; scene.add(root);
  const items = [];
  const bursts = [];

  function spawn(kind, id, x, y, z) {
    const g = new THREE.Group(); g.name = `pickup-${kind}`;
    const model = MODELS[kind](); g.add(model);
    let glow = null;
    if (kind !== 'coin') {
      glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTexture(), color: GLOW[kind], transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.setScalar(1.1); glow.userData.dayVisible = true; glow.layers.set(1); g.add(glow);
    }
    g.position.set(x, y, z); root.add(g);
    const item = { kind, id, group: g, model, glow, base: y, phase: Math.random() * 6, taken: false };
    items.push(item); return item;
  }

  function burst(position, color) {
    const n = 26, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) {
      pos[i * 3] = position.x; pos[i * 3 + 1] = position.y; pos[i * 3 + 2] = position.z;
      const a = Math.random() * Math.PI * 2, u = Math.random() * 0.9 + 0.2;
      vel.push(new THREE.Vector3(Math.cos(a) * u * 2.2, 2 + Math.random() * 2.5, Math.sin(a) * u * 2.2));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.16, map: sparkTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.layers.set(1); pts.frustumCulled = false; scene.add(pts);
    bursts.push({ pts, vel, life: 0 });
  }

  /** Lay coins along every lane: some in plain sight, some tucked aside. */
  function scatterCoins(taken = new Set()) {
    let n = 0;
    for (const r of ROUTES) {
      let total = 0;
      for (let i = 0; i < r.points.length - 1; i++) total += Math.hypot(r.points[i + 1][0] - r.points[i][0], r.points[i + 1][2] - r.points[i][2]);
      const step = r.material === 'steps' ? 9 : 13;
      for (let d = step * 0.6; d < total - 2; d += step) {
        const p = pointAlong(r.points, d), side = (n % 3 - 1) * (r.width * 0.32);
        const x = p.x + p.dz * side, z = p.z - p.dx * side;
        if (isBlocked(x, z, 0.4) || isDeepWater(x, z)) continue;
        const id = `coin-${r.id}-${Math.round(d)}`;
        n++;
        if (!taken.has(id)) spawn('coin', id, x, surfaceY(x, z) + 0.9, z);
      }
    }
    return n;
  }

  const tmp = new THREE.Vector3();
  return {
    group: root, items, spawn, burst, scatterCoins,
    clear(kind) { for (const it of items) if (it.kind === kind && !it.taken) { it.taken = true; root.remove(it.group); } },
    remaining(kind) { return items.filter((i) => i.kind === kind && !i.taken).length; },
    nearestOf(kind, p) {
      let best = null, bd = Infinity;
      for (const it of items) if (it.kind === kind && !it.taken) { const d = it.group.position.distanceToSquared(p); if (d < bd) { bd = d; best = it; } }
      return best;
    },
    update(t, dt, playerPos, active = true) {
      for (const it of items) {
        if (it.taken) continue;
        const g = it.group;
        const far = Math.abs(g.position.x - playerPos.x) > 48 || Math.abs(g.position.z - playerPos.z) > 48;
        g.visible = !far;
        if (far) continue;
        g.position.y = it.base + Math.sin(t * 2.2 + it.phase) * 0.12;
        it.model.rotation.y = t * (it.kind === 'coin' ? 2.6 : 1.4) + it.phase;
        if (it.glow) it.glow.material.opacity = 0.45 + Math.sin(t * 4 + it.phase) * 0.15;
        if (!active) continue;
        tmp.copy(playerPos); tmp.y += 0.9;
        if (Math.abs(g.position.x - tmp.x) < 1.4 && Math.abs(g.position.z - tmp.z) < 1.4 && g.position.distanceTo(tmp) < 1.35) {
          it.taken = true; root.remove(g);
          burst(g.position, GLOW[it.kind]);
          onPick?.(it);
        }
      }
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i]; b.life += dt;
        const a = b.pts.geometry.attributes.position;
        for (let k = 0; k < b.vel.length; k++) {
          b.vel[k].y -= 6 * dt;
          a.array[k * 3] += b.vel[k].x * dt; a.array[k * 3 + 1] += b.vel[k].y * dt; a.array[k * 3 + 2] += b.vel[k].z * dt;
        }
        a.needsUpdate = true; b.pts.material.opacity = Math.max(0, 1 - b.life / 1.1);
        if (b.life > 1.1) { scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); bursts.splice(i, 1); }
      }
    },
  };
}

/** A tall saffron marker that hovers over the current objective. */
export function createObjectiveMarker(scene) {
  const g = new THREE.Group(); g.name = 'objective-marker';
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshBasicMaterial({ color: '#ff9a1a' }));
  gem.scale.y = 1.5; g.add(gem);
  const inner = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), new THREE.MeshBasicMaterial({ color: '#fff2a0' }));
  inner.scale.y = 1.5; g.add(inner);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.4, 40, 10, 1, true), new THREE.MeshBasicMaterial({ color: '#ffb84a', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  beam.position.y = -20.5; g.add(beam);
  for (const o of [gem, inner, beam]) o.layers.set(1);
  g.visible = false; scene.add(g);
  const target = new THREE.Vector3();
  return {
    group: g,
    set(p) { if (!p) { g.visible = false; return; } target.copy(p); g.visible = true; },
    update(t, playerPos) {
      if (!g.visible) return;
      const near = Math.hypot(target.x - playerPos.x, target.z - playerPos.z);
      g.position.set(target.x, target.y + 3.1 + Math.sin(t * 2.4) * 0.2, target.z);
      gem.rotation.y = t * 1.6; inner.rotation.y = -t * 2.2;
      const s = THREE.MathUtils.clamp(near / 18, 0.7, 2.6); g.scale.setScalar(s);
      beam.material.opacity = THREE.MathUtils.clamp((near - 6) / 30, 0, 0.25);
    },
  };
}

/** Fireworks over the river for the finale (anar and rocket bursts). */
export function createFireworks(scene) {
  const shells = [];
  const colors = ['#ff4a6a', '#ffd000', '#4affb0', '#4ab0ff', '#ff8c1a', '#d07aff', '#ffffff'];
  function launch(x, z, y = 18) {
    const n = 90, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) {
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u), sp = 6 + Math.random() * 2;
      vel.push(new THREE.Vector3(r * Math.cos(a) * sp, u * sp, r * Math.sin(a) * sp));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: colors[Math.floor(Math.random() * colors.length)], size: 0.5, map: sparkTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.layers.set(1); pts.frustumCulled = false; scene.add(pts);
    shells.push({ pts, vel, life: 0 });
  }
  let timer = 0, running = 0;
  return {
    start(seconds = 30) { running = seconds; },
    get running() { return running > 0; },
    update(dt) {
      if (running > 0) {
        running -= dt; timer -= dt;
        if (timer <= 0) { timer = 0.35 + Math.random() * 0.5; launch(-5 + Math.random() * 50, 55 + Math.random() * 14, 14 + Math.random() * 10); }
      }
      for (let i = shells.length - 1; i >= 0; i--) {
        const s = shells[i]; s.life += dt;
        const a = s.pts.geometry.attributes.position;
        for (let k = 0; k < s.vel.length; k++) {
          s.vel[k].multiplyScalar(1 - dt * 1.4); s.vel[k].y -= 2.5 * dt;
          a.array[k * 3] += s.vel[k].x * dt; a.array[k * 3 + 1] += s.vel[k].y * dt; a.array[k * 3 + 2] += s.vel[k].z * dt;
        }
        a.needsUpdate = true; s.pts.material.opacity = Math.max(0, 1 - s.life / 2.2);
        if (s.life > 2.2) { scene.remove(s.pts); s.pts.geometry.dispose(); s.pts.material.dispose(); shells.splice(i, 1); }
      }
    },
  };
}
