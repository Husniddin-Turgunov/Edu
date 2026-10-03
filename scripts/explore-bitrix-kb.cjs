// Playwright bilan Bitrix24 KB tuzilmasini o'rnatadi (JS-render qilingan sahifa).
const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto("https://helpdesk.bitrix24.ru/", { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2500);

  const info = await page.evaluate(() => {
    const txt = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();

    // Bo'lim kartalari: sarlavha + "N статей"
    const cards = [...document.querySelectorAll("a,div")].filter((el) => {
      const t = txt(el);
      return /^\d+\s*(стат|макал)/i.test(t) && t.length < 40;
    });
    const sections = [...new Set(cards.map((el) => txt(el)))];

    // Bo'lim nomlari (sarlavha + hisob juftligi)
    const withCounts = [];
    document.querySelectorAll("a").forEach((a) => {
      const t = txt(a);
      if (/^\d+\s*(стат|макал)/i.test(t) && t.length < 40) {
        const parent = a.closest("div");
        withCounts.push({
          href: a.getAttribute("href"),
          text: t,
          near: parent ? txt(parent).slice(0, 120) : "",
        });
      }
    });

    return {
      title: document.title,
      h1: [...document.querySelectorAll("h1,h2")].map((h) => txt(h)).slice(0, 10),
      sectionCountSamples: sections.slice(0, 25),
      links: [...new Set([...document.querySelectorAll("a[href]")]
        .map((a) => a.getAttribute("href"))
        .filter((h) => h && h.startsWith("/")))].slice(0, 40),
      withCounts: withCounts.slice(0, 25),
      bodyLen: document.body.innerText.length,
      sample: document.body.innerText.slice(0, 700),
    };
  });

  fs.writeFileSync("bitrix-explore.json", JSON.stringify(info, null, 2), "utf8");
  console.log("title:", info.title);
  console.log("body matni:", info.bodyLen, "belgi");
  console.log("\n--- sarlavhalar ---");
  info.h1.forEach((h) => console.log("  ", h));
  console.log("\n--- 'N статей' ga ega bo'limlar ---");
  info.withCounts.forEach((w) => console.log("  ", JSON.stringify(w.text), "|", w.href || "-"));
  console.log("\n--- / havolalar (birinchi 40) ---");
  info.links.forEach((l) => console.log("  ", l));
  console.log("\n--- boshlang'ich matn ---");
  console.log(info.sample);

  await page.screenshot({ path: "bitrix-kb.png", fullPage: false });
  await browser.close();
})();
