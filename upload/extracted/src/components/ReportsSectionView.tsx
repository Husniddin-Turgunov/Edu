"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AppShell, PageHeader } from "@/components/ui";
import { sendReportToManagersAction } from "@/db/actions";
import { useI18n, type MessageKey } from "@/lib/i18n";
import type { ReportSection } from "@/lib/report-filters";

type CountRow = { label: string; count: number; average?: number | null };
type ProgressRow = {
  employeeId: number;
  name: string;
  department: string;
  percent: number;
  credited: number;
  total: number;
};

type HiringData = {
  total: number;
  byVacancy: CountRow[];
  bySource: CountRow[];
  byStatus: CountRow[];
  rejections: CountRow[];
  conversions: { key: string; count: number; rate: number }[];
  avgDaysToClose: number | null;
  closedVacancies: number;
};

type TestingData = {
  averageScore: number | null;
  completedCount: number;
  unfinishedCount: number;
  byRole: { label: string; count: number; average: number | null }[];
  hardTopics: CountRow[];
  unconfirmedSkills: CountRow[];
  claimedVsActualCount: number;
  avgDurationMin: number | null;
};

type TrialData = {
  started: number;
  finished: number;
  hired: number;
  rejected: number;
  byDay: { label: string; count: number; averageScore: number | null }[];
  weakLessons: CountRow[];
  mentors: {
    label: string;
    active: number;
    hired: number;
    ended: number;
    hireRate: number;
  }[];
};

type LearningData = {
  overallProgress: number;
  employeeCount: number;
  completedLessons: number;
  lagging: ProgressRow[];
  weakCompetencies: CountRow[];
  byMonth: { label: string; total: number; credited: number; percent: number }[];
  readyForAttestation: number;
  reachedMiddle: number;
};

const SECTION_TITLE: Record<ReportSection, MessageKey> = {
  hiring: "reports_hiring_title",
  testing: "reports_testing_title",
  trial: "reports_trial_title",
  learning: "reports_learning_title",
  mentors: "reports_mentors_title",
  attestations: "reports_attestations_title",
};

const CONVERSION_LABEL: Record<string, MessageKey> = {
  telegram: "reports_conv_telegram",
  interview: "reports_conv_interview",
  test: "reports_conv_test",
  trial: "reports_conv_trial",
  hired: "reports_conv_hired",
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="panel" style={{ padding: 14 }}>
      <p className="eyebrow" style={{ margin: 0 }}>
        {label}
      </p>
      <strong style={{ fontSize: "1.4rem" }}>{value}</strong>
    </article>
  );
}

function RowsTable({
  title,
  rows,
  valueLabel,
}: {
  title: string;
  rows: { label: string; value: string }[];
  valueLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <article className="panel">
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <p className="muted">—</p>
      </article>
    );
  }
  return (
    <article className="panel">
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div className="list">
        {rows.map((row) => (
          <div key={row.label} className="list-item" style={{ gap: 12 }}>
            <span style={{ flex: 1 }}>{row.label}</span>
            <strong>
              {valueLabel}: {row.value}
            </strong>
          </div>
        ))}
      </div>
    </article>
  );
}

export function ReportsSectionView({
  section,
  filters,
  departments,
  employees,
  hiring,
  testing,
  trial,
  learning,
  mentors,
  attestations,
}: {
  section: ReportSection;
  filters: {
    from: string | null;
    to: string | null;
    department: string | null;
    employeeId: number | null;
  };
  departments: string[];
  employees: { id: number; name: string; department: string; roleTitle: string }[];
  hiring?: HiringData;
  testing?: TestingData;
  trial?: TrialData;
  learning?: LearningData;
  mentors?: {
    activeInterns: number;
    finished: number;
    hired: number;
    rejected: number;
    mentors: TrialData["mentors"];
    weakLessons: CountRow[];
  };
  attestations?: {
    total: number;
    byStatus: CountRow[];
    reviews: number;
    byDecision: CountRow[];
  };
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [from, setFrom] = useState(filters.from ?? "");
  const [to, setTo] = useState(filters.to ?? "");
  const [department, setDepartment] = useState(filters.department ?? "");
  const [employeeId, setEmployeeId] = useState(
    filters.employeeId ? String(filters.employeeId) : "",
  );
  const [sendNote, setSendNote] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (department) params.set("department", department);
    if (employeeId) params.set("employeeId", employeeId);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [from, to, department, employeeId]);

  function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    startTransition(() => {
      router.push(`/reports/${section}${query}`);
    });
  }

  async function sendToManagers() {
    setSendNote(null);
    const result = await sendReportToManagersAction({
      section,
      from: from || null,
      to: to || null,
      department: department || null,
      employeeId: employeeId ? Number(employeeId) : null,
    });
    setSendNote(
      t("reports_sent_note").replace("{count}", String(result.notified)),
    );
  }

  return (
    <AppShell pathname="/reports">
      <PageHeader
        title={t(SECTION_TITLE[section])}
        subtitle={t("reports_section_note")}
        action={
          <Link href="/reports" className="btn">
            {t("reports_back")}
          </Link>
        }
      />

      <form
        className="panel"
        onSubmit={applyFilters}
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          alignItems: "end",
          marginBottom: 16,
        }}
      >
        <label>
          {t("reports_filter_from")}
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          {t("reports_filter_to")}
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label>
          {t("reports_filter_department")}
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">{t("reports_filter_all")}</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("reports_filter_employee")}
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            <option value="">{t("reports_filter_all")}</option>
            {employees
              .filter((emp) => !department || emp.department === department)
              .map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
          </select>
        </label>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {t("reports_apply")}
        </button>
      </form>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <a
          className="btn"
          href={`/api/reports/${section}${query}${query ? "&" : "?"}format=xlsx`}
        >
          {t("reports_export_excel")}
        </a>
        <a
          className="btn"
          href={`/api/reports/${section}${query}${query ? "&" : "?"}format=pdf`}
        >
          {t("reports_export_pdf")}
        </a>
        <button type="button" className="btn" onClick={() => void sendToManagers()}>
          {t("reports_send_managers")}
        </button>
        {sendNote ? <span className="muted">{sendNote}</span> : null}
      </div>

      {section === "hiring" && hiring ? (
        <div className="stack" style={{ gap: 14 }}>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            }}
          >
            <Stat label={t("reports_kpi_candidates")} value={hiring.total} />
            <Stat
              label={t("reports_kpi_closed_vacancies")}
              value={hiring.closedVacancies}
            />
            <Stat
              label={t("reports_kpi_avg_close_days")}
              value={hiring.avgDaysToClose ?? "—"}
            />
          </div>
          <RowsTable
            title={t("reports_conversions")}
            valueLabel="%"
            rows={hiring.conversions.map((row) => ({
              label: t(CONVERSION_LABEL[row.key] ?? "reports_conversions"),
              value: `${row.count} · ${row.rate}%`,
            }))}
          />
          <RowsTable
            title={t("reports_by_vacancy")}
            valueLabel={t("reports_count")}
            rows={hiring.byVacancy.map((r) => ({
              label: r.label,
              value: String(r.count),
            }))}
          />
          <RowsTable
            title={t("reports_by_source")}
            valueLabel={t("reports_count")}
            rows={hiring.bySource.map((r) => ({
              label: r.label,
              value: String(r.count),
            }))}
          />
          <RowsTable
            title={t("reports_rejections")}
            valueLabel={t("reports_count")}
            rows={hiring.rejections.map((r) => ({
              label: r.label,
              value: String(r.count),
            }))}
          />
        </div>
      ) : null}

      {section === "testing" && testing ? (
        <div className="stack" style={{ gap: 14 }}>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            }}
          >
            <Stat
              label={t("reports_kpi_avg_score")}
              value={testing.averageScore == null ? "—" : `${testing.averageScore}%`}
            />
            <Stat
              label={t("reports_kpi_completed_tests")}
              value={testing.completedCount}
            />
            <Stat
              label={t("reports_kpi_unfinished_tests")}
              value={testing.unfinishedCount}
            />
            <Stat
              label={t("reports_kpi_avg_duration")}
              value={
                testing.avgDurationMin == null
                  ? "—"
                  : `${testing.avgDurationMin} ${t("min")}`
              }
            />
            <Stat
              label={t("reports_kpi_claimed_vs_actual")}
              value={testing.claimedVsActualCount}
            />
          </div>
          <RowsTable
            title={t("reports_by_role")}
            valueLabel={t("reports_avg")}
            rows={testing.byRole.map((r) => ({
              label: r.label,
              value: `${r.average ?? "—"}% · ${r.count}`,
            }))}
          />
          <RowsTable
            title={t("reports_hard_topics")}
            valueLabel={t("reports_count")}
            rows={testing.hardTopics.map((r) => ({
              label: r.label,
              value: String(r.count),
            }))}
          />
          <RowsTable
            title={t("reports_unconfirmed_skills")}
            valueLabel={t("reports_count")}
            rows={testing.unconfirmedSkills.map((r) => ({
              label: r.label,
              value: String(r.count),
            }))}
          />
        </div>
      ) : null}

      {section === "trial" && trial ? (
        <div className="stack" style={{ gap: 14 }}>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            }}
          >
            <Stat label={t("reports_kpi_trial_started")} value={trial.started} />
            <Stat label={t("reports_kpi_trial_finished")} value={trial.finished} />
            <Stat label={t("reports_kpi_trial_hired")} value={trial.hired} />
            <Stat label={t("reports_kpi_trial_rejected")} value={trial.rejected} />
          </div>
          <RowsTable
            title={t("reports_trial_by_day")}
            valueLabel={t("reports_avg")}
            rows={trial.byDay.map((r) => ({
              label: r.label,
              value: `${r.averageScore ?? "—"}% · ${r.count}`,
            }))}
          />
          <RowsTable
            title={t("reports_weak_lessons")}
            valueLabel={t("reports_count")}
            rows={trial.weakLessons.map((r) => ({
              label: r.label,
              value: String(r.count),
            }))}
          />
          <RowsTable
            title={t("reports_mentor_effectiveness")}
            valueLabel="%"
            rows={trial.mentors.map((r) => ({
              label: r.label,
              value: `${r.hireRate}% · ${r.hired}/${r.hired + r.ended}`,
            }))}
          />
        </div>
      ) : null}

      {section === "learning" && learning ? (
        <div className="stack" style={{ gap: 14 }}>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            }}
          >
            <Stat
              label={t("reports_kpi_learning_progress")}
              value={`${learning.overallProgress}%`}
            />
            <Stat
              label={t("reports_kpi_completed_lessons")}
              value={learning.completedLessons}
            />
            <Stat
              label={t("reports_kpi_ready_attestation")}
              value={learning.readyForAttestation}
            />
            <Stat
              label={t("reports_kpi_reached_middle")}
              value={learning.reachedMiddle}
            />
          </div>
          <RowsTable
            title={t("reports_by_month")}
            valueLabel="%"
            rows={learning.byMonth.map((r) => ({
              label: r.label,
              value: `${r.percent}% · ${r.credited}/${r.total}`,
            }))}
          />
          <RowsTable
            title={t("reports_lagging")}
            valueLabel="%"
            rows={learning.lagging.map((r) => ({
              label: `${r.name} · ${r.department}`,
              value: `${r.percent}% · ${r.credited}/${r.total}`,
            }))}
          />
          <RowsTable
            title={t("reports_weak_competencies")}
            valueLabel={t("reports_count")}
            rows={learning.weakCompetencies.map((r) => ({
              label: r.label,
              value: String(r.count),
            }))}
          />
        </div>
      ) : null}

      {section === "mentors" && mentors ? (
        <div className="stack" style={{ gap: 14 }}>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            }}
          >
            <Stat label={t("reports_kpi_trial_started")} value={mentors.activeInterns} />
            <Stat label={t("reports_kpi_trial_hired")} value={mentors.hired} />
            <Stat label={t("reports_kpi_trial_rejected")} value={mentors.rejected} />
          </div>
          <RowsTable
            title={t("reports_mentor_effectiveness")}
            valueLabel="%"
            rows={mentors.mentors.map((r) => ({
              label: r.label,
              value: `${r.hireRate}% · active ${r.active} · hired ${r.hired}`,
            }))}
          />
          <RowsTable
            title={t("reports_weak_lessons")}
            valueLabel={t("reports_count")}
            rows={mentors.weakLessons.map((r) => ({
              label: r.label,
              value: String(r.count),
            }))}
          />
        </div>
      ) : null}

      {section === "attestations" && attestations ? (
        <div className="stack" style={{ gap: 14 }}>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            }}
          >
            <Stat label={t("reports_attestations_title")} value={attestations.total} />
            <Stat label={t("reports_count")} value={attestations.reviews} />
          </div>
          <RowsTable
            title={t("reports_by_status")}
            valueLabel={t("reports_count")}
            rows={attestations.byStatus.map((r) => ({
              label: r.label,
              value: String(r.count),
            }))}
          />
          <RowsTable
            title={t("reports_by_decision")}
            valueLabel={t("reports_count")}
            rows={attestations.byDecision.map((r) => ({
              label: r.label || "—",
              value: String(r.count),
            }))}
          />
        </div>
      ) : null}
    </AppShell>
  );
}
