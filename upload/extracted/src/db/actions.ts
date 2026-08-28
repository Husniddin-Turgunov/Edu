"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, inArray, ne } from "drizzle-orm";
import {
  addQuestion,
  assignAssessment,
  assignCandidateAssessment,
  autoAssignCandidateTest,
  createAssessment,
  createCandidate,
  createEmployee,
  deleteQuestion,
  getCandidates,
  getCompetencyOptions,
  getEmployeeById,
  getEmployees,
  getPlatformUserByLogin,
  getPlatformUserById,
  updatePlatformUserProfile,
  hireInternIntoPosition,
  assignExistingEmployeePosition,
  dismissStaffingPosition,
  moveCandidateToInternship,
  createInternFromCandidate,
  setCandidatePortalCredentials,
  setCandidateStatus,
  updateCandidateProfile,
  appendCandidateEvent,
  createInterview,
  setInterviewConfirmStatus,
  saveInterviewEvaluation,
  submitAssessment,
  submitCandidateAssessment,
  upsertParticipantUserForCandidate,
  upsertParticipantUserForEmployee,
  createObserverUser,
  createManagerUser,
  createAdminUser,
  authenticatePlatformUser,
  updateAssessment,
  updateQuestion,
  upsertRoleHomePage,
  advanceInternOnboarding,
  upsertVisualContentPage,
  setPreferredLocale,
} from "./queries";
import { db } from "./index";
import {
  assessments,
  assignments,
  candidateAssignments,
  candidateResults,
  questions,
  results,
} from "./schema";
import { syncFromGoogleSheets, pushResultToGoogleSheets } from "@/lib/google-sheets";
import { isContentStorageConfigured } from "@/lib/content-files";
import type { AnswerValue } from "@/lib/scoring";
import { parseWorkbookTests, type TestAudience } from "@/lib/test-import";
import { syncTestsFromDrive } from "./sync-drive";
import {
  clearSession,
  generatePassword,
  hashPassword,
  homePathForRole,
  getSession,
  setSession,
  suggestLogin,
  verifyPassword,
} from "@/lib/auth";
import {
  clearTerminalSession,
  getTerminalSession,
  setTerminalSession,
} from "@/lib/terminal";
import {
  completeTerminalAttempt,
  confirmTerminalIdentity,
  enqueueCandidateToTerminal,
  getTerminalAttemptClock,
  removeCandidateFromTerminalQueue,
  validateTerminalAssignment,
} from "./terminal";
import {
  isRoleHomeAudience,
  roleHomeDocumentSchema,
} from "@/lib/role-home";

export async function syncDriveTestsAction(kind?: string) {
  await requireAdminSession();
  const {
    isAssessmentTestKind,
  } = await import("@/lib/drive-file-kind");
  const resolved =
    typeof kind === "string" && isAssessmentTestKind(kind) ? kind : "level";
  const summary = await syncTestsFromDrive(resolved);
  revalidatePath("/assessments");
  revalidatePath(`/assessments/kind/${resolved}`);
  revalidatePath("/");
  return summary;
}

export async function syncDriveAttestationsAction() {
  await requireAdminSession();
  const { syncAttestationsFromDrive } = await import(
    "./sync-drive-attestations"
  );
  const summary = await syncAttestationsFromDrive();
  revalidatePath("/attestation");
  return summary;
}

export async function getDriveConfigAction() {
  return { configured: await isContentStorageConfigured() };
}

export async function clearAssessmentsLibraryAction(formData?: FormData) {
  await requireAdminSession();
  const {
    isAssessmentTestKind,
  } = await import("@/lib/drive-file-kind");
  const kindRaw = String(formData?.get("kind") ?? "").trim();
  const kind = isAssessmentTestKind(kindRaw) ? kindRaw : null;

  const library = await db
    .select({ id: assessments.id, source: assessments.source })
    .from(assessments)
    .where(
      and(
        ne(assessments.source, "attestation"),
        ne(assessments.source, "learning"),
      ),
    );
  const filtered = kind
    ? library.filter(
        (row) =>
          row.source === kind ||
          (kind === "level" &&
            (row.source === "library" || !row.source)),
      )
    : library;
  const ids = filtered.map((row) => row.id);
  const backPath = kind ? `/assessments/kind/${kind}` : "/assessments";
  if (ids.length === 0) {
    revalidatePath("/assessments");
    revalidatePath(backPath);
    redirect(backPath);
  }
  await db
    .delete(candidateResults)
    .where(inArray(candidateResults.assessmentId, ids));
  await db
    .delete(candidateAssignments)
    .where(inArray(candidateAssignments.assessmentId, ids));
  await db.delete(results).where(inArray(results.assessmentId, ids));
  await db.delete(assignments).where(inArray(assignments.assessmentId, ids));
  await db.delete(questions).where(inArray(questions.assessmentId, ids));
  await db.delete(assessments).where(inArray(assessments.id, ids));
  revalidatePath("/assessments");
  revalidatePath(backPath);
  revalidatePath("/");
  redirect(backPath);
}

export async function deleteSelectedAssessmentsAction(formData: FormData) {
  const ids = formData
    .getAll("assessmentIds")
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (ids.length === 0) {
    revalidatePath("/assessments");
    redirect("/assessments");
  }

  await db
    .delete(candidateResults)
    .where(inArray(candidateResults.assessmentId, ids));
  await db
    .delete(candidateAssignments)
    .where(inArray(candidateAssignments.assessmentId, ids));
  await db.delete(results).where(inArray(results.assessmentId, ids));
  await db.delete(assignments).where(inArray(assignments.assessmentId, ids));
  await db.delete(questions).where(inArray(questions.assessmentId, ids));
  await db.delete(assessments).where(inArray(assessments.id, ids));

  revalidatePath("/assessments");
  revalidatePath("/");
  redirect("/assessments");
}

export async function createEmployeeAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  const roleTitle = String(formData.get("roleTitle") ?? "").trim();

  if (!name || !email || !department || !roleTitle) {
    throw new Error("Заполните все поля");
  }

  await createEmployee({ name, email, department, roleTitle });
  revalidatePath("/");
  revalidatePath("/employees");
  redirect("/employees");
}

export async function hireInternAction(formData: FormData) {
  const employeeId = Number(formData.get("employeeId"));
  const positionId = Number(formData.get("positionId"));
  if (!employeeId || !positionId) {
    throw new Error("Выберите стажёра и вакантную должность");
  }
  await hireInternIntoPosition(employeeId, positionId);
  revalidatePath("/");
  revalidatePath("/employees");
  revalidatePath("/observer");
}

export async function assignEmployeePositionAction(formData: FormData) {
  const employeeId = Number(formData.get("employeeId"));
  const positionId = Number(formData.get("positionId"));
  const rawMode = String(formData.get("mode") ?? "move");
  const mode = rawMode === "additional" ? "additional" : "move";
  if (!employeeId || !positionId) {
    throw new Error("Выберите сотрудника и должность");
  }
  await assignExistingEmployeePosition({ employeeId, positionId, mode });
  revalidatePath("/");
  revalidatePath("/employees");
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/observer");
}

export async function dismissPositionAction(formData: FormData) {
  const positionId = Number(formData.get("positionId"));
  if (!positionId) throw new Error("Выберите занятую должность");
  await dismissStaffingPosition(positionId);
  revalidatePath("/");
  revalidatePath("/employees");
  revalidatePath("/observer");
  revalidatePath("/access");
}

export async function createCandidateAction(formData: FormData) {
  const lastName = String(formData.get("lastName") ?? "").trim();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const telegram = String(formData.get("telegram") ?? "").trim();
  const source = String(formData.get("source") ?? "manual").trim() || "manual";
  const vacancyId = Number(formData.get("vacancyId"));
  const notes = String(formData.get("notes") ?? "").trim();
  const name = [lastName, firstName].filter(Boolean).join(" ");

  if (!lastName || !firstName || !vacancyId) {
    throw new Error("Укажите фамилию, имя и вакансию");
  }

  const row = await createCandidate({
    name,
    phone,
    email,
    telegram,
    source,
    vacancyId,
    notes,
  });
  await autoAssignCandidateTest(row.id);
  await appendCandidateEvent({
    candidateId: row.id,
    kind: "status_change",
    title: "Кандидат создан",
    body: `Источник: ${source}`,
    toStatus: "new",
  });
  revalidatePath("/");
  revalidatePath("/candidates");
  redirect(`/candidates/${row.id}`);
}

export async function setCandidateStatusAction(formData: FormData) {
  const candidateId = Number(formData.get("candidateId"));
  const status = String(formData.get("status") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim();
  if (!candidateId || !status) throw new Error("Укажите кандидата и статус");
  const { isCandidateStatus } = await import("@/lib/candidate-funnel");
  if (!isCandidateStatus(status)) throw new Error("Неизвестный статус");
  await setCandidateStatus(candidateId, status, { comment });
  revalidatePath("/");
  revalidatePath("/candidates");
  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath("/interns");
}

export async function updateCandidateProfileAction(formData: FormData) {
  const candidateId = Number(formData.get("candidateId"));
  if (!candidateId) throw new Error("Кандидат не указан");

  const vacancyRaw = formData.get("vacancyId");
  const hrRaw = formData.get("hrOwnerUserId");
  await updateCandidateProfile({
    candidateId,
    name: String(formData.get("name") ?? "").trim() || undefined,
    phone: String(formData.get("phone") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    telegram: String(formData.get("telegram") ?? "").trim(),
    source: String(formData.get("source") ?? "").trim() || undefined,
    vacancyId: vacancyRaw ? Number(vacancyRaw) : undefined,
    claimedLevel: String(formData.get("claimedLevel") ?? "").trim(),
    interviewResult: String(formData.get("interviewResult") ?? "").trim(),
    hrOwnerUserId: hrRaw === "" || hrRaw == null ? null : Number(hrRaw),
    birthDate: String(formData.get("birthDate") ?? "").trim() || null,
    address: String(formData.get("address") ?? "").trim(),
    desiredSalary: String(formData.get("desiredSalary") ?? "").trim(),
    availableFrom: String(formData.get("availableFrom") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim(),
    archived: formData.get("archived") === "1",
    profile: {
      education: String(formData.get("education") ?? "").trim(),
      experience: String(formData.get("experience") ?? "").trim(),
      skills: String(formData.get("skills") ?? "").trim(),
      languages: String(formData.get("languages") ?? "").trim(),
      tools: String(formData.get("tools") ?? "").trim(),
    },
  });
  revalidatePath("/candidates");
  revalidatePath(`/candidates/${candidateId}`);
}

export async function addCandidateCommentAction(formData: FormData) {
  const candidateId = Number(formData.get("candidateId"));
  const body = String(formData.get("body") ?? "").trim();
  if (!candidateId || !body) throw new Error("Комментарий пуст");
  await appendCandidateEvent({
    candidateId,
    kind: "comment",
    title: "Комментарий HR",
    body,
  });
  revalidatePath(`/candidates/${candidateId}`);
}

export async function createInterviewAction(formData: FormData) {
  const candidateId = Number(formData.get("candidateId"));
  const date = String(formData.get("date") ?? "").trim();
  const time = String(formData.get("time") ?? "").trim();
  if (!candidateId || !date || !time) {
    throw new Error("Укажите кандидата, дату и время");
  }
  const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
  const hrRaw = formData.get("hrOwnerUserId");
  await createInterview({
    candidateId,
    scheduledAt,
    durationMinutes: Number(formData.get("durationMinutes") || 60) || 60,
    format: String(formData.get("format") ?? "office"),
    address: String(formData.get("address") ?? "").trim(),
    geoUrl: String(formData.get("geoUrl") ?? "").trim(),
    room: String(formData.get("room") ?? "").trim(),
    hrOwnerUserId: hrRaw === "" || hrRaw == null ? null : Number(hrRaw),
    interviewerName: String(formData.get("interviewerName") ?? "").trim(),
    departmentHead: String(formData.get("departmentHead") ?? "").trim(),
    commentToCandidate: String(formData.get("commentToCandidate") ?? "").trim(),
    sendNotify: formData.get("sendNotify") === "1",
  });
  revalidatePath("/");
  revalidatePath("/interviews");
  revalidatePath("/candidates");
  revalidatePath(`/candidates/${candidateId}`);
}

export async function setInterviewConfirmAction(formData: FormData) {
  const interviewId = Number(formData.get("interviewId"));
  const confirmStatus = String(formData.get("confirmStatus") ?? "").trim() as
    | "confirmed"
    | "declined"
    | "reschedule"
    | "pending";
  if (!interviewId || !confirmStatus) throw new Error("Некорректные данные");
  await setInterviewConfirmStatus(interviewId, confirmStatus);
  revalidatePath("/");
  revalidatePath("/interviews");
  revalidatePath("/candidates");
}

export async function saveInterviewEvaluationAction(formData: FormData) {
  const interviewId = Number(formData.get("interviewId"));
  if (!interviewId) throw new Error("Собеседование не указано");
  await saveInterviewEvaluation({
    interviewId,
    evaluation: {
      appearance: String(formData.get("appearance") ?? "").trim(),
      communication: String(formData.get("communication") ?? "").trim(),
      motivation: String(formData.get("motivation") ?? "").trim(),
      adequacy: String(formData.get("adequacy") ?? "").trim(),
      experience: String(formData.get("experience") ?? "").trim(),
      leaveReasons: String(formData.get("leaveReasons") ?? "").trim(),
      salaryExpectations: String(formData.get("salaryExpectations") ?? "").trim(),
      professionalConfidence: String(
        formData.get("professionalConfidence") ?? "",
      ).trim(),
      valuesFit: String(formData.get("valuesFit") ?? "").trim(),
      risks: String(formData.get("risks") ?? "").trim(),
      comment: String(formData.get("comment") ?? "").trim(),
      recommendation: String(formData.get("recommendation") ?? "").trim(),
    },
    decision: String(formData.get("decision") ?? "").trim() || null,
    decisionComment: String(formData.get("decisionComment") ?? "").trim(),
  });
  revalidatePath("/");
  revalidatePath("/interviews");
  revalidatePath("/candidates");
}

export async function moveCandidateToInternshipAction(formData: FormData) {
  const candidateId = Number(formData.get("candidateId"));
  if (!candidateId) throw new Error("Выберите кандидата");
  await moveCandidateToInternship(candidateId);
  revalidatePath("/candidates");
  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath("/interns");
  revalidatePath("/trial");
}

export async function addInternFromCandidateAction(formData: FormData) {
  const candidateId = Number(formData.get("candidateId"));
  if (!candidateId) throw new Error("Выберите ваканта");
  await createInternFromCandidate(candidateId);
  revalidatePath("/");
  revalidatePath("/interns");
  revalidatePath("/candidates");
  revalidatePath("/employees");
}

export async function createAssessmentAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  let competencyId = Number(formData.get("competencyId"));
  const durationMinutes = Number(formData.get("durationMinutes") || 20);
  const duration = Number.isFinite(durationMinutes) ? durationMinutes : 20;
  const passScoreRaw = Number(formData.get("passScore") || 60);
  const passScore = Number.isFinite(passScoreRaw)
    ? Math.min(100, Math.max(0, passScoreRaw))
    : 60;
  const sourceRaw = String(formData.get("source") ?? "library");
  const source = ["candidate", "trial", "intern", "level"].includes(sourceRaw)
    ? (sourceRaw as "candidate" | "trial" | "intern" | "level")
    : "library";
  const listPath =
    source === "library" ? "/assessments" : `/assessments/kind/${source}`;

  const files = formData
    .getAll("file")
    .filter((f): f is File => f instanceof File && f.size > 0);

  const comps = await getCompetencyOptions();
  if (!competencyId) {
    competencyId = comps[0]?.id ?? 0;
  }
  if (!competencyId) {
    throw new Error("Нет компетенций — сначала создайте их в системе");
  }

  function pickAudienceId(audience: TestAudience) {
    const match =
      audience === "candidates"
        ? /кандидат/
        : audience === "interns"
          ? /стаж/
          : /сотрудник/;
    return comps.find((c) => match.test(c.name.toLowerCase()))?.id ?? competencyId;
  }

  async function createOne(
    name: string,
    desc: string,
    buffer?: Buffer,
    fileName?: string,
    forcedCompetencyId?: number,
  ) {
    if (buffer) {
      const tests = parseWorkbookTests(buffer, { fileName });
      let last = null;
      for (const test of tests) {
        const testTitle =
          tests.length > 1 || test.kind === "role"
            ? test.title || name
            : name;
        const row = await createAssessment({
          title: testTitle,
          description:
            test.roleTitle && test.kind === "role"
              ? `Должность: ${test.roleTitle}`
              : desc || testTitle,
          competencyId: pickAudienceId(test.audience) || forcedCompetencyId || competencyId,
          durationMinutes: duration,
          passScore,
          source,
        });
        for (const q of test.questions) {
          await addQuestion({
            assessmentId: row.id,
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
        last = row;
      }
      return last;
    }

    return createAssessment({
      title: name,
      description: desc || name,
      competencyId: forcedCompetencyId || competencyId,
      durationMinutes: duration,
      passScore,
      source,
    });
  }

  function fileBaseName(file: File) {
    return file.name.replace(/\.(xlsx|xls)$/i, "").trim() || file.name;
  }

  // Several Excel files → several tests
  if (files.length > 1) {
    for (const file of files) {
      const base = fileBaseName(file);
      const name = title ? `${title}: ${base}` : base;
      const buffer = Buffer.from(await file.arrayBuffer());
      await createOne(name, description || name, buffer, file.name);
    }
    revalidatePath(listPath);
    redirect(listPath);
  }

  // One Excel or manual create
  if (!title && files.length === 0) {
    throw new Error("Укажите название теста или загрузите Excel");
  }

  if (files.length === 1) {
    const file = files[0];
    const name = title || fileBaseName(file);
    const buffer = Buffer.from(await file.arrayBuffer());
    await createOne(name, description || name, buffer, file.name);
    revalidatePath(listPath);
    redirect(listPath);
  }

  const row = await createOne(title, description || title);
  revalidatePath("/assessments");
  redirect(`/assessments/${row!.id}`);
}

export async function addQuestionAction(formData: FormData) {
  const assessmentId = Number(formData.get("assessmentId"));
  const prompt = String(formData.get("prompt") ?? "").trim();
  const typeRaw = String(formData.get("type") ?? "single");
  const type =
    typeRaw === "multiple" || typeRaw === "text" ? typeRaw : "single";
  const weight = Number(formData.get("weight") || 1);

  const options = formData
    .getAll("option")
    .map((v) => String(v).trim())
    .filter(Boolean);

  const correctIndexes = formData
    .getAll("correctIndex")
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n));

  const keywords = String(formData.get("keywords") ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  if (!assessmentId || !prompt) {
    throw new Error("Заполните вопрос");
  }

  if (type !== "text" && options.length < 2) {
    throw new Error("Нужно минимум 2 варианта ответа");
  }

  if (type === "single" && correctIndexes.length !== 1) {
    throw new Error("Выберите один правильный ответ");
  }

  if (type === "multiple" && correctIndexes.length < 1) {
    throw new Error("Отметьте хотя бы один правильный ответ");
  }

  // text без keywords = открытый вопрос (weight 0, оценка вручную)
  const isOpenText = type === "text" && keywords.length < 1;

  await addQuestion({
    assessmentId,
    prompt,
    type,
    options,
    correctIndexes,
    keywords,
    weight: isOpenText
      ? 0
      : Number.isFinite(weight) && weight > 0
        ? weight
        : 1,
    difficulty: String(formData.get("difficulty") ?? "junior"),
    knowledgeKind: String(formData.get("knowledgeKind") ?? "knowledge"),
    section: String(formData.get("section") ?? "Общий"),
    isActive: formData.get("isActive") !== "0",
  });

  revalidatePath(`/assessments/${assessmentId}`);
  revalidatePath("/assessments");
  const addedReturn = questionReturnPath(formData, assessmentId);
  revalidatePath(addedReturn);
  redirect(addedReturn);
}

export async function updateAssessmentAction(formData: FormData) {
  const id = Number(formData.get("assessmentId"));
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const competencyId = Number(formData.get("competencyId"));
  const durationMinutes = Number(formData.get("durationMinutes") || 20);
  const passScore = Number(formData.get("passScore") || 60);

  if (!id || !title || !competencyId) {
    throw new Error("Заполните название и аудиторию");
  }

  await updateAssessment({
    id,
    title,
    description: description || title,
    competencyId,
    durationMinutes: Number.isFinite(durationMinutes) ? durationMinutes : 20,
    passScore: Number.isFinite(passScore)
      ? Math.min(100, Math.max(0, passScore))
      : 60,
  });

  revalidatePath(`/assessments/${id}`);
  revalidatePath("/assessments");
  redirect(`/assessments/${id}`);
}

export async function updateQuestionAction(formData: FormData) {
  const questionId = Number(formData.get("questionId"));
  const assessmentId = Number(formData.get("assessmentId"));
  const prompt = String(formData.get("prompt") ?? "").trim();
  const typeRaw = String(formData.get("type") ?? "single");
  const type =
    typeRaw === "multiple" || typeRaw === "text" ? typeRaw : "single";
  const weight = Number(formData.get("weight") || 1);

  const options = formData
    .getAll("option")
    .map((v) => String(v).trim())
    .filter(Boolean);

  const correctIndexes = formData
    .getAll("correctIndex")
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n));

  const keywords = String(formData.get("keywords") ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  if (!questionId || !assessmentId || !prompt) {
    throw new Error("Заполните вопрос");
  }

  if (type !== "text" && options.length < 2) {
    throw new Error("Нужно минимум 2 варианта ответа");
  }

  if (type === "single" && correctIndexes.length !== 1) {
    throw new Error("Выберите один правильный ответ");
  }

  if (type === "multiple" && correctIndexes.length < 1) {
    throw new Error("Отметьте хотя бы один правильный ответ");
  }

  const isOpenText = type === "text" && keywords.length < 1;

  await updateQuestion({
    id: questionId,
    prompt,
    type,
    options,
    correctIndexes,
    keywords,
    weight: isOpenText
      ? 0
      : Number.isFinite(weight) && weight > 0
        ? weight
        : 1,
    difficulty: String(formData.get("difficulty") ?? "junior"),
    knowledgeKind: String(formData.get("knowledgeKind") ?? "knowledge"),
    section: String(formData.get("section") ?? "Общий"),
    isActive: formData.get("isActive") === "1",
  });

  revalidatePath(`/assessments/${assessmentId}`);
  revalidatePath("/assessments");
  const updatedReturn = questionReturnPath(formData, assessmentId);
  revalidatePath(updatedReturn);
  redirect(updatedReturn);
}

export async function deleteQuestionAction(formData: FormData) {
  const questionId = Number(formData.get("questionId"));
  const assessmentId = Number(formData.get("assessmentId"));
  if (!questionId || !assessmentId) {
    throw new Error("Не указан вопрос");
  }
  await deleteQuestion(questionId);
  revalidatePath(`/assessments/${assessmentId}`);
  revalidatePath("/assessments");
  const deletedReturn = questionReturnPath(formData, assessmentId);
  revalidatePath(deletedReturn);
  redirect(deletedReturn);
}

export async function assignAssessmentAction(formData: FormData) {
  const employeeId = Number(formData.get("employeeId"));
  const assessmentId = Number(formData.get("assessmentId"));
  const dueAtRaw = String(formData.get("dueAt") ?? "");
  const dueAt = dueAtRaw
    ? new Date(dueAtRaw).toISOString()
    : new Date(Date.now() + 7 * 86400000).toISOString();

  if (!employeeId || !assessmentId) {
    throw new Error("Выберите сотрудника и тест");
  }

  await assignAssessment({ employeeId, assessmentId, dueAt });
  revalidatePath("/");
  revalidatePath("/assessments");
  revalidatePath(`/employees/${employeeId}`);
  redirect("/assessments");
}

export async function assignCandidateAssessmentAction(formData: FormData) {
  const candidateId = Number(formData.get("candidateId"));
  let assessmentId = Number(formData.get("assessmentId"));
  const dueAtRaw = String(formData.get("dueAt") ?? "");
  const dueAt = dueAtRaw
    ? new Date(dueAtRaw).toISOString()
    : new Date(Date.now() + 7 * 86400000).toISOString();

  if (!candidateId) {
    throw new Error("Выберите ваканта");
  }

  if (!assessmentId) {
    const auto = await autoAssignCandidateTest(candidateId);
    if (!auto.assigned) {
      throw new Error(
        auto.reason === "no_matching_test"
          ? `Не найден тест для должности «${auto.roleTitle}»`
          : "Не удалось назначить тест",
      );
    }
    revalidatePath("/candidates");
    revalidatePath("/my");
    redirect("/candidates");
  }

  await assignCandidateAssessment({ candidateId, assessmentId, dueAt });
  revalidatePath("/candidates");
  revalidatePath("/my");
  redirect("/candidates");
}

export async function loginAction(formData: FormData) {
  const { completeLogin } = await import("@/lib/login");
  const result = await completeLogin(formData);
  if (!result.ok) redirect(`/login?error=${result.error}`);
  redirect(result.nextPath);
}

export async function savePreferredLocaleAction(localeRaw: string) {
  const session = await getSession();
  if (!session) return;
  const locale =
    localeRaw === "uz" || localeRaw === "en" ? localeRaw : "ru";
  await setPreferredLocale(session.userId, locale);
  revalidatePath("/my");
  revalidatePath("/my/onboarding");
  revalidatePath("/my/company");
  revalidatePath("/admin/profile");
}

export async function getSidebarAccountAction() {
  const session = await getSession();
  if (!session) return null;
  const user = await getPlatformUserById(session.userId);
  return {
    name: user?.displayName || session.name,
    email: "",
    role: user?.role || session.role,
    avatarData: user?.avatarData ?? null,
    avatarHue: user?.avatarHue ?? 220,
  };
}

export async function updateAdminProfileAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    throw new Error("Недостаточно прав");
  }
  const displayName = String(formData.get("displayName") ?? "").trim();
  const login = String(formData.get("login") ?? "")
    .trim()
    .toLowerCase();
  const profileJobTitle = String(formData.get("profileJobTitle") ?? "").trim();
  const profileDepartment = String(
    formData.get("profileDepartment") ?? "",
  ).trim();
  if (!displayName || !login) {
    throw new Error("Заполните ФИО и логин");
  }
  const duplicate = await getPlatformUserByLogin(login);
  if (duplicate && duplicate.id !== session.userId) {
    throw new Error("Такой логин уже занят");
  }
  const existing = await getPlatformUserById(session.userId);
  let prefs: Record<string, unknown> = {};
  try {
    prefs = JSON.parse(existing?.uiPreferencesJson || "{}") as Record<
      string,
      unknown
    >;
  } catch {
    prefs = {};
  }
  prefs.profileEmail = String(formData.get("profileEmail") ?? "").trim();
  prefs.profilePhone = String(formData.get("profilePhone") ?? "").trim();
  prefs.profileTelegram = String(formData.get("profileTelegram") ?? "").trim();

  await updatePlatformUserProfile(session.userId, {
    displayName,
    login,
    profileJobTitle,
    profileDepartment,
    uiPreferencesJson: JSON.stringify(prefs),
  });
  await setSession({ ...session, name: displayName });
  revalidatePath("/admin/profile");
  revalidatePath("/admin/profile/overview");
}

export async function saveAdminUiPreferencesAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    throw new Error("Недостаточно прав");
  }
  const existing = await getPlatformUserById(session.userId);
  let prefs: Record<string, unknown> = {};
  try {
    prefs = JSON.parse(existing?.uiPreferencesJson || "{}") as Record<
      string,
      unknown
    >;
  } catch {
    prefs = {};
  }
  const localeRaw = String(formData.get("preferredLocale") ?? "ru");
  const locale =
    localeRaw === "uz" || localeRaw === "en" ? localeRaw : "ru";
  const next = {
    ...prefs,
    theme: String(formData.get("theme") ?? "light"),
    textSize: String(formData.get("textSize") ?? "md"),
    compactTables: formData.get("compactTables") === "1",
    notificationsEmail: formData.get("notificationsEmail") === "1",
    notificationsTelegram: formData.get("notificationsTelegram") === "1",
    timezone: String(formData.get("timezone") ?? "Asia/Tashkent"),
    dateFormat: String(formData.get("dateFormat") ?? "dmy"),
    homePage: String(formData.get("homePage") ?? "/"),
    deskLayout: String(formData.get("deskLayout") ?? "default"),
  };
  await updatePlatformUserProfile(session.userId, {
    displayName: existing?.displayName || session.name,
    profileJobTitle: existing?.profileJobTitle || "",
    profileDepartment: existing?.profileDepartment || "",
    preferredLocale: locale,
    uiPreferencesJson: JSON.stringify(next),
  });
  await setPreferredLocale(session.userId, locale);
  revalidatePath("/admin/profile/preferences");
  revalidatePath("/admin/profile");
}

export async function changeAdminPasswordAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    throw new Error("Недостаточно прав");
  }
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  if (newPassword.length < 6) {
    throw new Error("Пароль должен быть не короче 6 символов");
  }
  if (newPassword !== confirmPassword) {
    throw new Error("Пароли не совпадают");
  }
  const existing = await getPlatformUserById(session.userId);
  if (!existing) throw new Error("Пользователь не найден");
  const user = await getPlatformUserByLogin(existing.login);
  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    throw new Error("Текущий пароль неверный");
  }
  await updatePlatformUserProfile(session.userId, {
    displayName: user.displayName,
    profileJobTitle: user.profileJobTitle || "",
    profileDepartment: user.profileDepartment || "",
    passwordHash: hashPassword(newPassword),
    passwordPlain: newPassword,
  });
  revalidatePath("/admin/profile/security");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function advanceInternOnboardingAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const expectedStep = Number(formData.get("step"));
  if (!Number.isInteger(expectedStep) || expectedStep < 0 || expectedStep > 4) {
    throw new Error("Некорректный шаг онбординга");
  }

  const result = await advanceInternOnboarding(session.userId, expectedStep);
  revalidatePath("/my");
  revalidatePath("/observer/home");
  revalidatePath("/");
  revalidatePath("/my/onboarding");
  redirect(
    result.completed
      ? homePathForRole(session.role, session.participantKind)
      : "/my/onboarding",
  );
}

export async function updateOwnProfileAction(formData: FormData) {
  const session = await getSession();
  if (
    !session ||
    (session.role !== "observer" &&
      session.role !== "manager" &&
      session.role !== "participant")
  ) {
    throw new Error("Недостаточно прав");
  }

  if (
    session.role === "participant" &&
    session.participantKind !== "employee" &&
    session.participantKind !== "intern"
  ) {
    throw new Error("Недостаточно прав");
  }

  const displayName = String(formData.get("displayName") ?? "").trim();
  const profileJobTitle = String(
    formData.get("profileJobTitle") ?? "",
  ).trim();
  const profileDepartment = String(
    formData.get("profileDepartment") ?? "",
  ).trim();
  const login = String(formData.get("login") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "").trim();
  const avatarHueRaw = Number(formData.get("avatarHue"));
  const avatarHue = Number.isFinite(avatarHueRaw)
    ? Math.max(0, Math.min(359, Math.round(avatarHueRaw)))
    : 220;

  if (!displayName || !profileJobTitle || !profileDepartment || !login) {
    throw new Error("Заполните ФИО, должность, подразделение и логин");
  }

  const duplicate = await getPlatformUserByLogin(login);
  if (duplicate && duplicate.id !== session.userId) {
    throw new Error("Такой логин уже занят");
  }

  let avatarData: string | null | undefined;
  if (formData.get("removePhoto") === "1") {
    avatarData = null;
  }
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(photo.type)) {
      throw new Error("Загрузите фото в формате JPG, PNG или WEBP");
    }
    if (photo.size > 2 * 1024 * 1024) {
      throw new Error("Размер фото не должен превышать 2 МБ");
    }
    const bytes = Buffer.from(await photo.arrayBuffer());
    avatarData = `data:${photo.type};base64,${bytes.toString("base64")}`;
  }

  await updatePlatformUserProfile(session.userId, {
    displayName,
    profileJobTitle,
    profileDepartment,
    login,
    avatarHue,
    avatarData,
    ...(password
      ? {
          passwordHash: hashPassword(password),
          passwordPlain: password,
        }
      : {}),
  });
  await setSession({ ...session, name: displayName });
  revalidatePath("/observer/profile");
  revalidatePath("/my/profile");
  revalidatePath("/my");
  if (session.role === "participant") {
    redirect("/my/profile?saved=1");
  }
  redirect("/observer/profile?saved=1");
}

export async function setCandidatePortalAction(formData: FormData) {
  const candidateId = Number(formData.get("candidateId"));
  let portalLogin = String(formData.get("portalLogin") ?? "").trim();
  let portalPassword = String(formData.get("portalPassword") ?? "").trim();

  if (!candidateId) {
    throw new Error("Выберите ваканта");
  }

  const rows = await getCandidates();
  const person = rows.find((c) => c.id === candidateId);
  if (!person) throw new Error("Вакант не найден");

  if (!portalLogin) {
    portalLogin = suggestLogin(person.name, candidateId);
  }

  if (!portalPassword) {
    portalPassword = await policyPassword();
  }

  const duplicate = await getPlatformUserByLogin(portalLogin);
  if (duplicate && duplicate.candidateId !== candidateId) {
    throw new Error("Такой логин уже занят");
  }

  const passwordHash = hashPassword(portalPassword);

  await setCandidatePortalCredentials({
    candidateId,
    portalLogin,
    portalPasswordHash: passwordHash,
    portalEnabled: true,
  });

  await upsertParticipantUserForCandidate({
    candidateId,
    name: person.name,
    login: portalLogin,
    passwordHash,
    passwordPlain: portalPassword,
  });

  await autoAssignCandidateTest(candidateId);

  revalidatePath("/candidates");
  revalidatePath("/my");
  redirect(
    `/candidates?portal=${candidateId}&login=${encodeURIComponent(portalLogin)}&pass=${encodeURIComponent(portalPassword)}`,
  );
}

export async function setEmployeePortalAction(formData: FormData) {
  const employeeId = Number(formData.get("employeeId"));
  let portalLogin = String(formData.get("portalLogin") ?? "").trim();
  let portalPassword = String(formData.get("portalPassword") ?? "").trim();
  const accountTypeRaw = String(formData.get("accountType") ?? "").trim();

  if (!employeeId) {
    throw new Error("Выберите сотрудника");
  }

  const data = await getEmployeeById(employeeId);
  if (!data) throw new Error("Сотрудник не найден");

  const { employee } = data;

  if (!portalLogin) {
    portalLogin = suggestLogin(employee.name, employeeId);
  }

  if (!portalPassword) {
    portalPassword = await policyPassword();
  }

  const duplicate = await getPlatformUserByLogin(portalLogin);
  if (duplicate && duplicate.employeeId !== employeeId) {
    throw new Error("Такой логин уже занят");
  }

  const passwordHash = hashPassword(portalPassword);

  await upsertParticipantUserForEmployee({
    employeeId,
    name: employee.name,
    roleTitle: employee.roleTitle,
    department: employee.department,
    login: portalLogin,
    passwordHash,
    passwordPlain: portalPassword,
  });

  if (["intern", "employee", "manager"].includes(accountTypeRaw)) {
    const { setEmployeeAccountType } = await import("./queries");
    await setEmployeeAccountType(
      employeeId,
      accountTypeRaw as "intern" | "employee" | "manager",
    );
  }

  revalidatePath("/employees");
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/access");
  revalidatePath("/observer");
  revalidatePath("/my");
  redirect(
    `/employees/${employeeId}?portal=1&login=${encodeURIComponent(portalLogin)}&pass=${encodeURIComponent(portalPassword)}`,
  );
}

export async function updateEmployeeHiredAtAction(formData: FormData) {
  await requireAdminSession();
  const employeeId = Number(formData.get("employeeId"));
  const raw = String(formData.get("hiredAt") ?? "").trim();
  if (!employeeId) throw new Error("Не указан сотрудник");

  let hiredAt: string | null = null;
  if (raw) {
    const date = new Date(`${raw}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      throw new Error("Некорректная дата");
    }
    hiredAt = date.toISOString();
  }

  const { updateEmployeeHiredAt } = await import("./queries");
  const updated = await updateEmployeeHiredAt(employeeId, hiredAt);
  if (!updated) throw new Error("Сотрудник не найден");

  revalidatePath("/employees");
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/my/statistics");
  revalidatePath("/my");
  redirect(`/employees/${employeeId}`);
}

function optionalId(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function updateEmployeeProfileAction(formData: FormData) {
  await requireAdminSession();
  const employeeId = Number(formData.get("employeeId"));
  if (!employeeId) throw new Error("Не указан сотрудник");

  const nextCheckRaw = String(formData.get("nextCheckAt") ?? "").trim();
  let nextCheckAt: string | null | undefined = undefined;
  if (formData.has("nextCheckAt")) {
    if (!nextCheckRaw) nextCheckAt = null;
    else {
      const date = new Date(`${nextCheckRaw}T00:00:00`);
      if (Number.isNaN(date.getTime())) throw new Error("Некорректная дата проверки");
      nextCheckAt = date.toISOString();
    }
  }

  const hiredRaw = String(formData.get("hiredAt") ?? "").trim();
  let hiredAt: string | null | undefined = undefined;
  if (formData.has("hiredAt")) {
    if (!hiredRaw) hiredAt = null;
    else {
      const date = new Date(`${hiredRaw}T00:00:00`);
      if (Number.isNaN(date.getTime())) throw new Error("Некорректная дата приёма");
      hiredAt = date.toISOString();
    }
  }

  const { updateEmployeeProfile } = await import("./queries");
  const updated = await updateEmployeeProfile({
    employeeId,
    phone: formData.has("phone")
      ? String(formData.get("phone") ?? "")
      : undefined,
    telegram: formData.has("telegram")
      ? String(formData.get("telegram") ?? "")
      : undefined,
    workSchedule: formData.has("workSchedule")
      ? String(formData.get("workSchedule") ?? "")
      : undefined,
    startingLevel: formData.has("startingLevel")
      ? String(formData.get("startingLevel") ?? "")
      : undefined,
    targetLevel: formData.has("targetLevel")
      ? String(formData.get("targetLevel") ?? "")
      : undefined,
    currentLevel: formData.has("currentLevel")
      ? String(formData.get("currentLevel") ?? "")
      : undefined,
    status: formData.has("status")
      ? String(formData.get("status") ?? "")
      : undefined,
    department: formData.has("department")
      ? String(formData.get("department") ?? "")
      : undefined,
    roleTitle: formData.has("roleTitle")
      ? String(formData.get("roleTitle") ?? "")
      : undefined,
    managerEmployeeId: formData.has("managerEmployeeId")
      ? optionalId(formData.get("managerEmployeeId"))
      : undefined,
    mentorUserId: formData.has("mentorUserId")
      ? optionalId(formData.get("mentorUserId"))
      : undefined,
    nextCheckAt,
    notes: formData.has("notes")
      ? String(formData.get("notes") ?? "")
      : undefined,
    hiredAt,
  });
  if (!updated) throw new Error("Сотрудник не найден");

  revalidatePath("/employees");
  revalidatePath(`/employees/${employeeId}`);
  redirect(`/employees/${employeeId}`);
}

export async function assignEmployeeMentorAction(formData: FormData) {
  await requireAdminSession();
  const employeeId = Number(formData.get("employeeId"));
  if (!employeeId) throw new Error("Не указан сотрудник");
  const mentorRaw = String(formData.get("mentorUserId") ?? "").trim();
  const mentorUserId = mentorRaw ? Number(mentorRaw) : null;
  if (mentorRaw && Number.isNaN(mentorUserId)) {
    throw new Error("Некорректный наставник");
  }

  const { updateEmployeeProfile } = await import("./queries");
  const updated = await updateEmployeeProfile({
    employeeId,
    mentorUserId: mentorUserId && !Number.isNaN(mentorUserId) ? mentorUserId : null,
  });
  if (!updated) throw new Error("Сотрудник не найден");

  revalidatePath("/employees");
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/observer/mentees");
}

export async function upsertEmployeeCompetencyAction(formData: FormData) {
  const session = await requireAdminSession();
  const employeeId = Number(formData.get("employeeId"));
  const competencyId = Number(formData.get("competencyId"));
  const status = String(formData.get("status") ?? "").trim();
  const note = String(formData.get("note") ?? "");
  if (!employeeId || !competencyId || !status) {
    throw new Error("Укажите компетенцию и статус");
  }

  const { upsertEmployeeCompetency } = await import("./queries");
  await upsertEmployeeCompetency({
    employeeId,
    competencyId,
    status,
    note,
    updatedByUserId: session.userId,
  });

  revalidatePath(`/employees/${employeeId}`);
  redirect(`/employees/${employeeId}#matrix`);
}

export async function assignEmployeeTestAction(formData: FormData) {
  await requireAdminSession();
  const employeeId = Number(formData.get("employeeId"));
  const assessmentId = Number(formData.get("assessmentId"));
  const dueAtRaw = String(formData.get("dueAt") ?? "").trim();
  const dueAt = dueAtRaw
    ? new Date(`${dueAtRaw}T23:59:59`).toISOString()
    : new Date(Date.now() + 7 * 86400000).toISOString();

  if (!employeeId || !assessmentId) {
    throw new Error("Выберите тест");
  }

  await assignAssessment({ employeeId, assessmentId, dueAt });
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/assessments");
  redirect(`/employees/${employeeId}`);
}

export async function assignEmployeeAttestationAction(formData: FormData) {
  await requireAdminSession();
  const employeeId = Number(formData.get("employeeId"));
  const attestationId = Number(formData.get("attestationId"));
  if (!employeeId || !attestationId) {
    throw new Error("Выберите аттестацию");
  }

  const { getAttestationById, ensureAttestationAssignment } = await import(
    "./learning"
  );
  const att = await getAttestationById(attestationId);
  if (!att?.assessmentId) {
    throw new Error("У аттестации ещё нет теста");
  }

  await ensureAttestationAssignment({
    employeeId,
    assessmentId: att.assessmentId,
    dueAt: att.endsAt,
  });
  const { createAttestationReview } = await import("./attestation-reviews");
  await createAttestationReview({
    employeeId,
    attestationId,
    type: String(formData.get("type") || "final_3_months"),
    scheduledAt: att.startsAt,
  });

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/attestation");
  redirect(`/employees/${employeeId}`);
}

export async function updateEmployeeAccountTypeAction(formData: FormData) {
  await requireAdminSession();
  const employeeId = Number(formData.get("employeeId"));
  const accountType = String(formData.get("accountType") ?? "");
  if (!employeeId) throw new Error("Не указан сотрудник");
  if (!["intern", "employee", "manager"].includes(accountType)) {
    throw new Error("Некорректный тип аккаунта");
  }

  const { setEmployeeAccountType } = await import("./queries");
  const updated = await setEmployeeAccountType(
    employeeId,
    accountType as "intern" | "employee" | "manager",
  );
  if (!updated) {
    throw new Error("Сначала выдайте сотруднику доступ");
  }

  revalidatePath("/access");
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/observer");
  revalidatePath("/my");
  redirect(`/employees/${employeeId}`);
}

export async function createObserverAction(formData: FormData) {
  const displayName = String(formData.get("displayName") ?? "").trim();
  let login = String(formData.get("login") ?? "").trim();
  let password = String(formData.get("password") ?? "").trim();

  if (!displayName) {
    throw new Error("Укажите имя наблюдателя");
  }

  if (!login) {
    login = suggestLogin(displayName, Date.now() % 10000);
  }

  if (!password) {
    password = await policyPassword();
  }

  const duplicate = await getPlatformUserByLogin(login);
  if (duplicate) {
    throw new Error("Такой логин уже занят");
  }

  await createObserverUser({
    displayName,
    login,
    passwordHash: hashPassword(password),
    passwordPlain: password,
  });

  revalidatePath("/access");
  redirect(
    `/access?created=1&login=${encodeURIComponent(login)}&pass=${encodeURIComponent(password)}&name=${encodeURIComponent(displayName)}&type=observer`,
  );
}

export async function createPlatformAccountAction(formData: FormData) {
  const accountType = String(formData.get("accountType") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const personId = Number(formData.get("personId"));
  let login = String(formData.get("login") ?? "").trim();
  let password = String(formData.get("password") ?? "").trim();

  const validTypes = ["admin", "observer", "manager", "employee", "intern"];
  if (!validTypes.includes(accountType)) {
    throw new Error("Выберите тип аккаунта");
  }

  let name = displayName;
  let redirectType = accountType;

  if (accountType === "employee" || accountType === "intern") {
    if (!personId) throw new Error("Выберите сотрудника");
    const data = await getEmployeeById(personId);
    if (!data) throw new Error("Сотрудник не найден");
    name = data.employee.name;
    if (!login) login = suggestLogin(data.employee.name, personId);

    const duplicate = await getPlatformUserByLogin(login);
    if (duplicate && duplicate.employeeId !== personId) {
      throw new Error("Такой логин уже занят");
    }
    if (!password) password = await policyPassword();
    const passwordHash = hashPassword(password);

    await upsertParticipantUserForEmployee({
      employeeId: personId,
      name: data.employee.name,
      roleTitle:
        accountType === "intern"
          ? `стажёр ${data.employee.roleTitle}`
          : data.employee.roleTitle,
      department: data.employee.department,
      login,
      passwordHash,
      passwordPlain: password,
    });
    const { setEmployeeAccountType } = await import("./queries");
    await setEmployeeAccountType(personId, accountType);
  } else {
    if (!name) throw new Error("Укажите имя");
    if (!login) login = suggestLogin(name, Date.now() % 10000);
    if (!password) password = await policyPassword();

    const duplicate = await getPlatformUserByLogin(login);
    if (duplicate) throw new Error("Такой логин уже занят");

    const passwordHash = hashPassword(password);
    if (accountType === "admin") {
      await createAdminUser({
        displayName: name,
        login,
        passwordHash,
        passwordPlain: password,
      });
    } else if (accountType === "manager") {
      await createManagerUser({
        displayName: name,
        login,
        passwordHash,
        passwordPlain: password,
      });
    } else {
      await createObserverUser({
        displayName: name,
        login,
        passwordHash,
        passwordPlain: password,
      });
    }
  }

  revalidatePath("/access");
  revalidatePath("/candidates");
  revalidatePath("/employees");
  revalidatePath("/my");
  redirect(
    `/access?created=1&login=${encodeURIComponent(login)}&pass=${encodeURIComponent(password)}&name=${encodeURIComponent(name)}&type=${encodeURIComponent(redirectType)}`,
  );
}

export async function submitAssessmentAction(
  assignmentId: number,
  answers: Record<string, AnswerValue>,
) {
  const result = await submitAssessment(assignmentId, answers);

  try {
    await pushResultToGoogleSheets({
      assignmentId,
      score: result.score,
      levelCode: result.levelCode,
      completedAt: new Date().toISOString(),
    });
  } catch {
    // Sheets optional
  }

  revalidatePath("/");
  revalidatePath("/employees");
  revalidatePath("/assessments");
  return result;
}

export async function submitCandidateAssessmentAction(
  assignmentId: number,
  answers: Record<string, AnswerValue>,
  telemetry?: {
    answerChanges?: number;
    pageExits?: number;
    timedOut?: boolean;
    userAgent?: string;
  },
) {
  const result = await submitCandidateAssessment(
    assignmentId,
    answers,
    telemetry,
  );
  revalidatePath("/candidates");
  revalidatePath("/my");
  revalidatePath("/");
  return result;
}

export async function enqueueCandidateTerminalAction(formData: FormData) {
  const candidateId = Number(formData.get("candidateId"));
  const slotNumber = Number(formData.get("slotNumber"));
  if (!candidateId || !slotNumber) {
    throw new Error("Выберите ваканта и место");
  }
  await enqueueCandidateToTerminal(slotNumber, candidateId);
  revalidatePath("/candidates");
  revalidatePath(`/terminal/${slotNumber}`);
}

export async function removeTerminalQueueAction(formData: FormData) {
  const queueItemId = Number(formData.get("queueItemId"));
  if (!queueItemId) throw new Error("Не указана запись очереди");
  await removeCandidateFromTerminalQueue(queueItemId);
  revalidatePath("/candidates");
  for (let s = 1; s <= 5; s++) revalidatePath(`/terminal/${s}`);
}

export async function confirmTerminalAction(
  slotNumber: number,
  queueItemId: number,
) {
  const result = await confirmTerminalIdentity(slotNumber, queueItemId);
  await setTerminalSession({
    slotNumber,
    queueItemId: result.queueItemId,
    assignmentId: result.assignmentId,
    candidateId: result.candidateId,
  });
  revalidatePath(`/terminal/${slotNumber}`);
  revalidatePath("/candidates");
}

export async function submitTerminalAssessmentAction(
  slotNumber: number,
  queueItemId: number,
  assignmentId: number,
  answers: Record<string, AnswerValue>,
  options?: {
    timedOut?: boolean;
    answerChanges?: number;
    pageExits?: number;
    userAgent?: string;
  },
) {
  const session = await getTerminalSession();
  if (
    !session ||
    session.slotNumber !== slotNumber ||
    session.queueItemId !== queueItemId ||
    session.assignmentId !== assignmentId
  ) {
    throw new Error("Сессия терминала недействительна");
  }

  const valid = await validateTerminalAssignment(
    slotNumber,
    queueItemId,
    assignmentId,
  );
  if (!valid && !options?.timedOut) {
    throw new Error("Сессия истекла");
  }

  const outcome = await completeTerminalAttempt({
    slotNumber,
    queueItemId,
    assignmentId,
    answers,
    timedOut: options?.timedOut,
    answerChanges: options?.answerChanges,
    pageExits: options?.pageExits,
    userAgent: options?.userAgent,
  });

  await clearTerminalSession();
  revalidatePath(`/terminal/${slotNumber}`);
  revalidatePath("/candidates");
  revalidatePath("/results");
  return outcome;
}

export async function getTerminalClockAction(queueItemId: number) {
  return getTerminalAttemptClock(queueItemId);
}

export async function syncSheetsAction() {
  const summary = await syncFromGoogleSheets();
  revalidatePath("/");
  revalidatePath("/assessments");
  revalidatePath("/competencies");
  return summary;
}

export async function saveRoleHomePageAction(input: {
  audience: string;
  document: unknown;
}) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    throw new Error("Недостаточно прав");
  }
  if (!isRoleHomeAudience(input.audience)) {
    throw new Error("Неизвестная роль макета");
  }

  const parsed = roleHomeDocumentSchema.safeParse(input.document);
  if (!parsed.success) {
    throw new Error("Некорректный макет");
  }

  await upsertRoleHomePage({
    audience: input.audience,
    document: parsed.data,
    userId: session.userId,
  });

  revalidatePath("/design");
  revalidatePath("/observer/home");
  revalidatePath("/my");
  return { ok: true as const };
}

export async function saveVisualContentPageAction(input: {
  pageKey: string;
  document: unknown;
}) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    throw new Error("Недостаточно прав");
  }
  const { isOnboardingVisualPageKey } = await import(
    "@/lib/onboarding-visual"
  );
  if (!isOnboardingVisualPageKey(input.pageKey)) {
    throw new Error("Неизвестная страница онбординга");
  }
  const parsed = roleHomeDocumentSchema.parse(input.document);
  await upsertVisualContentPage({
    pageKey: input.pageKey,
    document: parsed,
    userId: session.userId,
  });
  revalidatePath("/design");
  revalidatePath("/my");
  revalidatePath("/my/onboarding");
  revalidatePath("/my/company");
  revalidatePath("/observer/home");
  revalidatePath("/");
  return { ok: true as const };
}

async function requireAdminSession() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    throw new Error("Недостаточно прав");
  }
  return session;
}

async function requireManagerSession() {
  const session = await getSession();
  if (!session || session.role !== "manager") {
    throw new Error("Недостаточно прав");
  }
  return session;
}

function parseCsvList(raw: string) {
  return String(raw ?? "")
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function questionReturnPath(formData: FormData, assessmentId: number) {
  const returnTo = String(formData.get("returnTo") ?? "");
  if (/^\/attestation\/\d+$/.test(returnTo)) return returnTo;
  return `/assessments/${assessmentId}`;
}

function parseFormDate(raw: string, fallback = new Date()) {
  const value = String(raw ?? "").trim();
  if (!value) return fallback.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback.toISOString() : date.toISOString();
}

export async function createLearningLessonAction(formData: FormData) {
  await requireAdminSession();
  const { createLearningLesson } = await import("./learning");
  await createLearningLesson({
    slug: String(formData.get("slug") ?? ""),
    title: String(formData.get("title") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    content: String(formData.get("content") ?? ""),
    level: String(formData.get("level") ?? "junior"),
    roleFamilies: parseCsvList(String(formData.get("roleFamilies") ?? "general")),
    topics: parseCsvList(String(formData.get("topics") ?? "")),
    durationMin: Number(formData.get("durationMin") || 20),
    createLinkedTest: formData.get("createLinkedTest") === "1",
  });
  revalidatePath("/learning");
  revalidatePath("/learning-tests");
  revalidatePath("/my/learning");
  revalidatePath("/my/tests");
}

export async function syncDriveLessonsAction() {
  await requireAdminSession();
  const { syncLessonsFromDrive } = await import("./sync-drive-lessons");
  const summary = await syncLessonsFromDrive();
  revalidatePath("/learning");
  revalidatePath("/learning-tests");
  revalidatePath("/my/learning");
  revalidatePath("/my/tests");
  return summary;
}

export async function getLearningLessonContentAction(id: number) {
  await requireAdminSession();
  const { getLearningLessonContentAdmin } = await import("./learning");
  return getLearningLessonContentAdmin(id);
}

export async function getLearningLessonsForRoleAction(
  roleTitle: string,
  audience: "employees" | "interns" = "employees",
) {
  await requireAdminSession();
  const { listLearningLessonsForRoleAdmin } = await import("./learning");
  return listLearningLessonsForRoleAdmin(roleTitle, audience);
}

export async function getLearningTestsForRoleAction(
  roleTitle: string,
  audience: "employees" | "interns" = "employees",
) {
  await requireAdminSession();
  const { listLearningTestsForRoleAdmin } = await import("./learning");
  return listLearningTestsForRoleAdmin(roleTitle, audience);
}

export async function openLearningTestEditorAction(testId: number) {
  await requireAdminSession();
  const { ensureLearningTestAssessment } = await import("./learning");
  return ensureLearningTestAssessment(testId);
}

export async function ensureLessonTestsAction() {
  await requireAdminSession();
  const { ensureAllLessonTests } = await import("./learning");
  const summary = await ensureAllLessonTests();
  revalidatePath("/learning");
  revalidatePath("/learning-tests");
  revalidatePath("/my/learning");
  revalidatePath("/my/tests");
  return summary;
}

export async function assignLessonRoleAction(formData: FormData) {
  await requireAdminSession();
  const { assignLessonToRole } = await import("./learning");
  await assignLessonToRole(
    Number(formData.get("lessonId")),
    String(formData.get("roleId") ?? ""),
  );
  revalidatePath("/learning");
  revalidatePath("/my/learning");
  revalidatePath("/my/tests");
}

export async function unassignLessonRoleAction(formData: FormData) {
  await requireAdminSession();
  const { unassignLessonFromRole } = await import("./learning");
  await unassignLessonFromRole(
    Number(formData.get("lessonId")),
    String(formData.get("roleId") ?? ""),
  );
  revalidatePath("/learning");
  revalidatePath("/my/learning");
  revalidatePath("/my/tests");
}

function revalidateRolesCatalog(roleId?: number) {
  revalidatePath("/competencies");
  if (roleId) revalidatePath(`/competencies/${roleId}`);
  revalidatePath("/employees");
  revalidatePath("/learning");
}

export async function syncRoleCatalogAction() {
  await requireAdminSession();
  const { syncRoleProfilesFromStaffing } = await import("./roles-catalog");
  await syncRoleProfilesFromStaffing();
  revalidateRolesCatalog();
}

export async function createRoleProfileAction(formData: FormData) {
  await requireAdminSession();
  const { createRoleProfile } = await import("./roles-catalog");
  const row = await createRoleProfile({
    code: String(formData.get("code") || "").trim() || undefined,
    roleTitle: String(formData.get("roleTitle") || ""),
    department: String(formData.get("department") || ""),
    managerName: String(formData.get("managerName") || ""),
    description: String(formData.get("description") || ""),
  });
  revalidateRolesCatalog(row.id);
  redirect(`/competencies/${row.id}`);
}

export async function updateRoleProfileAction(formData: FormData) {
  await requireAdminSession();
  const { updateRoleProfile } = await import("./roles-catalog");
  const id = Number(formData.get("id"));
  const list = (key: string) =>
    String(formData.get(key) || "")
      .split(/[\n,;|]/)
      .map((x) => x.trim())
      .filter(Boolean);

  await updateRoleProfile({
    id,
    roleTitle: String(formData.get("roleTitle") || ""),
    department: String(formData.get("department") || ""),
    managerName: String(formData.get("managerName") || ""),
    description: String(formData.get("description") || ""),
    duties: String(formData.get("duties") || ""),
    requirements: String(formData.get("requirements") || ""),
    programs: list("programs"),
    tools: list("tools"),
    junior: {
      basicKnowledge: String(formData.get("junior_basicKnowledge") || ""),
      standardTasks: String(formData.get("junior_standardTasks") || ""),
      byInstruction: String(formData.get("junior_byInstruction") || ""),
      requiredPrograms: String(formData.get("junior_requiredPrograms") || ""),
      minKpi: String(formData.get("junior_minKpi") || ""),
    },
    middle: {
      independentTasks: String(formData.get("middle_independentTasks") || ""),
      complexSituations: String(formData.get("middle_complexSituations") || ""),
      analysis: String(formData.get("middle_analysis") || ""),
      errorPrevention: String(formData.get("middle_errorPrevention") || ""),
      responsibility: String(formData.get("middle_responsibility") || ""),
      processImprovement: String(formData.get("middle_processImprovement") || ""),
      communication: String(formData.get("middle_communication") || ""),
    },
  });
  revalidateRolesCatalog(id);
}

export async function archiveRoleProfileAction(formData: FormData) {
  await requireAdminSession();
  const { archiveRoleProfile } = await import("./roles-catalog");
  const id = Number(formData.get("id"));
  const archive = String(formData.get("archive") || "1") !== "0";
  await archiveRoleProfile(id, archive);
  revalidateRolesCatalog(id);
}

export async function createSkillCompetencyAction(formData: FormData) {
  await requireAdminSession();
  const { createSkillCompetency, linkCompetencyToRole } = await import(
    "./roles-catalog"
  );
  const roleProfileId = Number(formData.get("roleProfileId") || 0);
  const skill = await createSkillCompetency({
    name: String(formData.get("name") || ""),
    description: String(formData.get("description") || ""),
    category: String(formData.get("category") || ""),
    levelScope: String(formData.get("levelScope") || "all"),
    verificationMethod: String(formData.get("verificationMethod") || "test"),
    isRequired: String(formData.get("isRequired") || "1") !== "0",
    weight: Number(formData.get("weight") || 1),
    isCriticalError: String(formData.get("isCriticalError") || "") === "1",
  });
  if (roleProfileId) {
    await linkCompetencyToRole({
      roleProfileId,
      competencyId: skill.id,
      isRequired: skill.isRequired,
      weight: skill.weight,
      levelScope: skill.levelScope,
    });
  }
  revalidateRolesCatalog(roleProfileId || undefined);
}

export async function linkRoleCompetencyAction(formData: FormData) {
  await requireAdminSession();
  const { linkCompetencyToRole } = await import("./roles-catalog");
  const roleProfileId = Number(formData.get("roleProfileId"));
  await linkCompetencyToRole({
    roleProfileId,
    competencyId: Number(formData.get("competencyId")),
    isRequired: String(formData.get("isRequired") || "1") !== "0",
    weight: Number(formData.get("weight") || 1),
    levelScope: String(formData.get("levelScope") || "all"),
  });
  revalidateRolesCatalog(roleProfileId);
}

export async function unlinkRoleCompetencyAction(formData: FormData) {
  await requireAdminSession();
  const { unlinkCompetencyFromRole } = await import("./roles-catalog");
  const roleProfileId = Number(formData.get("roleProfileId"));
  await unlinkCompetencyFromRole(Number(formData.get("linkId")));
  revalidateRolesCatalog(roleProfileId);
}

export async function assignLessonToRoleProfileAction(formData: FormData) {
  await requireAdminSession();
  const { assignLessonToRole } = await import("./learning");
  const roleProfileId = Number(formData.get("roleProfileId"));
  const roleTitle = String(formData.get("roleTitle") || "");
  await assignLessonToRole(Number(formData.get("lessonId")), roleTitle);
  revalidateRolesCatalog(roleProfileId);
  revalidatePath("/learning");
}

export async function copyRoleProgramAction(formData: FormData) {
  await requireAdminSession();
  const { copyLessonProgramBetweenRoles } = await import("./roles-catalog");
  const roleProfileId = Number(formData.get("roleProfileId"));
  await copyLessonProgramBetweenRoles(
    String(formData.get("sourceRoleTitle") || ""),
    String(formData.get("targetRoleTitle") || ""),
  );
  revalidateRolesCatalog(roleProfileId);
  revalidatePath("/learning");
}

export async function importRoleCatalogExcelAction(formData: FormData) {
  await requireAdminSession();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Выберите Excel-файл");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  const { importRoleProfilesFromRows } = await import("./roles-catalog");
  await importRoleProfilesFromRows(rows);
  revalidateRolesCatalog();
}

export async function updateLearningLessonAction(formData: FormData) {
  await requireAdminSession();
  const { updateLearningLesson } = await import("./learning");
  await updateLearningLesson({
    id: Number(formData.get("id")),
    title: String(formData.get("title") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    content: String(formData.get("content") ?? ""),
    level: String(formData.get("level") ?? "junior"),
    roleFamilies: parseCsvList(String(formData.get("roleFamilies") ?? "")),
    topics: parseCsvList(String(formData.get("topics") ?? "")),
    durationMin: Number(formData.get("durationMin") || 20),
    isActive: formData.get("isActive") === "1",
  });
  revalidatePath("/learning");
  revalidatePath("/my/learning");
  revalidatePath("/my/tests");
}

export async function deleteLearningLessonAction(formData: FormData) {
  await requireAdminSession();
  const { deleteLearningLesson } = await import("./learning");
  await deleteLearningLesson(Number(formData.get("id")));
  revalidatePath("/learning");
  revalidatePath("/learning-tests");
  revalidatePath("/my/learning");
  revalidatePath("/my/tests");
}

export async function createLearningTestAction(formData: FormData) {
  await requireAdminSession();
  const { createLearningTest } = await import("./learning");
  const { buildDefaultVerificationQuestions } = await import(
    "@/lib/verification-tests"
  );
  const lessonId = Number(formData.get("lessonId"));
  const title = String(formData.get("title") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const level = String(formData.get("level") ?? "junior");
  const topics = parseCsvList(String(formData.get("topics") ?? ""));
  await createLearningTest({
    slug,
    lessonId,
    title,
    summary: String(formData.get("summary") ?? ""),
    level,
    roleFamilies: parseCsvList(String(formData.get("roleFamilies") ?? "general")),
    topics,
    durationMin: Number(formData.get("durationMin") || 10),
    questions: buildDefaultVerificationQuestions({
      id: slug,
      title,
      topics,
      level,
    }),
    assessmentId: Number(formData.get("assessmentId") || 0) || null,
  });
  revalidatePath("/learning-tests");
  revalidatePath("/my/tests");
}

export async function updateLearningTestAction(formData: FormData) {
  await requireAdminSession();
  const { updateLearningTest, listLearningTestsAdmin } = await import(
    "./learning"
  );
  const id = Number(formData.get("id"));
  const existing = (await listLearningTestsAdmin()).find((t) => t.dbId === id);
  await updateLearningTest({
    id,
    lessonId: Number(formData.get("lessonId")),
    title: String(formData.get("title") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    level: String(formData.get("level") ?? "junior"),
    roleFamilies: parseCsvList(String(formData.get("roleFamilies") ?? "")),
    topics: parseCsvList(String(formData.get("topics") ?? "")),
    durationMin: Number(formData.get("durationMin") || 10),
    questions: existing?.questions ?? [],
    assessmentId: Number(formData.get("assessmentId") || 0) || null,
    isActive: formData.get("isActive") === "1",
  });
  revalidatePath("/learning-tests");
  revalidatePath("/my/tests");
}

export async function deleteLearningTestAction(formData: FormData) {
  await requireAdminSession();
  const { deleteLearningTest } = await import("./learning");
  await deleteLearningTest(Number(formData.get("id")));
  revalidatePath("/learning-tests");
  revalidatePath("/my/tests");
}

export async function markLessonLearnedAction(formData: FormData) {
  const session = await getSession();
  if (
    !session ||
    session.role !== "participant" ||
    !session.employeeId ||
    (session.participantKind !== "employee" &&
      session.participantKind !== "intern")
  ) {
    throw new Error("Недостаточно прав");
  }
  const lessonId = Number(formData.get("lessonId"));
  if (session.participantKind === "intern") {
    const { getInternAllowedContentIds } = await import("./mentorship");
    const allowed = await getInternAllowedContentIds(session.employeeId);
    if (!allowed.lessonIds.has(lessonId)) {
      throw new Error("Этот урок недоступен на стажировке");
    }
  }
  const { markLessonLearned, getLessonLinkedTest } = await import("./learning");
  const linked = await getLessonLinkedTest(lessonId);
  if (!linked) {
    throw new Error("Нет теста для этого урока");
  }
  await markLessonLearned(session.employeeId, lessonId);
  revalidatePath("/my/learning");
  revalidatePath("/my/tests");
  redirect(`/my/tests/check/${linked.id}`);
}

export async function updateLessonWorkflowAction(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Недостаточно прав");

  const lessonId = Number(formData.get("lessonId"));
  const employeeIdRaw = Number(formData.get("employeeId"));
  const status = String(formData.get("status") ?? "").trim();
  const answerText = String(formData.get("answerText") ?? "");
  const answerFileUrl = String(formData.get("answerFileUrl") ?? "");
  const mentorComment = String(formData.get("mentorComment") ?? "");

  let employeeId = session.employeeId ?? 0;
  let reviewedByUserId: number | null = null;

  if (session.role === "participant") {
    if (
      !session.employeeId ||
      (session.participantKind !== "employee" &&
        session.participantKind !== "intern")
    ) {
      throw new Error("Недостаточно прав");
    }
    employeeId = session.employeeId;
    if (!["studying", "submitted", "fixing"].includes(status)) {
      throw new Error("Недопустимый статус для участника");
    }
    if (session.participantKind === "employee") {
      const { getEmployeeLearningProgram } = await import("./learning-programs");
      const program = await getEmployeeLearningProgram(session.employeeId);
      const item = program?.items.find((row) => row.lessonId === lessonId);
      if (item?.blockedByOverdue) {
        throw new Error("Сначала закройте просроченный предыдущий урок");
      }
    }
    if (
      status === "submitted" &&
      !answerText.trim() &&
      !answerFileUrl.trim()
    ) {
      throw new Error("Опишите выполненную практику или приложите ссылку на файл");
    }
  } else if (session.role === "admin" || session.role === "manager") {
    employeeId = employeeIdRaw;
    reviewedByUserId = session.userId;
    if (!employeeId) throw new Error("Не указан сотрудник");
  } else {
    throw new Error("Недостаточно прав");
  }

  const { upsertLessonWorkflow } = await import("./learning-programs");
  await upsertLessonWorkflow({
    employeeId,
    lessonId,
    status: status as import("@/lib/learning-program").LessonWorkflowStatus,
    answerText,
    answerFileUrl,
    mentorComment: reviewedByUserId != null ? mentorComment : undefined,
    reviewedByUserId,
  });

  revalidatePath("/my/learning");
  revalidatePath(`/my/learning/${lessonId}`);
  revalidatePath("/learning");
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/observer/mentees");
  revalidatePath("/mentors");
  if (session.role === "participant") {
    redirect(`/my/learning/${lessonId}`);
  }
  if (session.role === "manager") {
    redirect("/observer/mentees");
  }
  redirect(`/employees/${employeeId}`);
}

export async function saveMentorCompetenciesAction(formData: FormData) {
  await requireAdminSession();
  const mentorUserId = Number(formData.get("mentorUserId"));
  if (!mentorUserId) throw new Error("Не указан наставник");
  const competencies = String(formData.get("competencies") || "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
  const { updateMentorCompetencies } = await import("./mentors");
  await updateMentorCompetencies(mentorUserId, competencies);
  revalidatePath("/mentors");
}

export async function mentorReportHrAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "manager") {
    throw new Error("Недостаточно прав");
  }
  const employeeId = Number(formData.get("employeeId"));
  const message = String(formData.get("message") || "").trim();
  if (!employeeId || !message) throw new Error("Укажите сотрудника и проблему");
  const { mentorReportToHr } = await import("./mentors");
  await mentorReportToHr({
    mentorUserId: session.userId,
    mentorName: session.name,
    employeeId,
    message,
  });
  revalidatePath("/observer/mentees");
  revalidatePath(`/employees/${employeeId}`);
}

export async function mentorRecommendLevelAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "manager") {
    throw new Error("Недостаточно прав");
  }
  const employeeId = Number(formData.get("employeeId"));
  const toLevel = String(formData.get("toLevel") || "").trim();
  if (!employeeId || !toLevel) throw new Error("Укажите уровень");
  const { recommendNextLevel } = await import("./mentors");
  await recommendNextLevel({
    mentorUserId: session.userId,
    employeeId,
    toLevel,
    comment: String(formData.get("comment") || ""),
  });
  revalidatePath("/observer/mentees");
  revalidatePath(`/employees/${employeeId}`);
}

export async function mentorConfirmCompetencyAction(formData: FormData) {
  const session = await getSession();
  if (!session || (session.role !== "manager" && session.role !== "admin")) {
    throw new Error("Недостаточно прав");
  }
  const employeeId = Number(formData.get("employeeId"));
  const competencyId = Number(formData.get("competencyId"));
  const status = String(formData.get("status") || "middle").trim();
  if (!employeeId || !competencyId) throw new Error("Неполные данные");

  if (session.role === "manager") {
    const { getEmployeeById: load } = await import("./queries");
    const detail = await load(employeeId);
    if (!detail) throw new Error("Сотрудник не найден");

    const { managerCanReviewIntern } = await import("./mentorship");
    const allowed =
      detail.employee.mentorUserId === session.userId ||
      (await managerCanReviewIntern(session.userId, employeeId));
    if (!allowed) throw new Error("Этот сотрудник не закреплён за вами");
  }

  const { upsertEmployeeCompetency } = await import("./queries");
  await upsertEmployeeCompetency({
    employeeId,
    competencyId,
    status,
    note: String(formData.get("note") || "Подтверждено наставником"),
    updatedByUserId: session.userId,
  });
  revalidatePath("/observer/mentees");
  revalidatePath(`/employees/${employeeId}`);
}

export async function submitMentorRatingAction(formData: FormData) {
  const session = await getSession();
  if (
    !session ||
    session.role !== "participant" ||
    !session.employeeId ||
    (session.participantKind !== "employee" &&
      session.participantKind !== "intern")
  ) {
    throw new Error("Недостаточно прав");
  }
  const mentorUserId = Number(formData.get("mentorUserId"));
  const score = Number(formData.get("score") || 5);
  if (!mentorUserId) throw new Error("Не указан наставник");
  const { upsertMentorRating } = await import("./mentors");
  await upsertMentorRating({
    mentorUserId,
    fromEmployeeId: session.employeeId,
    score,
    comment: String(formData.get("comment") || ""),
  });
  revalidatePath("/my/profile");
  revalidatePath("/my/mentor");
  revalidatePath("/mentors");
}

export async function rebuildEmployeeLearningProgramAction(formData: FormData) {
  await requireAdminSession();
  const employeeId = Number(formData.get("employeeId"));
  if (!employeeId) throw new Error("Не указан сотрудник");
  const { ensureEmployeeLearningProgram } = await import("./learning-programs");
  await ensureEmployeeLearningProgram(employeeId);
  revalidatePath("/learning");
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/my/learning");
  redirect(`/employees/${employeeId}`);
}

export async function rebuildAllLearningProgramsAction() {
  await requireAdminSession();
  const { getEmployeesDirectory } = await import("./queries");
  const { ensureEmployeeLearningProgram } = await import("./learning-programs");
  const people = await getEmployeesDirectory();
  for (const person of people.slice(0, 120)) {
    try {
      await ensureEmployeeLearningProgram(person.id);
    } catch {
      // skip broken rows
    }
  }
  revalidatePath("/learning");
  redirect("/learning");
}

export async function createAttestationAction(formData: FormData) {
  await requireAdminSession();
  const { createAttestation } = await import("./learning");
  const startsAt = parseFormDate(String(formData.get("startsAt") ?? ""));
  const endsAt = parseFormDate(
    String(formData.get("endsAt") ?? ""),
    new Date(Date.now() + 14 * 86400000),
  );
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    throw new Error("Дата окончания должна быть позже даты начала");
  }
  const row = await createAttestation({
    title: String(formData.get("title") ?? "Аттестация"),
    description: String(formData.get("description") ?? ""),
    department: String(formData.get("department") ?? ""),
    positionTitles: formData
      .getAll("positionTitle")
      .map((value) => String(value).trim())
      .filter(Boolean),
    startsAt,
    endsAt,
    durationMinutes: Number(formData.get("durationMinutes") || 40),
    passingScore: Number(formData.get("passingScore") || 70),
    isActive: formData.get("isActive") === "on",
    libraryAssessmentId: Number(formData.get("libraryAssessmentId") || 0) || null,
  });
  revalidatePath("/attestation");
  revalidatePath("/my/attestation");
  redirect(`/attestation/${row.id}`);
}

export async function saveAttestationAction(formData: FormData) {
  await requireAdminSession();
  const { updateAttestation } = await import("./learning");
  const id = Number(formData.get("attestationId"));
  if (!id) throw new Error("Не указана аттестация");
  const startsAt = parseFormDate(String(formData.get("startsAt") ?? ""));
  const endsAt = parseFormDate(
    String(formData.get("endsAt") ?? ""),
    new Date(Date.now() + 14 * 86400000),
  );
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    throw new Error("Дата окончания должна быть позже даты начала");
  }
  await updateAttestation({
    id,
    title: String(formData.get("title") ?? "Аттестация"),
    description: String(formData.get("description") ?? ""),
    department: String(formData.get("department") ?? ""),
    positionTitles: formData
      .getAll("positionTitle")
      .map((value) => String(value).trim())
      .filter(Boolean),
    startsAt,
    endsAt,
    durationMinutes: Number(formData.get("durationMinutes") || 40),
    passingScore: Number(formData.get("passingScore") || 70),
    isActive: formData.get("isActive") === "on",
    libraryAssessmentId: Number(formData.get("libraryAssessmentId") || 0) || null,
  });
  revalidatePath("/attestation");
  revalidatePath(`/attestation/${id}`);
  revalidatePath("/my/attestation");
}

export async function createAttestationReviewAction(formData: FormData) {
  await requireAdminSession();
  const attestationId = Number(formData.get("attestationId"));
  const employeeId = Number(formData.get("employeeId"));
  if (!attestationId || !employeeId) {
    throw new Error("Выберите сотрудника");
  }
  const { createAttestationReview } = await import("./attestation-reviews");
  const review = await createAttestationReview({
    attestationId,
    employeeId,
    type: String(formData.get("type") || "final_3_months"),
    scheduledAt: String(formData.get("scheduledAt") || "") || null,
    commission: String(formData.get("commission") || "")
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean),
  });
  revalidatePath(`/attestation/${attestationId}`);
  revalidatePath("/attestation");
  redirect(`/attestation/reviews/${review.id}`);
}

function optionalScore(formData: FormData, name: string) {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error("Оценка должна быть от 0 до 100");
  }
  return value;
}

export async function saveAttestationReviewAction(formData: FormData) {
  await requireAdminSession();
  const id = Number(formData.get("reviewId"));
  const attestationId = Number(formData.get("attestationId"));
  if (!id) throw new Error("Не указана карточка аттестации");
  const splitList = (name: string) =>
    String(formData.get(name) || "")
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  const { saveAttestationReview } = await import("./attestation-reviews");
  await saveAttestationReview({
    id,
    type: String(formData.get("type") || "final_3_months"),
    status: String(formData.get("status") || "in_progress"),
    scheduledAt: String(formData.get("scheduledAt") || new Date().toISOString()),
    commission: splitList("commission"),
    signatures: splitList("signatures"),
    weakCompetencies: splitList("weakCompetencies"),
    scores: {
      practicalScore: optionalScore(formData, "practicalScore"),
      projectScore: optionalScore(formData, "projectScore"),
      defenseScore: optionalScore(formData, "defenseScore"),
      independenceScore: optionalScore(formData, "independenceScore"),
      disciplineScore: optionalScore(formData, "disciplineScore"),
      mentorScore: optionalScore(formData, "mentorScore"),
      managerScore: optionalScore(formData, "managerScore"),
    },
    mentorComment: String(formData.get("mentorComment") || ""),
    managerComment: String(formData.get("managerComment") || ""),
    commissionComment: String(formData.get("commissionComment") || ""),
    decision: String(formData.get("decision") || ""),
    nextCheckAt: String(formData.get("nextCheckAt") || "") || null,
  });
  revalidatePath(`/attestation/reviews/${id}`);
  if (attestationId) revalidatePath(`/attestation/${attestationId}`);
  revalidatePath("/attestation");
  revalidatePath("/employees");
  revalidatePath("/my/attestation");
}

export async function startAttestationAction(formData: FormData) {
  const session = await getSession();
  if (
    !session ||
    session.role !== "participant" ||
    !session.employeeId ||
    session.participantKind !== "employee"
  ) {
    throw new Error("Недостаточно прав");
  }
  const {
    getAttestationById,
    ensureAttestationAssignment,
  } = await import("./learning");
  const { getEmployeeById } = await import("./queries");
  const { employeeMatchesAttestation, attestationWindowStatus } = await import(
    "@/lib/attestation"
  );
  const id = Number(formData.get("attestationId"));
  const att = await getAttestationById(id);
  if (!att || !att.isActive) throw new Error("Аттестация не найдена");
  if (!att.assessmentId) throw new Error("Тест аттестации ещё не создан");
  if (att.questionCount < 1) throw new Error("В аттестации нет вопросов");
  if (attestationWindowStatus(att.startsAt, att.endsAt) !== "open") {
    throw new Error("Аттестация сейчас недоступна");
  }
  const detail = await getEmployeeById(session.employeeId);
  if (!detail) throw new Error("Сотрудник не найден");
  if (
    !employeeMatchesAttestation({
      department: detail.employee.department,
      roleTitle: detail.employee.roleTitle,
      attestationDepartment: att.department,
      positionTitles: att.positionTitles,
    })
  ) {
    throw new Error("Эта аттестация не назначена вашей должности");
  }
  const assignment = await ensureAttestationAssignment({
    employeeId: session.employeeId,
    assessmentId: att.assessmentId,
    dueAt: att.endsAt,
  });
  redirect(`/my/take/${assignment.id}`);
}

export async function approvePromotionAction(formData: FormData) {
  const session = await requireManagerSession();
  const requestId = Number(formData.get("requestId"));
  if (!requestId) throw new Error("Не указан запрос");
  const { getPlatformUserById } = await import("./queries");
  const { decidePromotionRequest } = await import("./promotions");
  const user = await getPlatformUserById(session.userId);
  await decidePromotionRequest({
    requestId,
    reviewerUserId: session.userId,
    managerDepartment: user?.profileDepartment ?? "",
    decision: "approved",
    comment: String(formData.get("comment") ?? ""),
  });
  revalidatePath("/observer/approvals");
  revalidatePath("/observer");
  revalidatePath("/my/tests");
  revalidatePath("/my/attestation");
  revalidatePath("/employees");
}

export async function rejectPromotionAction(formData: FormData) {
  const session = await requireManagerSession();
  const requestId = Number(formData.get("requestId"));
  if (!requestId) throw new Error("Не указан запрос");
  const { getPlatformUserById } = await import("./queries");
  const { decidePromotionRequest } = await import("./promotions");
  const user = await getPlatformUserById(session.userId);
  await decidePromotionRequest({
    requestId,
    reviewerUserId: session.userId,
    managerDepartment: user?.profileDepartment ?? "",
    decision: "rejected",
    comment: String(formData.get("comment") ?? ""),
  });
  revalidatePath("/observer/approvals");
  revalidatePath("/observer");
  revalidatePath("/my/tests");
  revalidatePath("/my/attestation");
}

export async function updateInternMentorshipAction(formData: FormData) {
  await requireAdminSession();
  const employeeId = Number(formData.get("employeeId"));
  if (!employeeId) throw new Error("Не указан сотрудник");
  const mentorRaw = String(formData.get("mentorUserId") ?? "").trim();
  const mentorUserId = mentorRaw ? Number(mentorRaw) : null;
  const trialStartsAt = String(formData.get("trialStartsAt") ?? "").trim();
  const trialEndsAt = String(formData.get("trialEndsAt") ?? "").trim();

  const { ensureInternMentorship } = await import("./mentorship");
  await ensureInternMentorship({
    internEmployeeId: employeeId,
    source: "admin_override",
    mentorUserId: mentorUserId && !Number.isNaN(mentorUserId) ? mentorUserId : null,
    trialStartsAt: trialStartsAt
      ? new Date(`${trialStartsAt}T00:00:00`).toISOString()
      : null,
    trialEndsAt: trialEndsAt
      ? new Date(`${trialEndsAt}T23:59:59`).toISOString()
      : null,
    notify: true,
  });

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/observer/mentees");
  redirect(`/employees/${employeeId}`);
}

export async function addInternStandardLessonAction(formData: FormData) {
  await requireAdminSession();
  const lessonId = Number(formData.get("lessonId"));
  if (!lessonId) throw new Error("Не указан урок");
  const { addInternStandardItem } = await import("./mentorship");
  await addInternStandardItem({ itemType: "lesson", lessonId });
  revalidatePath("/learning");
  revalidatePath("/my/learning");
  revalidatePath("/my/tests");
}

export async function removeInternStandardItemAction(formData: FormData) {
  await requireAdminSession();
  const id = Number(formData.get("id"));
  if (!id) throw new Error("Не указан элемент");
  const { removeInternStandardItem } = await import("./mentorship");
  await removeInternStandardItem(id);
  revalidatePath("/learning");
  revalidatePath("/my/learning");
  revalidatePath("/my/tests");
}

export async function assignInternContentAction(formData: FormData) {
  const session = await getSession();
  if (!session || (session.role !== "manager" && session.role !== "admin")) {
    throw new Error("Недостаточно прав");
  }
  const internEmployeeId = Number(formData.get("internEmployeeId"));
  const lessonId = Number(formData.get("lessonId"));
  if (!internEmployeeId || !lessonId) throw new Error("Неполные данные");

  if (session.role === "manager") {
    const { getActiveMentorship } = await import("./mentorship");
    const mentorship = await getActiveMentorship(internEmployeeId);
    if (!mentorship || mentorship.mentorUserId !== session.userId) {
      throw new Error("Этот стажёр не закреплён за вами");
    }
  }

  const { assignInternContent } = await import("./mentorship");
  await assignInternContent({
    internEmployeeId,
    assignedByUserId: session.userId,
    source: session.role === "admin" ? "admin" : "mentor",
    itemType: "lesson",
    lessonId,
  });
  revalidatePath(`/observer/mentees/${internEmployeeId}`);
  revalidatePath("/my/learning");
  revalidatePath("/my/tests");
}

export async function unassignInternContentAction(formData: FormData) {
  const session = await getSession();
  if (!session || (session.role !== "manager" && session.role !== "admin")) {
    throw new Error("Недостаточно прав");
  }
  const assignmentId = Number(formData.get("assignmentId"));
  const internEmployeeId = Number(formData.get("internEmployeeId"));
  if (!assignmentId) throw new Error("Не указано назначение");

  if (session.role === "manager" && internEmployeeId) {
    const { getActiveMentorship } = await import("./mentorship");
    const mentorship = await getActiveMentorship(internEmployeeId);
    if (!mentorship || mentorship.mentorUserId !== session.userId) {
      throw new Error("Этот стажёр не закреплён за вас");
    }
  }

  const { unassignInternContent } = await import("./mentorship");
  await unassignInternContent(assignmentId);
  if (internEmployeeId) {
    revalidatePath(`/observer/mentees/${internEmployeeId}`);
  }
  revalidatePath("/my/learning");
  revalidatePath("/my/tests");
}

export async function decideMentorshipAction(formData: FormData) {
  const session = await getSession();
  if (!session || (session.role !== "manager" && session.role !== "admin")) {
    throw new Error("Недостаточно прав");
  }
  const mentorshipId = Number(formData.get("mentorshipId"));
  const decision = String(formData.get("decision") ?? "");
  const internEmployeeId = Number(formData.get("internEmployeeId"));
  const { isTrialDecision } = await import("@/lib/trial-period");
  if (!mentorshipId || !isTrialDecision(decision)) {
    throw new Error("Некорректное решение");
  }

  if (session.role === "manager") {
    const { getActiveMentorship } = await import("./mentorship");
    const mentorship = await getActiveMentorship(internEmployeeId);
    if (
      !mentorship ||
      mentorship.id !== mentorshipId ||
      mentorship.mentorUserId !== session.userId
    ) {
      throw new Error("Этот стажёр не закреплён за вами");
    }
  }

  const trialEndsRaw = String(formData.get("trialEndsAt") ?? "").trim();
  const positionIdRaw = String(formData.get("positionId") ?? "").trim();
  const repeatDayRaw = Number(formData.get("repeatDay") || 0);
  const { decideMentorship } = await import("./mentorship");
  await decideMentorship({
    mentorshipId,
    actorUserId: session.userId,
    decision,
    trialEndsAt: trialEndsRaw
      ? new Date(`${trialEndsRaw}T23:59:59`).toISOString()
      : null,
    comment: String(formData.get("comment") ?? ""),
    positionId: positionIdRaw ? Number(positionIdRaw) : null,
    repeatDay: Number.isFinite(repeatDayRaw) ? repeatDayRaw : null,
  });

  revalidatePath("/observer/mentees");
  revalidatePath(`/observer/mentees/${internEmployeeId}`);
  revalidatePath("/employees");
  revalidatePath("/interns");
  revalidatePath("/trial");
  revalidatePath("/my");
  const returnTo = String(formData.get("returnTo") ?? "").trim();
  if (returnTo === "/trial" || returnTo === "/interns") {
    redirect(returnTo);
  }
  redirect("/observer/mentees");
}

export async function markNotificationReadAction(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Недостаточно прав");
  const id = Number(formData.get("notificationId"));
  if (!id) throw new Error("Не указано уведомление");
  const { markNotificationRead } = await import("./mentorship");
  await markNotificationRead(id, session.userId);
  revalidatePath("/observer/mentees");
  revalidatePath("/observer");
  revalidatePath("/my/notifications");
}

export async function markAllNotificationsReadAction() {
  const session = await getSession();
  if (!session) throw new Error("Недостаточно прав");
  const { markAllNotificationsRead } = await import("./mentorship");
  await markAllNotificationsRead(session.userId);
  revalidatePath("/observer/mentees");
  revalidatePath("/observer");
  revalidatePath("/my/notifications");
}

function parseDailyQuestionsFromForm(formData: FormData) {
  const prompts = formData.getAll("qPrompt").map((v) => String(v));
  return prompts
    .map((prompt, index) => {
      const options = [0, 1, 2, 3]
        .map((opt) => String(formData.get(`q${index}_opt${opt}`) ?? "").trim())
        .filter(Boolean);
      const correctRaw = Number(formData.get(`q${index}_correct`));
      return {
        id: `q${index + 1}`,
        prompt: prompt.trim(),
        options,
        correctIndex: Number.isFinite(correctRaw)
          ? Math.max(0, Math.min(Math.max(options.length - 1, 0), correctRaw))
          : 0,
      };
    })
    .filter((q) => q.prompt && q.options.length >= 2);
}

export async function createInternDailyTestAction(formData: FormData) {
  await requireAdminSession();
  const { createInternDailyTest } = await import("./intern-reports");
  await createInternDailyTest({
    title: String(formData.get("title") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    questions: parseDailyQuestionsFromForm(formData),
  });
  revalidatePath("/learning");
  revalidatePath("/my/daily-report");
}

export async function updateInternDailyTestAction(formData: FormData) {
  await requireAdminSession();
  const id = Number(formData.get("id"));
  if (!id) throw new Error("Не указан тест");
  const { updateInternDailyTest } = await import("./intern-reports");
  await updateInternDailyTest({
    id,
    title: String(formData.get("title") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    questions: parseDailyQuestionsFromForm(formData),
    isActive: String(formData.get("isActive") ?? "1") !== "0",
  });
  revalidatePath("/learning");
  revalidatePath("/my/daily-report");
}

export async function toggleInternDailyTestAction(formData: FormData) {
  await requireAdminSession();
  const id = Number(formData.get("id"));
  const isActive = String(formData.get("isActive") ?? "") === "1";
  if (!id) throw new Error("Не указан тест");
  const { setInternDailyTestActive } = await import("./intern-reports");
  await setInternDailyTestActive(id, isActive);
  revalidatePath("/learning");
  revalidatePath("/my/daily-report");
}

export async function createInternDailyScheduleAction(formData: FormData) {
  const session = await requireAdminSession();
  const testId = Number(formData.get("testId"));
  const reportDate = String(formData.get("reportDate") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  const internRaw = String(formData.get("internEmployeeId") ?? "").trim();
  const internEmployeeId = internRaw ? Number(internRaw) : null;
  if (!testId || !reportDate) throw new Error("Укажите дату и тест");

  const { createInternDailySchedule } = await import("./intern-reports");
  await createInternDailySchedule({
    reportDate,
    testId,
    department,
    internEmployeeId,
    createdByUserId: session.userId,
  });
  revalidatePath("/learning");
  revalidatePath("/my/daily-report");
}

export async function deleteInternDailyScheduleAction(formData: FormData) {
  await requireAdminSession();
  const id = Number(formData.get("id"));
  if (!id) throw new Error("Не указано назначение");
  const { deleteInternDailySchedule } = await import("./intern-reports");
  await deleteInternDailySchedule(id);
  revalidatePath("/learning");
  revalidatePath("/my/daily-report");
}

export async function submitInternDailyReportAction(formData: FormData) {
  const session = await getSession();
  if (
    !session ||
    session.role !== "participant" ||
    session.participantKind !== "intern" ||
    !session.employeeId
  ) {
    throw new Error("Недостаточно прав");
  }

  const { submitInternDailyReport } = await import("./intern-reports");
  await submitInternDailyReport({
    internEmployeeId: session.employeeId,
    fields: {
      studiedToday: String(formData.get("studiedToday") ?? ""),
      didIndependently: String(formData.get("didIndependently") ?? ""),
      proofUrl: String(formData.get("proofUrl") ?? ""),
      errorText: String(formData.get("errorText") ?? ""),
      fixText: String(formData.get("fixText") ?? ""),
      canDoWithoutHelp: String(formData.get("canDoWithoutHelp") ?? ""),
    },
  });
  revalidatePath("/my/daily-report");
  revalidatePath("/my/statistics");
  revalidatePath("/observer/mentees");
}

export async function reviewInternDailyReportAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "manager") {
    throw new Error("Недостаточно прав");
  }
  const reportId = Number(formData.get("reportId"));
  const internEmployeeId = Number(formData.get("internEmployeeId"));
  if (!reportId) throw new Error("Не указан отчёт");

  const { reviewInternDailyReport } = await import("./intern-reports");
  await reviewInternDailyReport({
    reportId,
    mentorUserId: session.userId,
    mentorQuestion: String(formData.get("mentorQuestion") ?? ""),
    mentorMiniTask: String(formData.get("mentorMiniTask") ?? ""),
    scoreKnowledge: Number(formData.get("scoreKnowledge")),
    scorePractice: Number(formData.get("scorePractice")),
    scoreIndependence: Number(formData.get("scoreIndependence")),
    conclusion: String(formData.get("conclusion") ?? ""),
    planTomorrow: String(formData.get("planTomorrow") ?? ""),
    comment: String(formData.get("comment") ?? ""),
  });
  revalidatePath(`/observer/mentees/${internEmployeeId}`);
  revalidatePath("/observer/mentees");
  revalidatePath("/my/daily-report");
}

export async function sendReportToManagersAction(input: {
  section: string;
  from: string | null;
  to: string | null;
  department: string | null;
  employeeId: number | null;
}) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    throw new Error("Нет доступа");
  }
  const { isReportSection } = await import("@/lib/report-filters");
  if (!isReportSection(input.section)) throw new Error("Неизвестный отчёт");

  const { createNotification } = await import("./mentorship");
  const { db } = await import("./index");
  const { platformUsers, employees } = await import("./schema");
  const { and, eq } = await import("drizzle-orm");

  const managers = await db
    .select({
      id: platformUsers.id,
      employeeId: platformUsers.employeeId,
    })
    .from(platformUsers)
    .where(
      and(
        eq(platformUsers.isActive, true),
        inArray(platformUsers.role, ["admin", "observer", "manager"]),
      ),
    );

  let targets = managers;
  if (input.department) {
    const empRows = await db
      .select({ id: employees.id, department: employees.department })
      .from(employees);
    const inDept = new Set(
      empRows
        .filter((row) => row.department === input.department)
        .map((row) => row.id),
    );
    targets = managers.filter(
      (row) =>
        row.employeeId == null ||
        inDept.has(row.employeeId) ||
        row.id === session.userId,
    );
  }

  const qs = new URLSearchParams();
  if (input.from) qs.set("from", input.from);
  if (input.to) qs.set("to", input.to);
  if (input.department) qs.set("department", input.department);
  if (input.employeeId) qs.set("employeeId", String(input.employeeId));
  const href = `/reports/${input.section}${qs.toString() ? `?${qs}` : ""}`;

  const title = `Отчёт: ${input.section}`;
  const body = [
    input.from || input.to
      ? `Период: ${input.from ?? "…"} — ${input.to ?? "…"}`
      : "Период: весь",
    input.department ? `Отдел: ${input.department}` : "Отдел: все",
  ].join(". ");

  for (const user of targets) {
    await createNotification({
      userId: user.id,
      type: "report_share",
      title,
      body,
      href,
      payload: {
        section: input.section,
        from: input.from,
        to: input.to,
        department: input.department,
        employeeId: input.employeeId,
      },
    });
  }
  return { notified: targets.length };
}

function formFlag(formData: FormData, name: string) {
  return formData.get(name) === "1";
}

async function policyPassword() {
  const { getSettingsSection } = await import("./system-settings");
  const security = await getSettingsSection("security");
  return generatePassword(Math.max(8, security.minPasswordLength || 8));
}

export async function saveIntegrationSettingsAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("Нет доступа");
  const { isIntegrationSystem, saveIntegrationConfig } = await import(
    "./integrations"
  );
  const system = String(formData.get("system") ?? "");
  if (!isIntegrationSystem(system)) throw new Error("Неизвестная система");

  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key === "system") continue;
    if (typeof value !== "string") continue;
    raw[key] = value;
  }
  const flags = [
    "notifyInterviews",
    "notifyTests",
    "notifyHiring",
    "formsEnabled",
    "geoEnabled",
    "transferCandidates",
    "transferTestResults",
    "confirmTrial",
    "hireEmployee",
    "autoCreateLearningTasks",
    "syncUsers",
    "syncDepartments",
    "syncTasks",
    "syncCalendar",
    "syncReports",
    "secure",
    "employeeFoldersEnabled",
  ];
  for (const flag of flags) {
    raw[flag] = formFlag(formData, flag);
  }

  await saveIntegrationConfig(system, raw);
  revalidatePath("/integrations");
  revalidatePath(`/integrations/${system}`);
}

export async function testIntegrationAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("Нет доступа");
  const { isIntegrationSystem, testIntegration } = await import("./integrations");
  const system = String(formData.get("system") ?? "");
  if (!isIntegrationSystem(system)) throw new Error("Неизвестная система");
  const result = await testIntegration(system);
  revalidatePath("/integrations");
  revalidatePath(`/integrations/${system}`);
  revalidatePath("/integrations/log");
  void result;
}

export async function retryIntegrationLogAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("Нет доступа");
  const id = Number(formData.get("logId"));
  if (!id) throw new Error("Нет записи");
  const { retryIntegrationLog } = await import("./integrations");
  await retryIntegrationLog(id);
  revalidatePath("/integrations/log");
}

export async function sendIntegrationProbeAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("Нет доступа");
  const kind = String(formData.get("kind") ?? "");
  if (kind === "telegram") {
    const { sendTelegramToChat } = await import("./integrations");
    await sendTelegramToChat({
      chatId: String(formData.get("chatId") ?? "").trim(),
      text: String(formData.get("text") ?? "Проверка AKELA Assess").trim() ||
        "Проверка AKELA Assess",
      operation: "manual_probe",
    });
  } else if (kind === "smtp") {
    const { sendSmtp } = await import("./integrations");
    await sendSmtp({
      to: String(formData.get("to") ?? "").trim(),
      subject: "AKELA Assess",
      text: String(formData.get("text") ?? "Проверка почты").trim() || "Проверка почты",
      operation: "manual_probe",
    });
  } else if (kind === "verifix") {
    const { pushVerifix, getStoredConfig } = await import("./integrations");
    const config = await getStoredConfig("verifix");
    await pushVerifix({
      path: config.candidatesPath,
      operation: "manual_probe",
      payload: { ping: true, name: "AKELA probe" },
    });
  } else if (kind === "bitrix") {
    const { getStoredConfig, logAndRun } = await import("./integrations");
    const { bitrixCall } = await import("@/lib/integration-clients");
    const config = await getStoredConfig("bitrix");
    await logAndRun("bitrix", "manual_probe", () =>
      bitrixCall(config, "tasks.task.add.json", {
        fields: {
          TITLE: "AKELA: проверка учебной задачи",
          DESCRIPTION: "Автоматически создано из раздела Интеграции",
        },
      }),
    );
  }
  revalidatePath("/integrations/log");
}

export async function requestPasswordResetAction(formData: FormData) {
  const login = String(formData.get("login") ?? "").trim();
  if (!login) redirect("/login?reset=1");
  const { generatePassword, hashPassword } = await import("@/lib/auth");
  const { sendSmtp, getStoredConfig } = await import("./integrations");
  const { renderTemplate } = await import("@/lib/integrations");
  const { platformUsers, employees } = await import("./schema");
  const { eq } = await import("drizzle-orm");
  const { ensureDb } = await import("./queries");
  await ensureDb();

  const [user] = await db
    .select()
    .from(platformUsers)
    .where(eq(platformUsers.login, login))
    .limit(1);

  if (user) {
    let email = "";
    if (user.employeeId) {
      const [emp] = await db
        .select({ email: employees.email })
        .from(employees)
        .where(eq(employees.id, user.employeeId))
        .limit(1);
      email = emp?.email ?? "";
    }
    const smtp = await getStoredConfig("smtp");
    if (email && smtp.host) {
      const password = await policyPassword();
      await db
        .update(platformUsers)
        .set({
          passwordHash: hashPassword(password),
          passwordPlain: password,
        })
        .where(eq(platformUsers.id, user.id));
      await sendSmtp({
        to: email,
        subject: "Восстановление пароля AKELA Assess",
        text: renderTemplate(smtp.templateReset, {
          password,
          login: user.login,
          name: user.displayName,
        }),
        operation: `password_reset:${user.id}`,
      });
    }
  }
  redirect("/login?reset=1");
}

export async function saveSystemSettingsAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("Нет доступа");
  const { isSettingsSection, saveSettingsSection, writeAuditLog } = await import(
    "./system-settings"
  );
  const section = String(formData.get("section") ?? "");
  if (!isSettingsSection(section)) throw new Error("Неизвестный раздел");
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key === "section") continue;
    if (typeof value !== "string") continue;
    raw[key] = value;
  }
  const flags = [
    "candidateOwnTestOnly",
    "internSeesLessons",
    "mentorSeesMentees",
    "managerSeesDepartment",
    "hrSeesAllCandidates",
    "adminManagesAll",
    "answerKeyHrOnly",
    "randomOrder",
    "forbidReentry",
    "showResultToCandidate",
    "overdueBlocksNext",
    "autoAssignLessons",
    "candidateInvited",
    "interviewConfirmed",
    "testAssigned",
    "testCompleted",
    "lessonOverdue",
    "workReviewed",
    "attestationAssigned",
    "reachedMiddle",
    "twoFactorEnabled",
    "consentRequired",
  ];
  for (const flag of flags) raw[flag] = formFlag(formData, flag);
  await saveSettingsSection(section, raw);
  await writeAuditLog({
    actorUserId: session.userId,
    actorName: session.name,
    action: "settings.save",
    target: section,
    result: "ok",
  });
  revalidatePath("/settings");
  revalidatePath(`/settings/${section}`);
  revalidatePath("/");
  revalidatePath("/login");
}

export async function setPlatformUserActiveAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("Нет доступа");
  const userId = Number(formData.get("userId"));
  const isActive = formData.get("isActive") === "1";
  if (!userId) throw new Error("Нет пользователя");
  const { setPlatformUserActive, writeAuditLog } = await import(
    "./system-settings"
  );
  const row = await setPlatformUserActive(userId, isActive);
  await writeAuditLog({
    actorUserId: session.userId,
    actorName: session.name,
    action: isActive ? "user.unblock" : "user.block",
    target: row?.login ?? String(userId),
    result: "ok",
  });
  revalidatePath("/access");
  revalidatePath("/settings");
}

function revalidateManagerCabinet() {
  revalidatePath("/observer/home");
  revalidatePath("/observer/team");
  revalidatePath("/observer/tasks");
  revalidatePath("/observer/newcomers");
  revalidatePath("/observer/training");
  revalidatePath("/observer/kpi");
  revalidatePath("/observer/attestations");
  revalidatePath("/observer/meetings");
  revalidatePath("/observer/growth");
  revalidatePath("/observer/reports");
  revalidatePath("/observer/notifications");
}

export async function createManagerTaskAction(formData: FormData) {
  const session = await requireManagerSession();
  const employeeId = Number(formData.get("employeeId"));
  const title = String(formData.get("title") ?? "").trim();
  if (!employeeId || !title) throw new Error("Заполните сотрудника и задачу");
  const { getManagerContext } = await import("./manager-cabinet");
  const ctx = await getManagerContext(session.userId);
  if (!ctx?.teamIds.includes(employeeId)) throw new Error("Нет доступа");
  const { managerTasks } = await import("./schema");
  const { db } = await import("./index");
  const dueRaw = String(formData.get("dueAt") ?? "").trim();
  const dueAt = dueRaw ? parseFormDate(dueRaw) : null;
  const priority = String(formData.get("priority") ?? "medium");
  await db.insert(managerTasks).values({
    assignedByUserId: session.userId,
    employeeId,
    title,
    description: String(formData.get("description") ?? "").trim(),
    dueAt,
    priority: ["high", "medium", "low"].includes(priority) ? priority : "medium",
    status: "open",
    updatedAt: new Date().toISOString(),
  });
  revalidateManagerCabinet();
}

export async function updateManagerTaskStatusAction(formData: FormData) {
  const session = await requireManagerSession();
  const taskId = Number(formData.get("taskId"));
  const status = String(formData.get("status") ?? "").trim();
  if (!taskId || !status) throw new Error("Нет задачи");
  const { managerTasks } = await import("./schema");
  const { db } = await import("./index");
  const { eq } = await import("drizzle-orm");
  const [task] = await db
    .select()
    .from(managerTasks)
    .where(eq(managerTasks.id, taskId))
    .limit(1);
  if (!task || task.assignedByUserId !== session.userId) {
    throw new Error("Нет доступа");
  }
  await db
    .update(managerTasks)
    .set({
      status,
      resultNote: String(formData.get("resultNote") ?? task.resultNote),
      completedAt: status === "done" ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(managerTasks.id, taskId));
  revalidateManagerCabinet();
}

export async function createOneOnOneMeetingAction(formData: FormData) {
  const session = await requireManagerSession();
  const employeeId = Number(formData.get("employeeId"));
  const scheduledAt = String(formData.get("scheduledAt") ?? "").trim();
  if (!employeeId || !scheduledAt) throw new Error("Заполните поля");
  const { getManagerContext } = await import("./manager-cabinet");
  const ctx = await getManagerContext(session.userId);
  if (!ctx?.teamIds.includes(employeeId)) throw new Error("Нет доступа");
  const { oneOnOneMeetings } = await import("./schema");
  const { db } = await import("./index");
  await db.insert(oneOnOneMeetings).values({
    managerUserId: session.userId,
    employeeId,
    scheduledAt: parseFormDate(scheduledAt),
    durationMinutes: Number(formData.get("durationMinutes") ?? 30) || 30,
    notes: String(formData.get("notes") ?? "").trim(),
    agreements: String(formData.get("agreements") ?? "").trim(),
    nextGoals: String(formData.get("nextGoals") ?? "").trim(),
    updatedAt: new Date().toISOString(),
  });
  revalidateManagerCabinet();
}

export async function updateOneOnOneMeetingAction(formData: FormData) {
  const session = await requireManagerSession();
  const meetingId = Number(formData.get("meetingId"));
  if (!meetingId) throw new Error("Нет встречи");
  const { oneOnOneMeetings } = await import("./schema");
  const { db } = await import("./index");
  const { eq } = await import("drizzle-orm");
  const [meeting] = await db
    .select()
    .from(oneOnOneMeetings)
    .where(eq(oneOnOneMeetings.id, meetingId))
    .limit(1);
  if (!meeting || meeting.managerUserId !== session.userId) {
    throw new Error("Нет доступа");
  }
  const status = String(formData.get("status") ?? meeting.status);
  await db
    .update(oneOnOneMeetings)
    .set({
      status: ["planned", "done", "cancelled"].includes(status)
        ? status
        : meeting.status,
      notes: String(formData.get("notes") ?? meeting.notes),
      agreements: String(formData.get("agreements") ?? meeting.agreements),
      nextGoals: String(formData.get("nextGoals") ?? meeting.nextGoals),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(oneOnOneMeetings.id, meetingId));
  revalidateManagerCabinet();
}

export async function upsertKpiTargetAction(formData: FormData) {
  const session = await requireManagerSession();
  const employeeId = Number(formData.get("employeeId"));
  const planValue = Number(formData.get("planValue"));
  if (!employeeId || !Number.isFinite(planValue)) throw new Error("Нет данных");
  const { getManagerContext } = await import("./manager-cabinet");
  const ctx = await getManagerContext(session.userId);
  if (!ctx?.teamIds.includes(employeeId)) throw new Error("Нет доступа");
  const period = String(formData.get("period") ?? "").trim() || new Date().toISOString().slice(0, 7);
  const metricKey = String(formData.get("metricKey") ?? "overall").trim() || "overall";
  const factRaw = formData.get("factValue");
  const factValue =
    factRaw != null && String(factRaw).trim() !== ""
      ? Number(factRaw)
      : null;
  const { kpiTargets } = await import("./schema");
  const { db } = await import("./index");
  const { and, eq } = await import("drizzle-orm");
  const [existing] = await db
    .select()
    .from(kpiTargets)
    .where(
      and(
        eq(kpiTargets.employeeId, employeeId),
        eq(kpiTargets.period, period),
        eq(kpiTargets.metricKey, metricKey),
      ),
    )
    .limit(1);
  if (existing) {
    await db
      .update(kpiTargets)
      .set({
        planValue,
        factValue: Number.isFinite(factValue as number) ? factValue : existing.factValue,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(kpiTargets.id, existing.id));
  } else {
    await db.insert(kpiTargets).values({
      employeeId,
      period,
      metricKey,
      planValue,
      factValue: Number.isFinite(factValue as number) ? factValue : null,
      managerUserId: session.userId,
      updatedAt: new Date().toISOString(),
    });
  }
  revalidateManagerCabinet();
}

export async function submitTrialDecisionAction(formData: FormData) {
  const session = await requireManagerSession();
  const internEmployeeId = Number(formData.get("internEmployeeId"));
  const decisionType = String(formData.get("decisionType") ?? "").trim();
  if (!internEmployeeId || !decisionType) throw new Error("Нет решения");
  const { getManagerContext } = await import("./manager-cabinet");
  const ctx = await getManagerContext(session.userId);
  if (!ctx?.teamIds.includes(internEmployeeId)) throw new Error("Нет доступа");
  const { getActiveMentorship, decideMentorship } = await import("./mentorship");
  const mentorship = await getActiveMentorship(internEmployeeId);
  if (!mentorship) throw new Error("Стажировка не найдена");
  const { trialDecisions } = await import("./schema");
  const { db } = await import("./index");
  await db.insert(trialDecisions).values({
    internEmployeeId,
    managerUserId: session.userId,
    day: Number(formData.get("day") ?? 5) || 5,
    score: Number(formData.get("score") ?? "") || null,
    mentorScore: Number(formData.get("mentorScore") ?? "") || null,
    comment: String(formData.get("comment") ?? "").trim(),
    decisionType: ["continue", "extend", "end"].includes(decisionType)
      ? decisionType
      : "continue",
  });
  const mentorshipDecision =
    decisionType === "continue"
      ? "hired"
      : decisionType === "extend"
        ? "extended"
        : decisionType === "end"
          ? "ended"
          : null;
  if (mentorshipDecision) {
    await decideMentorship({
      mentorshipId: mentorship.id,
      actorUserId: session.userId,
      decision: mentorshipDecision,
      comment: String(formData.get("comment") ?? "").trim(),
    });
  }
  revalidateManagerCabinet();
  revalidatePath("/observer/mentees");
}

export async function syncDepartmentManagersAction() {
  await requireAdminSession();
  const { syncDepartmentManagers } = await import("./sync-department-managers");
  const result = await syncDepartmentManagers();
  revalidatePath("/employees");
  revalidatePath("/observer/home");
  revalidatePath("/observer/team");
  revalidatePath("/observer/newcomers");
  revalidatePath("/observer/reports");
  revalidatePath("/observer/kpi");
  const params = new URLSearchParams({
    mgrSync: "1",
    employees: String(result.employees),
    leaders: String(result.leaders),
    created: String(result.ensured.created),
    relinked: String(result.relink.updated),
    updatedManagers: String(result.updatedManagers),
    updatedMentors: String(result.updatedMentors),
    updatedDepartments: String(result.updatedDepartments),
  });
  redirect(`/employees?${params.toString()}`);
}
