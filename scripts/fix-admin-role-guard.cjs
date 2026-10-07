// Admin sahifalaridagi zaif ro'li tekshiruvini tuzatadi.
// Sabab: "status === authenticated" bo'lganda session.user hali to'liq
// yuklanmagan bo'lsa, role !== "admin" sharti rozi bo'lib ketadi va
// foydalanuvchi /dashboard ga "uchib" ketadi.
// Yechim: faqat aniq "user" roli bo'lganda qaytariladi; noma'lum rol - qaytarilmaydi
// (API lar server tomonda alohida tekshiradi).
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ADMIN = path.join(ROOT, "src", "app", "admin");

const FROM = '(status === "authenticated" && (session?.user as any)?.role !== "admin")';
const TO = '(status === "authenticated" && (session?.user as any)?.role === "user")';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === "page.tsx") out.push(p);
  }
  return out;
}

let changed = 0;
const files = walk(ADMIN);
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  if (!src.includes(FROM)) continue;
  const next = src.split(FROM).join(TO);
  fs.writeFileSync(f, next, "utf8");
  changed++;
  console.log("fixed:", path.relative(ROOT, f));
}
console.log(`\n${changed} ta faylda ro'li tekshiruvi tuzatildi (jami ${files.length} ta page.tsx ko'rib chiqildi)`);
