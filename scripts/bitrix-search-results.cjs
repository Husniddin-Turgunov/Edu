// Bitrix qidiruv natijalari orqali maqola URL va bo'lim routing ni aniqlaydi.
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  const url = "https://helpdesk.bitrix24.ru/?q=" + encodeURIComponent("задачи");
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(3000);
  console.log("URL:", page.url());

  const res = await page.evaluate(() => {
    const txt = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();
    const opens = [...new Set([...document.querySelectorAll('a[href*="/open/"]')].map((a) => a.getAttribute("href")))];
    // maqola kartalari
    const cards = [...document.querySelectorAll("[class*='bx-helpdesk']")]
      .filter((el) => el.querySelector('a[href*="/open/"]'))
      .slice(0, 5)
      .map((el) => ({ cls: (el.className || "").toString().slice(0, 90), text: txt(el).slice(0, 160) }));
    return {
      title: document.title,
      h: [...document.querySelectorAll("h1,h2,h3")].map((x) => txt(x)).slice(0, 10),
      openCount: opens.length,
      opens: opens.slice(0, 15),
      sectionLinks: [...new Set([...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")).filter((h) => h && h !== "/" && !h.includes("/open/") && !h.includes("ticket")))].slice(0, 15),
      cards,
      text: document.body.innerText.slice(0, 800),
    };
  });

  console.log("title:", res.title);
  console.log("sarlavhalar:", res.h.join(" | "));
  console.log("/open/ havolalari:", res.openCount);
  res.opens.slice(0, 10).forEach((o) => console.log("   ", o));
  console.log("boshqa havolalar:", JSON.stringify(res.sectionLinks));
  console.log("\n--- matn ---\n" + res.text);

  await page.screenshot({ path: "bitrix-search-results.png" });
  console.log("\nskrinshot: bitrix-search-results.png");
  await browser.close();
})();
