/* Tez diagnostika: test sahifasi holati — bloklanganmi, savol keldimi? */
const { chromium } = require("playwright");
const BASE = process.argv[2] || "https://edu.akelagroup.uz";
const TEST_ID = process.argv[3] || "cmudoc4hm0000jt04jdroy06m";
const EMAIL = process.env.ADMIN_EMAIL || "SvRvS@gmail.com";
const PASS = process.env.ADMIN_PASS || "Saidakabar3003";
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const em = page.locator('input[type="email"]').first();
  if (await em.count()) await em.fill(EMAIL); else await page.locator("input").first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASS);
  await page.getByRole("button", { name: /Kirish/i }).first().click();
  await page.waitForTimeout(5000);
  await page.goto(`${BASE}/tests/${TEST_ID}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(5000);
  const state = await page.evaluate(async (id) => {
    const out = {};
    out.url = location.href;
    out.topbar = !!document.querySelector('[data-testid="quiz-topbar"]');
    out.finishTop = !!document.querySelector('[data-testid="finish-btn-top"]');
    out.bodyText = (document.body.innerText || "").slice(0, 600);
    try {
      const r = await fetch(`/api/tests/${id}`, { cache: "no-store" });
      const j = await r.json().catch(() => null);
      out.apiStatus = r.status;
      out.apiOk = j?.ok;
      out.apiError = j?.error || null;
      out.qCount = j?.test?.questions?.length ?? null;
      out.title = j?.test?.title || null;
    } catch (e) { out.apiFetchFail = String(e); }
    return out;
  }, TEST_ID);
  console.log(JSON.stringify(state, null, 2));
  await page.screenshot({ path: "diag-test-state.png" }).catch(() => {});
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(2); });
