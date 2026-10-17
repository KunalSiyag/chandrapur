import { chromium } from 'playwright';

const errors = [];
let browser;
try {
  browser = await chromium.launch();
} catch {
  browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
  });
}
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#app canvas', { timeout: 20000 });
await page.waitForTimeout(6000);
await page.screenshot({ path: '/tmp/smoke-night.png' });
console.log('night screenshot ok');
console.log('canvas present: true');
const info = await page.evaluate(() => {
  const c = document.querySelector('#app canvas');
  let colors = -1;
  if (c) {
    const g = document.createElement('canvas'); g.width = 48; g.height = 48;
    g.getContext('2d').drawImage(c, 0, 0, 48, 48);
    const d = g.getContext('2d').getImageData(0, 0, 48, 48).data;
    const set = new Set();
    for (let i = 0; i < d.length; i += 20) set.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]);
    colors = set.size;
  }
  return { tools: typeof window.__moon, moon: window.__moon?.sceneInfo?.().moon, cam: window.__moon?.sceneInfo?.().camera, colors };
});
console.log('tools:', info.tools, 'moon:', JSON.stringify(info.moon), 'cam:', JSON.stringify(info.cam), 'colors:', info.colors);
await page.evaluate(() => window.__moon.moonDown());
await page.waitForTimeout(6000); // let moon + camera flights settle
console.log('moon after toggle:', JSON.stringify(await page.evaluate(() => window.__moon.sceneInfo().moon)));
await page.screenshot({ path: '/tmp/smoke.png' });
console.log('screenshot ok');
await browser.close();
console.log('CONSOLE ERRORS:', errors.length ? errors.slice(0, 5) : 'none');
if (!info.moon || info.colors < 8 || errors.length) process.exit(1);
