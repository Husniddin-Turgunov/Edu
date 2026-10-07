/**
 * Mojibake guard — UTF-8 buzilishini (mojibake) aniqlaydi.
 *
 * Muammo: ba'zi fayllar UTF-8 kodlangan bo'lsa ham, ular Windows-1251/1252
 * deb "ochilgan" bo'lishi mumkin. Natijada "∞" -> "в€ћ", "—" -> "вЂ”",
 * "компании" -> "коРјРїР°РЅии" kabi buzilgan matnlar paydo bo'ladi.
 *
 * Ishga tushirish: npm run check:encoding
 * Chiqish: 0 (toza) yoki 1 (muammo topildi)
 */
const fs = require("fs");
const path = require("path");

const ROOTS = process.argv.slice(2).length ? process.argv.slice(2) : ["src", "scripts", "prisma", "public", "tests"];
const EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".css", ".html", ".sql", ".yml", ".yaml"]);
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "upload", "dist", "coverage", ".turbo"]);
// Guard'ning o'zi va test fayllari tekshirilmaydi (ular belgilar namunasini o'z ichida oladi)
const SKIP_FILES = new Set(["check-encoding.cjs", "_encoding-selftest.ts", "_st.ts"]);

// Mojibake belgilari: cp1251/cp1252 da ochilganda paydo bo'ladigan maxsus
// gliflar va U+FFFD. Diqqat: “ ” ‘ ’ — – ← ∞ bular normal belgilar —
// mos kelmaydi. "Р" + kichik harf ham normal ruscha so'z (Руководство).
const MOJIBAKE = /[ЂЅµ¶°ƒ‰€‚„œ‹‡™]|\uFFFD/;

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    if (SKIP_FILES.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXTS.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

const files = ROOTS.flatMap((r) => {
  try { return fs.statSync(r).isDirectory() ? walk(r) : [r]; } catch { return []; }
});

const problems = [];
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  text.split(/\r?\n/).forEach((line, i) => {
    if (MOJIBAKE.test(line)) problems.push({ file, line: i + 1, text: line.trim().slice(0, 160) });
  });
}

if (problems.length) {
  console.error(`\nMOJIBAKE topildi: ${problems.length} qator (${new Set(problems.map((p) => p.file)).size} fayl)\n`);
  for (const p of problems.slice(0, 60)) {
    console.error(`  ${p.file}:${p.line}\n    ${p.text}`);
  }
  console.error("\nYechim: UTF-8 ni Windows-1251/1252 deb ochmaslik. Ko'p hollarda matnni qayta yozish kerak.");
  process.exit(1);
}

console.log(`check:encoding — ${files.length} fayl tekshirildi, mojibake topilmadi.`);
