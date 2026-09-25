import { redirect, notFound } from "next/navigation";
import { ParticipantVerificationTakeView } from "@/components/ParticipantVerificationTakeView";
import {
  getEmployeeById,
  getParticipantAssignmentForTake,
  getPlatformUserById,
} from "@/db/queries";
import {
  getCompletedLessonIds,
  getLearningTestBySlug,
  ensureAttestationAssignment,
} from "@/db/learning";
import { getSession } from "@/lib/auth";
import { isLevelAccessible } from "@/lib/verification-tests";

export const dynamic = "force-dynamic";

export default async function MyVerificationCheckPage({
  params,
}: {
  params: Promise<{ id: string }>;
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

  const { id: rawId } = await params;
  let id = rawId;
  try {
    id = decodeURIComponent(rawId);
  } catch {
    // Keep the original value; the lookup below will return 404 if it is invalid.
  }
  const [test, detail, user, completed] = await Promise.all([
    getLearningTestBySlug(id),
    getEmployeeById(session.employeeId),
    getPlatformUserById(session.userId),
    getCompletedLessonIds(session.employeeId),
  ]);
  if (!test || !detail) notFound();

  if (!isLevelAccessible(test.level, detail.employee.currentLevel)) {
    redirect("/my/tests");
  }
  if (session.participantKind === "intern") {
    const { getInternAllowedContentIds } = await import("@/db/mentorship");
    const allowed = await getInternAllowedContentIds(session.employeeId);
    if (!allowed.testIds.has(test.dbId)) {
      redirect("/my/tests");
    }
  }
  if (!completed.has(test.lessonDbId)) {
    redirect(`/my/learning/${test.lessonId}`);
  }

  if (test.assessmentId) {
    const assignment = await ensureAttestationAssignment({
      employeeId: session.employeeId,
      assessmentId: test.assessmentId,
    });
    const takeData = await getParticipantAssignmentForTake(
      assignment.id,
      session,
    );
    if (takeData) {
      redirect(`/my/take/${assignment.id}`);
    }
  }

  return (
    <ParticipantVerificationTakeView
      test={test}
      participantKind={session.participantKind}
      themeHue={user?.avatarHue ?? 220}
    />
  );
}
