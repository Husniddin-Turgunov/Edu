import { notFound, redirect } from "next/navigation";
import { AttestationEditorView } from "@/components/AttestationEditorView";
import { getAttestationById, listAssessmentsForSelect } from "@/db/learning";
import { getAssessmentDetail, getStaffingPositions } from "@/db/queries";
import { getSession } from "@/lib/auth";
import { staffRoleBase } from "@/lib/role-match";
import {
  listAttestationEmployees,
  listAttestationReviews,
} from "@/db/attestation-reviews";

export const dynamic = "force-dynamic";

export default async function AdminAttestationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");

  const { id } = await params;
  const attestation = await getAttestationById(Number(id));
  if (!attestation) notFound();

  const [assessment, positions, libraryTests, employees, reviews] =
    await Promise.all([
    attestation.assessmentId
      ? getAssessmentDetail(attestation.assessmentId)
      : Promise.resolve(null),
    getStaffingPositions(),
    listAssessmentsForSelect(),
    listAttestationEmployees(),
    listAttestationReviews(attestation.id),
  ]);

  const seen = new Set<string>();
  const staffRoles: { id: string; label: string; department: string }[] = [];
  for (const position of positions) {
    const label = staffRoleBase(position.role).trim();
    if (!label) continue;
    const key = `${position.department}::${label}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    staffRoles.push({
      id: label,
      label,
      department: position.department,
    });
  }

  return (
    <AttestationEditorView
      attestation={attestation}
      questions={assessment?.questions ?? []}
      assessmentId={attestation.assessmentId}
      staffRoles={staffRoles}
      libraryTests={libraryTests}
      employees={employees}
      reviews={reviews}
    />
  );
}
