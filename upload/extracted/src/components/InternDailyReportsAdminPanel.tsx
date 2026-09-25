"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { localizeStaffText } from "@/lib/staff-localization";

export type DailyJournalRow = {
  id: number;
  reportDate: string;
  internEmployeeId: number;
  internName: string;
  roleTitle: string;
  department: string;
  mentorName: string | null;
  status: string;
  dayNumber: number;
  scoreKnowledge: number | null;
  scorePractice: number | null;
  scoreIndependence: number | null;
  total: number | null;
  conclusion: string;
  weakSpot: string;
  planTomorrow: string;
};

export function InternDailyReportsAdminPanel({
  reports = [],
}: {
  reports?: DailyJournalRow[];
}) {
  const { t, locale } = useI18n();
  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState("all");

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const row of reports) {
      if (row.department) set.add(row.department);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [reports]);

  const visible = useMemo(
    () =>
      reports.filter((row) => {
        if (department !== "all" && row.department !== department) return false;
        if (status === "pending" && row.status === "reviewed") return false;
        if (status === "reviewed" && row.status !== "reviewed") return false;
        return true;
      }),
    [reports, department, status],
  );

  const pendingCount = reports.filter(
    (row) => row.status !== "reviewed",
  ).length;
  const learnedCount = reports.filter(
    (row) => row.total != null && row.total >= 5,
  ).length;

  return (
    <article className="panel table-wrap">
      <h2>{t("daily_admin_title")}</h2>
      <p className="muted">{t("daily_admin_note")}</p>

      <div className="daily-journal-stats">
        <span>
          {t("daily_admin_stat_total").replace("{n}", String(reports.length))}
        </span>
        <span>
          {t("daily_admin_stat_pending").replace("{n}", String(pendingCount))}
        </span>
        <span>
          {t("daily_admin_stat_learned").replace("{n}", String(learnedCount))}
        </span>
      </div>

      <div className="learn-filters learn-filters-single">
        <label>
          {t("daily_admin_department")}
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="all">{t("daily_admin_all_departments")}</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {localizeStaffText(dept, locale, "department")}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("daily_report_status")}
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">{t("daily_admin_all_statuses")}</option>
            <option value="pending">
              {t("daily_report_status_submitted")}
            </option>
            <option value="reviewed">
              {t("daily_report_status_reviewed")}
            </option>
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="muted daily-journal-empty">
          {t("daily_admin_journal_empty")}
        </p>
      ) : (
        <table className="daily-journal-table">
          <thead>
            <tr>
              <th>{t("daily_admin_col_date")}</th>
              <th>{t("full_name")}</th>
              <th>{t("col_position")}</th>
              <th>{t("daily_admin_department")}</th>
              <th className="num">{t("daily_admin_col_day")}</th>
              <th className="num">{t("daily_admin_col_knowledge")}</th>
              <th className="num">{t("daily_admin_col_practice")}</th>
              <th className="num">{t("daily_admin_col_independence")}</th>
              <th className="num">{t("daily_report_total")}</th>
              <th>{t("daily_report_conclusion")}</th>
              <th>{t("daily_admin_col_weak")}</th>
              <th>{t("daily_admin_col_repeat")}</th>
              <th>{t("daily_admin_col_head")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id}>
                <td>
                  {new Date(
                    `${row.reportDate}T12:00:00`,
                  ).toLocaleDateString(dateLocale)}
                </td>
                <td>{localizeStaffText(row.internName, locale, "name")}</td>
                <td>{localizeStaffText(row.roleTitle, locale, "role")}</td>
                <td>
                  {localizeStaffText(row.department, locale, "department")}
                </td>
                <td className="num">{row.dayNumber}</td>
                <td className="num">{row.scoreKnowledge ?? "—"}</td>
                <td className="num">{row.scorePractice ?? "—"}</td>
                <td className="num">{row.scoreIndependence ?? "—"}</td>
                <td className="num">
                  {row.total == null ? "—" : `${row.total}/6`}
                </td>
                <td>
                  {row.conclusion ||
                    (row.status === "reviewed"
                      ? "—"
                      : t("daily_report_status_submitted"))}
                </td>
                <td>{row.weakSpot || "—"}</td>
                <td>{row.planTomorrow || "—"}</td>
                <td>{row.mentorName ?? t("mentor_unassigned")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
