/* Diag v3: sahifa ichidagi xato/block/holat matni */
const { chromium } = require("playwright");
const BASE = process.argv[2] || "https://edu.akelagroup.uz";
const TEST_ID = process.argv[3] || "cmudoc4hm0000jt04jdroy06m";
const EMAIL = process.env.ADMIN_EMAIL || "SvRvS@gmail.com";
const PASS = process.env.ADMIN_PASS || "Saidakabar3003";
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("console", (m) => { const t = m.text(); if (/error|fail|blok|limit|attempt/i.test(t)) console.log("[console]", t.slice(0, 200)); });
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const em = page.locator('input[type="email"]').first();
  if (await em.count()) await em.fill(EMAIL); else await page.locator("input").first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASS);
  await page.getByRole("button", { name: /Kirish/i }).first().click();
  await page.waitForTimeout(5000);
  await page.goto(`${BASE}/tests/${TEST_ID}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(4000);
    const s = await page.evaluate(() => ({
      url: location.href,
      text: (document.body.innerText || "").slice(0, 500),
      topbar: !!document.querySelector('[data-testid="quiz-topbar"]'),
      blocked: (document.body.innerText || "").toLowerCase().includes("blok"),
      loading: (document.body.innerText || "").includes("yuklanmoqda"),
    }));
    console.log(`t=${(i + 1) * 4}s`, JSON.stringify(s));
    if (s.topbar) break;
  }
  await page.screenshot({ path: "diag-v3.png" }).catch(() => {});
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(2); });
