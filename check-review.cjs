/* Debug: TestResult.answers tarkibini tekshirish (read-only) */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TEST_ID = process.argv[2] || "cmudoc4hm0000jt04jdroy06m";

(async () => {
  const results = await prisma.testResult.findMany({
    where: { testId: TEST_ID, completedAt: { not: null } },
    orderBy: { startedAt: "desc" },
    take: 5,
    include: { user: { select: { email: true, name: true, surname: true } } },
  });
  console.log("results:", results.length);
  for (const r of results) {
    console.log("-----");
    console.log("id:", r.id, "| score:", r.score, "| user:", r.user?.email);
    let answers = {};
    try { answers = JSON.parse(r.answers || "{}"); } catch (e) { console.log("PARSE FAIL", e.message); }
    const keys = Object.keys(answers);
    console.log("answer keys:", keys);
    console.log("sample values:", keys.slice(0, 6).map((k) => `${k} => ${JSON.stringify(answers[k])}`));
    const qids = Array.isArray(answers.__questionIds) ? answers.__questionIds : null;
    console.log("__questionIds:", qids ? qids.length : null);
    if (qids && qids.length) {
      const overlap = qids.filter((q) => keys.includes(String(q)));
      console.log("__questionIds fully covered by answer keys:", overlap.length, "/", qids.length);
      console.log("first __questionIds:", qids.slice(0, 3));
      console.log("first answer keys:", keys.filter((k) => !k.startsWith("__")).slice(0, 3));
    }
  }
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
