/**
 * Seed one sample employee result so /results hierarchy is clickable locally.
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
  const {
    assessments,
    assignments,
    competencies,
    employees,
    results,
  } = await import("../db/schema");
  const { ensureSchema } = await import("../db/seed");
  const { analyzeKnowledgeProfile } = await import("../lib/scoring");

  await ensureSchema();

  const [emp] = await db.select().from(employees).limit(1);
  if (!emp) {
    console.log("No employees");
    return;
  }

  let [comp] = await db
    .select()
    .from(competencies)
    .where(eq(competencies.name, "для сотрудников"))
    .limit(1);
  if (!comp) {
    [comp] = await db.select().from(competencies).limit(1);
  }
  if (!comp) {
    console.log("No competencies");
    return;
  }

  let [assessment] = await db
    .select()
    .from(assessments)
    .where(eq(assessments.title, "Демо: открытие вакансии"))
    .limit(1);

  if (!assessment) {
    [assessment] = await db
      .insert(assessments)
      .values({
        title: "Демо: открытие вакансии",
        description: "Короткий демо-тест для раздела Результаты",
        competencyId: comp.id,
        durationMinutes: 15,
        isActive: true,
      })
      .returning();
  }

  const profile = analyzeKnowledgeProfile(
    [
      {
        id: 1,
        prompt: "С кем бриф?",
        type: "single",
        correctIndex: 1,
        correctIndexesJson: "[1]",
        keywordsJson: "[]",
        optionsJson: "[]",
        weight: 1,
        section: "1. Открытие вакансии",
        knowledgeKind: "knowledge",
      },
      {
        id: 2,
        prompt: "Профиль кандидата?",
        type: "single",
        correctIndex: 1,
        correctIndexesJson: "[1]",
        keywordsJson: "[]",
        optionsJson: "[]",
        weight: 1,
        section: "1. Открытие вакансии",
        knowledgeKind: "knowledge",
      },
      {
        id: 3,
        prompt: "3 вопроса заказчику?",
        type: "text",
        correctIndex: 0,
        correctIndexesJson: "[]",
        keywordsJson: "[]",
        optionsJson: "[]",
        weight: 0,
        section: "1. Открытие вакансии",
        knowledgeKind: "knowledge",
      },
    ],
    { "1": 1, "2": 0, "3": "KPI, бюджет, must-have" },
  );

  const [asg] = await db
    .insert(assignments)
    .values({
      assessmentId: assessment!.id,
      employeeId: emp.id,
      status: "completed",
      assignedAt: new Date().toISOString(),
      dueAt: null,
    })
    .returning();

  await db.insert(results).values({
    assignmentId: asg!.id,
    employeeId: emp.id,
    assessmentId: assessment!.id,
    score: profile.overallScore,
    levelCode: profile.levelCode,
    answersJson: JSON.stringify({ "1": 1, "2": 0, "3": "KPI, бюджет, must-have" }),
    profileJson: JSON.stringify(profile),
    completedAt: new Date().toISOString(),
  });

  console.log(
    `OK sample result for ${emp.name} → /results/employees/${emp.id}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
