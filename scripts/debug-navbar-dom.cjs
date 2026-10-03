const { chromium } = require("playwright");
const URL = process.argv[2] || "http://localhost:3111/";
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1588, height: 900 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
  p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
  await p.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await p.waitForTimeout(2500);
  const info = await p.evaluate(() => ({
    headers: document.querySelectorAll("header").length,
    navs: document.querySelectorAll("nav").length,
    headerNav: document.querySelectorAll("header nav").length,
    bodyStart: document.body.innerHTML.slice(0, 260),
    hasNavbarText: document.body.innerText.includes("Bosh sahifa"),
  }));
  console.log(JSON.stringify(info, null, 2));
  if (errs.length) console.log("XATOLAR:\n" + errs.slice(0, 6).join("\n"));
  await p.screenshot({ path: "navbar-debug.png" });
  console.log("skrinshot: navbar-debug.png");
  await b.close();
})();
