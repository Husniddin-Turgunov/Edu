/**
 * Import «Тест HR-рекрутера (50 вопросов)» into Turso.
 * Usage: npm run db:import-hr
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { eq } from "drizzle-orm";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

async function main() {
  const { db } = await import("../db/index");
  const { assessments, competencies, questions } = await import("../db/schema");
  const { ensureSchema } = await import("../db/seed");
  const { HR_RECRUITER_TEST } = await import("../data/hr-recruiter-test");

  await ensureSchema();

  const audiences = [
    {
      name: "для сотрудников",
      description: "Тесты, которые назначают сотрудникам компании.",
      category: "аудитория",
    },
    {
      name: "для стажёров",
      description: "Тесты для стажёров и практики.",
      category: "аудитория",
    },
    {
      name: "для кандидатов",
      description: "Тесты для кандидатов на вакансии.",
      category: "аудитория",
    },
  ] as const;

  let comps = await db.select().from(competencies);
  if (!comps.length) {
    await db.insert(competencies).values([...audiences]);
    comps = await db.select().from(competencies);
  }
  const competencyId = comps[0]!.id;

  const [existing] = await db
    .select()
    .from(assessments)
    .where(eq(assessments.title, HR_RECRUITER_TEST.title))
    .limit(1);

  let assessmentId = existing?.id;
  if (assessmentId) {
    await db.delete(questions).where(eq(questions.assessmentId, assessmentId));
    await db
      .update(assessments)
      .set({
        description: HR_RECRUITER_TEST.description,
        durationMinutes: HR_RECRUITER_TEST.durationMinutes,
        isActive: true,
      })
      .where(eq(assessments.id, assessmentId));
  } else {
    const [row] = await db
      .insert(assessments)
      .values({
        title: HR_RECRUITER_TEST.title,
        description: HR_RECRUITER_TEST.description,
        competencyId,
        durationMinutes: HR_RECRUITER_TEST.durationMinutes,
        isActive: true,
      })
      .returning();
    assessmentId = row!.id;
  }

  for (const q of HR_RECRUITER_TEST.questions) {
    const correctIndexes =
      q.type === "single" && typeof q.correctIndex === "number"
        ? [q.correctIndex]
        : [];
    await db.insert(questions).values({
      assessmentId,
      prompt: q.prompt,
      type: q.type,
      optionsJson: JSON.stringify(q.options ?? []),
      correctIndex: correctIndexes[0] ?? 0,
      correctIndexesJson: JSON.stringify(correctIndexes),
      keywordsJson: JSON.stringify(q.keywords ?? []),
      weight: q.weight,
      difficulty: "junior",
      knowledgeKind: q.knowledgeKind,
      section: q.section,
    });
  }

  console.log(
    `OK: assessment id=${assessmentId} «${HR_RECRUITER_TEST.title}» — ${HR_RECRUITER_TEST.questions.length} вопросов`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
