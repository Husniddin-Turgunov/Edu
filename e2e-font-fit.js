/* Shrift ↔ border mosligini tekshiruvchi audit.
   - next-auth JWT cookie (middleware o'tishi uchun)
   - /api/auth/session mock (client sessiya)
   - Borderli konteynerlardan chiqib ketgan matnlarni topadi
   Ishga tushirish: node e2e-font-fit.js [port] [label]                        */
const { chromium } = require("playwright");
const { encode } = require("next-auth/jwt");

const PORT = process.argv[2] || "3100";
const LABEL = process.argv[3] || "before";
const SECRET = process.env.NEXTAUTH_SECRET || "akela-onboarding-secret-key-2024";
const BASE = `http://localhost:${PORT}`;

const AUDIT = () => {
  const items = [];
  const seen = new Set();
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) === 0) continue;
    const vOver = el.scrollHeight - el.clientHeight;
    const hOver = el.scrollWidth - el.clientWidth;
    const area = r.width * r.height;
    if (area > 250000) continue; // katta bo'limlar — chetlab o'tamiz
    const text = (el.textContent || "").trim().replace(/\s+/g, " ");
    if (!text) continue;
    const hasOwnText = Array.from(el.childNodes).some(
      (n) => n.nodeType === 3 && (n.textContent || "").trim().length > 1
    );
    if (!hasOwnText) continue;
    if (vOver > 1 || hOver > 1) {
      const key = `${el.tagName}-${Math.round(r.width)}x${Math.round(r.height)}-${text.slice(0, 30)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        text: text.slice(0, 60),
        cls: (el.className || "").toString().slice(0, 110),
        vOver,
        hOver,
        box: `${Math.round(r.width)}x${Math.round(r.height)}`,
        overflow: `${cs.overflowX}/${cs.overflowY}`,
        fontSize: cs.fontSize,
        lineHeight: cs.lineHeight,
      });
    }
  }
  // Eng katta 25 ta muammoni qaytaramiz
  items.sort((a, b) => b.vOver + b.hOver - (a.vOver + a.hOver));
  return {
    total: items.length,
    items: items.slice(0, 25),
  };
};

(async () => {
  const token = await encode({
    token: { name: "Admin", email: "admin@akelagroup.com", sub: "admin1", role: "admin", id: "admin1" },
    secret: SECRET,
    maxAge: 30 * 24 * 60 * 60,
  });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([
    {
      name: "next-auth.session-token",
      value: token,
      url: BASE,
      httpOnly: false,
      sameSite: "Lax",
      secure: false,
    },
  ]);
  const page = await context.newPage();
  await page.route("**/api/auth/session", (r) =>
    r.fulfill({
      json: { user: { id: "admin1", email: "admin@akelagroup.com", name: "Admin", role: "admin" }, expires: "2099-01-01T00:00:00.000Z" },
    })
  );
  await page.route("**/api/videos**", (r) => r.fulfill({ json: { ok: true, home: [], videos: [] } }));
  await page.route("**/api/portal-settings**", (r) => r.fulfill({ json: { ok: true, settings: {} } }));
  await page.route("**/api/progress**", (r) => r.fulfill({ json: { ok: true } }));
  await page.route("**/api/my-stats**", (r) => r.fulfill({ json: { ok: true } }));

  const PAGES = [
    { path: "/", name: "home", wait: "text=AKELA GROUP" },
    { path: "/dashboard", name: "dashboard", wait: "body" },
    { path: "/courses", name: "courses", wait: "body" },
    { path: "/admin", name: "admin", wait: "body" },
    { path: "/register", name: "register", wait: "body" },
  ];

  const report = {};
  for (const p of PAGES) {
    await page.goto(BASE + p.path, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1500);
    try {
      await page.locator(p.wait).first().waitFor({ timeout: 8000 });
    } catch {}
    // Sahifani to'liq scroll qilib lazy bloklarni ochish
    await page.evaluate(async () => {
      const step = window.innerHeight;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((res) => setTimeout(res, 120));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(600);
    report[p.name] = await page.evaluate(AUDIT);
    await page.screenshot({ path: `font-audit-${LABEL}-${p.name}.png`, fullPage: true });
  }

  console.log(JSON.stringify(report, null, 2));
  const total = Object.values(report).reduce((a, b) => a + b.total, 0);
  console.log(`TOTAL OVERFLOWING TEXT NODES: ${total}`);

  require("fs").writeFileSync(`font-audit-${LABEL}.json`, JSON.stringify(report, null, 2), "utf8");
  for (const [name, r] of Object.entries(report)) {
    console.log(`--- ${name}: ${r.total}`);
    for (const it of r.items) {
      console.log(
        `  v+${it.vOver} h+${it.hOver} ${it.box} fs=${it.fontSize} lh=${it.lineHeight} :: ${it.text.slice(0, 45)}`
      );
    }
  }

  await browser.close();
  process.exit(0);
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(2);
});
