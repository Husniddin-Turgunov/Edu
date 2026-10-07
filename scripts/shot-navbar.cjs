// Navbar ning yakuniy ko'rinishi (faqat yuqori qism).
const { chromium } = require("playwright");
const BASE = (process.argv[2] || "http://localhost:3111").replace(/\/$/, "");

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1588, height: 400 } });
  const p = await ctx.newPage();
  await p.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 60000 });
  await p.locator('input[type="email"]').first().fill("admin@akelagroup.com");
  await p.locator('input[type="password"]').first().fill("AGM_9561");
  await p.locator('button[type="submit"]').first().click();
  await p.waitForTimeout(4000);
  await p.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: "navbar-final.png", clip: { x: 0, y: 0, width: 1588, height: 110 } });
  console.log("navbar-final.png");
  await b.close();
})();
