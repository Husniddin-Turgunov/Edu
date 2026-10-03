// Bitrix maqola kontentini yig'adi va HAR MAQOLADAN KEYIN saqlaydi (uzilishdan himoya).
// Natija: data/bitrix-articles.json
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const MAP = JSON.parse(fs.readFileSync("bitrix-map.json", "utf8"));
const OUT = path.join("data", "bitrix-articles.json");
const LIMIT = Number(process.argv[2] || 40); // shu bosqichda nechta maqola
const START = Number(process.argv[3] || 0);

fs.mkdirSync("data", { recursive: true });
let saved = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : [];
const doneIds = new Set(saved.map((a) => a.url));
console.log("avval saqlangan:", saved.length);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

  // Maqolalar ro'yxati (bitrix tartibida)
  const queue = [];
  for (const sec of MAP) {
    if (!sec.n) continue;
    for (const a of sec.articles) {
      if (doneIds.has(a.h)) continue;
      queue.push({ ...a, section: sec.name, sectionId: sec.id });
    }
  }
  console.log("kutilmoqda:", queue.length, "| shu bosqichda:", Math.min(LIMIT, queue.length));

  let n = 0;
  for (const item of queue.slice(START, START + LIMIT)) {
    const url = "https://helpdesk.bitrix24.ru" + item.h;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(900);
      // cookie banner ni tozalash
      await page.evaluate(() => {
        document.querySelectorAll("div").forEach((d) => {
          if ((d.textContent || "").includes("Продолжая пользоваться") && d.children.length < 12) d.remove();
        });
      });

      const art = await page.evaluate(() => {
        const txt = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();
        const root = document.querySelector(".bx-helpdesk-article, article, [class*='article-content']") || document.body;
        const h1 = document.querySelector("h1");
        // muallif / sana
        let author = "", updated = "";
        const body = document.body.innerText;
        const am = body.match(/Автор[:\s]+([^\nП]{3,60})/);
        const um = body.match(/Последнее обновление[:\s]+([^\n]{6,40})/);
        if (am) author = am[1].trim();
        if (um) updated = um[1].trim();
        // rasmlar
        const imgs = [...new Set([...root.querySelectorAll("img")]
          .map((i) => i.getAttribute("src") || "")
          .filter((s) => /\/images\/helpdesk\/screenshots\//.test(s)))];
        // kontent bloklari
        const blocks = [];
        root.querySelectorAll("h2, h3, p, li").forEach((el) => {
          const t = txt(el);
          if (!t || t.length < 2) return;
          if (el.tagName === "H2") blocks.push({ k: "h2", t });
          else if (el.tagName === "H3") blocks.push({ k: "h3", t });
          else if (el.tagName === "LI") blocks.push({ k: "li", t });
          else blocks.push({ k: "p", t });
        });
        return {
          title: h1 ? txt(h1) : "",
          author, updated, imgs,
          blocks: blocks.slice(0, 400),
        };
      });

      saved.push({ ...item, ...art });
      n++;
      // HAR BIR MAQOLADAN KEYIN saqlaymiz
      fs.writeFileSync(OUT, JSON.stringify(saved, null, 1), "utf8");
      process.stdout.write(`\r[${n}] ${art.title.slice(0, 55)}  (rasm: ${art.imgs.length}, blok: ${art.blocks.length})   `);
    } catch (e) {
      process.stdout.write(`\nXATO ${item.h}: ${e.message.slice(0, 60)}\n`);
    }
  }

  fs.writeFileSync(OUT, JSON.stringify(saved, null, 1), "utf8");
  console.log(`\n\n=== YAKUN: jami ${saved.length} ta maqola saqlandi (shu bosqichda ${n}) ===`);
  const withImg = saved.filter((a) => a.imgs && a.imgs.length).length;
  const withBody = saved.filter((a) => a.blocks && a.blocks.length > 3).length;
  console.log("kontenti bor:", withBody, "| rasmi bor:", withImg);
  await browser.close();
})();
