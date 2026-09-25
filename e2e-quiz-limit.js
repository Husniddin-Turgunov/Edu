/* Live (production) tekshiruv — savollar soni cheklovi + random tanlov.
   Tekshiradi:
     1) /api/tests — ko'rsatiladigan savol soni = cheklov (questionCount)
     2) /api/tests/[id] — faqat cheklangan sonda savol qaytaradi
     3) Random yoqilgan bo'lsa — har chaqiruvda bazadan TASODIFIY to'plam olinadi
   Ishga tushirish: node e2e-quiz-limit.js [baseUrl]                        */
const { chromium } = require("playwright");

const BASE = process.argv[2] || process.env.BASE_URL || "https://edu.akelagroup.uz";
const EMAIL = process.env.ADMIN_EMAIL || "SvRvS@gmail.com";
const PASS = process.env.ADMIN_PASS || "Saidakabar3003";

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const report = { base: BASE, checks: {}, list: [] };

  // 1) Kirish
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const emailInput = page.locator('input[type="email"]').first();
  if (await emailInput.count()) await emailInput.fill(EMAIL);
  else await page.locator("input").first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASS);
  await page.getByRole("button", { name: /Kirish/i }).first().click();
  await page.waitForTimeout(6000);

  const session = await page.evaluate(() =>
    fetch("/api/auth/session", { cache: "no-store" }).then((r) => r.json()).catch(() => null)
  );
  report.loggedIn = !!session?.user?.email;
  report.user = session?.user?.email || null;

  // 2) Testlar ro'yxati — ko'rsatiladigan savol soni
  const list = await page.evaluate(() =>
    fetch("/api/tests", { cache: "no-store" }).then((r) => r.json()).catch(() => null)
  );
  const tests = (list && list.tests) || [];
  report.totalTests = tests.length;
  report.list = tests.map((t) => ({
    id: t.id,
    title: t.title,
    shown: t.questionCount,
    bank: t.totalQuestions,
    limited: !!t.limited,
  }));
  // Cheklangan testlar — map qilingan obyektlar ustida ishlaymiz (shown/bank bor)
  const limitedTests = report.list.filter((t) => t.limited);
  report.checks.list_shows_limit = limitedTests.length > 0
    && limitedTests.every((t) => t.shown === Math.min(t.bank, t.shown));
  report.checks.limit_less_than_bank = limitedTests.length > 0
    && limitedTests.every((t) => t.shown < t.bank);

  // 3) Bitta cheklangan testni chuqur tekshirish
  const target = limitedTests.slice().sort((a, b) => (b.bank - b.shown) - (a.bank - a.shown))[0];
  if (target) {
    const fetchDetail = () =>
      page.evaluate(async (id) => {
        const r = await fetch(`/api/tests/${id}`, { cache: "no-store" });
        return { status: r.status, body: await r.json().catch(() => null) };
      }, target.id);

    const a = await fetchDetail();
    await page.waitForTimeout(500);
    const b = await fetchDetail();

    const qa = a.body?.test?.questions || [];
    const qb = b.body?.test?.questions || [];
    const idsA = qa.map((q) => q.id);
    const idsB = qb.map((q) => q.id);

    report.target = { id: target.id, title: target.title, shown: target.shown, bank: target.bank };
    report.detail = {
      statusA: a.status,
      statusB: b.status,
      countA: idsA.length,
      countB: idsB.length,
      errorA: a.body?.error || null,
      returnedBankSize: a.body?.test?.totalQuestions ?? null,
    };
    report.checks.detail_only_limited = idsA.length === target.shown && idsB.length === target.shown;
    report.checks.detail_reports_bank = (a.body?.test?.totalQuestions ?? 0) === target.bank;
    // Random: ikki chaqiruvdagi to'plam bir xil bo'lmasligi kerak (58 dan 30 tanlanadi)
    const sameSet = idsA.length > 0 && idsA.length === idsB.length && idsA.every((x) => idsB.includes(x));
    report.checks.random_set_differs = !sameSet;
    report.sampleIdsA = idsA.slice(0, 5);
    report.sampleIdsB = idsB.slice(0, 5);
  } else {
    report.checks.detail_only_limited = null;
    report.checks.detail_reports_bank = null;
    report.checks.random_set_differs = null;
  }

  console.log(JSON.stringify(report, null, 2));
  require("fs").writeFileSync("quiz-limit-report.json", JSON.stringify(report, null, 2), "utf8");
  const failed = Object.entries(report.checks).filter(([, v]) => v === false);
  console.log(failed.length === 0 ? "ALL CHECKS PASS" : "FAILED: " + failed.map(([k]) => k).join(", "));
  await browser.close();
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(2);
});
