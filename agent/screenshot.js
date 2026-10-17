import { chromium } from "playwright";

let browser;
try {
  browser = await chromium.launch({ headless: true });
} catch {
  // environment without downloaded browsers: fall back to system chrome
  browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
}

const page = await browser.newPage({
  viewport: {
    width: 1600,
    height: 900
  }
});

await page.goto("http://127.0.0.1:5173", {
  waitUntil: "networkidle"
});

// let the intro camera sweep + moon settle before capturing
await page.waitForTimeout(6000);

await page.screenshot({
  path: "agent/latest.png",
  fullPage: false
});

await browser.close();

console.log("Screenshot saved.");
