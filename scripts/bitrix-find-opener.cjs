// KB header'idagi bo'lim ro'yxatini ochuvchi tugmani topadi.
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto("https://helpdesk.bitrix24.ru/open/23240682/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);

  // KB ichidagi (bx-helpdesk) barcha kichik bosiladigan elementlar
  const cands = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('[class*="bx-helpdesk"]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return;
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      const cls = (el.className || "").toString();
      if (t.length > 45) return;
      if (!/button|btn|icon|toggle|burger|catalog|menu|nav|list|search|js-/i.test(cls)) return;
      out.push({ tag: el.tagName, cls: cls.slice(0, 80), text: t.slice(0, 40), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
    });
    // noyob o'rniga noyobga yaqin bo'lim paneli
    return out.slice(0, 30);
  });
  console.log("=== KB boshqaruv elementlari ===");
  cands.forEach((c) => console.log(`  <${c.tag}> ${c.cls} | "${c.text}" @${c.x},${c.y} ${c.w}x${c.h}`));

  // sidebar panelning CSS ni tekshiramiz
  const panel = await page.evaluate(() => {
    const p = document.querySelector(".bx-helpdesk-section-list-cnr");
    if (!p) return null;
    const cs = getComputedStyle(p);
    return { display: cs.display, visibility: cs.visibility, width: p.getBoundingClientRect().width, parentCls: (p.parentElement?.className || "").toString().slice(0, 80) };
  });
  console.log("\n=== bo'lim paneli ===", JSON.stringify(panel));

  await page.screenshot({ path: "bitrix-article-view.png" });
  await browser.close();
})();
