// Login qilib, navbar overlap/bo'shliqni o'lchaydi (Playwright CLI, onlayn/local).
const { chromium } = require("playwright");

const BASE = (process.argv[2] || "http://localhost:3111").replace(/\/$/, "");
const WIDTHS = [1588, 1440, 1280, 1152, 1024, 960, 900, 768];
const EMAIL = "admin@akelagroup.com";
const PASS = "AGM_9561";

async function login(page) {
  await page.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 60000 });
  const email = page.locator('input[type="email"]').first();
  const pass = page.locator('input[type="password"]').first();
  await email.fill(EMAIL);
  await pass.fill(PASS);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(4000);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1588, height: 900 } });
  const page = await ctx.newPage();
  await login(page);
  console.log("kirishdan keyin URL:", page.url());

  let bad = 0;
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(900);

    const r = await page.evaluate(() => {
      const nav = document.querySelector("header nav");
      if (!nav) return { error: "nav topilmadi" };
      const center = nav.querySelector("div.mx-auto");
      const lang = nav.querySelector('[aria-label="Tilni tanlash"]');
      const darslar = Array.from(nav.querySelectorAll("a")).find((a) =>
        (a.textContent || "").trim().startsWith("Darslar")
      );
      if (!center || !lang) return { error: "guruhlar topilmadi", center: !!center, lang: !!lang };

      const c = center.getBoundingClientRect();
      const l = lang.getBoundingClientRect();
      const d = darslar ? darslar.getBoundingClientRect() : null;

      return {
        centerRight: Math.round(c.right),
        langLeft: Math.round(l.left),
        overlap: Math.round(c.right - l.left),
        darslarGap: d ? Math.round(l.left - d.right) : null,
        centerClipped: center.scrollWidth > center.clientWidth + 1,
        navOverflow: nav.scrollWidth - nav.clientWidth,
      };
    });

    if (r.error) { console.log(String(w).padStart(5) + "px | xato: " + r.error); bad++; continue; }
    const hit = r.overlap > 0;
    if (hit) bad++;
    console.log(
      String(w).padStart(5) + "px | " +
      (hit ? `USTIGA CHIQDI ${r.overlap}px` : `markaziy-til bo'shliq ${-r.overlap}px`) +
      ` | Darslar->til ${r.darslarGap}px` +
      ` | kesilgan ${r.centerClipped ? "HA" : "yo'q"}` +
      ` | nav overflow ${r.navOverflow}px`
    );
  }

  await page.setViewportSize({ width: 1588, height: 900 });
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: "navbar-check.png" });
  await browser.close();
  console.log(bad === 0 ? "\nXULOSA: hech bir kenglikda ustiga chiqish yo'q" : `\nXULOSA: ${bad} ta kenglikda muammo`);
  process.exit(bad === 0 ? 0 : 1);
})();
