import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { ManagerAttestationsView } from "@/components/ManagerAttestationsView";
import { getManagerAttestationsPage } from "@/db/manager-cabinet";
import { getPlatformUserById } from "@/db/queries";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ManagerAttestationsPage() {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/observer");

  const [user, page] = await Promise.all([
    getPlatformUserById(session.userId),
    getManagerAttestationsPage(session.userId),
  ]);
  if (!page) redirect("/login");

  return (
    <AppShell
      pathname="/observer/attestations"
      role="manager"
      themeHue={user?.avatarHue ?? 220}
    >
      <ManagerAttestationsView
        rows={page.rows}
        pendingPromotions={page.pendingPromotions}
        upcoming={page.upcoming}
      />
    </AppShell>
  );
}
