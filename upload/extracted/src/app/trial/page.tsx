import { TrialAdminView } from "@/components/TrialAdminView";
import { getInternManagementData } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function TrialPeriodPage() {
  const data = await getInternManagementData();
  return (
    <TrialAdminView
      interns={data.interns}
      readyCandidates={data.readyCandidates}
    />
  );
}
