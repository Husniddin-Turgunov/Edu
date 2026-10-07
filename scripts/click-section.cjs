// Playwright (haqiqiy Chromium): Bitrix bo'limiga bosish va URL ni olish.
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto("https://helpdesk.bitrix24.ru/", { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2500);

  // Bo'lim elementlarini ko'rib chiqamiz
  const boxes = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.bx-helpdesk-section-item[data-id]')];
    const map = new Map();
    for (const it of items) {
      const id = it.getAttribute("data-id");
      if (map.has(id)) continue;
      const r = it.getBoundingClientRect();
      map.set(id, {
        id,
        name: (it.querySelector(".bx-helpdesk-section-item-name")?.textContent || "").trim(),
        x: Math.round(r.x), y: Math.round(r.y),
        w: Math.round(r.width), h: Math.round(r.height),
      });
    }
    return [...map.values()].filter((s) => s.w > 0 && s.h > 0).slice(0, 10);
  });
  console.log("=== ko'rinadigan bo'lim elementlari ===");
  boxes.forEach((b) => console.log(`  id=${b.id} "${b.name}" @ ${b.x},${b.y} ${b.w}x${b.h}`));

  const target = boxes.find((b) => b.name === "Задачи") || boxes[0];
  if (!target) { console.log("ko'rinadigan element yo'q"); await browser.close(); return; }

  // Real bosish (sichqoncha bilan)
  await page.mouse.click(target.x + target.w / 2, target.y + target.h / 2);
  await page.waitForTimeout(4000);
  console.log("\nbosilgandan keyingi URL:", page.url());
  console.log("sarlavha:", await page.title());

  const res = await page.evaluate(() => ({
    h1: [...document.querySelectorAll("h1,h2,h3")].map((x) => (x.textContent || "").replace(/\s+/g, " ").trim()).slice(0, 8),
    openLinks: [...new Set([...document.querySelectorAll('a[href*="/open/"]')].map((a) => a.getAttribute("href")))].slice(0, 15),
    bodyStart: document.body.innerText.slice(0, 600),
  }));
  console.log("\nsarlavhalar:", res.h1.join(" | "));
  console.log("/open/ linklari:", res.openLinks.length, res.openLinks.slice(0, 6));
  console.log("\n--- matn ---\n" + res.bodyStart);

  await page.screenshot({ path: "bitrix-section-clicked.png" });
  console.log("\nskrinshot: bitrix-section-clicked.png");
  await browser.close();
})();
