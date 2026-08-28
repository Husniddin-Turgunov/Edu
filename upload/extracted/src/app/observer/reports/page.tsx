import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { ManagerReportsView } from "@/components/ManagerReportsView";
import { getManagerReportsPage } from "@/db/manager-cabinet";
import { getPlatformUserById } from "@/db/queries";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ManagerReportsPage() {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/observer");

  const [user, page] = await Promise.all([
    getPlatformUserById(session.userId),
    getManagerReportsPage(session.userId),
  ]);
  if (!page) redirect("/login");

  return (
    <AppShell pathname="/observer/reports" role="manager" themeHue={user?.avatarHue ?? 220}>
      <ManagerReportsView summary={page.summary} kpi={page.kpi} tasks={page.tasks} />
    </AppShell>
  );
}
