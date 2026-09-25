/* Diag v2: login holati + test sahifasi holati batafsil */
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
  await page.waitForTimeout(1500);
  const inputs = await page.locator("input").count();
  const btns = await page.getByRole("button").allTextContents().catch(() => []);
  console.log(JSON.stringify({ inputs, btns }));
  const em = page.locator('input[type="email"]').first();
  if (await em.count()) await em.fill(EMAIL); else await page.locator("input").first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASS);
  await page.getByRole("button", { name: /Kirish/i }).first().click();
  await page.waitForTimeout(7000);
  console.log("after-login-url:", page.url());
  const session = await page.evaluate(() =>
    fetch("/api/auth/session", { cache: "no-store" }).then((r) => r.json()).catch(() => null)
  );
  console.log("session:", JSON.stringify(session?.user || session));
  const cookies = await ctx.cookies();
  console.log("cookies:", cookies.map((c) => c.name).join(","));
  await page.goto(`${BASE}/tests/${TEST_ID}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(6000);
  console.log("test-page-url:", page.url());
  const state = await page.evaluate(async (id) => {
    const out = {};
    out.topbar = !!document.querySelector('[data-testid="quiz-topbar"]');
    out.blocked = (document.body.innerText || "").includes("bloklangan");
    out.bodyText = (document.body.innerText || "").slice(0, 400);
    try {
      const r = await fetch(`/api/tests/${id}`, { cache: "no-store" });
      const j = await r.json().catch(() => null);
      out.apiStatus = r.status; out.apiOk = j?.ok; out.apiError = j?.error || null;
      out.qCount = j?.test?.questions?.length ?? null;
    } catch (e) { out.apiFetchFail = String(e); }
    return out;
  }, TEST_ID);
  console.log(JSON.stringify(state, null, 2));
  await page.screenshot({ path: "diag-v2.png" }).catch(() => {});
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(2); });
