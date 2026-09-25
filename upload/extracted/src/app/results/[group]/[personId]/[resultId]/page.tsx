import { notFound } from "next/navigation";
import { ResultsDetailView } from "@/components/ResultsDetailView";
import { getPersonResultDetail } from "@/db/queries";
import { isResultsGroup } from "@/lib/results-groups";

export const dynamic = "force-dynamic";

export default async function ResultsDetailPage({
  params,
}: {
  params: Promise<{ group: string; personId: string; resultId: string }>;
}) {
  const {
    group,
    personId: personIdRaw,
    resultId: resultIdRaw,
  } = await params;
  if (!isResultsGroup(group)) notFound();
  const personId = Number(personIdRaw);
  const resultId = Number(resultIdRaw);
  if (!Number.isFinite(personId) || !Number.isFinite(resultId)) notFound();

  const detail = await getPersonResultDetail(group, personId, resultId);
  if (!detail) notFound();

  return (
    <ResultsDetailView
      group={group}
      personId={personId}
      personName={detail.personName}
      meta={detail.meta}
      assessmentTitle={detail.assessmentTitle}
      competencyName={detail.competencyName}
      score={detail.score}
      levelCode={detail.levelCode}
      completedAt={detail.completedAt}
      profileJson={detail.profileJson}
    />
  );
}
