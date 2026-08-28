/**
 * Remove «Тест HR-рекрутера (50 вопросов)» from DB.
 * Usage: npx tsx src/scripts/remove-hr-test.ts
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
    questions,
    assignments,
    results,
    candidateAssignments,
    candidateResults,
  } = await import("../db/schema");

  const TITLE = "Тест HR-рекрутера (50 вопросов)";
  const rows = await db
    .select()
    .from(assessments)
    .where(eq(assessments.title, TITLE));

  for (const a of rows) {
    await db.delete(results).where(eq(results.assessmentId, a.id));
    await db
      .delete(candidateResults)
      .where(eq(candidateResults.assessmentId, a.id));
    await db.delete(assignments).where(eq(assignments.assessmentId, a.id));
    await db
      .delete(candidateAssignments)
      .where(eq(candidateAssignments.assessmentId, a.id));
    await db.delete(questions).where(eq(questions.assessmentId, a.id));
    await db.delete(assessments).where(eq(assessments.id, a.id));
    console.log(`deleted assessment id=${a.id}`);
  }
  if (!rows.length) console.log("HR test not found");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
