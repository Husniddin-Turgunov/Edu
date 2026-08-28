import { notFound } from "next/navigation";
import { CandidateDetailView } from "@/components/CandidateDetailView";
import {
  getCandidateAudienceAssessments,
  getCandidateDetail,
  getVacancies,
} from "@/db/queries";
import { roleMatchScore } from "@/lib/role-match";

export const dynamic = "force-dynamic";

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const candidateId = Number(id);
  if (!Number.isFinite(candidateId)) notFound();

  const [detail, vacancies, tests] = await Promise.all([
    getCandidateDetail(candidateId),
    getVacancies(),
    getCandidateAudienceAssessments(),
  ]);
  if (!detail) notFound();

  return (
    <CandidateDetailView
      detail={detail}
      vacancies={vacancies}
      assessments={tests
        .filter((test) => roleMatchScore(detail.roleTitle, test.title) >= 50)
        .map((t) => ({ id: t.id, title: t.title }))}
    />
  );
}
