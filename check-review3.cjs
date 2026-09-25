/* Debug 3: to'liq diagnostika — versiya, kesilgan qatorlar soni, xom JSON */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const TEST_ID = process.argv[2] || "cmudoc4hm0000jt04jdroy06m";

(async () => {
  const [ver] = await prisma.$queryRawUnsafe("SELECT VERSION() AS v");
  console.log("mysql version:", ver.v);

  const migCount = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_NAME='_prisma_migrations'"
  );
  console.log("_prisma_migrations exists:", migCount[0].c);

  const totals = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*) AS total, SUM(CHAR_LENGTH(answers)=191) AS truncated, SUM(CHAR_LENGTH(answers)<191) AS ok FROM TestResult"
  );
  console.log("TestResult:", totals[0]);

  const assigned = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*) AS total, SUM(CHAR_LENGTH(assignedUserIds)=191) AS truncated FROM Test WHERE visibility='selected'"
  );
  console.log("Test.assignedUserIds (selected):", assigned[0]);

  const jobAns = await prisma.$queryRawUnsafe(
    "SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS WHERE TABLE_NAME='JobTestResult' AND COLUMN_NAME='answers'"
  );
  console.log("JobTestResult.answers:", jobAns);

  const rows = await prisma.$queryRawUnsafe(
    "SELECT id, score, completedAt, answers FROM TestResult WHERE testId=? ORDER BY startedAt DESC LIMIT 3",
    TEST_ID
  );
  for (const r of rows) {
    console.log("=====");
    console.log(r.id, r.score, r.completedAt);
    console.log("raw:", r.answers);
  }
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
