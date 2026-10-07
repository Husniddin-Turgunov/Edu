// Admin sahifalaridagi FAQAT o'qish (GET) so'rovlarini keshlangan cachedFetch'ga
// o'tkazadi. Mutation so'rovlari (method: POST/PATCH/PUT/DELETE) o'zgarishsiz
// qoladi - ular keshni avtomatik tozalaydi (admin-cache.ts).
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ADMIN = path.join(ROOT, "src", "app", "admin");

const PAGES = [
  "onboarding/page.tsx",
  "lms/page.tsx",
  "jobs/page.tsx",
  "videos/page.tsx",
  "students/page.tsx",
  "departments/page.tsx",
  "skills/page.tsx",
  "users/page.tsx",
  "lms/tests/page.tsx",
];

const IMPORT = `import { cachedFetch } from "@/lib/admin-cache";`;

function addImport(src) {
  if (src.includes(IMPORT)) return src;
  // useEffect importidan keyin qo'yamiz
  const m = src.match(/^import .*from "react";$/m);
  if (m) return src.replace(m[0], `${m[0]}\n${IMPORT}`);
  return `${IMPORT}\n${src}`;
}

// fetch("...", { cache: "no-store" })  ->  cachedFetch("...")
// faqat GET qilib yozilgan qatorlar (method: yo'q)
function convert(src, file) {
  let n = 0;
  const out = src.split("\n").map((line) => {
    if (!line.includes("fetch(")) return line;
    if (line.includes("cachedFetch")) return line;
    // mutation qatorlari: method: ko'rsatilgan bo'lsa tegilma
    if (/method:\s*"(POST|PATCH|PUT|DELETE)"/.test(line)) return line;
    // "fetch(" ni "cachedFetch(" ga almashtiramiz
    const idx = line.indexOf("fetch(");
    // fetchAll / prefetch kabi soxta nomlar bo'lmasligi uchun tekshiramiz
    const before = line.slice(0, idx);
    if (/[A-Za-z0-9_$]$/.test(before)) return line;
    n++;
    return line.slice(0, idx) + "cachedFetch(" + line.slice(idx + "fetch(".length);
  });
  return { text: out.join("\n"), n };
}

let total = 0;
for (const rel of PAGES) {
  const f = path.join(ADMIN, rel);
  if (!fs.existsSync(f)) {
    console.log("yo'q:", rel);
    continue;
  }
  const src = fs.readFileSync(f, "utf8");
  const { text, n } = convert(src, f);
  if (n === 0) {
    console.log(`0 ta  ${rel}`);
    continue;
  }
  fs.writeFileSync(f, addImport(text), "utf8");
  total += n;
  console.log(`${n} ta  ${rel}`);
}
console.log(`\nJami ${total} ta o'qish so'rovi keshlangan`);
