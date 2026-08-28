import { redirect } from "next/navigation";
import { ReportsHubView } from "@/components/ReportsHubView";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");
  return <ReportsHubView />;
}
