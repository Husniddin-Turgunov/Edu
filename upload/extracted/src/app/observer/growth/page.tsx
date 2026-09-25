import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { ManagerGrowthView } from "@/components/ManagerGrowthView";
import { getManagerGrowthPage } from "@/db/manager-cabinet";
import { getPlatformUserById } from "@/db/queries";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ManagerGrowthPage() {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/observer");

  const [user, page] = await Promise.all([
    getPlatformUserById(session.userId),
    getManagerGrowthPage(session.userId),
  ]);
  if (!page) redirect("/login");

  return (
    <AppShell pathname="/observer/growth" role="manager" themeHue={user?.avatarHue ?? 220}>
      <ManagerGrowthView rows={page.rows} />
    </AppShell>
  );
}
