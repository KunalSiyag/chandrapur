import * as THREE from 'three';
import { toonMaterial } from '../core/toon.js';
import { groundHeight } from './layout.js';

// ============================================================
// The balloon vibe. Three drifting lanterns of the sky over the
// valley — saffron gores with a green band (the big one, who
// keeps the moon company over the river), an indigo one sewn
// with gold zigzag and stars over the east fields, a little
// red-green mela one far off past the hill — and one tethered
// above the station square for the coming fair. Burner flames
// flicker; baskets sway under the mouths like slow pendulums.
// ============================================================

function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Gored envelope textures, painted the way real Indian balloons
 *  are sewn: vertical panels in two or three colours, a pattern
 *  band around the equator, a dark scorch near the mouth. */
function balloonTexture({ gores, band, bandDots = null, stars = false, zigzag = false }) {
  return canvasTex(512, (ctx, S) => {
    const gw = S / gores.length;
    gores.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.fillRect(Math.floor(i * gw), 0, Math.ceil(gw) + 1, S);
    });
    // the equator band (canvas y: v≈0.62 → y≈0.4·S)
    const y0 = S * 0.36, bh = S * 0.11;
    ctx.fillStyle = band;
    ctx.fillRect(0, y0, S, bh);
    ctx.fillStyle = '#f4e8c8';
    ctx.fillRect(0, y0 - 5, S, 5);
    ctx.fillRect(0, y0 + bh, S, 5);
    if (zigzag) {
      // a gold zigzag lace over the band
      ctx.strokeStyle = '#e8b93a';
      ctx.lineWidth = 7;
      ctx.beginPath();
      for (let x = 0; x <= S; x += 26) {
        ctx.lineTo(x, y0 + bh / 2 + ((x / 26) % 2 ? -1 : 1) * bh * 0.28);
      }
      ctx.stroke();
    }
    if (bandDots) {
      ctx.fillStyle = bandDots;
      for (let x = 14; x < S; x += 28) {
        ctx.beginPath();
        ctx.arc(x, y0 + bh / 2, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (stars) {
      ctx.fillStyle = '#f2e6c0';
      for (let i = 0; i < 26; i++) {
        const a = (i * 137.5) % 360 * Math.PI / 180;
        const x = (i * 197.3) % S, y = (i * 89.7 + 31) % S;
        if (y > y0 - 10 && y < y0 + bh + 10) continue;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        for (let k = 0; k < 4; k++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(0, 0); ctx.lineTo(3.4, 9); ctx.lineTo(-3.4, 9);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }
    }
    // the mouth glows with burner light — at night the whole envelope
    // reads like a paper lantern, brightest near the throat
    const scorch = ctx.createLinearGradient(0, S, 0, S * 0.74);
    scorch.addColorStop(0, 'rgba(255,186,96,0.95)');
    scorch.addColorStop(0.45, 'rgba(255,166,80,0.45)');
    scorch.addColorStop(1, 'rgba(255,150,70,0)');
    ctx.fillStyle = scorch;
    ctx.fillRect(0, S * 0.74, S, S * 0.26);
  });
}

// envelope profile (r, y) — a classic teardrop
const PROFILE = [
  [0.34, 0], [0.62, 0.42], [1.15, 1.3], [1.72, 2.6], [1.95, 3.6],
  [1.9, 4.35], [1.6, 5.1], [1.05, 5.7], [0.62, 6.0], [0.3, 6.08], [0.02, 6.12],
];

function makeBalloon({ tex, scale = 1, light = false }) {
  const g = new THREE.Group();
  const s = scale;

  const pts = PROFILE.map(([r, y]) => new THREE.Vector2(r * s, y * s));
  // the envelope carries its own lantern glow (emissiveMap = the painted
  // texture, so the bright gores and the burner band shine from within)
  const env = new THREE.Mesh(
    new THREE.LatheGeometry(pts, 24),
    toonMaterial(0xffffff, {
      map: tex, paint: 0.02, side: THREE.DoubleSide,
      emissive: 0xffb070, emissiveIntensity: 0.85, emissiveMap: tex,
    }),
  );
  env.castShadow = true;
  env.name = 'balloon-envelope';
  g.add(env);

  // mouth ring
  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.34 * s, 0.045 * s, 8, 20),
    toonMaterial(0x5a4432),
  );
  mouth.rotation.x = Math.PI / 2;
  g.add(mouth);

  // ---- the hanging part: burner, ropes, wicker basket (sways as one) ----
  const hang = new THREE.Group();
  g.add(hang);
  const wicker = toonMaterial(0x8a6a42);
  const dark = toonMaterial(0x3a2f24);

  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * s, 0.27 * s, 0.34 * s, 12), wicker);
  basket.position.y = -1.02 * s;
  basket.castShadow = true;
  hang.add(basket);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3 * s, 0.03 * s, 8, 16), dark);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -0.85 * s;
  hang.add(rim);

  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const from = new THREE.Vector3(sx * 0.3 * s, -0.02, sz * 0.3 * s);
    const to = new THREE.Vector3(sx * 0.26 * s, -0.86 * s, sz * 0.26 * s);
    const mid = from.clone().add(to).multiplyScalar(0.5);
    const len = from.distanceTo(to);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012 * s, 0.012 * s, len, 5), dark);
    rope.position.copy(mid);
    rope.lookAt(from);
    rope.rotateX(Math.PI / 2);
    hang.add(rope);
  }

  const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.11 * s, 0.12 * s, 10), dark);
  burner.position.y = -0.4 * s;
  hang.add(burner);

  // the flame: an additive cone breathing up into the mouth
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.16 * s, 0.6 * s, 12),
    new THREE.MeshBasicMaterial({
      color: 0xff9a3c, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }),
  );
  flame.position.y = -0.05 * s;
  flame.name = 'flame';
  hang.add(flame);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeFlareTexture(), color: 0xffa04a, transparent: true, opacity: 0.7,
    depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  glow.scale.setScalar(1.6 * s);
  glow.position.y = 0.1 * s;
  hang.add(glow);

  let lamp = null;
  if (light) {
    lamp = new THREE.PointLight(0xffa04a, 30, 34, 1.6);
    lamp.position.y = 0;
    hang.add(lamp);
  }

  g.name = 'hot-air-balloon';
  return { group: g, env, hang, flame, glow, lamp, s };
}

function makeFlareTexture() {
  return canvasTex(64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,214,150,0.95)');
    g.addColorStop(0.5, 'rgba(255,180,90,0.3)');
    g.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}

export function createBalloons(scene) {
  const group = new THREE.Group();
  group.name = 'balloons';
  const updaters = [];

  const texSaffron = balloonTexture({
    gores: Array.from({ length: 12 }, (_, i) => (i % 2 ? '#f2e2c4' : '#e8842a')),
    band: '#2e7a4a', bandDots: '#f4e8c8',
  });
  const texIndigo = balloonTexture({
    gores: Array.from({ length: 10 }, (_, i) => (i % 2 ? '#3a4a80' : '#26355f')),
    band: '#324066', zigzag: true, stars: true,
  });
  const texMela = balloonTexture({
    gores: Array.from({ length: 12 }, (_, i) => ['#b03a34', '#e8d8b8', '#2e7a4a'][i % 3]),
    band: '#e8931a',
  });

  // anchor, drift radius, drift speed, bob, spin, phase
  const DRIFTERS = [
    { tex: texSaffron, scale: 1.0, ax: -34, ay: 30, az: 48, r: 6, w: 0.021, ph: 0.0, light: true },   // keeps the moon company
    { tex: texIndigo, scale: 0.72, ax: 46, ay: 41, az: 10, r: 10, w: 0.013, ph: 2.1, light: false },  // over the east fields
    { tex: texMela, scale: 0.5, ax: -76, ay: 50, az: -6, r: 14, w: 0.008, ph: 4.2, light: false },    // far past the hill
  ];

  for (const d of DRIFTERS) {
    const b = makeBalloon({ tex: d.tex, scale: d.scale, light: d.light });
    b.group.position.set(d.ax, d.ay, d.az);
    b.group.name = 'balloon-drift';
    group.add(b.group);
    updaters.push((t) => {
      const ang = t * d.w + d.ph;
      b.group.position.set(
        d.ax + Math.cos(ang) * d.r,
        d.ay + Math.sin(t * 0.5 + d.ph) * 0.8 + Math.sin(t * 0.13) * 0.4,
        d.az + Math.sin(ang) * d.r * 0.55,
      );
      b.group.rotation.y = t * 0.03 + d.ph;
      // the basket trails like a slow pendulum
      b.hang.rotation.z = Math.sin(t * 0.6 + d.ph) * 0.05;
      b.hang.rotation.x = Math.sin(t * 0.42 + d.ph * 2) * 0.04;
      // burner flame
      const fl = 1 + Math.sin(t * 8.5 + d.ph) * 0.28 + Math.sin(t * 21 + d.ph) * 0.09;
      b.flame.scale.set(1, fl, 1);
      b.flame.material.opacity = 0.65 + Math.sin(t * 11 + d.ph) * 0.2;
      b.glow.material.opacity = 0.55 + Math.sin(t * 9 + d.ph) * 0.18;
      if (b.lamp) b.lamp.intensity = 26 * (0.75 + Math.sin(t * 10 + d.ph) * 0.3);
    });
  }

  // ---- the tethered mela balloon above the station square ----
  {
    const sx = -7, sz = -1.6;
    const b = makeBalloon({ tex: texMela, scale: 0.42, light: false });
    b.group.position.set(sx, 15.5, sz);
    b.group.name = 'balloon-mela';
    group.add(b.group);

    // the tether: a rope from her mouth down to a fairground stake
    const ropeMat = new THREE.MeshBasicMaterial({ color: 0x2a241c });
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 5), ropeMat);
    rope.name = 'tether';
    group.add(rope);
    const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.5, 8), toonMaterial(0x6a5a44));
    stake.position.set(sx, groundHeight(sx, sz) + 0.25, sz);
    stake.castShadow = true;
    stake.userData.solidCircle = 0.2;
    group.add(stake);
    const anchor = new THREE.Vector3(sx, groundHeight(sx, sz) + 0.4, sz);
    const mouthWorld = new THREE.Vector3();

    updaters.push((t) => {
      const ang = t * 0.05;
      b.group.position.set(
        sx + Math.cos(ang) * 1.1,
        15.5 + Math.sin(t * 0.5) * 0.35,
        sz + Math.sin(ang) * 0.7,
      );
      b.group.rotation.y = t * 0.05;
      b.hang.rotation.z = Math.sin(t * 0.7) * 0.07;
      b.hang.rotation.x = Math.sin(t * 0.5 + 1) * 0.05;
      const fl = 1 + Math.sin(t * 9) * 0.3 + Math.sin(t * 23) * 0.1;
      b.flame.scale.set(1, fl, 1);
      b.flame.material.opacity = 0.6 + Math.sin(t * 12) * 0.2;
      b.glow.material.opacity = 0.5 + Math.sin(t * 10) * 0.16;
      // keep the rope taut between mouth and stake
      mouthWorld.set(b.group.position.x, b.group.position.y - 0.05, b.group.position.z);
      rope.position.copy(anchor).add(mouthWorld).multiplyScalar(0.5);
      rope.lookAt(mouthWorld);
      const len = anchor.distanceTo(mouthWorld);
      rope.scale.set(1, len, 1);
      rope.rotateX(Math.PI / 2);
    });
  }

  scene.add(group);
  return { group, updaters };
}
