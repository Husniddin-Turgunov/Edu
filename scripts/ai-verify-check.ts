/**
 * scripts/ai-verify-check.ts
 *
 * TEKSHIRUV TIZIMI uchun dalil skripti (Faza 4).
 *
 * Ishga tushirish:
 *   npx tsx --env-file=.env scripts/ai-verify-check.ts
 *
 * Nima tekshiriladi:
 *  1) doc.excel  → fayl diskka yoziladi, `verified: true`
 *  2) doc.recreate (bir xil format) → YANGI fayl (_v2), eskisi saqlanadi
 *  3) doc.recreate (Excel → Word) → konvertatsiya, `verified: true`
 *  4) file.list → yangi imzolangan yuklab olish havolasi
 *  5) TEKSHIRUV KAPOT: bazadagi yozuvni yo'q qilib qo'yib, tekshiruv
 *     `verified: false` qaytarishini ko'rsatish (agent shunda natijani
 *     foydalanuvchiga bermaydi va qayta urinishga qaytadi)
 *  6) wantsFileOutput — niyatni aniqlash
 */

import { runTool, type ToolContext } from "@/lib/ai/tools";
import { verifyToolResult } from "@/lib/ai/verify";
import { wantsFileOutput } from "@/lib/ai/agent";
import { db } from "@/lib/db";
import { stat } from "node:fs/promises";
import nodePath from "node:path";

async function realCtx(): Promise<ToolContext> {
  const admin: any = await db.user.findFirst({ where: { role: "admin" }, select: { id: true, email: true } });
  if (!admin) throw new Error("Admin foydalanuvchi topilmadi — tekshiruvni bajarib bo'lmaydi.");
  return {
    actor: { userId: admin.id, email: admin.email, role: "admin", name: "Tekshiruv", isAdmin: true },
    conversationId: null,
    source: "api",
  };
}

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    console.log(`  OK   ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  const ctx = await realCtx();

  console.log("\n=== 1) doc.excel — fayl yaratish va tekshiruv ===");
  const stamp = Date.now().toString(36);
  const baseName = `tekshiruv_${stamp}`;
  const excel = await runTool(
    "doc.excel",
    {
      filename: baseName,
      title: "Tekshiruv jadvali",
      sheets: [
        {
          name: "Ballar",
          headers: ["Xodim", "Ball"],
          rows: [
            ["Alisher", 88],
            ["Malika", 74],
          ],
          totalsRow: { label: "JAMI", columns: [1] },
        },
      ],
    },
    ctx,
  );
  check("doc.excel muvaffaqiyatli", excel.ok, excel.summary);
  check("verified = true", excel.verified === true, excel.verifyNote || "");
  const firstFileId = String((excel.data as any)?.fileId || "");
  const firstRow: any = await db.aiFile.findUnique({ where: { id: firstFileId } });
  const diskOk = await stat(nodePath.join(process.cwd(), firstRow.storagePath)).then((s) => s.size > 0);
  check("fayl diskda haqiqatan bor", diskOk, `${firstRow.storagePath}`);
  check("spec saqlangan", await stat(nodePath.join(process.cwd(), firstRow.storagePath.replace(/\.xlsx$/, ".spec.json"))).then(() => true, () => false));

  console.log("\n=== 2) doc.recreate — bir xil formatda qayta yaratish ===");
  const again = await runTool("doc.recreate", { file: `${baseName}.xlsx` }, ctx);
  check("doc.recreate muvaffaqiyatli", again.ok, again.summary);
  check("verified = true", again.verified === true, again.verifyNote || "");
  const newName = String((again.data as any)?.fileName || "");
  check("yangi nom berildi (_v2)", /_v2\.xlsx$/.test(newName), newName);
  check("eski fayl saqlanib qoldi", await db.aiFile.findUnique({ where: { id: firstFileId } }).then((r) => !!r));

  console.log("\n=== 3) doc.recreate — Excel → Word konvertatsiyasi ===");
  const asWord = await runTool("doc.recreate", { file: `${baseName}.xlsx`, as: "word" }, ctx);
  check("Excel → Word muvaffaqiyatli", asWord.ok, asWord.summary);
  check("verified = true", asWord.verified === true, asWord.verifyNote || "");
  check("kind = word", (asWord.data as any)?.kind === "word", String((asWord.data as any)?.fileName));
  const wordRow: any = await db.aiFile.findUnique({ where: { id: String((asWord.data as any)?.fileId) } });
  const wordBytes = await stat(nodePath.join(process.cwd(), wordRow.storagePath)).then((s) => s.size);
  check("DOCX fayl hajmi real", wordBytes > 3000, `${wordBytes} bayt`);

  console.log("\n=== 4) file.list — ro'yxat + yangi imzo ===");
  const list = await runTool("file.list", { name: baseName }, ctx);
  check("file.list muvaffaqiyatli", list.ok, list.summary);
  const rows = (list.data as any)?.rows || [];
  check("3 ta fayl topildi (Excel, _v2 Excel, Word)", rows.length === 3, `${rows.length} ta`);
  check("barchasida downloadUrl bor", rows.every((r: any) => typeof r.downloadUrl === "string" && r.downloadUrl.includes("sig=")));

  console.log("\n=== 5) TEKSHIRUV KAPOT — bazada yo'q bo'lsa ===");
  const gone = await db.aiFile.findUnique({ where: { id: firstFileId } });
  const fakeId = "f_yoq_yoq_yoq";
  const checkMissing = await verifyToolResult(
    "doc.excel",
    {},
    ctx,
    { ok: true, summary: "test", data: { fileId: fakeId } } as any,
  );
  check("yo'q fayl ID tekshiruvdan o'tmaydi", checkMissing.ok === false, checkMissing.detail);
  void gone;

  const deletedRow = await db.aiFile.findUnique({ where: { id: firstFileId } });
  if (deletedRow) {
    await db.aiFile.delete({ where: { id: firstFileId } });
    const checkGone = await verifyToolResult(
      "doc.excel",
      {},
      ctx,
      { ok: true, summary: "test", data: { fileId: firstFileId } } as any,
    );
    check("bazadan o'chirilgan fayl tekshiruvdan o'tmaydi", checkGone.ok === false, checkGone.detail);
  }

  console.log("\n=== 5b) TEKSHIRUV KAPOT — amal bajarilmagan bo'lsa ===");
  const users: any[] = await db.user.findMany({ where: { id: { not: ctx.actor.userId } }, select: { id: true, email: true }, take: 12 });
  const courses: any[] = await db.course.findMany({ select: { id: true, title: true }, take: 12 });
  const enrolledRow: any = await db.enrollment.findFirst({
    where: { userId: { not: ctx.actor.userId } },
    select: { user: { select: { email: true } }, course: { select: { title: true } } },
  });
  let enrolledPair: { user: string; course: string } | null = enrolledRow
    ? { user: enrolledRow.user.email, course: enrolledRow.course.title }
    : null;
  let freePair: { user: string; course: string } | null = null;
  for (const u of users) {
    for (const c of courses) {
      const row = await db.enrollment.findUnique({ where: { userId_courseId: { userId: u.id, courseId: c.id } } });
      if (!row && !freePair) freePair = { user: u.email, course: c.title };
    }
  }

  if (enrolledPair) {
    const removed = await runTool("course.unenroll", enrolledPair, ctx);
    check("course.unenroll (bajarilgan amal) verified", removed.verified === true, removed.verifyNote || "");
    enrolledPair = null;
  }
  if (freePair) {
    const noop = await runTool("course.unenroll", freePair, ctx);
    check(
      "biriktirilmagan kursni chiqarish tekshiruvdan O'TMAYDI",
      noop.verified === false && noop.ok === false,
      noop.summary.slice(0, 150),
    );
  } else {
    // Erkin juftlik yo'q — tekshiruv qoidasini to'g'ridan-to'g'ri chaqiramiz:
    // "amal bajarilmagan" natijasi hech qachon muvaffaqiyat deb hisoblanmaydi.
    const noop = await verifyToolResult(
      "course.unenroll",
      {},
      ctx,
      { ok: true, summary: "o'chirilgan yozuv topilmadi", data: { removed: 0 } } as any,
    );
    check("bajarilmagan amal tekshiruvdan O'TMAYDI", noop.ok === false, noop.detail);
  }
  if (!enrolledPair) console.log("  (biriktirilgan juftlik yo'q — qismdan test o'tkazildi)");

  console.log("\n=== 6) wantsFileOutput — niyat aniqlash ===");
  const intents: [string, boolean][] = [
    ["Excel fayl yasab ber", true],
    ["hodimlar ro'yxatini qayta yasab, yangi fayl ber", true],
    ["Excel faylni PDF qilib ber", true],
    ["shartnoma Word'da tayyor bo'lsin", true],
    ["umumiy statistikani ko'rsat", false],
    ["qaysi testlar bor", false],
    ["darsni yashir", false],
  ];
  for (const [text, expected] of intents) {
    const got = wantsFileOutput(text);
    check(`"${text}" → ${expected}`, got === expected, `natija: ${got}`);
  }

  console.log(`\n=== NATIJA: ${failed === 0 ? "BARCHASI O'TDI" : `${failed} ta xato`} ===\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("SKript xatosi:", err);
  process.exit(1);
});