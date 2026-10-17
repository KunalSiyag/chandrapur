import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://127.0.0.1:5173/?capture=1', { waitUntil: 'networkidle', timeout: 180000 });
await page.waitForFunction(() => !!window.__town, null, { timeout: 180000 });
const r = await page.evaluate(() => {
  const S = window.__town, cam = S.camera, THREE_F = cam.constructor;
  S.player.snapTo(new S.player.position.constructor(3.2, 0, 1), new S.player.position.constructor(0, 2, -10)); S.player.update(0.016);
  cam.updateMatrixWorld(true);
  const counts = {};
  S.scene.traverse((o) => {
    if (!(o.isMesh || o.isSprite || o.isPoints || o.isLine) || !o.visible) return;
    let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) vis = false; if (!vis) return;
    let top = o; const chain = [];
    for (let p = o; p && p !== S.scene; p = p.parent) chain.push(p.name || p.type);
    const key = chain.reverse().slice(0, 3).join('/');
    counts[key] = (counts[key] ?? 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 30);
});
console.log(r.map(([k, v]) => `${v}\t${k}`).join('\n'));
await browser.close();
