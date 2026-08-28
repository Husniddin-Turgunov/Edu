import "server-only";
import { eq } from "drizzle-orm";
import {
  contentStorageNotConfiguredMessage,
  downloadContentFile,
  isLessonsContentConfigured,
  listContentLessonSourceFiles,
} from "@/lib/content-files";
import type { DriveFile } from "@/lib/google-drive";
import { driveContentKindFromFileName } from "@/lib/drive-file-kind";
import {
  parseDocxLesson,
} from "@/lib/lesson-import";
import {
  looksLikeLessonPlanWorkbook,
  parseWorkbookLessons,
  type ImportedLessonPlan,
} from "@/lib/lesson-plan-import";
import { db } from "./index";
import {
  ensureAllLessonTests,
  ensureLinkedTestForLesson,
  ensureLinkedTestsForLessons,
} from "./learning";
import { ensureDb } from "./queries";
import { learningLessons } from "./schema";

export type LessonDriveSyncSummary = {
  configured: boolean;
  checked: number;
  imported: number;
  updated: number;
  skipped: number;
  deactivated: number;
  testsCreated: number;
  lessonsWithoutTest: number;
  errors: string[];
  message: string;
};

function looksLikeExcelName(file: DriveFile) {
  return (
    /\.(xlsx|xls)$/i.test(file.name) ||
    file.mimeType.includes("spreadsheet") ||
    file.mimeType.includes("excel")
  );
}

function lessonPartId(fileId: string, lesson: ImportedLessonPlan) {
  return `${fileId}::${lesson.roleKey}::day${lesson.dayNumber}`;
}

type LessonRow = typeof learningLessons.$inferSelect;

/** In-memory view of learning_lessons so imports avoid a query per row. */
type LessonIndex = {
  byDriveFileId: Map<string, LessonRow>;
  bySlug: Map<string, LessonRow>;
};

function buildLessonIndex(rows: LessonRow[]): LessonIndex {
  const byDriveFileId = new Map<string, LessonRow>();
  const bySlug = new Map<string, LessonRow>();
  for (const row of rows) {
    if (row.driveFileId) byDriveFileId.set(row.driveFileId, row);
    bySlug.set(row.slug, row);
  }
  return { byDriveFileId, bySlug };
}

function rememberLesson(index: LessonIndex, row: LessonRow) {
  if (row.driveFileId) index.byDriveFileId.set(row.driveFileId, row);
  index.bySlug.set(row.slug, row);
}

async function upsertLessonRow(input: {
  drivePartId: string;
  driveModifiedAt: string;
  title: string;
  summary: string;
  contentHtml: string;
  slug: string;
  durationMin: number;
  roleFamilies: string[];
  topics: string[];
  sortOrder: number;
  level?: string;
  programMonth?: number;
  goal?: string;
  material?: string;
  instruction?: string;
  practice?: string;
  criteria?: string;
}) {
  const existing = await db.select().from(learningLessons);
  const current =
    existing.find((row) => row.driveFileId === input.drivePartId) ??
    existing.find((row) => row.slug === input.slug);
  const now = new Date().toISOString();
  const structured = {
    programMonth: input.programMonth ?? 0,
    goal: input.goal ?? "",
    material: input.material ?? "",
    instruction: input.instruction ?? "",
    practice: input.practice ?? "",
    criteria: input.criteria ?? "",
  };

  if (current) {
    const [row] = await db
      .update(learningLessons)
      .set({
        title: input.title,
        summary: input.summary,
        content: input.contentHtml,
        contentFormat: "html",
        durationMin: input.durationMin,
        roleFamiliesJson: JSON.stringify(input.roleFamilies),
        topicsJson: JSON.stringify(input.topics),
        sortOrder: input.sortOrder,
        level: input.level ?? current.level,
        driveFileId: input.drivePartId,
        driveModifiedAt: input.driveModifiedAt,
        isActive: true,
        ...structured,
      })
      .where(eq(learningLessons.id, current.id))
      .returning();
    return { row, created: false as const };
  }

  let slug = input.slug;
  const [slugClash] = await db
    .select({ id: learningLessons.id })
    .from(learningLessons)
    .where(eq(learningLessons.slug, slug))
    .limit(1);
  if (slugClash) {
    slug = `${slug}-${input.drivePartId.replace(/[^a-z0-9]+/gi, "").slice(-6)}`;
  }

  const [row] = await db
    .insert(learningLessons)
    .values({
      slug,
      title: input.title,
      summary: input.summary,
      content: input.contentHtml,
      contentFormat: "html",
      level: input.level ?? "all",
      roleFamiliesJson: JSON.stringify(input.roleFamilies),
      topicsJson: JSON.stringify(input.topics),
      durationMin: input.durationMin,
      isActive: true,
      sortOrder: input.sortOrder,
      driveFileId: input.drivePartId,
      driveModifiedAt: input.driveModifiedAt,
      createdAt: now,
      ...structured,
    })
    .returning();
  return { row, created: true as const };
}

type LessonPlanInput = {
  drivePartId: string;
  driveModifiedAt: string;
  title: string;
  summary: string;
  contentHtml: string;
  slug: string;
  durationMin: number;
  roleFamilies: string[];
  topics: string[];
  sortOrder: number;
  level: string;
  programMonth?: number;
  goal?: string;
  material?: string;
  instruction?: string;
  practice?: string;
  criteria?: string;
};

/**
 * Upsert a whole workbook at once. Large staffing workbooks produce hundreds of
 * lessons, so inserts are chunked and lookups come from a preloaded index.
 */
async function upsertLessonRows(inputs: LessonPlanInput[], index: LessonIndex) {
  const rows: LessonRow[] = [];
  const pending: (typeof learningLessons.$inferInsert)[] = [];
  const now = new Date().toISOString();
  let imported = 0;
  let updated = 0;

  for (const input of inputs) {
    const current =
      index.byDriveFileId.get(input.drivePartId) ?? index.bySlug.get(input.slug);

    if (current) {
      const [row] = await db
        .update(learningLessons)
        .set({
          title: input.title,
          summary: input.summary,
          content: input.contentHtml,
          contentFormat: "html",
          durationMin: input.durationMin,
          roleFamiliesJson: JSON.stringify(input.roleFamilies),
          topicsJson: JSON.stringify(input.topics),
          sortOrder: input.sortOrder,
          level: input.level,
          driveFileId: input.drivePartId,
          driveModifiedAt: input.driveModifiedAt,
          isActive: true,
          programMonth: input.programMonth ?? 0,
          goal: input.goal ?? "",
          material: input.material ?? "",
          instruction: input.instruction ?? "",
          practice: input.practice ?? "",
          criteria: input.criteria ?? "",
        })
        .where(eq(learningLessons.id, current.id))
        .returning();
      rememberLesson(index, row);
      rows.push(row);
      updated += 1;
      continue;
    }

    const slug = index.bySlug.has(input.slug)
      ? `${input.slug}-${input.drivePartId.replace(/[^a-z0-9]+/gi, "").slice(-6)}`
      : input.slug;
    index.bySlug.set(slug, { id: -1, slug } as LessonRow);

    pending.push({
      slug,
      title: input.title,
      summary: input.summary,
      content: input.contentHtml,
      contentFormat: "html",
      level: input.level,
      roleFamiliesJson: JSON.stringify(input.roleFamilies),
      topicsJson: JSON.stringify(input.topics),
      durationMin: input.durationMin,
      isActive: true,
      sortOrder: input.sortOrder,
      driveFileId: input.drivePartId,
      driveModifiedAt: input.driveModifiedAt,
      createdAt: now,
      programMonth: input.programMonth ?? 0,
      goal: input.goal ?? "",
      material: input.material ?? "",
      instruction: input.instruction ?? "",
      practice: input.practice ?? "",
      criteria: input.criteria ?? "",
    });
  }

  for (let i = 0; i < pending.length; i += 100) {
    const inserted = await db
      .insert(learningLessons)
      .values(pending.slice(i, i + 100))
      .returning();
    for (const row of inserted) rememberLesson(index, row);
    rows.push(...inserted);
    imported += inserted.length;
  }

  return { rows, imported, updated };
}

/**
 * Pull Word / Google Docs and Excel lesson plans from Drive into learning_lessons.
 * Excel: one sheet per role × one row per day → separate lessons with role assigned.
 */
export async function syncLessonsFromDrive(): Promise<LessonDriveSyncSummary> {
  if (!(await isLessonsContentConfigured())) {
    return {
      configured: false,
      checked: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      deactivated: 0,
      testsCreated: 0,
      lessonsWithoutTest: 0,
      errors: [],
      message: await contentStorageNotConfiguredMessage("lessons"),
    };
  }

  await ensureDb();

  let files: DriveFile[];
  try {
    files = await listContentLessonSourceFiles();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      configured: true,
      checked: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      deactivated: 0,
      testsCreated: 0,
      lessonsWithoutTest: 0,
      errors: [msg],
      message: `Ошибка чтения папки: ${msg}`,
    };
  }

  const existing = await db.select().from(learningLessons);
  const byDriveId = new Map(
    existing
      .filter((row) => row.driveFileId)
      .map((row) => [row.driveFileId as string, row]),
  );
  const lessonIndex = buildLessonIndex(existing);

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let testsCreated = 0;
  let deferredTests = 0;
  const errors: string[] = [];
  const ignoredExcel: string[] = [];
  const seenIds = new Set<string>();
  const seenRowIds = new Set<number>();

  for (const file of files) {
    try {
      const kind = driveContentKindFromFileName(file.name);
      if (kind !== "lesson") {
        if (looksLikeExcelName(file)) ignoredExcel.push(file.name);
        continue;
      }

      if (looksLikeExcelName(file)) {
        const related = existing.filter((row) =>
          Boolean(
            row.driveFileId === file.id ||
              row.driveFileId?.startsWith(`${file.id}::`),
          ),
        );
        if (
          related.length > 0 &&
          related.every((row) => row.driveModifiedAt === file.modifiedTime)
        ) {
          for (const row of related) {
            if (row.driveFileId) seenIds.add(row.driveFileId);
            seenRowIds.add(row.id);
          }
          const linked = await ensureLinkedTestsForLessons(related);
          testsCreated += linked.created;
          skipped += 1;
          continue;
        }

        const buffer = await downloadContentFile(file);
        if (!looksLikeLessonPlanWorkbook(buffer, file.name)) {
          errors.push(
            `${file.name}: имя начинается с «Урок», но внутри нет плана уроков`,
          );
          continue;
        }

        const plans = parseWorkbookLessons(buffer, { fileName: file.name });
        const inputs = plans.map((plan) => {
          const partId = lessonPartId(file.id, plan);
          seenIds.add(partId);
          return {
            drivePartId: partId,
            driveModifiedAt: file.modifiedTime,
            title: plan.title,
            summary: plan.summary,
            contentHtml: plan.contentHtml,
            slug: plan.slug,
            durationMin: plan.durationMin,
            roleFamilies: [plan.roleTitle],
            topics: plan.topics,
            sortOrder: plan.sortOrder,
            level: "all",
            programMonth: plan.programMonth ?? 0,
            goal: plan.goal ?? "",
            material: plan.material ?? "",
            instruction: plan.instruction ?? "",
            practice: plan.practice ?? "",
            criteria: plan.criteria ?? "",
          };
        });
        const result = await upsertLessonRows(inputs, lessonIndex);
        for (const row of result.rows) seenRowIds.add(row.id);
        imported += result.imported;
        updated += result.updated;
        // Large programs (Junior→Middle ≈ 6000 lessons) would time out if
        // verification tests are created in the same request.
        if (result.rows.length > 200) {
          deferredTests += result.rows.length;
        } else {
          const linkedTests = await ensureLinkedTestsForLessons(result.rows);
          testsCreated += linkedTests.created;
        }
        continue;
      }

      // Word / Google Doc → one lesson (name must start with «Урок»)
      seenIds.add(file.id);
      const current = byDriveId.get(file.id);
      if (current && current.driveModifiedAt === file.modifiedTime) {
        skipped += 1;
        seenRowIds.add(current.id);
        const linked = await ensureLinkedTestForLesson(current);
        if (linked.created) testsCreated += 1;
        continue;
      }

      const buffer = await downloadContentFile(file);
      const parsed = await parseDocxLesson(buffer, file.name);
      const result = await upsertLessonRow({
        drivePartId: file.id,
        driveModifiedAt: file.modifiedTime,
        title: parsed.title,
        summary: parsed.summary,
        contentHtml: parsed.contentHtml,
        slug: parsed.slug,
        durationMin: parsed.durationMin,
        roleFamilies: current
          ? (JSON.parse(current.roleFamiliesJson || "[]") as string[])
          : [],
        topics: current
          ? (JSON.parse(current.topicsJson || "[]") as string[])
          : [],
        sortOrder: current?.sortOrder ?? 999,
        level: current?.level ?? "all",
      });
      seenRowIds.add(result.row.id);
      const linked = await ensureLinkedTestForLesson(result.row);
      if (linked.created) testsCreated += 1;
      if (result.created) imported += 1;
      else updated += 1;
    } catch (e) {
      errors.push(
        `${file.name}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  let deactivated = 0;
  // A malformed/re-uploaded file must never empty the whole library.
  if (errors.length === 0) {
    for (const row of existing) {
      if (!row.driveFileId) continue;
      if (seenIds.has(row.driveFileId) || seenRowIds.has(row.id)) continue;
      if (!row.isActive) continue;
      await db
        .update(learningLessons)
        .set({ isActive: false })
        .where(eq(learningLessons.id, row.id));
      deactivated += 1;
    }
  }

  const backlog =
    deferredTests > 0
      ? { created: 0, stillMissing: deferredTests }
      : await ensureAllLessonTests();
  testsCreated += backlog.created;

  const message = [
    `Проверено файлов: ${files.length}.`,
    imported ? `Новых уроков: ${imported}.` : null,
    updated ? `Обновлено: ${updated}.` : null,
    skipped ? `Без изменений: ${skipped}.` : null,
    testsCreated ? `Создано тестов: ${testsCreated}.` : null,
    deferredTests
      ? `Тесты для ${deferredTests} ур. создайте кнопкой «Создать недостающие тесты» (большой файл).`
      : null,
    ignoredExcel.length
      ? `Не уроки (пропущены): ${ignoredExcel.join(", ")}.`
      : null,
    backlog.stillMissing && !deferredTests
      ? `Внимание: нет теста у ${backlog.stillMissing} ур.`
      : null,
    deactivated ? `Снято с публикации: ${deactivated}.` : null,
    errors.length
      ? `Ошибок: ${errors.length}. ${errors.slice(0, 3).join(" | ")}`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    configured: true,
    checked: files.length,
    imported,
    updated,
    skipped,
    deactivated,
    testsCreated,
    lessonsWithoutTest: backlog.stillMissing,
    errors,
    message:
      message ||
      "Нет Word/Excel планов уроков в папке lessons/.",
  };
}
