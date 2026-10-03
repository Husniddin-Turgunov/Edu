// Bitrix24 ommaviy bilim bazasi sahifasini yuklab, tuzilmasini tahlil qiladi.
const https = require("https");
const fs = require("fs");

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(get(res.headers.location));
        }
        const chunks = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () =>
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8"), headers: res.headers })
        );
      })
      .on("error", reject);
  });
}

(async () => {
  const r = await get("https://helpdesk.bitrix24.ru/");
  fs.writeFileSync("bitrix-kb.html", r.body, "utf8");
  console.log("HTTP", r.status, "| belgilar:", r.body.length);
  console.log("title:", (r.body.match(/<title>([^<]*)<\/title>/) || [])[1]);
  console.log("charset:", r.headers["content-type"]);

  const openLinks = [...new Set([...r.body.matchAll(/href="(\/open\/[^"#?]+)"/g)].map((m) => m[1]))];
  console.log("\n/open/ linklari:", openLinks.length);
  openLinks.slice(0, 20).forEach((l) => console.log("  ", l));

  // JSON ichida ma'lumot bormi
  const jsonish = [...new Set([...r.body.matchAll(/"(?:title|name|items|categories|sections)":\s*"([^"]{3,60})"/g)].map((m) => m[1]))];
  console.log("\nJSONga o'xshash maydonlar:", jsonish.length);
  jsonish.slice(0, 25).forEach((j) => console.log("  ", j));

  // "N статей" / "N макала" kabi hisoblar
  const counts = [...new Set([...r.body.matchAll(/(\d+)\s*(?:стат[её]й|макал|стать)/gi)].map((m) => m[0]))];
  console.log("\n'X статей' hisoblari:", counts.length);
  counts.slice(0, 20).forEach((c) => console.log("  ", c));
})();
