import { redirect } from "next/navigation";
import { ParticipantDailyReportView } from "@/components/ParticipantDailyReportView";
import { getInternDailyReportPage } from "@/db/intern-reports";
import { getPlatformUserById } from "@/db/queries";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MyDailyReportPage() {
  const session = await getSession();
  if (!session || session.role !== "participant") redirect("/login");
  if (session.participantKind !== "intern") redirect("/my/attestation");
  if (!session.employeeId) redirect("/login?error=invalid");

  const [page, user] = await Promise.all([
    getInternDailyReportPage(session.employeeId),
    getPlatformUserById(session.userId),
  ]);
  if (!page) redirect("/my");

  return (
    <ParticipantDailyReportView
      personName={page.intern.name}
      roleTitle={page.intern.roleTitle}
      department={page.intern.department}
      today={page.today}
      dayNumber={page.dayNumber}
      todayReport={page.todayReport}
      history={page.history}
      themeHue={user?.avatarHue ?? 220}
    />
  );
}
