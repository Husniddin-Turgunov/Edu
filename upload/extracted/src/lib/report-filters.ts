export type ReportSection =
  | "hiring"
  | "testing"
  | "trial"
  | "learning"
  | "mentors"
  | "attestations";

export const REPORT_SECTIONS: ReportSection[] = [
  "hiring",
  "testing",
  "trial",
  "learning",
  "mentors",
  "attestations",
];

export function isReportSection(value: string): value is ReportSection {
  return (REPORT_SECTIONS as readonly string[]).includes(value);
}

export type ReportFilters = {
  from: string | null;
  to: string | null;
  department: string | null;
  employeeId: number | null;
};

export function parseReportFilters(
  input: Record<string, string | string[] | undefined>,
): ReportFilters {
  const one = (key: string) => {
    const raw = input[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value?.trim() || null;
  };
  const employeeRaw = one("employeeId");
  const employeeId = employeeRaw ? Number(employeeRaw) : null;
  return {
    from: one("from"),
    to: one("to"),
    department: one("department"),
    employeeId:
      employeeId && Number.isFinite(employeeId) && employeeId > 0
        ? employeeId
        : null,
  };
}

export function inDateRange(
  iso: string | null | undefined,
  filters: ReportFilters,
) {
  if (!iso) return !filters.from && !filters.to;
  const day = iso.slice(0, 10);
  if (filters.from && day < filters.from) return false;
  if (filters.to && day > filters.to) return false;
  return true;
}

export function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}
