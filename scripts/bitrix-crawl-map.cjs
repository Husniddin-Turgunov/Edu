// Bitrix KB dan barcha maqola ID va bo'lim kodlarini yig'adi.
const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  // MUHIM: bo'lim paneli faqat MAQOLA sahifasida kenglikka ega (bosh sahifada 0 px),
  // shuning uchun xaritada maqola sahifasidan boshlaymiz
  await page.goto("https://helpdesk.bitrix24.ru/open/23240682/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000);

  // HTML ni saqlash
  const html = await page.content();
  fs.writeFileSync("bitrix-kb.html", html, "utf8");
  console.log("HTML saqlandi:", html.length, "belgi");

  const opens = [...new Set([...html.matchAll(/href="\/open\/(\d+)\/?"/g)].map((m) => m[1]))];
  console.log("maqola ID soni (sahifadagi):", opens.length);

  const codes = [...new Set([...html.matchAll(/\/images\/helpdesk\/screenshots\/ru\/([^/"]+)\//g)].map((m) => m[1]))];
  console.log("bo'lim kodi:", codes.length, "->", codes.slice(0, 20).join(", "));

  // Yon panel: har bir bo'limni ochib, maqolalarini olamiz
  // (oldingi "Новые статьи" ochiq bo'lgani uchun undan boshlaymiz)
  const sections = await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    document.querySelectorAll(".bx-helpdesk-section-item[data-id]").forEach((el) => {
      const id = el.getAttribute("data-id");
      if (seen.has(id)) return;
      seen.add(id);
      out.push({ id, name: (el.querySelector(".bx-helpdesk-section-item-name")?.textContent || "").trim() });
    });
    return out.filter((s) => s.name);
  });
  const uniq = [...new Map(sections.map((s) => [s.id, s])).values()];
  console.log("bo'limlar:", uniq.length);

  // Har bir bo'limni bosib, keyingi akasidagi maqolalarni olamiz
  const map = [];
  for (const s of uniq) {
    let arts = [];
    try {
      // DIQQAT: har bir bo'lim 2 marta chiqadi (desktop + mobil).
      // Faqat KO'RINADIGAN nusxani bosamiz (:visible), aks holda "Element is not visible".
      const sel = `.bx-helpdesk-section-item[data-id="${s.id}"] .js-section-item-title-1:visible`;
      await page.locator(sel).first().click({ timeout: 6000, force: true });
      await page.waitForTimeout(450);
      arts = await page.evaluate((id) => {
        // ko'rinadigan bo'lim nusxasini olamiz
        const items = [...document.querySelectorAll(`.bx-helpdesk-section-item[data-id="${id}"]`)];
        const item = items.find((el) => el.getBoundingClientRect().width > 0) || items[0];
        if (!item) return [];
        // bolalar bu yerda: .bx-helpdesk-section-child (kichik blok)
        const box = item.querySelector(".bx-helpdesk-section-child") ||
          (item.nextElementSibling && item.nextElementSibling.classList.contains("bx-helpdesk-section-child")
            ? item.nextElementSibling : null);
        if (!box) return [];
        return [...box.querySelectorAll("a.bx-helpdesk-section-child-article-link")].map((a) => ({
          t: (a.textContent || "").replace(/\s+/g, " ").trim(),
          h: a.getAttribute("href"),
        })).filter((a) => a.t && a.h);
      }, s.id);
    } catch (e) {}
    map.push({ id: s.id, name: s.name, n: arts.length, articles: arts });
    process.stdout.write(`\r${s.name}: ${arts.length}   `);
  }

  fs.writeFileSync("bitrix-map.json", JSON.stringify(map, null, 2), "utf8");
  const total = map.reduce((a, s) => a + s.n, 0);
  console.log("\n\n=== YAKUN ===");
  console.log("bo'limlar:", map.length, "| maqolalar:", total);
  map.forEach((s) => console.log(`  ${String(s.n).padStart(3)}  ${s.name}`));
  await browser.close();
})();
