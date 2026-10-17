import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Meaningful world check: collision-aware flood fill, designed-route clearance,
// and walkable grades. A graph of labels alone does not prove a route exists.
let browser;
try { browser = await chromium.launch({ headless: true }); }
catch { browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] }); }
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/?capture=1', { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => !!window.__town, { timeout: 120000 });
  const report = await page.evaluate(async () => {
    window.__town.setPaused(true);
    const L = window.__town.layout;
    const C = window.__town.collisions;
    const cell = 0.5, x0 = -109, z0 = -99, nx = 404, nz = 384;
    const pass = new Uint8Array(nx * nz), visited = new Uint8Array(nx * nz), height = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = x0 + i * cell, z = z0 + j * cell, k = j * nx + i;
      height[k] = L.surfaceY(x, z);
      pass[k] = !L.isDeepWater(x, z) && !C.isBlocked(x, z, 0.35) ? 1 : 0;
    }
    const index = (x, z) => Math.round((z - z0) / cell) * nx + Math.round((x - x0) / cell);
    const start = index(3, 1), queue = new Int32Array(nx * nz); let head = 0, tail = 0;
    queue[tail++] = start; visited[start] = 1;
    while (head < tail) {
      const k = queue[head++], i = k % nx, j = Math.floor(k / nx);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + dx, jj = j + dz, next = jj * nx + ii;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= nz || !pass[next] || visited[next]) continue;
        if (Math.abs(height[next] - height[k]) > 0.49) continue;
        visited[next] = 1; queue[tail++] = next;
      }
    }
    const destinations = window.__town.town.districts.map((d) => ({ district: d.id,
      reachable: !!visited[index(d.anchor[0], d.anchor[2])], anchor: d.anchor }));
    destinations.push({ district: 'south-bank-bridge', reachable: !!visited[index(-21, 71.2)] });
    for (const l of L.LANDINGS) {
      destinations.push({ district: `${l.id}-balloon-access`, reachable: !!visited[index(l.access[0], l.access[2])] });
      destinations.push({ district: `${l.id}-balloon-exit`, reachable: !!visited[index(l.exit[0], l.exit[2])] });
    }
    const routes = L.activeRoutes().map((r) => {
      let collisions = 0, water = 0, worstGrade = 0; const problems = [];
      let previous = null;
      for (let j = 0; j < r.points.length - 1; j++) {
        const a = r.points[j], b = r.points[j + 1], length = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.ceil(length / 0.2);
        for (let i = 0; i <= n; i++) {
          const t = i / n, x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t, y = L.surfaceY(x, z);
          if (C.isBlocked(x, z, 0.35)) { collisions++; if (problems.length < 10) problems.push({ at: [+x.toFixed(2), +z.toFixed(2)], blockers: C.blockersAt(x, z, 0.35) }); }
          if (L.isDeepWater(x, z)) water++;
          if (previous) { const step = Math.hypot(x - previous.x, z - previous.z); if (step > 0.01) worstGrade = Math.max(worstGrade, Math.abs(y - previous.y) / step); }
          previous = { x, z, y };
        }
      }
      return { route: r.id, collisions, water, worstGrade, problems };
    });
    return { stage: L.WORLD_STAGE, destinations, routes, reachableCells: tail,
      colliders: { boxes: C.boxes.length, circles: C.circles.length, oriented: C.oriented.length }, batching: window.__town.town.batchReport };
  });
  report.errors = errors;
  await mkdir('agent/shots/town', { recursive: true });
  await writeFile('agent/shots/town/connectivity.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  assert.equal(errors.length, 0, 'browser errors');
  assert.ok(report.colliders.oriented > 30, 'the tested collider registry must be the running game registry');
  for (const d of report.destinations) assert.equal(d.reachable, true, `${d.district} is disconnected`);
  for (const r of report.routes) { assert.equal(r.collisions, 0, `${r.route} is obstructed`); assert.equal(r.water, 0, `${r.route} enters deep water`); }
} finally { await browser.close(); }
