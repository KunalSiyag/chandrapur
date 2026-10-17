import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

let browser;
try { browser = await chromium.launch({ headless: true }); }
catch { browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] }); }
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/?capture=1', { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => !!window.__town, { timeout: 120000 });
  const report = await page.evaluate(async () => {
    const S = window.__town, b = S.balloon, p = S.player, cam = S.camera, L = S.layout, C = S.collisions;
    S.setPaused(true);
    const checks = {}, sequence = [], clearance = [], snapshots = [], landmarks = new Set(), guidedLandmarks = new Set();
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const vec = (a) => new THREE.Vector3(...a);
    const initialColliders = C.oriented.length;
    // Default compositions are evaluated on a complete guided flight before
    // a second pass exercises free-look and the actual keyboard controls.
    S.captureFlight(0);
    for (let i = 0; i < 60 * 110; i++) {
      S.step(1 / 60);
      if (b.state === 'cruising' && i % 30 === 0) {
        cam.updateMatrixWorld(true);
        for (const [name, point] of [['station', [0, 5, -11]], ['bazaar', [18, 4, 24]], ['river', [24, 0, 52]],
          ['fort', [-73, 23, -62]], ['shrine', [-35, 30, -79]]]) {
          const ndc = vec(point).project(cam);
          if (Math.abs(ndc.x) < 0.9 && ndc.y > -0.1 && ndc.y < 0.8 && ndc.z < 1) guidedLandmarks.add(name);
        }
      }
    }
    checks.guidedLandmarks = ['station', 'bazaar', 'river', 'fort', 'shrine'].every((n) => guidedLandmarks.has(n));
    b.exit(); for (let i = 0; i < 60; i++) S.step(1 / 60);
    p.snapTo(vec(L.LANDINGS[1].access), vec([-53, 19.1, -69])); b.board();
    for (let i = 0; i < 60 * 110; i++) S.step(1 / 60);
    b.exit(); for (let i = 0; i < 60; i++) S.step(1 / 60);
    p.snapTo(vec([3.2, 0, 1]), vec([0, 1.5, -11]));
    checks.remoteBoardRejected = b.board() === false;
    const access = L.LANDINGS[0].access;
    p.snapTo(vec(access), vec([3, 1.8, 77])); p.update(1 / 60);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); S.step(1 / 60);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }));
    checks.keyBoards = b.riding;
    checks.avatarSuspended = p.transported && !p.group.visible;
    checks.airborneColliderRemoved = C.oriented.length === initialColliders - 1;
    let previous = [...b.status().position], maxStep = 0;
    for (let i = 0; i < 60 * 25; i++) {
      S.step(1 / 60); const s = b.status();
      maxStep = Math.max(maxStep, Math.hypot(...s.position.map((n, j) => n - previous[j]))); previous = s.position;
      if (sequence.at(-1) !== s.state) sequence.push(s.state);
    }
    checks.seatedHeight = Math.abs(cam.position.y - b.status().position[1] - 1.46) < 0.03;
    checks.inFlightExitRejected = b.exit() === false;
    // Keyboard walking while riding cannot advance the player's ground pose.
    const playerOffset = p.position.clone().sub(b.group.position);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    for (let i = 0; i < 60; i++) S.step(1 / 60);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    checks.walkingSuspended = p.position.clone().sub(b.group.position).distanceTo(playerOffset) < 1e-7;
    previous = [...b.status().position];
    // Free-look via the actual drag input path, not by mutating the camera.
    const canvas = S.renderer.domElement;
    canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: 200, clientY: 200, bubbles: true }));
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 460, clientY: 280, bubbles: true }));
    S.step(1 / 60); window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    previous = [...b.status().position];
    checks.freeLook = Math.abs(b.status().yawOffset) > 0.4 && Math.abs(b.status().pitchOffset) > 0.1;
    for (let i = 0; i < 60 * 100; i++) {
      S.step(1 / 60); const s = b.status();
      maxStep = Math.max(maxStep, Math.hypot(...s.position.map((n, j) => n - previous[j]))); previous = s.position;
      if (sequence.at(-1) !== s.state) sequence.push(s.state);
      if (s.state === 'cruising' && i % 120 === 0) {
        const terrain = L.groundHeight(s.position[0], s.position[2]);
        clearance.push(s.position[1] - terrain);
      }
      if (s.state === 'cruising' && i % 30 === 0) {
        cam.updateMatrixWorld(true);
        for (const [name, point] of [['station', [0, 5, -11]], ['bazaar', [18, 4, 24]], ['river', [24, 0, 52]],
          ['fort', [-73, 23, -62]], ['shrine', [-35, 30, -79]]]) {
          const ndc = vec(point).project(cam);
          if (Math.abs(ndc.x) < 0.9 && ndc.y > -0.1 && ndc.y < 0.8 && ndc.z < 1) landmarks.add(name);
        }
      }
      if (s.state === 'docked') break;
    }
    checks.upperLanding = b.status().dock === 'upper' && b.state === 'docked';
    checks.landingColliderRestored = C.oriented.length === initialColliders;
    const upper = L.LANDINGS[1];
    const landed = [...b.status().position];
    checks.exits = b.exit();
    let lastExitPosition = p.position.clone(), maxExitStep = 0;
    for (let i = 0; i < 60; i++) {
      S.step(1 / 60); maxExitStep = Math.max(maxExitStep, p.position.distanceTo(lastExitPosition)); lastExitPosition.copy(p.position);
    }
    checks.continuousDisembark = maxExitStep < 0.09;
    checks.exitOnPlatform = p.position.distanceTo(vec(upper.exit)) < 0.1 && Math.abs(p.position.y - L.surfaceY(p.position.x, p.position.z)) < 0.1;
    checks.avatarRestored = !p.transported && p.group.visible;
    checks.exitClear = !C.isBlocked(p.position.x, p.position.z, 0.34);
    p.snapTo(vec(upper.access), vec([upper.position[0], upper.position[1] + 1.6, upper.position[2]]));
    checks.returnBoards = b.board();
    for (let i = 0; i < 60 * 112; i++) S.step(1 / 60);
    checks.returnLands = b.status().dock === 'valley' && b.state === 'docked';
    checks.returnExits = b.exit();
    for (let i = 0; i < 60; i++) S.step(1 / 60);
    checks.registryStable = C.oriented.length === initialColliders;
    // Calling a balloon from the other end is a real empty flight, not an
    // instant summon. Player coordinates remain fixed during its journey.
    p.snapTo(vec(upper.access), vec([upper.position[0], upper.position[1] + 1.6, upper.position[2]]));
    const waiting = p.position.clone();
    checks.callStartsEmptyFlight = b.call() && b.status().emptyFlight && !b.riding;
    for (let i = 0; i < 60 * 109; i++) S.step(1 / 60);
    checks.callFliesToLanding = b.status().dock === 'upper' && b.state === 'docked';
    checks.callKeepsPlayerOnFoot = !p.transported && !b.riding && p.position.distanceTo(waiting) < 1e-7;
    checks.registryStableAfterCall = C.oriented.length === initialColliders;
    return { checks, sequence, maxStep, maxExitStep, minTerrainClearance: Math.min(...clearance), landmarksInGuidedView: [...guidedLandmarks],
      landmarksAfterFreeLook: [...landmarks], landed, final: b.status(), initialColliders };
  });
  report.errors = errors;
  await writeFile('agent/shots/town/balloon-check.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  assert.equal(errors.length, 0, 'browser errors');
  for (const [key, value] of Object.entries(report.checks)) assert.equal(value, true, key);
  assert.ok(report.maxStep < 0.25, 'continuous flight, no position jumps');
  assert.ok(report.minTerrainClearance > 5, 'scenic flight clears the hillside');
} finally { await browser.close(); }
