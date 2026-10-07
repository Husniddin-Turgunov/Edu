// Bitrix KB ichki API/JSON so'rovlarini ushlaydi (network traffic).
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  const calls = [];
  page.on("request", (r) => {
    const u = r.url();
    if (u.includes("helpdesk.bitrix24.ru") && !/\.(css|js|png|jpg|jpeg|gif|svg|woff2?|ico)(\?|$)/i.test(u)) {
      calls.push({ method: r.method(), url: u, type: r.resourceType() });
    }
  });

  await page.goto("https://helpdesk.bitrix24.ru/", { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(4000);

  console.log("=== bosh sahifa so'rovlari ===");
  [...new Set(calls.map((c) => `${c.method} ${c.url}`))].forEach((c) => console.log("  ", c));

  // Bo'lim ro'yxatini ochishga urinish
  console.log("\n=== bo'lim ro'yxatini ochishga urinish ===");
  const toggles = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll("button,a,div[class*='catalog'],div[class*='toggle'],[class*='burger'],[class*='menu']").forEach((el) => {
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      const cls = (el.className || "").toString();
      if (t.length < 30 && (el.getBoundingClientRect().width > 0) && /каталог|все|стать|раздел|menu|catalog|burger/i.test(cls + " " + t)) {
        out.push({ tag: el.tagName, cls: cls.slice(0, 80), text: t.slice(0, 40) });
      }
    });
    return out.slice(0, 12);
  });
  toggles.forEach((t) => console.log("  ", t.tag, "|", t.cls, "|", t.text));

  await browser.close();
})();
