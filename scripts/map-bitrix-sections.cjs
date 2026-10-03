// Barcha bo'limlar (nom + data-id) va bo'lim sahifasining URL formatini aniqlaydi.
const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto("https://helpdesk.bitrix24.ru/", { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2000);

  const sections = await page.evaluate(() => {
    const txt = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();
    return [...document.querySelectorAll(".bx-helpdesk-section-item[data-id]")].map((el) => ({
      id: el.getAttribute("data-id"),
      name: txt(el.querySelector(".bx-helpdesk-section-item-name")) || txt(el).slice(0, 40),
      full: txt(el).slice(0, 120),
      countText: (txt(el).match(/(\d+)\s*(?:стат|макал)/i) || [])[0] || null,
    }));
  });
  console.log("=== bo'limlar:", sections.length);
  sections.forEach((s) => console.log(`  id=${s.id}  ${s.name}  ${s.countText || ""}`));
  fs.writeFileSync("bitrix-sections.json", JSON.stringify(sections, null, 2), "utf8");

  // URL formatini tekshirish: bo'limni bosamiz
  const first = sections[0];
  if (first) {
    console.log("\n=== bosilmoqda:", first.name, "id=", first.id);
    await page.click(`.bx-helpdesk-section-item[data-id="${first.id}"] .js-section-item-title-1`, { timeout: 15000 }).catch((e) => console.log("click xato:", e.message.slice(0, 80)));
    await page.waitForTimeout(3000);
    console.log("URL ga o'tdi:", page.url());
  }

  // Mumkin bo'lgan URL shablonlarni sinab ko'ramiz
  for (const tpl of [`/section/${first.id}/`, `/sections/${first.id}/`, `/open/${first.id}/`]) {
    const url = "https://helpdesk.bitrix24.ru" + tpl;
    try {
      const r = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      const n = await page.evaluate(() => document.querySelectorAll('a[href*="/open/"]').length);
      console.log(`  ${tpl} -> HTTP ${r.status()} | /open/ linklari: ${n}`);
    } catch (e) {
      console.log(`  ${tpl} -> xato`);
    }
  }

  await browser.close();
})();
