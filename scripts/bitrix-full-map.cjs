// Bitrix24 KB to'liq xaritasi: 43 ta bo'lim -> maqolalar (tartibi bilan).
const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  await page.goto("https://helpdesk.bitrix24.ru/open/23240682/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);

  // Har bir bo'limni bosib, ichidagi maqolalarni olamiz
  const map = [];
  const sections = await page.evaluate(() =>
    [...new Map([...document.querySelectorAll('.bx-helpdesk-section-item[data-id]')].map((el) => [el.getAttribute("data-id"), el])).values()]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { id: el.getAttribute("data-id"), name: (el.querySelector(".bx-helpdesk-section-item-name")?.textContent || "").trim(), y: r.y + window.scrollY };
      })
      .filter((s) => s.name)
  );
  console.log("bo'limlar:", sections.length);

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    try {
      // bo'limni bosamiz (yopiq/ochiq)
      const sel = `.bx-helpdesk-section-item[data-id="${s.id}"] .js-section-item-title-1`;
      await page.locator(sel).first().click({ timeout: 8000, force: true });
      await page.waitForTimeout(700);
      // ichidagi maqolalar
      const arts = await page.evaluate((id) => {
        const item = document.querySelector(`.bx-helpdesk-section-item[data-id="${id}"]`);
        if (!item) return [];
        // maqolalar bo'lim elementining KEYINGI akasida (.bx-helpdesk-section-child)
        const sib = item.nextElementSibling;
        const box =
          (sib && sib.classList.contains("bx-helpdesk-section-child") ? sib : null) ||
          item.querySelector(".bx-helpdesk-section-child") ||
          (item.parentElement ? item.parentElement.querySelector(".bx-helpdesk-section-child") : null);
        if (!box) return [];
        return [...box.querySelectorAll("a.bx-helpdesk-section-child-article-link")].map((a) => ({
          title: (a.textContent || "").replace(/\s+/g, " ").trim(),
          href: a.getAttribute("href"),
        })).filter((a) => a.title && a.href);
      }, s.id);
      map.push({ id: s.id, name: s.name, articles: arts });
      process.stdout.write(`\r[${i + 1}/${sections.length}] ${s.name}: ${arts.length} maqola          `);
    } catch (e) {
      map.push({ id: s.id, name: s.name, articles: [], error: e.message.slice(0, 60) });
    }
  }

  fs.writeFileSync("bitrix-map.json", JSON.stringify(map, null, 2), "utf8");
  const total = map.reduce((a, s) => a + s.articles.length, 0);
  console.log("\n\n=== YAKUN ===");
  console.log("bo'limlar:", map.length, "| jami maqolalar:", total);
  map.forEach((s) => console.log(`  ${String(s.articles.length).padStart(3)} ta  ${s.name}`));
  await browser.close();
})();
