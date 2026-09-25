/* Skaner: admin UI sahifalarida mutation (POST/PATCH/DELETE) dan keyin
 * yangilanish (refetch/load/fetchX) BORMI?
 * Ishlatish: node scan-mutations.mjs
 */
import fs from "fs";
import path from "path";

const ROOT = path.join(process.cwd(), "src", "app");
const MUT = /method:\s*["'](POST|PATCH|PUT|DELETE)["']/g;
const REFRESH = /\b(fetch\w*|load\w*|reload\w*|refresh\w*)\s*\(/;
const setState = /set\w+\s*\(/;

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".tsx") && !p.includes(`${path.sep}api${path.sep}`)) files.push(p);
  }
})(ROOT);

const suspects = [];

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  if (!MUT.test(src)) continue;
  MUT.lastIndex = 0;
  const lines = src.split(/\r?\n/);

  lines.forEach((line, i) => {
    if (!/method:\s*["'](POST|PATCH|PUT|DELETE)["']/.test(line)) return;
    // Mutation dan keyingi ~35 qatorni ko'ramiz (biror refetch chaqiruvi bormi?)
    const after = lines.slice(i, Math.min(lines.length, i + 40)).join("\n");
    // yakunlanish bloki: `});` bilan tugaydigan fetch ichida ekanini taxmin qilamiz
    const hasRefresh = REFRESH.test(after);
    const rel = path.relative(process.cwd(), file).replace(/\\/g, "/");
    if (!hasRefresh) {
      suspects.push({ file: rel, line: i + 1, code: line.trim().slice(0, 110) });
    }
    MUT.lastIndex = 0;
  });
}

console.log(`Skan qilingan .tsx (app, apisiz): ${files.length}`);
console.log(`\nShubhali joylar (mutation dan keyin 40 qator ichida refetch topilmadi): ${suspects.length}`);
for (const s of suspects) console.log(`  ${s.file}:${s.line}\n      ${s.code}`);
