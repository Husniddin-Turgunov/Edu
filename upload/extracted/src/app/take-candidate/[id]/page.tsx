import { notFound } from "next/navigation";
import { TakeCandidateView } from "@/components/TakeCandidateView";
import { getCandidateAssignmentForTake } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function TakeCandidatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getCandidateAssignmentForTake(Number(id));
  if (!data) notFound();

  return <TakeCandidateView data={data} />;
}
