// cachedFetch ga noto'g'ri o'tkazilgan MUTATION so'rovlarini qaytaradi.
// (method: POST/PATCH/PUT/DELETE — bular keshlangan bo'lmasligi kerak)
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

let fixed = 0;
for (const f of walk(ADMIN)) {
  let src = fs.readFileSync(f, "utf8");
  let out = "";
  let i = 0;
  let changed = false;
  while (true) {
    const idx = src.indexOf("cachedFetch(", i);
    if (idx === -1) {
      out += src.slice(i);
      break;
    }
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
    out += src.slice(i, idx);
    if (/method:\s*"(POST|PATCH|PUT|DELETE)"/.test(call)) {
      out += "fetch" + call.slice("cachedFetch".length);
      changed = true;
      fixed++;
    } else {
      out += call;
    }
    i = j + 1;
  }
  if (changed) {
    fs.writeFileSync(f, out, "utf8");
    console.log("tuzatildi:", path.relative(ROOT, f));
  }
}
console.log(`\n${fixed} ta mutation so'rovi fetch() ga qaytarildi`);
