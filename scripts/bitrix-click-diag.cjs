// Bo'limni bosgandan keyin DOM da nima o'zgarishini aniqlaydi.
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  await page.goto("https://helpdesk.bitrix24.ru/open/23240682/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000);

  const snap = () => page.evaluate(() => {
    const item = document.querySelector('.bx-helpdesk-section-item[data-id="90967"]');
    if (!item) return { err: "bo'lim yo q" };
    const sib = item.nextElementSibling;
    const all = document.querySelectorAll("a.bx-helpdesk-section-child-article-link").length;
    return {
      itemCls: item.className,
      sibCls: sib ? sib.className : "(yo q)",
      sibW: sib ? Math.round(sib.getBoundingClientRect().width) : -1,
      childLinksInSib: sib ? sib.querySelectorAll("a.bx-helpdesk-section-child-article-link").length : -1,
      totalChildLinks: all,
      subItems: document.querySelectorAll(".bx-helpdesk-section-child").length,
    };
  });

  console.log("=== BOSISHDAN OLDIN ===");
  console.log(JSON.stringify(await snap(), null, 1));

  const target = page.locator('.bx-helpdesk-section-item[data-id="90967"] .js-section-item-title-1').first();
  console.log("\n=== element ko'rinuvi ===");
  console.log("count:", await page.locator('.bx-helpdesk-section-item[data-id="90967"]').count());
  console.log("title count:", await page.locator('.bx-helpdesk-section-item[data-id="90967"] .js-section-item-title-1').count());
  const box = await target.boundingBox().catch(() => null);
  console.log("boundingBox:", JSON.stringify(box));

  await target.click({ timeout: 8000, force: true }).catch((e) => console.log("click xato:", e.message.slice(0, 100)));
  await page.waitForTimeout(1500);
  console.log("\n=== BOSGANDAN KEYIN ===");
  console.log(JSON.stringify(await snap(), null, 1));

  await page.screenshot({ path: "bitrix-after-click.png" });
  console.log("\nskrinshot: bitrix-after-click.png");
  await browser.close();
})();
