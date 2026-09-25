/**
 * One-off: import Готовые_уроки_для_стажеров_5_дней.xlsx into learning_lessons.
 *
 *   npx tsx src/scripts/import-local-lessons.ts [path-to-xlsx]
 */
import { createRequire } from "module";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { eq } from "drizzle-orm";

const require = createRequire(import.meta.url);
require.cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
} as NodeModule;

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
  const {
    looksLikeLessonPlanWorkbook,
    parseWorkbookLessons,
  } = await import("../lib/lesson-plan-import");
  const { db } = await import("../db/index");
  const { ensureDb } = await import("../db/queries");
  const { learningLessons } = await import("../db/schema");
  const { ensureLinkedTestForLesson } = await import("../db/learning");

  const filePath =
    process.argv[2] ||
    "/Users/habibullaevnurbek/Downloads/Готовые_уроки_для_стажеров_5_дней.xlsx";
  const fileName = filePath.split("/").pop() || "lessons.xlsx";
  const driveFileId = "local::готовые-уроки-стажеров-5-дней";
  const modifiedAt = new Date().toISOString();

  await ensureDb();
  const buf = readFileSync(filePath);
  if (!looksLikeLessonPlanWorkbook(buf, fileName)) {
    throw new Error(`Файл не распознан как учебник/план уроков: ${fileName}`);
  }

  const plans = parseWorkbookLessons(buf, { fileName });
  const existing = await db.select().from(learningLessons);
  let imported = 0;
  let updated = 0;
  let tests = 0;

  for (const plan of plans) {
    const partId = `${driveFileId}::${plan.roleKey}::day${plan.dayNumber}`;
    const current = existing.find((row) => row.driveFileId === partId);
    const now = new Date().toISOString();
    let row;

    if (current) {
      [row] = await db
        .update(learningLessons)
        .set({
          title: plan.title,
          summary: plan.summary,
          content: plan.contentHtml,
          contentFormat: "html",
          durationMin: plan.durationMin,
          roleFamiliesJson: JSON.stringify([plan.roleTitle]),
          topicsJson: JSON.stringify(plan.topics),
          sortOrder: plan.sortOrder,
          driveModifiedAt: modifiedAt,
          isActive: true,
        })
        .where(eq(learningLessons.id, current.id))
        .returning();
      updated += 1;
    } else {
      let slug = plan.slug;
      if (existing.some((r) => r.slug === slug)) {
        slug = `${slug}-${partId.replace(/[^a-z0-9]+/gi, "").slice(-6)}`;
      }
      [row] = await db
        .insert(learningLessons)
        .values({
          slug,
          title: plan.title,
          summary: plan.summary,
          content: plan.contentHtml,
          contentFormat: "html",
          level: "all",
          roleFamiliesJson: JSON.stringify([plan.roleTitle]),
          topicsJson: JSON.stringify(plan.topics),
          durationMin: plan.durationMin,
          isActive: true,
          sortOrder: plan.sortOrder,
          driveFileId: partId,
          driveModifiedAt: modifiedAt,
          createdAt: now,
        })
        .returning();
      existing.push(row);
      imported += 1;
    }

    const linked = await ensureLinkedTestForLesson(row);
    if (linked.created) tests += 1;
  }

  console.log(
    JSON.stringify({ fileName, total: plans.length, imported, updated, tests }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
