/* Live (production) UI tekshiruv — edu.akelagroup.uz.
   Tekshiradi:
     1) Admin akkaunt bilan kirish ishlaydi (login → dashboard)
     2) Asosiy sahifalar 200 va kontent bilan ochiladi
     3) Shrift ↔ border mosligi: borderli konteynerlardan chiqib ketgan matnlar
     4) Konsol xatolari
   Ishga tushirish: node e2e-live-ui.js [baseUrl] [label]              */
const { chromium } = require("playwright");

const BASE = process.argv[2] || process.env.BASE_URL || "https://edu.akelagroup.uz";
const LABEL = process.argv[3] || "live";
const EMAIL = process.env.ADMIN_EMAIL || "SvRvS@gmail.com";
const PASS = process.env.ADMIN_PASS || "Saidakabar3003";

const AUDIT = () => {
  const items = [];
  const seen = new Set();
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) === 0) continue;
    const vOver = el.scrollHeight - el.clientHeight;
    const hOver = el.scrollWidth - el.clientWidth;
    const area = r.width * r.height;
    if (area > 250000) continue; // katta bo'limlar — chetlab o'tamiz
    const text = (el.textContent || "").trim().replace(/\s+/g, " ");
    if (!text) continue;
    const hasOwnText = Array.from(el.childNodes).some(
      (n) => n.nodeType === 3 && (n.textContent || "").trim().length > 1
    );
    if (!hasOwnText) continue;
    if (vOver > 1 || hOver > 1) {
      const key = `${el.tagName}-${Math.round(r.width)}x${Math.round(r.height)}-${text.slice(0, 30)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        text: text.slice(0, 60),
        cls: (el.className || "").toString().slice(0, 110),
        vOver,
        hOver,
        box: `${Math.round(r.width)}x${Math.round(r.height)}`,
        overflow: `${cs.overflowX}/${cs.overflowY}`,
        fontSize: cs.fontSize,
        lineHeight: cs.lineHeight,
      });
    }
  }
  items.sort((a, b) => b.vOver + b.hOver - (a.vOver + a.hOver));
  return { total: items.length, items: items.slice(0, 20) };
};

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) => consoleErrors.push("PAGEERROR: " + String(e).slice(0, 200)));

  const report = { base: BASE, checks: {}, pages: {}, errors: consoleErrors };

  // 1) Login
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
  report.checks.login = !!session?.user?.email;
  report.user = session?.user?.email || null;
  report.role = session?.user?.role || null;
  await page.screenshot({ path: `live-${LABEL}-login.png`, fullPage: false });

  // Test id (test sahifasini ham tekshiramiz)
  let testId = null;
  try {
    const list = await page.evaluate(() =>
      fetch("/api/tests", { cache: "no-store" }).then((r) => r.json()).catch(() => null)
    );
    testId = (list?.tests || [])[0]?.id || null;
  } catch {}

  const PAGES = [
    { path: "/", name: "home" },
    { path: "/dashboard", name: "dashboard" },
    { path: "/courses", name: "courses" },
    { path: "/admin", name: "admin" },
    { path: "/admin/students", name: "admin-students" },
    { path: "/admin/lms/tests", name: "admin-tests" },
    { path: "/admin/jobs", name: "admin-jobs" },
    { path: "/guides", name: "guides" },
  ];
  if (testId) PAGES.push({ path: `/tests/${testId}`, name: "test-detail" });

  for (const p of PAGES) {
    const info = { status: null, overflow: 0, items: [], text: 0 };
    try {
      const res = await page.goto(BASE + p.path, { waitUntil: "networkidle", timeout: 60000 });
      info.status = res ? res.status() : null;
    } catch (e) {
      info.error = String(e).slice(0, 160);
    }
    await page.waitForTimeout(1200);
    await page.evaluate(async () => {
      const step = window.innerHeight;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((res) => setTimeout(res, 100));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(400);
    const audit = await page.evaluate(AUDIT);
    info.overflow = audit.total;
    info.items = audit.items;
    info.text = (await page.evaluate(() => (document.body.innerText || "").length)) || 0;
    report.pages[p.name] = info;
    await page.screenshot({ path: `live-${LABEL}-${p.name}.png`, fullPage: true });
  }

  const totalOverflow = Object.values(report.pages).reduce((a, b) => a + b.overflow, 0);
  const badStatus = Object.entries(report.pages)
    .filter(([, v]) => v.status && v.status >= 400)
    .map(([k]) => k);
  report.checks.pages_ok = badStatus.length === 0;
  report.checks.no_overflow = totalOverflow === 0;
  report.checks.no_console_errors = consoleErrors.length === 0;
  report.totalOverflow = totalOverflow;
  report.badStatus = badStatus;

  require("fs").writeFileSync(`live-${LABEL}-report.json`, JSON.stringify(report, null, 2), "utf8");

  console.log(`BASE: ${BASE}`);
  console.log(`LOGIN: ${report.checks.login} (${report.user || "-"} / ${report.role || "-"})`);
  console.log(`PAGES: ${Object.entries(report.pages).map(([k, v]) => `${k}=${v.status}`).join(" ")}`);
  console.log(`OVERFLOW TOTAL: ${totalOverflow}`);
  for (const [name, v] of Object.entries(report.pages)) {
    if (!v.overflow) continue;
    console.log(`--- ${name}: ${v.overflow}`);
    for (const it of v.items) {
      console.log(`  v+${it.vOver} h+${it.hOver} ${it.box} fs=${it.fontSize} lh=${it.lineHeight} :: ${it.text.slice(0, 45)}`);
    }
  }
  if (consoleErrors.length) {
    console.log("CONSOLE ERRORS:");
    for (const e of consoleErrors.slice(0, 10)) console.log("  " + e);
  }
  const failed = Object.entries(report.checks).filter(([, v]) => v === false).map(([k]) => k);
  console.log(failed.length === 0 ? "ALL CHECKS PASS" : "FAILED: " + failed.join(", "));

  await browser.close();
  process.exit(0);
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(2);
});