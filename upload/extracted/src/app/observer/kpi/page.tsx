import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { ManagerKpiView } from "@/components/ManagerKpiView";
import { getManagerKpiPage } from "@/db/manager-cabinet";
import { getPlatformUserById } from "@/db/queries";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ManagerKpiPage() {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/observer");

  const [user, page] = await Promise.all([
    getPlatformUserById(session.userId),
    getManagerKpiPage(session.userId),
  ]);
  if (!page) redirect("/login");

  return (
    <AppShell pathname="/observer/kpi" role="manager" themeHue={user?.avatarHue ?? 220}>
      <ManagerKpiView
        period={page.period}
        rows={page.rows}
        summary={page.summary}
        team={page.team.map((row) => ({ id: row.id, name: row.name }))}
      />
    </AppShell>
  );
}
