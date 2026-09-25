/* Debug 2: answers ustuni turi va kesilgan uzunlikni aniqlash */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const TEST_ID = process.argv[2] || "cmudoc4hm0000jt04jdroy06m";

(async () => {
  const cols = await prisma.$queryRawUnsafe(
    "SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS WHERE TABLE_NAME='TestResult' AND COLUMN_NAME='answers'"
  );
  console.log("column:", cols);

  const rows = await prisma.$queryRawUnsafe(
    "SELECT id, CHAR_LENGTH(answers) AS len, LEFT(answers, 260) AS head, RIGHT(answers, 40) AS tail FROM TestResult WHERE testId = ? ORDER BY startedAt DESC LIMIT 3",
    TEST_ID
  );
  for (const r of rows) {
    console.log("-----");
    console.log("id:", r.id, "len:", r.len);
    console.log("tail:", JSON.stringify(r.tail));
    console.log("head:", JSON.stringify(r.head));
  }
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
