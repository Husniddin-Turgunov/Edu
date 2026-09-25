import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { EmployeeDetailView } from "@/components/EmployeeDetailView";
import { getEmployeeById, getStaffingPositions } from "@/db/queries";
import {
  getActiveMentorship,
  listActiveManagers,
} from "@/db/mentorship";
import { listEmployeeAttestationReviews } from "@/db/attestation-reviews";

export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ portal?: string; login?: string; pass?: string }>;
}) {
  const { id } = await params;
  const flash = await searchParams;
  const data = await getEmployeeById(Number(id));
  if (!data) notFound();

  const hdrs = await headers();
  const host =
    hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const entryUrl = `${proto}://${host}/login`;

  const [mentorship, managers, staffing, attestationReviews] = await Promise.all([
    getActiveMentorship(data.employee.id),
    listActiveManagers(),
    getStaffingPositions(),
    listEmployeeAttestationReviews(data.employee.id),
  ]);

  const vacantPositions = staffing
    .filter((row) => !row.employeeId)
    .map((row) => ({
      id: row.id,
      code: row.code,
      role: row.role,
      department: row.department,
    }));

  return (
    <EmployeeDetailView
      employee={{
        ...data.employee,
        managerName: data.manager?.name ?? null,
        mentorName: data.mentor?.displayName ?? null,
      }}
      employeeResults={data.employeeResults}
      pending={data.pending}
      level={data.level ?? null}
      platformAccess={data.platformAccess}
      matrix={data.matrix}
      completedLessonsCount={data.completedLessonsCount}
      attestations={data.attestations}
      attestationReviews={attestationReviews}
      entranceSnapshot={data.entranceSnapshot}
      trialReports={data.trialReports}
      peers={data.peers}
      assessmentsForAssign={data.assessmentsForAssign}
      vacantPositions={vacantPositions}
      mentorship={
        mentorship
          ? {
              mentorUserId: mentorship.mentorUserId,
              trialStartsAt: mentorship.trialStartsAt,
              trialEndsAt: mentorship.trialEndsAt,
              status: mentorship.status,
              department: mentorship.department,
            }
          : null
      }
      managers={managers}
      entryUrl={entryUrl}
      portalFlash={
        flash.portal && flash.login && flash.pass
          ? { login: flash.login, password: flash.pass }
          : null
      }
    />
  );
}
