import * as THREE from 'three';
import { MOON_HOME, MOON_DOWN } from './layout.js';

/**
 * The Moon — the way she actually looks from Earth: one flat,
 * self-lit disc, always showing the same familiar face. The
 * maria are painted in their true places (Procellarum, Imbrium,
 * Serenitatis, Tranquillitatis, Crisium… Tycho with its rays),
 * the whole disc is gently limb-darkened, and it billboards —
 * turn anywhere in town and she is facing you, exactly like the
 * real thing. `bringDown()` is the finale: low over the water,
 * close enough to touch.
 */
export function createMoon(scene) {
  const group = new THREE.Group();
  group.name = 'moon';

  const HOME = MOON_HOME.clone();
  const DOWN = MOON_DOWN.clone();
  group.position.copy(HOME);

  // ---- the face of the moon, painted ----
  const tex = makeMoonTexture();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(6.5, 72),
    new THREE.MeshBasicMaterial({ map: tex, fog: false }),
  );
  disc.name = 'moon-disc';
  group.add(disc);

  // ---- a whisper of an atmosphere halo pressed against her ----
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(7.1, 48),
    new THREE.MeshBasicMaterial({
      color: 0xcfd8ec, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }),
  );
  halo.name = 'halo';
  halo.position.z = -0.02;
  group.add(halo);

  // ---- the big soft moonglow behind her ----
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(), transparent: true, opacity: 0.5, depthWrite: false,
    blending: THREE.AdditiveBlending, color: 0xfff2c0, fog: false,
  }));
  glow.scale.setScalar(20);
  glow.name = 'moon-glow';
  group.add(glow);

  const light = new THREE.PointLight(0xffe9b0, 80, 60, 1.8);
  group.add(light);

  scene.add(group);

  let mode = 'home'; // 'home' | 'down'
  let t = 1;
  const from = HOME.clone();
  const to = HOME.clone();
  const camPos = new THREE.Vector3(0, 1.6, 0);

  function bringDown() { flyTo(DOWN); }
  function sendHome() { flyTo(HOME); }
  function toggle() { (mode === 'home' ? bringDown : sendHome)(); }
  function flyTo(dest) {
    from.copy(group.position);
    to.copy(dest);
    t = 0;
    mode = dest === DOWN ? 'down' : 'home';
  }

  function update(dt, elapsed, camera) {
    if (t < 1) {
      t = Math.min(1, t + dt / 3.2);
      const k = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      group.position.lerpVectors(from, to, k);
    }
    // gentle float + glow pulse
    group.position.y += Math.sin(elapsed * 0.6) * dt * 0.25;
    const s = 20 + Math.sin(elapsed * 1.2) * 0.7;
    glow.scale.setScalar(s);
    halo.material.opacity = 0.13 + Math.sin(elapsed * 0.8) * 0.02;

    // she always faces you — the same face, from anywhere
    if (camera) {
      camPos.copy(camera.position);
      disc.lookAt(camPos);
      halo.lookAt(camPos);
    }
  }

  return { group, update, bringDown, sendHome, toggle, get position() { return group.position; }, isDown: () => mode === 'down' };
}

// ------------------------------------------------------------
// The true face: full moon, north up. Maria in their real
// places; Tycho's rays brushed across the southern highlands;
// limb darkening so the disc still feels round at a glance.
// ------------------------------------------------------------
function makeMoonTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const cx = S / 2, cy = S / 2, R = S / 2 - 4;

  // seeded wiggle so the face is stable
  let seed = 7;
  const rnd = () => { const x = Math.sin(seed++ * 127.1) * 43758.5453; return x - Math.floor(x); };

  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();

  // bright highlands
  const base = ctx.createRadialGradient(cx, cy - 30, 40, cx, cy, R);
  base.addColorStop(0, '#f4eeda');
  base.addColorStop(0.7, '#ece4cd');
  base.addColorStop(1, '#d8cfba');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);

  // highland mottle
  for (let i = 0; i < 240; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R;
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
    const r = 4 + rnd() * 14;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const warm = rnd() > 0.5;
    g.addColorStop(0, warm ? 'rgba(226,214,186,0.10)' : 'rgba(240,236,220,0.10)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // ---- the maria: slightly blue-gray, soft-edged irregular plates ----
  const mare = (x, y, rx, ry, rot = 0, alpha = 0.9) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x * S, y * S);
    ctx.rotate(rot);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry) * S);
    g.addColorStop(0, '#a9a496');
    g.addColorStop(0.8, '#a29d8f');
    g.addColorStop(1, 'rgba(150,146,136,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * S, ry * S, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Oceanus Procellarum — the vast western dark
  mare(0.28, 0.40, 0.115, 0.16, 0.5, 0.85);
  mare(0.33, 0.30, 0.075, 0.10, -0.2);
  mare(0.24, 0.52, 0.06, 0.09, 0.3);
  // Mare Imbrium — the big upper-left eye
  mare(0.415, 0.27, 0.115, 0.085, -0.12);
  // Frigoris — the thin northern fringe
  mare(0.45, 0.155, 0.16, 0.018, 0.04);
  // Serenitatis + Tranquillitatis — the second eye and the cheek
  mare(0.55, 0.28, 0.075, 0.075);
  mare(0.60, 0.40, 0.095, 0.085, 0.25);
  // Vaporum, Nectaris, Fecunditatis
  mare(0.575, 0.365, 0.03, 0.035);
  mare(0.655, 0.52, 0.04, 0.04);
  mare(0.735, 0.475, 0.05, 0.075, 0.4);
  // Crisium — the lonely oval by the eastern limb
  mare(0.805, 0.31, 0.05, 0.036);
  // Humorum + Cognitum
  mare(0.425, 0.60, 0.05, 0.045);
  mare(0.475, 0.53, 0.026, 0.03);

  // ---- craters: bright-ringed pocks across the highlands ----
  const crater = (x, y, r, bright = 0.5) => {
    const px = x * S, py = y * S, pr = r * S;
    const g = ctx.createRadialGradient(px - pr * 0.2, py - pr * 0.2, pr * 0.1, px, py, pr);
    g.addColorStop(0, `rgba(120,112,98,${0.5 * bright})`);
    g.addColorStop(0.55, `rgba(90,85,74,${0.28 * bright})`);
    g.addColorStop(0.8, `rgba(250,246,232,${0.30 * bright})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
  };
  for (let i = 0; i < 90; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R * 0.97;
    crater(cx / S + Math.cos(a) * d / S, cy / S + Math.sin(a) * d / S, 0.004 + rnd() * 0.009, 0.3 + rnd() * 0.3);
  }
  crater(0.42, 0.46, 0.014, 1.0);   // Copernicus
  crater(0.285, 0.50, 0.010, 0.9);   // Kepler

  // ---- Tycho: the bright southern crater and its rays ----
  const tx = 0.49 * S, ty = 0.78 * S;
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = '#fff8e4';
  ctx.lineCap = 'round';
  for (let i = 0; i < 22; i++) {
    const a = rnd() * Math.PI * 2;
    const len = (0.08 + rnd() * 0.22) * S;
    ctx.lineWidth = 1.5 + rnd() * 2.5;
    ctx.beginPath();
    ctx.moveTo(tx + Math.cos(a) * 0.01 * S, ty + Math.sin(a) * 0.01 * S);
    ctx.lineTo(tx + Math.cos(a) * len, ty + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();
  const tg = ctx.createRadialGradient(tx, ty, 0, tx, ty, 0.016 * S);
  tg.addColorStop(0, 'rgba(255,252,240,0.98)');
  tg.addColorStop(0.5, 'rgba(255,250,236,0.55)');
  tg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = tg;
  ctx.beginPath(); ctx.arc(tx, ty, 0.016 * S, 0, Math.PI * 2); ctx.fill();

  // ---- limb darkening: round without shading ----
  const limb = ctx.createRadialGradient(cx, cy, R * 0.72, cx, cy, R);
  limb.addColorStop(0, 'rgba(0,0,0,0)');
  limb.addColorStop(0.92, 'rgba(120,110,92,0.14)');
  limb.addColorStop(1, 'rgba(96,88,74,0.30)');
  ctx.fillStyle = limb;
  ctx.fillRect(0, 0, S, S);

  ctx.restore();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,246,216,1)');
  g.addColorStop(0.25, 'rgba(255,238,190,0.55)');
  g.addColorStop(0.6, 'rgba(255,230,170,0.16)');
  g.addColorStop(1, 'rgba(255,230,170,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
