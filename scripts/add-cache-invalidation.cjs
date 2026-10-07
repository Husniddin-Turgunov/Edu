// Admin mutation route'lariga kesh tozalash qo'shadi: o'zgartirilgandan keyin
// keyingi GET so'rovi eskirgan ma'lumotni qaytarmasin.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

// [ fayl, import qo'shiladigan joy (anchor), qo'yiladigan qatorlar ]
const TARGETS = [
  {
    file: "src/app/api/admin/questions/route.ts",
    anchor: 'import { NextResponse } from "next/server";',
    importLine: 'import { apiCacheClear, CACHE_KEYS } from "@/lib/api-cache";',
    afterMutations: true,
  },
  {
    file: "src/app/api/admin/tests/[id]/route.ts",
    anchor: null,
    importLine: 'import { apiCacheClear, CACHE_KEYS } from "@/lib/api-cache";',
    afterMutations: true,
  },
  {
    file: "src/app/api/admin/onboarding/lessons/route.ts",
    anchor: null,
    importLine: 'import { apiCacheClear, CACHE_KEYS } from "@/lib/api-cache";',
    afterMutations: true,
  },
  {
    file: "src/app/api/admin/onboarding/modules/[id]/route.ts",
    anchor: null,
    importLine: 'import { apiCacheClear, CACHE_KEYS } from "@/lib/api-cache";',
    afterMutations: true,
  },
  {
    file: "src/app/api/admin/onboarding/lessons/[id]/route.ts",
    anchor: null,
    importLine: 'import { apiCacheClear, CACHE_KEYS } from "@/lib/api-cache";',
    afterMutations: true,
  },
];

let touched = 0;
for (const t of TARGETS) {
  const f = path.join(ROOT, t.file);
  if (!fs.existsSync(f)) {
    console.log("yo'q:", t.file);
    continue;
  }
  let src = fs.readFileSync(f, "utf8");
  if (src.includes("@/lib/api-cache")) {
    console.log("allaqon bor:", t.file);
    continue;
  }

  // 1) import qo'shamiz — oxirgi import qatoridan keyin
  const importRe = /^import .*?;$/gm;
  let last = null;
  let m;
  while ((m = importRe.exec(src)) !== null) last = m;
  if (!last) {
    console.log("import topilmadi:", t.file);
    continue;
  }
  src = src.slice(0, last.index + last[0].length) + "\n" + t.importLine + src.slice(last.index + last[0].length);

  // 2) har bir mutation handler ga kesh tozalash qo'yamiz
  const lines = src.split("\n");
  const out = [];
  let mutations = 0;
  let inMutation = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isMutStart =
      /export async function (POST|PATCH|PUT|DELETE)\b/.test(line) ||
      /method:\s*"(POST|PATCH|PUT|DELETE)"/.test(line) ||
      /\bmethod:\s*'(POST|PATCH|PUT|DELETE)'/.test(line);
    if (isMutStart) inMutation = true;

    out.push(line);

    // mutation blokining oxiridagi return qatoridan keyin
    if (inMutation && /return\s+NextResponse\.json\(/.test(line) && /\{\s*ok:\s*true/.test(line)) {
      out.push("    apiCacheClear(CACHE_KEYS.adminOnboarding);");
      out.push("    apiCacheClear(CACHE_KEYS.adminTests);");
      mutations++;
      inMutation = false;
    }
  }
  fs.writeFileSync(f, out.join("\n"), "utf8");
  touched++;
  console.log(`${t.file}: import + ${mutations} ta tozalash`);
}
console.log(`\n${touched} ta fayl yangilandi`);
