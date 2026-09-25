import { notFound, redirect } from "next/navigation";
import { AssessmentsView } from "@/components/AssessmentsView";
import { getAssessments, getCompetencyOptions } from "@/db/queries";
import { isAssessmentTestKind } from "@/lib/drive-file-kind";
import { isContentStorageConfigured } from "@/lib/content-files";

export const dynamic = "force-dynamic";

export default async function AssessmentsKindPage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = await params;
  if (kind === "lessons") redirect("/learning-tests");
  if (!isAssessmentTestKind(kind)) notFound();

  const [tests, audiences] = await Promise.all([
    getAssessments(kind),
    getCompetencyOptions(),
  ]);

  return (
    <AssessmentsView
      kind={kind}
      driveConfigured={await isContentStorageConfigured()}
      tests={tests.map((t) => ({
        id: t.id,
        title: t.title,
        audienceName: t.competencyName,
        questionCount: Number(t.questionCount),
        durationMinutes: t.durationMinutes,
        passScore: t.passScore,
      }))}
      audiences={audiences.map((item) => ({ id: item.id, name: item.name }))}
    />
  );
}
