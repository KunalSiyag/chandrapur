import * as THREE from 'three';
import { toonMaterial } from '../core/toon.js';
import { LANDINGS, surfaceY } from './layout.js';
import { LOCAL as C, group, mesh, box, cylinder, beam, sphere, flat } from './build-kit.js';
import { makeCanvasTexture, lightPool, textSign } from './props.js';
import { addOrientedBox, oriented } from './colliders.js';

// Actual transport. Root = basket-deck contact height. The same continuous
// scenic curve is flown in reverse for the return; neither exit is a teleport.
const V = (p) => new THREE.Vector3(...p);
const CRUISE_POINTS = [
  [3, 22.5, 77], [9, 24, 60], [31, 27, 43], [25, 29, 21], [7, 27, -1],
  [-20, 29, -20], [-47, 32, -37], [-77, 35, -57], [-73, 37, -77],
  [-39, 37, -86], [-48, 30, -75], [-53, 29.5, -69],
];
const LOOK_POINTS = [
  [22, 0, 42], [18, 2, 27], [0, 3.5, -10], [-25, 5, -29], [-42, 14, -43],
  [-73, 23, -62], [-73, 23, -62], [-35, 29, -78], [-35, 29, -78],
  [18, 2.5, 28], [24, 1, 46], [0, 2, -2],
];
const FLIGHT = { boarding: 1.8, ascent: 14, cruise: 78, descent: 15 };
export const FLIGHT_DURATION = Object.values(FLIGHT).reduce((a, b) => a + b, 0);
const ease = (t) => t * t * (3 - 2 * t);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createBalloonTravel(scene, { camera, input, player, toast = () => {} }) {
  const balloon = buildPassengerBalloon(); scene.add(balloon.group);
  const route = new THREE.CatmullRomCurve3(CRUISE_POINTS.map(V), false, 'centripetal');
  const lookRoute = new THREE.CatmullRomCurve3(LOOK_POINTS.map(V), false, 'centripetal');
  let dock = 0, destination = 1, departure = 0, state = 'docked', riding = false, clock = 0;
  let yawOffset = 0, pitchOffset = 0, guidedYaw = 0, guidedPitch = 0, guidedInit = false;
  let emptyFlight = false, time = 0, bob = 0;
  let steppingOff = null;
  const boardingCamera = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
  const eye = new THREE.Vector3(), target = new THREE.Vector3(), tangent = new THREE.Vector3();
  const guide = new THREE.Vector3(), desiredQ = new THREE.Quaternion(), tempCamera = new THREE.PerspectiveCamera();
  let parkedCollider = null;

  function removeParkedCollider() {
    if (parkedCollider) { const i = oriented.indexOf(parkedCollider); if (i >= 0) oriented.splice(i, 1); parkedCollider = null; }
  }
  function park(index) {
    removeParkedCollider();
    dock = index; balloon.group.position.copy(V(LANDINGS[dock].position)); balloon.group.rotation.set(0, 0, 0);
    balloon.group.updateMatrixWorld(true);
    parkedCollider = addOrientedBox(balloon.group.position.x, balloon.group.position.z, 1.11, 0.9, 0);
    parkedCollider.owner = 'docked-balloon-basket';
    balloon.gate.rotation.y = -1.25;
  }
  park(0);

  function nearLanding() {
    const p = player.position;
    let nearest = -1, distance = Infinity;
    LANDINGS.forEach((l, i) => {
      const d = Math.hypot(p.x - l.access[0], p.z - l.access[2]);
      if (d < 4.2 && Math.abs(p.y - l.position[1]) < 1.5 && d < distance) { nearest = i; distance = d; }
    });
    return nearest;
  }

  function startFlight(from, to, empty = false) {
    departure = from; destination = to; clock = 0; guidedInit = false;
    emptyFlight = empty; yawOffset = 0; pitchOffset = 0;
    state = empty ? 'ascending' : 'boarding';
    balloon.gate.rotation.y = 0;
    removeParkedCollider();
  }

  function board() {
    if (state !== 'docked' || riding || nearLanding() !== dock) return false;
    boardingCamera.p.copy(camera.position); boardingCamera.q.copy(camera.quaternion);
    player.enterTransport(); riding = true;
    startFlight(dock, 1 - dock);
    toast(`Seated in the basket · scenic flight to ${LANDINGS[destination].name}`);
    return true;
  }
  function exit() {
    if (!riding || state !== 'docked') return false;
    const l = LANDINGS[dock];
    state = 'disembarking';
    steppingOff = { time: 0, from: player.position.clone(), to: V(l.exit),
      camera: camera.position.clone(), quaternion: camera.quaternion.clone() };
    return true;
  }
  function call() {
    const near = nearLanding();
    if (state !== 'docked' || riding || near < 0 || near === dock) return false;
    startFlight(dock, near, true);
    toast(`The balloon is flying here from ${LANDINGS[dock].name}`);
    return true;
  }
  function interact() {
    if (riding) {
      if (state === 'docked') return exit();
      toast('Enjoy the view · you can step out after landing'); return false;
    }
    return board() || call();
  }

  function guideCamera(dt, lookAt, blend = 1) {
    balloon.group.updateMatrixWorld(true);
    eye.set(0.12, 1.46, 0.08).applyMatrix4(balloon.group.matrixWorld);
    guide.copy(lookAt).sub(eye);
    const yaw = Math.atan2(guide.x, guide.z);
    // Seat height stays physical. Default scenic framing stays above the
    // basket rim; free-look may deliberately look into the basket below it.
    const pitch = THREE.MathUtils.clamp(Math.atan2(guide.y, Math.hypot(guide.x, guide.z)), -0.3, 0.38);
    if (!guidedInit) { guidedYaw = yaw; guidedPitch = pitch; guidedInit = true; }
    const k = 1 - Math.exp(-dt * 1.5);
    guidedYaw += wrap(yaw - guidedYaw) * k; guidedPitch += (pitch - guidedPitch) * k;
    yawOffset -= input.lookDX * 0.0027;
    pitchOffset = THREE.MathUtils.clamp(pitchOffset - input.lookDY * 0.0027, -0.95, 1.05);
    const camYaw = guidedYaw + yawOffset, camPitch = THREE.MathUtils.clamp(guidedPitch + pitchOffset, -1.3, 1.3);
    target.set(Math.sin(camYaw) * Math.cos(camPitch), Math.sin(camPitch), Math.cos(camYaw) * Math.cos(camPitch)).add(eye);
    tempCamera.position.copy(eye); tempCamera.lookAt(target); desiredQ.copy(tempCamera.quaternion);
    camera.position.lerpVectors(boardingCamera.p, eye, blend);
    camera.quaternion.slerpQuaternions(boardingCamera.q, desiredQ, blend);
    player.placeTransport(balloon.group.position);
    input.consumeFrame();
  }

  function update(dt, elapsed = time + dt) {
    time = elapsed; bob = Math.sin(time * 0.75) * 0.04;
    const burner = 0.75 + Math.max(0, Math.sin(time * 0.47)) * 0.3 + Math.sin(time * 17) * 0.05;
    balloon.flame.scale.y = burner; balloon.flame.material.opacity = 0.55 + burner * 0.2;
    balloon.envelope.material.emissiveIntensity = state === 'ascending' ? 0.26 : 0.12 + burner * 0.07;
    if (state === 'disembarking') {
      steppingOff.time = Math.min(1, steppingOff.time + dt / 0.85);
      const k = ease(steppingOff.time);
      player.placeTransport(steppingOff.from.clone().lerp(steppingOff.to, k));
      const head = steppingOff.to.clone().add(new THREE.Vector3(0, 1.62, 0));
      const outside = head.clone().add(new THREE.Vector3(2.8, 0.5, 2.0));
      tempCamera.position.copy(outside); tempCamera.lookAt(head);
      camera.position.lerpVectors(steppingOff.camera, outside, k);
      camera.quaternion.slerpQuaternions(steppingOff.quaternion, tempCamera.quaternion, k);
      input.consumeFrame();
      if (steppingOff.time === 1) {
        riding = false; emptyFlight = false; state = 'docked';
        const l = LANDINGS[dock];
        player.exitTransport(steppingOff.to, V([l.exit[0], l.exit[1] + 1.5, l.exit[2] - 7]));
        steppingOff = null;
        toast(`${l.name} · continue on foot, or press E to ride back`);
      }
      return;
    }
    if (state === 'docked') {
      if (riding) guideCamera(dt, V([LANDINGS[dock].position[0] + 8, LANDINGS[dock].position[1] + 2, LANDINGS[dock].position[2] - 8]));
      return;
    }
    clock += dt;
    const boarding = emptyFlight ? 0 : FLIGHT.boarding;
    const ascentEnd = boarding + FLIGHT.ascent, cruiseEnd = ascentEnd + FLIGHT.cruise, end = cruiseEnd + FLIGHT.descent;
    const reversed = departure === 1;
    const first = reversed ? CRUISE_POINTS.at(-1) : CRUISE_POINTS[0], last = reversed ? CRUISE_POINTS[0] : CRUISE_POINTS.at(-1);
    let cameraBlend = 1;
    if (clock < boarding) {
      state = 'boarding'; cameraBlend = ease(clock / boarding);
      balloon.group.position.copy(V(LANDINGS[departure].position));
      guide.copy(V(reversed ? LOOK_POINTS.at(-1) : LOOK_POINTS[0]));
    } else if (clock < ascentEnd) {
      state = 'ascending'; const k = ease((clock - boarding) / FLIGHT.ascent);
      balloon.group.position.lerpVectors(V(LANDINGS[departure].position), V(first), k);
      guide.copy(V(reversed ? LOOK_POINTS.at(-1) : LOOK_POINTS[0]));
    } else if (clock < cruiseEnd) {
      state = 'cruising'; const progress = (clock - ascentEnd) / FLIGHT.cruise, u = reversed ? 1 - progress : progress;
      route.getPointAt(u, balloon.group.position); route.getTangentAt(u, tangent);
      if (reversed) tangent.negate();
      const wantYaw = Math.atan2(tangent.x, tangent.z);
      balloon.group.rotation.y += wrap(wantYaw - balloon.group.rotation.y) * (1 - Math.exp(-dt * 0.5));
      // Camera cues follow the corresponding route station, not an unrelated
      // curve-length parameter. The two curves have different arc lengths.
      lookRoute.getPoint(route.getUtoTmapping(u), guide);
      balloon.group.position.y += bob;
    } else if (clock < end) {
      state = 'descending'; const k = ease((clock - cruiseEnd) / FLIGHT.descent);
      balloon.group.position.lerpVectors(V(last), V(LANDINGS[destination].position), k);
      balloon.group.rotation.y += wrap(-balloon.group.rotation.y) * (1 - Math.exp(-dt * 0.6));
      guide.set(LANDINGS[destination].position[0] + 6, LANDINGS[destination].position[1] + 1.5, LANDINGS[destination].position[2] - 8);
    } else {
      state = 'docked'; park(destination);
      guide.set(LANDINGS[dock].position[0] + 6, LANDINGS[dock].position[1] + 1.5, LANDINGS[dock].position[2] - 8);
      toast(riding ? `${LANDINGS[dock].name} · landed · press E to step out` : 'The balloon has arrived · press E to board');
    }
    if (riding) guideCamera(dt, guide, cameraBlend);
  }

  function status() {
    const near = nearLanding();
    return { state, riding, clock, dock: LANDINGS[dock].id, destination: LANDINGS[destination].id,
      position: balloon.group.position.toArray(), eye: camera.position.toArray(), seatedEye: eye.toArray(),
      yawOffset, pitchOffset, emptyFlight,
      prompt: riding ? (state === 'docked' ? 'E · Step Out of the Basket' : state === 'disembarking' ? 'Stepping onto the landing…'
        : `${state === 'boarding' ? 'Taking your seat' : state === 'ascending' ? 'Rising over the river' : state === 'descending' ? 'Approaching the landing' : 'Scenic flight'} · Mouse / drag to look around`)
        : near < 0 ? '' : state !== 'docked' ? 'Balloon in flight · follow the paths while you wait'
          : near === dock ? `E · Board Balloon to ${LANDINGS[1 - dock].name}` : 'E · Call Balloon to This Landing' };
  }
  return { group: balloon.group, update, interact, board, exit, call, status, route, get riding() { return riding; }, get state() { return state; } };
}

function buildPassengerBalloon() {
  const g = group('passenger-hot-air-balloon'); g.userData.dynamic = true;
  const w = 2.2, d = 1.75;
  box(g, w, 0.16, d, '#8f7854', 0, 0.15, 0, 'basket-floor');
  const wickerTex = makeCanvasTexture(128, 128, (ctx, W, H) => {
    ctx.fillStyle = '#9e835b'; ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 8) { ctx.fillStyle = y % 16 ? '#8a6f49' : '#c1a16b'; ctx.fillRect(0, y, W, 3); }
    for (let x = 0; x < W; x += 16) { ctx.fillStyle = '#725b3d'; ctx.fillRect(x, 0, 2, H); }
  });
  const wicker = toonMaterial(0xffffff, { map: wickerTex, paint: 0.025 });
  for (const x of [-w / 2, w / 2]) {
    box(g, 0.11, 0.61, d, wicker, x, 0.52, 0, 'basket-wall');
    box(g, 0.13, 0.1, d + 0.13, C.wood, x, 0.87, 0, 'basket-rim');
  }
  box(g, w, 0.61, 0.11, wicker, 0, 0.52, d / 2, 'basket-wall');
  box(g, w + 0.13, 0.1, 0.13, C.wood, 0, 0.87, d / 2, 'basket-rim');
  for (const x of [-0.81, 0.81]) {
    box(g, 0.57, 0.61, 0.11, wicker, x, 0.52, -d / 2);
    box(g, 0.59, 0.1, 0.13, C.wood, x, 0.87, -d / 2);
  }
  const gate = group('basket-gate'); gate.position.set(-0.53, 0, -d / 2);
  box(gate, 1.05, 0.61, 0.1, wicker, 0.525, 0.52, 0);
  box(gate, 1.06, 0.1, 0.13, C.wood, 0.525, 0.87, 0); g.add(gate);
  box(g, 1.2, 0.12, 0.42, C.wood, 0, 0.55, 0.36, 'basket-seat');
  for (const [x, z] of [[-0.91, -0.66], [0.91, -0.66], [-0.91, 0.66], [0.91, 0.66]]) {
    beam(g, [x, 0.22, z], [x * 0.72, 2.82, z * 0.72], 0.035, '#4b544f', 8);
    beam(g, [x * 0.72, 2.82, z * 0.72], [x * 1.55, 4.7, z * 1.55], 0.018, '#c4ad80', 6);
  }
  for (const x of [-0.28, 0.28]) cylinder(g, 0.13, 0.18, 0.28, '#5a6a65', x, 2.74, 0, 10);
  const flame = mesh(g, new THREE.ConeGeometry(0.21, 0.8, 12), new THREE.MeshBasicMaterial({ color: '#ffc977', transparent: true, opacity: 0.7,
    depthWrite: false, blending: THREE.AdditiveBlending }), [0, 3.15, 0], 'balloon-burner-flame');
  flame.castShadow = flame.receiveShadow = false;
  const tex = makeCanvasTexture(512, 512, (ctx, W, H) => {
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = ['#ce8a45', '#ddd0a9', '#ce8a45', '#4d6680'][i % 4]; ctx.fillRect(i * W / 16, 0, W / 16 + 1, H);
      ctx.fillStyle = '#92744d'; ctx.fillRect(i * W / 16, 0, 2, H);
    }
    ctx.fillStyle = '#465b72'; ctx.fillRect(0, H * 0.48, W, H * 0.105);
    ctx.fillStyle = '#d6b774'; ctx.fillRect(0, H * 0.475, W, 4); ctx.fillRect(0, H * 0.585, W, 4);
    for (let i = 0; i < 32; i++) { ctx.beginPath(); ctx.arc((i + 0.5) * W / 32, H * 0.53, 3, 0, Math.PI * 2); ctx.fill(); }
  });
  const profile = [[0.43, 3.45], [0.82, 4.25], [1.7, 5.7], [2.8, 7.5], [3.25, 9], [3.1, 10.2], [2.55, 11.2], [1.6, 12.1], [0.55, 12.65], [0, 12.75]].map(([r, y]) => new THREE.Vector2(r, y));
  const envelope = mesh(g, new THREE.LatheGeometry(profile, 40), toonMaterial(0xffffff, { map: tex, emissiveMap: tex, emissive: '#dba864', emissiveIntensity: 0.15, side: THREE.DoubleSide, paint: 0.02 }), [0, 0, 0], 'passenger-balloon-envelope');
  const serial = textSign({ text: 'चंद्रपुर', sub: 'VALLEY AIR · CP-01', w: 1.12, h: 0.42, bg: C.indigo }); serial.position.set(0, 0.63, d / 2 + 0.063); g.add(serial);
  const burnerGlow = lightPool(1.15, 0xffb66a, 0.07); burnerGlow.position.set(0, 0.238, 0); g.add(burnerGlow);
  return { group: g, envelope, flame, gate };
}
