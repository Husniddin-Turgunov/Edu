/* Diag v4: quiz-options topilmagani sababi — DOM snapshot */
const { chromium } = require("playwright");
const BASE = process.argv[2] || "https://edu.akelagroup.uz";
const TEST_ID = process.argv[3] || "cmudoc4hm0000jt04jdroy06m";
const EMAIL = process.env.ADMIN_EMAIL || "SvRvS@gmail.com";
const PASS = process.env.ADMIN_PASS || "Saidakabar3003";
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const em = page.locator('input[type="email"]').first();
  if (await em.count()) await em.fill(EMAIL); else await page.locator("input").first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASS);
  await page.getByRole("button", { name: /Kirish/i }).first().click();
  await page.waitForTimeout(5000);
  await page.goto(`${BASE}/tests/${TEST_ID}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByTestId("quiz-topbar").waitFor({ timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const info = await page.evaluate(() => {
    const o = {
      quizOptions: document.querySelectorAll('[data-testid="quiz-options"]').length,
      allButtons: document.querySelectorAll("button").length,
      btnLabels: [...document.querySelectorAll("button")].slice(0, 12).map((b) => (b.innerText || "").slice(0, 60)),
      qTitle: document.querySelector('[data-testid="quiz-question"]')?.textContent?.slice(0, 120) || null,
      testids: [...document.querySelectorAll("[data-testid]")].map((e) => e.getAttribute("data-testid")),
      bodyStart: (document.body.innerText || "").slice(0, 500),
    };
    return o;
  });
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: "diag-v4.png" }).catch(() => {});
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(2); });
