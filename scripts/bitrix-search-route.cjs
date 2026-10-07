// Qidiruv orqali KB ga kirish va URL routing formatini topish.
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto("https://helpdesk.bitrix24.ru/", { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2500);

  // Qidiruv inputini topamiz
  const inputs = await page.evaluate(() =>
    [...document.querySelectorAll("input")].map((i, idx) => ({
      idx,
      type: i.type,
      ph: i.placeholder || "",
      name: i.name || "",
      visible: i.getBoundingClientRect().width > 0,
    }))
  );
  console.log("=== inputlar ===");
  inputs.forEach((i) => console.log(`  [${i.idx}] type=${i.type} name="${i.name}" ph="${i.ph}" ko'rinadi=${i.visible}`));

  const search = inputs.find((i) => i.visible && (i.type === "text" || i.type === "search"));
  if (!search) { console.log("qidiruv topilmadi"); await browser.close(); return; }

  await page.locator("input").nth(search.idx).fill("задачи");
  await page.waitForTimeout(1200);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(4000);

  console.log("\nqidiruvdan keyingi URL:", page.url());
  const res = await page.evaluate(() => ({
    h: [...document.querySelectorAll("h1,h2,h3")].map((x) => (x.textContent || "").replace(/\s+/g, " ").trim()).slice(0, 8),
    opens: [...new Set([...document.querySelectorAll('a[href*="/open/"]')].map((a) => a.getAttribute("href")))].slice(0, 12),
    text: document.body.innerText.slice(0, 700),
  }));
  console.log("sarlavhalar:", res.h.join(" | "));
  console.log("/open/:", res.opens.length);
  res.opens.slice(0, 8).forEach((o) => console.log("   ", o));
  console.log("\n--- matn ---\n" + res.text);

  await page.screenshot({ path: "bitrix-search.png" });
  console.log("\nskrinshot: bitrix-search.png");
  await browser.close();
})();
