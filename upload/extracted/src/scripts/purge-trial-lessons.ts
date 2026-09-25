/**
 * One-off: remove lessons imported from «Пробный период» (trial task packs).
 *
 *   npx tsx src/scripts/purge-trial-lessons.ts [--apply]
 *
 * Without --apply the script only prints what would be deleted.
 */
import { createRequire } from "module";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { inArray, like } from "drizzle-orm";

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
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

async function main() {
  const apply = process.argv.includes("--apply");
  const { db } = await import("../db/index");
  const { ensureDb } = await import("../db/queries");
  const {
    internContentAssignments,
    internStandardItems,
    learningLessons,
    learningTests,
    lessonProgress,
  } = await import("../db/schema");

  await ensureDb();

  const lessons = await db
    .select()
    .from(learningLessons)
    .where(like(learningLessons.slug, "%-trial-day-%"));

  if (!lessons.length) {
    console.log("Ничего не найдено: уроков из «Пробного периода» нет.");
    return;
  }

  const lessonIds = lessons.map((row) => row.id);
  const tests = await db
    .select()
    .from(learningTests)
    .where(inArray(learningTests.lessonId, lessonIds));
  const testIds = tests.map((row) => row.id);

  console.log(`Уроков к удалению: ${lessons.length}`);
  for (const row of lessons.slice(0, 5)) {
    console.log(`  - [${row.id}] ${row.slug} · ${row.title}`);
  }
  if (lessons.length > 5) console.log(`  … и ещё ${lessons.length - 5}`);
  console.log(`Связанных проверочных тестов: ${tests.length}`);

  if (!apply) {
    console.log("\nЗапуск без --apply: ничего не изменено.");
    return;
  }

  await db
    .delete(lessonProgress)
    .where(inArray(lessonProgress.lessonId, lessonIds));
  await db
    .delete(internStandardItems)
    .where(inArray(internStandardItems.lessonId, lessonIds));
  await db
    .delete(internContentAssignments)
    .where(inArray(internContentAssignments.lessonId, lessonIds));
  if (testIds.length) {
    await db
      .delete(internStandardItems)
      .where(inArray(internStandardItems.testId, testIds));
    await db
      .delete(internContentAssignments)
      .where(inArray(internContentAssignments.testId, testIds));
    await db.delete(learningTests).where(inArray(learningTests.id, testIds));
  }
  await db.delete(learningLessons).where(inArray(learningLessons.id, lessonIds));

  console.log(
    `\nУдалено: уроков ${lessons.length}, проверочных тестов ${tests.length}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
