import { notFound } from "next/navigation";
import { AssessmentEditorView } from "@/components/AssessmentEditorView";
import { getAssessmentDetail, getCompetencyOptions } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function AssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [assessment, audiences] = await Promise.all([
    getAssessmentDetail(Number(id)),
    getCompetencyOptions(),
  ]);
  if (!assessment || assessment.source === "attestation") notFound();

  const fromLearning = assessment.source === "learning";

  return (
    <AssessmentEditorView
      assessment={assessment}
      audiences={audiences.map((a) => ({ id: a.id, name: a.name }))}
      backHref={fromLearning ? "/learning-tests" : "/assessments"}
      shellPathname={fromLearning ? "/learning-tests" : "/assessments"}
    />
  );
}
