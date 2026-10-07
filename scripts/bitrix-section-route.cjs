// Maqola sahifasidan bo'limga o'tib, routing formatini aniqlaydi.
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto("https://helpdesk.bitrix24.ru/open/23240682/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);

  const st = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.bx-helpdesk-section-item[data-id]')];
    const map = new Map();
    for (const it of items) {
      const id = it.getAttribute("data-id");
      if (map.has(id)) continue;
      const r = it.getBoundingClientRect();
      const nm = (it.querySelector(".bx-helpdesk-section-item-name")?.textContent || "").trim();
      map.set(id, { id, name: nm, visible: r.width > 0 && r.height > 0, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) });
    }
    return [...map.values()];
  });
  const uniq = [...new Map(st.map((s) => [s.id, s])).values()];
  const visible = uniq.filter((s) => s.visible);
  console.log("jami bo'lim elementlari:", uniq.length, "| ko'rinadigan:", visible.length);
  visible.slice(0, 12).forEach((s) => console.log(`  id=${s.id} "${s.name}" @${s.x},${s.y}`));

  const target = visible.find((s) => s.name === "Задачи") || visible[0];
  if (!target) {
    console.log("\nko'rinadigan bo'lim yo'q — sidebar yopiq");
    // yopiq bo'lsa, ochuvchi elementni qidiramiz
    const opener = await page.evaluate(() => {
      const c = [...document.querySelectorAll("button,a,div,span")].filter((el) => {
        const t = (el.textContent || "").replace(/\s+/g, " ").trim();
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && t.length < 40 && /каталог|раздел|стать|все|burger|menu/i.test(t + " " + (el.className || ""));
      });
      return c.slice(0, 8).map((el) => ({ tag: el.tagName, text: (el.textContent || "").trim().slice(0, 30), cls: (el.className || "").toString().slice(0, 60) }));
    });
    console.log("ochuvchi imkoniyatlar:", JSON.stringify(opener, null, 1));
    await browser.close();
    return;
  }

  await page.mouse.click(target.x + target.w / 2, target.y + 10);
  await page.waitForTimeout(4500);
  console.log("\nbosildi:", target.name, "-> URL:", page.url());
  const res = await page.evaluate(() => ({
    h: [...document.querySelectorAll("h1,h2")].map((x) => (x.textContent || "").replace(/\s+/g, " ").trim()).slice(0, 6),
    opens: [...new Set([...document.querySelectorAll('a[href*="/open/"]')].map((a) => a.getAttribute("href")))].length,
    text: document.body.innerText.slice(0, 500),
  }));
  console.log("sarlavhalar:", res.h.join(" | "));
  console.log("/open/:", res.opens);
  console.log("\n--- matn ---\n" + res.text);
  await page.screenshot({ path: "bitrix-section-view.png" });
  await browser.close();
})();
