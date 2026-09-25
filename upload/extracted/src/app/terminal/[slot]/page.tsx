import { TerminalView } from "@/components/TerminalView";
import { getTerminalViewState } from "@/db/terminal";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TerminalPage({
  params,
}: {
  params: Promise<{ slot: string }>;
}) {
  const { slot } = await params;
  const slotNumber = Number(slot);
  if (!Number.isInteger(slotNumber) || slotNumber < 1 || slotNumber > 5) {
    notFound();
  }

  const state = await getTerminalViewState(slotNumber);
  return <TerminalView state={state} />;
}
