// /start sahifasidan "1-qadam: ma'lumotlar" (ishga kirish so'rovnomasi) blokini
// olib tashlaydi — foydalanuvchi so'ramagan edi.
const fs = require("fs");
const path = require("path");
const F = path.join(__dirname, "..", "src", "app", "start", "page.tsx");

const src = fs.readFileSync(F, "utf8");
const lines = src.split(/\r?\n/);

// 1-qadam section boshlanishi va tugashi
const startIdx = lines.findIndex((l) => l.includes("{/* ── 1-qadam: ma'lumotlar ── */}"));
if (startIdx === -1) {
  console.log("1-qadam blok topilmadi");
  process.exit(1);
}
let endIdx = -1;
for (let i = startIdx + 1; i < lines.length; i++) {
  if (lines[i].includes("</motion.section>")) {
    endIdx = i;
    break;
  }
}
if (endIdx === -1) {
  console.log("1-qadam blok oxiri topilmadi");
  process.exit(1);
}
console.log(`olib tashlanadigan qatorlar: ${startIdx + 1}..${endIdx + 1}`);
console.log(`birinchi: ${lines[startIdx].trim()}`);
console.log(`oxirgi:   ${lines[endIdx].trim()}`);

const out = [
  ...lines.slice(0, startIdx),
  ...lines.slice(endIdx + 2), // +2 = </motion.section> + bo'sh qator
];
fs.writeFileSync(F, out.join("\n"), "utf8");
console.log(`\nqoldi: ${lines.length} -> ${out.length} qator`);
