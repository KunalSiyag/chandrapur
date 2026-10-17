import * as THREE from 'three';
import { createRenderer } from './core/renderer.js';
import { setupLights } from './core/toon.js';
import { createPost } from './core/post.js';
import { createCamera } from './core/camera.js';
import { createInput } from './core/input.js';
import { createPlayer } from './core/player.js';
import { createSky } from './world/sky.js';
import { createDayCycle } from './world/daycycle.js';
import { createGround } from './world/ground.js';
import { createMoon } from './world/moon.js';
import { buildTown } from './world/town.js';
import { createBalloonTravel } from './world/balloon-travel.js';
import { createTownLife } from './world/town-life.js';
import { districtAt } from './world/layout.js';
import * as worldLayout from './world/layout.js';
import * as worldCollisions from './world/colliders.js';
import { createRiver } from './world/river.js';
import { createMusic } from './audio/music.js';
import { createVoice } from './audio/voice.js';
import { createGameHUD } from './ui/game-hud.js';
import { createGame } from './game/game.js';
import { createAgentTools } from '../agent/tools.js';

const params = new URLSearchParams(location.search);
const capture = params.has('capture');
const container = document.getElementById('app');
const { renderer, scene, onResize } = createRenderer(container);
const input = createInput(renderer);
const cam = createCamera(input);
cam.camera.fov = 58;
cam.camera.updateProjectionMatrix();

const lights = setupLights(scene);
lights.moonLight.target.position.set(0, 0, 0);

// ---- the valley ----
const sky = createSky(scene);
createGround(scene);
const moon = createMoon(scene);
const town = buildTown(scene);
const river = createRiver(scene);

const music = createMusic();
const voice = createVoice({ onSpeaking: (on) => music.duck(on) });
const player = createPlayer(input, cam.camera, { scene, solids: town.solids, spawn: new THREE.Vector3(3.2, 0, 1.0),
  onJump: () => music.sfx.whoosh() });
const post = createPost(renderer, scene, cam.camera);
const balloon = createBalloonTravel(scene, { camera: cam.camera, input, player, toast: (msg) => hud.toast(msg) });
town.solids.push(balloon.group);
const life = createTownLife(scene, { player });
const day = createDayCycle({ scene, lights, sky, post, moon, river, startTime: Number(params.get('time') ?? 0.33) });
const leakPos = new THREE.Vector3();

// ---- modes: title (orbiting intro) / walk / orbit (cinema) ----
let mode = capture ? 'walk' : 'title';
window.__wantPointerLock = mode === 'walk';
function setMode(m) {
  mode = m;
  window.__wantPointerLock = m === 'walk';
  if (m === 'orbit') {
    input.exitLock();
    const focus = new THREE.Vector3(player.position.x, player.position.y + 1.6, player.position.z);
    const fwd = new THREE.Vector3(Math.sin(player.yaw), -0.1, Math.cos(player.yaw));
    cam.snapTo(cam.camera.position, focus.clone().addScaledVector(fwd, 6));
    hud.setCinemaLabel(false);
  } else hud.setCinemaLabel(true);
}

// ---- actions shared by HUD, keys and agent tools ----
let moonDown = false;
function toggleMoon() {
  if (!game.started) return moonDown;
  moonDown = !moonDown;
  if (moonDown) {
    moon.bringDown();
    if (mode === 'orbit') cam.cinematicMoonShot(moon.position);
    else hud.toast(day.night > 0.4 ? 'She is coming down to the river — go and meet her at the ghats!' : 'The moon slips down to the river… she shines brightest at night.');
  } else {
    moon.sendHome();
    hud.toast('The moon climbs back to the sky');
  }
  hud.setMoonLabel(moonDown);
  game.onMoon(moonDown);
  return moonDown;
}
async function toggleSound() { return music.toggle(); }
function toggleVoices() { voice.enabled = !voice.enabled; return voice.enabled; }
async function toggleTheme() {
  if (music.songPlaying) { music.stopSong(); return false; }
  return music.startSong();
}
function chat() {
  if (mode !== 'walk' || balloon.riding) return;
  if (game.chat()) input.exitLock();
}
function toggleCinema() {
  if (!game.started) return;
  if (balloon.riding) { hud.toast('Look freely from the basket · cinema view returns after landing'); return; }
  if (mode === 'walk') { setMode('orbit'); hud.toast('Cinema view — press C to walk again'); }
  else { setMode('walk'); hud.toast('Back on your feet'); }
}
function interact() {
  if (mode !== 'walk') return;
  if (!game.interact()) balloon.interact();
}
function startGame(fresh) {
  game.start(fresh);
  setMode('walk');
  if (!capture) { music.play().catch(() => {}); renderer.domElement.requestPointerLock?.()?.catch?.(() => {}); }
}

const hud = createGameHUD({ onMoon: toggleMoon, onSound: toggleSound, onVoices: toggleVoices, voicesOn: voice.enabled, onTheme: toggleTheme,
  onCinematic: toggleCinema, onInteract: interact, town, onStart: startGame,
  hasSave: () => { try { return !!(localStorage.getItem('chandrapur-save-v2') ?? localStorage.getItem('chandpur-save-v2')); } catch { return false; } },
  onRestart: () => { try { localStorage.removeItem('chandrapur-save-v2'); localStorage.removeItem('chandpur-save-v2'); } catch { /* ok */ } location.reload(); } });
const game = createGame({ scene, player, town, life, balloon, day, moon, music, voice, hud, toggleMoon });

// decorative glows (sprites, points, lines, light pools/cones, halos) live on
// layer 1 so probes can tell them from solid geometry; the colour pass draws all layers
scene.traverse((o) => {
  if (o.isSprite || o.isPoints || o.isLine) o.layers.set(1);
  else if (o.isMesh && (o.name === 'light-pool' || o.name === 'light-cone')) o.layers.set(1);
  else if (o.name === 'moon-glow' || o.name === 'halo' || o.name === 'steam') o.layers.set(1);
  else if (o.isMesh && o.parent?.name === 'kettle-steam') o.layers.set(1);
});

window.addEventListener('resize', () => {
  onResize(cam.camera, null);
  post.setSize(window.innerWidth, window.innerHeight, renderer.getPixelRatio());
});
post.setSize(window.innerWidth, window.innerHeight, renderer.getPixelRatio());

const updaters = [...town.updaters, (t) => life.update(t)];

// agent / debug tools on window for console + automated checks
const tools = createAgentTools({ scene, camera: cam.camera, camCtl: cam, player, mode: () => mode, moon, river, post, music, toggleMoon, toggleCinema });
window.__moon = tools;
let debugPaused = capture;
function renderFrame(time) {
  renderer.shadowMap.needsUpdate = true;
  sky.follow(cam.camera);
  post.render(scene, cam.camera, day.leakSource(leakPos), time);
}
window.__town = { town, scene, camera: cam.camera, renderer, post, player, input, river, balloon, life, game, day, hud, music, voice, layout: worldLayout, collisions: worldCollisions,
  setPaused(v) { debugPaused = v; },
  setDayTime(t) { day.set(t); },
  step(dt = 1 / 60) { simulationTime += dt; updateWorld(dt, simulationTime); },
  interact,
  render() { renderFrame(simulationTime); },
  captureFlight(seconds = 62) {
    debugPaused = true;
    const l = worldLayout.LANDINGS[0]; player.snapTo(new THREE.Vector3(...l.access), new THREE.Vector3(l.position[0], 1.7, l.position[2]));
    player.update(0.016); balloon.board();
    for (let i = 0; i < Math.round(seconds * 60); i++) { simulationTime += 1 / 60; updateWorld(1 / 60, simulationTime); }
    renderFrame(simulationTime);
    return balloon.status();
  },
  renderView(position, target, time = 8) {
    debugPaused = true; player.group.visible = false;
    cam.camera.position.set(...position); cam.camera.lookAt(new THREE.Vector3(...target)); cam.camera.updateMatrixWorld(true);
    for (const u of updaters) u(time);
    game.npcs.update(time, 1 / 60);
    moon.update(0, time, cam.camera); day.update(0); river.update(time, day.leakSource(leakPos));
    renderFrame(time);
    return tools.frameInfo();
  },
  probeView(position, target) {
    debugPaused = true;
    cam.camera.position.set(...position); cam.camera.lookAt(new THREE.Vector3(...target)); cam.camera.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(cam.camera.position, moon.position.clone().sub(cam.camera.position).normalize(), 0.1,
      cam.camera.position.distanceTo(moon.position) - 6.5);
    const blockers = ray.intersectObjects([town.group], true).slice(0, 3).map((h) => ({
      source: h.object.userData.sourceRanges?.find((r) => h.faceIndex < r.end)?.source || h.object.name,
      at: h.point.toArray(), distance: h.distance,
    }));
    return { ground: worldLayout.surfaceY(position[0], position[2]), solid: worldCollisions.blockersAt(position[0], position[2]),
      moon: tools.project(...moon.position.toArray()), blockers };
  },
};

window.addEventListener('keydown', (e) => {
  if (e.repeat || hud.mapOpen || hud.titleOpen || /^(BUTTON|INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (e.code === 'KeyM') toggleMoon();
  if (e.code === 'KeyC') toggleCinema();
  if (e.code === 'KeyT') chat();
});

// ---- loop ----
const clock = new THREE.Clock();
let firstFrame = true;
let simulationTime = 0;
let lastShadowUpdate = -1;
let hudTimer = 0;
const fwd = new THREE.Vector3();

function updateWorld(dt, t) {
  const blocked = hud.mapOpen || game.blocking || hud.titleOpen;
  if (mode === 'walk' && input.wasPressed('KeyE') && !hud.mapOpen) interact();
  if (balloon.riding) balloon.update(dt, t);
  else {
    if (mode === 'walk' && !blocked && !day.rushing) player.update(dt);
    else if (mode !== 'walk') cam.update(dt, t);
    else input.consumeFrame();
    balloon.update(dt, t);
  }
  moon.update(dt, t, cam.camera);
  day.update(dt);
  music.setNight(day.night);
  const p = player.position, fromWater = Math.abs(p.z - worldLayout.riverCentre(p.x)) - worldLayout.riverHalfWidth(p.x);
  music.setRiver(Math.max(0, Math.min(1, 1 - fromWater / 28)));
  music.tick(dt);
  river.update(t, day.leakSource(leakPos));
  for (const u of updaters) u(t);
  const district = districtAt(player.position.x, player.position.z);
  game.update(t, dt, district);
  hudTimer -= dt;
  if (hudTimer <= 0) {
    hudTimer = 0.1;
    hud.setDistrict(district);
    hud.setClock(day.clock(), day.phase(), day.night);
    hud.setInteraction(balloon.status());
  }
  cam.camera.getWorldDirection(fwd);
  hud.frame(player.position, Math.atan2(fwd.x, -fwd.z), distanceText());
}
function distanceText() {
  const target = game.target;
  if (!target) return '';
  const d = Math.hypot(target.x - player.position.x, target.z - player.position.z);
  return d < 4 ? '📍 You are here' : `📍 ${Math.round(d)} m away`;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (debugPaused) return;
  simulationTime += dt;
  updateWorld(dt, simulationTime);
  window.__town.frames = (window.__town.frames ?? 0) + 1;
  if (simulationTime - lastShadowUpdate > 0.2) { renderer.shadowMap.needsUpdate = true; lastShadowUpdate = simulationTime; }
  sky.follow(cam.camera);
  post.render(scene, cam.camera, day.leakSource(leakPos), simulationTime);
  if (firstFrame) { firstFrame = false; hud.hideLoader(); }
}
animate();
if (capture) { hud.hideLoader(); document.querySelector('.g-title')?.setAttribute('hidden', ''); hud.root.hidden = false; game.start(true); }
