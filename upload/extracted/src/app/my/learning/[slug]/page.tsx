import { redirect, notFound } from "next/navigation";
import { ParticipantLessonDetailView } from "@/components/ParticipantLessonDetailView";
import { getEmployeeById, getPlatformUserById } from "@/db/queries";
import {
  getCompletedLessonIds,
  getLessonBySlug,
  getLessonLinkedTest,
} from "@/db/learning";
import { getSession } from "@/lib/auth";
import { isLevelAccessible } from "@/lib/lessons";

export const dynamic = "force-dynamic";

export default async function MyLessonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "participant") redirect("/login");
  if (
    session.participantKind !== "employee" &&
    session.participantKind !== "intern"
  ) {
    redirect("/my/tests");
  }
  if (!session.employeeId) redirect("/login?error=invalid");

  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const [lesson, detail, user, completed] = await Promise.all([
    getLessonBySlug(slug),
    getEmployeeById(session.employeeId),
    getPlatformUserById(session.userId),
    getCompletedLessonIds(session.employeeId),
  ]);
  if (!lesson || !detail) notFound();

  if (!isLevelAccessible(lesson.level, detail.employee.currentLevel)) {
    redirect("/my/learning");
  }

  {
    const { getActiveLessonsForCatalog } = await import("@/db/learning");
    const { isLessonDayUnlocked } = await import("@/lib/learning-program");
    const catalog = (
      await getActiveLessonsForCatalog({
        roleTitle: detail.employee.roleTitle,
      })
    ).map((item) => ({
      ...item,
      completed: completed.has(item.dbId),
    }));
    if (
      catalog.some((item) => item.dbId === lesson.dbId) &&
      !completed.has(lesson.dbId) &&
      !isLessonDayUnlocked(lesson, catalog)
    ) {
      redirect("/my/learning");
    }
  }

  if (session.participantKind === "intern") {
    const { getInternAllowedContentIds } = await import("@/db/mentorship");
    const allowed = await getInternAllowedContentIds(session.employeeId);
    if (!allowed.lessonIds.has(lesson.dbId)) {
      redirect("/my/learning");
    }
  }

  const linkedTest = await getLessonLinkedTest(lesson.dbId);
  const { getLessonWorkflow, getEmployeeLearningProgram } = await import(
    "@/db/learning-programs"
  );
  const [workflow, program] = await Promise.all([
    getLessonWorkflow(session.employeeId, lesson.dbId),
    session.participantKind === "employee"
      ? getEmployeeLearningProgram(session.employeeId)
      : Promise.resolve(null),
  ]);
  const programItem = program?.items.find((item) => item.lessonId === lesson.dbId);
  if (programItem?.blockedByOverdue) {
    redirect("/my/learning");
  }

  return (
    <ParticipantLessonDetailView
      lesson={{
        ...lesson,
        programMonth: lesson.programMonth || programItem?.month || 0,
      }}
      completed={completed.has(lesson.dbId)}
      hasTest={Boolean(linkedTest)}
      linkedTestSlug={linkedTest ? String(linkedTest.id) : null}
      participantKind={session.participantKind}
      themeHue={user?.avatarHue ?? 220}
      workflow={
        workflow || programItem?.deadlineAt
          ? {
              status:
                workflow?.status ||
                programItem?.status ||
                (completed.has(lesson.dbId) ? "credited" : "not_started"),
              answerText: workflow?.answerText ?? "",
              answerFileUrl: workflow?.answerFileUrl ?? "",
              mentorComment: workflow?.mentorComment ?? "",
              deadlineAt: workflow?.deadlineAt ?? programItem?.deadlineAt ?? null,
            }
          : null
      }
      pathMode={programItem?.pathMode ?? "full"}
    />
  );
}
