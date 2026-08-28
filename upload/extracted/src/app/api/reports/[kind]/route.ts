import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as XLSX from "xlsx";
import {
  getAttestationsReport,
  getHiringReport,
  getLearningReport,
  getMentorsReport,
  getTestingReport,
  getTrialReport,
} from "@/db/reports";
import { getSession } from "@/lib/auth";
import {
  isReportSection,
  parseReportFilters,
  type ReportSection,
} from "@/lib/report-filters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function flattenReport(section: ReportSection, data: unknown): string[][] {
  const rows: string[][] = [["section", "metric", "value"]];
  const push = (metric: string, value: string | number | null | undefined) => {
    rows.push([section, metric, value == null ? "" : String(value)]);
  };

  if (section === "hiring") {
    const d = data as Awaited<ReturnType<typeof getHiringReport>>;
    push("total", d.total);
    push("closedVacancies", d.closedVacancies);
    push("avgDaysToClose", d.avgDaysToClose);
    for (const row of d.conversions)
      push(`conversion.${row.key}`, `${row.count}/${row.rate}%`);
    for (const row of d.byVacancy) push(`vacancy.${row.label}`, row.count);
    for (const row of d.bySource) push(`source.${row.label}`, row.count);
    for (const row of d.rejections) push(`rejection.${row.label}`, row.count);
    return rows;
  }
  if (section === "testing") {
    const d = data as Awaited<ReturnType<typeof getTestingReport>>;
    push("averageScore", d.averageScore);
    push("completedCount", d.completedCount);
    push("unfinishedCount", d.unfinishedCount);
    push("avgDurationMin", d.avgDurationMin);
    push("claimedVsActualCount", d.claimedVsActualCount);
    for (const row of d.byRole)
      push(`role.${row.label}`, `${row.average}% (${row.count})`);
    for (const row of d.hardTopics) push(`hard.${row.label}`, row.count);
    for (const row of d.unconfirmedSkills)
      push(`skill.${row.label}`, row.count);
    return rows;
  }
  if (section === "trial" || section === "mentors") {
    const d = data as Awaited<ReturnType<typeof getTrialReport>>;
    push("started", d.started);
    push("finished", d.finished);
    push("hired", d.hired);
    push("rejected", d.rejected);
    for (const row of d.byDay)
      push(`day.${row.label}`, `${row.averageScore}% (${row.count})`);
    for (const row of d.weakLessons) push(`weak.${row.label}`, row.count);
    for (const row of d.mentors) push(`mentor.${row.label}`, `${row.hireRate}%`);
    return rows;
  }
  if (section === "attestations") {
    const d = data as Awaited<ReturnType<typeof getAttestationsReport>>;
    push("total", d.total);
    push("reviews", d.reviews);
    for (const row of d.byStatus) push(`status.${row.label}`, row.count);
    for (const row of d.byDecision) push(`decision.${row.label}`, row.count);
    return rows;
  }
  const d = data as Awaited<ReturnType<typeof getLearningReport>>;
  push("overallProgress", d.overallProgress);
  push("employeeCount", d.employeeCount);
  push("completedLessons", d.completedLessons);
  push("readyForAttestation", d.readyForAttestation);
  push("reachedMiddle", d.reachedMiddle);
  for (const row of d.byMonth) push(`month.${row.label}`, `${row.percent}%`);
  for (const row of d.lagging) push(`lagging.${row.name}`, `${row.percent}%`);
  for (const row of d.weakCompetencies)
    push(`competency.${row.label}`, row.count);
  return rows;
}

async function loadData(
  section: ReportSection,
  filters: ReturnType<typeof parseReportFilters>,
) {
  if (section === "hiring") return getHiringReport(filters);
  if (section === "testing") return getTestingReport(filters);
  if (section === "trial") return getTrialReport(filters);
  if (section === "mentors") return getMentorsReport(filters);
  if (section === "attestations") return getAttestationsReport(filters);
  return getLearningReport(filters);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ kind: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { kind } = await context.params;
  if (!isReportSection(kind)) {
    return NextResponse.json({ error: "Unknown report" }, { status: 404 });
  }
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  const filters = parseReportFilters(Object.fromEntries(url.searchParams));
  const data = await loadData(kind, filters);
  const table = flattenReport(kind, data);

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(table);
    XLSX.utils.book_append_sheet(wb, sheet, kind);
    const buffer = XLSX.write(wb, {
      type: "buffer",
      bookType: "xlsx",
    }) as Buffer;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="akela-report-${kind}.xlsx"`,
      },
    });
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage([595, 842]);
  let y = 800;
  const draw = (text: string, size = 11) => {
    if (y < 40) {
      page = pdf.addPage([595, 842]);
      y = 800;
    }
    page.drawText(text.slice(0, 110), {
      x: 40,
      y,
      size,
      font,
      color: rgb(0.1, 0.1, 0.15),
    });
    y -= size + 6;
  };
  draw(`AKELA report: ${kind}`, 16);
  draw(`Period: ${filters.from ?? "..."} - ${filters.to ?? "..."}`);
  draw(`Department: ${filters.department ?? "all"}`);
  y -= 8;
  for (const row of table.slice(1)) {
    draw(`${row[1]}: ${row[2]}`);
  }
  const bytes = await pdf.save();
  return new NextResponse(Uint8Array.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="akela-report-${kind}.pdf"`,
    },
  });
}
