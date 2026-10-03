// Bo'lim sahifasining URL formatini va maqola ro'yxatining DOM tuzilmasini aniqlaydi.
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto("https://helpdesk.bitrix24.ru/", { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2000);

  const ID = "90967"; // Задачи

  // 1) Bosish orqali URL
  try {
    await page.click(`.bx-helpdesk-section-item[data-id="${ID}"] .js-section-item-title-1`, { timeout: 12000 });
    await page.waitForTimeout(3500);
    console.log("bosilgandan keyingi URL:", page.url());
  } catch (e) {
    console.log("click muvaffaqiyatsiz:", e.message.slice(0, 90));
  }

  // 2) URL shablonlarini sinab ko'ramiz
  for (const tpl of [`/section/${ID}/`, `/sections/${ID}/`, `/open/${ID}/`]) {
    try {
      const r = await page.goto("https://helpdesk.bitrix24.ru" + tpl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1500);
      const info = await page.evaluate(() => ({
        opens: document.querySelectorAll('a[href*="/open/"]').length,
        items: document.querySelectorAll(".bx-helpdesk-section-item[data-id]").length,
        h: [...document.querySelectorAll("h1,h2")].map((x) => (x.textContent || "").trim()).slice(0, 4),
      }));
      console.log(`  ${tpl} -> HTTP ${r.status()} | /open/: ${info.opens} | bo'limli element: ${info.items} | ${info.h.join(" / ")}`);
    } catch (e) {
      console.log(`  ${tpl} -> xato: ${e.message.slice(0, 60)}`);
    }
  }

  await browser.close();
})();
