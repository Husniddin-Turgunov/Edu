import { CandidatesView } from "@/components/CandidatesView";
import {
  getCandidateAssignments,
  getCandidateAudienceAssessments,
  getCandidates,
  getVacancies,
} from "@/db/queries";
import { getTerminalQueuesOverview } from "@/db/terminal";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function CandidatesPage() {
  const [list, vacancies, tests, assigns, terminalQueues] = await Promise.all([
    getCandidates(),
    getVacancies(),
    getCandidateAudienceAssessments(),
    getCandidateAssignments(),
    getTerminalQueuesOverview(),
  ]);

  const hdrs = await headers();
  const host =
    hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const baseUrl = `${proto}://${host}`;

  return (
    <CandidatesView
      list={list}
      vacancies={vacancies}
      assessments={tests.map((t) => ({ id: t.id, title: t.title }))}
      assigns={assigns}
      terminalQueues={terminalQueues}
      baseUrl={baseUrl}
    />
  );
}
