import { ResultsHubView } from "@/components/ResultsHubView";
import { getResultsGroupCounts } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function ResultsPage() {
  const counts = await getResultsGroupCounts();
  return <ResultsHubView counts={counts} />;
}
