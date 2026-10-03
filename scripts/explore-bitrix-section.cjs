// Bitrix24 KB: barcha bo'limlar + bitta bo'lim sahifasining ichki tuzilmasi.
const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

  await page.goto("https://helpdesk.bitrix24.ru/", { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2000);

  // Barcha bo'lim linklari (nom + href)
  const sections = await page.evaluate(() => {
    const txt = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();
    const out = [];
    document.querySelectorAll("a[href]").forEach((a) => {
      const t = txt(a);
      const href = a.getAttribute("href") || "";
      if (t.length > 2 && t.length < 40 && /^\/(section|category|open)\//.test(href) === false && href.startsWith("/") && !href.startsWith("/open/")) {
        out.push({ text: t, href });
      }
    });
    return out;
  });
  console.log("=== bo'limga o'xshash linklar:", sections.length);
  const uniq = [];
  const seen = new Set();
  for (const s of sections) {
    const k = s.text + "|" + s.href;
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(s);
  }
  uniq.slice(0, 45).forEach((s) => console.log("  ", s.text.padEnd(28), s.href));

  // "Задачи" bo'limiga o'tamiz
  const zada = uniq.find((s) => /Задачи/.test(s.text));
  if (!zada) {
    console.log("\nЗадачи topilmadi");
    await browser.close();
    return;
  }
  console.log("\n=== 'Задачи' bo'limi:", zada.href);
  await page.goto("https://helpdesk.bitrix24.ru" + zada.href, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2500);

  const sec = await page.evaluate(() => {
    const txt = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();
    const articles = [...document.querySelectorAll('a[href*="/open/"]')].map((a) => ({
      href: a.getAttribute("href"),
      text: txt(a).slice(0, 120),
    }));
    return {
      url: location.href,
      title: document.title,
      headings: [...document.querySelectorAll("h1,h2,h3")].map((h) => txt(h)).slice(0, 12),
      articleCount: articles.length,
      articles: articles.slice(0, 12),
      bodyStart: document.body.innerText.slice(0, 900),
    };
  });
  fs.writeFileSync("bitrix-section.json", JSON.stringify(sec, null, 2), "utf8");
  console.log("URL:", sec.url);
  console.log("sarlavhalar:", sec.headings.join(" | "));
  console.log("maqolalar:", sec.articleCount);
  sec.articles.forEach((a) => console.log("   -", a.href, "|", a.text.slice(0, 80)));
  console.log("\n--- matn ---\n" + sec.bodyStart);

  await page.screenshot({ path: "bitrix-section.png", fullPage: false });
  await browser.close();
})();
