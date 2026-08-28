import { redirect } from "next/navigation";
import { AttestationAdminView } from "@/components/AttestationAdminView";
import { listAssessmentsForSelect, listAttestationsAdmin } from "@/db/learning";
import { getStaffingPositions } from "@/db/queries";
import { getSession } from "@/lib/auth";
import { isContentStorageConfigured } from "@/lib/content-files";
import { staffRoleBase } from "@/lib/role-match";

export const dynamic = "force-dynamic";

export default async function AdminAttestationPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");

  const [attestations, positions, libraryTests] = await Promise.all([
    listAttestationsAdmin(),
    getStaffingPositions(),
    listAssessmentsForSelect(),
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
    <AttestationAdminView
      attestations={attestations}
      staffRoles={staffRoles}
      libraryTests={libraryTests}
      driveConfigured={await isContentStorageConfigured()}
    />
  );
}
