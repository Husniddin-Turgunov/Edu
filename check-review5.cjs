/* Debug 5: urinish vaqtlari + test konfiguratsiyasi */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const TEST_ID = process.argv[2] || "cmudoc4hm0000jt04jdroy06m";

(async () => {
  const test = await prisma.test.findUnique({
    where: { id: TEST_ID },
    include: { questions: { include: { choices: true } }, _count: { select: { questions: true } } },
  });
  if (!test) { console.log("test not found"); await prisma.$disconnect(); return; }
  console.log("test:", {
    title: test.title,
    timeLimit: test.timeLimit,
    questionCount: test.questionCount,
    shuffleQuestions: test.shuffleQuestions,
    shuffleChoices: test.shuffleChoices,
    maxAttempts: test.maxAttempts,
    passScore: test.passScore,
    status: test.status,
    questions: test._count.questions,
  });
  const types = {};
  let withCorrect = 0;
  for (const q of test.questions) {
    types[q.type] = (types[q.type] || 0) + 1;
    if (q.choices.some((c) => c.isCorrect)) withCorrect++;
  }
  console.log("question types:", types, "| questions with a correct choice:", withCorrect);

  const rows = await prisma.$queryRawUnsafe(
    "SELECT id, userId, score, startedAt, completedAt, TIMESTAMPDIFF(SECOND, startedAt, completedAt) AS secs FROM TestResult WHERE testId=? ORDER BY startedAt DESC",
    TEST_ID
  );
  for (const r of rows) console.log(r.id, "score:", r.score, "startedAt:", r.startedAt, "completedAt:", r.completedAt, "secs:", r.secs);

  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
