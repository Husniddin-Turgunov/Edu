import { redirect } from "next/navigation";
import { LearningAdminView } from "@/components/LearningAdminView";
import {
  getLearningLessonStatsAdmin,
  listInternProgramRolesAdmin,
  listLearningLessonsAdmin,
} from "@/db/learning";
import { getStaffingPositions } from "@/db/queries";
import { listInternStandardItems } from "@/db/mentorship";
import { listDailyReportsJournal } from "@/db/intern-reports";
import { listLearningProgramsAdmin } from "@/db/learning-programs";
import { getSession } from "@/lib/auth";
import { isLessonsContentConfigured } from "@/lib/content-files";
import { staffRoleBase } from "@/lib/role-match";

export const dynamic = "force-dynamic";

export default async function AdminLearningPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");

  const [
    lessons,
    lessonStats,
    positions,
    internStandard,
    dailyReports,
    internRoles,
    programs,
  ] = await Promise.all([
    listLearningLessonsAdmin({ limit: 250 }),
    getLearningLessonStatsAdmin(),
    getStaffingPositions(),
    listInternStandardItems(),
    listDailyReportsJournal(),
    listInternProgramRolesAdmin(),
    listLearningProgramsAdmin(),
  ]);

  const seen = new Set<string>();
  const staffRoles: { id: string; label: string; department: string }[] = [];
  for (const position of positions) {
    const label = staffRoleBase(position.role).trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    staffRoles.push({
      id: label,
      label,
      department: position.department,
    });
  }

  return (
    <LearningAdminView
      lessons={lessons}
      lessonStats={lessonStats}
      staffRoles={staffRoles}
      internRoles={internRoles}
      internStandard={internStandard
        .filter((item) => item.itemType === "lesson" && item.lesson)
        .map((item) => ({
          id: item.id,
          lessonId: item.lessonId,
          title: item.lesson!.title,
        }))}
      driveConfigured={await isLessonsContentConfigured()}
      dailyReports={dailyReports}
      programs={programs}
    />
  );
}
