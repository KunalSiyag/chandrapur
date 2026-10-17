import * as THREE from 'three';
import { toonMaterial } from '../core/toon.js';
import { groundHeight } from './layout.js';
import {
  bench, bicycle, streetLamp, utilityPole, wire, flowerPot, crates, laundry,
  waterTank, bulbString, marigoldGarland, electricalBox, autoRickshaw, textSign,
  makeCanvasTexture, fenceRun, marigoldToran, rangoli, hangingGoods,
} from './props.js';

// ============================================================
// The bazaar lane. One building generator, many deliberate
// facades: the sweets shop at the corner, the library shut for
// the night, the hotel with its bulbs, the kirana store, the
// chai point. Every sign is painted the way a real town paints
// them — Hindi above, English below. Front of a building is its
// local +z face before rotation.
// ============================================================

function gableRoof(w, d, h, mat) {
  const g = new THREE.BufferGeometry();
  const hw = w / 2, hd = d / 2;
  const v = new Float32Array([
    -hw, 0, -hd, hw, 0, -hd, 0, h, -hd,
    -hw, 0, hd, 0, h, hd, hw, 0, hd,
    -hw, 0, -hd, 0, h, -hd, 0, h, hd, -hw, 0, -hd, 0, h, hd, -hw, 0, hd,
    hw, 0, -hd, hw, 0, hd, 0, h, hd, hw, 0, -hd, 0, h, hd, 0, h, -hd,
  ]);
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
}

function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }

function makeBuilding(o) {
  const g = new THREE.Group();
  g.userData.solid = true;
  const wall = toonMaterial(o.wallColor ?? 0x9a8a74);
  const trim = toonMaterial(o.trimColor ?? 0x6a5a48);
  const roofMat = toonMaterial(o.roofColor ?? 0x8a5a3c);

  const body = new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h, o.d), wall);
  body.position.y = o.h / 2;
  body.castShadow = body.receiveShadow = true;
  g.add(body);

  if (o.roof === 'gable') {
    const r = gableRoof(o.w + 0.7, o.d + 0.7, o.w * 0.3, roofMat);
    r.position.y = o.h;
    g.add(r);
  } else if (o.roof === 'hip') {
    const r = new THREE.Mesh(new THREE.ConeGeometry(Math.max(o.w, o.d) * 0.62, o.w * 0.28, 4), roofMat);
    r.rotation.y = Math.PI / 4;
    r.scale.set(o.w / Math.max(o.w, o.d) * 1.15, 1, o.d / Math.max(o.w, o.d) * 1.15);
    r.position.y = o.h + o.w * 0.14;
    r.castShadow = true;
    g.add(r);
  } else {
    // RCC flat roof: parapet, water tank on a stand, the odd dish
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(o.w + 0.2, 0.42, o.d + 0.2), trim);
    parapet.position.y = o.h + 0.21;
    g.add(parapet);
    if (o.tank !== false) {
      const tank = waterTank({ r: 0.5 });
      tank.position.set(-o.w * 0.24, o.h + 0.85, -o.d * 0.18);
      g.add(tank);
    }
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 6), toonMaterial(0x5a5a62));
    vent.position.set(o.w * 0.28, o.h + 0.6, o.d * 0.2);
    g.add(vent);
  }
  if (o.antenna) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 2.4, 4), toonMaterial(0x30343c));
    mast.position.set(o.w * 0.3, o.h + 1.2, -o.d * 0.3);
    g.add(mast);
    for (let i = 0; i < 3; i++) {
      const el = new THREE.Mesh(new THREE.BoxGeometry(0.5 - i * 0.12, 0.02, 0.02), toonMaterial(0x30343c));
      el.position.set(o.w * 0.3, o.h + 1.7 + i * 0.35, -o.d * 0.3);
      g.add(el);
    }
  }
  if (o.chimney) {
    const ch = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 0.5), toonMaterial(0x70665a));
    ch.position.set(-o.w * 0.28, o.h + 0.9, -o.d * 0.15);
    ch.castShadow = true;
    g.add(ch);
  }

  // ---- facade (local +z) ----
  const zF = o.d / 2 + 0.02;
  const shopWinMat = new THREE.MeshBasicMaterial({ color: o.shopGlow ?? 0xffc46b });

  const winW = o.w * 0.42;
  const shopFrame = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.3, 2.1, 0.16), trim);
  shopFrame.position.set(-o.w * 0.22, 1.25, zF);
  g.add(shopFrame);
  const shopPane = new THREE.Mesh(new THREE.PlaneGeometry(winW, 1.8), shopWinMat);
  shopPane.position.set(-o.w * 0.22, 1.25, zF + 0.09);
  g.add(shopPane);
  const mull = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 0.04), trim);
  mull.position.set(-o.w * 0.22, 1.25, zF + 0.1);
  g.add(mull);

  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.15, 0.14), toonMaterial(0x46342a));
  door.position.set(o.w * 0.28, 1.08, zF);
  g.add(door);
  if (o.toran) {
    // festival marigold valance strung across the doorhead
    const t = marigoldToran({ w: 1.15, drop: 0.3, count: 11 });
    t.position.set(o.w * 0.28, 2.26, zF + 0.08);
    g.add(t);
  }
  if (o.noren) {
    for (let i = 0; i < 4; i++) {
      const curtain = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.8), toonMaterial(0x8a3428, { side: THREE.DoubleSide }));
      curtain.position.set(o.w * 0.28 - 0.45 + i * 0.3, 1.6, zF + 0.1);
      g.add(curtain);
    }
  }

  if (o.signText) {
    const s = textSign({
      text: o.signText, sub: o.signSub ?? '', w: Math.min(o.w * 0.8, 5), h: 0.9,
      bg: o.signBg ?? '#1c3a6e', fg: o.signFg ?? '#ffe9a8',
    });
    s.position.set(0, 3, zF + 0.06);
    g.add(s);
  }

  if (o.awning) {
    const stripes = makeAwningTexture();
    const aw = new THREE.Mesh(new THREE.BoxGeometry(o.w * 0.9, 0.06, 1.1), toonMaterial(0xffffff, { paint: 0.015, map: stripes }));
    aw.position.set(0, 2.75, zF + 0.55);
    aw.rotation.x = 0.28;
    aw.castShadow = true;
    g.add(aw);
  }

  if (o.shutter) {
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(winW + 0.2, 2.6), toonMaterial(0x6a707a));
    sh.position.set(-o.w * 0.22, 1.7, zF + 0.08);
    sh.rotation.x = 0.06;
    g.add(sh);
    const p = o.poster ?? { title: 'मेला 15 अगस्त', lines: ['station chowk', '7 बजे से · from 7 pm'] };
    const posterM = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.95),
      toonMaterial(0xffffff, { paint: 0.015, map: makePosterTexture(p) }),
    );
    posterM.position.set(-o.w * 0.22, 1.45, zF + 0.1);
    g.add(posterM);
  }

  // upper-floor windows — a lit/dark pattern that implies residents
  if (o.floors > 1) {
    const upperY = o.h * 0.72;
    const cols = Math.max(2, Math.floor(o.w / 2.2));
    for (let i = 0; i < cols; i++) {
      const wx = -o.w / 2 + (o.w / cols) * (i + 0.5);
      const lit = hash(wx * 3.7 + o.h) > 0.55;
      const cool = lit && hash(wx * 9.1) > 0.72;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1, 1.15, 0.12), trim);
      frame.position.set(wx, upperY, zF);
      g.add(frame);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.95),
        new THREE.MeshBasicMaterial({ color: lit ? (cool ? 0x9ab6ff : 0xffc46b) : 0x1c2430 }));
      pane.position.set(wx, upperY, zF + 0.07);
      g.add(pane);
      if (cool) o.tvPanes?.push(pane);
      // a warm breath of light around the lit pane
      if (lit && !cool) {
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
          map: windowGlowTex(), color: 0xffc46b, transparent: true, opacity: 0.4,
          depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        glow.scale.setScalar(1.5);
        glow.position.set(wx, upperY, zF + 0.12);
        g.add(glow);
      }
    }
  }

  if (o.balcony) {
    const b = new THREE.Group();
    const platform = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 1), trim);
    platform.position.set(o.w * 0.18, o.h * 0.72 - 0.85, zF + 0.55);
    b.add(platform);
    for (let i = 0; i < 5; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.75, 4), trim);
      bar.position.set(o.w * 0.18 - 1.05 + i * 0.52, o.h * 0.72 - 0.42, zF + 1.0);
      b.add(bar);
    }
    const laundryP = laundry();
    laundryP.group.position.set(o.w * 0.18 - 0.6, o.h * 0.72 - 0.87, zF + 0.55);
    b.add(laundryP.group);
    o.laundryOut?.push(laundryP);
    g.add(b);
  }

  if (o.ac) {
    const unit = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.4), toonMaterial(0x8a9098));
    unit.position.set(o.w * 0.36, o.h * 0.55, zF + 0.2);
    g.add(unit);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, o.h * 0.4, 5), toonMaterial(0x6a7078));
    pipe.position.set(o.w * 0.36, o.h * 0.34, zF + 0.16);
    g.add(pipe);
  }

  g.name = o.name ?? 'building';
  return g;
}

// helpers
function makeAwningTexture() {
  return makeCanvasTexture(128, 32, (ctx, W, H) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#7a8844' : '#e0d8c4';
      ctx.fillRect(i * W / 8, 0, W / 8, H);
    }
  });
}
function makePosterTexture(p) {
  return makeCanvasTexture(160, 210, (ctx, W, H) => {
    ctx.fillStyle = '#f2e6c8'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#c23326'; ctx.fillRect(0, 0, W, 34);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px "Noto Sans Devanagari", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.title, W / 2, 24);
    ctx.fillStyle = '#3a3a3a'; ctx.font = '15px "Noto Sans Devanagari", sans-serif';
    ctx.textBaseline = 'top';
    p.lines.forEach((l, i) => ctx.fillText(l, W / 2, 44 + i * 22));
  });
}

function place(g, building, x, z, ry, yOff = 0) {
  building.position.set(x, groundHeight(x, z) + yOff, z);
  building.rotation.y = ry;
  g.add(building);
  return building;
}

export function createShops(scene) {
  const group = new THREE.Group();
  group.name = 'shops';
  const updaters = [];
  const tvPanes = [];
  const laundryOut = [];

  // ================= WEST ROW (fronts face east, onto the lane)
  // W1 — the sweets shop at the corner, garlands under its awning
  place(group, makeBuilding({
    w: 8, d: 7, h: 6.8, floors: 2, roof: 'gable', name: 'sweets',
    wallColor: 0xc4a464, roofColor: 0x8a5a3c, signText: 'शर्मा मिठाई भंडार', signSub: 'SHARMA SWEETS & BAKERY',
    signBg: '#7a2c22', signFg: '#ffe9a0', awning: true, ac: true, chimney: true, tank: false, toran: true,
  }), -8.2, 6.2, Math.PI / 2);

  // W2 — the library, shuttered: roller down, mela bill pasted on it
  place(group, makeBuilding({
    w: 9, d: 7.5, h: 5.4, floors: 2, roof: 'flat', name: 'library',
    wallColor: 0x9fb0a4, roofColor: 0x46506a, signText: 'गुप्ता लाइब्रेरी', signSub: 'GUPTA LIBRARY · books · stationery',
    signBg: '#204a30', signFg: '#ffe9a8', shutter: true, antenna: true, balcony: true, shopGlow: 0x8a7c50,
    tvPanes, laundryOut,
  }), -9, 14.8, Math.PI / 2);

  // W3 — the hotel, bulbs strung, kitchen still glowing
  place(group, makeBuilding({
    w: 6.5, d: 6, h: 5, floors: 1, roof: 'gable', name: 'hotel',
    wallColor: 0xa88868, roofColor: 0x54483c, signText: 'होटल चंदपुर', signSub: 'HOTEL CHANDPUR · PURE VEG',
    signBg: '#7a2c22', signFg: '#ffffff', noren: true, shopGlow: 0xffa04a, tank: false, toran: true,
  }), -8.2, 23.5, Math.PI / 2);

  // ================= EAST ROW (fronts face west)
  // E1 — the kirana store; lights on inside, shutter half down
  place(group, makeBuilding({
    w: 8.5, d: 7, h: 7, floors: 2, roof: 'flat', name: 'kirana',
    wallColor: 0xb0a278, roofColor: 0x50485a, signText: 'सागर किराना स्टोर', signSub: 'SAGAR KIRANA & GENERAL STORE',
    signBg: '#1c3a6e', signFg: '#ffe9a0', shutter: true, antenna: true, ac: true,
  }), 8.6, 6.8, -Math.PI / 2);

  // E2 — the chai point; the lane's warmest corner
  place(group, makeBuilding({
    w: 8, d: 7, h: 6.6, floors: 2, roof: 'gable', name: 'chai',
    wallColor: 0x8a9478, roofColor: 0x7a4444, signText: 'चाय पॉइंट', signSub: 'CHAI POINT · hot & fresh',
    signBg: '#3a5a28', signFg: '#ffe9a0', awning: true, chimney: true, tank: false, toran: true,
  }), 9.2, 15, -Math.PI / 2);

  // E3 — the house above the lane; one blue window: someone's up late
  place(group, makeBuilding({
    w: 6, d: 5.5, h: 6, floors: 2, roof: 'gable', name: 'house',
    wallColor: 0x9c8e96, roofColor: 0x6a5470, signText: null,
    balcony: true, ac: true, shopGlow: 0x515058, tvPanes,
  }), 8, 23.5, -Math.PI / 2);
  group.add(fenceRun({ from: [5.1, 20.9], to: [5.1, 26.2] }));
  group.add(fenceRun({ from: [5.1, 20.9], to: [10.2, 20.9] }));

  // ================= filler roofline mass behind the rows
  const fillSpecs = [
    [-16.5, 10, Math.PI / 2, 7, 8, 5], [-17, 19.5, Math.PI / 2, 8, 8, 4.5],
    [19.5, 9.5, -Math.PI / 2, 6, 7, 5.5], [20, 18.5, -Math.PI / 2, 6, 6, 5],
  ];
  for (const [x, z, ry, w, d, h] of fillSpecs) {
    place(group, makeBuilding({
      w, d, h, floors: 2, roof: h > 5.2 ? 'hip' : 'gable', name: 'filler',
      wallColor: 0x8a8276, roofColor: 0x48506a, signText: null,
    }), x, z, ry);
  }

  // ================= houses beside the hill road, along the rail
  place(group, makeBuilding({
    w: 6, d: 5, h: 4.5, floors: 1, roof: 'gable', name: 'rail-house-1',
    wallColor: 0xa89c84, roofColor: 0x5a5064, signText: null, shopGlow: 0xffc46b, tank: false,
  }), 22, -6.5, 0);
  place(group, makeBuilding({
    w: 5.5, d: 5, h: 4, floors: 1, roof: 'hip', name: 'rail-house-2',
    wallColor: 0x847c70, roofColor: 0x4a4456, signText: null, shopGlow: 0x514e44,
  }), 31, -7.5, 0);

  // the auto-rickshaw parked in its yard — a vehicle means a household
  const auto = autoRickshaw({ color: 0x2c6e4f });
  auto.position.set(24.5, groundHeight(24.5, -4), -4);
  auto.rotation.y = 0.35;
  group.add(auto);

  // ================= south-bank cottages across the water
  place(group, makeBuilding({
    w: 5, d: 4, h: 3.6, floors: 1, roof: 'gable', name: 'cottage-1',
    wallColor: 0x8e8474, roofColor: 0x4e586e, signText: null, shopGlow: 0xffc46b, tank: false,
  }), -4, 53, Math.PI);
  place(group, makeBuilding({
    w: 5, d: 4, h: 3.4, floors: 1, roof: 'gable', name: 'cottage-2',
    wallColor: 0x7e7a6e, roofColor: 0x56506c, signText: null, shopGlow: 0x9ab6ff, tank: false,
  }), 5, 55, Math.PI);

  // a cottage beside the hill road where it leaves the square
  place(group, makeBuilding({
    w: 5, d: 4.5, h: 4.2, floors: 1, roof: 'gable', name: 'road-cottage',
    wallColor: 0x94907e, roofColor: 0x4e586e, signText: null, shopGlow: 0xffd98a, tank: false,
  }), -18, 1.5, Math.PI / 2);

  // ================= lane dressing =================
  // festival bulb strings — the lane's ceiling, big bulbs at the mouth
  for (const [z, big] of [[2.6, true], [6, false], [10, false], [14, false], [18, false], [22, false], [25.5, false]]) {
    group.add(bulbString({ from: [-4.6, 4.7, z], to: [4.6, 4.7, z], count: big ? 12 : 9, sag: 0.5, big }));
  }
  // marigold garlands on the warm corners
  group.add(marigoldGarland({ from: [-4.55, 4.0, 7.5], to: [-4.55, 4.0, 9.8] }));
  group.add(marigoldGarland({ from: [4.55, 4.4, 13.6], to: [4.55, 4.4, 16.2] }));
  // hanging merchandise under the awnings — bangles at the sweets shop,
  // snack packets at the kirana: the bazaar's ceiling of small goods
  group.add(hangingGoods({ from: [-4.5, 2.62, 5.6], to: [-4.5, 2.62, 8.0], kind: 'bangles', count: 6 }).group);
  group.add(hangingGoods({ from: [5.05, 2.6, 5.2], to: [5.05, 2.6, 7.2], kind: 'packets', count: 5 }).group);
  // the cable spaghetti crossing the lane — every Indian street's sky
  group.add(wire([-8.0, 5.9, 4.6], [8.7, 5.7, 4.2], 0.85));
  group.add(wire([-8.0, 6.15, 12.4], [8.7, 5.9, 12.8], 1.05));
  group.add(wire([-8.1, 5.7, 19.6], [8.6, 6.0, 19.1], 0.75));

  // street lamps — alternating sides, marking the walk
  for (const [x, z] of [[-4.2, 5], [4.2, 13], [-4.2, 21]]) {
    const l = streetLamp({});
    l.position.set(x, groundHeight(x, z), z);
    group.add(l);
  }

  // utility poles down the east facade, wires sagging between
  const poleTops = [];
  for (const z of [4.8, 12.8, 20.8, 28.4]) {
    const p = utilityPole({ h: 7.2 });
    p.position.set(5, groundHeight(5, z), z);
    group.add(p);
    poleTops.push([5, 6.9, z]);
  }
  for (let i = 0; i < poleTops.length - 1; i++) {
    group.add(wire(poleTops[i], poleTops[i + 1], 0.55));
    group.add(wire([poleTops[i][0], poleTops[i][1] - 0.85, poleTops[i][2] + 0.5], [poleTops[i + 1][0], poleTops[i + 1][1] - 0.85, poleTops[i + 1][2] + 0.5], 0.6));
  }
  group.add(wire([5, 6.9, 20.8], [9.2, 5.2, 15], 0.35));

  // the chai point's bench + cycle + pots (the lane's warmest corner)
  const kb = bench({});
  kb.position.set(5.6, groundHeight(5.6, 15), 15);
  kb.rotation.y = -Math.PI / 2 + 0.2;
  group.add(kb);
  // rangoli laid on the lane by the chai point, swept fresh every evening
  const laneKolam = rangoli({ r: 0.8, seed: 21 });
  laneKolam.position.set(0.9, groundHeight(0.9, 15.6) + 0.03, 15.6);
  laneKolam.rotation.z = 4.1;
  group.add(laneKolam);
  const kbBike = bicycle({ color: 0x5a7a9c });
  kbBike.position.set(5.4, groundHeight(5.4, 16.5), 16.5);
  kbBike.rotation.y = -1.9;
  group.add(kbBike);
  for (const [x, z, hue] of [[5.2, 13.5, 0xe8931a], [5.2, 17, 0xe8931a], [-4.9, 7.5, 0xd85a6a], [-4.9, 18, 0x9a6ad8]]) {
    const pot = flowerPot({ hue });
    pot.position.set(x, groundHeight(x, z), z);
    group.add(pot);
  }

  // the alley: fuse box, a cycle left against the wall
  const alleyBox = electricalBox();
  alleyBox.position.set(-4.55, groundHeight(-4.55, 21.3), 21.3);
  alleyBox.rotation.y = Math.PI / 2;
  group.add(alleyBox);
  const alleyBike = bicycle({ color: 0x6a6a72, basket: false });
  alleyBike.position.set(-4.15, groundHeight(-4.15, 22.4), 22.4);
  alleyBike.rotation.y = 1.35;
  group.add(alleyBike);

  // kirana's crates by its side door
  const cr = crates(3);
  cr.position.set(12.8, groundHeight(12.8, 4), 4);
  cr.rotation.y = 0.4;
  group.add(cr);

  // living details
  updaters.push((t) => {
    // the late-night TV flickers its blue on the lane
    for (const p of tvPanes) p.material.color.setHSL(0.6, 0.5, 0.45 + Math.sin(t * 13.7) * 0.1 + Math.sin(t * 31) * 0.04);
    // kurtas dry on the balcony rail
    for (const l of laundryOut) {
      l.cloths.forEach((c, i) => { c.rotation.x = Math.sin(t * 1.8 + i * 1.7) * 0.12; });
    }
  });

  scene.add(group);
  return { group, updaters };
}


// shared warm glow texture for lit windows
let _windowGlow = null;
function windowGlowTex() {
  if (_windowGlow) return _windowGlow;
  _windowGlow = makeCanvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,214,150,0.9)');
    g.addColorStop(0.5, 'rgba(255,200,120,0.28)');
    g.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
  return _windowGlow;
}
