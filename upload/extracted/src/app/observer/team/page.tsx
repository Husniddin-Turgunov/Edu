import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { ManagerTeamView } from "@/components/ManagerTeamView";
import { getManagerContext } from "@/db/manager-cabinet";
import { getPlatformUserById } from "@/db/queries";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ManagerTeamPage() {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/observer");

  const [user, ctx] = await Promise.all([
    getPlatformUserById(session.userId),
    getManagerContext(session.userId),
  ]);
  if (!ctx) redirect("/login");

  return (
    <AppShell pathname="/observer/team" role="manager" themeHue={user?.avatarHue ?? 220}>
      <ManagerTeamView team={ctx.team} />
    </AppShell>
  );
}
