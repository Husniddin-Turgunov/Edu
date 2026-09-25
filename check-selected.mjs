import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const testId = "cmudoc4hm0000jt04jdroy06m";
try {
  const test = await prisma.test.findUnique({ where: { id: testId }, include: { questions: { include: { choices: true } } } });
  console.log("TEST", test?.title, "questions", test?.questions?.length);
  test?.questions?.slice(0,2).forEach(q=>{
    console.log(" Q", q.id, q.text.slice(0,60));
    q.choices.forEach(c=> console.log("   C", c.id, c.text.slice(0,40), "isCorrect", c.isCorrect, "order", c.order));
  });
  const results = await prisma.testResult.findMany({ where: { testId }, orderBy: { startedAt: "desc" }, take: 3 });
  console.log("RESULTS", results.length);
  results.forEach(r=>{
    console.log(" R", r.id, "user", r.userId, "score", r.score, "answers", r.answers.slice(0,300));
    try { console.log("  parsed", JSON.parse(r.answers)); } catch(e){ console.log("  parse err", e.message); }
  });
  // check one result detail
  if(results[0]){
    const r = results[0];
    const parsed = JSON.parse(r.answers||"{}");
    console.log("FIRST parsed keys", Object.keys(parsed));
    for(const [qid, val] of Object.entries(parsed)){
      const q = test?.questions.find(x=>x.id===qid);
      console.log("  qid", qid, "val", val, "foundQ", !!q);
      if(q){
        const choice = q.choices.find(c=>c.id===val);
        console.log("    choice found", !!choice, choice?.text?.slice(0,40), "isCorrect", choice?.isCorrect);
        const correct = q.choices.filter(c=>c.isCorrect).map(c=>c.id);
        console.log("    correctIds", correct);
      }
    }
  }
} catch(e){ console.error("ERR", e); }
await prisma.$disconnect();
