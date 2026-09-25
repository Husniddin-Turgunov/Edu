import "server-only";
import { eq } from "drizzle-orm";
import {
  contentStorageNotConfiguredMessage,
  downloadContentFile,
  isContentStorageConfigured,
  listContentAttestationExcelFiles,
} from "@/lib/content-files";
import { driveContentKindFromFileName } from "@/lib/drive-file-kind";
import { nextAttestationAt } from "@/lib/attestation";
import { staffRoleBase } from "@/lib/role-match";
import {
  parseWorkbookTests,
  type ImportedQuestion,
  type ImportedTestPack,
} from "@/lib/test-import";
import { db } from "./index";
import {
  addQuestion,
  createAssessment,
  ensureDb,
  ensureTestAudiences,
  getCompetencyOptions,
  getStaffingPositions,
} from "./queries";
import { assessments, attestations, questions } from "./schema";
import type { DriveSyncSummary } from "./sync-drive";

function drivePartId(fileId: string, pack: ImportedTestPack) {
  if (pack.kind === "legacy") return fileId;
  return `${fileId}::attestation::${pack.roleKey}`;
}

async function writeQuestions(
  assessmentId: number,
  imported: ImportedQuestion[],
) {
  await db.delete(questions).where(eq(questions.assessmentId, assessmentId));
  for (const question of imported) {
    await addQuestion({
      assessmentId,
      prompt: question.prompt,
      type: question.type,
      options: question.options,
      correctIndexes: question.correctIndexes,
      keywords: question.keywords,
      weight: question.weight,
      difficulty: question.difficulty,
      knowledgeKind: question.knowledgeKind,
      section: question.section,
    });
  }
}

/**
 * Imports only Excel files beginning with «Аттестация».
 * New rows are drafts so Drive sync never publishes an assessment window.
 */
export async function syncAttestationsFromDrive(): Promise<DriveSyncSummary> {
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

  const [competencies, positions] = await Promise.all([
    getCompetencyOptions(),
    getStaffingPositions(),
  ]);
  const competencyId =
    competencies.find((item) => /сотрудник/i.test(item.name))?.id ??
    competencies[0]?.id;
  if (!competencyId) {
    return {
      configured: true,
      checked: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: ["Нет аудитории сотрудников"],
      message: "Сначала создайте аудиторию сотрудников.",
    };
  }

  let files;
  try {
    files = await listContentAttestationExcelFiles();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      configured: true,
      checked: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [message],
      message: `Не удалось прочитать папку: ${message}`,
    };
  }

  const existingAssessments = await db
    .select({
      id: assessments.id,
      driveFileId: assessments.driveFileId,
      driveModifiedAt: assessments.driveModifiedAt,
    })
    .from(assessments);
  const existingAttestations = await db
    .select({ id: attestations.id, assessmentId: attestations.assessmentId })
    .from(attestations);
  const byDriveId = new Map(
    existingAssessments
      .filter((row) => row.driveFileId)
      .map((row) => [row.driveFileId as string, row]),
  );
  const attestationByAssessment = new Map(
    existingAttestations
      .filter((row) => row.assessmentId)
      .map((row) => [row.assessmentId as number, row]),
  );

  const staffingByRole = new Map<
    string,
    { role: string; department: string }
  >();
  for (const position of positions) {
    const role = staffRoleBase(position.role).trim();
    if (!role) continue;
    const key = role.toLowerCase();
    if (!staffingByRole.has(key)) {
      staffingByRole.set(key, {
        role,
        department: position.department,
      });
    }
  }

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const file of files) {
    if (driveContentKindFromFileName(file.name) !== "attestation") {
      skipped += 1;
      continue;
    }

    try {
      const buffer = await downloadContentFile(file);
      const packs = parseWorkbookTests(buffer, { fileName: file.name });
      if (!packs.length) {
        errors.push(`${file.name}: нет вопросов в файле`);
        continue;
      }

      for (const pack of packs) {
        const partId = drivePartId(file.id, pack);
        const previous = byDriveId.get(partId);
        if (previous?.driveModifiedAt === file.modifiedTime) {
          skipped += 1;
          continue;
        }

        const title = pack.title || file.name.replace(/\.(xlsx|xls)$/i, "");
        const roleKey = staffRoleBase(pack.roleTitle || "").toLowerCase();
        const staffing = roleKey ? staffingByRole.get(roleKey) : undefined;
        const description = pack.roleTitle
          ? `Должность: ${pack.roleTitle}. Импорт аттестации из Google Drive: ${file.name}`
          : `Импорт аттестации из Google Drive: ${file.name}`;

        let assessmentId: number;
        if (previous) {
          assessmentId = previous.id;
          await db
            .update(assessments)
            .set({
              title,
              description,
              competencyId,
              source: "attestation",
              driveModifiedAt: file.modifiedTime,
            })
            .where(eq(assessments.id, assessmentId));
          await writeQuestions(assessmentId, pack.questions);

          const linked = attestationByAssessment.get(assessmentId);
          if (linked) {
            await db
              .update(attestations)
              .set({
                title,
                description,
                updatedAt: new Date().toISOString(),
              })
              .where(eq(attestations.id, linked.id));
          }
          updated += 1;
          continue;
        }

        const assessment = await createAssessment({
          title,
          description,
          competencyId,
          durationMinutes: 40,
          driveFileId: partId,
          driveModifiedAt: file.modifiedTime,
          source: "attestation",
        });
        assessmentId = assessment.id;
        await writeQuestions(assessmentId, pack.questions);

        const starts = nextAttestationAt();
        const ends = new Date(starts.getTime() + 14 * 86400000);
        const [attestation] = await db
          .insert(attestations)
          .values({
            title,
            description,
            department: staffing?.department ?? "",
            positionTitlesJson: JSON.stringify(
              staffing ? [staffing.role] : pack.roleTitle ? [pack.roleTitle] : [],
            ),
            scheduledAt: starts.toISOString(),
            startsAt: starts.toISOString(),
            endsAt: ends.toISOString(),
            durationMinutes: 40,
            passingScore: 70,
            assessmentId,
            isActive: false,
            updatedAt: new Date().toISOString(),
          })
          .returning();

        byDriveId.set(partId, {
          id: assessmentId,
          driveFileId: partId,
          driveModifiedAt: file.modifiedTime,
        });
        if (attestation) {
          attestationByAssessment.set(assessmentId, {
            id: attestation.id,
            assessmentId,
          });
        }
        imported += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${file.name}: ${message}`);
    }
  }

  const parts = [
    `проверено ${files.length}`,
    imported ? `новых аттестаций ${imported}` : null,
    updated ? `обновлено ${updated}` : null,
    skipped ? `пропущено/без изменений ${skipped}` : null,
    errors.length ? `ошибок ${errors.length}` : null,
  ].filter(Boolean);
  const detail = errors.length ? ` — ${errors.slice(0, 2).join("; ")}` : "";

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
