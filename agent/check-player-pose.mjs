import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

// Deterministic regression + rendering of the actual player, rig and post
// pipeline. An isolated flat platform makes posture/contact measurable;
// this harness does not import main.js or drive animation by wall-clock waits.
const output = new URL('./shots/', import.meta.url);
const errors = [];
let browser;
try {
  browser = await chromium.launch({ headless: true });
} catch {
  browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/player-pose-check.html', (route) => route.fulfill({ contentType: 'text/html',
    body: '<!doctype html><html><body style="margin:0;background:#070b1a"><div id="app"></div></body></html>' }));
  await page.goto(`${process.env.POSE_TEST_URL || 'http://127.0.0.1:5173'}/player-pose-check.html`);

  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { createPlayer } = await import('/src/core/player.js');
    const { surfaceY } = await import('/src/world/layout.js');
    const { clearColliders, addBoxRect, resolveXZ } = await import('/src/world/colliders.js');
    const { createRenderer } = await import('/src/core/renderer.js');
    const { setupLights, toonMaterial } = await import('/src/core/toon.js');
    const { createPost } = await import('/src/core/post.js');
    clearColliders();

    const { scene, renderer } = createRenderer(document.getElementById('app'));
    const light = setupLights(scene);
    light.moonLight.target.position.set(-2, 1, -12.8);
    light.moonLight.position.set(-28, 35, 6);
    light.moonLight.shadow.mapSize.set(1024, 1024);
    light.moonLight.shadow.camera.left = light.moonLight.shadow.camera.bottom = -12;
    light.moonLight.shadow.camera.right = light.moonLight.shadow.camera.top = 12;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), toonMaterial(0x7d7a72));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(-2, 1, -12.8);
    floor.receiveShadow = true;
    scene.add(floor);
    const grid = new THREE.GridHelper(20, 40, 0x9f988b, 0x656472);
    grid.position.set(-2, 1.002, -12.8);
    scene.add(grid);

    const keys = new Set();
    const input = {
      lookDX: 0, lookDY: 0, zoomDelta: 0,
      isDown: (key) => keys.has(key),
      consumeFrame() { this.lookDX = this.lookDY = this.zoomDelta = 0; },
    };
    const camera = new THREE.PerspectiveCamera(58, 1280 / 720, 0.1, 500);
    // The redesigned town's flat plaza is the isolated measurement surface.
    // Target height equals the actor's eye so W points exactly along +X.
    const testZ = -2, testY = surfaceY(-6, testZ);
    floor.position.set(-2, testY, testZ); grid.position.set(-2, testY + 0.002, testZ);
    light.moonLight.target.position.set(-2, testY, testZ);
    const player = createPlayer(input, camera, { scene, spawn: new THREE.Vector3(-6, 0, testZ), resolveXZ });
    const resetPlayer = () => player.snapTo(new THREE.Vector3(-6, 0, testZ), new THREE.Vector3(3, testY + 1.62, testZ));
    const mesh = player.group.children.find((o) => o.isSkinnedMesh);
    const bones = Object.fromEntries(mesh.skeleton.bones.map((b) => [b.name, b]));
    const vec = () => new THREE.Vector3();
    const world = (name) => bones[name].getWorldPosition(vec());
    const arr = (v) => v.toArray();
    const horizontal = (v) => Math.hypot(v.x, v.z);
    const degrees = 180 / Math.PI;
    const frame = 1 / 60;
    let time = 0;
    const tick = () => { player.update(frame); time += frame; };
    const forFrames = (n) => { for (let i = 0; i < n; i++) tick(); };

    // Vertices of the actual skinned sandals, not just ankle markers.
    const soleVertices = {};
    for (const side of ['L', 'R']) {
      const index = mesh.skeleton.bones.indexOf(bones['foot' + side]);
      const list = [];
      for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
        if (mesh.geometry.attributes.skinIndex.getX(i) === index && mesh.geometry.attributes.skinWeight.getX(i) > 0.999) list.push(i);
      }
      soleVertices[side] = list;
    }

    function measure() {
      scene.updateMatrixWorld(true);
      mesh.skeleton.update();
      const hips = world('hips'), chest = world('chest');
      const feet = {};
      for (const side of ['L', 'R']) {
        const ankle = bones['foot' + side];
        const contact = ankle.userData.soleOffset.clone().applyMatrix4(ankle.matrixWorld);
        let soleY = Infinity;
        for (const i of soleVertices[side]) soleY = Math.min(soleY, mesh.localToWorld(mesh.getVertexPosition(i, vec())).y);
        feet[side] = { contact: arr(contact), height: contact.y - surfaceY(contact.x, contact.z),
          renderedSoleHeight: soleY - testY, quaternion: arr(ankle.getWorldQuaternion(new THREE.Quaternion())) };
      }
      const footMid = new THREE.Vector3().fromArray(feet.L.contact).add(new THREE.Vector3().fromArray(feet.R.contact)).multiplyScalar(0.5);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(bones.chest.getWorldQuaternion(new THREE.Quaternion()));
      const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
      const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(bones.head.getWorldQuaternion(new THREE.Quaternion()));
      const motionPitch = Math.atan2(up.dot(forward), up.y) * degrees;
      const axis = chest.clone().sub(hips);
      return {
        position: arr(player.position), bodyYaw: player.yaw,
        chestPitchDegrees: motionPitch,
        torsoHorizontalOffset: horizontal(axis),
        pelvisCenterError: horizontal(hips.clone().sub(footMid)),
        pelvis: arr(hips), feet,
        headDirection: arr(facing),
        rootEuler: player.group.rotation.toArray().slice(0, 3), meshEuler: mesh.rotation.toArray().slice(0, 3),
        coreBones: Object.fromEntries(['root', 'hips', 'spine', 'chest'].map((n) => [n,
          { position: arr(bones[n].position), quaternion: arr(bones[n].quaternion) }])),
      };
    }

    // The same toon lighting + skinned ink pre-pass used by the game.
    const shotCamera = new THREE.OrthographicCamera(-2.4, 2.4, 1.35, -1.35, 0.1, 500);
    const post = createPost(renderer, scene, shotCamera);
    post.setSize(1280, 720, 1);
    const captures = {};
    function capture(name, view) {
      const center = player.position.clone().add(new THREE.Vector3(0, 0.86, 0));
      const axis = view === 'side' ? new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw))
        : new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
      shotCamera.position.copy(center).addScaledVector(axis, 6);
      shotCamera.up.set(0, 1, 0);
      shotCamera.lookAt(center);
      post.render(scene, shotCamera, new THREE.Vector3(-20, 20, 58), time);
      captures[name] = renderer.domElement.toDataURL('image/png').split(',')[1];
    }

    resetPlayer();
    forFrames(180);
    const idle = measure();
    capture('player-idle-side.png', 'side');
    capture('player-idle-front.png', 'front');
    forFrames(180);
    const idleLater = measure();

    // Camera objects are external to the skeleton. Zooming/orbiting/rendering
    // with another camera must not alter any core bone or foot plant.
    camera.position.set(7, 12, 30);
    camera.rotation.set(1.1, -0.7, 0.3);
    input.zoomDelta = 120;
    player.update(0);
    const cameraOnly = measure();
    input.lookDX = 100;
    input.lookDY = 35;
    forFrames(90);
    const looking = measure();

    // Reset only the test's placement, then drive real movement input.
    resetPlayer();
    const walking = [];
    let previous;
    let maxPlantDrift = 0, maxPlantOrientationDrift = 0, plantPairs = 0;
    let capturedWalk;
    keys.add('KeyW');
    for (let i = 0; i < 90; i++) {
      tick();
      const m = measure();
      walking.push(m);
      if (!capturedWalk && i >= 24 && Math.max(m.feet.L.height, m.feet.R.height) > 0.025) {
        capturedWalk = m;
        capture('player-walking-side.png', 'side');
        capture('player-walking-front.png', 'front');
      }
      if (previous) for (const s of ['L', 'R']) {
        const f = m.feet[s], last = previous.feet[s];
        if (Math.abs(f.height) < 1e-6 && Math.abs(last.height) < 1e-6) {
          const diff = new THREE.Vector3().fromArray(f.contact).sub(new THREE.Vector3().fromArray(last.contact));
          maxPlantDrift = Math.max(maxPlantDrift, horizontal(diff));
          maxPlantOrientationDrift = Math.max(maxPlantOrientationDrift,
            new THREE.Quaternion().fromArray(f.quaternion).angleTo(new THREE.Quaternion().fromArray(last.quaternion)));
          plantPairs++;
        }
      }
      previous = m;
    }
    keys.clear(); tick();
    const stoppedImmediately = measure();
    capture('player-stopped-side.png', 'side');
    forFrames(180);
    const stopped = measure();

    // Holding W against a collider has zero displacement, so no walking lean.
    resetPlayer();
    addBoxRect(-5.66, testZ - 0.7, -4.9, testZ + 0.8);
    keys.add('KeyW'); forFrames(30);
    const blocked = measure();
    keys.clear(); clearColliders();

    // Running is allowed a slightly greater (still bounded) motion-only lean.
    resetPlayer();
    keys.add('KeyW'); keys.add('ShiftLeft'); forFrames(45);
    const running = measure();
    keys.clear(); tick();
    const afterRun = measure();

    return {
      idle, idleLater, cameraOnly, looking, capturedWalk, stoppedImmediately, stopped, blocked, running, afterRun,
      bind: { ankleOffset: arr(bones.footL.userData.rest), shinLength: bones.footL.position.length(),
        soleOffset: arr(bones.footL.userData.soleOffset), meshBind: mesh.bindMatrix.toArray(),
        allBoneBindRotationsIdentity: mesh.skeleton.boneInverses.every((m) =>
          Math.abs(m.elements[0] - 1) + Math.abs(m.elements[5] - 1) + Math.abs(m.elements[10] - 1) < 1e-9) },
      walkChecks: {
        samples: walking.length, plantPairs, maxPlantDrift, maxPlantOrientationDrift,
        maxPitch: Math.max(...walking.map((m) => Math.abs(m.chestPitchDegrees))),
        maxContactError: Math.max(...walking.flatMap((m) => ['L', 'R'].map((s) => Math.max(0, -m.feet[s].height)))),
        allFramesHaveSupport: walking.every((m) => Math.min(Math.abs(m.feet.L.height), Math.abs(m.feet.R.height)) < 0.002),
        maxSwingHeight: Math.max(...walking.flatMap((m) => ['L', 'R'].map((s) => m.feet[s].height))),
      },
      captures,
    };
  });

  const approx = (value, expected, tolerance, message) => assert.ok(Math.abs(value - expected) <= tolerance,
    `${message}: got ${value}, expected ${expected} ± ${tolerance}`);
  function upright(m, label) {
    approx(m.chestPitchDegrees, 0, 1e-5, `${label} spine pitch`);
    approx(m.torsoHorizontalOffset, 0, 1e-5, `${label} vertical torso`);
    approx(m.pelvisCenterError, 0, 1e-5, `${label} centered pelvis`);
    for (const s of ['L', 'R']) approx(m.feet[s].height, 0, 0.002, `${label} ${s} foot contact`);
    approx(m.rootEuler[0], 0, 1e-8, `${label} root pitch`);
    approx(m.rootEuler[2], 0, 1e-8, `${label} root roll`);
    assert.deepEqual(m.meshEuler, [0, 0, 0], `${label} mesh isn't rotated to compensate`);
  }
  upright(result.idle, 'Idle'); upright(result.idleLater, 'Sustained idle');
  upright(result.stoppedImmediately, 'First stopped frame'); upright(result.stopped, 'Stopped');
  upright(result.blocked, 'Blocked'); upright(result.afterRun, 'First stopped run frame');
  for (const s of ['L', 'R']) {
    approx(result.idle.feet[s].renderedSoleHeight, 0, 0.002, `Rendered idle sandal ${s}`);
    assert.deepEqual(result.idle.feet[s].contact, result.idleLater.feet[s].contact, 'Idle plants stay fixed');
    assert.deepEqual(result.idleLater.feet[s].contact, result.cameraOnly.feet[s].contact, 'Camera cannot move a foot');
    assert.deepEqual(result.cameraOnly.feet[s].contact, result.looking.feet[s].contact, 'Looking cannot move a foot');
  }
  assert.deepEqual(result.idleLater.coreBones, result.cameraOnly.coreBones, 'Camera/zoom cannot rotate the core skeleton');
  assert.deepEqual(result.cameraOnly.coreBones, result.looking.coreBones, 'Look input affects only the neck/head');
  assert.notDeepEqual(result.cameraOnly.headDirection, result.looking.headDirection, 'Head responds to deliberate look input');
  assert.equal(result.bind.allBoneBindRotationsIdentity, true);
  approx(Math.hypot(...result.bind.ankleOffset), result.bind.shinLength, 1e-9, 'IK shin keeps its real bind length');
  assert.ok(result.bind.soleOffset[1] < 0 && result.bind.ankleOffset[1] < result.bind.soleOffset[1], 'Sole offset is separate');
  assert.ok(result.walkChecks.plantPairs > 25, 'Test sampled sustained stance phases');
  approx(result.walkChecks.maxPlantDrift, 0, 1e-5, 'Stance foot world-space drift');
  approx(result.walkChecks.maxPlantOrientationDrift, 0, 1e-5, 'Stance foot heading drift');
  assert.ok(result.walkChecks.maxPitch > 1 && result.walkChecks.maxPitch < 2.1, 'Walking lean stays around 2 degrees');
  assert.ok(result.running.chestPitchDegrees > 3 && result.running.chestPitchDegrees < 3.8, 'Running lean is bounded');
  assert.ok(result.walkChecks.allFramesHaveSupport, 'Every walking frame has a planted support foot');
  assert.ok(result.walkChecks.maxSwingHeight > 0.035 && result.walkChecks.maxSwingHeight < 0.065, 'Swing foot lifts intentionally');
  approx(result.blocked.position[0], -6, 1e-8, 'Wall stops locomotion');
  assert.deepEqual(errors, [], 'No browser/renderer errors');

  for (const [name, data] of Object.entries(result.captures)) fs.writeFileSync(new URL(name, output), Buffer.from(data, 'base64'));
  delete result.captures;
  fs.writeFileSync(new URL('player-pose-check.json', output), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({
    status: 'PASS', idlePitch: result.idle.chestPitchDegrees,
    idlePelvisCenterError: result.idle.pelvisCenterError,
    walkingPitch: result.walkChecks.maxPitch, runningPitch: result.running.chestPitchDegrees,
    firstStoppedPitch: result.stoppedImmediately.chestPitchDegrees,
    plantedFootDrift: result.walkChecks.maxPlantDrift,
    supportEveryWalkingFrame: result.walkChecks.allFramesHaveSupport,
    snapshots: 'agent/shots/player-{idle,walking,stopped}-{side,front}.png',
  }, null, 2));
} finally {
  await browser.close();
}
