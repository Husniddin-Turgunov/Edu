import { notFound, redirect } from "next/navigation";
import { ParticipantTakeView } from "@/components/ParticipantTakeView";
import {
  getParticipantAssignmentForTake,
  getPlatformUserById,
} from "@/db/queries";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MyTakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "participant") redirect("/login");

  const { id } = await params;
  const [data, user] = await Promise.all([
    getParticipantAssignmentForTake(Number(id), session),
    getPlatformUserById(session.userId),
  ]);
  if (!data) notFound();

  const shellRole =
    session.participantKind === "intern"
      ? "intern"
      : session.participantKind === "employee"
        ? "employee"
        : "candidate";

  return (
    <ParticipantTakeView
      data={data}
      themeHue={user?.avatarHue ?? 220}
      shellRole={shellRole}
    />
  );
}
