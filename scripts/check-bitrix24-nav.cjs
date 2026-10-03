// Navbar'dagi "Bitrix24": /guides ga olib boradi va maqolani shu sahifada ochadi.
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

  // 1) navbar'da Bitrix24 bormi va /guides ga boradimi
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  const bit = await page.evaluate(() => {
    const nav = document.querySelector("header nav");
    const a = nav && Array.from(nav.querySelectorAll("a")).find((x) => (x.textContent || "").trim() === "Bitrix24");
    return a ? { href: a.getAttribute("href"), target: a.getAttribute("target") } : null;
  });

  // 2) bosilganda /guides ga o'tadi (tab yopilmaydi)
  const tabsBefore = ctx.pages().length;
  await page.locator('header nav a:has-text("Bitrix24")').first().click();
  await page.waitForTimeout(2500);
  const urlAfter = page.url();
  const tabsAfter = ctx.pages().length;

  // 3) /guides da maqola shu sahifada oynanda ochiladi
  const external = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href*="bitrix24.ru"]')).length
  );
  await page.locator('[data-testid="guides-article-link"]').first().click();
  await page.waitForTimeout(1200);
  const dlg = await page.locator('[role="dialog"]').count();
  const steps = dlg ? await page.locator('[role="dialog"] ol li').count() : 0;
  const title = dlg ? (await page.locator('[role="dialog"] h2').first().innerText()) : null;
  await page.screenshot({ path: "guides-bitrix24.png" });
  if (dlg) { await page.keyboard.press("Escape"); await page.waitForTimeout(400); }

  // 4) navbar kengligi — yangi element qo'shildi, overlap bormi
  console.log("navbar Bitrix24:", bit ? `${bit.href} (target=${bit.target})` : "YO'Q");
  console.log("bosilganda URL:", urlAfter, tabsBefore === tabsAfter ? "(tab yopilmadi)" : "(YANGI TAB!)");
  console.log("/guides da tashqi bitrix link:", external === 0 ? "YO'Q (to'g'ri)" : `${external} ta`);
  console.log("maqola modalda ochildi:", dlg > 0 ? "HA" : "YO'Q");
  console.log("modal sarlavhasi:", title);
  console.log("modal qadamlar:", steps);

  await browser.close();
})();
