import { InternsView } from "@/components/InternsView";
import { getInternManagementData } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function InternsPage() {
  const data = await getInternManagementData();
  return (
    <InternsView
      interns={data.interns}
      readyCandidates={data.readyCandidates}
    />
  );
}
