// XAVFLIK TEKSHIRUV: cachedFetch ga o'tkazilgan so'rovlardan biri mutation
// (POST/PATCH/PUT/DELETE) bo'lsa - bu jiddiy xato (body farq qilsa ham bir xil
// javob qaytariladi). Barcha mutation so'rovlarni topamiz va qo'lda qaytaramiz.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ADMIN = path.join(ROOT, "src", "app", "admin");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === "page.tsx") out.push(p);
  }
  return out;
}

let bad = 0;
for (const f of walk(ADMIN)) {
  const src = fs.readFileSync(f, "utf8");
  // cachedFetch( ... ) chaqiruvlarini qavs balanslash bilan ajratamiz
  let i = 0;
  while (true) {
    const idx = src.indexOf("cachedFetch(", i);
    if (idx === -1) break;
    let depth = 0;
    let j = idx + "cachedFetch".length;
    for (; j < src.length; j++) {
      const ch = src[j];
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) break;
      }
    }
    const call = src.slice(idx, j + 1);
    if (/method:\s*"(POST|PATCH|PUT|DELETE)"/.test(call)) {
      const line = src.slice(0, idx).split("\n").length;
      console.log(`MUAMMO: ${path.relative(ROOT, f)} : ${line}-qator -> ${call.slice(0, 80).replace(/\n/g, " ")}`);
      bad++;
    }
    i = j + 1;
  }
}
console.log(bad === 0 ? "\nXavfli cachedFetch(mutation) topilmadi" : `\n${bad} ta xavfli chaqiruv bor`);
