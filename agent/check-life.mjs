import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

let browser;
try { browser = await chromium.launch({ headless: true }); }
catch { browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] }); }
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/?capture=1', { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => !!window.__town, { timeout: 120000 });
  const report = await page.evaluate(() => {
    const S = window.__town; S.setPaused(true);
    let invalidBones = 0, invalidVertices = 0, walkerBlocked = 0;
    const walker = S.life.residents.find((r) => r.moving).human;
    const problems = [];
    for (let i = 0; i < 60 * 80; i++) {
      S.step(1 / 60);
      if (S.collisions.isBlocked(walker.group.position.x, walker.group.position.z, 0.18)) {
        walkerBlocked++; if (problems.length < 6) problems.push({ position: walker.group.position.toArray(), blockers: S.collisions.blockersAt(walker.group.position.x, walker.group.position.z, 0.18) });
      }
      if (i % 60 === 0) for (const r of S.life.residents) {
        const h = r.human;
        for (const bone of h.B.bones) if (!bone.position.toArray().concat(bone.quaternion.toArray()).every(Number.isFinite)) invalidBones++;
        const geometry = h.mesh.geometry;
        for (const attr of ['position', 'color', 'skinWeight']) if (!Array.from(geometry.attributes[attr].array).every(Number.isFinite)) invalidVertices++;
      }
    }
    return { residents: S.life.residents.map((r) => r.name), animals: S.life.animals,
      invalidBones, invalidVertices, walkerBlocked, problems };
  });
  report.errors = errors;
  await writeFile('agent/shots/town/life-check.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  assert.equal(errors.length, 0); assert.equal(report.invalidBones, 0); assert.equal(report.invalidVertices, 0); assert.equal(report.walkerBlocked, 0);
} finally { await browser.close(); }
