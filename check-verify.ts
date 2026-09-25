/* Verify (tsx):
 *  1) TestResult.answers endi 191+ belgili JSON ni TO'LIQ saqlaydimi (tranzaksiya rollback)
 *  2) Eski (kesilgan) qatorlardan javoblarni tiklovchi parser to'g'ri ishlayaptimi
 * Ishlatish: npx tsx check-verify.ts [testId]
 */
import { PrismaClient } from "@prisma/client";
import { parseAnswersJson } from "./src/lib/answers-json";

const prisma = new PrismaClient();
const TEST_ID = process.argv[2] || "cmudoc4hm0000jt04jdroy06m";

(async () => {
  const cols: any[] = await prisma.$queryRawUnsafe(
    "SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS WHERE TABLE_NAME='TestResult' AND COLUMN_NAME='answers'"
  );
  console.log("1) TestResult.answers column:", cols);

  const test = await prisma.test.findUnique({ where: { id: TEST_ID }, select: { id: true } });
  const user = await prisma.user.findFirst({ select: { id: true, email: true } });
  if (!test || !user) {
    console.log("test/user topilmadi");
    await prisma.$disconnect();
    return;
  }

  const qs = await prisma.question.findMany({ where: { testId: TEST_ID }, take: 30, include: { choices: true } });
  const payload: Record<string, any> = {};
  qs.forEach((q) => { payload[q.id] = q.choices[1]?.id || q.choices[0]?.id || null; });
  payload.__questionIds = qs.map((q) => q.id);
  const json = JSON.stringify(payload);
  console.log("   payload length:", json.length, "belgi (eski limit 191 edi)");

  let storedLen = 0;
  let parsedKeys = 0;
  try {
    await prisma.$transaction(async (tx) => {
      const created = await tx.testResult.create({
        data: { userId: user.id, testId: test.id, score: 0, passed: false, answers: json, completedAt: new Date() },
      });
      const [row]: any[] = await tx.$queryRawUnsafe("SELECT CHAR_LENGTH(answers) AS len FROM TestResult WHERE id = ?", created.id);
      storedLen = Number(row.len);
      const back = await tx.testResult.findUnique({ where: { id: created.id } });
      parsedKeys = Object.keys(JSON.parse(back!.answers)).length;
      throw new Error("__ROLLBACK__");
    });
  } catch (e: any) {
    if (e.message !== "__ROLLBACK__") throw e;
    console.log("   rollback OK (test natijasi yaratilmadi)");
  }
  console.log("   stored length:", storedLen, "| parsed keys:", parsedKeys);
  console.log(storedLen === json.length && parsedKeys === qs.length + 1 ? "   PASS: javoblar TO'LIQ saqlanadi" : `   FAIL: kutilgan ${json.length} / ${qs.length + 1} keys`);

  console.log("2) Eski (kesilgan) qatorlar uchun tiklash parseri:");
  const rows: any[] = await prisma.$queryRawUnsafe(
    "SELECT id, score, answers FROM TestResult WHERE testId = ? ORDER BY startedAt DESC LIMIT 3",
    TEST_ID
  );
  for (const r of rows) {
    const p = parseAnswersJson(r.answers);
    const ansKeys = Object.keys(p.answers).filter((k) => !k.startsWith("__"));
    console.log(
      `   row ${r.id} score=${r.score} | truncated: ${p.truncated} | tiklandi: ${ansKeys.length} javob | questionIds: ${Array.isArray(p.answers.__questionIds) ? p.answers.__questionIds.length : 0}`
    );
    if (ansKeys.length) {
      const q = await prisma.question.findUnique({ where: { id: ansKeys[0] } });
      const c = await prisma.choice.findUnique({ where: { id: String(p.answers[ansKeys[0]]) } });
      console.log(`      misol: "${(q?.text || "").slice(0, 60)}..." -> "${(c?.text || "").slice(0, 40)}" (choice topildi: ${!!c})`);
    }
  }
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
