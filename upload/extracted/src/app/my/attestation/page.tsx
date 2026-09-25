import { redirect } from "next/navigation";
import { ParticipantAttestationView } from "@/components/ParticipantAttestationView";
import { getEmployeeAttestationPage } from "@/db/employee-home";
import { getPlatformUserById } from "@/db/queries";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MyAttestationPage() {
  const session = await getSession();
  if (!session || session.role !== "participant") redirect("/login");
  if (session.participantKind === "intern") {
    redirect("/my/daily-report");
  }
  if (session.participantKind !== "employee") {
    redirect("/my/tests");
  }
  if (!session.employeeId) redirect("/login?error=invalid");

  const [data, user] = await Promise.all([
    getEmployeeAttestationPage(session.employeeId),
    getPlatformUserById(session.userId),
  ]);
  if (!data) redirect("/my");

  return (
    <ParticipantAttestationView
      data={data}
      themeHue={user?.avatarHue ?? 220}
    />
  );
}
