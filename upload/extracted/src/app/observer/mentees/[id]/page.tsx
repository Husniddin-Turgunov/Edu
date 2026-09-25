import { notFound, redirect } from "next/navigation";
import { ManagerMenteeDetailView } from "@/components/ManagerMenteeDetailView";
import { getPlatformUserById, getStaffingPositions } from "@/db/queries";
import { listLearningLessonsAdmin } from "@/db/learning";
import { getMenteeDetail } from "@/db/mentorship";
import { listReportsForMentee } from "@/db/intern-reports";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ManagerMenteeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/observer");

  const { id } = await params;
  const internId = Number(id);
  if (!internId) notFound();

  const [user, detail, lessons, positions, dailyReports] = await Promise.all([
    getPlatformUserById(session.userId),
    getMenteeDetail(session.userId, internId),
    listLearningLessonsAdmin({ limit: 250 }),
    getStaffingPositions(),
    listReportsForMentee(session.userId, internId),
  ]);
  if (!detail) notFound();

  const vacancies = positions
    .filter((p) => !p.employeeId && !/стаж|intern/i.test(p.role))
    .map((p) => ({
      id: p.id,
      role: p.role,
      department: p.department,
    }));

  return (
    <ManagerMenteeDetailView
      themeHue={user?.avatarHue ?? 220}
      intern={{
        id: detail.intern.id,
        name: detail.intern.name,
        roleTitle: detail.intern.roleTitle,
        department: detail.intern.department,
        currentLevel: detail.intern.currentLevel,
      }}
      mentorship={{
        id: detail.mentorship.id,
        trialStartsAt: detail.mentorship.trialStartsAt,
        trialEndsAt: detail.mentorship.trialEndsAt,
        status: detail.mentorship.status,
      }}
      results={detail.employeeResults}
      assignments={detail.assignments.map((a) => ({
        id: a.id,
        itemType: a.itemType,
        source: a.source,
        assignedAt: a.assignedAt,
        lesson: a.lesson
          ? { id: a.lesson.id, title: a.lesson.title, slug: a.lesson.slug }
          : null,
      }))}
      lessonOptions={lessons
        .filter((l) => l.isActive)
        .map((l) => ({
          dbId: l.dbId,
          title: l.title,
          level: l.level,
        }))}
      vacancies={vacancies}
      dailyReports={dailyReports}
    />
  );
}
