// "Задачи" elementining atrofidagi DOM tuzilmasini aniqlaydi.
const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto("https://helpdesk.bitrix24.ru/", { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2000);

  const dom = await page.evaluate(() => {
    const all = [...document.querySelectorAll("*")];
    const target = all.find((el) => el.children.length === 0 && (el.textContent || "").trim() === "Задачи");
    if (!target) return { error: "topilmadi" };

    const chain = [];
    let el = target;
    for (let i = 0; i < 6 && el; i++) {
      chain.push({
        tag: el.tagName,
        cls: (el.className || "").toString().slice(0, 120),
        href: el.getAttribute ? el.getAttribute("href") : null,
        data: el.dataset ? Object.keys(el.dataset) : [],
        onClick: el.getAttribute ? el.getAttribute("onclick") : null,
        html: el.outerHTML.slice(0, 400),
      });
      el = el.parentElement;
    }
    return { chain };
  });

  fs.writeFileSync("bitrix-dom.json", JSON.stringify(dom, null, 2), "utf8");
  if (dom.error) {
    console.log("XATO:", dom.error);
  } else {
    dom.chain.forEach((c, i) => {
      console.log(`--- ${i} --- <${c.tag}> class="${c.cls}"`);
      console.log("    href:", c.href, "| data:", JSON.stringify(c.data), "| onclick:", c.onClick);
      console.log("    html:", c.html.replace(/\s+/g, " ").slice(0, 260));
    });
  }
  await browser.close();
})();
