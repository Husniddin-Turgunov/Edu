// Bitrix maqola sahifasi: kontent, rasmlar, breadcrumb (bo'lim havolasi).
const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto("https://helpdesk.bitrix24.ru/open/23240682/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);

  const a = await page.evaluate(() => {
    const txt = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();
    // breadcrumb
    const crumbs = [...document.querySelectorAll('[class*="breadcrumb"] a, [class*="bread-crumb"] a')].map((x) => ({
      text: txt(x), href: x.getAttribute("href"),
    }));
    // barcha /open/ havolalari (bo'lim linklari ham shu shaklda bo'lishi mumkin)
    const opens = [...new Set([...document.querySelectorAll('a[href*="/open/"]')].map((x) => x.getAttribute("href")))];
    // kontent konteyneri
    const cands = [...document.querySelectorAll("article, .bx-helpdesk-article, [class*='article-content'], [class*='article__content'], [class*='content']")]
      .map((el) => ({ cls: (el.className || "").toString().slice(0, 70), len: (el.textContent || "").length }))
      .filter((x) => x.len > 400)
      .sort((x, y) => y.len - x.len)
      .slice(0, 5);
    const imgs = [...new Set([...document.querySelectorAll("img")].map((i) => i.src).filter((s) => s && !/logo|icon|avatar|favicon/i.test(s)))];
    return {
      url: location.href,
      title: document.title,
      h1: txt(document.querySelector("h1")),
      crumbs,
      opens: opens.slice(0, 25),
      contentCands: cands,
      imgCount: imgs.length,
      imgs: imgs.slice(0, 8),
      textStart: document.body.innerText.slice(0, 800),
    };
  });

  fs.writeFileSync("bitrix-article.json", JSON.stringify(a, null, 2), "utf8");
  console.log("URL:", a.url);
  console.log("title:", a.title);
  console.log("h1:", a.h1);
  console.log("\n=== breadcrumb ===");
  a.crumbs.forEach((c) => console.log(`  "${c.text}" -> ${c.href}`));
  console.log("\n=== /open/ havolalari ===");
  a.opens.forEach((o) => console.log("  ", o));
  console.log("\n=== kontent konteynerlari ===");
  a.contentCands.forEach((c) => console.log(`  ${c.len} belgi | ${c.cls}`));
  console.log("\nrasmlar:", a.imgCount);
  a.imgs.forEach((i) => console.log("  ", i));
  console.log("\n--- matn ---\n" + a.textStart);

  await page.screenshot({ path: "bitrix-article.png" });
  await browser.close();
})();
