import { chromium } from 'playwright';
import { execSync } from 'child_process';
let browser;
try { browser = await chromium.launch({ headless: true }); }
catch { browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] }); }
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
await page.waitForTimeout(7000);
await page.evaluate(() => window.__moon.viewFrom(2, 0, 20, 2, 1.2, 34));
await page.waitForTimeout(1500);
console.log('avatar at:', await page.evaluate(() => window.__moon.find('chr_avatar')));
console.log('player state:', await page.evaluate(() => window.__moon.playerInfo()));
await page.evaluate(() => window.__moon.cinemaMode(true));
await page.waitForTimeout(400);
await page.evaluate(() => window.__moon.orbitSnap(2, 1.45, 27.5, 2, 1.24, 20));
await page.waitForTimeout(900);
const r = await page.evaluate(() => window.__moon.project(2, 1.28, 20));
console.log('head projects to:', r);
await page.screenshot({ path: '/tmp/opencode/avatar-front-full.png', timeout: 45000 });
await browser.close();
if (r.visible) {
  const cx = Math.round(Math.max(0, Math.min(1080, r.x - 260)));
  const cy = Math.round(Math.max(0, Math.min(300, r.y - 300)));
  execSync(`ffmpeg -y -loglevel error -i /tmp/opencode/avatar-front-full.png -vf "crop=520:600:${cx}:${cy}" /tmp/opencode/avatar-face.png`);
  console.log('cropped at', cx, cy);
}
