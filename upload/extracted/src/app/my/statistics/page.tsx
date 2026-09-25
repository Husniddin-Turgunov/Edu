import { redirect } from "next/navigation";
import { ParticipantStatisticsView } from "@/components/ParticipantStatisticsView";
import { getParticipantStatistics, getPlatformUserById } from "@/db/queries";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MyStatisticsPage() {
  const session = await getSession();
  if (!session || session.role !== "participant") redirect("/login");
  if (
    session.participantKind !== "employee" &&
    session.participantKind !== "intern"
  ) {
    redirect("/my/tests");
  }

  const [stats, user] = await Promise.all([
    getParticipantStatistics(session),
    getPlatformUserById(session.userId),
  ]);
  if (!stats) redirect("/my");

  return (
    <ParticipantStatisticsView
      data={stats}
      themeHue={user?.avatarHue ?? 220}
    />
  );
}
