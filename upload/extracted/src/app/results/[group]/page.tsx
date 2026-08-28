import { notFound } from "next/navigation";
import { ResultsPeopleView } from "@/components/ResultsPeopleView";
import { getResultPeople } from "@/db/queries";
import { isResultsGroup } from "@/lib/results-groups";

export const dynamic = "force-dynamic";

export default async function ResultsGroupPage({
  params,
}: {
  params: Promise<{ group: string }>;
}) {
  const { group } = await params;
  if (!isResultsGroup(group)) notFound();
  const people = await getResultPeople(group);
  return <ResultsPeopleView group={group} people={people} />;
}
