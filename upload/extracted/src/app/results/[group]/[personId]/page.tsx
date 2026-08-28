import { notFound } from "next/navigation";
import { ResultsPersonTestsView } from "@/components/ResultsPersonTestsView";
import { getPersonTestResults } from "@/db/queries";
import { isResultsGroup } from "@/lib/results-groups";

export const dynamic = "force-dynamic";

export default async function ResultsPersonPage({
  params,
}: {
  params: Promise<{ group: string; personId: string }>;
}) {
  const { group, personId: personIdRaw } = await params;
  if (!isResultsGroup(group)) notFound();
  const personId = Number(personIdRaw);
  if (!Number.isFinite(personId)) notFound();

  const pack = await getPersonTestResults(group, personId);
  if (!pack) notFound();

  return (
    <ResultsPersonTestsView
      group={group}
      personId={personId}
      personName={pack.personName}
      meta={pack.meta}
      tests={pack.tests}
    />
  );
}
