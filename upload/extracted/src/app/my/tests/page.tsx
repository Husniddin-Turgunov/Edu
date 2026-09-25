import { redirect } from "next/navigation";
import { ParticipantTestsView } from "@/components/ParticipantTestsView";
import {
  getParticipantHome,
  getParticipantVerificationTests,
  getPlatformUserById,
} from "@/db/queries";
import { getSession } from "@/lib/auth";
import type { MessageKey } from "@/lib/i18n";
import type { ParticipantKind } from "@/lib/auth-core";

function participantKindKey(kind: ParticipantKind | null): MessageKey {
  if (kind === "employee") return "role_employee";
  if (kind === "intern") return "role_intern";
  if (kind === "candidate") return "role_candidate";
  return "role_participant";
}

export const dynamic = "force-dynamic";

export default async function MyTestsPage() {
  const session = await getSession();
  if (!session || session.role !== "participant") redirect("/login");

  const user = await getPlatformUserById(session.userId);
  const themeHue = user?.avatarHue ?? 220;

  if (
    session.participantKind === "employee" ||
    session.participantKind === "intern"
  ) {
    const data = await getParticipantVerificationTests(session);
    if (!data) redirect("/my");
    return <ParticipantTestsView data={data} themeHue={themeHue} />;
  }

  const home = await getParticipantHome(session);
  if (!home) redirect("/login?error=invalid");

  return (
    <ParticipantTestsView
      data={home}
      kindKey={participantKindKey(session.participantKind)}
      themeHue={themeHue}
    />
  );
}
