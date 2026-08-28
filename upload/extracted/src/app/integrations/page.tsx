import { redirect } from "next/navigation";
import { IntegrationsHubView } from "@/components/IntegrationsHubView";
import { getIntegrationsOverview } from "@/db/integrations";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");
  const overview = await getIntegrationsOverview();
  const statuses: Record<string, boolean> = {
    drive: overview.env.drive,
    sheets: overview.env.sheets,
  };
  for (const item of overview.items) {
    statuses[item.system] = item.configured;
  }
  return <IntegrationsHubView statuses={statuses} />;
}
