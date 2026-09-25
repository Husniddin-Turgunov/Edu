/* PRODUCTION UI REPRO: haqiqiy login → /admin/lms/tests → yaratish/o'chirish
 * sahifa yangilanmasdan aks ettiriladimi? (foydalanuvchi shikoyatini aynan shu)
 * Ishlatish: node check-prod-ui.mjs
 */
import { chromium } from "playwright";

const BASE = "https://edu.akelagroup.uz";
const EMAIL = "admin@akelagroup.com";
const PASS = "AGM_9561";
const TMP_TITLE = "ZZ-ui-test (avto-o'chiriladi)";

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());

  const netlog = [];
  page.on("response", (r) => {
    if (r.url().includes("/api/admin/tests")) {
      netlog.push({ m: r.request().method(), st: r.status(), xc: r.headers()["x-vercel-cache"] || "-", cc: (r.headers()["cache-control"] || "-").slice(0, 40) });
    }
  });

  const results = {};
  const cards = () => page.getByTestId("admin-test-card").count();

  // 1) LOGIN
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator('input[type="email"], input[name="email"], input[placeholder*="@"], input[autocomplete="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASS);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3000);
  console.log("1) login dan keyin URL:", page.url());
  if (page.url().includes("/login")) {
    console.log("LOGIN MUVOFFAQIYATSIZ");
    await page.screenshot({ path: "prod-ui-login.png" });
    await browser.close();
    process.exit(2);
  }

  // 2) Testlar sahifasi
  await page.goto(`${BASE}/admin/lms/tests`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByTestId("admin-test-card").first().waitFor({ state: "visible", timeout: 60000 });
  // Oldingi qoldiqlarni tozalash (agar mavjud bo'lsa)
  const leftover = page.locator('[data-testid="admin-test-card"]').filter({ hasText: TMP_TITLE });
  while ((await leftover.count()) > 0) {
    await leftover.first().getByRole("button").last().click();
    await page.waitForTimeout(2500);
  }
  const before = await cards();
  console.log("2) sahifa ochildi, kartalar:", before);

  // 3) YARATISH (F5'siz ko'rinishi kerak)
  await page.getByRole("button", { name: /Test yaratish/ }).first().click();
  await page.getByPlaceholder(/Masalan:/).fill(TMP_TITLE);
  await page.locator("button", { hasText: "Test yaratish" }).last().click();
  await page.waitForTimeout(4000);
  results.createWithoutReload = (await page.getByText(TMP_TITLE).count()) > 0;
  console.log(`3) yaratish (F5'siz): ${before} -> ${await cards()} kartalar, yangi ko'rindi: ${results.createWithoutReload}`);
  if (!results.createWithoutReload) await page.screenshot({ path: "prod-ui-create.png" });

  // Savol modali avto ochiladi → yopamiz
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);

  // 4) O'CHIRISH (F5'siz yo'qolishi kerak) — FOYDALANUVCHI SHIKOYATI SHU
  const tmpCard = page.locator('[data-testid="admin-test-card"]').filter({ hasText: TMP_TITLE }).first();
  if ((await tmpCard.count()) > 0) {
    await tmpCard.getByRole("button").last().click();
    await page.waitForTimeout(4000);
    const stillThere = (await page.getByText(TMP_TITLE).count()) > 0;
    results.deleteWithoutReload = !stillThere;
    console.log(`4) o'chirish (F5'siz): karta hali ko'rinadimi: ${stillThere} — ${stillThere ? "MUAMMO ❌" : "OK ✅"}`);
    if (stillThere) {
      await page.screenshot({ path: "prod-ui-delete.png" });
      // F5 dan keyin ham tekshiramiz — delete serverda o'tdimi?
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);
      const afterReload = (await page.getByText(TMP_TITLE).count()) > 0;
      console.log(`   F5 dan keyin ham ko'rinadimi: ${afterReload} (false bo'lsa delete o'tgan, faqat UI yangilanmagan)`);
      results.deleteWorkedOnServer = !afterReload;
      // F5 paytida ham qoldiq bo'lsa — o'chiramiz
      if (afterReload) {
        const c2 = page.locator('[data-testid="admin-test-card"]').filter({ hasText: TMP_TITLE }).first();
        await c2.getByRole("button").last().click();
        await page.waitForTimeout(3000);
      }
    }
  } else {
    results.deleteWithoutReload = "skipped (karta topilmadi)";
    console.log("4) SKIP");
  }

  console.log("\nNetwork /api/admin/tests:");
  netlog.forEach((n, i) => console.log(`  ${i + 1}) ${n.m} -> ${n.st} | xc: ${n.xc} | cc: ${n.cc}`));

  // DB tozalash
  const { PrismaClient } = await import("@prisma/client");
  const p = new PrismaClient();
  const left = await p.test.count({ where: { title: TMP_TITLE } });
  await p.test.deleteMany({ where: { title: TMP_TITLE } });
  await p.$disconnect();
  console.log("DB qoldi:", left);

  console.log("\nNATIJA:", JSON.stringify(results, null, 2));
  await browser.close();
})().catch((e) => {
  console.error("XATO:", e.message);
  process.exit(1);
});
