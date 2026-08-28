import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { ManagerMeetingsView } from "@/components/ManagerMeetingsView";
import { getManagerMeetingsPage } from "@/db/manager-cabinet";
import { getPlatformUserById } from "@/db/queries";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ManagerMeetingsPage() {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/observer");

  const [user, page] = await Promise.all([
    getPlatformUserById(session.userId),
    getManagerMeetingsPage(session.userId),
  ]);
  if (!page) redirect("/login");

  return (
    <AppShell pathname="/observer/meetings" role="manager" themeHue={user?.avatarHue ?? 220}>
      <ManagerMeetingsView
        team={page.team}
        meetings={page.meetings}
        counts={page.counts}
      />
    </AppShell>
  );
}
