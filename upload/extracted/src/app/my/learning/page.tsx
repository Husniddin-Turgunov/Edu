import { redirect } from "next/navigation";
import { ParticipantLearningView } from "@/components/ParticipantLearningView";
import { getParticipantLearning, getPlatformUserById } from "@/db/queries";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MyLearningPage() {
  const session = await getSession();
  if (!session || session.role !== "participant") redirect("/login");
  if (
    session.participantKind !== "employee" &&
    session.participantKind !== "intern"
  ) {
    redirect("/my/tests");
  }

  const [learning, user] = await Promise.all([
    getParticipantLearning(session),
    getPlatformUserById(session.userId),
  ]);
  if (!learning) redirect("/my");

  return (
    <ParticipantLearningView
      data={learning}
      themeHue={user?.avatarHue ?? 220}
    />
  );
}
