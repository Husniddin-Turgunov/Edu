import "server-only";
import { eq } from "drizzle-orm";
import {
  contentStorageLabel,
  contentStorageNotConfiguredMessage,
  downloadContentFile,
  isContentStorageConfigured,
  listContentExcelFiles,
} from "@/lib/content-files";
import {
  parseWorkbookTests,
  type ImportedQuestion,
  type ImportedTestPack,
  type TestAudience,
} from "@/lib/test-import";
import {
  driveContentKindFromFileName,
  type AssessmentTestKind,
} from "@/lib/drive-file-kind";
import { db } from "./index";
import {
  addQuestion,
  createAssessment,
  ensureDb,
  ensureTestAudiences,
  getCompetencyOptions,
} from "./queries";
import { assessments, questions } from "./schema";

export type DriveSyncSummary = {
  configured: boolean;
  checked: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
  message: string;
};

const KIND_LABEL: Record<AssessmentTestKind, string> = {
  candidate: "кандидатов",
  trial: "пробного периода",
  intern: "стажёров",
  level: "уровня",
};

function titleFromFileName(name: string) {
  return name.replace(/\.(xlsx|xls)$/i, "").trim() || name;
}

function drivePartId(
  fileId: string,
  kind: AssessmentTestKind,
  test: ImportedTestPack,
) {
  if (test.kind === "legacy") return `${fileId}::${kind}`;
  return `${fileId}::${kind}::${test.roleKey}`;
}

function audienceForKind(kind: AssessmentTestKind): TestAudience {
  if (kind === "candidate" || kind === "trial") return "candidates";
  if (kind === "intern") return "interns";
  return "employees";
}

function pickAudienceId(
  comps: { id: number; name: string }[],
  audience: TestAudience,
) {
  const match =
    audience === "candidates"
      ? /кандидат/
      : audience === "interns"
        ? /стаж/
        : /сотрудник/;
  return comps.find((c) => match.test(c.name.toLowerCase()))?.id ?? comps[0]?.id;
}

async function writeQuestions(
  assessmentId: number,
  importedQs: ImportedQuestion[],
) {
  await db.delete(questions).where(eq(questions.assessmentId, assessmentId));
  for (const q of importedQs) {
    await addQuestion({
      assessmentId,
      prompt: q.prompt,
      type: q.type,
      options: q.options,
      correctIndexes: q.correctIndexes,
      keywords: q.keywords,
      weight: q.weight,
      difficulty: q.difficulty,
      knowledgeKind: q.knowledgeKind,
      section: q.section,
    });
  }
}

/**
 * Pull Excel tests of one kind from Drive.
 * File name prefix selects the kind (Кандидат / Пробный / Стажёр / Уровень).
 */
export async function syncTestsFromDrive(
  kind: AssessmentTestKind = "level",
): Promise<DriveSyncSummary> {
  if (!(await isContentStorageConfigured())) {
    return {
      configured: false,
      checked: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      message: await contentStorageNotConfiguredMessage("tests"),
    };
  }

  await ensureDb();
  await ensureTestAudiences();

  const comps = await getCompetencyOptions();
  if (!comps[0]?.id) {
    return {
      configured: true,
      checked: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: ["Нет аудитории тестов"],
      message: "Сначала создайте аудитории тестов.",
    };
  }

  let files;
  try {
    files = await listContentExcelFiles();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      configured: true,
      checked: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [msg],
      message: `Не удалось прочитать папку: ${msg}`,
    };
  }

  const existing = await db
    .select({
      id: assessments.id,
      driveFileId: assessments.driveFileId,
      driveModifiedAt: assessments.driveModifiedAt,
    })
    .from(assessments);

  const byDriveId = new Map(
    existing
      .filter((r) => r.driveFileId)
      .map((r) => [r.driveFileId as string, r]),
  );

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];
  const forcedAudience = audienceForKind(kind);

  for (const file of files) {
    try {
      if (driveContentKindFromFileName(file.name) !== kind) {
        skipped += 1;
        continue;
      }
      const buffer = await downloadContentFile(file);
      const sourceLabel = await contentStorageLabel();
      const tests = parseWorkbookTests(buffer, { fileName: file.name });
      if (!tests.length) {
        errors.push(`${file.name}: нет вопросов в файле`);
        continue;
      }

      const partIds = tests.map((test) => drivePartId(file.id, kind, test));
      const allUnchanged = partIds.every((id) => {
        const prev = byDriveId.get(id);
        return prev && prev.driveModifiedAt === file.modifiedTime;
      });
      if (allUnchanged) {
        skipped += 1;
        continue;
      }

      for (const test of tests) {
        const partId = drivePartId(file.id, kind, test);
        const prev = byDriveId.get(partId);
        const competencyId =
          pickAudienceId(comps, forcedAudience) ?? comps[0].id;
        const title = test.title || titleFromFileName(file.name);
        const description = test.roleTitle
          ? `Должность: ${test.roleTitle}. Импорт из ${sourceLabel}: ${file.name}`
          : `Импорт из ${sourceLabel}: ${file.name}`;

        if (prev) {
          await db
            .update(assessments)
            .set({
              title,
              description,
              competencyId,
              source: kind,
              driveModifiedAt: file.modifiedTime,
            })
            .where(eq(assessments.id, prev.id));
          await writeQuestions(prev.id, test.questions);
          updated += 1;
        } else {
          const row = await createAssessment({
            title,
            description,
            competencyId,
            durationMinutes: 20,
            driveFileId: partId,
            driveModifiedAt: file.modifiedTime,
            source: kind,
          });
          await writeQuestions(row.id, test.questions);
          byDriveId.set(partId, {
            id: row.id,
            driveFileId: partId,
            driveModifiedAt: file.modifiedTime,
          });
          imported += 1;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${file.name}: ${msg}`);
    }
  }

  const parts = [
    `проверено ${files.length}`,
    imported ? `новых тестов ${KIND_LABEL[kind]} ${imported}` : null,
    updated ? `обновлено ${updated}` : null,
    skipped ? `пропущено/без изменений ${skipped}` : null,
    errors.length ? `ошибок ${errors.length}` : null,
  ].filter(Boolean);

  const detail =
    errors.length > 0 ? ` — ${errors.slice(0, 2).join("; ")}` : "";

  return {
    configured: true,
    checked: files.length,
    imported,
    updated,
    skipped,
    errors,
    message: (parts.join(" · ") || "Папка пуста") + detail,
  };
}
