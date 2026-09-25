/* Debug 4: butun TestResult jadvali bo'ylab pattern tahlili */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const stats = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*) AS total,
      SUM(answers LIKE '{"__questionIds"%') AS qids_first,
      SUM(answers LIKE '{"c%') AS answers_first,
      SUM(CHAR_LENGTH(answers) >= 191) AS truncated,
      SUM(CHAR_LENGTH(answers) BETWEEN 20 AND 60) AS short_json
    FROM TestResult
  `);
  console.log("TestResult stats:", stats[0]);

  const sample = await prisma.$queryRawUnsafe(
    "SELECT id, testId, score, CHAR_LENGTH(answers) AS len, LEFT(answers, 90) AS head FROM TestResult ORDER BY startedAt DESC LIMIT 12"
  );
  for (const r of sample) console.log(r.len, r.score, r.testId, JSON.stringify(r.head));

  const jobColumn = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*) AS total, SUM(CHAR_LENGTH(answers) >= 191) AS truncated FROM JobTestResult"
  );
  console.log("JobTestResult stats:", jobColumn[0]);

  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
