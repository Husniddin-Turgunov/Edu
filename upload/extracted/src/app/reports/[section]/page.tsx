import { notFound, redirect } from "next/navigation";
import { ReportsSectionView } from "@/components/ReportsSectionView";
import {
  getAttestationsReport,
  getHiringReport,
  getLearningReport,
  getMentorsReport,
  getReportDepartments,
  getReportEmployees,
  getTestingReport,
  getTrialReport,
} from "@/db/reports";
import { getSession } from "@/lib/auth";
import {
  isReportSection,
  parseReportFilters,
  type ReportSection,
} from "@/lib/report-filters";

export const dynamic = "force-dynamic";

export default async function ReportsSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");
  const { section: raw } = await params;
  if (!isReportSection(raw)) notFound();
  const section = raw as ReportSection;
  const filters = parseReportFilters(await searchParams);
  const [departments, employees] = await Promise.all([
    getReportDepartments(),
    getReportEmployees(filters.department),
  ]);

  const hiring =
    section === "hiring" ? await getHiringReport(filters) : undefined;
  const testing =
    section === "testing" ? await getTestingReport(filters) : undefined;
  const trial =
    section === "trial" || section === "mentors"
      ? await getTrialReport(filters)
      : undefined;
  const learning =
    section === "learning" ? await getLearningReport(filters) : undefined;
  const mentors =
    section === "mentors" ? await getMentorsReport(filters) : undefined;
  const attestations =
    section === "attestations"
      ? await getAttestationsReport(filters)
      : undefined;

  return (
    <ReportsSectionView
      section={section}
      filters={filters}
      departments={departments}
      employees={employees}
      hiring={hiring}
      testing={testing}
      trial={trial}
      learning={learning}
      mentors={mentors}
      attestations={attestations}
    />
  );
}
