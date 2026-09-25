/* Kesilgan (191 belgi) savollar matnini topadi — ma'lumot yo'qolgan, qayta tahrirlash kerak */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

(async () => {
  const rows: any[] = await p.$queryRawUnsafe(
    "SELECT id, testId, CHAR_LENGTH(text) AS len, text FROM Question WHERE CHAR_LENGTH(text) >= 191"
  );
  console.log("Kesilgan savollar:", rows.length);
  for (const r of rows) {
    console.log(`  id: ${r.id}\n  test: ${r.testId} | len: ${r.len}\n  text: ${JSON.stringify(r.text)}\n`);
  }

  const truncatedChoices: any[] = await p.$queryRawUnsafe(
    "SELECT id, questionId, CHAR_LENGTH(text) AS len FROM Choice WHERE CHAR_LENGTH(text) >= 191"
  );
  console.log("Kesilgan javob variantlari:", truncatedChoices.length);
  for (const r of truncatedChoices) console.log(`  choice ${r.id} (q=${r.questionId})`);

  const tests: any[] = await p.test.findMany({ select: { id: true, title: true } });
  console.log("Testlar:", tests.map((t) => `${t.id} = ${t.title}`).join("\n        "));

  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
