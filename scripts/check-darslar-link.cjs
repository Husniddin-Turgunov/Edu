// "Darslar" linki boshqa markaziy linklar bilan bir xil o'lchamda va
// hech qachon ustiga chiqmayotganini tekshiradi.
const { chromium } = require("playwright");

const BASE = (process.argv[2] || "http://localhost:3111").replace(/\/$/, "");
const WIDTHS = [1588, 1440, 1280, 1152, 1024];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1588, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 60000 });
  await page.locator('input[type="email"]').first().fill("admin@akelagroup.com");
  await page.locator('input[type="password"]').first().fill("AGM_9561");
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(4000);

  let bad = 0;
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(800);

    const r = await page.evaluate(() => {
      const nav = document.querySelector("header nav");
      const center = nav && nav.querySelector("div.mx-auto");
      if (!center) return { error: "markaziy guruh yo q" };
      const btns = Array.from(center.querySelectorAll("button")).filter((b) => (b.textContent || "").trim());
      const darslar = Array.from(center.querySelectorAll("a")).find((a) => (a.textContent || "").trim() === "Darslar");
      if (!darslar || btns.length === 0) return { error: "linklar topilmadi" };

      const cs = getComputedStyle(btns[0]);
      const ds = getComputedStyle(darslar);
      const db = darslar.getBoundingClientRect();
      const lastBtn = btns[btns.length - 1].getBoundingClientRect();

      return {
        fontSame: cs.fontSize === ds.fontSize,
        padSame: cs.paddingLeft === ds.paddingLeft,
        weightSame: cs.fontWeight === ds.fontWeight,
        fontUI: cs.fontSize,
        fontD: ds.fontSize,
        radiusSame: cs.borderRadius === ds.borderRadius,
        // "Darslar" o'zidan oldingi tugmaga ustiga chiqdimi
        darslarGap: Math.round(db.left - lastBtn.right),
      };
    });

    if (r.error) { console.log(String(w).padStart(5) + "px | xato: " + r.error); bad++; continue; }
    const ok = r.fontSame && r.padSame && r.weightSame && r.darslarGap >= 0;
    if (!ok) bad++;
    console.log(
      String(w).padStart(5) + "px | shrift " + (r.fontSame ? "bir xil" : `FARQ ${r.fontUI} vs ${r.fontD}`) +
      " | padding " + (r.padSame ? "bir xil" : "FARQ") +
      " | vazn " + (r.weightSame ? "bir xil" : "FARQ") +
      " | radius " + (r.radiusSame ? "bir xil" : "FARQ") +
      ` | oldingi tugma->Darslar ${r.darslarGap}px` +
      (ok ? "  ✅" : "  ❌")
    );
  }

  await browser.close();
  console.log(bad === 0 ? "\nXULOSA: Darslar boshqalar bilan bir xil va ustiga chiqmaydi" : `\nXULOSA: ${bad} ta muammo`);
  process.exit(bad === 0 ? 0 : 1);
})();
