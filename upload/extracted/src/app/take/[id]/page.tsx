import { notFound } from "next/navigation";
import { TakeView } from "@/components/TakeView";
import { getAssignmentForTake } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function TakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getAssignmentForTake(Number(id));
  if (!data) notFound();

  return <TakeView data={data} />;
}
