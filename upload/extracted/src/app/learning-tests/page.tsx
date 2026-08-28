import { redirect } from "next/navigation";
import { LearningTestsAdminView } from "@/components/LearningTestsAdminView";
import {
  listAssessmentsForSelect,
  listInternProgramRolesAdmin,
  listLearningLessonsAdmin,
  getLearningTestStatsAdmin,
  listLearningTestsAdminCompact,
} from "@/db/learning";
import { getStaffingPositions } from "@/db/queries";
import { getSession } from "@/lib/auth";
import { staffRoleBase } from "@/lib/role-match";

export const dynamic = "force-dynamic";

export default async function AdminLearningTestsPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");

  const [tests, testStats, lessons, assessments, positions, internRoles] =
    await Promise.all([
    listLearningTestsAdminCompact(250),
    getLearningTestStatsAdmin(),
    listLearningLessonsAdmin({ limit: 250 }),
    listAssessmentsForSelect(),
    getStaffingPositions(),
    listInternProgramRolesAdmin(),
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
    <LearningTestsAdminView
      tests={tests.map((test) => ({
        dbId: test.dbId,
        id: test.id,
        lessonDbId: test.lessonDbId,
        lessonId: test.lessonId,
        lessonTitle: test.lessonTitle,
        title: test.title,
        summary: test.summary,
        level: test.level,
        roleFamilies: test.roleFamilies,
        topics: test.topics,
        durationMin: test.durationMin,
        assessmentId: test.assessmentId,
        isActive: test.isActive,
      }))}
      testStats={testStats}
      lessons={lessons.map((l) => ({
        dbId: l.dbId,
        id: l.id,
        title: l.title,
        hasTest: l.hasTest,
      }))}
      assessments={assessments}
      staffRoles={staffRoles}
      internRoles={internRoles}
    />
  );
}
