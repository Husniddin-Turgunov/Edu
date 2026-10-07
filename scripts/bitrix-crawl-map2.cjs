// 0 qolgan bo'limlarni ham to'ldirish: har bir bo'limni 2 marta bosib,
// keyingi akasidagi va ichidagi hamma maqolalarni yig'adi.
const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  await page.goto("https://helpdesk.bitrix24.ru/open/23240682/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000);

  const map = [];
  const sections = await page.evaluate(() => {
    const out = [], seen = new Set();
    document.querySelectorAll(".bx-helpdesk-section-item[data-id]").forEach((el) => {
      const id = el.getAttribute("data-id");
      if (seen.has(id)) return;
      seen.add(id);
      const name = (el.querySelector(".bx-helpdesk-section-item-name")?.textContent || "").trim();
      if (name) out.push({ id, name });
    });
    return out;
  });
  const uniq = [...new Map(sections.map((s) => [s.id, s])).values()];
  console.log("bo'limlar:", uniq.length);

  const collect = (id) =>
    page.evaluate((sid) => {
      const items = [...document.querySelectorAll(`.bx-helpdesk-section-item[data-id="${sid}"]`)];
      const seen = new Set();
      const out = [];
      for (const item of items) {
        const cand = [item.querySelector(".bx-helpdesk-section-child")];
        const sib = item.nextElementSibling;
        if (sib && sib.classList.contains("bx-helpdesk-section-child")) cand.push(sib);
        for (const box of cand) {
          if (!box) continue;
          box.querySelectorAll("a.bx-helpdesk-section-child-article-link").forEach((a) => {
            const t = (a.textContent || "").replace(/\s+/g, " ").trim();
            const h = a.getAttribute("href");
            const k = h || t;
            if (t && h && !seen.has(k)) { seen.add(k); out.push({ t, h }); }
          });
        }
      }
      return out;
    }, id);

  for (const s of uniq) {
    // har bir bo'limni 2 marta bosamiz (toggle bo'lgani uchun)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await page.locator(`.bx-helpdesk-section-item[data-id="${s.id}"] .js-section-item-title-1:visible`).first()
          .click({ timeout: 5000, force: true });
        await page.waitForTimeout(320);
      } catch (e) {}
      const a = await collect(s.id);
      if (a.length) break;
    }
    const arts = await collect(s.id);
    map.push({ id: s.id, name: s.name, n: arts.length, articles: arts });
    process.stdout.write(`\r${s.name}: ${arts.length}          `);
  }

  fs.writeFileSync("bitrix-map.json", JSON.stringify(map, null, 2), "utf8");
  const total = map.reduce((a, s) => a + s.n, 0);
  const zero = map.filter((s) => s.n === 0);
  console.log("\n\n=== YAKUN ===");
  console.log("bo'limlar:", map.length, "| maqolalar:", total, "| bo'sh bo'limlar:", zero.length);
  if (zero.length) console.log("bo'shlar:", zero.map((s) => s.name).join(", "));
  await browser.close();
})();
