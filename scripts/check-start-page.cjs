// /start sahifasi: (1) so'rovnoma yo q, (2) "Ochish" boshqa saytga OTMAMAYDI —
// shu sahifada modal ochiladi, (3) navbar'da "Boshlash" yo q.
const { chromium } = require("playwright");
const BASE = (process.argv[2] || "http://localhost:3111").replace(/\/$/, "");

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1588, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 60000 });
  await page.locator('input[type="email"]').first().fill("admin@akelagroup.com");
  await page.locator('input[type="password"]').first().fill("AGM_9561");
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(4000);

  await page.goto(BASE + "/start", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);

  // 1) so'rovnoma (1-qadam forma) yo'qmi
  const hasForm = await page.locator('form[data-testid="start-data-form"]').count();
  const hasStep1 = await page.locator('[data-testid="start-step-data"]').count();

  // 2) navbar'da Boshlash bormi
  const navHasBoshlash = await page.evaluate(() => {
    const nav = document.querySelector("header nav");
    if (!nav) return null;
    return Array.from(nav.querySelectorAll("a,button")).some((e) => (e.textContent || "").trim() === "Boshlash");
  });

  // 3) tashqi Bitrix link bormi
  const externalLinks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href*="bitrix24"]')).map((a) => a.getAttribute("href"))
  );

  // 4) "Ochish" bosilganda — shu sahifada modal ochilishi
  const beforeUrl = page.url();
  await page.locator('button:has-text("Ochish")').first().click();
  await page.waitForTimeout(1200);
  const dialog = await page.locator('[role="dialog"]').count();
  const dialogText = dialog ? (await page.locator('[role="dialog"]').first().innerText()).slice(0, 90) : null;
  const afterUrl = page.url();
  const hasSteps = dialog ? await page.locator('[role="dialog"] ol li').count() : 0;

  await page.screenshot({ path: "start-modal.png" });
  // modalni yopamiz
  if (dialog) { await page.keyboard.press("Escape"); await page.waitForTimeout(500); }
  const dialogClosed = (await page.locator('[role="dialog"]').count()) === 0;

  console.log("1-qadam so'rovnoma (form):", hasForm === 0 ? "YO'Q (to'g'ri)" : "BOR (xato)");
  console.log("1-qadam section:", hasStep1 === 0 ? "YO'Q (to'g'ri)" : "BOR (xato)");
  console.log("navbar'da Boshlash:", navHasBoshlash === false ? "YO'Q (to'g'ri)" : "BOR (xato)");
  console.log("tashqi bitrix linklar:", externalLinks.length === 0 ? "YO'Q (to'g'ri)" : JSON.stringify(externalLinks.slice(0, 3)));
  console.log("Ochish -> modal ochildi:", dialog > 0 ? "HA" : "YO'Q (xato)");
  console.log("URL o'zgarmadi:", beforeUrl === afterUrl ? "HA (boshqa saytga otmadi)" : `O'ZGARDI ${afterUrl}`);
  console.log("modal ichidagi qadamlar:", hasSteps);
  console.log("modal matni:", (dialogText || "").replace(/\n/g, " | "));
  console.log("Escape bilan yopildi:", dialogClosed ? "HA" : "YO'Q");

  await browser.close();
})();
