import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

let browser;
try { browser = await chromium.launch({ headless: true }); }
catch { browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] }); }
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/?capture=1', { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => !!window.__town, { timeout: 120000 });
  const report = await page.evaluate(async () => {
    const S = window.__town; S.setPaused(true);
    const L = S.layout, player = S.player;
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const reports = [];
    const network = [
      ...L.activeRoutes(),
      { id: 'station-open-passage', points: [[0, 0, -7.5], [0, 0.8, -15.9]] },
      { id: 'river-footbridge', points: [[-21, 0, 45.8], [-21, 0, 71.2]] },
    ];
    for (const route of network) {
      const first = route.points[0];
      player.snapTo(new THREE.Vector3(...first), new THREE.Vector3(...route.points[1]).add(new THREE.Vector3(0, 1.5, 0)));
      let ticks = 0, maxGroundError = 0, arrived = true;
      for (let j = 1; j < route.points.length; j++) {
        const goal = route.points[j]; let legTicks = 0;
        while (Math.hypot(player.position.x - goal[0], player.position.z - goal[2]) > 0.13 && legTicks < 2200) {
          const dx = goal[0] - player.position.x, dz = goal[2] - player.position.z;
          const want = Math.atan2(dx, dz), yaw = player.cameraYaw;
          const change = Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw));
          const canvas = S.renderer.domElement;
          canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: 0, clientY: 0 }));
          window.dispatchEvent(new MouseEvent('pointermove', { clientX: -change / 0.0026, clientY: 0 }));
          window.dispatchEvent(new MouseEvent('pointerup'));
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
          const dt = Math.min(1 / 30, Math.hypot(dx, dz) / 3.2);
          player.update(dt);
          maxGroundError = Math.max(maxGroundError, Math.abs(player.position.y - L.surfaceY(player.position.x, player.position.z)));
          legTicks++; ticks++;
        }
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
        if (legTicks >= 2200) { arrived = false; break; }
      }
      player.update(1 / 30);
      reports.push({ route: route.id, arrived, ticks, position: player.position.toArray(), maxGroundError });
    }
    return { routes: reports };
  });
  report.errors = errors;
  await writeFile('agent/shots/town/walking-check.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  assert.equal(errors.length, 0);
  for (const r of report.routes) assert.ok(r.arrived, `${r.route}: physical walking failed at ${r.position}`);
} finally { await browser.close(); }
