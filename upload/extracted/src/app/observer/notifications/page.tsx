import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { ManagerNotificationsView } from "@/components/ManagerNotificationsView";
import { getManagerNotificationsPage } from "@/db/manager-cabinet";
import { getPlatformUserById } from "@/db/queries";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ManagerNotificationsPage() {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/observer");

  const [user, page] = await Promise.all([
    getPlatformUserById(session.userId),
    getManagerNotificationsPage(session.userId),
  ]);
  if (!page) redirect("/login");

  return (
    <AppShell
      pathname="/observer/notifications"
      role="manager"
      themeHue={user?.avatarHue ?? 220}
    >
      <ManagerNotificationsView items={page.items} unread={page.unread} />
    </AppShell>
  );
}
