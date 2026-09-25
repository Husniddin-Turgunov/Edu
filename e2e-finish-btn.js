/* Playwright-only: finish-btn-top — 30 javobdan keyin 1-savolda ham ko'rinishi kerak.
   Submit QILINMAYDI: modal ochilib "Bekor qilish" bosiladi. */
const { chromium } = require("playwright");
const BASE = process.argv[2] || "https://edu.akelagroup.uz";
const TEST_ID = process.argv[3] || "cmudoc4hm0000jt04jdroy06m";
const EMAIL = process.env.ADMIN_EMAIL || "SvRvS@gmail.com";
const PASS = process.env.ADMIN_PASS || "Saidakabar3003";
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const report = { base: BASE, testId: TEST_ID, checks: {}, steps: [] };
  const step = (m) => { report.steps.push(m); console.log(m); };
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const em = page.locator('input[type="email"]').first();
  if (await em.count()) await em.fill(EMAIL); else await page.locator("input").first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASS);
  await page.getByRole("button", { name: /Kirish/i }).first().click();
  await page.waitForTimeout(5000);
  await page.goto(`${BASE}/tests/${TEST_ID}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByTestId("quiz-topbar").waitFor({ timeout: 60000 });
  step("quiz-topbar ready");
  for (let i = 0; i < 30; i++) {
    const opts = page.getByTestId("quiz-options").getByRole("button");
    await opts.first().waitFor({ timeout: 20000 });
    await opts.first().click();
    await page.waitForTimeout(350);
    if (i < 29) { await page.getByTestId("next-btn").click(); await page.waitForTimeout(350); }
    if ((i + 1) % 10 === 0) step(`answered ~${i + 1}`);
  }
  const answeredTxt = await page.getByTestId("answered-count").textContent().catch(() => "?");
  report.answeredCount = (answeredTxt || "").trim();
  step(`answered-count: ${report.answeredCount}`);
  await page.getByTestId("finish-btn-top").waitFor({ timeout: 10000 }).catch(() => {});
  report.checks.finish_visible_on_last = await page.getByTestId("finish-btn-top").isVisible().catch(() => false);
  step(`finish-btn-top on LAST q: ${report.checks.finish_visible_on_last}`);
  const dots = page.getByTestId("step-dots").getByRole("button");
  if (await dots.count()) await dots.first().click();
  await page.waitForTimeout(800);
  report.checks.finish_visible_on_first_after_all = await page.getByTestId("finish-btn-top").isVisible().catch(() => false);
  step(`finish-btn-top on FIRST q after all answered: ${report.checks.finish_visible_on_first_after_all}`);
  await page.screenshot({ path: "finish-btn-first-q.png" }).catch(() => {});
  if (report.checks.finish_visible_on_first_after_all) {
    await page.getByTestId("finish-btn-top").click();
    await page.waitForTimeout(800);
    report.checks.confirm_opens = await page.getByTestId("submit-confirm").isVisible().catch(() => false);
    step(`submit-confirm opens: ${report.checks.confirm_opens}`);
    await page.screenshot({ path: "finish-btn-confirm.png" }).catch(() => {});
    const cancel = page.getByTestId("submit-confirm").getByRole("button", { name: /Bekor/i });
    if (await cancel.count()) await cancel.first().click();
    await page.waitForTimeout(500);
    report.checks.still_on_quiz_after_cancel = await page.getByTestId("quiz-topbar").isVisible().catch(() => false);
    step(`still on quiz after cancel: ${report.checks.still_on_quiz_after_cancel}`);
  }
  console.log(JSON.stringify(report, null, 2));
  require("fs").writeFileSync("finish-btn-report.json", JSON.stringify(report, null, 2), "utf8");
  const failed = Object.entries(report.checks).filter(([, v]) => v === false);
  console.log(failed.length === 0 ? "ALL CHECKS PASS" : "FAILED: " + failed.map(([k]) => k).join(", "));
  await browser.close();
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((e) => { console.error("FATAL", e); process.exit(2); });
